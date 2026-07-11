import { Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { users, drivers, rides, cities, userFollows, ridePosts } from "@shared/schema";
import { eq, and, desc, inArray, isNull, count } from "drizzle-orm";
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

async function deriveCityName(lat: number, lng: number): Promise<string | null> {
  if (isNaN(lat) || isNaN(lng)) return null;
  const rows = await db.select().from(cities);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of rows) {
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

function publicUser(u: { id: string; name: string; avatar: string | null; twitchChannel: string | null }) {
  return { id: u.id, name: u.name, avatar: u.avatar, twitchChannel: u.twitchChannel };
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
    const cityName = await deriveCityName(parseFloat(String(ride.pickupLat)), parseFloat(String(ride.pickupLng)));
    const [post] = await db
      .insert(ridePosts)
      .values({
        rideId: ride.id,
        userId: user.id,
        type: "published",
        caption,
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

    res.json({ posts: await withLiveStatus(posts as any) });
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
