import { db } from "./db";
import { rides, sharedRideGroups, drivers, vehicles } from "@shared/schema";
import type { Ride, SharedRideGroup } from "@shared/schema";
import { and, eq, gt, sql, inArray, isNull } from "drizzle-orm";
import { calculateFeeBreakdown } from "./blockchain";
import { getRegionByCode } from "./regionService";

// ---------------------------------------------------------------------------
// Shared / pooled three-wheeler rides (fare split).
//
// Each rider keeps their own `rides` row; a `shared_ride_groups` row links the
// riders sharing one tuktuk. The group is the unit a driver accepts. Fares use
// an equal-percentage discount by FINAL occupancy so every co-rider saves the
// same proportion and the driver always earns more than a single solo fare.
// ---------------------------------------------------------------------------

// Three-wheeler vehicle types eligible for sharing.
export const THREE_WHEELER_TYPES = ["cng", "rickshaw", "tuktuk", "moto"];

// Per-rider discount by how many riders end up sharing. 2 riders => each pays
// 70% of solo (combined 1.4x a solo fare); 3 riders => 60% each (combined 1.8x).
// A lone rider (occupancy 1, the no-match fallback) pays full fare.
const SHARE_DISCOUNT_BY_OCCUPANCY: Record<number, number> = { 1: 0, 2: 0.3, 3: 0.4 };

// The discount shown upfront before a co-rider is found = the 2-rider tier. This
// is the price the rider agrees to pay IF matched; a 3rd joiner only makes it
// cheaper, never more expensive.
export const BASE_SHARE_DISCOUNT = SHARE_DISCOUNT_BY_OCCUPANCY[2];

// How long a forming pool waits for co-riders before the rider is offered the
// solo / keep-waiting choice. Evaluated lazily on poll (no server timers).
const MATCH_WINDOW_MS = 90 * 1000;

// Same-direction match thresholds.
const PICKUP_RADIUS_KM = 2.5;
const DROPOFF_RADIUS_KM = 3.5;
const BEARING_TOLERANCE_DEG = 40;

export function isThreeWheeler(vehicleType?: string | null): boolean {
  return !!vehicleType && THREE_WHEELER_TYPES.includes(vehicleType);
}

export function getShareDiscount(occupancy: number): number {
  if (occupancy >= 3) return SHARE_DISCOUNT_BY_OCCUPANCY[3];
  if (occupancy === 2) return SHARE_DISCOUNT_BY_OCCUPANCY[2];
  return 0;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1));
  return (Math.atan2(y, x) * 180) / Math.PI + 360;
}

function bearingDiff(a: number, b: number): number {
  const d = Math.abs((a % 360) - (b % 360));
  return d > 180 ? 360 - d : d;
}

export interface JoinPoolParams {
  rideId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  regionCode: string;
  currency: string;
  serviceTypeId: string | null;
  vehicleType: string;
  maxSeats: number;
  soloFare: number;
}

export interface JoinPoolResult {
  groupId: string;
  matched: boolean; // true if joined an existing group with a co-rider
  ready: boolean; // true if the group now has >= 2 riders (broadcast to drivers)
  seatsFilled: number;
}

// Compute the per-rider share at a given occupancy.
export function riderShare(soloFare: number, occupancy: number): number {
  return round2(soloFare * (1 - getShareDiscount(occupancy)));
}

