// ---------------------------------------------------------------------------
// Travony TV — one always-on public channel at /tv.
//
// A deterministic "director" loop scores every eligible live Agora stream
// (real viewer count, ride-in-progress, uptime) and keeps the best one in the
// featured slot, with hysteresis so the channel never thrashes between
// streams. Zero-install browser viewing via the existing public web-viewer
// token; signed-in viewers earn small non-withdrawable ride credits for
// watch time, redeemed automatically against their next completed ride.
//
// Invariants (see .agents/memory):
// - Director is 100% deterministic — no LLM anywhere near scores or money.
// - Viewer counts come from getAgoraViewerCount (real presence), never made up.
// - Featured-driver pings go through notifyUser() — the single delivery path.
// - /tv exposes only coarse location (ridePosts.cityName), never coordinates.
// - Eligibility requires the stream's driver to have opted in (drivers.tvOptIn).
// ---------------------------------------------------------------------------

import { Router } from "express";
import { db } from "./db";
import {
  ridePosts,
  rides,
  drivers,
  vehicles,
  users,
  streamProducts,
  streamAdBusinesses,
  tvFeatureEvents,
  tvWatchBalances,
  tvWatchLedger,
} from "@shared/schema";
import { and, eq, isNull, isNotNull, gte, desc, sql, inArray } from "drizzle-orm";
import { getWriteUser, getAgoraViewerCount } from "./agoraStreaming";
import { notifyUser } from "./notificationService";

export const tvRouter = Router();

// --- Director tuning (all deterministic constants) -------------------------
const DIRECTOR_TICK_MS = 15_000;
/** A featured stream keeps the slot at least this long (unless it dies). */
const MIN_FEATURE_MS = 60_000;
/** A challenger must beat the incumbent's live score by this factor. */
const SWITCH_MARGIN = 1.25;
/** Host heartbeat freshness required for TV eligibility. */
const HOST_FRESH_MS = 90_000;
/** Advisory lock key — distinct from autopilot's 894217304. */
const TV_DIRECTOR_LOCK_KEY = 894_217_305;

// --- Watch-to-earn tuning (conservative, AED) -------------------------------
const EARN_PER_HEARTBEAT = 0.01; // AED per accepted ~30s heartbeat
const HEARTBEAT_MIN_GAP_MS = 25_000; // server-enforced floor between credits
/**
 * A heartbeat older than this starts a NEW watch session: it is stamped but
 * not credited, so every credit provably follows >=25s of continuous
 * presence. Combined with the daily cap this bounds replay abuse to trivial
 * amounts per account.
 */
const SESSION_RESET_MS = 5 * 60_000;
const DAILY_EARN_CAP = 1.0; // AED per user per UTC day
/** At ride completion, redeem at most this share of the fare from TV credit. */
const REDEEM_FARE_CAP = 0.2;

const round2 = (n: number) => Math.round(n * 100) / 100;
const utcDay = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------------------
// Eligibility + scoring
// ---------------------------------------------------------------------------

interface Candidate {
  postId: string;
  hostUserId: string;
  driverId: string;
  createdAt: Date;
  rideId: string | null;
  rideActive: boolean;
  viewers: number;
  score: number;
}

/**
 * Every live Agora stream whose driver (the host if the host is a driver,
 * otherwise the ride's driver) has opted in to TV, with a fresh host
 * heartbeat. Scored deterministically:
 *   viewers*10 + (ride in progress ? 20 : 0) + min(uptimeMinutes, 10)
 */
