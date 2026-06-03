// EV driver routes: car connection (Smartcar w/ simulated fallback), live
// battery snapshot, public chargers (Open Charge Map), low-battery range check,
// and manual-battery fallback. Designed to degrade gracefully end-to-end.

import { Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { evCarConnections, drivers, vehicles, hubCheckIns } from "@shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import type { EvCarConnection, Vehicle } from "@shared/schema";
import {
  hasSmartcarCredentials,
  buildAuthUrl,
  exchangeCode,
  refreshAccessToken,
  fetchLiveSnapshot,
  buildInitialSimulatedSnapshot,
  evolveSimulatedSnapshot,
  computeTimeToReadyMinutes,
  deriveStaging,
  type CarSnapshot,
} from "./evCarDataService";
import { getNearbyChargers } from "./openChargeMapService";

const router = Router();

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

async function getDriverForUser(userId: string) {
  const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
  return driver || null;
}

async function getPrimaryVehicle(driverId: string): Promise<Vehicle | null> {
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(and(eq(vehicles.driverId, driverId), eq(vehicles.isActive, true)))
    .orderBy(desc(vehicles.createdAt));
  return vehicle || null;
}

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

// in-memory OAuth state -> driverId (short lived); fine for single instance dev
const pendingOauthStates = new Map<string, { driverId: string; createdAt: number }>();
function newOauthState(driverId: string): string {
  const state = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  pendingOauthStates.set(state, { driverId, createdAt: Date.now() });
  // prune old states (>15 min)
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [k, v] of pendingOauthStates) if (v.createdAt < cutoff) pendingOauthStates.delete(k);
  return state;
}

async function getConnection(driverId: string): Promise<EvCarConnection | null> {
  const [conn] = await db
    .select()
    .from(evCarConnections)
    .where(eq(evCarConnections.driverId, driverId));
  return conn || null;
}

// Refresh the live/simulated snapshot, persist it, and return the fresh values
// plus a source label. Never throws — degrades to last-known/stale on failure.
async function refreshSnapshot(
  conn: EvCarConnection,
  vehicle: Vehicle | null,
): Promise<{
  snapshot: CarSnapshot | null;
  source: "live" | "simulated" | "stale" | "none";
  status: string;
  error?: string;
}> {
  if (conn.status === "disconnected") {
    return { snapshot: null, source: "none", status: "disconnected" };
  }

  const ratedRange = vehicle?.evRatedRangeKm ?? 0;

  // Simulated mode
  if (conn.isSimulated) {
    const snap = evolveSimulatedSnapshot(conn, ratedRange);
    await persistSnapshot(conn.id, snap, "connected");
    return { snapshot: snap, source: "simulated", status: "connected" };
  }

  // Live mode
  try {
    let accessToken = conn.accessToken || "";
    let refreshTok = conn.refreshToken || "";
    const expSoon =
      !conn.tokenExpiresAt || new Date(conn.tokenExpiresAt).getTime() < Date.now() + 60_000;
    if (expSoon && refreshTok) {
      const tokens = await refreshAccessToken(refreshTok);
      accessToken = tokens.accessToken;
      refreshTok = tokens.refreshToken;
      await db
        .update(evCarConnections)
        .set({
          accessToken,
          refreshToken: refreshTok,
          tokenExpiresAt: new Date(Date.now() + tokens.expiresInSec * 1000),
          status: "connected",
          updatedAt: new Date(),
        })
        .where(eq(evCarConnections.id, conn.id));
    }
    const snap = await fetchLiveSnapshot(accessToken, conn.externalVehicleId || "");
    await persistSnapshot(conn.id, snap, "connected");
    return { snapshot: snap, source: "live", status: "connected" };
  } catch (err: any) {
    const isAuth = err?.status === 401 || err?.status === 403;
    await db
      .update(evCarConnections)
      .set({
        status: isAuth ? "expired" : "error",
        lastError: String(err?.message || err).slice(0, 500),
        updatedAt: new Date(),
      })
      .where(eq(evCarConnections.id, conn.id));
    // serve last-known snapshot if we have one
    const last =
      conn.batteryPercent != null
        ? {
            batteryPercent: conn.batteryPercent,
            rangeKm: conn.rangeKm != null ? Number(conn.rangeKm) : 0,
            isCharging: Boolean(conn.isCharging),
            chargingState: conn.chargingState || "NOT_CHARGING",
          }
        : null;
    return {
      snapshot: last,
      source: last ? "stale" : "none",
      status: isAuth ? "expired" : "error",
      error: String(err?.message || err),
    };
  }
}

