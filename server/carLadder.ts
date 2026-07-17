import { db } from "./db";
import {
  ladderVehicles,
  ladderGoals,
  ladderAccruals,
  ladderSettings,
  prayerRideDispatches,
  drivers,
  users,
  rides,
  type LadderVehicle,
  type LadderGoal,
  type LadderSettings,
  type Ride,
} from "@shared/schema";
import { and, eq, desc, gte, inArray, sql } from "drizzle-orm";
import { sendHrsPayout, getPlatformAddress } from "./hrsToken";

// ===================== The Car Ladder engine =====================
// Fully deterministic server-side engine. The LLM never chooses vehicles or
// amounts — it only phrases the sentence around numbers computed here.
// Accrual is idempotent per ride (UNIQUE on ladder_accruals.ride_id) and only
// runs from the authorized, persisted completion transition in routes.ts.

// Statuses that count as "climbing" (an open goal). A driver has at most one.
const OPEN_STATUSES = ["active", "qualified", "claimed"] as const;

// ---------- Settings ----------

export async function getLadderSettings(): Promise<LadderSettings> {
  const [row] = await db.select().from(ladderSettings).where(eq(ladderSettings.id, "global")).limit(1);
  if (row) return row;
  const [created] = await db
    .insert(ladderSettings)
    .values({ id: "global" })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await db.select().from(ladderSettings).where(eq(ladderSettings.id, "global")).limit(1);
  return again;
}

export async function updateLadderSettings(patch: {
  savePercent?: number;
  unitsPerCurrency?: number;
  accrualPaused?: boolean;
}): Promise<LadderSettings> {
  await getLadderSettings();
  const set: Record<string, any> = { updatedAt: new Date() };
  if (patch.savePercent !== undefined && isFinite(patch.savePercent) && patch.savePercent >= 0 && patch.savePercent <= 20) {
    set.savePercent = patch.savePercent.toFixed(2);
  }
  if (patch.unitsPerCurrency !== undefined && isFinite(patch.unitsPerCurrency) && patch.unitsPerCurrency > 0) {
    set.unitsPerCurrency = patch.unitsPerCurrency.toFixed(6);
  }
  if (patch.accrualPaused !== undefined) {
    set.accrualPaused = !!patch.accrualPaused;
  }
  const [row] = await db.update(ladderSettings).set(set).where(eq(ladderSettings.id, "global")).returning();
  return row;
}

// ---------- Catalog ----------

// Country prefix from a region code: "AE-DU" -> "AE", "BD" -> "BD".
function countryPrefix(regionCode: string | null | undefined): string {
  return String(regionCode || "AE").split("-")[0].toUpperCase();
}

// Seed a sensible default catalog once per region family so the ladder works
// out of the box. Admins can edit rows afterwards; we never re-seed a region
// that already has rows.
const DEFAULT_CATALOG: Record<string, Array<Omit<typeof ladderVehicles.$inferInsert, "regionCode">>> = {
  AE: [
    { name: "Toyota Corolla", vehicleKind: "car", tier: 1, priceLocal: "78000.00", currency: "AED", goalUnits: "7800", ridesRequired: 400, minRating: "4.60", minWeeksActive: 12, sortOrder: 1 },
    { name: "Toyota Camry", vehicleKind: "car", tier: 2, priceLocal: "115000.00", currency: "AED", goalUnits: "11500", ridesRequired: 900, minRating: "4.70", minWeeksActive: 26, sortOrder: 2 },
    { name: "Lexus ES", vehicleKind: "car", tier: 3, priceLocal: "190000.00", currency: "AED", goalUnits: "19000", ridesRequired: 1800, minRating: "4.80", minWeeksActive: 52, sortOrder: 3 },
  ],
  SA: [
    { name: "Hyundai Elantra", vehicleKind: "car", tier: 1, priceLocal: "75000.00", currency: "USD", goalUnits: "7500", ridesRequired: 400, minRating: "4.60", minWeeksActive: 12, sortOrder: 1 },
    { name: "Toyota Camry", vehicleKind: "car", tier: 2, priceLocal: "120000.00", currency: "USD", goalUnits: "12000", ridesRequired: 900, minRating: "4.70", minWeeksActive: 26, sortOrder: 2 },
  ],
  BD: [
    { name: "TVS Metro Motorbike", vehicleKind: "motorbike", tier: 1, priceLocal: "125000.00", currency: "BDT", goalUnits: "12500", ridesRequired: 300, minRating: "4.50", minWeeksActive: 8, sortOrder: 1 },
    { name: "Bajaj RE Tuktuk", vehicleKind: "tuktuk", tier: 2, priceLocal: "480000.00", currency: "BDT", goalUnits: "48000", ridesRequired: 700, minRating: "4.60", minWeeksActive: 20, sortOrder: 2 },
    { name: "Suzuki Every Minivan", vehicleKind: "car", tier: 3, priceLocal: "1450000.00", currency: "BDT", goalUnits: "145000", ridesRequired: 1500, minRating: "4.70", minWeeksActive: 44, sortOrder: 3 },
  ],
};

