import { db } from "./db";
import { hubs, hotspots, rides, drivers, vehicles, carpoolSuggestions, hubCheckIns, type Hub, type Hotspot } from "@shared/schema";
import { eq, and, gte, lte, desc, sql, or } from "drizzle-orm";

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getGridCellId(lat: number, lng: number, cellSizeKm: number = 0.5): string {
  const latDeg = cellSizeKm / 111.0;
  const lngDeg = cellSizeKm / (111.0 * Math.cos(lat * Math.PI / 180));
  const cellLat = Math.floor(lat / latDeg);
  const cellLng = Math.floor(lng / lngDeg);
  return `${cellLat}_${cellLng}`;
}

function getGridCellCenter(cellId: string, refLat: number, cellSizeKm: number = 0.5): { lat: number; lng: number } {
  const [cellLat, cellLng] = cellId.split("_").map(Number);
  const latDeg = cellSizeKm / 111.0;
  const lngDeg = cellSizeKm / (111.0 * Math.cos(refLat * Math.PI / 180));
  return {
    lat: (cellLat + 0.5) * latDeg,
    lng: (cellLng + 0.5) * lngDeg,
  };
}

function calculateDemandScore(rideCount: number, recencyMinutes: number, activeDriverCount: number): number {
  const maxRecency = 120;
  const recencyWeight = Math.max(0, 1 - (recencyMinutes / maxRecency));
  return rideCount * recencyWeight + activeDriverCount * 0.3;
}

interface DetectedHotspot {
  lat: number;
  lng: number;
  demandScore: number;
  supplyCount: number;
  demandCount: number;
  cellId: string;
}

export async function detectHotspots(cityId?: string): Promise<DetectedHotspot[]> {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

  const rideConditions = [gte(rides.createdAt, twoHoursAgo)];
  if (cityId) {
    rideConditions.push(eq(rides.regionCode, cityId));
  }

  const recentRides = await db.select().from(rides).where(and(...rideConditions));

  const onlineDrivers = await db.select().from(drivers).where(eq(drivers.isOnline, true));

  const cellData: Record<string, {
    pickupCount: number;
    dropoffCount: number;
    totalDemand: number;
    latSum: number;
    lngSum: number;
    pointCount: number;
    earliestMinutes: number;
    driverCount: number;
  }> = {};

  const now = Date.now();

  for (const ride of recentRides) {
    const pickupLat = parseFloat(ride.pickupLat);
    const pickupLng = parseFloat(ride.pickupLng);
    const dropoffLat = parseFloat(ride.dropoffLat);
    const dropoffLng = parseFloat(ride.dropoffLng);

    if (isNaN(pickupLat) || isNaN(pickupLng)) continue;

    const pickupCell = getGridCellId(pickupLat, pickupLng, 0.5);
    if (!cellData[pickupCell]) {
      cellData[pickupCell] = { pickupCount: 0, dropoffCount: 0, totalDemand: 0, latSum: 0, lngSum: 0, pointCount: 0, earliestMinutes: 120, driverCount: 0 };
    }
    cellData[pickupCell].pickupCount++;
    cellData[pickupCell].latSum += pickupLat;
    cellData[pickupCell].lngSum += pickupLng;
    cellData[pickupCell].pointCount++;
    const pickupAge = (now - new Date(ride.createdAt).getTime()) / 60000;
    cellData[pickupCell].earliestMinutes = Math.min(cellData[pickupCell].earliestMinutes, pickupAge);

    if (!isNaN(dropoffLat) && !isNaN(dropoffLng)) {
      const dropoffCell = getGridCellId(dropoffLat, dropoffLng, 0.5);
      if (!cellData[dropoffCell]) {
        cellData[dropoffCell] = { pickupCount: 0, dropoffCount: 0, totalDemand: 0, latSum: 0, lngSum: 0, pointCount: 0, earliestMinutes: 120, driverCount: 0 };
      }
      cellData[dropoffCell].dropoffCount++;
      cellData[dropoffCell].latSum += dropoffLat;
      cellData[dropoffCell].lngSum += dropoffLng;
      cellData[dropoffCell].pointCount++;
    }
  }

  for (const driver of onlineDrivers) {
    const dLat = parseFloat(driver.currentLat || "0");
    const dLng = parseFloat(driver.currentLng || "0");
    if (dLat === 0 && dLng === 0) continue;

    const cell = getGridCellId(dLat, dLng, 0.5);
    if (cellData[cell]) {
      cellData[cell].driverCount++;
    }
  }

  const detected: DetectedHotspot[] = [];

  for (const [cellId, data] of Object.entries(cellData)) {
    if (data.pointCount < 2) continue;

    const centerLat = data.latSum / data.pointCount;
    const centerLng = data.lngSum / data.pointCount;
    const totalRides = data.pickupCount + data.dropoffCount;
    const demandScore = calculateDemandScore(totalRides, data.earliestMinutes, data.driverCount);

    detected.push({
      lat: Math.round(centerLat * 1e8) / 1e8,
      lng: Math.round(centerLng * 1e8) / 1e8,
      demandScore: Math.round(demandScore * 100) / 100,
      supplyCount: data.driverCount,
      demandCount: data.pickupCount,
      cellId,
    });
  }

  detected.sort((a, b) => b.demandScore - a.demandScore);

  return detected;
}