async function eligibleCandidates(): Promise<Candidate[]> {
  const freshCutoff = new Date(Date.now() - HOST_FRESH_MS);
  const live = await db
    .select({
      postId: ridePosts.id,
      hostUserId: ridePosts.userId,
      createdAt: ridePosts.createdAt,
      rideId: ridePosts.rideId,
      hostLastSeenAt: ridePosts.hostLastSeenAt,
    })
    .from(ridePosts)
    .where(and(
      eq(ridePosts.type, "stream"),
      eq(ridePosts.streamProvider, "agora"),
      eq(ridePosts.isLive, true),
      isNull(ridePosts.endedAt),
    ));
  if (live.length === 0) return [];

  const out: Candidate[] = [];
  for (const post of live) {
    // Freshness: durable heartbeat within window, or brand-new stream still
    // inside its first grace window.
    const seen = post.hostLastSeenAt ? new Date(post.hostLastSeenAt).getTime() : 0;
    const born = new Date(post.createdAt).getTime();
    if (Math.max(seen, born) < freshCutoff.getTime()) continue;

    // Resolve the driver: host-as-driver first, else the ride's driver.
    let driverRow: { id: string; tvOptIn: boolean } | undefined;
    const [hostDriver] = await db
      .select({ id: drivers.id, tvOptIn: drivers.tvOptIn })
      .from(drivers)
      .where(eq(drivers.userId, post.hostUserId));
    driverRow = hostDriver;
    let rideStatus: string | null = null;
    if (post.rideId) {
      const [ride] = await db
        .select({ status: rides.status, driverId: rides.driverId })
        .from(rides)
        .where(eq(rides.id, post.rideId));
      rideStatus = ride?.status ?? null;
      if (!driverRow && ride?.driverId) {
        const [rideDriver] = await db
          .select({ id: drivers.id, tvOptIn: drivers.tvOptIn })
          .from(drivers)
          .where(eq(drivers.id, ride.driverId));
        driverRow = rideDriver;
      }
    }
    if (!driverRow?.tvOptIn) continue; // opt-in is a hard gate

    const viewers = getAgoraViewerCount(post.postId);
    const rideActive = rideStatus === "started" || rideStatus === "in_progress";
    const uptimeMin = Math.min(10, Math.floor((Date.now() - born) / 60_000));
    const score = viewers * 10 + (rideActive ? 20 : 0) + uptimeMin;

    out.push({
      postId: post.postId,
      hostUserId: post.hostUserId,
      driverId: driverRow.id,
      createdAt: new Date(post.createdAt),
      rideId: post.rideId,
      rideActive,
      viewers,
      score,
    });
  }
  // Deterministic order: score desc, then older stream wins ties.
  out.sort((a, b) => b.score - a.score || a.createdAt.getTime() - b.createdAt.getTime());
  return out;
}

// ---------------------------------------------------------------------------
// Director loop
// ---------------------------------------------------------------------------

async function openFeature() {
  const [row] = await db
    .select()
    .from(tvFeatureEvents)
    .where(isNull(tvFeatureEvents.endedAt))
    .orderBy(desc(tvFeatureEvents.startedAt))
    .limit(1);
  return row;
}

async function closeFeature(id: string) {
  await db
    .update(tvFeatureEvents)
    .set({ endedAt: new Date() })
    .where(and(eq(tvFeatureEvents.id, id), isNull(tvFeatureEvents.endedAt)));
}

async function feature(candidate: Candidate) {
  // Defensive: the single-open-row invariant is enforced by the director's
  // advisory xact lock (all writers go through it), but close any stragglers
  // first so a historical anomaly can never leave two open slots.
  await db
    .update(tvFeatureEvents)
    .set({ endedAt: new Date() })
    .where(isNull(tvFeatureEvents.endedAt));
  const [row] = await db
    .insert(tvFeatureEvents)
    .values({
      postId: candidate.postId,
      hostUserId: candidate.hostUserId,
      driverId: candidate.driverId,
      score: candidate.score,
      viewerCount: candidate.viewers,
      peakViewers: candidate.viewers,
    })
    .returning();

  // Featured-driver ping — always via the unified notification path.
  notifyUser({
    userId: candidate.hostUserId,
    kind: "system",
    title: "You're on Travony TV",
    body: "Your live stream was just featured on the public Travony TV channel. Viewers across the network are watching you drive.",
    urgency: "low",
    dedupeKey: `tv-featured-${candidate.postId}`,
    dedupeWindowHours: 12,
  }).catch((err) => console.error("[tv] featured notify failed:", err?.message || err));

  console.log(`[tv] now featuring stream ${candidate.postId} (score ${candidate.score}, ${candidate.viewers} viewers)`);
  return row;
}

