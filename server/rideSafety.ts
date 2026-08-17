import { Router } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { storage } from "./storage";
import {
  rides,
  ridePosts,
  drivers,
  rideSafetyEvents,
  rideSafetyReports,
  type RideSafetyEvent,
  type RideSafetyReport,
} from "@shared/schema";
import { eq, and, isNull, desc, inArray, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// AI safety layer — every streamed ride gets a post-ride safety report.
//
// Trust model (mirrors the demand-forecast pattern):
// - The FLAGS are deterministic: harsh speed changes derived server-side from
//   the broadcaster's heartbeat pulses, stream drops while the vehicle was
//   moving (host-grace expiry), control lockouts, participant bookmarks.
// - The LLM writes ONLY the human-readable summary sentence, from a fixed
//   facts sheet of counts. An honesty guard rejects any output that invents
//   numbers or money vocabulary; a deterministic template is the fallback.
// - No raw video is analyzed or stored. No coordinates or addresses are ever
//   written into events, facts, or summaries — moments are pinned by seconds
//   into the stream, which is what a fleet owner reviews against.
// ---------------------------------------------------------------------------

export const rideSafetyRouter = Router();

// Deterministic thresholds — one place, so the report can explain itself.
const HARSH_DELTA_KMH = 30;      // |Δspeed| at/above this within one pulse gap → harsh event
const PULSE_MAX_GAP_S = 45;      // pulses further apart than this don't form a delta
const PULSE_MIN_GAP_S = 4;       // debounce duplicate heartbeats
const MOVING_KMH = 15;           // matches the client lockout threshold
const DROP_MOVING_WINDOW_MS = 120 * 1000; // was moving this recently when the stream died → flag
const HARSH_THROTTLE_MS = 30 * 1000;      // at most one harsh event per ride per 30s
const LOCKOUT_THROTTLE_MS = 60 * 1000;    // at most one lockout event per stream per minute
const BOOKMARK_COOLDOWN_MS = 10 * 1000;   // per user+ride
const MAX_SPEED_SANE_KMH = 200; // discard GPS glitches

// In-memory motion state (per live stream). Loss on restart only costs one
// delta — the durable events table is the source of truth for the report.
const lastPulse = new Map<string, { speedKmh: number; at: number }>();
const lastMovingAt = new Map<string, { at: number; rideId: string | null }>();
const lastHarshAt = new Map<string, number>();     // rideId → ts
const lastLockoutAt = new Map<string, number>();   // postId → ts
const lastBookmarkAt = new Map<string, number>();  // `${rideId}:${userId}` → ts

// ---------------------------------------------------------------------------
// Event write pipeline. Two guarantees keep the immutable report complete:
// 1. Every event write is TRACKED per ride, and report generation drains the
//    in-flight set before snapshotting — a write that has started is included.
// 2. The insert itself is one atomic statement conditional on the ride's
//    report not existing yet — an event can never land after its report, so
//    the report is always a complete picture of the events table.
// ---------------------------------------------------------------------------
const pendingEventWrites = new Map<string, Set<Promise<unknown>>>();

export function trackSafetyWrite<T>(rideId: string, p: PromiseLike<T>): Promise<T> {
  // Normalize to a native promise FIRST: drizzle queries are lazy thenables
  // that re-execute the SQL on every .then() subscription, so tracking the
  // raw thenable AND awaiting it would run the statement twice.
  const promise = Promise.resolve(p);
  let set = pendingEventWrites.get(rideId);
  if (!set) {
    set = new Set();
    pendingEventWrites.set(rideId, set);
  }
  set.add(promise);
  void promise
    .catch(() => {})
    .finally(() => {
      const s = pendingEventWrites.get(rideId);
      if (s) {
        s.delete(promise);
        if (s.size === 0) pendingEventWrites.delete(rideId);
      }
    });
  return promise;
}

export async function drainSafetyWrites(rideId: string): Promise<void> {
  // Writes can enqueue while draining; loop until the set stays empty
  // (bounded — steady-state event traffic for a completed ride is zero).
  for (let i = 0; i < 10; i++) {
    const set = pendingEventWrites.get(rideId);
    if (!set || set.size === 0) return;
    await Promise.allSettled([...set]);
  }
}

type SafetyEventValues = {
  rideId: string;
  postId?: string | null;
  kind: string;
  severity: string;
  streamOffsetSec?: number | null;
  speedKmh?: string | null;
  deltaKmh?: string | null;
  createdBy?: string | null;
  note?: string | null;
};

// Per-ride advisory lock class for safety finalization — event inserts and
// the report snapshot serialize on it, so the "no report yet" check and the
// snapshot can never interleave. (894217304-306 are used elsewhere.)
const SAFETY_LOCK_CLASS = 894217307;

/** Guarded, tracked event insert: takes the per-ride finalization lock, then
 * inserts only if the ride's report does not exist yet. Returns true when the
 * row was inserted. Exported for the concurrency test. */
export async function insertSafetyEvent(v: SafetyEventValues): Promise<boolean> {
  return trackSafetyWrite(
    v.rideId,
    db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${SAFETY_LOCK_CLASS}, hashtext(${v.rideId}))`);
      const r = await tx.execute(sql`
        INSERT INTO ride_safety_events
          (ride_id, post_id, kind, severity, stream_offset_sec, speed_kmh, delta_kmh, created_by, note)
        SELECT ${v.rideId}, ${v.postId ?? null}, ${v.kind}, ${v.severity}, ${v.streamOffsetSec ?? null},
               ${v.speedKmh ?? null}, ${v.deltaKmh ?? null}, ${v.createdBy ?? null}, ${v.note ?? null}
        WHERE NOT EXISTS (SELECT 1 FROM ride_safety_reports WHERE ride_id = ${v.rideId})
      `);
      return ((r as { rowCount?: number | null }).rowCount ?? 0) > 0;
    }),
  );
}

function offsetSec(streamStartedAt: Date | string | null | undefined): number | null {
  if (!streamStartedAt) return null;
  const s = Math.floor((Date.now() - new Date(streamStartedAt).getTime()) / 1000);
  return s >= 0 ? s : 0;
}

/** Heartbeat hook — the broadcaster app reports its GPS speed alongside the
 * liveness heartbeat (~15s cadence). Server derives deltas; the client never
 * declares an event. Fire-and-forget from the heartbeat handler. */
export async function recordSafetyPulse(
  post: { id: string; rideId: string | null; createdAt: Date | string },
  speedKmhRaw: unknown,
): Promise<void> {
  const speedKmh = Number(speedKmhRaw);
  if (!Number.isFinite(speedKmh) || speedKmh < 0 || speedKmh > MAX_SPEED_SANE_KMH) return;

  const now = Date.now();
  if (speedKmh > MOVING_KMH) {
    lastMovingAt.set(post.id, { at: now, rideId: post.rideId });
  }

  const prev = lastPulse.get(post.id);
  lastPulse.set(post.id, { speedKmh, at: now });
  if (!prev || !post.rideId) return;

  const gapS = (now - prev.at) / 1000;
  if (gapS < PULSE_MIN_GAP_S || gapS > PULSE_MAX_GAP_S) return;

  const delta = speedKmh - prev.speedKmh;
  if (Math.abs(delta) < HARSH_DELTA_KMH) return;

  const lastHarsh = lastHarshAt.get(post.rideId) ?? 0;
  if (now - lastHarsh < HARSH_THROTTLE_MS) return;
  lastHarshAt.set(post.rideId, now);

  const kind = delta < 0 ? "harsh_brake" : "harsh_accel";
  try {
    await insertSafetyEvent({
      rideId: post.rideId,
      postId: post.id,
      kind,
      severity: "flag",
      streamOffsetSec: offsetSec(post.createdAt),
      speedKmh: speedKmh.toFixed(2),
      deltaKmh: delta.toFixed(2),
      note: kind === "harsh_brake" ? "Sharp speed drop" : "Sharp speed rise",
    });
  } catch (err: any) {
    console.error("[safety] harsh event insert failed:", err?.message || err);
  }
}

/** Stream watchdog hook — the host vanished past the grace window. If the
 * vehicle was moving within the last 2 minutes, that's a flagged moment. */
export async function recordStreamDropIfMoving(
  post: { id: string; rideId: string | null; createdAt: Date | string },
): Promise<void> {
  if (!post.rideId) return;
  const moving = lastMovingAt.get(post.id);
  const wasMoving = !!moving && Date.now() - moving.at <= DROP_MOVING_WINDOW_MS;
  // Clean up in-memory state for this stream either way.
  lastPulse.delete(post.id);
  lastMovingAt.delete(post.id);
  if (!wasMoving) return;
  try {
    await insertSafetyEvent({
      rideId: post.rideId,
      postId: post.id,
      kind: "stream_drop_moving",
      severity: "flag",
      streamOffsetSec: offsetSec(post.createdAt),
      note: "Stream dropped while the vehicle was moving",
    });
  } catch (err: any) {
    console.error("[safety] stream-drop event insert failed:", err?.message || err);
  }
}

/** Clean up motion state when a stream ends normally. */
export function clearSafetyMotionState(postId: string): void {
  lastPulse.delete(postId);
  lastMovingAt.delete(postId);
}

// ---------------------------------------------------------------------------
// Auth helpers (same convention as agoraStreaming / socialRoutes).
// ---------------------------------------------------------------------------
async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

async function rideParticipantUserIds(ride: { customerId: string; driverId: string | null }) {
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

const ACTIVE_RIDE_STATUSES = ["accepted", "arriving", "started", "in_progress"];

async function liveStreamForRide(rideId: string) {
  const [post] = await db
    .select({ id: ridePosts.id, createdAt: ridePosts.createdAt })
    .from(ridePosts)
    .where(and(
      eq(ridePosts.rideId, rideId),
      eq(ridePosts.type, "stream"),
      eq(ridePosts.streamProvider, "agora"),
      isNull(ridePosts.endedAt),
    ))
    .orderBy(desc(ridePosts.createdAt))
    .limit(1);
  return post || null;
}

// ---------------------------------------------------------------------------
// POST /api/rides/:id/safety/bookmark — rider or driver pins "this moment".
// One tap during a live ride; if a stream is live, the pin carries the stream
// offset so it can be reviewed against the footage later.
// ---------------------------------------------------------------------------
rideSafetyRouter.post("/api/rides/:id/safety/bookmark", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const { customerId, driverUserId } = await rideParticipantUserIds(ride);
    if (session.userId !== customerId && session.userId !== driverUserId) {
      return res.status(403).json({ error: "Not a participant of this ride" });
    }
    if (!ACTIVE_RIDE_STATUSES.includes(ride.status)) {
      return res.status(400).json({ error: "Ride is not active" });
    }

    const cooldownKey = `${ride.id}:${session.userId}`;
    const last = lastBookmarkAt.get(cooldownKey) ?? 0;
    if (Date.now() - last < BOOKMARK_COOLDOWN_MS) {
      return res.status(429).json({ error: "Just bookmarked — give it a few seconds" });
    }
    lastBookmarkAt.set(cooldownKey, Date.now());

    const post = await liveStreamForRide(ride.id);
    const streamOffset = post ? offsetSec(post.createdAt) : null;
    const inserted = await insertSafetyEvent({
      rideId: ride.id,
      postId: post?.id ?? null,
      kind: "bookmark",
      severity: "notice",
      streamOffsetSec: streamOffset,
      createdBy: session.userId,
      note: session.userId === customerId ? "Pinned by rider" : "Pinned by driver",
    });
    if (!inserted) {
      // Report already generated (ride just finished) — too late to pin.
      return res.status(409).json({ error: "Ride report already finalized" });
    }

    res.json({ bookmarked: true, streamOffsetSec: streamOffset });
  } catch (error: any) {
    console.error("[safety] bookmark error:", error?.message || error);
    res.status(500).json({ error: "Could not bookmark this moment" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agora/streams/:postId/safety-event — the broadcaster reports the
// distraction lockout engaging (informational context, never a flag). Host
// only, live streams only, throttled hard.
// ---------------------------------------------------------------------------
rideSafetyRouter.post("/api/agora/streams/:postId/safety-event", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (req.body?.kind !== "control_lockout") {
      return res.status(400).json({ error: "Unknown safety event kind" });
    }
    const [post] = await db
      .select({ id: ridePosts.id, userId: ridePosts.userId, rideId: ridePosts.rideId, createdAt: ridePosts.createdAt, endedAt: ridePosts.endedAt, type: ridePosts.type, provider: ridePosts.streamProvider })
      .from(ridePosts)
      .where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.provider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }
    if (post.userId !== session.userId) return res.status(403).json({ error: "Not your stream" });
    if (post.endedAt || !post.rideId) return res.json({ recorded: false });

    const last = lastLockoutAt.get(post.id) ?? 0;
    if (Date.now() - last < LOCKOUT_THROTTLE_MS) return res.json({ recorded: false });
    lastLockoutAt.set(post.id, Date.now());

    const recorded = await insertSafetyEvent({
      rideId: post.rideId,
      postId: post.id,
      kind: "control_lockout",
      severity: "info",
      streamOffsetSec: offsetSec(post.createdAt),
      note: "Stream controls locked while moving",
    });
    res.json({ recorded });
  } catch (error: any) {
    console.error("[safety] lockout event error:", error?.message || error);
    res.status(500).json({ error: "Could not record safety event" });
  }
});

// ---------------------------------------------------------------------------
// Report generation — deterministic facts, LLM prose, honesty-guarded.
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null;
function openaiClient(): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

type SafetyFacts = {
  harshBrakes: number;
  harshAccels: number;
  streamDrops: number;
  lockouts: number;
  bookmarks: number;
  streamedMinutes: number | null;
};

function buildFacts(events: RideSafetyEvent[], streamedMinutes: number | null): SafetyFacts {
  const count = (k: string) => events.filter((e) => e.kind === k).length;
  return {
    harshBrakes: count("harsh_brake"),
    harshAccels: count("harsh_accel"),
    streamDrops: count("stream_drop_moving"),
    lockouts: count("control_lockout"),
    bookmarks: count("bookmark"),
    streamedMinutes,
  };
}

function deterministicSummary(f: SafetyFacts, status: "calm" | "flagged"): string {
  const streamed = f.streamedMinutes && f.streamedMinutes >= 1 ? ` across ${f.streamedMinutes} streamed minutes` : "";
  if (status === "calm") {
    const lockNote = f.lockouts > 0 ? " Stream controls stayed locked while the vehicle was moving." : "";
    return `Calm ride — no safety flags detected${streamed}.${lockNote}`;
  }
  const parts: string[] = [];
  if (f.harshBrakes > 0) parts.push(`${f.harshBrakes} sharp braking moment${f.harshBrakes > 1 ? "s" : ""}`);
  if (f.harshAccels > 0) parts.push(`${f.harshAccels} sharp acceleration${f.harshAccels > 1 ? "s" : ""}`);
  if (f.streamDrops > 0) parts.push(`${f.streamDrops} stream drop${f.streamDrops > 1 ? "s" : ""} while moving`);
  return `Flagged for review — ${parts.join(", ")}${streamed}. Moments are pinned to the stream timeline.`;
}

const MONEY_WORDS = /(\$|€|£|aed|usd|bdt|pkr|inr|taka|dirham|rupee|dollar|euro|\/hr|per hour|earn|fare|tip)/i;

// The LLM's contract is QUANTITY-FREE prose: it characterizes what happened,
// while every number (counts, durations) lives only in the deterministic
// template and UI. That makes the guard adversarially simple — any digit or
// spelled-out quantity anywhere is a reject, with no attribution puzzles
// ("two sharp braking moments" vs "braking occurred twice" both die the same
// way). Negated-but-true phrasings ("no braking") also fall to the template —
// a false reject only costs prose, never correctness.
const NUMBER_WORDS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "once", "twice", "thrice", "dozen",
  "dozens", "couple", "several", "multiple", "numerous", "many", "few",
  "repeated", "repeatedly", "single", "both", "half", "hundred", "hundreds",
  "thousand", "thousands",
]);

const CATEGORY_TERMS: Array<{ re: RegExp; fact: keyof SafetyFacts }> = [
  { re: /brak/i, fact: "harshBrakes" },
  { re: /accelerat|speed(?:ing| rise| rose| jump| spike)/i, fact: "harshAccels" },
  { re: /drop|disconnect|interrupt|cut\s?out|signal loss|lost/i, fact: "streamDrops" },
  { re: /lock/i, fact: "lockouts" },
  { re: /bookmark|pinn/i, fact: "bookmarks" },
];

export function safetySummaryPassesGuard(
  text: string,
  facts: SafetyFacts,
): boolean {
  if (!text || text.length > 240) return false;
  if (MONEY_WORDS.test(text)) return false;

  // Quantity-free contract: any digit anywhere is a reject.
  if (/\d/.test(text)) return false;
  // Any spelled-out quantity anywhere is a reject — no attribution needed.
  for (const word of text.toLowerCase().match(/\b[a-z]+\b/g) || []) {
    if (NUMBER_WORDS.has(word)) return false;
  }
  // Event categories may only be mentioned when they actually happened
  // (applies to every mention — a single .test() covers all occurrences,
  // since a zero-count category may not appear even once).
  for (const { re, fact } of CATEGORY_TERMS) {
    if (re.test(text) && (facts[fact] ?? 0) === 0) return false;
  }
  // No duration talk — the template carries the streamed minutes.
  if (/\b(minute|hour|second)s?\b/i.test(text)) return false;

  return true;
}

async function llmSummary(f: SafetyFacts, status: "calm" | "flagged"): Promise<{ text: string; source: "ai" | "template" }> {
  const fallback = deterministicSummary(f, status);
  const client = openaiClient();
  if (!client) return { text: fallback, source: "template" };

  const factLines = [
    `Overall: ${status === "calm" ? "calm, no safety flags" : "flagged for review"}`,
    f.harshBrakes > 0 ? `Sharp braking moments: ${f.harshBrakes}` : null,
    f.harshAccels > 0 ? `Sharp accelerations: ${f.harshAccels}` : null,
    f.streamDrops > 0 ? `Stream drops while moving: ${f.streamDrops}` : null,
    f.lockouts > 0 ? `Times stream controls auto-locked while moving: ${f.lockouts}` : null,
    f.bookmarks > 0 ? `Moments bookmarked by ride participants: ${f.bookmarks}` : null,
    f.streamedMinutes && f.streamedMinutes >= 1 ? `Streamed minutes: ${f.streamedMinutes}` : null,
  ].filter(Boolean).join("\n");

  try {
    const resp = await client.chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_tokens: 90,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write a 1-2 sentence post-ride safety summary (max 220 characters) for a ride-hail app, read by the rider and the fleet owner. Use ONLY the facts given, and NEVER use numbers, digits, spelled-out counts, quantities, or durations — characterize what happened without quantifying it (the app shows exact counts separately). Never invent event types, places, street names, or causes. Calm, factual tone. No emojis, no exclamation marks.",
          },
          { role: "user", content: factLines },
        ],
      },
      { timeout: 2500 },
    );
    const text = (resp.choices[0]?.message?.content || "").trim().replace(/\s+/g, " ");
    const ok = safetySummaryPassesGuard(text, f);
    return ok ? { text, source: "ai" } : { text: fallback, source: "template" };
  } catch {
    return { text: fallback, source: "template" };
  }
}

/** Generate (idempotently) the safety report for a completed ride that had at
 * least one in-app stream. Returns the report, or null when the ride doesn't
 * qualify (not completed, or never streamed). */
export async function generateSafetyReport(
  rideId: string,
  opts: { proseUpgrade?: boolean } = {},
): Promise<RideSafetyReport | null> {
  const [existing] = await db.select().from(rideSafetyReports).where(eq(rideSafetyReports.rideId, rideId));
  if (existing) return existing;

  const ride = await storage.getRide(rideId);
  if (!ride || ride.status !== "completed") return null;

  let streamPosts = await db
    .select({ id: ridePosts.id, createdAt: ridePosts.createdAt, endedAt: ridePosts.endedAt })
    .from(ridePosts)
    .where(and(
      eq(ridePosts.rideId, rideId),
      eq(ridePosts.type, "stream"),
      eq(ridePosts.streamProvider, "agora"),
    ));
  if (streamPosts.length === 0) return null; // safety reports are for streamed rides

  // NEVER snapshot while any stream row is still open — a report is immutable
  // once written, and an open stream can still produce deterministic events.
  // The completion hook retries and the GET path is lazy, so "not yet" is
  // safe. If a post is still open minutes after completion (lost teardown),
  // durably CLOSE it first — the heartbeat handler refuses pulses for ended
  // posts, so once endedAt is persisted no further events can originate from
  // that stream — and only then finalize.
  if (streamPosts.some((p) => !p.endedAt)) {
    const completedAtMs = ride.completedAt ? new Date(ride.completedAt).getTime() : Date.now();
    if (Date.now() - completedAtMs < 2 * 60 * 1000) return null;
    await db.execute(sql`
      UPDATE ride_posts
      SET is_live = false, ended_at = COALESCE(host_last_seen_at, now())
      WHERE ride_id = ${rideId} AND type = 'stream' AND stream_provider = 'agora' AND ended_at IS NULL
    `);
    streamPosts = await db
      .select({ id: ridePosts.id, createdAt: ridePosts.createdAt, endedAt: ridePosts.endedAt })
      .from(ridePosts)
      .where(and(
        eq(ridePosts.rideId, rideId),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
      ));
    if (streamPosts.some((p) => !p.endedAt)) return null; // paranoia: try again next sweep
  }

  // Best-effort: let event writes that already started land before we take
  // the lock (the lock alone guarantees consistency; this widens inclusion).
  await drainSafetyWrites(rideId);

  let streamedMs = 0;
  for (const p of streamPosts) {
    const start = new Date(p.createdAt).getTime();
    const end = p.endedAt ? new Date(p.endedAt).getTime() : Date.now();
    if (end > start) streamedMs += end - start;
  }
  const streamedMinutes = streamedMs > 0 ? Math.max(1, Math.round(streamedMs / 60000)) : null;

  // Phase 1 — atomic finalization. Under the SAME per-ride lock the event
  // inserts take: snapshot events, create the report with the deterministic
  // template summary, commit. Serialization makes the report exactly equal to
  // the events table at the moment it comes to exist — and once it exists,
  // the guarded inserts refuse all further events. Facts never change again.
  const created = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(${SAFETY_LOCK_CLASS}, hashtext(${rideId}))`);
    const [dup] = await tx.select().from(rideSafetyReports).where(eq(rideSafetyReports.rideId, rideId));
    if (dup) return null;
    const events = await tx.select().from(rideSafetyEvents).where(eq(rideSafetyEvents.rideId, rideId));
    const facts = buildFacts(events, streamedMinutes);
    const flagCount = events.filter((e) => e.severity === "flag").length;
    const status: "calm" | "flagged" = flagCount > 0 ? "flagged" : "calm";
    await tx.insert(rideSafetyReports).values({
      rideId,
      status,
      flagCount,
      bookmarkCount: facts.bookmarks,
      facts,
      summary: deterministicSummary(facts, status),
      summarySource: "template",
    });
    return { facts, status };
  });

  // Phase 2 — optional prose upgrade, outside the lock. The facts are frozen;
  // only the wording can improve, and only when it passes the honesty guard.
  // Reconciliation passes proseUpgrade:false to stay fast on request paths —
  // those reports keep the (fully honest) deterministic template summary.
  if (created && opts.proseUpgrade !== false) {
    try {
      const { text, source } = await llmSummary(created.facts, created.status);
      if (source === "ai") {
        await db
          .update(rideSafetyReports)
          .set({ summary: text, summarySource: "ai" })
          .where(and(
            eq(rideSafetyReports.rideId, rideId),
            eq(rideSafetyReports.summarySource, "template"),
          ));
      }
    } catch (err: any) {
      console.error("[safety] summary upgrade failed (template kept):", err?.message || err);
    }
  }

  const [report] = await db.select().from(rideSafetyReports).where(eq(rideSafetyReports.rideId, rideId));
  return report ?? null;
}