export async function updateHubDemand(hubId: string): Promise<{ demandScore: number; updatedAt: Date } | null> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
  if (!hub) return null;

  const hubLat = parseFloat(hub.lat);
  const hubLng = parseFloat(hub.lng);
  const radiusKm = (hub.radiusMeters || 300) / 1000;

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentRides = await db.select().from(rides).where(gte(rides.createdAt, twoHoursAgo));

  const nearbyRides = recentRides.filter(ride => {
    const rLat = parseFloat(ride.pickupLat);
    const rLng = parseFloat(ride.pickupLng);
    return haversineDistance(hubLat, hubLng, rLat, rLng) <= radiusKm;
  });

  const onlineDrivers = await db.select().from(drivers).where(eq(drivers.isOnline, true));
  const nearbyDrivers = onlineDrivers.filter(d => {
    const dLat = parseFloat(d.currentLat || "0");
    const dLng = parseFloat(d.currentLng || "0");
    return haversineDistance(hubLat, hubLng, dLat, dLng) <= radiusKm;
  });

  const now = Date.now();
  const avgRecency = nearbyRides.length > 0
    ? nearbyRides.reduce((sum, r) => sum + (now - new Date(r.createdAt).getTime()) / 60000, 0) / nearbyRides.length
    : 120;

  const demandScore = calculateDemandScore(nearbyRides.length, avgRecency, nearbyDrivers.length);
  const roundedScore = Math.round(demandScore * 100) / 100;

  const updatedAt = new Date();
  await db.update(hubs).set({
    avgDemandScore: roundedScore.toFixed(2),
    lastActivityAt: updatedAt,
    updatedAt,
  }).where(eq(hubs.id, hubId));

  return { demandScore: roundedScore, updatedAt };
}

export async function getHubsNearLocation(lat: number, lng: number, radiusKm: number): Promise<Array<Hub & { distance: number; activeDrivers: number; recentRideCount: number }>> {
  const activeHubs = await db.select().from(hubs).where(eq(hubs.status, "active"));

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentRides = await db.select().from(rides).where(gte(rides.createdAt, twoHoursAgo));
  const onlineDrivers = await db.select().from(drivers).where(eq(drivers.isOnline, true));

  const nearbyHubs: Array<Hub & { distance: number; activeDrivers: number; recentRideCount: number }> = [];

  for (const hub of activeHubs) {
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    const dist = haversineDistance(lat, lng, hubLat, hubLng);

    if (dist > radiusKm) continue;

    const hubRadiusKm = (hub.radiusMeters || 300) / 1000;

    const rideCount = recentRides.filter(r => {
      const rLat = parseFloat(r.pickupLat);
      const rLng = parseFloat(r.pickupLng);
      return haversineDistance(hubLat, hubLng, rLat, rLng) <= hubRadiusKm;
    }).length;

    const driverCount = onlineDrivers.filter(d => {
      const dLat = parseFloat(d.currentLat || "0");
      const dLng = parseFloat(d.currentLng || "0");
      return haversineDistance(hubLat, hubLng, dLat, dLng) <= hubRadiusKm;
    }).length;

    nearbyHubs.push({
      ...hub,
      distance: Math.round(dist * 1000) / 1000,
      activeDrivers: driverCount,
      recentRideCount: rideCount,
    });
  }

  nearbyHubs.sort((a, b) => a.distance - b.distance);
  return nearbyHubs;
}

