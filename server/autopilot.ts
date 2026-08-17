// ---------------------------------------------------------------------------
// Travony Autopilot — the autonomous operator agent.
//
// Perceive -> decide -> act -> learn, on a guarded interval.
// Every action is:
//   - deterministic (no LLM decides anything; messages are templates fed by
//     real engine output — fares/yields only ever come from those engines)
//   - bounded (per-play cooldowns, per-cycle caps, per-user daily caps via
//     the notification service)
//   - recorded (autopilot_actions row with a sanitized public summary)
//   - measured (outcome sweep marks hit/miss; low-hit plays auto-throttle)
// ---------------------------------------------------------------------------

import { db } from "./db";
import { and, eq, gte, inArray, isNull, lt, sql as dsql } from "drizzle-orm";
import {
  users,
  drivers,
  rides,
  autopilotActions,
  autopilotPlayStats,
} from "@shared/schema";
import { notifyUser } from "./notificationService";
import { getGoHereNext } from "./openClawService";
import { queueEmail } from "./email";

const CYCLE_MS = 5 * 60 * 1000;
const ACTIVE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"] as const;

// Play tuning — cooldowns are per target user, caps are per cycle.
const PLAYS = {
  idle_driver_position: { cooldownH: 4, cap: 8, resolveH: 3 },
  driver_onboarding_nudge: { cooldownH: 72, cap: 10, resolveH: 72, maxNudges: 3 },
  quiet_rider_reengage: { cooldownH: 24 * 30, cap: 5, resolveH: 24 * 7 },
  rider_pending_reassure: { cooldownH: 1, cap: 20, resolveH: 1 },
  daily_report: { cooldownH: 20, cap: 1, resolveH: 0 },
} as const;

type PlayName = keyof typeof PLAYS;

let running = false;
let paused = false;
let timer: ReturnType<typeof setInterval> | null = null;
let lastCycleAt: Date | null = null;
let lastCycleSummary: Record<string, number> = {};

export function isAutopilotPaused() {
  return paused;
}
export function setAutopilotPaused(value: boolean) {
  paused = value;
}
export function autopilotStatus() {
  return { paused, lastCycleAt, lastCycleSummary };
}

// --- helpers ---------------------------------------------------------------

async function recentTargets(play: PlayName, since: Date): Promise<Set<string>> {
  const rows = await db
    .select({ targetUserId: autopilotActions.targetUserId })
    .from(autopilotActions)
    .where(and(eq(autopilotActions.play, play), gte(autopilotActions.createdAt, since)));
  return new Set(rows.map((r) => r.targetUserId).filter(Boolean) as string[]);
}

async function throttleMultiplier(play: PlayName): Promise<number> {
  const [row] = await db
    .select()
    .from(autopilotPlayStats)
    .where(eq(autopilotPlayStats.play, play));
  if (!row || !row.enabled) return row && !row.enabled ? Infinity : 1;
  const resolved = row.hits + row.misses;
  if (resolved >= 20 && row.hits / resolved < 0.05) return 2; // learn: back off
  return 1;
}

async function recordAction(opts: {
  play: PlayName;
  targetUserId?: string;
  publicSummary: string;
  detail?: Record<string, unknown>;
  notificationId?: string;
}) {
  await db.insert(autopilotActions).values({
    play: opts.play,
    targetUserId: opts.targetUserId ?? null,
    publicSummary: opts.publicSummary,
    detail: opts.detail ?? null,
    notificationId: opts.notificationId ?? null,
  });
  await db
    .insert(autopilotPlayStats)
    .values({ play: opts.play, lastRunAt: new Date() })
    .onConflictDoUpdate({
      target: autopilotPlayStats.play,
      set: { lastRunAt: new Date(), updatedAt: new Date() },
    });
}

function hoursAgo(h: number): Date {
  return new Date(Date.now() - h * 3_600_000);
}

// --- plays -----------------------------------------------------------------