/** Ride-completion hook — fire-and-forget with backoff retries: the first
 * attempt can find a stream still finalizing (generation then declines), so
 * later attempts pick it up; the final ones land past the 2-minute escape
 * hatch, so a lost teardown can't block the report forever. The lazy GET
 * path remains the restart fallback. */
/** Durable reconciliation — the in-memory retry chain above dies with the
 * process, so this scans for completed Agora-streamed rides that still lack a
 * report and generates them (template summary only, to stay fast). Runs on
 * startup, on an interval, and before fleet review listings so a restart can
 * never leave a fleet owner without a report. Single-flight; per-ride
 * correctness comes from the advisory lock inside generateSafetyReport. */
let reconcileInFlight: Promise<number> | null = null;
export function reconcileSafetyReports(): Promise<number> {
  if (reconcileInFlight) return reconcileInFlight;
  reconcileInFlight = (async () => {
    try {
      // Exhaustive, paginated selection: NO age cutoff — a ride missed during
      // an extended outage is still picked up. Each created report removes
      // its ride from the next page's selection, so re-querying paginates.
      // A page that makes zero progress (e.g. rides completed <2 min ago
      // whose streams are still settling) ends the sweep; the interval or
      // the next fleet-review request resumes it.
      let created = 0;
      for (let sweep = 0; sweep < 20; sweep++) {
        const rows = (
          await db.execute(sql`
            SELECT DISTINCT r.id
            FROM rides r
            JOIN ride_posts p ON p.ride_id = r.id AND p.type = 'stream' AND p.stream_provider = 'agora'
            LEFT JOIN ride_safety_reports rep ON rep.ride_id = r.id
            WHERE r.status = 'completed'
              AND rep.id IS NULL
            LIMIT 50
          `)
        ).rows as Array<{ id: string }>;
        if (rows.length === 0) break;
        let createdThisSweep = 0;
        for (const row of rows) {
          try {
            if (await generateSafetyReport(row.id, { proseUpgrade: false })) createdThisSweep++;
          } catch (err: any) {
            console.error(`[safety] reconcile failed for ride ${row.id}:`, err?.message || err);
          }
        }
        created += createdThisSweep;
        if (createdThisSweep === 0 || rows.length < 50) break;
      }
      if (created > 0) console.log(`[safety] reconciled ${created} missing safety report(s)`);
      return created;
    } finally {
      reconcileInFlight = null;
    }
  })();
  return reconcileInFlight;
}

