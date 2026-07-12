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
import { eq, and, or, desc, inArray, isNull, count } from "drizzle-orm";
import { verifyTwitchChannel, getLiveChannels } from "./twitchClient";

// Social layer: follows between users + rides published or live-streamed to
// the feed via Twitch. Privacy rules: social payloads only ever expose
// id / name / avatar / twitchChannel — never email, phone or coordinates.
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

function publicUser(u: { id: string; name: string; avatar: string | null; twitchChannel: string | null }) {
  return { id: u.id, name: u.name, avatar: u.avatar, twitchChannel: u.twitchChannel };
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

// ---------------------------------------------------------------------------
// Twitch channel on my profile
// ---------------------------------------------------------------------------

socialRouter.patch("/api/me/twitch-channel", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const raw = req.body?.channel;
    if (raw === null || raw === "" || raw === undefined) {
      await db.update(users).set({ twitchChannel: null, updatedAt: new Date() }).where(eq(users.id, user.id));
      return res.json({ twitchChannel: null });
    }
    const info = await verifyTwitchChannel(String(raw));
    if (!info) {
      return res.status(400).json({ error: "That Twitch channel was not found. Check the spelling." });
    }
    await db.update(users).set({ twitchChannel: info.login, updatedAt: new Date() }).where(eq(users.id, user.id));
    res.json({ twitchChannel: info.login, displayName: info.displayName });
  } catch (error: any) {
    console.error("[Social] twitch-channel error:", error);
    res.status(502).json({ error: "Could not reach Twitch. Try again in a moment." });
  }
});

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
      .select({ id: users.id, name: users.name, avatar: users.avatar, twitchChannel: users.twitchChannel })
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
      .select({ id: users.id, name: users.name, avatar: users.avatar, twitchChannel: users.twitchChannel })
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
    const [[followers], [following], me] = await Promise.all([
      db.select({ n: count() }).from(userFollows).where(eq(userFollows.followingId, session.userId)),
      db.select({ n: count() }).from(userFollows).where(eq(userFollows.followerId, session.userId)),
      storage.getUser(session.userId),
    ]);
    res.json({
      followers: Number(followers.n),
      following: Number(following.n),
      twitchChannel: me?.twitchChannel || null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Ride social context — who is the other person on this ride (for follow UI).
// Only exposes id / name / avatar / twitchChannel of the counterpart.
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
      myTwitchChannel: me?.twitchChannel || null,
      isStreaming: !!myStream,
      hasPublished: !!myPublished,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Stream a ride (live on Twitch) + publish a completed ride
// ---------------------------------------------------------------------------

socialRouter.post("/api/rides/:id/stream/start", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!user.twitchChannel) {
      return res.status(400).json({ error: "Add your Twitch channel to your profile first" });
    }
    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    const { customerId, driverUserId } = await getRideParticipants(ride);
    if (user.id !== customerId && user.id !== driverUserId) {
      return res.status(403).json({ error: "Not your ride" });
    }
    if (!STREAMABLE_STATUSES.includes(ride.status)) {
      return res.status(400).json({ error: "You can only stream while the ride is happening" });
    }

    // One active stream post per ride+user — reactivate instead of duplicating.
    const [existing] = await db
      .select()
      .from(ridePosts)
      .where(and(
        eq(ridePosts.rideId, ride.id),
        eq(ridePosts.userId, user.id),
        eq(ridePosts.type, "stream"),
        isNull(ridePosts.endedAt),
      ));
    if (existing) return res.json({ post: existing });

    const cityName = await deriveCityName(parseFloat(String(ride.pickupLat)), parseFloat(String(ride.pickupLng)));
    const [post] = await db
      .insert(ridePosts)
      .values({
        rideId: ride.id,
        userId: user.id,
        type: "stream",
        twitchChannel: user.twitchChannel,
        cityName,
        distanceKm: ride.distance ?? null,
        isLive: true,
      })
      .returning();
    res.json({ post });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

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
  twitchChannel: ridePosts.twitchChannel,
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

// Re-derive live status from Twitch (never trust the stored flag alone) and
// persist obvious flips so stale rows age out.
async function withLiveStatus<T extends { id: string; type: string; twitchChannel: string | null; isLive: boolean; endedAt: Date | null }>(posts: T[]): Promise<T[]> {
  const open = posts.filter((p) => p.type === "stream" && !p.endedAt && p.twitchChannel);
  if (open.length === 0) return posts;
  let live: Set<string>;
  try {
    live = await getLiveChannels(open.map((p) => p.twitchChannel as string));
  } catch (error) {
    console.error("[Social] twitch live check failed:", error);
    return posts; // degrade to stored flags rather than erroring the feed
  }
  const flips: string[] = [];
  for (const p of open) {
    const actuallyLive = live.has((p.twitchChannel as string).toLowerCase());
    if (p.isLive && !actuallyLive) flips.push(p.id);
    p.isLive = actuallyLive;
  }
  if (flips.length > 0) {
    Promise.resolve(
      db.update(ridePosts).set({ isLive: false }).where(inArray(ridePosts.id, flips)),
    ).catch(() => {});
  }
  return posts;
}

socialRouter.get("/api/social/feed", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const followed = await db
      .select({ id: userFollows.followingId })
      .from(userFollows)
      .where(eq(userFollows.followerId, session.userId));
    const authorIds = [session.userId, ...followed.map((f) => f.id)];

    const posts = await db
      .select(POST_FIELDS)
      .from(ridePosts)
      .innerJoin(users, eq(users.id, ridePosts.userId))
      .where(inArray(ridePosts.userId, authorIds))
      .orderBy(desc(ridePosts.createdAt))
      .limit(50);

    const withLive = await withLiveStatus(posts as any);
    res.json({ posts: await attachSocialMeta(withLive as any, session.userId) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC live broadcasts for the landing page. Streaming is an explicitly
// public act (the Twitch channel is a public broadcast), so this exposes only
// name / avatar / twitchChannel / city / country — never coordinates, phones
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
      .where(and(eq(ridePosts.type, "stream"), isNull(ridePosts.endedAt)))
      .orderBy(desc(ridePosts.createdAt))
      .limit(100);

    const live = (await withLiveStatus(posts as any)).filter((p: any) => p.isLive);

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
      name: p.authorName,
      avatar: p.authorAvatar,
      twitchChannel: p.twitchChannel,
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

    const refreshed = await withLiveStatus(posts as any);
    res.json({ streams: refreshed.filter((p: any) => p.isLive) });
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