// Place a newly-created shared ride into an existing compatible pool, or open a
// new forming pool. Returns the group + whether it is now ready for drivers.
export async function joinOrCreatePool(p: JoinPoolParams): Promise<JoinPoolResult> {
  const now = new Date();
  const myBearing = bearingDeg(p.pickupLat, p.pickupLng, p.dropoffLat, p.dropoffLng);

  // Candidate groups: same market + same three-wheeler type, no driver yet, and
  // still has a free seat. Includes both "forming" pools (waiting for a co-rider)
  // and already-"ready" pools (>=2 riders) so a third rider can still fill an
  // existing tuktuk up to its seat limit.
  const candidates = await db
    .select()
    .from(sharedRideGroups)
    .where(
      and(
        inArray(sharedRideGroups.status, ["forming", "ready"]),
        eq(sharedRideGroups.regionCode, p.regionCode),
        eq(sharedRideGroups.vehicleType, p.vehicleType),
        isNull(sharedRideGroups.driverId),
      ),
    );

  let best: { group: SharedRideGroup; pickupDist: number } | null = null;
  for (const g of candidates) {
    if (g.seatsFilled >= g.maxSeats) continue;
    // A still-forming pool must be within its matching window; a "ready" pool
    // stays joinable until a driver claims it, even past the original window.
    if (g.status === "forming" && (!g.matchWindowExpiresAt || new Date(g.matchWindowExpiresAt) <= now)) continue;
    const gpLat = parseFloat(g.anchorPickupLat);
    const gpLng = parseFloat(g.anchorPickupLng);
    const gdLat = parseFloat(g.anchorDropoffLat);
    const gdLng = parseFloat(g.anchorDropoffLng);
    const pickupDist = haversineKm(p.pickupLat, p.pickupLng, gpLat, gpLng);
    const dropoffDist = haversineKm(p.dropoffLat, p.dropoffLng, gdLat, gdLng);
    if (pickupDist > PICKUP_RADIUS_KM) continue;
    if (dropoffDist > DROPOFF_RADIUS_KM) continue;
    const theirBearing = g.routeBearing != null ? parseFloat(g.routeBearing) : bearingDeg(gpLat, gpLng, gdLat, gdLng);
    if (bearingDiff(myBearing, theirBearing) > BEARING_TOLERANCE_DEG) continue;
    if (!best || pickupDist < best.pickupDist) best = { group: g, pickupDist };
  }

  if (best) {
    // Atomically take a seat (guard against the group filling up concurrently).
    const newSeats = best.group.seatsFilled + 1;
    const ready = newSeats >= 2;
    const [updated] = await db
      .update(sharedRideGroups)
      .set({
        seatsFilled: newSeats,
        status: ready ? "ready" : "forming",
        combinedFare: sql`${sharedRideGroups.combinedFare} + ${p.soloFare}`,
        updatedAt: now,
      })
      .where(
        and(
          eq(sharedRideGroups.id, best.group.id),
          inArray(sharedRideGroups.status, ["forming", "ready"]),
          isNull(sharedRideGroups.driverId),
          sql`${sharedRideGroups.seatsFilled} < ${sharedRideGroups.maxSeats}`,
        ),
      )
      .returning();

    if (updated) {
      await db.update(rides).set({ poolGroupId: updated.id }).where(eq(rides.id, p.rideId));
      return { groupId: updated.id, matched: true, ready, seatsFilled: updated.seatsFilled };
    }
    // Lost the race — fall through and open a fresh group.
  }

  const [group] = await db
    .insert(sharedRideGroups)
    .values({
      regionCode: p.regionCode,
      currency: p.currency,
      serviceTypeId: p.serviceTypeId,
      vehicleType: p.vehicleType,
      maxSeats: p.maxSeats,
      seatsFilled: 1,
      status: "forming",
      anchorPickupLat: p.pickupLat.toString(),
      anchorPickupLng: p.pickupLng.toString(),
      anchorDropoffLat: p.dropoffLat.toString(),
      anchorDropoffLng: p.dropoffLng.toString(),
      routeBearing: myBearing.toFixed(2),
      combinedFare: p.soloFare.toFixed(2),
      matchWindowExpiresAt: new Date(now.getTime() + MATCH_WINDOW_MS),
    })
    .returning();

  await db.update(rides).set({ poolGroupId: group.id }).where(eq(rides.id, p.rideId));
  return { groupId: group.id, matched: false, ready: false, seatsFilled: 1 };
}

export interface PoolStatus {
  isShared: true;
  poolGroupId: string | null;
  poolStatus: "forming" | "matched" | "accepted" | "started" | "completed" | "cancelled" | "no_match";
  seatsFilled: number;
  maxSeats: number;
  coRiderCount: number;
  yourFare: number;
  soloFare: number;
  savings: number;
  currency: string;
  windowSecondsLeft: number;
}