export async function getHotspotsForMap(cityId?: string, regionCode?: string): Promise<Array<{
  lat: number;
  lng: number;
  intensity: number;
  supplyCount: number;
  demandCount: number;
  yieldEstimate: number;
}>> {
  const conditions = [eq(hotspots.isActive, true)];
  if (cityId) conditions.push(eq(hotspots.cityId, cityId));
  if (regionCode) conditions.push(eq(hotspots.regionCode, regionCode));

  const activeHotspots = await db.select().from(hotspots).where(and(...conditions));

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentRides = await db.select({
    avgFare: sql<string>`coalesce(avg(cast(${rides.actualFare} as numeric)), avg(cast(${rides.estimatedFare} as numeric)), 0)`,
  }).from(rides).where(and(
    gte(rides.createdAt, twoHoursAgo),
    eq(rides.status, "completed"),
  ));

  const avgFare = parseFloat(recentRides[0]?.avgFare || "15");

  return activeHotspots.map(h => {
    const demand = parseFloat(h.demandScore);
    const supply = h.supplyCount || 0;
    const demandCount = h.demandCount || 0;
    const peakMult = parseFloat(h.peakMultiplier || "1.00");

    const maxDemand = 20;
    const intensity = Math.min(1, demand / maxDemand);

    const supplyDemandRatio = supply > 0 ? demandCount / supply : demandCount;
    const yieldEstimate = Math.round(avgFare * peakMult * Math.min(3, Math.max(1, supplyDemandRatio)) * 100) / 100;

    return {
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lng),
      intensity: Math.round(intensity * 100) / 100,
      supplyCount: supply,
      demandCount,
      yieldEstimate,
    };
  });
}