async function persistSnapshot(connId: string, snap: CarSnapshot, status: "connected") {
  await db
    .update(evCarConnections)
    .set({
      batteryPercent: snap.batteryPercent,
      rangeKm: String(snap.rangeKm),
      isCharging: snap.isCharging,
      chargingState: snap.chargingState,
      snapshotAt: new Date(),
      status,
      lastError: null,
      updatedAt: new Date(),
    })
    .where(eq(evCarConnections.id, connId));
}

// If the driver is actively checked-in at a hub and hasn't manually overridden
// their staging, auto-update it from the fresh snapshot.
async function autoUpdateStaging(userId: string, snap: CarSnapshot, target: number) {
  const [checkIn] = await db
    .select()
    .from(hubCheckIns)
    .where(and(eq(hubCheckIns.userId, userId), isNull(hubCheckIns.checkedOutAt)))
    .orderBy(desc(hubCheckIns.checkedInAt));
  if (!checkIn) return;
  if (checkIn.evStagingSource === "manual") return; // respect manual override
  const staging = deriveStaging(snap, target);
  if (staging === checkIn.evStagingStatus) return;
  await db
    .update(hubCheckIns)
    .set({ evStagingStatus: staging, evStagingSource: "auto" })
    .where(eq(hubCheckIns.id, checkIn.id));
}

// Resolve the best battery snapshot for a driver across all sources:
// live/simulated connection -> manual vehicle entry -> none.
async function resolveBattery(driverId: string, userId: string) {
  const conn = await getConnection(driverId);
  const vehicle = await getPrimaryVehicle(driverId);

  if (conn && conn.status !== "disconnected") {
    const { snapshot, source, status, error } = await refreshSnapshot(conn, vehicle);
    if (snapshot) {
      if (source === "live" || source === "simulated") {
        await autoUpdateStaging(userId, snapshot, conn.targetChargePercent ?? 80);
      }
      return {
        source,
        status,
        error,
        batteryPercent: snapshot.batteryPercent,
        rangeKm: snapshot.rangeKm,
        isCharging: snapshot.isCharging,
        chargingState: snapshot.chargingState,
        targetChargePercent: conn.targetChargePercent ?? 80,
        updatedAt: new Date().toISOString(),
        timeToReadyMinutes: computeTimeToReadyMinutes(
          snapshot.batteryPercent,
          conn.targetChargePercent ?? 80,
          vehicle?.evBatteryCapacityKwh != null ? Number(vehicle.evBatteryCapacityKwh) : null,
          snapshot.isCharging,
        ),
        provider: conn.provider,
        isSimulated: Boolean(conn.isSimulated),
      };
    }
    // connection exists but no snapshot -> fall through to manual
  }

  // Manual fallback
  if (vehicle?.manualBatteryPercent != null) {
    const rated = vehicle.evRatedRangeKm ?? 0;
    const rangeKm = rated > 0 ? Math.round((rated * vehicle.manualBatteryPercent) / 100) : 0;
    return {
      source: "manual" as const,
      status: conn?.status || "disconnected",
      batteryPercent: vehicle.manualBatteryPercent,
      rangeKm,
      isCharging: false,
      chargingState: "NOT_CHARGING",
      targetChargePercent: conn?.targetChargePercent ?? 80,
      updatedAt: vehicle.manualBatteryUpdatedAt
        ? new Date(vehicle.manualBatteryUpdatedAt).toISOString()
        : null,
      timeToReadyMinutes: null,
      provider: conn?.provider || null,
      isSimulated: false,
    };
  }

  return {
    source: "none" as const,
    status: conn?.status || "disconnected",
    batteryPercent: null,
    rangeKm: null,
    isCharging: false,
    chargingState: null,
    targetChargePercent: conn?.targetChargePercent ?? 80,
    updatedAt: null,
    timeToReadyMinutes: null,
    provider: conn?.provider || null,
    isSimulated: false,
  };
}

