import { Router, type Router as RouterType } from "express";
import { db } from "./db";
import { storage } from "./storage";
import {
  routeActivity,
  trendingCache,
  searchQueries,
  rides,
  ridePosts,
  users,
  drivers,
  vehicles,
  hubs,
  type Ride,
} from "@shared/schema";
import { and, desc, eq, gte, isNull, sql, count } from "drizzle-orm";
import { detectRegionFromCoordinates } from "./regionService";

const router: RouterType = Router();

// ============================================================================
// Travony Live — Discovery: trending + search.
//
// Design rules:
//   - The hot read path (GET /api/trending) reads ONLY trending_cache, which a
//     background job refreshes every 5 minutes. Raw tables are never scanned
//     per-request.
//   - route_activity stores coarse zone names + ~1km-rounded centroids. Exact
//     addresses/coordinates never leave the rides table.
//   - Search runs Postgres full-text (GIN-indexed expression indexes created
//     idempotently at boot) with an ILIKE fallback for partial words.
//   - Every search is logged to search_queries; clicks are logged back via
//     POST /api/search/click. That log feeds "Trending Searches".
// ============================================================================

// ---------- session ----------
async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

// ---------- zone derivation ----------
// Derive a coarse, human-readable zone from a full address. We take the first
// component that isn't a plain street number, so "42 Marina Walk, Dubai
// Marina, Dubai" → "Marina Walk" and "Dubai Mall, Downtown Dubai" →
// "Dubai Mall". Capped so junk input can't bloat the table.
export function zoneFromAddress(address: string): string {
  if (!address) return "Unknown";
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  for (const part of parts) {
    // Skip pure numbers / building codes like "42" or "Bldg 7".
    if (/^\d+$/.test(part)) continue;
    // Strip a leading street/house number so "42 Marina Walk" → "Marina Walk"
    // and no street-level address fragment survives into public labels.
    const cleaned = part.replace(/^\d+[\s\-\/]*/, "").trim();
    if (cleaned.length < 3) continue;
    return cleaned.slice(0, 48);
  }
  const fallback = (parts[0] || "Unknown").replace(/^\d+[\s\-\/]*/, "").trim();
  return (fallback || "Unknown").slice(0, 48);
}

function cityFromAddress(address: string): string | null {
  if (!address) return null;
  const parts = address
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 2 && !/^\d+$/.test(p) && !/\d{4,}/.test(p));
  if (parts.length >= 2) {
    // Heuristic: the second-to-last meaningful component is usually the city
    // ("..., Dubai, United Arab Emirates").
    return parts[parts.length - 2]?.slice(0, 48) || null;
  }
  return parts[0]?.slice(0, 48) || null;
}

const round2 = (v: string | number | null | undefined): string | null => {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (n == null || !isFinite(n)) return null;
  return (Math.round(n * 100) / 100).toFixed(2);
};

// ---------- route activity logging (called on ride completion) ----------
export async function logRouteActivity(ride: Ride): Promise<void> {
  try {
    const originZone = zoneFromAddress(ride.pickupAddress);
    const destinationZone = zoneFromAddress(ride.dropoffAddress);
    if (originZone === "Unknown" && destinationZone === "Unknown") return;
    const routeKey = `${originZone} → ${destinationZone}`;
    const when = ride.completedAt ? new Date(ride.completedAt) : new Date();
    const lat = parseFloat(ride.pickupLat || "0");
    const lng = parseFloat(ride.pickupLng || "0");
    const regionCode =
      ride.regionCode || (lat && lng ? detectRegionFromCoordinates(lat, lng) : null);
    await db
      .insert(routeActivity)
      .values({
        rideId: ride.id,
        originZone,
        destinationZone,
        routeKey,
        originLat: round2(ride.pickupLat),
        originLng: round2(ride.pickupLng),
        destLat: round2(ride.dropoffLat),
        destLng: round2(ride.dropoffLng),
        regionCode,
        city: cityFromAddress(ride.dropoffAddress) || cityFromAddress(ride.pickupAddress),
        hourBucket: when.getHours(),
        dayOfWeek: when.getDay(),
      })
      .onConflictDoNothing({ target: routeActivity.rideId });
  } catch (err) {
    console.error("[discovery] logRouteActivity failed:", err);
  }
}