let catalogSeeded = false;

async function ensureCatalog(): Promise<void> {
  if (catalogSeeded) return;
  for (const [region, rows] of Object.entries(DEFAULT_CATALOG)) {
    const existing = await db
      .select({ id: ladderVehicles.id })
      .from(ladderVehicles)
      .where(eq(ladderVehicles.regionCode, region))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(ladderVehicles).values(rows.map((r) => ({ ...r, regionCode: region })));
    }
  }
  catalogSeeded = true;
}

async function getRegionCatalog(regionCode: string | null | undefined): Promise<LadderVehicle[]> {
  await ensureCatalog();
  const prefix = countryPrefix(regionCode);
  let rows = await db
    .select()
    .from(ladderVehicles)
    .where(and(eq(ladderVehicles.regionCode, prefix), eq(ladderVehicles.isActive, true)))
    .orderBy(ladderVehicles.tier, ladderVehicles.sortOrder);
  if (rows.length === 0) {
    // Regions without a local catalog fall back to the AE rungs so the
    // mechanic still works everywhere.
    rows = await db
      .select()
      .from(ladderVehicles)
      .where(and(eq(ladderVehicles.regionCode, "AE"), eq(ladderVehicles.isActive, true)))
      .orderBy(ladderVehicles.tier, ladderVehicles.sortOrder);
  }
  return rows;
}

// ---------- Target selection (deterministic) ----------

// Units accrued by this driver in the last 28 days — the "pace" signal.
async function recentPaceUnitsPerWeek(driverId: string): Promise<number> {
  const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000);
  const [row] = await db
    .select({ total: sql<string>`COALESCE(SUM(${ladderAccruals.unitsAccrued}), '0')` })
    .from(ladderAccruals)
    .where(and(eq(ladderAccruals.driverId, driverId), gte(ladderAccruals.createdAt, since)));
  return parseFloat(row?.total || "0") / 4;
}

// Pick the driver's realistic next rung: the highest tier whose remaining goal
// is reachable within ~78 weeks at the current pace; with no pace signal yet,
// start at the lowest rung. Never picks a rung at/below an already-fulfilled tier.
function selectTarget(
  catalog: LadderVehicle[],
  paceUnitsPerWeek: number,
  minTierExclusive: number,
): LadderVehicle | null {
  const eligible = catalog.filter((v) => v.tier > minTierExclusive);
  if (eligible.length === 0) return null;
  if (paceUnitsPerWeek <= 0) return eligible[0];
  const HORIZON_WEEKS = 78;
  let best = eligible[0];
  for (const v of eligible) {
    const weeks = parseFloat(v.goalUnits) / paceUnitsPerWeek;
    if (weeks <= HORIZON_WEEKS && v.tier > best.tier) best = v;
  }
  return best;
}

