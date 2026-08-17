import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "./db";
import { storage } from "./storage";
import {
  hubs, hubCheckIns, evDemandSignals,
  drivers, vehicles, users, ridePosts, rides,
} from "@shared/schema";
import { eq, and, gte, desc, sql, isNull, count } from "drizzle-orm";
import { getAgoraViewerCount } from "./agoraStreaming";
import { fleetSafetyReports, reconcileSafetyReports } from "./rideSafety";

const router = Router();

type SessionUser = { userId: string; role: string };

async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) {
    await storage.deleteSession(token);
    return null;
  }
  return { userId: session.userId, role: session.role };
}

function isFleetOrAdmin(session: SessionUser | null): session is SessionUser {
  return session !== null && ["admin", "fleet_owner"].includes(session.role);
}

function denyAccess(session: SessionUser | null, res: Response): boolean {
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return true; }
  if (!isFleetOrAdmin(session)) {
    res.status(403).json({ error: "Fleet owner or admin access required" });
    return true;
  }
  return false;
}

// GET /api/fleet/dashboard/hubs — hub list with EV status + active check-in counts
router.get("/api/fleet/dashboard/hubs", async (req: Request, res: Response) => {
  try {
    const session = await getSessionUser(req);
    if (denyAccess(session, res)) return;

    const allHubs = await db
      .select({
        id: hubs.id,
        name: hubs.name,
        type: hubs.type,
        status: hubs.status,
        lat: hubs.lat,
        lng: hubs.lng,
        isEvHub: hubs.isEvHub,
        totalChargingPorts: hubs.totalChargingPorts,
        availablePorts: hubs.availablePorts,
        avgDemandScore: hubs.avgDemandScore,
        regionCode: hubs.regionCode,
        address: hubs.address,
        lastActivityAt: hubs.lastActivityAt,
      })
      .from(hubs)
      .where(eq(hubs.status, "active"))
      .orderBy(desc(hubs.avgDemandScore));

    // Active check-in counts per hub
    const checkInCounts = await db
      .select({
        hubId: hubCheckIns.hubId,
        total: count(),
        charging: sql<number>`SUM(CASE WHEN ${hubCheckIns.evStagingStatus} = 'charging' THEN 1 ELSE 0 END)`,
        ready: sql<number>`SUM(CASE WHEN ${hubCheckIns.evStagingStatus} = 'ready' THEN 1 ELSE 0 END)`,
        departing: sql<number>`SUM(CASE WHEN ${hubCheckIns.evStagingStatus} = 'departing' THEN 1 ELSE 0 END)`,
      })
      .from(hubCheckIns)
      .where(isNull(hubCheckIns.checkedOutAt))
      .groupBy(hubCheckIns.hubId);

    const countsMap = new Map(checkInCounts.map((c) => [c.hubId, c]));

    const result = allHubs.map((h) => {
      const ci = countsMap.get(h.id);
      return {
        ...h,
        activeCheckIns: Number(ci?.total ?? 0),
        evCharging: Number(ci?.charging ?? 0),
        evReady: Number(ci?.ready ?? 0),
        evDeparting: Number(ci?.departing ?? 0),
      };
    });

    res.json({ hubs: result, total: result.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch hub status";
    res.status(500).json({ error: message });
  }
});

// GET /api/fleet/dashboard/vehicles — all vehicles for this fleet owner with driver info
router.get("/api/fleet/dashboard/vehicles", async (req: Request, res: Response) => {
  try {
    const session = await getSessionUser(req);
    if (denyAccess(session, res)) return;
    const fleetSession = session as SessionUser;

    const rows = await db
      .select({
        driverId: drivers.id,
        driverUserId: drivers.userId,
        isOnline: drivers.isOnline,
        currentLat: drivers.currentLat,
        currentLng: drivers.currentLng,
        lastOnlineAt: drivers.lastOnlineAt,
        driverStatus: drivers.status,
        rating: drivers.rating,
        totalTrips: drivers.totalTrips,
        fleetOwnerId: drivers.fleetOwnerId,
        driverName: users.name,
        driverPhone: users.phone,
        vehicleId: vehicles.id,
        make: vehicles.make,
        model: vehicles.model,
        year: vehicles.year,
        plateNumber: vehicles.plateNumber,
        color: vehicles.color,
        isElectric: vehicles.isElectric,
        isActive: vehicles.isActive,
      })
      .from(drivers)
      .innerJoin(users, eq(drivers.userId, users.id))
      .innerJoin(vehicles, and(
        eq(vehicles.driverId, drivers.id),
        eq(vehicles.isActive, true),
      ))
      .where(
        fleetSession.role === "admin"
          ? undefined
          : eq(drivers.fleetOwnerId, fleetSession.userId)
      );

    if (rows.length === 0) {
      return res.json({ vehicles: [], total: 0 });
    }

    // Active hub check-ins for these drivers
    const activeCheckIns = await db
      .select({
        userId: hubCheckIns.userId,
        hubId: hubCheckIns.hubId,
        evStagingStatus: hubCheckIns.evStagingStatus,
        checkedInAt: hubCheckIns.checkedInAt,
      })
      .from(hubCheckIns)
      .where(isNull(hubCheckIns.checkedOutAt));

    const userCheckInMap = new Map(activeCheckIns.map((ci) => [ci.userId, ci]));

    // Fetch hub names for check-in locations
    const checkedInHubIds = [...new Set(activeCheckIns.map((ci) => ci.hubId))];
    const hubNameMap: Record<string, string> = {};
    if (checkedInHubIds.length > 0) {
      const hubRows = await db
        .select({ id: hubs.id, name: hubs.name })
        .from(hubs)
        .where(sql`${hubs.id} = ANY(ARRAY[${sql.join(checkedInHubIds.map((id) => sql`${id}`), sql`, `)}]::text[])`);
      for (const h of hubRows) hubNameMap[h.id] = h.name;
    }

    const result = rows.map((r) => {
      const checkIn = userCheckInMap.get(r.driverUserId);
      return {
        vehicleId: r.vehicleId,
        driverId: r.driverId,
        driverName: r.driverName ?? "Unknown Driver",
        driverPhone: r.driverPhone ?? null,
        isOnline: r.isOnline ?? false,
        driverStatus: r.driverStatus ?? "pending",
        make: r.make,
        model: r.model,
        year: r.year,
        plateNumber: r.plateNumber,
        color: r.color,
        isElectric: r.isElectric ?? false,
        isActive: r.isActive ?? true,
        currentLat: r.currentLat ?? null,
        currentLng: r.currentLng ?? null,
        lastOnlineAt: r.lastOnlineAt ?? null,
        currentHubId: checkIn?.hubId ?? null,
        currentHubName: checkIn?.hubId ? (hubNameMap[checkIn.hubId] ?? null) : null,
        evStagingStatus: checkIn?.evStagingStatus ?? null,
        checkedInAt: checkIn?.checkedInAt ?? null,
        rating: r.rating ?? null,
        totalTrips: r.totalTrips ?? 0,
      };
    });

    res.json({ vehicles: result, total: result.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch fleet vehicles";
    res.status(500).json({ error: message });
  }
});

// GET /api/fleet/dashboard/demand?hours=1|24 — demand signals for heatmap
router.get("/api/fleet/dashboard/demand", async (req: Request, res: Response) => {
  try {
    const session = await getSessionUser(req);
    if (denyAccess(session, res)) return;

    const rawHours = parseInt((req.query.hours as string) || "24", 10);
    if (isNaN(rawHours) || rawHours < 1) {
      return res.status(400).json({ error: "hours must be a positive integer" });
    }
    const hours = Math.min(rawHours, 168);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    const signals = await db
      .select({
        id: evDemandSignals.id,
        pickupLat: evDemandSignals.pickupLat,
        pickupLng: evDemandSignals.pickupLng,
        matchFound: evDemandSignals.matchFound,
        evDriversAvailable: evDemandSignals.evDriversAvailable,
        nearestHubId: evDemandSignals.nearestHubId,
        requestedAt: evDemandSignals.requestedAt,
        regionCode: evDemandSignals.regionCode,
      })
      .from(evDemandSignals)
      .where(gte(evDemandSignals.requestedAt, since))
      .orderBy(desc(evDemandSignals.requestedAt))
      .limit(1000);

    const total = signals.length;
    const matched = signals.filter((s) => s.matchFound).length;
    const unmatchedRate = total > 0 ? Math.round(((total - matched) / total) * 100) : 0;

    res.json({ signals, total, matched, unmatchedRate, hours });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch demand signals";
    res.status(500).json({ error: message });
  }
});

// GET /api/fleet/dashboard/dispatch-suggestions — top 3 hubs by demand-supply gap
router.get("/api/fleet/dashboard/dispatch-suggestions", async (req: Request, res: Response) => {
  try {
    const session = await getSessionUser(req);
    if (denyAccess(session, res)) return;

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const demandByHub = await db
      .select({
        hubId: evDemandSignals.nearestHubId,
        demandCount: count(),
        unmatchedCount: sql<number>`SUM(CASE WHEN ${evDemandSignals.matchFound} = false THEN 1 ELSE 0 END)`,
      })
      .from(evDemandSignals)
      .where(
        and(
          gte(evDemandSignals.requestedAt, since24h),
          sql`${evDemandSignals.nearestHubId} IS NOT NULL`,
        )
      )
      .groupBy(evDemandSignals.nearestHubId);

    if (demandByHub.length === 0) {
      return res.json({ suggestions: [] });
    }

    const evCheckIns = await db
      .select({
        hubId: hubCheckIns.hubId,
        evCount: sql<number>`SUM(CASE WHEN ${hubCheckIns.evStagingStatus} IN ('ready', 'charging') THEN 1 ELSE 0 END)`,
      })
      .from(hubCheckIns)
      .where(isNull(hubCheckIns.checkedOutAt))
      .groupBy(hubCheckIns.hubId);

    const evSupplyMap = new Map(evCheckIns.map((e) => [e.hubId, Number(e.evCount ?? 0)]));

    const hubIds = [...new Set(demandByHub.map((d) => d.hubId).filter((id): id is string => id !== null))];
    const hubDetails: Record<string, { name: string; address: string | null; availablePorts: number }> = {};

    if (hubIds.length > 0) {
      const hubRows = await db
        .select({ id: hubs.id, name: hubs.name, address: hubs.address, availablePorts: hubs.availablePorts })
        .from(hubs)
        .where(sql`${hubs.id} = ANY(ARRAY[${sql.join(hubIds.map((id) => sql`${id}`), sql`, `)}]::text[])`);
      for (const h of hubRows) {
        hubDetails[h.id] = { name: h.name, address: h.address, availablePorts: h.availablePorts ?? 0 };
      }
    }

    const scored = demandByHub
      .filter((d): d is typeof d & { hubId: string } => d.hubId !== null && d.hubId in hubDetails)
      .map((d) => {
        const hid = d.hubId;
        const evSupply = evSupplyMap.get(hid) ?? 0;
        const unmatched = Number(d.unmatchedCount ?? 0);
        const total = Number(d.demandCount ?? 0);
        const score = unmatched - evSupply;
        return {
          hubId: hid,
          hubName: hubDetails[hid].name,
          hubAddress: hubDetails[hid].address,
          availablePorts: hubDetails[hid].availablePorts,
          demandCount: total,
          unmatchedDemand: unmatched,
          evDriversStaged: evSupply,
          dispatchScore: score,
          priority: score > 5 ? "high" : score > 2 ? "medium" : "low",
        };
      })
      .sort((a, b) => b.dispatchScore - a.dispatchScore)
      .slice(0, 3);

    res.json({ suggestions: scored });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to compute dispatch suggestions";
    res.status(500).json({ error: message });
  }
});

// GET /api/fleet/dashboard/live-streams — all live Agora streams for this fleet
// Returns every stream whose driver belongs to the requesting fleet owner.
// Admins see all streams across every fleet.
router.get("/api/fleet/dashboard/live-streams", async (req: Request, res: Response) => {
  try {
    const session = await getSessionUser(req);
    if (denyAccess(session, res)) return;
    const fleetSession = session as SessionUser;

    const baseConditions = and(
      eq(ridePosts.type, "stream"),
      eq(ridePosts.streamProvider, "agora"),
      eq(ridePosts.isLive, true),
      isNull(ridePosts.endedAt),
    );

    const rows = await db
      .select({
        postId: ridePosts.id,
        driverName: users.name,
        driverPhoto: users.avatar,
        startedAt: ridePosts.createdAt,
        rideStatus: rides.status,
      })
      .from(ridePosts)
      .innerJoin(users, eq(users.id, ridePosts.userId))
      .innerJoin(drivers, eq(drivers.userId, ridePosts.userId))
      .leftJoin(rides, eq(rides.id, ridePosts.rideId))
      .where(
        fleetSession.role === "admin"
          ? baseConditions
          : and(baseConditions, eq(drivers.fleetOwnerId, fleetSession.userId)),
      )
      .orderBy(desc(ridePosts.createdAt));

    const streams = rows.map((r) => ({
      postId: r.postId,
      driverName: r.driverName ?? "Driver",
      driverPhoto: r.driverPhoto ?? null,
      startedAt: r.startedAt,
      rideStatus: r.rideStatus ?? null,
      viewerCount: getAgoraViewerCount(r.postId),
    }));

    res.json({ streams, total: streams.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch live streams";
    res.status(500).json({ error: message });
  }
});

// GET /api/fleet/dashboard/safety-reports — post-ride safety reports for this
// fleet's streamed rides. Flagged/bookmarked moments carry the stream postId
// and the offset in seconds so owners can review them against the timeline.
// Admins see all fleets.
router.get("/api/fleet/dashboard/safety-reports", async (req: Request, res: Response) => {
  try {
    const session = await getSessionUser(req);
    if (denyAccess(session, res)) return;
    const fleetSession = session as SessionUser;

    // Fleet review must never miss a report because the in-process retry
    // chain died with a restart — reconcile (bounded, template-only) first.
    await reconcileSafetyReports().catch(() => {});

    let driverIds: string[] | null = null;
    const driverNames = new Map<string, string>();
    if (fleetSession.role !== "admin") {
      const fleetDrivers = await db
        .select({ id: drivers.id, name: users.name })
        .from(drivers)
        .innerJoin(users, eq(users.id, drivers.userId))
        .where(eq(drivers.fleetOwnerId, fleetSession.userId));
      driverIds = fleetDrivers.map((d) => d.id);
      for (const d of fleetDrivers) driverNames.set(d.id, d.name ?? "Driver");
    }

    const rows = await fleetSafetyReports(driverIds, 20);

    // Admins: resolve names for whichever drivers actually appear.
    if (fleetSession.role === "admin" && rows.length) {
      const ids = Array.from(new Set(rows.map((r) => r.driverId).filter(Boolean))) as string[];
      if (ids.length) {
        const rowsN = await db
          .select({ id: drivers.id, name: users.name })
          .from(drivers)
          .innerJoin(users, eq(users.id, drivers.userId))
          .where(sql`${drivers.id} IN (${sql.join(ids.map((i) => sql`${i}`), sql`, `)})`);
        for (const d of rowsN) driverNames.set(d.id, d.name ?? "Driver");
      }
    }

    res.json({
      reports: rows.map((r) => ({
        rideId: r.rideId,
        driverName: (r.driverId && driverNames.get(r.driverId)) || "Driver",
        status: r.report.status,
        flagCount: r.report.flagCount,
        bookmarkCount: r.report.bookmarkCount,
        summary: r.report.summary,
        generatedAt: r.report.generatedAt,
        completedAt: r.completedAt,
        moments: r.moments.map((m) => ({
          kind: m.kind,
          severity: m.severity,
          postId: m.postId,
          streamOffsetSec: m.streamOffsetSec,
          note: m.note,
        })),
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch safety reports";
    res.status(500).json({ error: message });
  }
});

export { router as fleetDashboardRouter };