// Backfill route_activity from recently completed rides so trending has signal
// from day one. Idempotent (unique rideId + onConflictDoNothing).
async function backfillRouteActivity(): Promise<void> {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent = await db
      .select()
      .from(rides)
      .where(and(eq(rides.status, "completed"), gte(rides.createdAt, since)))
      .limit(2000);
    for (const ride of recent) {
      await logRouteActivity(ride);
    }
    if (recent.length > 0) {
      console.log(`[discovery] route_activity backfill checked ${recent.length} rides`);
    }
  } catch (err) {
    console.error("[discovery] backfill failed:", err);
  }
}

// ---------- GIN full-text indexes (idempotent, created at boot) ----------
async function ensureSearchIndexes(): Promise<void> {
  const statements = [
    `CREATE INDEX IF NOT EXISTS users_search_idx ON users
       USING GIN (to_tsvector('simple', coalesce(name,'')))`,
    `CREATE INDEX IF NOT EXISTS ride_posts_search_idx ON ride_posts
       USING GIN (to_tsvector('simple', coalesce(caption,'') || ' ' || coalesce(city_name,'')))`,
    `CREATE INDEX IF NOT EXISTS hubs_search_idx ON hubs
       USING GIN (to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(address,'') || ' ' || coalesce(description,'')))`,
  ];
  for (const stmt of statements) {
    try {
      await db.execute(sql.raw(stmt));
    } catch (err) {
      console.error("[discovery] index creation failed:", err);
    }
  }
}

// ============================================================================
// Trending score refresh — runs every 5 minutes.
// Routes:  rides_1h×10 + rides_6h×3 + rides_24h×1  (+ live driver/request
//          counts attached for the top routes only).
// Posts:   (reactions×5 + comments×8 + live×50) / (hours_old + 2)^1.5
// Search:  searches_24h×3 + clicks×10  (min 2 searches to qualify)
// Velocity = score1h now − score1h at previous refresh.
// ============================================================================
let refreshRunning = false;