// Highest tier this driver has already fulfilled (so the ladder resets upward).
async function highestFulfilledTier(driverId: string): Promise<number> {
  const rows = await db
    .select({ tier: ladderVehicles.tier })
    .from(ladderGoals)
    .innerJoin(ladderVehicles, eq(ladderVehicles.id, ladderGoals.targetVehicleId))
    .where(and(eq(ladderGoals.driverId, driverId), eq(ladderGoals.status, "fulfilled")));
  return rows.reduce((m, r) => Math.max(m, r.tier), 0);
}

async function getOpenGoal(driverId: string): Promise<LadderGoal | null> {
  const [goal] = await db
    .select()
    .from(ladderGoals)
    .where(and(eq(ladderGoals.driverId, driverId), inArray(ladderGoals.status, OPEN_STATUSES as any)))
    .orderBy(desc(ladderGoals.startedAt))
    .limit(1);
  return goal || null;
}

async function getOrCreateGoal(driverId: string, regionCode: string | null | undefined): Promise<LadderGoal | null> {
  const existing = await getOpenGoal(driverId);
  if (existing) return existing;
  const catalog = await getRegionCatalog(regionCode);
  const pace = await recentPaceUnitsPerWeek(driverId);
  const doneTier = await highestFulfilledTier(driverId);
  const target = selectTarget(catalog, pace, doneTier);
  if (!target) return null;
  const [goal] = await db
    .insert(ladderGoals)
    .values({ driverId, targetVehicleId: target.id })
    .returning();
  return goal;
}

// ---------- Qualification ----------

async function evaluateQualification(goal: LadderGoal, target: LadderVehicle): Promise<LadderGoal> {
  if (goal.status !== "active") return goal;
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, goal.driverId)).limit(1);
  if (!driver || driver.status !== "approved") return goal;

  const unitsOk = parseFloat(goal.unitsSaved) >= parseFloat(target.goalUnits);
  const ridesOk = (driver.totalTrips || 0) >= target.ridesRequired;
  const ratingOk = parseFloat(driver.rating || "5") >= parseFloat(target.minRating || "0");
  const weeksActive = (Date.now() - new Date(driver.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000);
  const tenureOk = weeksActive >= target.minWeeksActive;

  if (unitsOk && ridesOk && ratingOk && tenureOk) {
    const [updated] = await db
      .update(ladderGoals)
      .set({ status: "qualified", qualifiedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(ladderGoals.id, goal.id), eq(ladderGoals.status, "active")))
      .returning();
    return updated || goal;
  }
  return goal;
}

// ---------- Accrual (called ONLY from the persisted completion transition) ----------