// ---------------------------------------------------------------------------
// GET /api/ev/connection — current connection + best-available battery snapshot
// ---------------------------------------------------------------------------
router.get("/api/ev/connection", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driver = await getDriverForUser(session.userId);
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });

    const battery = await resolveBattery(driver.id, session.userId);
    res.json({
      connected: battery.status === "connected",
      liveDataAvailable: hasSmartcarCredentials(),
      ...battery,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load EV connection" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ev/connect — start a connection
//   live mode  -> returns { mode:'live', authUrl }
//   no key     -> creates a simulated connection and returns it
// ---------------------------------------------------------------------------
router.post("/api/ev/connect", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    if (session.role !== "driver") return res.status(403).json({ error: "Drivers only" });
    const driver = await getDriverForUser(session.userId);
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });

    const { vehicleId, targetChargePercent } = req.body || {};
    const target =
      typeof targetChargePercent === "number"
        ? Math.min(100, Math.max(50, targetChargePercent))
        : 80;
    const vehicle = vehicleId
      ? (await db.select().from(vehicles).where(eq(vehicles.id, vehicleId)))[0]
      : await getPrimaryVehicle(driver.id);

    if (hasSmartcarCredentials()) {
      const state = newOauthState(driver.id);
      // pre-create a placeholder so target/vehicle is remembered after callback
      await upsertConnection(driver.id, {
        vehicleId: vehicle?.id ?? null,
        provider: "smartcar",
        status: "disconnected",
        isSimulated: false,
        targetChargePercent: target,
      });
      return res.json({ mode: "live", authUrl: buildAuthUrl(state) });
    }

    // Simulated connection
    const snap = buildInitialSimulatedSnapshot(driver.id);
    await upsertConnection(driver.id, {
      vehicleId: vehicle?.id ?? null,
      provider: "smartcar",
      status: "connected",
      isSimulated: true,
      targetChargePercent: target,
      batteryPercent: snap.batteryPercent,
      rangeKm: String(snap.rangeKm),
      isCharging: snap.isCharging,
      chargingState: snap.chargingState,
      snapshotAt: new Date(),
    });
    const battery = await resolveBattery(driver.id, session.userId);
    res.json({ mode: "simulated", connected: true, ...battery });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to start connection" });
  }
});

async function upsertConnection(driverId: string, values: Partial<EvCarConnection>) {
  const existing = await getConnection(driverId);
  if (existing) {
    await db
      .update(evCarConnections)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(evCarConnections.id, existing.id));
  } else {
    await db.insert(evCarConnections).values({ driverId, ...values } as any);
  }
}

// ---------------------------------------------------------------------------
// GET /api/ev/connect/callback — Smartcar OAuth redirect target (live mode)
// ---------------------------------------------------------------------------
router.get("/api/ev/connect/callback", async (req, res) => {
  const { code, state, error } = req.query as Record<string, string>;
  const finish = (title: string, message: string) =>
    res.send(
      `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">` +
        `<title>${title}</title></head><body style="font-family:-apple-system,system-ui,sans-serif;` +
        `display:flex;min-height:100vh;align-items:center;justify-content:center;background:#0b0f0c;color:#fff;text-align:center;padding:24px">` +
        `<div><h2 style="margin:0 0 8px">${title}</h2><p style="opacity:.7">${message}</p>` +
        `<p style="opacity:.5;font-size:13px">You can close this window and return to the Travony app.</p></div></body></html>`,
    );

  try {
    if (error) return finish("Connection cancelled", "No problem — you can try again anytime.");
    if (!code || !state) return finish("Connection failed", "Missing authorization details.");
    const pending = pendingOauthStates.get(state);
    if (!pending) return finish("Connection expired", "Please start the connection again.");
    pendingOauthStates.delete(state);

    const tokens = await exchangeCode(code);
    await upsertConnection(pending.driverId, {
      provider: "smartcar",
      status: "connected",
      isSimulated: false,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: new Date(Date.now() + tokens.expiresInSec * 1000),
      externalVehicleId: tokens.externalVehicleId ?? null,
    });
    finish("Car connected", "Your vehicle's battery and charging data is now linked.");
  } catch (err: any) {
    finish("Connection failed", "We couldn't link your car. Please try again.");
  }
});