export async function refreshTrendingCache(): Promise<void> {
  if (refreshRunning) return;
  refreshRunning = true;
  try {
    const now = Date.now();
    const h1 = new Date(now - 60 * 60 * 1000);
    const h6 = new Date(now - 6 * 60 * 60 * 1000);
    const h24 = new Date(now - 24 * 60 * 60 * 1000);

    // ----- routes -----
    const routeRows = await db
      .select({
        routeKey: routeActivity.routeKey,
        originZone: routeActivity.originZone,
        destinationZone: routeActivity.destinationZone,
        city: sql<string | null>`max(${routeActivity.city})`,
        regionCode: sql<string | null>`max(${routeActivity.regionCode})`,
        rides1h: sql<number>`count(*) FILTER (WHERE ${routeActivity.createdAt} >= ${h1})`,
        rides6h: sql<number>`count(*) FILTER (WHERE ${routeActivity.createdAt} >= ${h6})`,
        rides24h: sql<number>`count(*)`,
        peakHour: sql<number>`mode() WITHIN GROUP (ORDER BY ${routeActivity.hourBucket})`,
        originLat: sql<string | null>`max(${routeActivity.originLat})`,
        originLng: sql<string | null>`max(${routeActivity.originLng})`,
      })
      .from(routeActivity)
      .where(gte(routeActivity.createdAt, h24))
      .groupBy(routeActivity.routeKey, routeActivity.originZone, routeActivity.destinationZone)
      .orderBy(desc(sql`count(*)`))
      .limit(100);

    for (const r of routeRows) {
      const rides1h = Number(r.rides1h) || 0;
      const rides6h = Number(r.rides6h) || 0;
      const rides24h = Number(r.rides24h) || 0;
      // Privacy floor: a route only becomes publicly visible once at least 3
      // separate rides took it in 24h, so a single person's trip can never
      // surface as a public trend in a low-volume city.
      if (rides24h < 3) continue;
      let driverCount = 0;
      let requestCount = 0;
      // Live supply/demand only for routes with meaningful volume — keeps the
      // refresh cheap while the numbers shown stay real.
      if (rides24h >= 2 && r.originLat && r.originLng) {
        const oLat = parseFloat(r.originLat);
        const oLng = parseFloat(r.originLng);
        const [dCount] = await db
          .select({ n: count() })
          .from(drivers)
          .where(
            and(
              eq(drivers.isOnline, true),
              eq(drivers.status, "approved"),
              sql`${drivers.currentLat} IS NOT NULL`,
              sql`abs(CAST(${drivers.currentLat} AS float) - ${oLat}) < 0.14`,
              sql`abs(CAST(${drivers.currentLng} AS float) - ${oLng}) < 0.14`,
            ),
          );
        driverCount = Number(dCount?.n) || 0;
        const [reqCount] = await db
          .select({ n: count() })
          .from(rides)
          .where(
            and(
              eq(rides.status, "pending"),
              gte(rides.createdAt, h1),
              sql`${rides.dropoffAddress} ILIKE ${"%" + r.destinationZone + "%"}`,
            ),
          );
        requestCount = Number(reqCount?.n) || 0;
      }
      const score1h = rides1h * 10 + driverCount * 5 + requestCount * 8;
      const score6h = rides6h * 3;
      const score24h = rides24h * 1;
      await upsertTrendingRow({
        type: "route",
        referenceId: r.routeKey,
        label: r.routeKey,
        score1h,
        score6h,
        score24h,
        city: r.city,
        regionCode: r.regionCode,
        peakHour: Number(r.peakHour) || null,
        driverCount,
        requestCount,
        meta: JSON.stringify({ origin: r.originZone, destination: r.destinationZone }),
      });
    }

    // ----- posts -----
    const postRows = await db
      .select({
        id: ridePosts.id,
        caption: ridePosts.caption,
        cityName: ridePosts.cityName,
        isLive: ridePosts.isLive,
        createdAt: ridePosts.createdAt,
        authorName: users.name,
        reactions: sql<number>`(SELECT count(*) FROM ride_post_reactions rr WHERE rr.post_id = ${ridePosts.id})`,
        comments: sql<number>`(SELECT count(*) FROM ride_post_comments rc WHERE rc.post_id = ${ridePosts.id})`,
      })
      .from(ridePosts)
      .innerJoin(users, eq(users.id, ridePosts.userId))
      .where(gte(ridePosts.createdAt, h24))
      .orderBy(desc(ridePosts.createdAt))
      .limit(200);

    for (const p of postRows) {
      const reactions = Number(p.reactions) || 0;
      const comments = Number(p.comments) || 0;
      const hoursOld = (now - new Date(p.createdAt).getTime()) / 3600000;
      const raw = reactions * 5 + comments * 8 + (p.isLive ? 50 : 0);
      const decayed = raw / Math.pow(hoursOld + 2, 1.5);
      if (raw === 0) continue;
      await upsertTrendingRow({
        type: "post",
        referenceId: p.id,
        label: (p.caption || "Shared journey").slice(0, 80),
        score1h: decayed,
        score6h: decayed,
        score24h: raw,
        city: p.cityName,
        regionCode: null,
        peakHour: null,
        driverCount: 0,
        requestCount: 0,
        // No authorName here: /api/trending is unauthenticated, and the ride
        // feed (where names appear) is auth-gated. Names stay behind auth.
        meta: JSON.stringify({ isLive: p.isLive, reactions, comments }),
      });
    }

    // ----- trending search terms -----
    const termRows = await db
      .select({
        term: sql<string>`lower(trim(${searchQueries.queryText}))`,
        searches: count(),
        clicks: sql<number>`count(*) FILTER (WHERE ${searchQueries.clickedResultId} IS NOT NULL)`,
        city: sql<string | null>`max(${searchQueries.city})`,
      })
      .from(searchQueries)
      .where(gte(searchQueries.createdAt, h24))
      .groupBy(sql`lower(trim(${searchQueries.queryText}))`)
      .having(sql`count(*) >= 2`)
      .orderBy(desc(count()))
      .limit(50);

    for (const t of termRows) {
      if (!t.term || t.term.length < 2) continue;
      const score = Number(t.searches) * 3 + Number(t.clicks) * 10;
      await upsertTrendingRow({
        type: "search_term",
        referenceId: t.term,
        label: t.term,
        score1h: score,
        score6h: score,
        score24h: score,
        city: t.city,
        regionCode: null,
        peakHour: null,
        driverCount: 0,
        requestCount: 0,
        meta: null,
      });
    }

    // Drop rows that stopped trending (not refreshed in the last 30 minutes).
    await db
      .delete(trendingCache)
      .where(sql`${trendingCache.updatedAt} < now() - interval '30 minutes'`);
  } catch (err) {
    console.error("[discovery] trending refresh failed:", err);
  } finally {
    refreshRunning = false;
  }
}