/** Idle approved online drivers get a real, engine-backed "go here next" nudge. */
async function playIdleDriverPosition(): Promise<number> {
  const cfg = PLAYS.idle_driver_position;
  const mult = await throttleMultiplier("idle_driver_position");
  if (mult === Infinity) return 0;

  const online = await db
    .select({
      driverId: drivers.id,
      userId: drivers.userId,
      lat: drivers.currentLat,
      lng: drivers.currentLng,
    })
    .from(drivers)
    .where(and(eq(drivers.status, "approved"), eq(drivers.isOnline, true)))
    .limit(50);
  if (online.length === 0) return 0;

  const activeRides = await db
    .select({ driverId: rides.driverId })
    .from(rides)
    .where(inArray(rides.status, [...ACTIVE_RIDE_STATUSES]));
  const busy = new Set(activeRides.map((r) => r.driverId).filter(Boolean));
  const cooled = await recentTargets("idle_driver_position", hoursAgo(cfg.cooldownH * mult));

  let sent = 0;
  for (const d of online) {
    if (sent >= cfg.cap) break;
    if (busy.has(d.driverId) || cooled.has(d.userId)) continue;
    const lat = d.lat ? parseFloat(d.lat) : NaN;
    const lng = d.lng ? parseFloat(d.lng) : NaN;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    try {
      const { recommendation } = await getGoHereNext(d.driverId, lat, lng);
      if (!recommendation) continue;
      if (recommendation.distanceKm > 15) continue; // don't send drivers across the city

      const res = await notifyUser({
        userId: d.userId,
        kind: "autopilot_position",
        title: `Go here next: ${recommendation.title}`,
        body: recommendation.reason,
        data: {
          play: "idle_driver_position",
          lat: recommendation.lat,
          lng: recommendation.lng,
          kind: recommendation.kind,
        },
        urgency: "normal",
        dedupeKey: `pos:${recommendation.hubId ?? recommendation.title}`,
        dedupeWindowHours: cfg.cooldownH,
      });
      if (!res.delivered) continue;

      await recordAction({
        play: "idle_driver_position",
        targetUserId: d.userId,
        publicSummary: `Pointed an idle driver at ${recommendation.title} (${recommendation.demandLevel} demand, ~${recommendation.etaMinutes} min away)`,
        detail: { driverId: d.driverId, hubId: recommendation.hubId, demandLevel: recommendation.demandLevel },
        notificationId: res.notificationId,
      });
      sent++;
    } catch (err: any) {
      console.error(`[autopilot] position play failed for driver ${d.driverId}: ${err.message}`);
    }
  }
  return sent;
}

/** Drivers stuck in pending onboarding for 24h+ get up to 3 gentle nudges. */
async function playDriverOnboardingNudge(): Promise<number> {
  const cfg = PLAYS.driver_onboarding_nudge;
  const mult = await throttleMultiplier("driver_onboarding_nudge");
  if (mult === Infinity) return 0;

  const stalled = await db
    .select({ driverId: drivers.id, userId: drivers.userId, createdAt: drivers.createdAt })
    .from(drivers)
    .where(
      and(
        eq(drivers.status, "pending"),
        lt(drivers.createdAt, hoursAgo(24)),
        gte(drivers.createdAt, hoursAgo(24 * 30)),
      ),
    )
    .limit(40);
  if (stalled.length === 0) return 0;

  const cooled = await recentTargets("driver_onboarding_nudge", hoursAgo(cfg.cooldownH * mult));

  // Lifetime nudge counts for these targets.
  const targetIds = stalled.map((s) => s.userId);
  const counts = await db
    .select({
      targetUserId: autopilotActions.targetUserId,
      count: dsql<number>`count(*)::int`,
    })
    .from(autopilotActions)
    .where(
      and(
        eq(autopilotActions.play, "driver_onboarding_nudge"),
        inArray(autopilotActions.targetUserId, targetIds),
      ),
    )
    .groupBy(autopilotActions.targetUserId);
  const nudgeCount = new Map(counts.map((c) => [c.targetUserId, c.count]));

  let sent = 0;
  for (const s of stalled) {
    if (sent >= cfg.cap) break;
    if (cooled.has(s.userId)) continue;
    if ((nudgeCount.get(s.userId) ?? 0) >= cfg.maxNudges) continue;

    const res = await notifyUser({
      userId: s.userId,
      kind: "autopilot_onboarding",
      title: "Your driver application is almost there",
      body: "Finish your profile — add your vehicle photos and documents — and you can start receiving ride requests as soon as you're approved.",
      data: { play: "driver_onboarding_nudge" },
      urgency: "normal",
      dedupeKey: "onboarding-nudge",
      dedupeWindowHours: cfg.cooldownH,
    });
    if (!res.delivered) continue;

    await recordAction({
      play: "driver_onboarding_nudge",
      targetUserId: s.userId,
      publicSummary: "Nudged a driver whose application stalled mid-way",
      detail: { driverId: s.driverId },
      notificationId: res.notificationId,
    });
    sent++;
  }
  return sent;
}

