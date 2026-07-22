import { Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import {
  users,
  drivers,
  rides,
  cities,
  userFollows,
  ridePosts,
  ridePostReactions,
  ridePostComments,
  driverTags,
  communityPrestige,
  prayerRideDispatches,
} from "@shared/schema";
import { eq, ne, and, or, desc, gte, inArray, isNull, count, ilike, sql } from "drizzle-orm";
import { getAgoraViewerCount } from "./agoraStreaming";
import { scorePeopleMatches, recordImpressions, type ScoredMatch } from "./matchAgent";

// Social layer: follows between users + rides published or live-streamed to
// the feed via Twitch. Privacy rules: social payloads only ever expose
// id / name / avatar — never email, phone or coordinates.
// Posts store server-derived coarse data only (city name, distance).

export const socialRouter = Router();

const STREAMABLE_STATUSES = ["accepted", "arriving", "started", "in_progress"];
const CAPTION_MAX = 280;

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

// Writes (follow, publish, stream, twitch channel) require a full account.
async function getWriteUser(req: any) {
  const session = await getSessionUser(req);
  if (!session) return null;
  const user = await storage.getUser(session.userId);
  if (!user || user.isGuest) return null;
  return user;
}

// rides.driverId is drivers.id — map to the driver's users.id for all
// participant checks and follow targets.
async function getRideParticipants(ride: { customerId: string; driverId: string | null }) {
  let driverUserId: string | null = null;
  if (ride.driverId) {
    const [drv] = await db
      .select({ userId: drivers.userId })
      .from(drivers)
      .where(eq(drivers.id, ride.driverId));
    driverUserId = drv?.userId || null;
  }
  return { customerId: ride.customerId, driverUserId };
}

// Coarse city label for a coordinate against a preloaded city list — never
// exposes the coordinate itself. Kept pure so the memories endpoint can load
// the (small) cities table once and label many rides without N+1 queries.
type CityRow = { name: string; centerLat: unknown; centerLng: unknown; radiusKm: unknown };
function cityNameForCoords(cityRows: CityRow[], lat: number, lng: number): string | null {
  if (isNaN(lat) || isNaN(lng)) return null;
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of cityRows) {
    const cLat = parseFloat(String(c.centerLat));
    const cLng = parseFloat(String(c.centerLng));
    const radius = parseFloat(String(c.radiusKm)) || 30;
    const dLat = ((cLat - lat) * Math.PI) / 180;
    const dLng = ((cLng - lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat * Math.PI) / 180) * Math.cos((cLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const dist = 2 * 6371 * Math.asin(Math.sqrt(a));
    if (dist <= radius && dist < bestDist) {
      best = c.name;
      bestDist = dist;
    }
  }
  return best;
}

async function deriveCityName(lat: number, lng: number): Promise<string | null> {
  if (isNaN(lat) || isNaN(lng)) return null;
  const rows = await db.select().from(cities);
  return cityNameForCoords(rows as CityRow[], lat, lng);
}

// Round a coordinate to ~1km precision so a memory map shows an anonymized,
// approximate route — never the exact pickup/dropoff (i.e. someone's home).
function coarsenCoord(v: number): number | null {
  if (isNaN(v)) return null;
  return Math.round(v * 100) / 100;
}

function publicUser(u: { id: string; name: string; avatar: string | null }) {
  return { id: u.id, name: u.name, avatar: u.avatar };
}

// Display-only @handle derived deterministically from name + id — no new
// column, no uniqueness contract. Shown on the TikTok-style profile.
function handleFor(u: { id: string; name: string | null }) {
  const slug = String(u.name || "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16) || "rider";
  const suffix = String(u.id || "").replace(/[^a-z0-9]/gi, "").slice(0, 4).toLowerCase();
  return `${slug}${suffix}`;
}

// Batch-decorate a set of user ids into "people cards" for search / contact
// sync / QR preview: follower count, published-ride count, whether the viewer
// already follows them, and trust badges. Only public fields, never contact info.
async function buildPeopleMeta(ids: string[], viewerId: string) {
  const uniq = Array.from(new Set(ids.filter(Boolean)));
  const meta = new Map<string, { followers: number; rides: number; isFollowing: boolean; badges: Badge[] }>();
  if (uniq.length === 0) return meta;
  const [followerRows, postRows, followingRows, badgeMap] = await Promise.all([
    db
      .select({ id: userFollows.followingId, n: count() })
      .from(userFollows)
      .where(inArray(userFollows.followingId, uniq))
      .groupBy(userFollows.followingId),
    db
      .select({ id: ridePosts.userId, n: count() })
      .from(ridePosts)
      .where(inArray(ridePosts.userId, uniq))
      .groupBy(ridePosts.userId),
    db
      .select({ id: userFollows.followingId })
      .from(userFollows)
      .where(and(eq(userFollows.followerId, viewerId), inArray(userFollows.followingId, uniq))),
    computeBadges(uniq),
  ]);
  const followersById = new Map(followerRows.map((r) => [r.id, Number(r.n)]));
  const postsById = new Map(postRows.map((r) => [r.id, Number(r.n)]));
  const followingSet = new Set(followingRows.map((r) => r.id));
  for (const id of uniq) {
    meta.set(id, {
      followers: followersById.get(id) || 0,
      rides: postsById.get(id) || 0,
      isFollowing: followingSet.has(id),
      badges: badgeMap.get(id) || [],
    });
  }
  return meta;
}

// ---------------------------------------------------------------------------
// Status badges. These only SURFACE existing trust/reputation state — we never
// mint new badge types here. Everything is server-derived and batched by the
// set of author user ids. Only drivers carry driver-scoped badges; riders get
// none (expected). label carries display text (e.g. rating value / tier name).
// ---------------------------------------------------------------------------

type Badge = { kind: string; label: string };

async function computeBadges(userIds: string[]): Promise<Map<string, Badge[]>> {
  const result = new Map<string, Badge[]>();
  const uniq = Array.from(new Set(userIds.filter(Boolean)));
  if (uniq.length === 0) return result;

  const add = (userId: string, badge: Badge) => {
    const arr = result.get(userId) || [];
    arr.push(badge);
    result.set(userId, arr);
  };

  // Only drivers carry the driver-scoped badges.
  const driverRows = await db
    .select({
      id: drivers.id,
      userId: drivers.userId,
      status: drivers.status,
      rating: drivers.rating,
      totalTrips: drivers.totalTrips,
    })
    .from(drivers)
    .where(inArray(drivers.userId, uniq));

  if (driverRows.length === 0) return result;

  const userByDriver = new Map<string, string>();
  for (const d of driverRows) userByDriver.set(d.id, d.userId);
  const driverIds = driverRows.map((d) => d.id);

  // verified + rating + top-rated (approved drivers only).
  for (const d of driverRows) {
    if (d.status !== "approved") continue;
    add(d.userId, { kind: "verified", label: "Verified" });
    const rating = parseFloat(String(d.rating ?? "0"));
    const trips = d.totalTrips ?? 0;
    if (!isNaN(rating) && rating > 0 && trips > 0) {
      add(d.userId, { kind: "rating", label: rating.toFixed(1) });
      if (rating >= 4.8 && trips >= 20) {
        add(d.userId, { kind: "top_rated", label: "Top Rated" });
      }
    }
  }

  const now = new Date();
  const [tagRows, prestigeRows, prayerRows] = await Promise.all([
    db
      .select({ driverId: driverTags.driverId, tag: driverTags.tag, expiresAt: driverTags.expiresAt })
      .from(driverTags)
      .where(
        and(
          inArray(driverTags.driverId, driverIds),
          inArray(driverTags.tag, ["founding_driver", "city_champion"]),
        ),
      ),
    db
      .select({ userId: communityPrestige.userId, tier: communityPrestige.tier })
      .from(communityPrestige)
      .where(inArray(communityPrestige.userId, uniq)),
    // Prayer rides have no "completed" dispatch status — count the linked rides
    // that actually completed (mirrors /api/drivers/me).
    db
      .select({ driverId: rides.driverId, n: count() })
      .from(prayerRideDispatches)
      .innerJoin(rides, eq(rides.id, prayerRideDispatches.rideId))
      .where(and(inArray(rides.driverId, driverIds), eq(rides.status, "completed")))
      .groupBy(rides.driverId),
  ]);

  for (const t of tagRows) {
    if (t.expiresAt && new Date(t.expiresAt) < now) continue;
    const uid = userByDriver.get(t.driverId);
    if (!uid) continue;
    if (t.tag === "founding_driver") add(uid, { kind: "founding_driver", label: "Founding Driver" });
    else if (t.tag === "city_champion") add(uid, { kind: "city_champion", label: "City Champion" });
  }

  const TIER_LABEL: Record<string, string> = {
    bronze: "Bronze",
    silver: "Silver",
    gold: "Gold",
    platinum: "Platinum",
    diamond: "Diamond",
  };
  for (const p of prestigeRows) {
    const label = TIER_LABEL[String(p.tier || "")];
    if (label) add(p.userId, { kind: "prestige", label });
  }

  for (const pr of prayerRows) {
    if (!pr.driverId) continue;
    const uid = userByDriver.get(pr.driverId);
    const n = Number(pr.n);
    if (uid && n > 0) {
      add(uid, { kind: "prayer_volunteer", label: n === 1 ? "Prayer Volunteer" : `Prayer Volunteer · ${n}` });
    }
  }

  return result;
}

const REACTION_TYPES = ["like", "love", "fire", "celebrate"];
const COMMENT_MAX = 280;
const MEMORY_LIMIT = 40;
const PHOTO_MAX_CHARS = 700000; // ~500KB image once base64-encoded

async function reactionSummary(postId: string, viewerId: string) {
  const [rows, [mine]] = await Promise.all([
    db
      .select({ type: ridePostReactions.type, n: count() })
      .from(ridePostReactions)
      .where(eq(ridePostReactions.postId, postId))
      .groupBy(ridePostReactions.type),
    db
      .select({ type: ridePostReactions.type })
      .from(ridePostReactions)
      .where(and(eq(ridePostReactions.postId, postId), eq(ridePostReactions.userId, viewerId))),
  ]);
  const counts: Record<string, number> = {};
  let total = 0;
  for (const r of rows) {
    counts[r.type] = Number(r.n);
    total += Number(r.n);
  }
  return { reactions: counts, reactionCount: total, myReaction: mine?.type || null };
}

// Batch the reaction/comment counts, the viewer's own reaction, and author
// badges onto a page of feed posts (no per-post queries).
async function attachSocialMeta<T extends { id: string; authorId: string }>(posts: T[], viewerId: string) {
  if (posts.length === 0) return posts as any[];
  const postIds = posts.map((p) => p.id);
  const authorIds = posts.map((p) => p.authorId);
  const [reactionRows, myRows, commentRows, badgeMap] = await Promise.all([
    db
      .select({ postId: ridePostReactions.postId, type: ridePostReactions.type, n: count() })
      .from(ridePostReactions)
      .where(inArray(ridePostReactions.postId, postIds))
      .groupBy(ridePostReactions.postId, ridePostReactions.type),
    db
      .select({ postId: ridePostReactions.postId, type: ridePostReactions.type })
      .from(ridePostReactions)
      .where(and(inArray(ridePostReactions.postId, postIds), eq(ridePostReactions.userId, viewerId))),
    db
      .select({ postId: ridePostComments.postId, n: count() })
      .from(ridePostComments)
      .where(inArray(ridePostComments.postId, postIds))
      .groupBy(ridePostComments.postId),
    computeBadges(authorIds),
  ]);

  const reactionsByPost = new Map<string, Record<string, number>>();
  const totalByPost = new Map<string, number>();
  for (const r of reactionRows) {
    const m = reactionsByPost.get(r.postId) || {};
    m[r.type] = Number(r.n);
    reactionsByPost.set(r.postId, m);
    totalByPost.set(r.postId, (totalByPost.get(r.postId) || 0) + Number(r.n));
  }
  const myByPost = new Map<string, string>();
  for (const r of myRows) myByPost.set(r.postId, r.type);
  const commentByPost = new Map<string, number>();
  for (const c of commentRows) commentByPost.set(c.postId, Number(c.n));

  return posts.map((p) => ({
    ...p,
    reactions: reactionsByPost.get(p.id) || {},
    reactionCount: totalByPost.get(p.id) || 0,
    myReaction: myByPost.get(p.id) || null,
    commentCount: commentByPost.get(p.id) || 0,
    badges: badgeMap.get(p.authorId) || [],
  }));
}

// (Twitch channel endpoint removed — Agora in-app streaming only)

// ---------------------------------------------------------------------------
// Follows
// ---------------------------------------------------------------------------

socialRouter.post("/api/social/follow/:userId", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const targetId = req.params.userId;
    if (targetId === user.id) return res.status(400).json({ error: "You cannot follow yourself" });
    const target = await storage.getUser(targetId);
    if (!target) return res.status(404).json({ error: "User not found" });

    await db
      .insert(userFollows)
      .values({ followerId: user.id, followingId: targetId })
      .onConflictDoNothing();
    res.json({ following: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.delete("/api/social/follow/:userId", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    await db
      .delete(userFollows)
      .where(and(eq(userFollows.followerId, user.id), eq(userFollows.followingId, req.params.userId)));
    res.json({ following: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.get("/api/social/followers", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const rows = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(userFollows)
      .innerJoin(users, eq(users.id, userFollows.followerId))
      .where(eq(userFollows.followingId, session.userId))
      .orderBy(desc(userFollows.createdAt))
      .limit(200);
    res.json({ users: rows.map(publicUser) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.get("/api/social/following", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const rows = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(userFollows)
      .innerJoin(users, eq(users.id, userFollows.followingId))
      .where(eq(userFollows.followerId, session.userId))
      .orderBy(desc(userFollows.createdAt))
      .limit(200);
    res.json({ users: rows.map(publicUser) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.get("/api/social/counts", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [[followers], [following], [likes], [postCount], me] = await Promise.all([
      db.select({ n: count() }).from(userFollows).where(eq(userFollows.followingId, session.userId)),
      db.select({ n: count() }).from(userFollows).where(eq(userFollows.followerId, session.userId)),
      // "Likes" = total reactions received across all of my published posts.
      db
        .select({ n: count() })
        .from(ridePostReactions)
        .innerJoin(ridePosts, eq(ridePosts.id, ridePostReactions.postId))
        .where(eq(ridePosts.userId, session.userId)),
      db.select({ n: count() }).from(ridePosts).where(eq(ridePosts.userId, session.userId)),
      storage.getUser(session.userId),
    ]);
    res.json({
      followers: Number(followers.n),
      following: Number(following.n),
      likes: Number(likes.n),
      posts: Number(postCount.n),
      bio: me?.bio || null,
      handle: me ? handleFor(me) : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Ride social context — who is the other person on this ride (for follow UI).
// Only exposes id / name / avatar of the counterpart.
// ---------------------------------------------------------------------------

socialRouter.get("/api/rides/:id/social-context", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const { customerId, driverUserId } = await getRideParticipants(ride);
    if (session.userId !== customerId && session.userId !== driverUserId) {
      return res.status(403).json({ error: "Not your ride" });
    }
    const counterpartId = session.userId === customerId ? driverUserId : customerId;

    const [me, [myStream], [myPublished]] = await Promise.all([
      storage.getUser(session.userId),
      db
        .select()
        .from(ridePosts)
        .where(
          and(
            eq(ridePosts.rideId, ride.id),
            eq(ridePosts.userId, session.userId),
            eq(ridePosts.type, "stream"),
            isNull(ridePosts.endedAt),
          ),
        ),
      db
        .select({ id: ridePosts.id })
        .from(ridePosts)
        .where(
          and(
            eq(ridePosts.rideId, ride.id),
            eq(ridePosts.userId, session.userId),
            eq(ridePosts.type, "published"),
          ),
        ),
    ]);

    let counterpart: any = null;
    if (counterpartId) {
      const other = await storage.getUser(counterpartId);
      if (other) {
        const [edge] = await db
          .select({ id: userFollows.id })
          .from(userFollows)
          .where(and(eq(userFollows.followerId, session.userId), eq(userFollows.followingId, counterpartId)));
        counterpart = { ...publicUser(other), isFollowing: !!edge };
      }
    }

    res.json({
      counterpart,
      isStreaming: !!myStream,
      hasPublished: !!myPublished,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Stream stop (Agora streams are started via /api/agora/streams/:id/start)
// ---------------------------------------------------------------------------

socialRouter.post("/api/rides/:id/stream/stop", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    await db
      .update(ridePosts)
      .set({ endedAt: new Date(), isLive: false })
      .where(and(
        eq(ridePosts.rideId, req.params.id),
        eq(ridePosts.userId, user.id),
        eq(ridePosts.type, "stream"),
        isNull(ridePosts.endedAt),
      ));
    res.json({ stopped: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.post("/api/rides/:id/publish", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    const { customerId, driverUserId } = await getRideParticipants(ride);
    if (user.id !== customerId && user.id !== driverUserId) {
      return res.status(403).json({ error: "Not your ride" });
    }
    if (ride.status !== "completed") {
      return res.status(400).json({ error: "You can publish a ride after it is completed" });
    }
    const [existing] = await db
      .select()
      .from(ridePosts)
      .where(and(eq(ridePosts.rideId, ride.id), eq(ridePosts.userId, user.id), eq(ridePosts.type, "published")));
    if (existing) return res.status(409).json({ error: "You already published this ride" });

    const caption = String(req.body?.caption || "").slice(0, CAPTION_MAX).trim() || null;

    // Optional memory photo, sent inline as a compressed data URL. Validate the
    // prefix and cap the size so a bad/huge payload can't bloat the feed.
    let photoUrl: string | null = null;
    const rawPhoto = req.body?.photoUrl;
    if (rawPhoto) {
      const s = String(rawPhoto);
      if (!s.startsWith("data:image/")) {
        return res.status(400).json({ error: "Invalid photo format" });
      }
      if (s.length > PHOTO_MAX_CHARS) {
        return res.status(400).json({ error: "Photo is too large. Try again." });
      }
      photoUrl = s;
    }

    const cityName = await deriveCityName(parseFloat(String(ride.pickupLat)), parseFloat(String(ride.pickupLng)));
    const [post] = await db
      .insert(ridePosts)
      .values({
        rideId: ride.id,
        userId: user.id,
        type: "published",
        caption,
        photoUrl,
        cityName,
        distanceKm: ride.distance ?? null,
        isLive: false,
      })
      .returning();
    res.json({ post });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Feed (people I follow + me) and global Live rail
// ---------------------------------------------------------------------------

const POST_FIELDS = {
  id: ridePosts.id,
  type: ridePosts.type,
  streamProvider: ridePosts.streamProvider,
  caption: ridePosts.caption,
  photoUrl: ridePosts.photoUrl,
  cityName: ridePosts.cityName,
  distanceKm: ridePosts.distanceKm,
  isLive: ridePosts.isLive,
  createdAt: ridePosts.createdAt,
  endedAt: ridePosts.endedAt,
  authorId: users.id,
  authorName: users.name,
  authorAvatar: users.avatar,
};

// Agora stream lifecycle is fully server-managed (start/stop via host-grace
// loop), so the DB isLive flag + endedAt are authoritative — no external
// API check needed. Filter out stale rows where endedAt was set.
function withLiveStatus<T extends { id: string; type: string; isLive: boolean; endedAt: Date | null }>(posts: T[]): T[] {
  return posts.map((p) => {
    if (p.type === "stream" && p.endedAt) {
      return { ...p, isLive: false };
    }
    return p;
  });
}

// tab=following (default): me + people I follow, newest first.
// tab=foryou: network-wide ranked feed — engagement (reactions/comments/live)
// with time decay, so fresh + talked-about rides surface first. All numbers
// are real counts; ranking is deterministic server code.
socialRouter.get("/api/social/feed", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const tab = req.query.tab === "foryou" ? "foryou" : "following";

    let posts: any[];
    if (tab === "foryou") {
      const since = new Date(Date.now() - 14 * 24 * 3600 * 1000);
      posts = await db
        .select(POST_FIELDS)
        .from(ridePosts)
        .innerJoin(users, eq(users.id, ridePosts.userId))
        .where(gte(ridePosts.createdAt, since))
        .orderBy(desc(ridePosts.createdAt))
        .limit(120);
      if (posts.length < 20) {
        // Thin network: widen to the latest posts overall so the page is
        // never artificially empty while the 14-day window is quiet.
        posts = await db
          .select(POST_FIELDS)
          .from(ridePosts)
          .innerJoin(users, eq(users.id, ridePosts.userId))
          .orderBy(desc(ridePosts.createdAt))
          .limit(120);
      }
    } else {
      const followed = await db
        .select({ id: userFollows.followingId })
        .from(userFollows)
        .where(eq(userFollows.followerId, session.userId));
      const authorIds = [session.userId, ...followed.map((f) => f.id)];
      posts = await db
        .select(POST_FIELDS)
        .from(ridePosts)
        .innerJoin(users, eq(users.id, ridePosts.userId))
        .where(inArray(ridePosts.userId, authorIds))
        .orderBy(desc(ridePosts.createdAt))
        .limit(50);
    }

    const withLive = withLiveStatus(posts as any);
    let full: any[] = await attachSocialMeta(withLive as any, session.userId);

    if (tab === "foryou") {
      const now = Date.now();
      full = full
        .map((p: any) => {
          const hours = Math.max(0, (now - new Date(p.createdAt).getTime()) / 3600000);
          const engagement =
            p.reactionCount * 5 +
            p.commentCount * 8 +
            (p.isLive ? 60 : 0) +
            (p.photoUrl ? 3 : 0) +
            (p.caption ? 2 : 0);
          return { post: p, score: (engagement + 1) / Math.pow(hours + 2, 1.3) };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 50)
        .map((s) => s.post);
    }

    res.json({ posts: full, tab });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Trending creators — the accounts most worth following right now, ranked by
// real follower counts + published-ride activity. Excludes the viewer and
// anyone already followed. Powers the TikTok-style suggestion cards.
socialRouter.get("/api/social/suggested-creators", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const [followedRows, followerCounts, authorRows] = await Promise.all([
      db
        .select({ id: userFollows.followingId })
        .from(userFollows)
        .where(eq(userFollows.followerId, session.userId)),
      db
        .select({ id: userFollows.followingId, n: count() })
        .from(userFollows)
        .groupBy(userFollows.followingId),
      db
        .select({ id: ridePosts.userId, n: count() })
        .from(ridePosts)
        .groupBy(ridePosts.userId),
    ]);

    const excluded = new Set([session.userId, ...followedRows.map((f) => f.id)]);
    const followersById = new Map(followerCounts.map((r) => [r.id, Number(r.n)]));
    const postsById = new Map(authorRows.map((r) => [r.id, Number(r.n)]));
    const candidateIds = Array.from(
      new Set([...followersById.keys(), ...postsById.keys()]),
    ).filter((id) => id && !excluded.has(id));

    if (candidateIds.length === 0) return res.json({ creators: [] });

    // Rank with the self-learning match agent; fall back to the original
    // popularity score if the engine ever fails.
    let scored: { id: string; score: number }[];
    const reasonById = new Map<string, string>();
    try {
      const matches: ScoredMatch[] = await scorePeopleMatches(
        session.userId,
        candidateIds.map((id) => ({
          id,
          followers: followersById.get(id) || 0,
          posts: postsById.get(id) || 0,
        })),
      );
      scored = matches.slice(0, 8);
      for (const m of matches.slice(0, 8)) reasonById.set(m.id, m.reason);
      recordImpressions(session.userId, matches.slice(0, 8));
    } catch (err: any) {
      console.error("[social] match engine failed, using popularity fallback:", err?.message || err);
      scored = candidateIds
        .map((id) => ({
          id,
          score: (followersById.get(id) || 0) * 3 + (postsById.get(id) || 0) * 2,
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8);
    }
    const ids = scored.map((s) => s.id);

    const [userRows, badgeMap, recentPosts] = await Promise.all([
      db
        .select({ id: users.id, name: users.name, avatar: users.avatar })
        .from(users)
        .where(inArray(users.id, ids)),
      computeBadges(ids),
      db
        .select({
          userId: ridePosts.userId,
          photoUrl: ridePosts.photoUrl,
          cityName: ridePosts.cityName,
          createdAt: ridePosts.createdAt,
        })
        .from(ridePosts)
        .where(inArray(ridePosts.userId, ids))
        .orderBy(desc(ridePosts.createdAt))
        .limit(60),
    ]);

    // Most recent published photo + city per candidate (card backdrop).
    const photoBy = new Map<string, string>();
    const cityBy = new Map<string, string>();
    for (const p of recentPosts) {
      if (p.photoUrl && !photoBy.has(p.userId)) photoBy.set(p.userId, p.photoUrl);
      if (p.cityName && !cityBy.has(p.userId)) cityBy.set(p.userId, p.cityName);
    }

    const byId = new Map(userRows.map((u) => [u.id, u]));
    const creators = scored
      .map((s) => {
        const u = byId.get(s.id);
        if (!u) return null;
        return {
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          followers: followersById.get(u.id) || 0,
          rides: postsById.get(u.id) || 0,
          photoUrl: photoBy.get(u.id) || null,
          cityName: cityBy.get(u.id) || null,
          badges: badgeMap.get(u.id) || [],
          reason: reasonById.get(u.id) || null,
        };
      })
      .filter(Boolean);

    res.json({ creators });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC live broadcasts for the landing page. Streaming is an explicitly
// public act (the Twitch channel is a public broadcast), so this exposes only
// name / avatar / city / country — never coordinates, phones
// or ride details. Cached so public traffic can't hammer the DB or Twitch.
// ---------------------------------------------------------------------------

const PUBLIC_LIVE_CACHE_MS = 25 * 1000;
let publicLiveCache: { at: number; body: any } | null = null;

socialRouter.get("/api/network/live-streams", async (_req, res) => {
  try {
    if (publicLiveCache && Date.now() - publicLiveCache.at < PUBLIC_LIVE_CACHE_MS) {
      return res.json(publicLiveCache.body);
    }

    const posts = await db
      .select(POST_FIELDS)
      .from(ridePosts)
      .innerJoin(users, eq(users.id, ridePosts.userId))
      .where(and(
        eq(ridePosts.type, "stream"),
        isNull(ridePosts.endedAt),
        eq(ridePosts.streamProvider, "agora"),
        eq(ridePosts.isLive, true),
      ))
      .orderBy(desc(ridePosts.createdAt))
      .limit(100);

    const live = posts;

    // Map the stored city name to its country via the cities table.
    let countryByCity = new Map<string, string>();
    if (live.length > 0) {
      const cityRows = await db
        .select({ name: cities.name, regionCode: cities.regionCode })
        .from(cities);
      countryByCity = new Map(
        cityRows.map((c) => [c.name, String(c.regionCode || "").split("-")[0]]),
      );
    }

    const streams = live.map((p: any) => ({
      provider: "agora",
      name: p.authorName,
      avatar: p.authorAvatar,
      postId: p.id,
      viewerCount: getAgoraViewerCount(p.id),
      city: p.cityName || null,
      country: (p.cityName && countryByCity.get(p.cityName)) || null,
      startedAt: p.createdAt,
    }));

    const body = { generatedAt: new Date().toISOString(), streams };
    publicLiveCache = { at: Date.now(), body };
    res.json(body);
  } catch (error: any) {
    console.error("[Social] public live-streams error:", error);
    res.status(500).json({ error: "Live broadcasts are momentarily unavailable" });
  }
});

socialRouter.get("/api/social/live", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const posts = await db
      .select(POST_FIELDS)
      .from(ridePosts)
      .innerJoin(users, eq(users.id, ridePosts.userId))
      .where(and(eq(ridePosts.type, "stream"), isNull(ridePosts.endedAt)))
      .orderBy(desc(ridePosts.createdAt))
      .limit(50);

    const refreshed = withLiveStatus(posts as any);
    const live = refreshed.filter((p: any) => p.isLive);
    res.json({
      streams: live.map((p: any) => ({
        ...p,
        viewerCount: p.streamProvider === "agora" ? getAgoraViewerCount(p.id) : 0,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Ride Memories — the owner's private timeline of their own completed rides.
// Location stays privacy-safe like public posts: only a coarse city label and
// an anonymized (~1km-rounded) route are exposed — never exact coordinates or
// addresses — so a one-tap share can never leak an exact location. The
// counterpart is limited to name/avatar. Fares are shown honestly per role: a
// rider sees what they paid, a driver sees what they earned. Nothing is public.
// ---------------------------------------------------------------------------

socialRouter.get("/api/social/memories", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const [myDriver] = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.userId, session.userId));

    const ownership = myDriver
      ? or(eq(rides.customerId, session.userId), eq(rides.driverId, myDriver.id))
      : eq(rides.customerId, session.userId);

    const rideRows = await db
      .select({
        id: rides.id,
        customerId: rides.customerId,
        driverId: rides.driverId,
        pickupLat: rides.pickupLat,
        pickupLng: rides.pickupLng,
        dropoffLat: rides.dropoffLat,
        dropoffLng: rides.dropoffLng,
        distance: rides.distance,
        actualFare: rides.actualFare,
        estimatedFare: rides.estimatedFare,
        driverEarnings: rides.driverEarnings,
        currency: rides.currency,
        completedAt: rides.completedAt,
        createdAt: rides.createdAt,
        isEvRide: rides.isEvRide,
        isPmgthRide: rides.isPmgthRide,
      })
      .from(rides)
      .where(and(eq(rides.status, "completed"), ownership))
      .orderBy(desc(rides.completedAt))
      .limit(MEMORY_LIMIT);

    // Batch: cities (once), counterpart users, and which rides I've published.
    const rideIds = rideRows.map((r) => r.id);
    const counterpartDriverIds = Array.from(
      new Set(rideRows.filter((r) => r.customerId === session.userId && r.driverId).map((r) => r.driverId as string)),
    );
    const counterpartUserIds = new Set(
      rideRows.filter((r) => r.customerId !== session.userId).map((r) => r.customerId),
    );

    const [cityRows, counterpartDrivers, publishedRows] = await Promise.all([
      db.select().from(cities),
      counterpartDriverIds.length
        ? db
            .select({ id: drivers.id, userId: drivers.userId })
            .from(drivers)
            .where(inArray(drivers.id, counterpartDriverIds))
        : Promise.resolve([] as { id: string; userId: string }[]),
      rideIds.length
        ? db
            .select({ rideId: ridePosts.rideId })
            .from(ridePosts)
            .where(
              and(
                inArray(ridePosts.rideId, rideIds),
                eq(ridePosts.userId, session.userId),
                eq(ridePosts.type, "published"),
              ),
            )
        : Promise.resolve([] as { rideId: string }[]),
    ]);

    // driver.id -> users.id for rider-role counterparts.
    const driverUserById = new Map<string, string>();
    for (const d of counterpartDrivers) {
      driverUserById.set(d.id, d.userId);
      counterpartUserIds.add(d.userId);
    }

    const userRows = counterpartUserIds.size
      ? await db
          .select({ id: users.id, name: users.name, avatar: users.avatar })
          .from(users)
          .where(inArray(users.id, Array.from(counterpartUserIds)))
      : [];
    const userById = new Map(userRows.map((u) => [u.id, u]));
    const publishedSet = new Set(publishedRows.map((p) => p.rideId));

    const memories = rideRows.map((r) => {
      const role: "rider" | "driver" = r.customerId === session.userId ? "rider" : "driver";
      const counterpartUserId =
        role === "rider" ? (r.driverId ? driverUserById.get(r.driverId) : null) : r.customerId;
      const cp = counterpartUserId ? userById.get(counterpartUserId) : null;

      const fareRaw =
        role === "driver" ? r.driverEarnings : (r.actualFare ?? r.estimatedFare);
      const fare = fareRaw != null ? parseFloat(String(fareRaw)) : null;
      const distanceKm = r.distance != null ? parseFloat(String(r.distance)) : null;

      return {
        rideId: r.id,
        role,
        date: r.completedAt || r.createdAt,
        cityName: cityNameForCoords(
          cityRows as CityRow[],
          parseFloat(String(r.pickupLat)),
          parseFloat(String(r.pickupLng)),
        ),
        distanceKm,
        fare: fare != null && !isNaN(fare) ? fare : null,
        currency: r.currency,
        counterpart: cp ? { name: cp.name, avatar: cp.avatar } : null,
        // Anonymized, ~1km-rounded route only — no exact coordinates/addresses.
        pickup: {
          lat: coarsenCoord(parseFloat(String(r.pickupLat))),
          lng: coarsenCoord(parseFloat(String(r.pickupLng))),
        },
        dropoff: {
          lat: coarsenCoord(parseFloat(String(r.dropoffLat))),
          lng: coarsenCoord(parseFloat(String(r.dropoffLng))),
        },
        isEvRide: !!r.isEvRide,
        isPmgthRide: !!r.isPmgthRide,
        hasPosted: publishedSet.has(r.id),
      };
    });

    // Resurfacing. Money is only summed within a single currency (the viewer's
    // most recent ride currency) so a mixed-currency total is never invented.
    const currency = memories[0]?.currency || "AED";
    const now = new Date();
    let monthly: { rides: number; distanceKm: number; amount: number } | null = null;
    let monthCount = 0;
    let monthDistance = 0;
    let monthAmount = 0;
    let onThisDay: {
      rideId: string;
      date: Date | string;
      cityName: string | null;
      distanceKm: number | null;
      yearsAgo: number;
    } | null = null;

    for (const m of memories) {
      const d = m.date ? new Date(m.date) : null;
      if (!d) continue;
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        monthCount += 1;
        if (m.distanceKm) monthDistance += m.distanceKm;
        if (m.fare != null && m.currency === currency) monthAmount += m.fare;
      }
      if (
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate() &&
        d.getFullYear() < now.getFullYear()
      ) {
        const yearsAgo = now.getFullYear() - d.getFullYear();
        if (!onThisDay || yearsAgo < onThisDay.yearsAgo) {
          onThisDay = {
            rideId: m.rideId,
            date: m.date,
            cityName: m.cityName,
            distanceKm: m.distanceKm,
            yearsAgo,
          };
        }
      }
    }
    if (monthCount > 0) {
      monthly = {
        rides: monthCount,
        distanceKm: Math.round(monthDistance * 10) / 10,
        amount: Math.round(monthAmount * 100) / 100,
      };
    }

    res.json({ currency, highlight: { monthly, onThisDay }, memories });
  } catch (error: any) {
    console.error("[Social] memories error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Reactions + comments on feed posts.
// ---------------------------------------------------------------------------

socialRouter.post("/api/social/posts/:id/react", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const type = String(req.body?.type || "");
    if (!REACTION_TYPES.includes(type)) {
      return res.status(400).json({ error: "Unknown reaction" });
    }
    const [post] = await db.select({ id: ridePosts.id }).from(ridePosts).where(eq(ridePosts.id, req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });

    // Pure upsert — the client owns the toggle. Same (post,user) row is replaced.
    await db
      .insert(ridePostReactions)
      .values({ postId: post.id, userId: user.id, type })
      .onConflictDoUpdate({
        target: [ridePostReactions.postId, ridePostReactions.userId],
        set: { type },
      });
    res.json(await reactionSummary(post.id, user.id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.delete("/api/social/posts/:id/react", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    await db
      .delete(ridePostReactions)
      .where(and(eq(ridePostReactions.postId, req.params.id), eq(ridePostReactions.userId, user.id)));
    res.json(await reactionSummary(req.params.id, user.id));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a post — author only; cascades reactions and comments.
socialRouter.delete("/api/social/posts/:id", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db
      .select({ id: ridePosts.id, userId: ridePosts.userId })
      .from(ridePosts)
      .where(eq(ridePosts.id, req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.userId !== user.id) return res.status(403).json({ error: "Not your post" });
    await db.delete(ridePostReactions).where(eq(ridePostReactions.postId, post.id));
    await db.delete(ridePostComments).where(eq(ridePostComments.postId, post.id));
    await db.delete(ridePosts).where(eq(ridePosts.id, post.id));
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.get("/api/social/posts/:id/comments", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const rows = await db
      .select({
        id: ridePostComments.id,
        body: ridePostComments.body,
        createdAt: ridePostComments.createdAt,
        authorId: users.id,
        authorName: users.name,
        authorAvatar: users.avatar,
      })
      .from(ridePostComments)
      .innerJoin(users, eq(users.id, ridePostComments.userId))
      .where(eq(ridePostComments.postId, req.params.id))
      .orderBy(ridePostComments.createdAt)
      .limit(200);
    res.json({ comments: rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.post("/api/social/posts/:id/comments", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const body = String(req.body?.body || "").trim().slice(0, COMMENT_MAX);
    if (!body) return res.status(400).json({ error: "Comment cannot be empty" });
    const [post] = await db.select({ id: ridePosts.id }).from(ridePosts).where(eq(ridePosts.id, req.params.id));
    if (!post) return res.status(404).json({ error: "Post not found" });

    const [created] = await db
      .insert(ridePostComments)
      .values({ postId: post.id, userId: user.id, body })
      .returning();
    res.json({
      comment: {
        id: created.id,
        body: created.body,
        createdAt: created.createdAt,
        authorId: user.id,
        authorName: user.name,
        authorAvatar: user.avatar,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Status badges for a single user (profiles). Surfaces existing trust state.
// ---------------------------------------------------------------------------

socialRouter.get("/api/social/badges/:userId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const map = await computeBadges([req.params.userId]);
    res.json({ badges: map.get(req.params.userId) || [] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// TikTok-style profile: my published posts grid + posts I liked.
// ---------------------------------------------------------------------------

socialRouter.get("/api/social/my-posts", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const posts = await db
      .select(POST_FIELDS)
      .from(ridePosts)
      .innerJoin(users, eq(users.id, ridePosts.userId))
      .where(eq(ridePosts.userId, session.userId))
      .orderBy(desc(ridePosts.createdAt))
      .limit(60);
    const withLive = await withLiveStatus(posts as any);
    const full = await attachSocialMeta(withLive as any, session.userId);
    res.json({ posts: full });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

socialRouter.get("/api/social/liked-posts", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const posts = await db
      .select(POST_FIELDS)
      .from(ridePostReactions)
      .innerJoin(ridePosts, eq(ridePosts.id, ridePostReactions.postId))
      .innerJoin(users, eq(users.id, ridePosts.userId))
      .where(eq(ridePostReactions.userId, session.userId))
      .orderBy(desc(ridePostReactions.createdAt))
      .limit(60);
    const withLive = await withLiveStatus(posts as any);
    const full = await attachSocialMeta(withLive as any, session.userId);
    res.json({ posts: full });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Find friends: people search, contact sync and QR profile preview.
// Privacy: responses only ever carry public fields (id / name / avatar /
// counts / badges) — phone numbers sent for matching are matched and
// discarded, never stored or echoed back.
// ---------------------------------------------------------------------------

socialRouter.get("/api/social/user-search", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json({ users: [] });
    const rows = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(users)
      .where(
        and(
          ilike(users.name, `%${q.replace(/[%_]/g, "")}%`),
          ne(users.id, session.userId),
          or(eq(users.isGuest, false), isNull(users.isGuest)),
        ),
      )
      .limit(20);
    const meta = await buildPeopleMeta(rows.map((r) => r.id), session.userId);
    res.json({
      users: rows.map((r) => ({
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        handle: handleFor(r),
        ...(meta.get(r.id) || { followers: 0, rides: 0, isFollowing: false, badges: [] }),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Contact sync: the client sends phone numbers from the device address book,
// we match them against registered accounts by digit suffix (tolerant of
// country-code formatting differences) and return only public people cards.
socialRouter.post("/api/social/find-contacts", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const raw = Array.isArray(req.body?.phones) ? req.body.phones : [];
    const suffixes = Array.from(
      new Set(
        raw
          .slice(0, 2000)
          .map((p: any) => String(p || "").replace(/[^0-9]/g, ""))
          .filter((d: string) => d.length >= 7)
          .map((d: string) => d.slice(-9)),
      ),
    ) as string[];
    if (suffixes.length === 0) return res.json({ matches: [] });

    const phoneSuffix = sql<string>`right(regexp_replace(coalesce(${users.phone}, ''), '[^0-9]', '', 'g'), 9)`;
    const rows = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar })
      .from(users)
      .where(
        and(
          inArray(phoneSuffix, suffixes),
          ne(users.id, user.id),
          or(eq(users.isGuest, false), isNull(users.isGuest)),
        ),
      )
      .limit(100);
    const meta = await buildPeopleMeta(rows.map((r) => r.id), user.id);
    res.json({
      matches: rows.map((r) => ({
        id: r.id,
        name: r.name,
        avatar: r.avatar,
        handle: handleFor(r),
        ...(meta.get(r.id) || { followers: 0, rides: 0, isFollowing: false, badges: [] }),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// QR scan / profile preview — one public people card for a given user id.
socialRouter.get("/api/social/users/:userId/preview", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [target] = await db
      .select({ id: users.id, name: users.name, avatar: users.avatar, bio: users.bio, isGuest: users.isGuest })
      .from(users)
      .where(eq(users.id, req.params.userId));
    if (!target || target.isGuest) return res.status(404).json({ error: "User not found" });
    const meta = await buildPeopleMeta([target.id], session.userId);
    res.json({
      id: target.id,
      name: target.name,
      avatar: target.avatar,
      bio: target.bio,
      handle: handleFor(target),
      isSelf: target.id === session.userId,
      ...(meta.get(target.id) || { followers: 0, rides: 0, isFollowing: false, badges: [] }),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Activity centre — recent social activity aimed at me: new followers,
// reactions and comments on my posts. All real rows, newest first.
// ---------------------------------------------------------------------------

socialRouter.get("/api/social/activity", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const meId = session.userId;
    const [followRows, reactionRows, commentRows] = await Promise.all([
      db
        .select({
          id: userFollows.id,
          createdAt: userFollows.createdAt,
          userId: users.id,
          userName: users.name,
          userAvatar: users.avatar,
        })
        .from(userFollows)
        .innerJoin(users, eq(users.id, userFollows.followerId))
        .where(eq(userFollows.followingId, meId))
        .orderBy(desc(userFollows.createdAt))
        .limit(30),
      db
        .select({
          id: ridePostReactions.id,
          createdAt: ridePostReactions.createdAt,
          reaction: ridePostReactions.type,
          postId: ridePostReactions.postId,
          cityName: ridePosts.cityName,
          userId: users.id,
          userName: users.name,
          userAvatar: users.avatar,
        })
        .from(ridePostReactions)
        .innerJoin(ridePosts, eq(ridePosts.id, ridePostReactions.postId))
        .innerJoin(users, eq(users.id, ridePostReactions.userId))
        .where(and(eq(ridePosts.userId, meId), ne(ridePostReactions.userId, meId)))
        .orderBy(desc(ridePostReactions.createdAt))
        .limit(30),
      db
        .select({
          id: ridePostComments.id,
          createdAt: ridePostComments.createdAt,
          body: ridePostComments.body,
          postId: ridePostComments.postId,
          cityName: ridePosts.cityName,
          userId: users.id,
          userName: users.name,
          userAvatar: users.avatar,
        })
        .from(ridePostComments)
        .innerJoin(ridePosts, eq(ridePosts.id, ridePostComments.postId))
        .innerJoin(users, eq(users.id, ridePostComments.userId))
        .where(and(eq(ridePosts.userId, meId), ne(ridePostComments.userId, meId)))
        .orderBy(desc(ridePostComments.createdAt))
        .limit(30),
    ]);

    const items = [
      ...followRows.map((r) => ({
        id: `follow-${r.id}`,
        kind: "follow" as const,
        user: { id: r.userId, name: r.userName, avatar: r.userAvatar },
        createdAt: r.createdAt,
      })),
      ...reactionRows.map((r) => ({
        id: `reaction-${r.id}`,
        kind: "reaction" as const,
        user: { id: r.userId, name: r.userName, avatar: r.userAvatar },
        reaction: r.reaction,
        postId: r.postId,
        cityName: r.cityName,
        createdAt: r.createdAt,
      })),
      ...commentRows.map((r) => ({
        id: `comment-${r.id}`,
        kind: "comment" as const,
        user: { id: r.userId, name: r.userName, avatar: r.userAvatar },
        body: String(r.body || "").slice(0, 120),
        postId: r.postId,
        cityName: r.cityName,
        createdAt: r.createdAt,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 40);

    res.json({ items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