export async function getDriverYieldEstimate(hubId: string, vehicleType: string): Promise<{
  estimatedYieldPerHour: number;
  avgFareInArea: number;
  ridesPerHour: number;
  demandLevel: string;
  confidence: number;
}> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
  if (!hub) {
    return { estimatedYieldPerHour: 0, avgFareInArea: 0, ridesPerHour: 0, demandLevel: "low", confidence: 0 };
  }

  const hubLat = parseFloat(hub.lat);
  const hubLng = parseFloat(hub.lng);
  const radiusKm = (hub.radiusMeters || 300) / 1000;

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const completedRides = await db.select().from(rides).where(and(
    gte(rides.createdAt, sixHoursAgo),
    eq(rides.status, "completed"),
  ));

  const nearbyRides = completedRides.filter(r => {
    const rLat = parseFloat(r.pickupLat);
    const rLng = parseFloat(r.pickupLng);
    return haversineDistance(hubLat, hubLng, rLat, rLng) <= radiusKm;
  });

  const vehicleRides = nearbyRides.filter(r => {
    if (!r.vehicleId) return true;
    return true;
  });

  const matchingVehicles = await db.select().from(vehicles).where(eq(vehicles.type, vehicleType as any));
  const matchingDriverIds = new Set(matchingVehicles.map(v => v.driverId));
  const typeFilteredRides = vehicleRides.filter(r => !r.driverId || matchingDriverIds.has(r.driverId));

  const ridesToAnalyze = typeFilteredRides.length >= 3 ? typeFilteredRides : nearbyRides;
  const totalFare = ridesToAnalyze.reduce((sum, r) => sum + parseFloat(r.actualFare || r.estimatedFare || "0"), 0);
  const avgFare = ridesToAnalyze.length > 0 ? totalFare / ridesToAnalyze.length : 15;
  const hoursWindow = 6;
  const ridesPerHour = ridesToAnalyze.length / hoursWindow;

  const estimatedYieldPerHour = Math.round(avgFare * ridesPerHour * 100) / 100;

  let demandLevel: string;
  if (ridesPerHour >= 5) demandLevel = "very_high";
  else if (ridesPerHour >= 3) demandLevel = "high";
  else if (ridesPerHour >= 1) demandLevel = "medium";
  else demandLevel = "low";

  const confidence = Math.min(1, ridesToAnalyze.length / 10);

  return {
    estimatedYieldPerHour,
    avgFareInArea: Math.round(avgFare * 100) / 100,
    ridesPerHour: Math.round(ridesPerHour * 100) / 100,
    demandLevel,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export async function getHubRecommendationsForDriver(driverId: string, lat: number, lng: number): Promise<Array<{
  hubId: string;
  hubName: string;
  distance: number;
  yieldEstimate: number;
  demandLevel: string;
  predictedWaitMinutes: number;
  score: number;
}>> {
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, driverId));
  if (!driver) return [];

  const driverVehicles = await db.select().from(vehicles).where(
    and(eq(vehicles.driverId, driverId), eq(vehicles.isActive, true))
  );
  const vehicleType = driverVehicles.length > 0 ? driverVehicles[0].type : "economy";

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const driverHistory = await db.select().from(rides).where(and(
    eq(rides.driverId, driverId),
    gte(rides.createdAt, thirtyDaysAgo),
    eq(rides.status, "completed"),
  )).orderBy(desc(rides.createdAt)).limit(50);

  const preferredAreas: Array<{ lat: number; lng: number; count: number }> = [];
  const areaCounts: Record<string, { lat: number; lng: number; count: number }> = {};
  for (const ride of driverHistory) {
    const cellId = getGridCellId(parseFloat(ride.pickupLat), parseFloat(ride.pickupLng), 1);
    if (!areaCounts[cellId]) {
      areaCounts[cellId] = { lat: parseFloat(ride.pickupLat), lng: parseFloat(ride.pickupLng), count: 0 };
    }
    areaCounts[cellId].count++;
  }
  for (const area of Object.values(areaCounts)) {
    preferredAreas.push(area);
  }

  const nearbyHubs = await getHubsNearLocation(lat, lng, 10);

  const recommendations: Array<{
    hubId: string;
    hubName: string;
    distance: number;
    yieldEstimate: number;
    demandLevel: string;
    predictedWaitMinutes: number;
    score: number;
  }> = [];

  for (const hub of nearbyHubs) {
    const yieldData = await getDriverYieldEstimate(hub.id, vehicleType);

    const demandScore = parseFloat(hub.avgDemandScore || "0");
    const predictedWaitMinutes = yieldData.ridesPerHour > 0
      ? Math.round(60 / yieldData.ridesPerHour)
      : 30;

    let affinityBonus = 0;
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    for (const area of preferredAreas) {
      if (haversineDistance(hubLat, hubLng, area.lat, area.lng) < 2) {
        affinityBonus = Math.min(0.2, area.count * 0.02);
        break;
      }
    }

    const distancePenalty = Math.max(0, 1 - (hub.distance / 10));
    const yieldNormalized = Math.min(1, yieldData.estimatedYieldPerHour / 100);
    const demandNormalized = Math.min(1, demandScore / 10);

    const score = (yieldNormalized * 0.35) + (demandNormalized * 0.25) + (distancePenalty * 0.2) + (affinityBonus) + (yieldData.confidence * 0.2);

    recommendations.push({
      hubId: hub.id,
      hubName: hub.name,
      distance: hub.distance,
      yieldEstimate: yieldData.estimatedYieldPerHour,
      demandLevel: yieldData.demandLevel,
      predictedWaitMinutes,
      score: Math.round(score * 100) / 100,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 3);
}

export async function getHubRecommendationsForRider(userId: string, lat: number, lng: number): Promise<Array<{
  hubId: string;
  hubName: string;
  distance: number;
  availableVehicles: number;
  estimatedPickupMinutes: number;
  hubType: string;
  score: number;
}>> {
  const nearbyHubs = await getHubsNearLocation(lat, lng, 5);

  const userHistory = await db.select().from(rides).where(
    eq(rides.customerId, userId)
  ).orderBy(desc(rides.createdAt)).limit(20);

  const frequentPickupAreas: Record<string, number> = {};
  for (const ride of userHistory) {
    const cellId = getGridCellId(parseFloat(ride.pickupLat), parseFloat(ride.pickupLng), 1);
    frequentPickupAreas[cellId] = (frequentPickupAreas[cellId] || 0) + 1;
  }

  const recommendations: Array<{
    hubId: string;
    hubName: string;
    distance: number;
    availableVehicles: number;
    estimatedPickupMinutes: number;
    hubType: string;
    score: number;
  }> = [];

  for (const hub of nearbyHubs) {
    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);

    const walkMinutes = Math.round((hub.distance / 5) * 60);
    const estimatedPickupMinutes = hub.activeDrivers > 0
      ? Math.max(1, Math.round(3 + (hub.distance * 2) - Math.log2(hub.activeDrivers + 1)))
      : walkMinutes + 5;

    let familiarityBonus = 0;
    const hubCell = getGridCellId(hubLat, hubLng, 1);
    if (frequentPickupAreas[hubCell]) {
      familiarityBonus = Math.min(0.15, frequentPickupAreas[hubCell] * 0.03);
    }

    const proximityScore = Math.max(0, 1 - (hub.distance / 5));
    const vehicleDensityScore = Math.min(1, hub.activeDrivers / 5);
    const pickupTimeScore = Math.max(0, 1 - (estimatedPickupMinutes / 20));

    const score = (proximityScore * 0.3) + (vehicleDensityScore * 0.3) + (pickupTimeScore * 0.25) + familiarityBonus + 0.15 * Math.min(1, hub.recentRideCount / 10);

    recommendations.push({
      hubId: hub.id,
      hubName: hub.name,
      distance: hub.distance,
      availableVehicles: hub.activeDrivers,
      estimatedPickupMinutes,
      hubType: hub.type,
      score: Math.round(score * 100) / 100,
    });
  }

  recommendations.sort((a, b) => b.score - a.score);
  return recommendations.slice(0, 3);
}