/** Riders whose last completed ride is 14-90 days old get one gentle hello a month. */
async function playQuietRiderReengage(): Promise<number> {
  const cfg = PLAYS.quiet_rider_reengage;
  const mult = await throttleMultiplier("quiet_rider_reengage");
  if (mult === Infinity) return 0;

  const lapsed = await db
    .select({
      customerId: rides.customerId,
      lastRide: dsql<string>`max(${rides.createdAt})`,
    })
    .from(rides)
    .where(eq(rides.status, "completed"))
    .groupBy(rides.customerId)
    .having(
      and(
        dsql`max(${rides.createdAt}) < now() - interval '14 days'`,
        dsql`max(${rides.createdAt}) > now() - interval '90 days'`,
      ),
    )
    .limit(25);
  if (lapsed.length === 0) return 0;

  const cooled = await recentTargets("quiet_rider_reengage", hoursAgo(cfg.cooldownH * mult));

  let sent = 0;
  for (const r of lapsed) {
    if (sent >= cfg.cap) break;
    if (cooled.has(r.customerId)) continue;

    const res = await notifyUser({
      userId: r.customerId,
      kind: "autopilot_reengage",
      title: "Your next ride is one tap away",
      body: "It's been a while — drivers are online near you right now. Open Travony whenever you need a car.",
      data: { play: "quiet_rider_reengage" },
      urgency: "low",
      dedupeKey: "reengage",
      dedupeWindowHours: cfg.cooldownH,
    });
    if (!res.delivered) continue;

    await recordAction({
      play: "quiet_rider_reengage",
      targetUserId: r.customerId,
      publicSummary: "Checked in with a rider we hadn't seen in a while",
      notificationId: res.notificationId,
    });
    sent++;
  }
  return sent;
}

/** Riders whose ride has been pending 5-20 minutes get one honest reassurance. */
async function playRiderPendingReassure(): Promise<number> {
  const cfg = PLAYS.rider_pending_reassure;

  const stuck = await db
    .select({ id: rides.id, customerId: rides.customerId })
    .from(rides)
    .where(
      and(
        eq(rides.status, "pending"),
        lt(rides.createdAt, new Date(Date.now() - 5 * 60_000)),
        gte(rides.createdAt, new Date(Date.now() - 20 * 60_000)),
      ),
    )
    .limit(cfg.cap);

  let sent = 0;
  for (const ride of stuck) {
    const res = await notifyUser({
      userId: ride.customerId,
      kind: "autopilot_ride_update",
      title: "Still finding your driver",
      body: "We're still matching your ride with nearby drivers. Hang tight — you can cancel anytime at no cost.",
      data: { play: "rider_pending_reassure", rideId: ride.id },
      urgency: "normal",
      dedupeKey: `pending:${ride.id}`,
      dedupeWindowHours: 24,
    });
    if (!res.delivered) continue;

    await recordAction({
      play: "rider_pending_reassure",
      targetUserId: ride.customerId,
      publicSummary: "Kept a rider informed while their ride was matching",
      detail: { rideId: ride.id },
      notificationId: res.notificationId,
    });
    sent++;
  }
  return sent;
}