async function upsertTrendingRow(row: {
  type: string;
  referenceId: string;
  label: string;
  score1h: number;
  score6h: number;
  score24h: number;
  city: string | null;
  regionCode: string | null;
  peakHour: number | null;
  driverCount: number;
  requestCount: number;
  meta: string | null;
}): Promise<void> {
  const s1 = row.score1h.toFixed(2);
  await db
    .insert(trendingCache)
    .values({
      type: row.type,
      referenceId: row.referenceId,
      label: row.label,
      score1h: s1,
      score6h: row.score6h.toFixed(2),
      score24h: row.score24h.toFixed(2),
      trendVelocity: "0",
      city: row.city,
      regionCode: row.regionCode,
      peakHour: row.peakHour,
      driverCount: row.driverCount,
      requestCount: row.requestCount,
      meta: row.meta,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [trendingCache.type, trendingCache.referenceId],
      set: {
        label: row.label,
        // Velocity = new score1h − previous score1h (computed in SQL so we
        // never race a concurrent refresh).
        trendVelocity: sql`(${s1}::numeric - trending_cache.score_1h)`,
        score1h: s1,
        score6h: row.score6h.toFixed(2),
        score24h: row.score24h.toFixed(2),
        city: row.city,
        regionCode: row.regionCode,
        peakHour: row.peakHour,
        driverCount: row.driverCount,
        requestCount: row.requestCount,
        meta: row.meta,
        updatedAt: new Date(),
      },
    });
}

// ---------- boot ----------
let bootStarted = false;
export function initDiscovery(): void {
  if (bootStarted) return;
  bootStarted = true;
  (async () => {
    await ensureSearchIndexes();
    await backfillRouteActivity();
    await refreshTrendingCache();
  })().catch((err) => console.error("[discovery] init failed:", err));
  setInterval(() => {
    refreshTrendingCache();
  }, 5 * 60 * 1000);
}

// ============================================================================
// GET /api/trending?city=&limit=  — reads only trending_cache.
// Public and privacy-safe: labels are coarse zones, never addresses.
// ============================================================================
router.get("/api/trending", async (req, res) => {
  try {
    const city = typeof req.query.city === "string" ? req.query.city.trim() : "";
    const limit = Math.min(parseInt(String(req.query.limit || "10")) || 10, 25);

    const rowsFor = async (type: string) => {
      const conditions = [eq(trendingCache.type, type)];
      if (city) {
        conditions.push(sql`(${trendingCache.city} ILIKE ${"%" + city + "%"} OR ${trendingCache.city} IS NULL)`);
      }
      return db
        .select()
        .from(trendingCache)
        .where(and(...conditions))
        .orderBy(
          desc(sql`CAST(${trendingCache.trendVelocity} AS numeric)`),
          desc(sql`CAST(${trendingCache.score1h} AS numeric)`),
          desc(sql`CAST(${trendingCache.score24h} AS numeric)`),
        )
        .limit(limit);
    };

    const [routes, posts, terms] = await Promise.all([
      rowsFor("route"),
      rowsFor("post"),
      rowsFor("search_term"),
    ]);

    const parseMeta = (m: string | null) => {
      try {
        return m ? JSON.parse(m) : {};
      } catch {
        return {};
      }
    };

    res.json({
      routes: routes.map((r) => ({
        label: r.label,
        score: Math.round(parseFloat(r.score1h) + parseFloat(r.score24h)),
        velocity: parseFloat(r.trendVelocity),
        rising: parseFloat(r.trendVelocity) > 0,
        driversLive: r.driverCount,
        openRequests: r.requestCount,
        peakHour: r.peakHour,
        city: r.city,
        ...parseMeta(r.meta),
      })),
      posts: posts.map((p) => ({
        postId: p.referenceId,
        label: p.label,
        score: Math.round(parseFloat(p.score24h)),
        city: p.city,
        ...parseMeta(p.meta),
      })),
      searches: terms.map((t) => t.label),
      updatedAt: routes[0]?.updatedAt || posts[0]?.updatedAt || null,
    });
  } catch (err: any) {
    console.error("[discovery] trending read failed:", err);
    res.status(500).json({ message: "Failed to load trending" });
  }
});