export async function accrueLadderForRide(ride: Ride, driverEarnings: number): Promise<void> {
  try {
    if (!ride.driverId || !isFinite(driverEarnings) || driverEarnings <= 0) return;

    const settings = await getLadderSettings();
    if (settings.accrualPaused) return;

    // Prayer rides are 100% free volunteer rides — never part of the ladder.
    const [prayer] = await db
      .select({ id: prayerRideDispatches.id })
      .from(prayerRideDispatches)
      .where(eq(prayerRideDispatches.rideId, ride.id))
      .limit(1);
    if (prayer) return;

    // Only approved drivers climb (same gate as ride acceptance).
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, ride.driverId)).limit(1);
    if (!driver || driver.status !== "approved") return;

    const goal = await getOrCreateGoal(ride.driverId, ride.regionCode);
    if (!goal || goal.status !== "active") return;

    const savePercent = parseFloat(settings.savePercent);
    const units = driverEarnings * (savePercent / 100) * parseFloat(settings.unitsPerCurrency);
    if (units <= 0) return;

    // Idempotency: UNIQUE(ride_id). If this ride already accrued, do nothing.
    const inserted = await db
      .insert(ladderAccruals)
      .values({
        goalId: goal.id,
        driverId: ride.driverId,
        rideId: ride.id,
        earningsAmount: driverEarnings.toFixed(2),
        earningsCurrency: (ride.currency || "AED") as any,
        savePercent: savePercent.toFixed(2),
        unitsAccrued: units.toFixed(6),
      })
      .onConflictDoNothing({ target: ladderAccruals.rideId })
      .returning();
    if (inserted.length === 0) return;

    const [updatedGoal] = await db
      .update(ladderGoals)
      .set({
        unitsSaved: sql`${ladderGoals.unitsSaved} + ${units.toFixed(6)}`,
        ridesCounted: sql`${ladderGoals.ridesCounted} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(ladderGoals.id, goal.id))
      .returning();

    const [target] = await db.select().from(ladderVehicles).where(eq(ladderVehicles.id, goal.targetVehicleId)).limit(1);
    if (updatedGoal && target) await evaluateQualification(updatedGoal, target);
  } catch (err) {
    console.error("[CarLadder] accrual error (ride", ride.id, "):", err);
  }
}

// ---------- Status payload (drives the ring + Car Agent sentence) ----------

export interface LadderStatus {
  hasGoal: boolean;
  saveRatePercent: number;
  status: string | null;
  target: {
    id: string;
    name: string;
    vehicleKind: string;
    tier: number;
    priceLocal: number;
    currency: string;
  } | null;
  progressPercent: number; // 0-100, credit progress toward the goal
  ridesCounted: number;
  paceWeeksRemaining: number | null; // null when there's no pace signal yet
  qualified: boolean;
  claimed: boolean;
  alternatives: Array<{ id: string; name: string; vehicleKind: string; tier: number; priceLocal: number; currency: string; progressPercentIfChosen: number }>;
  recentContributions: Array<{ rideId: string; percentGained: number; date: string }>;
}

export async function getLadderStatus(driverId: string, regionCode: string | null | undefined): Promise<LadderStatus> {
  const settings = await getLadderSettings();
  const goal = await getOrCreateGoal(driverId, regionCode);
  const empty: LadderStatus = {
    hasGoal: false,
    saveRatePercent: parseFloat(settings.savePercent),
    status: null,
    target: null,
    progressPercent: 0,
    ridesCounted: 0,
    paceWeeksRemaining: null,
    qualified: false,
    claimed: false,
    alternatives: [],
    recentContributions: [],
  };
  if (!goal) return empty;

  const [target] = await db.select().from(ladderVehicles).where(eq(ladderVehicles.id, goal.targetVehicleId)).limit(1);
  if (!target) return empty;

  const saved = parseFloat(goal.unitsSaved);
  const goalUnits = parseFloat(target.goalUnits);
  const progressPercent = goalUnits > 0 ? Math.min(100, Math.round((saved / goalUnits) * 1000) / 10) : 0;

  const pace = await recentPaceUnitsPerWeek(driverId);
  const remainingUnits = Math.max(0, goalUnits - saved);
  const paceWeeksRemaining = pace > 0 && remainingUnits > 0 ? Math.max(1, Math.ceil(remainingUnits / pace)) : remainingUnits === 0 ? 0 : null;

  const catalog = await getRegionCatalog(regionCode);
  const alternatives = catalog
    .filter((v) => v.id !== target.id)
    .slice(0, 4)
    .map((v) => ({
      id: v.id,
      name: v.name,
      vehicleKind: v.vehicleKind,
      tier: v.tier,
      priceLocal: parseFloat(v.priceLocal),
      currency: v.currency,
      progressPercentIfChosen:
        parseFloat(v.goalUnits) > 0 ? Math.min(100, Math.round((saved / parseFloat(v.goalUnits)) * 1000) / 10) : 0,
    }));

  const accruals = await db
    .select()
    .from(ladderAccruals)
    .where(eq(ladderAccruals.goalId, goal.id))
    .orderBy(desc(ladderAccruals.createdAt))
    .limit(10);

  return {
    hasGoal: true,
    saveRatePercent: parseFloat(settings.savePercent),
    status: goal.status,
    target: {
      id: target.id,
      name: target.name,
      vehicleKind: target.vehicleKind,
      tier: target.tier,
      priceLocal: parseFloat(target.priceLocal),
      currency: target.currency,
    },
    progressPercent,
    ridesCounted: goal.ridesCounted,
    paceWeeksRemaining,
    qualified: goal.status === "qualified",
    claimed: goal.status === "claimed",
    alternatives,
    recentContributions: accruals.map((a) => ({
      rideId: a.rideId,
      percentGained: goalUnits > 0 ? Math.round((parseFloat(a.unitsAccrued) / goalUnits) * 1000) / 10 : 0,
      date: a.createdAt.toISOString(),
    })),
  };
}

// ---------- Target change / claim / fulfil ----------

export async function changeTarget(driverId: string, vehicleId: string, regionCode: string | null | undefined): Promise<{ ok: boolean; error?: string }> {
  const goal = await getOpenGoal(driverId);
  if (!goal) return { ok: false, error: "No active goal" };
  if (goal.status !== "active") return { ok: false, error: "Target is locked once you qualify" };
  const catalog = await getRegionCatalog(regionCode);
  const target = catalog.find((v) => v.id === vehicleId);
  if (!target) return { ok: false, error: "That vehicle is not available in your region" };
  await db
    .update(ladderGoals)
    .set({ targetVehicleId: target.id, updatedAt: new Date() })
    .where(and(eq(ladderGoals.id, goal.id), eq(ladderGoals.status, "active")));
  return { ok: true };
}

export async function claimGoal(driverId: string): Promise<{
  ok: boolean;
  error?: string;
  txHash?: string;
  explorerUrl?: string;
  hrsAmount?: number;
  ethAddress?: string | null;
}> {
  const goal = await getOpenGoal(driverId);
  if (!goal) return { ok: false, error: "No active goal" };
  if (goal.status !== "qualified") return { ok: false, error: "Not qualified yet" };

  const hrsAmount = parseFloat(goal.unitsSaved);
  let txHash: string | undefined;
  let explorerUrl: string | undefined;
  let payoutAddress: string | null = null;

  // Attempt on-chain HRS payout if platform wallet is configured
  if (getPlatformAddress() && hrsAmount > 0) {
    try {
      // Look up driver's linked ETH wallet
      const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
      if (driver?.userId) {
        const [user] = await db.select().from(users).where(eq(users.id, driver.userId)).limit(1);
        payoutAddress = (user as any)?.ethWalletAddress || null;
      }
      if (payoutAddress) {
        const payout = await sendHrsPayout(payoutAddress, hrsAmount);
        if (payout.success) {
          txHash = payout.txHash;
          explorerUrl = payout.explorerUrl;
          console.log(`[CarLadder] HRS payout: ${hrsAmount} HRS → ${payoutAddress} | tx: ${txHash}`);
        } else {
          console.warn(`[CarLadder] HRS payout failed for driver ${driverId}: ${payout.message}`);
        }
      }
    } catch (e: any) {
      console.warn("[CarLadder] HRS payout error:", e.message);
    }
  }

  const [updated] = await db
    .update(ladderGoals)
    .set({
      status: "claimed",
      claimedAt: new Date(),
      hrsPayoutTxHash: txHash || null,
      hrsPayoutAddress: payoutAddress || null,
      hrsPayoutAmount: hrsAmount.toFixed(6),
      updatedAt: new Date(),
    })
    .where(and(eq(ladderGoals.id, goal.id), eq(ladderGoals.status, "qualified")))
    .returning();

  if (!updated) return { ok: false, error: "Claim failed, try again" };
  return { ok: true, txHash, explorerUrl, hrsAmount, ethAddress: payoutAddress };
}

// Dealer list: every claimed goal with the driver's verified stats.
export async function listDealerClaims() {
  const rows = await db
    .select({
      goal: ladderGoals,
      vehicle: ladderVehicles,
      driver: drivers,
    })
    .from(ladderGoals)
    .innerJoin(ladderVehicles, eq(ladderVehicles.id, ladderGoals.targetVehicleId))
    .innerJoin(drivers, eq(drivers.id, ladderGoals.driverId))
    .where(inArray(ladderGoals.status, ["claimed", "fulfilled"] as any))
    .orderBy(desc(ladderGoals.claimedAt));

  return rows.map((r) => ({
    goalId: r.goal.id,
    status: r.goal.status,
    claimedAt: r.goal.claimedAt,
    fulfilledAt: r.goal.fulfilledAt,
    dealerNote: r.goal.dealerNote,
    vehicle: {
      name: r.vehicle.name,
      kind: r.vehicle.vehicleKind,
      tier: r.vehicle.tier,
      priceLocal: parseFloat(r.vehicle.priceLocal),
      currency: r.vehicle.currency,
      region: r.vehicle.regionCode,
    },
    goalBalanceUnits: parseFloat(r.goal.unitsSaved),
    hrsPayout: {
      amount: r.goal.hrsPayoutAmount ? parseFloat(r.goal.hrsPayoutAmount) : null,
      toAddress: r.goal.hrsPayoutAddress || null,
      txHash: r.goal.hrsPayoutTxHash || null,
      explorerUrl: r.goal.hrsPayoutTxHash
        ? `https://etherscan.io/tx/${r.goal.hrsPayoutTxHash}`
        : null,
    },
    driverStats: {
      driverId: r.driver.id,
      totalTrips: r.driver.totalTrips || 0,
      rating: parseFloat(r.driver.rating || "5"),
      totalEarnings: parseFloat(r.driver.totalEarnings || "0"),
      memberSince: r.driver.createdAt,
    },
  }));
}

