import { Router } from "express";
import { and, count, countDistinct, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "./db";
import {
  cities,
  coffeeOrders,
  drivers,
  hubs,
  prayerRideDispatches,
  rides,
  scheduledArrivals,
  sessions,
  users,
} from "@shared/schema";

// Public, privacy-safe network statistics for the live dashboard on the
// landing page. Everything here is an AGGREGATE — no names, phones, routes,
// or any per-person data ever leaves this endpoint.

export const networkStatsRouter = Router();

const CACHE_MS = 20 * 1000;
let cached: { at: number; body: any } | null = null;

const LIVE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"];

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function buildStats() {
  const now = new Date();

  const [
    [driverTotals],
    onlineDriverRows,
    [riderTotals],
    riderRegionRows,
    [rideTotals],
    [liveRides],
    [polygonTx],
    [freePrayerCompleted],
    [prayerDispatched],
    [arrivalTotals],
    [coffeeTotals],
    cityRows,
    hubRows,
  ] = await Promise.all([
    db.select({ online: count() }).from(drivers).where(eq(drivers.isOnline, true)),
    db
      .select({ lat: drivers.currentLat, lng: drivers.currentLng })
      .from(drivers)
      .where(eq(drivers.isOnline, true)),
    db
      .select({ connected: countDistinct(sessions.userId) })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(gt(sessions.expiresAt, now), eq(users.role, "customer"))),
    db
      .select({ regionCode: users.regionCode, connected: countDistinct(sessions.userId) })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(gt(sessions.expiresAt, now), eq(users.role, "customer")))
      .groupBy(users.regionCode),
    db.select({ completed: count() }).from(rides).where(eq(rides.status, "completed")),
    db
      .select({ live: count() })
      .from(rides)
      .where(inArray(rides.status, LIVE_RIDE_STATUSES as any)),
    db.select({ txs: count() }).from(rides).where(isNotNull(rides.blockchainTxHash)),
    db
      .select({ done: count() })
      .from(prayerRideDispatches)
      .innerJoin(rides, eq(rides.id, prayerRideDispatches.rideId))
      .where(eq(rides.status, "completed")),
    db
      .select({ total: count() })
      .from(prayerRideDispatches)
      .where(isNotNull(prayerRideDispatches.rideId)),
    db.select({ total: count() }).from(scheduledArrivals),
    db.select({ total: count() }).from(coffeeOrders),
    db.select().from(cities),
    db
      .select({ type: hubs.type, evHub: hubs.isEvHub })
      .from(hubs)
      .where(eq(hubs.status, "active")),
  ]);

  // Group online drivers into cities by distance to the city center.
  const cityList = cityRows.map((c) => ({
    name: c.name,
    regionCode: c.regionCode,
    country: String(c.regionCode || "").split("-")[0],
    lat: parseFloat(String(c.centerLat)),
    lng: parseFloat(String(c.centerLng)),
    radiusKm: parseFloat(String(c.radiusKm)) || 30,
    drivers: 0,
    riders: 0,
  }));
  for (const d of onlineDriverRows) {
    const lat = parseFloat(String(d.lat)), lng = parseFloat(String(d.lng));
    if (isNaN(lat) || isNaN(lng)) continue;
    let best: (typeof cityList)[number] | null = null;
    let bestDist = Infinity;
    for (const c of cityList) {
      const dist = haversineKm(lat, lng, c.lat, c.lng);
      if (dist <= c.radiusKm && dist < bestDist) {
        best = c;
        bestDist = dist;
      }
    }
    if (best) best.drivers += 1;
  }
  for (const r of riderRegionRows) {
    if (!r.regionCode) continue;
    const match = cityList.find((c) => c.regionCode === r.regionCode);
    if (match) match.riders += Number(r.connected);
  }

  const activeCities = cityList
    .filter((c) => c.drivers > 0 || c.riders > 0)
    .sort((a, b) => b.drivers - a.drivers || b.riders - a.riders)
    .map((c) => ({ name: c.name, country: c.country, drivers: c.drivers, riders: c.riders }));

  const mosques = hubRows.filter((h) => h.type === "mosque").length;
  const evHubs = hubRows.filter((h) => h.evHub).length;

  return {
    status: "operational",
    generatedAt: now.toISOString(),
    live: {
      driversOnline: Number(driverTotals.online),
      ridersConnected: Number(riderTotals.connected),
      ridesInProgress: Number(liveRides.live),
    },
    cities: {
      total: cityList.length,
      active: activeCities,
    },
    network: {
      ridesCompleted: Number(rideTotals.completed),
      hubs: hubRows.length,
      mosques,
      evHubs,
      onTimeArrivalsScheduled: Number(arrivalTotals.total),
      coffeeOrders: Number(coffeeTotals.total),
    },
    blockchain: {
      chain: "Polygon Amoy",
      transactions: Number(polygonTx.txs),
    },
    prayer: {
      freeRidesCompleted: Number(freePrayerCompleted.done),
      ridesDispatched: Number(prayerDispatched.total),
      note: "All prayer rides are free",
    },
  };
}

networkStatsRouter.get("/api/network/stats", async (_req, res) => {
  try {
    if (cached && Date.now() - cached.at < CACHE_MS) {
      return res.json(cached.body);
    }
    const body = await buildStats();
    cached = { at: Date.now(), body };
    res.json(body);
  } catch (error: any) {
    console.error("[NetworkStats] error:", error);
    res.status(500).json({ error: "Stats are momentarily unavailable" });
  }
});