// Lazily-evaluated pool status for the rider's tracking screen. When the window
// has expired and the rider is still alone, returns "no_match" so the app can
// offer the solo / keep-waiting choice.
export async function getPoolStatus(ride: Ride): Promise<PoolStatus | null> {
  if (!ride.isShared) return null;
  const soloFare = parseFloat(ride.soloFare || ride.estimatedFare || "0");

  if (!ride.poolGroupId) {
    return {
      isShared: true,
      poolGroupId: null,
      poolStatus: "no_match",
      seatsFilled: 1,
      maxSeats: 1,
      coRiderCount: 0,
      yourFare: soloFare,
      soloFare,
      savings: 0,
      currency: ride.currency || "AED",
      windowSecondsLeft: 0,
    };
  }

  const [group] = await db.select().from(sharedRideGroups).where(eq(sharedRideGroups.id, ride.poolGroupId));
  if (!group) return null;

  const now = Date.now();
  const windowMs = group.matchWindowExpiresAt ? new Date(group.matchWindowExpiresAt).getTime() - now : 0;
  const windowSecondsLeft = Math.max(0, Math.round(windowMs / 1000));

  let poolStatus: PoolStatus["poolStatus"];
  if (group.status === "cancelled") poolStatus = "cancelled";
  else if (group.status === "completed") poolStatus = "completed";
  else if (group.status === "started") poolStatus = "started";
  else if (group.status === "accepted") poolStatus = "accepted";
  else if (group.status === "ready" || group.seatsFilled >= 2) poolStatus = "matched";
  else if (windowSecondsLeft <= 0) poolStatus = "no_match";
  else poolStatus = "forming";

  // Once matched, charge the locked share for the actual occupancy; while still
  // forming, show the upfront 2-rider estimate.
  const occupancyForFare = poolStatus === "forming" ? 2 : Math.max(2, group.seatsFilled);
  const yourFare =
    poolStatus === "no_match" ? soloFare : riderShare(soloFare, occupancyForFare);

  return {
    isShared: true,
    poolGroupId: group.id,
    poolStatus,
    seatsFilled: group.seatsFilled,
    maxSeats: group.maxSeats,
    coRiderCount: Math.max(0, group.seatsFilled - 1),
    yourFare,
    soloFare,
    savings: round2(soloFare - yourFare),
    currency: group.currency || ride.currency || "AED",
    windowSecondsLeft,
  };
}

// Extend a forming pool's matching window when the rider chooses to keep waiting.
export async function extendPoolWindow(groupId: string): Promise<boolean> {
  const [updated] = await db
    .update(sharedRideGroups)
    .set({ matchWindowExpiresAt: new Date(Date.now() + MATCH_WINDOW_MS), updatedAt: new Date() })
    .where(and(eq(sharedRideGroups.id, groupId), eq(sharedRideGroups.status, "forming")))
    .returning();
  return !!updated;
}

// Convert a still-forming, single-rider pool ride into a normal solo ride at the
// full fare. Cancels the (now empty) group and detaches the ride so it can be
// broadcast as a standard request. Returns the recomputed solo fields.
export async function convertToSolo(
  ride: Ride,
): Promise<{ soloFare: number; platformFee: number; driverEarnings: number } | null> {
  if (!ride.isShared || !ride.poolGroupId) return null;
  const soloFare = parseFloat(ride.soloFare || ride.estimatedFare || "0");

  const region = await getRegionByCode(ride.regionCode || "AE").catch(() => null);
  const feePercent = region ? region.platformFeePercent : 10;
  const fee = calculateFeeBreakdown(soloFare, feePercent);

  // Only a still-forming, single-rider pool may be cancelled. If a co-rider has
  // joined (status flipped to "ready"/"accepted" or seatsFilled grew) between the
  // rider's poll and this tap, abort so we never strand another rider's pool.
  const [cancelledGroup] = await db
    .update(sharedRideGroups)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(
      and(
        eq(sharedRideGroups.id, ride.poolGroupId),
        eq(sharedRideGroups.status, "forming"),
        eq(sharedRideGroups.seatsFilled, 1),
      ),
    )
    .returning();
  if (!cancelledGroup) return null;

  await db
    .update(rides)
    .set({
      isShared: false,
      poolGroupId: null,
      sharedDiscountPercent: "0.00",
      estimatedFare: soloFare.toFixed(2),
      actualFare: null,
      platformFee: fee.platformFee.toFixed(2),
      driverEarnings: fee.driverShare.toFixed(2),
      updatedAt: new Date(),
    })
    .where(eq(rides.id, ride.id));

  return { soloFare, platformFee: fee.platformFee, driverEarnings: fee.driverShare };
}