/** Once a day (21:00 Dubai): the Autopilot writes its own report and tells the admins. */
async function playDailyReport(): Promise<number> {
  const dubaiHour = (new Date().getUTCHours() + 4) % 24;
  if (dubaiHour !== 21) return 0;

  const [already] = await db
    .select({ id: autopilotActions.id })
    .from(autopilotActions)
    .where(
      and(
        eq(autopilotActions.play, "daily_report"),
        gte(autopilotActions.createdAt, hoursAgo(20)),
      ),
    )
    .limit(1);
  if (already) return 0;

  const dayStart = hoursAgo(24);
  const [rideStats] = await db
    .select({
      total: dsql<number>`count(*)::int`,
      completed: dsql<number>`count(*) filter (where ${rides.status} = 'completed')::int`,
      cancelled: dsql<number>`count(*) filter (where ${rides.status} = 'cancelled')::int`,
    })
    .from(rides)
    .where(gte(rides.createdAt, dayStart));
  const [{ newUsers }] = await db
    .select({ newUsers: dsql<number>`count(*)::int` })
    .from(users)
    .where(gte(users.createdAt, dayStart));
  const [{ onlineDrivers }] = await db
    .select({ onlineDrivers: dsql<number>`count(*)::int` })
    .from(drivers)
    .where(and(eq(drivers.status, "approved"), eq(drivers.isOnline, true)));
  const actionRows = await db
    .select({ play: autopilotActions.play, count: dsql<number>`count(*)::int` })
    .from(autopilotActions)
    .where(gte(autopilotActions.createdAt, dayStart))
    .groupBy(autopilotActions.play);
  const statRows = await db.select().from(autopilotPlayStats);

  const actionsLine =
    actionRows.map((a) => `${a.play.replace(/_/g, " ")}: ${a.count}`).join(", ") || "none";
  const hitLine =
    statRows
      .filter((s) => s.hits + s.misses > 0)
      .map((s) => `${s.play.replace(/_/g, " ")}: ${Math.round((s.hits / (s.hits + s.misses)) * 100)}%`)
      .join(", ") || "no resolved outcomes yet";

  const summary = `Last 24h — rides: ${rideStats.total} (${rideStats.completed} completed, ${rideStats.cancelled} cancelled), new users: ${newUsers}, drivers online now: ${onlineDrivers}. Autopilot actions: ${actionsLine}. Hit rates: ${hitLine}.`;

  await recordAction({
    play: "daily_report",
    publicSummary: `Daily report — ${summary}`,
    detail: { rideStats, newUsers, onlineDrivers, actions: actionRows },
  });

  const admins = await db.select().from(users).where(eq(users.role, "admin")).limit(5);
  for (const admin of admins) {
    await notifyUser({
      userId: admin.id,
      kind: "autopilot_report",
      title: "Autopilot daily report",
      body: summary,
      urgency: "normal",
      dedupeKey: "daily-report",
      dedupeWindowHours: 20,
    });
    if (admin.email && admin.email.includes("@")) {
      queueEmail(
        admin.email,
        "Travony Autopilot — daily report",
        `<div style="font-family:sans-serif"><h3>Autopilot daily report</h3><p>${summary}</p></div>`,
        summary,
      );
    }
  }
  return 1;
}

// --- learning sweep ---------------------------------------------------------

async function resolveOutcomes(): Promise<void> {
  const pending = await db
    .select()
    .from(autopilotActions)
    .where(and(isNull(autopilotActions.outcome), lt(autopilotActions.createdAt, hoursAgo(0))))
    .orderBy(autopilotActions.createdAt)
    .limit(200);

  for (const action of pending) {
    const cfg = PLAYS[action.play as PlayName];
    if (!cfg) continue;
    if (cfg.resolveH === 0) {
      await setOutcome(action.id, action.play, "n/a");
      continue;
    }
    const deadline = new Date(action.createdAt.getTime() + cfg.resolveH * 3_600_000);
    if (new Date() < deadline) continue; // window still open

    const detail = (action.detail ?? {}) as Record<string, unknown>;
    let hit = false;
    try {
      if (action.play === "idle_driver_position" && detail.driverId) {
        const [r] = await db
          .select({ id: rides.id })
          .from(rides)
          .where(
            and(
              eq(rides.driverId, String(detail.driverId)),
              gte(rides.acceptedAt, action.createdAt),
              lt(rides.acceptedAt, deadline),
            ),
          )
          .limit(1);
        hit = !!r;
      } else if (action.play === "driver_onboarding_nudge" && action.targetUserId) {
        const [d] = await db
          .select({ status: drivers.status, updatedAt: drivers.updatedAt })
          .from(drivers)
          .where(eq(drivers.userId, action.targetUserId));
        hit = !!d && (d.status !== "pending" || (d.updatedAt !== null && d.updatedAt > action.createdAt));
      } else if (action.play === "quiet_rider_reengage" && action.targetUserId) {
        const [r] = await db
          .select({ id: rides.id })
          .from(rides)
          .where(
            and(
              eq(rides.customerId, action.targetUserId),
              gte(rides.createdAt, action.createdAt),
              lt(rides.createdAt, deadline),
            ),
          )
          .limit(1);
        hit = !!r;
      } else if (action.play === "rider_pending_reassure" && detail.rideId) {
        const [r] = await db
          .select({ status: rides.status })
          .from(rides)
          .where(eq(rides.id, String(detail.rideId)));
        hit = !!r && r.status !== "cancelled" && r.status !== "pending";
      }
      await setOutcome(action.id, action.play, hit ? "hit" : "miss");
    } catch (err: any) {
      console.error(`[autopilot] outcome resolution failed for ${action.id}: ${err.message}`);
    }
  }
}