async function directorTick(): Promise<void> {
  const candidates = await eligibleCandidates();
  const current = await openFeature();

  if (!current) {
    if (candidates.length > 0) await feature(candidates[0]);
    return;
  }

  const incumbent = candidates.find((c) => c.postId === current.postId);
  if (!incumbent) {
    // Featured stream ended / lost eligibility — close and cut to the best.
    await closeFeature(current.id);
    if (candidates.length > 0) await feature(candidates[0]);
    return;
  }

  // Track peak viewers on the open slot.
  if (incumbent.viewers > current.peakViewers) {
    await db
      .update(tvFeatureEvents)
      .set({ peakViewers: incumbent.viewers, viewerCount: incumbent.viewers })
      .where(eq(tvFeatureEvents.id, current.id));
  }

  const best = candidates[0];
  const featuredForMs = Date.now() - new Date(current.startedAt).getTime();
  if (
    best.postId !== incumbent.postId &&
    featuredForMs >= MIN_FEATURE_MS &&
    best.score > incumbent.score * SWITCH_MARGIN
  ) {
    await closeFeature(current.id);
    await feature(best);
  }
}

let directorTimer: ReturnType<typeof setInterval> | null = null;

async function guardedTick() {
  // Cross-instance guard: only one director may direct. Uses a
  // TRANSACTION-scoped advisory lock (pg_try_advisory_xact_lock) so the lock
  // is pinned to this transaction's connection and auto-released at
  // commit/rollback — session-scoped lock/unlock across a pg.Pool would land
  // on different connections and strand the lock.
  try {
    await db.transaction(async (tx) => {
      const lock = await tx.execute(
        sql`select pg_try_advisory_xact_lock(${TV_DIRECTOR_LOCK_KEY}) as locked`,
      );
      const locked = (lock as any).rows?.[0]?.locked === true;
      if (!locked) return;
      // The tick runs while this transaction (and therefore the lock) is
      // held open, so feature-slot writes are fully serialized.
      await directorTick();
    });
  } catch (err: any) {
    console.error("[tv] director tick error:", err?.message || err);
  }
}

export function startTvDirector(): void {
  if (directorTimer) return;
  directorTimer = setInterval(() => guardedTick().catch(console.error), DIRECTOR_TICK_MS);
  guardedTick().catch(console.error);
  console.log("[tv] director started");
}

// ---------------------------------------------------------------------------
// Public: what's on TV right now
// ---------------------------------------------------------------------------

tvRouter.get("/api/tv/now", async (_req, res) => {
  try {
    const current = await openFeature();
    if (!current) return res.json({ live: false, featured: null });

    // Re-verify the post is actually still live (director runs on a 15s tick).
    const [post] = await db
      .select({
        id: ridePosts.id,
        userId: ridePosts.userId,
        caption: ridePosts.caption,
        cityName: ridePosts.cityName,
        isLive: ridePosts.isLive,
        endedAt: ridePosts.endedAt,
        createdAt: ridePosts.createdAt,
      })
      .from(ridePosts)
      .where(eq(ridePosts.id, current.postId));
    if (!post || !post.isLive || post.endedAt) {
      return res.json({ live: false, featured: null });
    }

    // Driver display: first name + vehicle summary. Coarse city only.
    let driverName: string | null = null;
    let vehicleLabel: string | null = null;
    const [host] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, post.userId));
    driverName = (host?.name || "").trim().split(/\s+/)[0] || null;
    if (current.driverId) {
      const [veh] = await db
        .select({ make: vehicles.make, model: vehicles.model, color: vehicles.color })
        .from(vehicles)
        .where(eq(vehicles.driverId, current.driverId))
        .orderBy(desc(vehicles.createdAt))
        .limit(1);
      if (veh) vehicleLabel = [veh.color, veh.make, veh.model].filter(Boolean).join(" ");
    }

    // Active sponsor card on the featured stream (if any).
    const [product] = await db
      .select({
        id: streamProducts.id,
        title: streamProducts.title,
        imageUrl: streamProducts.imageUrl,
        priceLabel: streamProducts.priceLabel,
        adBusinessId: streamProducts.adBusinessId,
      })
      .from(streamProducts)
      .where(and(eq(streamProducts.postId, post.id), isNull(streamProducts.clearedAt)));

    res.json({
      live: true,
      featured: {
        postId: post.id,
        caption: post.caption,
        city: post.cityName,
        startedAt: current.startedAt,
        featuredSince: current.startedAt,
        viewerCount: getAgoraViewerCount(post.id),
        driver: { name: driverName, vehicle: vehicleLabel },
        sponsor: product
          ? {
              productId: product.id,
              title: product.title,
              imageUrl: product.imageUrl,
              priceLabel: product.priceLabel,
              isAd: product.adBusinessId !== null,
            }
          : null,
      },
    });
  } catch (err: any) {
    console.error("[tv] /now error:", err?.message || err);
    res.status(500).json({ error: "TV feed unavailable" });
  }
});