// Reconcile a pool's group state after one member ride is cancelled. Recomputes
// the active (non-cancelled) member count, adjusts seatsFilled + combinedFare,
// and transitions the group status so a lone remaining rider is never charged
// (or shown to drivers as) a pooled discount. Idempotent and safe to call after
// the leg's status has already been persisted to "cancelled".
export async function reconcilePoolOnCancel(ride: Ride): Promise<void> {
  if (!ride.isShared || !ride.poolGroupId) return;
  const groupId = ride.poolGroupId;

  const [group] = await db.select().from(sharedRideGroups).where(eq(sharedRideGroups.id, groupId));
  if (!group || group.status === "cancelled" || group.status === "completed") return;

  // Active members = pool legs not cancelled (exclude the just-cancelled ride
  // defensively in case its status is not yet committed).
  const members = await db
    .select()
    .from(rides)
    .where(and(eq(rides.poolGroupId, groupId), sql`${rides.status} <> 'cancelled'`));
  const active = members.filter((m) => m.id !== ride.id);
  const remaining = active.length;
  const combined = active.reduce((s, m) => s + parseFloat(m.soloFare || m.estimatedFare || "0"), 0);

  if (remaining <= 0) {
    await db
      .update(sharedRideGroups)
      .set({ status: "cancelled", seatsFilled: 0, combinedFare: "0.00", updatedAt: new Date() })
      .where(eq(sharedRideGroups.id, groupId));
    return;
  }

  // For still-matchable groups, drop a lone rider back to "forming" so they fall
  // through to the no-match / solo path instead of being stranded as "ready".
  let newStatus = group.status;
  if (group.status === "ready" || group.status === "forming") {
    newStatus = remaining >= 2 ? "ready" : "forming";
  }

  await db
    .update(sharedRideGroups)
    .set({ seatsFilled: remaining, status: newStatus, combinedFare: combined.toFixed(2), updatedAt: new Date() })
    .where(eq(sharedRideGroups.id, groupId));
}

export interface SharedGroupCard {
  id: string; // anchor ride id (kept for parity with solo cards)
  poolGroupId: string;
  isShared: true;
  riderCount: number;
  maxSeats: number;
  combinedFare: number;
  combinedDriverEarnings: number;
  currency: string;
  stops: Array<{ rideId: string; pickupAddress: string; dropoffAddress: string; fare: number }>;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: string | null;
  pickupLng: string | null;
  dropoffLat: string | null;
  dropoffLng: string | null;
  estimatedFare: string;
}

