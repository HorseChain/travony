/**
 * Backfill vehicle wallets & identity (idempotent + reconciling).
 *
 * Flips the economic model so the VEHICLE is the earning account. For each
 * vehicle this:
 *   1. assigns a stable public handle (only if missing),
 *   2. recomputes lifetime totalEarnings / totalTrips from its own completed
 *      rides (a SET to a computed value — safe to re-run),
 *   3. recomputes reputationScore / ratingCount from ratings on its own rides,
 *   4. backfills walletTransactions.vehicleId from the ride association.
 *
 * It then "sweeps" each operator's liquid driver.walletBalance into their
 * primary vehicle wallet and zeroes the driver balance, so the withdrawable
 * total is unchanged (no double counting) and the vehicle becomes the single
 * source of truth. Re-running is safe: once swept, driver balances are 0 and
 * the sweep moves nothing.
 *
 * Reversibility: pass `--revert` to move vehicle wallet balances back onto the
 * driver (aggregated) and zero the vehicle wallet balances. Lifetime stats and
 * handles are left intact (they are derived/identity, not liquid funds).
 *
 * Usage:
 *   tsx server/backfillVehicleWallets.ts
 *   tsx server/backfillVehicleWallets.ts --revert
 */
import { db } from "./db";
import { vehicles, drivers, rides, ratings, walletTransactions } from "@shared/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { generateVehicleHandle } from "./storage";

async function ensureUniqueHandle(existing: Set<string>): Promise<string> {
  let handle = generateVehicleHandle();
  while (existing.has(handle)) {
    handle = generateVehicleHandle();
  }
  existing.add(handle);
  return handle;
}

async function backfill() {
  const allVehicles = await db.select().from(vehicles);
  const usedHandles = new Set(
    allVehicles.map((v) => v.publicHandle).filter((h): h is string => !!h),
  );

  let handlesAssigned = 0;
  for (const v of allVehicles) {
    const updates: Record<string, unknown> = {};

    if (!v.publicHandle) {
      updates.publicHandle = await ensureUniqueHandle(usedHandles);
      handlesAssigned++;
    }

    // Lifetime earnings & trips from this vehicle's own completed rides.
    const completed = await db
      .select({ actualFare: rides.actualFare, estimatedFare: rides.estimatedFare, driverEarnings: rides.driverEarnings })
      .from(rides)
      .where(and(eq(rides.vehicleId, v.id), eq(rides.status, "completed")));

    let earnings = 0;
    for (const r of completed) {
      const share = r.driverEarnings != null
        ? parseFloat(r.driverEarnings)
        : parseFloat(r.actualFare || r.estimatedFare || "0") * 0.9;
      earnings += share;
    }
    updates.totalEarnings = earnings.toFixed(2);
    updates.totalTrips = completed.length;

    // Reputation from ratings on this vehicle's rides.
    const ratingRows = await db
      .select({ rating: ratings.rating })
      .from(ratings)
      .innerJoin(rides, eq(ratings.rideId, rides.id))
      .where(eq(rides.vehicleId, v.id));
    const ratingCount = ratingRows.length;
    const score = ratingCount > 0 ? ratingRows.reduce((s, r) => s + r.rating, 0) / ratingCount : 5;
    updates.reputationScore = score.toFixed(2);
    updates.ratingCount = ratingCount;

    await db.update(vehicles).set(updates as any).where(eq(vehicles.id, v.id));
  }

  // Backfill vehicleId on historical wallet transactions via their ride.
  const txBackfill = await db.execute(sql`
    UPDATE wallet_transactions wt
    SET vehicle_id = r.vehicle_id
    FROM rides r
    WHERE wt.ride_id = r.id
      AND wt.vehicle_id IS NULL
      AND r.vehicle_id IS NOT NULL
  `);

  // Sweep each operator's liquid driver balance into their primary vehicle.
  const allDrivers = await db.select().from(drivers);
  let swept = 0;
  let sweptAmount = 0;
  for (const d of allDrivers) {
    const liquid = parseFloat(d.walletBalance || "0");
    if (liquid <= 0) continue;
    const vehs = await db.select().from(vehicles).where(eq(vehicles.driverId, d.id));
    if (vehs.length === 0) continue; // legacy: no vehicle, leave on driver
    const primary =
      vehs.find((v) => v.isActive) ||
      [...vehs].sort((a, b) => (b.totalTrips || 0) - (a.totalTrips || 0))[0];
    const current = parseFloat(primary.walletBalance || "0");
    await db.update(vehicles)
      .set({ walletBalance: (current + liquid).toFixed(2) })
      .where(eq(vehicles.id, primary.id));
    await db.update(drivers).set({ walletBalance: "0.00" }).where(eq(drivers.id, d.id));
    swept++;
    sweptAmount += liquid;
  }

  console.log(`[backfill] handles assigned: ${handlesAssigned}`);
  console.log(`[backfill] vehicles processed: ${allVehicles.length}`);
  console.log(`[backfill] operators swept: ${swept} (AED ${sweptAmount.toFixed(2)})`);
  console.log(`[backfill] wallet_transactions vehicle_id backfilled`);

  await reconcile();
}

async function revert() {
  const allVehicles = await db.select().from(vehicles);
  let moved = 0;
  for (const v of allVehicles) {
    if (!v.driverId) continue;
    const liquid = parseFloat(v.walletBalance || "0");
    if (liquid === 0) continue;
    const [d] = await db.select().from(drivers).where(eq(drivers.id, v.driverId));
    if (!d) continue;
    const current = parseFloat(d.walletBalance || "0");
    await db.update(drivers)
      .set({ walletBalance: (current + liquid).toFixed(2) })
      .where(eq(drivers.id, d.id));
    await db.update(vehicles).set({ walletBalance: "0.00" }).where(eq(vehicles.id, v.id));
    moved += liquid;
  }
  console.log(`[revert] moved AED ${moved.toFixed(2)} of vehicle liquid back to drivers`);
  await reconcile();
}

async function reconcile() {
  const [{ total }] = await db.execute(sql`
    SELECT
      COALESCE((SELECT SUM(wallet_balance) FROM drivers), 0) +
      COALESCE((SELECT SUM(wallet_balance) FROM vehicles), 0) AS total
  `).then((r: any) => r.rows ?? r);
  console.log(`[reconcile] total liquid balance (drivers + vehicles): ${total}`);
}

async function main() {
  const mode = process.argv.includes("--revert") ? "revert" : "backfill";
  if (mode === "revert") {
    await revert();
  } else {
    await backfill();
  }
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill] failed:", err);
  process.exit(1);
});