const RECONCILE_INTERVAL_MS = 5 * 60_000;
export function startSafetyReportReconciler(): void {
  setTimeout(() => {
    reconcileSafetyReports().catch((err) =>
      console.error("[safety] startup reconcile failed:", err?.message || err),
    );
  }, 15_000);
  setInterval(() => {
    reconcileSafetyReports().catch((err) =>
      console.error("[safety] interval reconcile failed:", err?.message || err),
    );
  }, RECONCILE_INTERVAL_MS);
}

const REPORT_RETRY_DELAYS_MS = [3000, 15000, 45000, 60000, 90000];
export function scheduleSafetyReport(rideId: string): void {
  const attempt = (i: number) => {
    setTimeout(() => {
      generateSafetyReport(rideId)
        .then((report) => {
          if (!report && i + 1 < REPORT_RETRY_DELAYS_MS.length) attempt(i + 1);
        })
        .catch((err) => {
          console.error("[safety] report generation failed:", err?.message || err);
          if (i + 1 < REPORT_RETRY_DELAYS_MS.length) attempt(i + 1);
        });
    }, REPORT_RETRY_DELAYS_MS[i]);
  };
  attempt(0);
}

// ---------------------------------------------------------------------------
// GET /api/rides/:id/safety-report — rider, driver, the driver's fleet owner,
// or an admin. Lazily generates for completed streamed rides (covers server
// restarts that missed the completion hook).
// ---------------------------------------------------------------------------
rideSafetyRouter.get("/api/rides/:id/safety-report", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const { customerId, driverUserId } = await rideParticipantUserIds(ride);
    let allowed = session.userId === customerId || session.userId === driverUserId;
    if (!allowed) {
      const user = await storage.getUser(session.userId);
      if (user?.role === "admin") allowed = true;
      else if (ride.driverId) {
        const [drv] = await db
          .select({ fleetOwnerId: drivers.fleetOwnerId })
          .from(drivers)
          .where(eq(drivers.id, ride.driverId));
        if (drv?.fleetOwnerId && drv.fleetOwnerId === session.userId) allowed = true;
      }
    }
    if (!allowed) return res.status(403).json({ error: "Access denied" });

    const report = await generateSafetyReport(ride.id);
    if (!report) {
      // Distinguish "never streamed / not finished" (client stops asking)
      // from "streamed + completed, generation still settling" (client polls).
      let pending = false;
      if (ride.status === "completed") {
        const [anyStream] = await db
          .select({ id: ridePosts.id })
          .from(ridePosts)
          .where(and(
            eq(ridePosts.rideId, ride.id),
            eq(ridePosts.type, "stream"),
            eq(ridePosts.streamProvider, "agora"),
          ))
          .limit(1);
        pending = !!anyStream;
      }
      return res.json({ report: null, pending, events: [] });
    }
    const events = await db
      .select({
        id: rideSafetyEvents.id,
        kind: rideSafetyEvents.kind,
        severity: rideSafetyEvents.severity,
        postId: rideSafetyEvents.postId,
        streamOffsetSec: rideSafetyEvents.streamOffsetSec,
        note: rideSafetyEvents.note,
        createdAt: rideSafetyEvents.createdAt,
      })
      .from(rideSafetyEvents)
      .where(eq(rideSafetyEvents.rideId, ride.id))
      .orderBy(rideSafetyEvents.createdAt);
    res.json({ report, events });
  } catch (error: any) {
    console.error("[safety] report fetch error:", error?.message || error);
    res.status(500).json({ error: "Could not load safety report" });
  }
});