export async function generateSmartPrompt(userId: string, role: string, lat: number, lng: number): Promise<{
  title: string;
  message: string;
  actionType: string;
  data: Record<string, any>;
}> {
  if (role === "driver") {
    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
    if (!driver) {
      return { title: "Welcome", message: "Set up your driver profile to start earning.", actionType: "setup", data: {} };
    }

    const recommendations = await getHubRecommendationsForDriver(driver.id, lat, lng);
    if (recommendations.length > 0) {
      const top = recommendations[0];
      if (top.demandLevel === "very_high" || top.demandLevel === "high") {
        return {
          title: "High Demand Nearby",
          message: `${top.hubName} has ${top.demandLevel.replace("_", " ")} demand. Estimated yield: ${top.yieldEstimate.toFixed(2)}/hr, ${top.distance.toFixed(1)}km away.`,
          actionType: "navigate_to_hub",
          data: { hubId: top.hubId, yieldEstimate: top.yieldEstimate, distance: top.distance },
        };
      }

      return {
        title: "Earning Opportunity",
        message: `Head to ${top.hubName} (${top.distance.toFixed(1)}km) for an estimated ${top.yieldEstimate.toFixed(2)}/hr. Wait time ~${top.predictedWaitMinutes} min.`,
        actionType: "navigate_to_hub",
        data: { hubId: top.hubId, yieldEstimate: top.yieldEstimate, predictedWaitMinutes: top.predictedWaitMinutes },
      };
    }

    const detectedHotspots = await detectHotspots();
    if (detectedHotspots.length > 0) {
      const nearest = detectedHotspots
        .map(h => ({ ...h, dist: haversineDistance(lat, lng, h.lat, h.lng) }))
        .sort((a, b) => a.dist - b.dist)[0];

      return {
        title: "Hotspot Detected",
        message: `Activity cluster ${nearest.dist.toFixed(1)}km away with ${nearest.demandCount} recent requests.`,
        actionType: "navigate_to_hotspot",
        data: { lat: nearest.lat, lng: nearest.lng, demandScore: nearest.demandScore },
      };
    }

    return {
      title: "Steady Area",
      message: "No high-demand zones detected nearby. Stay online for the next ride request.",
      actionType: "none",
      data: {},
    };
  }

  const riderRecommendations = await getHubRecommendationsForRider(userId, lat, lng);
  if (riderRecommendations.length > 0) {
    const top = riderRecommendations[0];
    if (top.availableVehicles > 0) {
      return {
        title: "Quick Pickup Available",
        message: `${top.availableVehicles} vehicle${top.availableVehicles > 1 ? "s" : ""} near ${top.hubName}. Estimated pickup in ${top.estimatedPickupMinutes} min.`,
        actionType: "book_from_hub",
        data: { hubId: top.hubId, availableVehicles: top.availableVehicles, estimatedPickupMinutes: top.estimatedPickupMinutes },
      };
    }
  }

  const onlineDrivers = await db.select().from(drivers).where(eq(drivers.isOnline, true));
  const nearbyCount = onlineDrivers.filter(d => {
    const dLat = parseFloat(d.currentLat || "0");
    const dLng = parseFloat(d.currentLng || "0");
    return haversineDistance(lat, lng, dLat, dLng) <= 3;
  }).length;

  if (nearbyCount > 0) {
    return {
      title: "Drivers Available",
      message: `${nearbyCount} driver${nearbyCount > 1 ? "s" : ""} within 3km of your location. Book now for fast pickup.`,
      actionType: "book_ride",
      data: { nearbyDrivers: nearbyCount },
    };
  }

  return {
    title: "Limited Availability",
    message: "Few drivers nearby right now. Try booking in a few minutes or walk to a nearby hub for faster pickup.",
    actionType: "show_hubs",
    data: {},
  };
}