// ---------------------------------------------------------------------------
// Watch-to-earn — signed-in viewers accrue tiny ride credits for real watch
// time on the currently featured stream. Server enforces the cadence floor,
// the featured-stream match, and a hard daily cap.
// ---------------------------------------------------------------------------

tvRouter.post("/api/tv/watch/heartbeat", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Sign in to earn ride credits" });
    const postId = String(req.body?.postId || "");
    if (!postId) return res.status(400).json({ error: "postId required" });

    const current = await openFeature();
    if (!current || current.postId !== postId) {
      return res.json({ credited: 0, reason: "not-featured" });
    }
    // The host doesn't earn watch credit for their own stream.
    if (current.hostUserId === user.id) {
      return res.json({ credited: 0, reason: "own-stream" });
    }

    const today = utcDay();
    const now = new Date();

    const result = await db.transaction(async (tx) => {
      await tx
        .insert(tvWatchBalances)
        .values({ userId: user.id })
        .onConflictDoNothing();
      const [row] = await tx
        .select()
        .from(tvWatchBalances)
        .where(eq(tvWatchBalances.userId, user.id))
        .for("update");

      const sinceLast = row.lastHeartbeatAt
        ? now.getTime() - new Date(row.lastHeartbeatAt).getTime()
        : Infinity;
      const earnedToday = row.earnedTodayDate === today ? parseFloat(row.earnedToday) : 0;

      if (sinceLast < HEARTBEAT_MIN_GAP_MS) {
        return { credited: 0, reason: "too-fast", balance: parseFloat(row.balance), earnedToday };
      }
      if (sinceLast > SESSION_RESET_MS) {
        // First heartbeat of a watch session: stamp it, credit nothing. The
        // next heartbeat (>=25s later) is the first to earn.
        await tx
          .update(tvWatchBalances)
          .set({ lastHeartbeatAt: now, updatedAt: now })
          .where(eq(tvWatchBalances.userId, user.id));
        return {
          credited: 0,
          reason: "session-start",
          balance: parseFloat(row.balance),
          earnedToday,
        };
      }
      if (earnedToday >= DAILY_EARN_CAP) {
        // Still refresh the heartbeat timestamp so cadence stays honest.
        await tx
          .update(tvWatchBalances)
          .set({ lastHeartbeatAt: now, updatedAt: now })
          .where(eq(tvWatchBalances.userId, user.id));
        return { credited: 0, reason: "daily-cap", balance: parseFloat(row.balance), earnedToday };
      }

      const credit = round2(Math.min(EARN_PER_HEARTBEAT, DAILY_EARN_CAP - earnedToday));
      const newBalance = round2(parseFloat(row.balance) + credit);
      const newEarnedToday = round2(earnedToday + credit);
      await tx
        .update(tvWatchBalances)
        .set({
          balance: newBalance.toFixed(2),
          earnedTotal: round2(parseFloat(row.earnedTotal) + credit).toFixed(2),
          earnedToday: newEarnedToday.toFixed(2),
          earnedTodayDate: today,
          lastHeartbeatAt: now,
          updatedAt: now,
        })
        .where(eq(tvWatchBalances.userId, user.id));

      // Ledger: one aggregated "earn" row per user per UTC day (avoid a row
      // every 30 seconds).
      const dayStart = new Date(`${today}T00:00:00.000Z`);
      const [earnRow] = await tx
        .select({ id: tvWatchLedger.id, amount: tvWatchLedger.amount })
        .from(tvWatchLedger)
        .where(and(
          eq(tvWatchLedger.userId, user.id),
          eq(tvWatchLedger.kind, "earn"),
          gte(tvWatchLedger.createdAt, dayStart),
        ))
        .orderBy(desc(tvWatchLedger.createdAt))
        .limit(1);
      if (earnRow) {
        await tx
          .update(tvWatchLedger)
          .set({ amount: round2(parseFloat(earnRow.amount) + credit).toFixed(2) })
          .where(eq(tvWatchLedger.id, earnRow.id));
      } else {
        await tx.insert(tvWatchLedger).values({
          userId: user.id,
          kind: "earn",
          amount: credit.toFixed(2),
          postId,
          note: "Travony TV watch time",
        });
      }

      return { credited: credit, balance: newBalance, earnedToday: newEarnedToday };
    });

    res.json({
      ...result,
      dailyCap: DAILY_EARN_CAP,
      capReached: (result.earnedToday ?? 0) >= DAILY_EARN_CAP,
    });
  } catch (err: any) {
    console.error("[tv] heartbeat error:", err?.message || err);
    res.status(500).json({ error: "Heartbeat failed" });
  }
});