// ============================================================================
// GET /api/search?q=&lat=&lng= — one query, four result groups.
// Requires auth (results include user names, same exposure as the feed).
// ============================================================================
router.get("/api/search", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
    if (q.length < 2) {
      return res.json({ drivers: [], routes: [], posts: [], hubs: [], trendingSearches: [], queryId: null });
    }

    const like = "%" + q + "%";
    const prefixTs = q
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ""))
      .filter(Boolean)
      .map((w) => w + ":*")
      .join(" & ");

    // Full-text match (uses the GIN indexes) OR ILIKE for partial-word typing.
    const [driverResults, hubResults, postResults, routeResults, trendingTerms] =
      await Promise.all([
        // Drivers: approved drivers only, matched on name.
        db
          .select({
            userId: users.id,
            name: users.name,
            avatar: users.avatar,
            rating: drivers.rating,
            totalTrips: drivers.totalTrips,
            isOnline: drivers.isOnline,
            followers: sql<number>`(SELECT count(*) FROM user_follows uf WHERE uf.following_id = ${users.id})`,
          })
          .from(drivers)
          .innerJoin(users, eq(users.id, drivers.userId))
          .where(
            and(
              eq(drivers.status, "approved"),
              prefixTs
                ? sql`(to_tsvector('simple', coalesce(${users.name},'')) @@ to_tsquery('simple', ${prefixTs}) OR ${users.name} ILIKE ${like})`
                : sql`${users.name} ILIKE ${like}`,
            ),
          )
          .orderBy(desc(drivers.totalTrips))
          .limit(5),
        // Hubs: name/address/description.
        db
          .select({
            id: hubs.id,
            name: hubs.name,
            type: hubs.type,
            address: hubs.address,
            regionCode: hubs.regionCode,
            isEvHub: hubs.isEvHub,
            lat: hubs.lat,
            lng: hubs.lng,
          })
          .from(hubs)
          .where(
            and(
              eq(hubs.status, "active"),
              prefixTs
                ? sql`(to_tsvector('simple', coalesce(${hubs.name},'') || ' ' || coalesce(${hubs.address},'') || ' ' || coalesce(${hubs.description},'')) @@ to_tsquery('simple', ${prefixTs}) OR ${hubs.name} ILIKE ${like})`
                : sql`${hubs.name} ILIKE ${like}`,
            ),
          )
          .limit(5),
        // Posts: caption/city (published only — streams surface in Live rail).
        db
          .select({
            id: ridePosts.id,
            caption: ridePosts.caption,
            cityName: ridePosts.cityName,
            createdAt: ridePosts.createdAt,
            authorName: users.name,
            authorAvatar: users.avatar,
            reactions: sql<number>`(SELECT count(*) FROM ride_post_reactions rr WHERE rr.post_id = ${ridePosts.id})`,
          })
          .from(ridePosts)
          .innerJoin(users, eq(users.id, ridePosts.userId))
          .where(
            prefixTs
              ? sql`(to_tsvector('simple', coalesce(${ridePosts.caption},'') || ' ' || coalesce(${ridePosts.cityName},'')) @@ to_tsquery('simple', ${prefixTs}) OR ${ridePosts.caption} ILIKE ${like})`
              : sql`${ridePosts.caption} ILIKE ${like}`,
          )
          .orderBy(desc(ridePosts.createdAt))
          .limit(5),
        // Routes: zone name match over the last 7 days of activity.
        db
          .select({
            routeKey: routeActivity.routeKey,
            originZone: routeActivity.originZone,
            destinationZone: routeActivity.destinationZone,
            trips: count(),
            city: sql<string | null>`max(${routeActivity.city})`,
            peakHour: sql<number>`mode() WITHIN GROUP (ORDER BY ${routeActivity.hourBucket})`,
          })
          .from(routeActivity)
          .where(
            and(
              gte(routeActivity.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
              sql`(${routeActivity.originZone} ILIKE ${like} OR ${routeActivity.destinationZone} ILIKE ${like})`,
            ),
          )
          .groupBy(routeActivity.routeKey, routeActivity.originZone, routeActivity.destinationZone)
          .orderBy(desc(count()))
          .limit(5),
        // Trending search terms (for the "others searched" rail).
        db
          .select({ label: trendingCache.label })
          .from(trendingCache)
          .where(eq(trendingCache.type, "search_term"))
          .orderBy(desc(sql`CAST(${trendingCache.score24h} AS numeric)`))
          .limit(6),
      ]);

    const resultCount =
      driverResults.length + hubResults.length + postResults.length + routeResults.length;

    // Log the search (fire-and-forget) and hand the row id back so the client
    // can report which result was tapped.
    let queryId: string | null = null;
    try {
      const [logged] = await db
        .insert(searchQueries)
        .values({
          userId: session.userId,
          queryText: q,
          queryType: "global",
          resultCount,
        })
        .returning({ id: searchQueries.id });
      queryId = logged?.id || null;
    } catch (err) {
      console.error("[discovery] search log failed:", err);
    }

    res.json({
      queryId,
      drivers: driverResults.map((d) => ({
        userId: d.userId,
        name: d.name,
        avatar: d.avatar,
        rating: d.rating,
        totalTrips: d.totalTrips,
        isOnline: d.isOnline,
        followers: Number(d.followers) || 0,
      })),
      routes: routeResults.map((r) => ({
        routeKey: r.routeKey,
        origin: r.originZone,
        destination: r.destinationZone,
        tripsLast7d: Number(r.trips) || 0,
        city: r.city,
        peakHour: Number(r.peakHour) ?? null,
      })),
      posts: postResults.map((p) => ({
        id: p.id,
        caption: p.caption,
        cityName: p.cityName,
        createdAt: p.createdAt,
        authorName: p.authorName,
        authorAvatar: p.authorAvatar,
        reactions: Number(p.reactions) || 0,
      })),
      hubs: hubResults.map((h) => ({
        id: h.id,
        name: h.name,
        type: h.type,
        address: h.address,
        regionCode: h.regionCode,
        isEvHub: h.isEvHub,
        lat: h.lat,
        lng: h.lng,
      })),
      trendingSearches: trendingTerms.map((t) => t.label),
    });
  } catch (err: any) {
    console.error("[discovery] search failed:", err);
    res.status(500).json({ message: "Search failed" });
  }
});