// Dealer marks handoff done: goal fulfilled; the driver's next completed ride
// auto-creates a fresh goal at the next rung up (ladder reset).
export async function fulfillClaim(goalId: string, note?: string): Promise<{ ok: boolean; error?: string }> {
  const [updated] = await db
    .update(ladderGoals)
    .set({ status: "fulfilled", fulfilledAt: new Date(), dealerNote: note || null, updatedAt: new Date() })
    .where(and(eq(ladderGoals.id, goalId), eq(ladderGoals.status, "claimed")))
    .returning();
  return updated ? { ok: true } : { ok: false, error: "Claim not found or not in claimed state" };
}

// ---------- Admin: liability + climbing count ----------

export async function getLadderLiability() {
  const [open] = await db
    .select({
      goals: sql<string>`COUNT(*)`,
      units: sql<string>`COALESCE(SUM(${ladderGoals.unitsSaved}), '0')`,
    })
    .from(ladderGoals)
    .where(inArray(ladderGoals.status, OPEN_STATUSES as any));
  const [fulfilled] = await db
    .select({
      goals: sql<string>`COUNT(*)`,
      units: sql<string>`COALESCE(SUM(${ladderGoals.unitsSaved}), '0')`,
    })
    .from(ladderGoals)
    .where(eq(ladderGoals.status, "fulfilled"));
  const settings = await getLadderSettings();
  return {
    token: { symbol: "HRS", network: "Ethereum mainnet", decimals: 6, note: "On-chain HRS payout fires automatically when driver claims a qualified goal" },
    accrualPaused: settings.accrualPaused,
    savePercent: parseFloat(settings.savePercent),
    unitsPerCurrency: parseFloat(settings.unitsPerCurrency),
    outstanding: { goals: parseInt(open?.goals || "0", 10), totalUnits: parseFloat(open?.units || "0") },
    fulfilled: { goals: parseInt(fulfilled?.goals || "0", 10), totalUnits: parseFloat(fulfilled?.units || "0") },
  };
}

export async function countDriversClimbing(): Promise<number> {
  const [row] = await db
    .select({ n: sql<string>`COUNT(DISTINCT ${ladderGoals.driverId})` })
    .from(ladderGoals)
    .where(inArray(ladderGoals.status, OPEN_STATUSES as any));
  return parseInt(row?.n || "0", 10);
}