// Collapse the "ready" shared pools among a set of pending rides into one card
// per group (combined earnings + every stop), and return the non-shared rides
// untouched. Forming pools (no co-rider yet) are held back from drivers.
export async function buildSharedGroupCards(
  pendingRides: Ride[],
): Promise<{ soloRides: Ride[]; sharedCards: SharedGroupCard[] }> {
  const shared = pendingRides.filter((r) => r.isShared && r.poolGroupId);
  const soloRides = pendingRides.filter((r) => !(r.isShared && r.poolGroupId));
  if (shared.length === 0) return { soloRides, sharedCards: [] };

  const byGroup = new Map<string, Ride[]>();
  for (const r of shared) {
    const arr = byGroup.get(r.poolGroupId!) || [];
    arr.push(r);
    byGroup.set(r.poolGroupId!, arr);
  }

  const groupIds = [...byGroup.keys()];
  const groups = groupIds.length
    ? await db.select().from(sharedRideGroups).where(sql`${sharedRideGroups.id} in (${sql.join(groupIds.map((g) => sql`${g}`), sql`, `)})`)
    : [];
  const groupMap = new Map(groups.map((g) => [g.id, g]));

  const sharedCards: SharedGroupCard[] = [];
  for (const [groupId, members] of byGroup.entries()) {
    const group = groupMap.get(groupId);
    if (!group || group.status !== "ready") continue;
    // Never expose a pooled card for a lone rider (e.g. a co-rider cancelled
    // after matching). Hold it back from drivers — the rider's own no-match /
    // go-solo flow restores the full fare before it is broadcast as solo.
    if (members.length < 2) continue;

    const region = await getRegionByCode(group.regionCode || "AE").catch(() => null);
    const feeRate = (region ? region.platformFeePercent : 10) / 100;
    const occupancy = Math.max(2, members.length);

    const stops = members.map((m) => {
      const solo = parseFloat(m.soloFare || m.estimatedFare || "0");
      return {
        rideId: m.id,
        pickupAddress: m.pickupAddress,
        dropoffAddress: m.dropoffAddress,
        fare: riderShare(solo, occupancy),
      };
    });
    const combinedFare = round2(stops.reduce((s, x) => s + x.fare, 0));
    const combinedDriverEarnings = round2(combinedFare * (1 - feeRate));
    const anchor = members[0];

    sharedCards.push({
      id: anchor.id,
      poolGroupId: groupId,
      isShared: true,
      riderCount: members.length,
      maxSeats: group.maxSeats,
      combinedFare,
      combinedDriverEarnings,
      currency: group.currency || "AED",
      stops,
      pickupAddress: anchor.pickupAddress,
      dropoffAddress: anchor.dropoffAddress,
      pickupLat: anchor.pickupLat,
      pickupLng: anchor.pickupLng,
      dropoffLat: anchor.dropoffLat,
      dropoffLng: anchor.dropoffLng,
      estimatedFare: combinedFare.toFixed(2),
    });
  }

  return { soloRides, sharedCards };
}

export interface AcceptGroupResult {
  ok: boolean;
  code?: string;
  message?: string;
  groupId?: string;
  rideIds?: string[];
}

// A driver claims a whole ready pool. Atomically locks the group to the driver,
// then locks each member ride's fare at the final occupancy and assigns it to
// the driver/vehicle so the existing per-ride completion pipeline settles each
// leg unchanged.
export async function acceptGroup(groupId: string, driverId: string): Promise<AcceptGroupResult> {
  const now = new Date();

  // Resolve the driver's active vehicle (the economic actor for earnings).
  const driverVehicles = await db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  const activeVehicle = driverVehicles.find((v) => v.isActive) || driverVehicles[0];
  const vehicleId = activeVehicle?.id || null;

  // Atomic claim: only one driver can move a group out of "ready".
  const [claimed] = await db
    .update(sharedRideGroups)
    .set({ status: "accepted", driverId, vehicleId, acceptedAt: now, updatedAt: now })
    .where(and(eq(sharedRideGroups.id, groupId), eq(sharedRideGroups.status, "ready")))
    .returning();

  if (!claimed) {
    return { ok: false, code: "GROUP_UNAVAILABLE", message: "This shared ride was just taken or is no longer available." };
  }

  const members = await db
    .select()
    .from(rides)
    .where(and(eq(rides.poolGroupId, groupId), eq(rides.status, "pending")));

  const region = await getRegionByCode(claimed.regionCode || "AE").catch(() => null);
  const feePercent = region ? region.platformFeePercent : 10;
  const occupancy = Math.max(2, members.length);
  const discountPct = getShareDiscount(occupancy) * 100;

  const rideIds: string[] = [];
  for (const m of members) {
    const solo = parseFloat(m.soloFare || m.estimatedFare || "0");
    const finalFare = riderShare(solo, occupancy);
    const fee = calculateFeeBreakdown(finalFare, feePercent);
    await db
      .update(rides)
      .set({
        status: "accepted",
        driverId,
        vehicleId,
        acceptedAt: now,
        estimatedFare: finalFare.toFixed(2),
        actualFare: finalFare.toFixed(2),
        platformFee: fee.platformFee.toFixed(2),
        driverEarnings: fee.driverShare.toFixed(2),
        sharedDiscountPercent: discountPct.toFixed(2),
        updatedAt: now,
      })
      .where(eq(rides.id, m.id));
    rideIds.push(m.id);
  }

  return { ok: true, groupId, rideIds };
}