tvRouter.get("/api/tv/credits", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [row] = await db
      .select()
      .from(tvWatchBalances)
      .where(eq(tvWatchBalances.userId, user.id));
    const today = utcDay();
    const recent = await db
      .select({
        kind: tvWatchLedger.kind,
        amount: tvWatchLedger.amount,
        note: tvWatchLedger.note,
        createdAt: tvWatchLedger.createdAt,
      })
      .from(tvWatchLedger)
      .where(eq(tvWatchLedger.userId, user.id))
      .orderBy(desc(tvWatchLedger.createdAt))
      .limit(20);
    res.json({
      balance: row ? parseFloat(row.balance) : 0,
      earnedTotal: row ? parseFloat(row.earnedTotal) : 0,
      redeemedTotal: row ? parseFloat(row.redeemedTotal) : 0,
      earnedToday: row && row.earnedTodayDate === today ? parseFloat(row.earnedToday) : 0,
      dailyCap: DAILY_EARN_CAP,
      ledger: recent,
    });
  } catch (err: any) {
    console.error("[tv] credits error:", err?.message || err);
    res.status(500).json({ error: "Could not load credits" });
  }
});

// ---------------------------------------------------------------------------
// Weekly leaderboard — public, first names only, real featured time + peaks.
// ---------------------------------------------------------------------------