// ============================================================================
// POST /api/search/click — records which result the user tapped. Clicked
// results weigh 10× in trending searches (real interest, not just typing).
// ============================================================================
router.post("/api/search/click", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });
    const { queryId, resultId, resultType } = req.body || {};
    if (!queryId || !resultId) {
      return res.status(400).json({ message: "queryId and resultId are required" });
    }
    const allowedTypes = ["driver", "route", "post", "hub"];
    await db
      .update(searchQueries)
      .set({
        clickedResultId: String(resultId).slice(0, 120),
        clickedResultType: allowedTypes.includes(resultType) ? resultType : null,
      })
      .where(and(eq(searchQueries.id, queryId), eq(searchQueries.userId, session.userId)));
    res.json({ success: true });
  } catch (err: any) {
    console.error("[discovery] click log failed:", err);
    res.status(500).json({ message: "Failed to log click" });
  }
});

// ============================================================================
// Driver Discovery Feed — Nearby + Following
// ============================================================================

// ---------- pure-JS helpers ----------

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ETA: straight-line distance ÷ 30 kph × 60 min × 1.3 traffic factor, capped 60 min
function etaFromDistanceKm(distanceKm: number): number {
  return Math.min(Math.round((distanceKm / 30) * 60 * 1.3), 60);
}

// Upfront fare estimate for a 3 km baseline trip — pure JS, no DB call.
const BASELINE_KM = 3;
const REGION_RATES: Record<string, { base: number; perKm: number; currency: string; symbol: string }> = {
  AE: { base: 5.00,  perKm: 1.50,  currency: "AED", symbol: "AED" },
  BD: { base: 40,    perKm: 12,    currency: "BDT", symbol: "৳"   },
  IN: { base: 30,    perKm: 8,     currency: "INR", symbol: "₹"   },
  PK: { base: 120,   perKm: 30,    currency: "PKR", symbol: "Rs"  },
  NG: { base: 400,   perKm: 100,   currency: "NGN", symbol: "₦"   },
  KE: { base: 50,    perKm: 12,    currency: "KES", symbol: "KSh" },
  TH: { base: 35,    perKm: 9,     currency: "THB", symbol: "฿"   },
  ID: { base: 8000,  perKm: 2500,  currency: "IDR", symbol: "Rp"  },
  VN: { base: 8000,  perKm: 2500,  currency: "VND", symbol: "₫"   },
  PH: { base: 40,    perKm: 12,    currency: "PHP", symbol: "₱"   },
};