// ---------------------------------------------------------------------------
// POST /api/ev/disconnect
// ---------------------------------------------------------------------------
router.post("/api/ev/disconnect", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driver = await getDriverForUser(session.userId);
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    const existing = await getConnection(driver.id);
    if (existing) {
      await db
        .update(evCarConnections)
        .set({
          status: "disconnected",
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          isSimulated: false,
          updatedAt: new Date(),
        })
        .where(eq(evCarConnections.id, existing.id));
    }
    res.json({ ok: true, status: "disconnected" });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to disconnect" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ev/refresh — force a fresh snapshot + staging update
// ---------------------------------------------------------------------------
router.post("/api/ev/refresh", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driver = await getDriverForUser(session.userId);
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    const battery = await resolveBattery(driver.id, session.userId);
    res.json({ connected: battery.status === "connected", ...battery });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to refresh" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ev/manual-battery — manual fallback when no live connection
// ---------------------------------------------------------------------------
router.post("/api/ev/manual-battery", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driver = await getDriverForUser(session.userId);
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });
    const { batteryPercent } = req.body || {};
    const pct = Number(batteryPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ error: "batteryPercent must be 0-100" });
    }
    const vehicle = await getPrimaryVehicle(driver.id);
    if (!vehicle) return res.status(404).json({ error: "No vehicle found" });
    await db
      .update(vehicles)
      .set({ manualBatteryPercent: Math.round(pct), manualBatteryUpdatedAt: new Date() })
      .where(eq(vehicles.id, vehicle.id));
    const battery = await resolveBattery(driver.id, session.userId);
    res.json({ ok: true, ...battery });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save battery" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/ev/chargers/nearby?lat=&lng=&radius= — Open Charge Map proxy
// ---------------------------------------------------------------------------
router.get("/api/ev/chargers/nearby", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    const radius = req.query.radius ? Math.min(50, Math.max(1, Number(req.query.radius))) : 8;
    const max = req.query.max ? Math.min(50, Math.max(1, Number(req.query.max))) : 25;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }
    const result = await getNearbyChargers(lat, lng, radius, max);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load chargers" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/ev/range-check — soft low-battery warning before accepting a trip
//   body: { tripDistanceKm } OR { pickupLat,pickupLng,dropoffLat,dropoffLng }
// ---------------------------------------------------------------------------
router.post("/api/ev/range-check", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driver = await getDriverForUser(session.userId);
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });

    const b = req.body || {};
    let tripDistanceKm = Number(b.tripDistanceKm);
    if (!Number.isFinite(tripDistanceKm)) {
      const { pickupLat, pickupLng, dropoffLat, dropoffLng } = b;
      if ([pickupLat, pickupLng, dropoffLat, dropoffLng].every((v) => Number.isFinite(Number(v)))) {
        tripDistanceKm = haversineKm(
          Number(pickupLat),
          Number(pickupLng),
          Number(dropoffLat),
          Number(dropoffLng),
        );
      }
    }

    const battery = await resolveBattery(driver.id, session.userId);

    // Not an EV / no data -> no warning, never block.
    if (battery.rangeKm == null || battery.source === "none") {
      return res.json({
        warn: false,
        canComplete: true,
        reason: "no_battery_data",
        source: battery.source,
        batteryPercent: battery.batteryPercent,
        rangeKm: battery.rangeKm,
      });
    }

    const safetyFactor = 1.25; // need 25% headroom beyond the trip
    const required = Number.isFinite(tripDistanceKm) ? tripDistanceKm * safetyFactor : 0;
    const canComplete = battery.rangeKm >= required;
    const lowBattery = battery.batteryPercent != null && battery.batteryPercent <= 20;
    const warn = !canComplete || lowBattery;

    let nearbyChargers: any[] = [];
    if (warn) {
      const lat = Number(b.dropoffLat ?? b.pickupLat);
      const lng = Number(b.dropoffLng ?? b.pickupLng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        const result = await getNearbyChargers(lat, lng, 8, 5);
        nearbyChargers = result.chargers.slice(0, 3);
      }
    }

    res.json({
      warn,
      canComplete,
      lowBattery,
      tripDistanceKm: Number.isFinite(tripDistanceKm) ? Math.round(tripDistanceKm * 10) / 10 : null,
      requiredRangeKm: Math.round(required * 10) / 10,
      rangeKm: battery.rangeKm,
      batteryPercent: battery.batteryPercent,
      source: battery.source,
      updatedAt: battery.updatedAt,
      nearbyChargers,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Range check failed" });
  }
});

export { router as evRouter };