tvRouter.get("/api/tv/leaderboard", async (_req, res) => {
  try {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3_600_000);
    const events = await db
      .select({
        hostUserId: tvFeatureEvents.hostUserId,
        startedAt: tvFeatureEvents.startedAt,
        endedAt: tvFeatureEvents.endedAt,
        peakViewers: tvFeatureEvents.peakViewers,
      })
      .from(tvFeatureEvents)
      .where(gte(tvFeatureEvents.startedAt, weekAgo));

    const byHost = new Map<string, { minutes: number; peak: number }>();
    const now = Date.now();
    for (const ev of events) {
      const end = ev.endedAt ? new Date(ev.endedAt).getTime() : now;
      const mins = Math.max(0, (end - new Date(ev.startedAt).getTime()) / 60_000);
      const agg = byHost.get(ev.hostUserId) || { minutes: 0, peak: 0 };
      agg.minutes += mins;
      agg.peak = Math.max(agg.peak, ev.peakViewers);
      byHost.set(ev.hostUserId, agg);
    }
    const hostIds = [...byHost.keys()];
    const names = hostIds.length
      ? await db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(inArray(users.id, hostIds))
      : [];
    const nameOf = new Map(names.map((n) => [n.id, (n.name || "").trim().split(/\s+/)[0] || "Driver"]));

    const board = hostIds
      .map((id) => ({
        name: nameOf.get(id) || "Driver",
        featuredMinutes: Math.round(byHost.get(id)!.minutes),
        peakViewers: byHost.get(id)!.peak,
      }))
      .sort((a, b) => b.featuredMinutes - a.featuredMinutes)
      .slice(0, 10);
    res.json({ since: weekAgo, board });
  } catch (err: any) {
    console.error("[tv] leaderboard error:", err?.message || err);
    res.status(500).json({ error: "Could not load leaderboard" });
  }
});

// ---------------------------------------------------------------------------
// Sponsor reach metrics from /tv — impressions + taps, counted only while the
// card's stream is actually the featured one.
// ---------------------------------------------------------------------------

async function activeFeaturedProduct(productId: string) {
  const current = await openFeature();
  if (!current) return null;
  const [product] = await db
    .select({ id: streamProducts.id, postId: streamProducts.postId })
    .from(streamProducts)
    .where(and(eq(streamProducts.id, productId), isNull(streamProducts.clearedAt)));
  if (!product || product.postId !== current.postId) return null;
  return product;
}

// Per-IP dedupe/throttle for the public sponsor counters. These metrics are
// coarse (billboard-style reach), but an open unauthenticated counter must at
// least not be trivially inflatable in a loop: one impression per IP+product
// per 10 minutes, one tap per IP+product per 30 seconds.
const sponsorHits = new Map<string, number>();
const IMPRESSION_DEDUPE_MS = 10 * 60_000;
const TAP_DEDUPE_MS = 30_000;

function sponsorAllowed(kind: "imp" | "tap", ip: string, productId: string): boolean {
  const now = Date.now();
  // Opportunistic cleanup so the map can't grow unbounded.
  if (sponsorHits.size > 5000) {
    for (const [k, t] of sponsorHits) {
      if (now - t > IMPRESSION_DEDUPE_MS) sponsorHits.delete(k);
    }
  }
  const key = `${kind}:${ip}:${productId}`;
  const last = sponsorHits.get(key) || 0;
  const window = kind === "imp" ? IMPRESSION_DEDUPE_MS : TAP_DEDUPE_MS;
  if (now - last < window) return false;
  sponsorHits.set(key, now);
  return true;
}