async function setOutcome(actionId: string, play: string, outcome: "hit" | "miss" | "n/a") {
  // Atomic claim: only the instance that flips outcome from NULL updates the
  // stats, so concurrent sweeps can never double-count an action.
  const claimed = await db
    .update(autopilotActions)
    .set({ outcome, outcomeAt: new Date() })
    .where(and(eq(autopilotActions.id, actionId), isNull(autopilotActions.outcome)))
    .returning({ id: autopilotActions.id });
  if (claimed.length === 0) return;
  if (outcome === "n/a") return;
  await db
    .insert(autopilotPlayStats)
    .values({
      play,
      attempts: 1,
      hits: outcome === "hit" ? 1 : 0,
      misses: outcome === "miss" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: autopilotPlayStats.play,
      set: {
        attempts: dsql`${autopilotPlayStats.attempts} + 1`,
        hits: dsql`${autopilotPlayStats.hits} + ${outcome === "hit" ? 1 : 0}`,
        misses: dsql`${autopilotPlayStats.misses} + ${outcome === "miss" ? 1 : 0}`,
        updatedAt: new Date(),
      },
    });
}

// --- engine ------------------------------------------------------------------

// Cross-instance guard: only one server instance may run a cycle at a time.
// Postgres advisory lock keyed on an arbitrary constant for this engine.
const AUTOPILOT_LOCK_KEY = 894217304;

async function cycle(): Promise<void> {
  if (running || paused) return;
  running = true;
  let locked = false;
  try {
    const lockRes: any = await db.execute(
      dsql`select pg_try_advisory_lock(${AUTOPILOT_LOCK_KEY}) as locked`,
    );
    locked = lockRes.rows?.[0]?.locked === true;
    if (!locked) return; // another instance is running this cycle
    const summary: Record<string, number> = {};
    summary.rider_pending_reassure = await playRiderPendingReassure();
    summary.idle_driver_position = await playIdleDriverPosition();
    summary.driver_onboarding_nudge = await playDriverOnboardingNudge();
    summary.quiet_rider_reengage = await playQuietRiderReengage();
    summary.daily_report = await playDailyReport();
    await resolveOutcomes();
    lastCycleAt = new Date();
    lastCycleSummary = summary;
    const acted = Object.values(summary).reduce((a, b) => a + b, 0);
    if (acted > 0) console.log(`[autopilot] cycle done:`, JSON.stringify(summary));
  } catch (err: any) {
    console.error(`[autopilot] cycle failed: ${err.message}`);
  } finally {
    if (locked) {
      try {
        await db.execute(dsql`select pg_advisory_unlock(${AUTOPILOT_LOCK_KEY})`);
      } catch (err: any) {
        console.error(`[autopilot] failed to release lock: ${err.message}`);
      }
    }
    running = false;
  }
}

export function startAutopilotEngine(): void {
  if (timer) return;
  if (process.env.AUTOPILOT_ENABLED === "false") {
    console.log("[autopilot] disabled via AUTOPILOT_ENABLED=false");
    return;
  }
  // First cycle after 90s so boot isn't slowed and other engines are up.
  setTimeout(() => cycle().catch(console.error), 90_000);
  timer = setInterval(() => cycle().catch(console.error), CYCLE_MS);
  console.log("[autopilot] engine started (5-minute cycles)");
}