/** Fleet helper — recent safety reports for a set of driver ids, with their
 * flagged/bookmarked moments (postId + stream offset) for timeline review. */
export async function fleetSafetyReports(driverIds: string[] | null, limit = 20) {
  const conditions = [eq(rides.status, "completed")];
  if (driverIds) {
    if (driverIds.length === 0) return [];
    conditions.push(inArray(rides.driverId, driverIds));
  }
  const rows = await db
    .select({
      report: rideSafetyReports,
      rideId: rides.id,
      driverId: rides.driverId,
      completedAt: rides.completedAt,
    })
    .from(rideSafetyReports)
    .innerJoin(rides, eq(rides.id, rideSafetyReports.rideId))
    .where(and(...conditions))
    .orderBy(desc(rideSafetyReports.generatedAt))
    .limit(limit);
  if (rows.length === 0) return [];

  const rideIds = rows.map((r) => r.rideId);
  const events = await db
    .select({
      rideId: rideSafetyEvents.rideId,
      kind: rideSafetyEvents.kind,
      severity: rideSafetyEvents.severity,
      postId: rideSafetyEvents.postId,
      streamOffsetSec: rideSafetyEvents.streamOffsetSec,
      note: rideSafetyEvents.note,
    })
    .from(rideSafetyEvents)
    .where(inArray(rideSafetyEvents.rideId, rideIds));

  return rows.map((r) => ({
    ...r,
    moments: events.filter(
      (e) => e.rideId === r.rideId && (e.severity === "flag" || e.severity === "notice"),
    ),
  }));
}