tvRouter.post("/api/tv/sponsor/:productId/impression", async (req, res) => {
  try {
    const product = await activeFeaturedProduct(String(req.params.productId));
    if (!product) return res.status(404).json({ error: "Not on air" });
    if (!sponsorAllowed("imp", req.ip || "?", product.id)) return res.json({ ok: true });
    await db
      .update(streamProducts)
      .set({ tvImpressions: sql`${streamProducts.tvImpressions} + 1` })
      .where(eq(streamProducts.id, product.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed" });
  }
});

tvRouter.post("/api/tv/sponsor/:productId/tap", async (req, res) => {
  try {
    const product = await activeFeaturedProduct(String(req.params.productId));
    if (!product) return res.status(404).json({ error: "Not on air" });
    if (!sponsorAllowed("tap", req.ip || "?", product.id)) return res.json({ ok: true });
    await db
      .update(streamProducts)
      .set({ tvTaps: sql`${streamProducts.tvTaps} + 1` })
      .where(eq(streamProducts.id, product.id));
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// ---------------------------------------------------------------------------
// Driver opt-in
// ---------------------------------------------------------------------------

tvRouter.get("/api/tv/opt-in", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [driver] = await db
      .select({ tvOptIn: drivers.tvOptIn })
      .from(drivers)
      .where(eq(drivers.userId, user.id));
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    res.json({ optIn: driver.tvOptIn });
  } catch (err: any) {
    res.status(500).json({ error: "Failed" });
  }
});

tvRouter.post("/api/tv/opt-in", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const optIn = req.body?.optIn === true;
    const [driver] = await db
      .update(drivers)
      .set({ tvOptIn: optIn, updatedAt: new Date() })
      .where(eq(drivers.userId, user.id))
      .returning({ tvOptIn: drivers.tvOptIn });
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    res.json({ optIn: driver.tvOptIn });
  } catch (err: any) {
    res.status(500).json({ error: "Failed" });
  }
});

// ---------------------------------------------------------------------------
// Redemption — called from the ride-completion side-effect block in routes.ts
// (inside the persisted, authorized completed-transition gate; fare > 0 only,
// so free prayer rides are naturally excluded). Converts TV credit into ride
// credit (wallet top-up) capped at REDEEM_FARE_CAP of the fare.
// Returns the redeemed amount (0 when nothing to redeem).
// ---------------------------------------------------------------------------

export async function redeemTvCreditsForRide(
  ride: { id: string; customerId: string },
  fare: number,
): Promise<number> {
  if (!(fare > 0)) return 0;
  const cap = round2(fare * REDEEM_FARE_CAP);
  if (cap < 0.01) return 0;

  const amount = await db.transaction(async (tx) => {
    // Serialize on the balance row FIRST — every redemption for this user
    // queues behind this lock, so the idempotency check below can never read
    // a stale snapshot (a concurrent duplicate hook waits here, then sees the
    // committed ledger row).
    const [row] = await tx
      .select({ balance: tvWatchBalances.balance, redeemedTotal: tvWatchBalances.redeemedTotal })
      .from(tvWatchBalances)
      .where(eq(tvWatchBalances.userId, ride.customerId))
      .for("update");
    if (!row) return 0;

    // Idempotency: never redeem twice for the same ride, even if the
    // completion hook were ever to fire again. Checked while holding the
    // balance lock above.
    const [existing] = await tx
      .select({ id: tvWatchLedger.id })
      .from(tvWatchLedger)
      .where(and(
        eq(tvWatchLedger.userId, ride.customerId),
        eq(tvWatchLedger.kind, "redeem"),
        eq(tvWatchLedger.rideId, ride.id),
      ))
      .limit(1);
    if (existing) return 0;
    const balance = parseFloat(row.balance);
    const redeem = round2(Math.min(balance, cap));
    if (redeem < 0.01) return 0;

    await tx
      .update(tvWatchBalances)
      .set({
        balance: round2(balance - redeem).toFixed(2),
        redeemedTotal: round2(parseFloat(row.redeemedTotal) + redeem).toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(tvWatchBalances.userId, ride.customerId));
    await tx.insert(tvWatchLedger).values({
      userId: ride.customerId,
      kind: "redeem",
      amount: redeem.toFixed(2),
      rideId: ride.id,
      note: "Redeemed as ride credit",
    });
    // Wallet credit INSIDE the same transaction, as an atomic SQL increment —
    // debit and credit commit or roll back together, and concurrent wallet
    // writers can't clobber it.
    await tx
      .update(users)
      .set({
        walletBalance: sql`COALESCE(${users.walletBalance}, 0) + ${redeem.toFixed(2)}::numeric`,
      })
      .where(eq(users.id, ride.customerId));
    return redeem;
  });

  if (amount > 0) {
    notifyUser({
      userId: ride.customerId,
      kind: "system",
      title: "Travony TV credit applied",
      body: `AED ${amount.toFixed(2)} of your TV watch credit was added to your wallet after this ride.`,
      urgency: "low",
      dedupeKey: `tv-redeem-${ride.id}`,
    }).catch(() => {});
    console.log(`[tv] redeemed ${amount.toFixed(2)} TV credit for ride ${ride.id}`);
  }
  return amount;
}