function upfrontFareEstimate(regionCode: string): { fare: number; currency: string; symbol: string } {
  const r = REGION_RATES[regionCode] ?? REGION_RATES.AE;
  return {
    fare: Math.round((r.base + BASELINE_KM * r.perKm) * 100) / 100,
    currency: r.currency,
    symbol: r.symbol,
  };
}

// ---------- shared result type ----------

export type DiscoveryDriver = {
  driverId: string;
  userId: string;
  name: string;
  avatar: string | null;
  rating: string | null;
  totalTrips: number | null;
  vehicle: {
    make: string;
    model: string;
    color: string | null;
    licensePlate: string;
    photo: string | null;
    type: string | null;
  } | null;
  distanceKm: number;
  etaMinutes: number;
  upfrontFare: number;
  currency: string;
  currencySymbol: string;
  isLive: boolean;
  postId: string | null;
  streamProvider: "agora" | null;
  /** Coarsened to ~1 km precision (2 decimal places) — safe to expose in feed */
  approxLat: number | null;
  approxLng: number | null;
};

// ---------- shared query builder ----------

type RawDriverRow = {
  driverId: string;
  userId: string;
  name: string;
  avatar: string | null;
  rating: string | null;
  totalTrips: number | null;
  currentLat: string | null;
  currentLng: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  vehicleColor: string | null;
  vehiclePlate: string | null;
  vehiclePhoto: string | null;
  vehicleType: string | null;
  postId: string | null;
  postIsLive: boolean | null;
  streamProvider: string | null;
};

const DRIVER_COLUMNS = {
  driverId: drivers.id,
  userId: users.id,
  name: users.name,
  avatar: users.avatar,
  rating: drivers.rating,
  totalTrips: drivers.totalTrips,
  currentLat: drivers.currentLat,
  currentLng: drivers.currentLng,
  vehicleMake: vehicles.make,
  vehicleModel: vehicles.model,
  vehicleColor: vehicles.color,
  vehiclePlate: vehicles.plateNumber,
  vehiclePhoto: vehicles.photo,
  vehicleType: vehicles.type,
  postId: ridePosts.id,
  postIsLive: ridePosts.isLive,
  streamProvider: ridePosts.streamProvider,
} as const;

async function fetchNearbyRows(lat: number, lng: number): Promise<RawDriverRow[]> {
  return db
    .select(DRIVER_COLUMNS)
    .from(drivers)
    .innerJoin(users, eq(users.id, drivers.userId))
    .leftJoin(vehicles, and(eq(vehicles.driverId, drivers.id), eq(vehicles.isActive, true)))
    .leftJoin(
      ridePosts,
      and(
        eq(ridePosts.userId, users.id),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
        eq(ridePosts.type, "stream"),
        // Only in-app (Agora) streams are watchable; legacy twitch rows must
        // never surface as live cards.
        eq(ridePosts.streamProvider, "agora"),
      ),
    )
    .where(
      and(
        eq(drivers.isOnline, true),
        eq(drivers.status, "approved"),
        sql`${drivers.currentLat} IS NOT NULL`,
        sql`${drivers.currentLng} IS NOT NULL`,
        // Bounding box pre-filter (~55 km) to avoid full-table scan
        sql`abs(CAST(${drivers.currentLat} AS float) - ${lat}) < 0.5`,
        sql`abs(CAST(${drivers.currentLng} AS float) - ${lng}) < 0.5`,
      ),
    )
    .limit(100) as unknown as RawDriverRow[];
}

async function fetchFollowedRows(followerId: string): Promise<RawDriverRow[]> {
  return db
    .select(DRIVER_COLUMNS)
    .from(drivers)
    .innerJoin(users, eq(users.id, drivers.userId))
    .leftJoin(vehicles, and(eq(vehicles.driverId, drivers.id), eq(vehicles.isActive, true)))
    .leftJoin(
      ridePosts,
      and(
        eq(ridePosts.userId, users.id),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
      ),
    )
    .where(
      and(
        eq(drivers.isOnline, true),
        eq(drivers.status, "approved"),
        // Filter to drivers the caller follows (raw SQL avoids an extra JOIN)
        sql`EXISTS (
          SELECT 1 FROM user_follows uf
          WHERE uf.follower_id = ${followerId}
            AND uf.following_id = ${users.id}
        )`,
      ),
    )
    .limit(100) as unknown as RawDriverRow[];
}