export async function suggestCarpoolMatches(
  hubId: string,
  riderId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
): Promise<Array<{
  matchedRiderId: string;
  routeOverlapPercent: number;
  estimatedSavings: number;
  pickupDistance: number;
  dropoffDistance: number;
}>> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentCheckIns = await db.select().from(hubCheckIns).where(and(
    eq(hubCheckIns.hubId, hubId),
    gte(hubCheckIns.checkedInAt, oneHourAgo),
  ));

  const potentialRiderIds = recentCheckIns
    .filter(c => c.userId !== riderId && c.userRole === "customer")
    .map(c => c.userId);

  if (potentialRiderIds.length === 0) {
    const pendingRides = await db.select().from(rides).where(and(
      eq(rides.status, "pending"),
      gte(rides.createdAt, oneHourAgo),
    ));

    for (const ride of pendingRides) {
      if (ride.customerId !== riderId) {
        potentialRiderIds.push(ride.customerId);
      }
    }
  }

  const uniqueRiderIds = [...new Set(potentialRiderIds)];

  const recentPendingRides = await db.select().from(rides).where(and(
    gte(rides.createdAt, oneHourAgo),
    or(eq(rides.status, "pending"), eq(rides.status, "accepted")),
  ));

  const matches: Array<{
    matchedRiderId: string;
    routeOverlapPercent: number;
    estimatedSavings: number;
    pickupDistance: number;
    dropoffDistance: number;
  }> = [];

  for (const candidateId of uniqueRiderIds) {
    const candidateRides = recentPendingRides.filter(r => r.customerId === candidateId);
    if (candidateRides.length === 0) continue;

    const candidate = candidateRides[0];
    const cPickupLat = parseFloat(candidate.pickupLat);
    const cPickupLng = parseFloat(candidate.pickupLng);
    const cDropoffLat = parseFloat(candidate.dropoffLat);
    const cDropoffLng = parseFloat(candidate.dropoffLng);

    const pickupDist = haversineDistance(pickupLat, pickupLng, cPickupLat, cPickupLng);
    const dropoffDist = haversineDistance(dropoffLat, dropoffLng, cDropoffLat, cDropoffLng);

    if (pickupDist > 2 || dropoffDist > 3) continue;

    const myRouteLen = haversineDistance(pickupLat, pickupLng, dropoffLat, dropoffLng);
    const theirRouteLen = haversineDistance(cPickupLat, cPickupLng, cDropoffLat, cDropoffLng);
    const combinedDetour = pickupDist + dropoffDist;
    const avgRouteLen = (myRouteLen + theirRouteLen) / 2;
    const overlapPercent = Math.max(0, Math.min(100, (1 - combinedDetour / (avgRouteLen + 0.001)) * 100));

    if (overlapPercent < 30) continue;

    const baseFare = parseFloat(candidate.estimatedFare || "20");
    const estimatedSavings = Math.round(baseFare * (overlapPercent / 100) * 0.4 * 100) / 100;

    matches.push({
      matchedRiderId: candidateId,
      routeOverlapPercent: Math.round(overlapPercent * 100) / 100,
      estimatedSavings,
      pickupDistance: Math.round(pickupDist * 1000) / 1000,
      dropoffDistance: Math.round(dropoffDist * 1000) / 1000,
    });

    await db.insert(carpoolSuggestions).values({
      hubId,
      riderId,
      matchedRiderId: candidateId,
      pickupLat: pickupLat.toString(),
      pickupLng: pickupLng.toString(),
      dropoffLat: dropoffLat.toString(),
      dropoffLng: dropoffLng.toString(),
      routeOverlapPercent: overlapPercent.toFixed(2),
      estimatedSavings: estimatedSavings.toFixed(2),
      status: "suggested",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    } as any);
  }

  matches.sort((a, b) => b.routeOverlapPercent - a.routeOverlapPercent);
  return matches;
}