// De-duplicate rows produced by the LEFT JOIN on vehicles (one row per vehicle),
// compute distance/ETA/fare, return one DiscoveryDriver per userId.
function buildDiscoveryDrivers(
  rows: RawDriverRow[],
  refLat: number | null,
  refLng: number | null,
): DiscoveryDriver[] {
  const seen = new Map<string, DiscoveryDriver>();
  for (const row of rows) {
    if (seen.has(row.userId)) continue; // first vehicle row wins

    const dLat = parseFloat(row.currentLat ?? "");
    const dLng = parseFloat(row.currentLng ?? "");
    const hasDriverCoords = isFinite(dLat) && isFinite(dLng);
    const distanceKm =
      hasDriverCoords && refLat !== null && refLng !== null
        ? haversineKm(refLat, refLng, dLat, dLng)
        : 9999;

    const regionCode = hasDriverCoords
      ? detectRegionFromCoordinates(dLat, dLng)
      : "AE";
    const fareEst = upfrontFareEstimate(regionCode);

    seen.set(row.userId, {
      driverId: row.driverId,
      userId: row.userId,
      name: row.name,
      avatar: row.avatar ?? null,
      rating: row.rating ?? null,
      totalTrips: row.totalTrips ?? null,
      vehicle: row.vehicleMake
        ? {
            make: row.vehicleMake,
            model: row.vehicleModel ?? "",
            color: row.vehicleColor ?? null,
            licensePlate: row.vehiclePlate ?? "",
            photo: row.vehiclePhoto ?? null,
            type: row.vehicleType ?? null,
          }
        : null,
      distanceKm: Math.round(distanceKm * 100) / 100,
      etaMinutes: etaFromDistanceKm(distanceKm),
      upfrontFare: fareEst.fare,
      currency: fareEst.currency,
      currencySymbol: fareEst.symbol,
      isLive: !!(row.postIsLive && row.postId),
      postId: row.postId ?? null,
      streamProvider: row.streamProvider === "agora" ? "agora" : null,
      // Coarsened to ~1 km (2 dp) — safe to expose in discovery feed
      approxLat: hasDriverCoords ? Math.round(dLat * 100) / 100 : null,
      approxLng: hasDriverCoords ? Math.round(dLng * 100) / 100 : null,
    });
  }
  return Array.from(seen.values());
}

// ============================================================================
// GET /api/discovery/nearby?lat=&lng=&limit=
// Public — no auth required.
// Returns up to 20 online approved drivers sorted by straight-line distance.
// ============================================================================
router.get("/api/discovery/nearby", async (req, res) => {
  try {
    const lat = parseFloat(String(req.query.lat ?? ""));
    const lng = parseFloat(String(req.query.lng ?? ""));
    if (!isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng query params are required and must be numbers" });
    }
    const limit = Math.min(parseInt(String(req.query.limit ?? "20")) || 20, 50);

    const rows = await fetchNearbyRows(lat, lng);
    const result = buildDiscoveryDrivers(rows, lat, lng);
    result.sort((a, b) => a.distanceKm - b.distanceKm);

    res.json({ drivers: result.slice(0, limit) });
  } catch (err: any) {
    console.error("[discovery] nearby failed:", err);
    res.status(500).json({ error: "Failed to load nearby drivers" });
  }
});

// ============================================================================
// GET /api/discovery/following?lat=&lng=
// Auth required. Returns online drivers the caller follows, live-first then
// by distance. lat/lng are optional (omit when device location is unavailable).
// ============================================================================
router.get("/api/discovery/following", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Authentication required" });

    const lat = parseFloat(String(req.query.lat ?? ""));
    const lng = parseFloat(String(req.query.lng ?? ""));
    const hasCoords = isFinite(lat) && isFinite(lng);

    const rows = await fetchFollowedRows(session.userId);
    const result = buildDiscoveryDrivers(rows, hasCoords ? lat : null, hasCoords ? lng : null);

    // Live drivers surface first; within each group, sort by proximity
    result.sort((a, b) => {
      if (a.isLive !== b.isLive) return a.isLive ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });

    res.json({ drivers: result });
  } catch (err: any) {
    console.error("[discovery] following failed:", err);
    res.status(500).json({ error: "Failed to load followed drivers" });
  }
});

export { router as discoveryRouter };