export async function cleanupExpiredHotspots(): Promise<{ removedCount: number; updatedHubCount: number }> {
  const now = new Date();

  const expiredHotspots = await db.select().from(hotspots).where(and(
    eq(hotspots.isActive, true),
    lte(hotspots.expiresAt, now),
  ));

  let removedCount = 0;
  const affectedHubIds = new Set<string>();

  for (const hotspot of expiredHotspots) {
    await db.update(hotspots).set({ isActive: false }).where(eq(hotspots.id, hotspot.id));
    removedCount++;
    if (hotspot.hubId) {
      affectedHubIds.add(hotspot.hubId);
    }
  }

  const staleThreshold = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const staleHotspots = await db.select().from(hotspots).where(and(
    eq(hotspots.isActive, true),
    lte(hotspots.createdAt, staleThreshold),
  ));

  for (const hotspot of staleHotspots) {
    if (hotspot.expiresAt && new Date(hotspot.expiresAt) > now) continue;
    await db.update(hotspots).set({ isActive: false }).where(eq(hotspots.id, hotspot.id));
    removedCount++;
    if (hotspot.hubId) {
      affectedHubIds.add(hotspot.hubId);
    }
  }

  let updatedHubCount = 0;
  for (const hubId of affectedHubIds) {
    await updateHubDemand(hubId);
    updatedHubCount++;
  }

  const expiredSuggestions = await db.select().from(carpoolSuggestions).where(and(
    eq(carpoolSuggestions.status, "suggested"),
    lte(carpoolSuggestions.expiresAt, now),
  ));

  for (const suggestion of expiredSuggestions) {
    await db.update(carpoolSuggestions).set({ status: "expired" }).where(eq(carpoolSuggestions.id, suggestion.id));
  }

  return { removedCount, updatedHubCount };
}
