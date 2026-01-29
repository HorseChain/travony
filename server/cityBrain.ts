import { db } from "./db";
import { rides, drivers } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface ZoneMetrics {
  zoneId: string;
  centerLat: number;
  centerLng: number;
  supplyLevel: number;
  demandLevel: number;
  imbalanceScore: number;
  avgWaitTime: number;
  avgAlignmentScore: number;
  guaranteeThreshold: number;
  premiumMultiplier: number;
}

export interface CityDensityType {
  type: "low_density" | "default" | "high_density";
  activeDrivers: number;
  recentRides: number;
  avgRequestsPerHour: number;
}

const ZONE_RADIUS_KM = 3;

function getZoneId(lat: number, lng: number): string {
  const latZone = Math.floor(lat / 0.027);
  const lngZone = Math.floor(lng / 0.027);
  return `${latZone}_${lngZone}`;
}

function getZoneCenter(zoneId: string): { lat: number; lng: number } {
  const [latZone, lngZone] = zoneId.split("_").map(Number);
  return {
    lat: (latZone + 0.5) * 0.027,
    lng: (lngZone + 0.5) * 0.027,
  };
}

export async function getCityDensityType(cityCode?: string): Promise<CityDensityType> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  const activeDrivers = await db.select({ count: sql<number>`count(*)` })
    .from(drivers)
    .where(eq(drivers.isOnline, true));
  
  const recentRidesCount = await db.select({ count: sql<number>`count(*)` })
    .from(rides)
    .where(gte(rides.createdAt, oneDayAgo));
  
  const hourlyRides = await db.select({ count: sql<number>`count(*)` })
    .from(rides)
    .where(gte(rides.createdAt, oneHourAgo));
  
  const driverCount = Number(activeDrivers[0]?.count || 0);
  const rideCount = Number(recentRidesCount[0]?.count || 0);
  const hourlyCount = Number(hourlyRides[0]?.count || 0);
  
  let type: "low_density" | "default" | "high_density";
  
  if (driverCount < 10 || hourlyCount < 5) {
    type = "low_density";
  } else if (driverCount > 100 || hourlyCount > 50) {
    type = "high_density";
  } else {
    type = "default";
  }
  
  return {
    type,
    activeDrivers: driverCount,
    recentRides: rideCount,
    avgRequestsPerHour: hourlyCount,
  };
}

export async function getZoneMetrics(lat: number, lng: number): Promise<ZoneMetrics> {
  const zoneId = getZoneId(lat, lng);
  const center = getZoneCenter(zoneId);
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  const nearbyDrivers = await db.select()
    .from(drivers)
    .where(eq(drivers.isOnline, true));
  
  const zoneDrivers = nearbyDrivers.filter(d => {
    const dLat = parseFloat(d.currentLat || "0");
    const dLng = parseFloat(d.currentLng || "0");
    const distance = Math.sqrt(Math.pow(dLat - lat, 2) + Math.pow(dLng - lng, 2)) * 111;
    return distance < ZONE_RADIUS_KM;
  });
  
  const recentRides = await db.select()
    .from(rides)
    .where(gte(rides.createdAt, oneHourAgo));
  
  const zoneRides = recentRides.filter(r => {
    const rLat = parseFloat(r.pickupLat || "0");
    const rLng = parseFloat(r.pickupLng || "0");
    const distance = Math.sqrt(Math.pow(rLat - lat, 2) + Math.pow(rLng - lng, 2)) * 111;
    return distance < ZONE_RADIUS_KM;
  });
  
  const supplyLevel = Math.min(1, zoneDrivers.length / 10);
  const demandLevel = Math.min(1, zoneRides.length / 20);
  
  const imbalanceScore = demandLevel - supplyLevel;
  
  const completedZoneRides = zoneRides.filter(r => r.status === "completed");
  const avgWaitTime = completedZoneRides.length > 0
    ? completedZoneRides.reduce((sum, r) => {
        const created = new Date(r.createdAt).getTime();
        const accepted = r.acceptedAt ? new Date(r.acceptedAt).getTime() : created;
        return sum + (accepted - created) / 60000;
      }, 0) / completedZoneRides.length
    : 5;
  
  let guaranteeThreshold = 15;
  let premiumMultiplier = 1.0;
  
  if (imbalanceScore > 0.3) {
    guaranteeThreshold = 20;
    premiumMultiplier = 1.2;
  } else if (imbalanceScore > 0.5) {
    guaranteeThreshold = 25;
    premiumMultiplier = 1.4;
  } else if (imbalanceScore < -0.3) {
    guaranteeThreshold = 10;
    premiumMultiplier = 0.9;
  }
  
  return {
    zoneId,
    centerLat: center.lat,
    centerLng: center.lng,
    supplyLevel,
    demandLevel,
    imbalanceScore,
    avgWaitTime,
    avgAlignmentScore: 0.75,
    guaranteeThreshold,
    premiumMultiplier,
  };
}

export async function getAdaptiveAlignmentThresholds(lat: number, lng: number): Promise<{
  instant: number;
  softCommitment: number;
  compensationTrigger: number;
}> {
  const cityDensity = await getCityDensityType();
  const zoneMetrics = await getZoneMetrics(lat, lng);
  
  let instant = 0.85;
  let softCommitment = 0.70;
  let compensationTrigger = 0.50;
  
  if (cityDensity.type === "low_density") {
    instant = 0.70;
    softCommitment = 0.55;
    compensationTrigger = 0.40;
  } else if (cityDensity.type === "high_density") {
    instant = 0.90;
    softCommitment = 0.75;
    compensationTrigger = 0.55;
  }
  
  if (zoneMetrics.imbalanceScore > 0.3) {
    instant -= 0.05;
    softCommitment -= 0.05;
  }
  
  return { instant, softCommitment, compensationTrigger };
}

export async function shouldTriggerGuarantee(
  driverId: string,
  waitTimeMinutes: number
): Promise<{ trigger: boolean; amount: number; reason: string }> {
  const driver = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!driver.length) {
    return { trigger: false, amount: 0, reason: "Driver not found" };
  }
  
  const d = driver[0];
  const lat = parseFloat(d.currentLat || "0");
  const lng = parseFloat(d.currentLng || "0");
  
  const zoneMetrics = await getZoneMetrics(lat, lng);
  
  if (waitTimeMinutes >= zoneMetrics.guaranteeThreshold) {
    const baseAmount = 15;
    const adjustedAmount = baseAmount * zoneMetrics.premiumMultiplier;
    
    return {
      trigger: true,
      amount: Math.round(adjustedAmount * 100) / 100,
      reason: `No aligned ride in ${waitTimeMinutes} minutes (threshold: ${zoneMetrics.guaranteeThreshold})`,
    };
  }
  
  return { trigger: false, amount: 0, reason: "Threshold not reached" };
}

export async function getFlowRecommendation(
  driverLat: number,
  driverLng: number
): Promise<{
  recommendedZone: { lat: number; lng: number } | null;
  reason: string;
  expectedImprovement: number;
}> {
  const currentZone = await getZoneMetrics(driverLat, driverLng);
  
  const adjacentOffsets = [
    { lat: 0.027, lng: 0 },
    { lat: -0.027, lng: 0 },
    { lat: 0, lng: 0.027 },
    { lat: 0, lng: -0.027 },
  ];
  
  let bestZone: { lat: number; lng: number } | null = null;
  let bestImbalance = currentZone.imbalanceScore;
  
  for (const offset of adjacentOffsets) {
    const metrics = await getZoneMetrics(
      driverLat + offset.lat,
      driverLng + offset.lng
    );
    
    if (metrics.imbalanceScore > bestImbalance + 0.1) {
      bestImbalance = metrics.imbalanceScore;
      bestZone = { lat: driverLat + offset.lat, lng: driverLng + offset.lng };
    }
  }
  
  if (bestZone) {
    return {
      recommendedZone: bestZone,
      reason: "Higher demand detected nearby",
      expectedImprovement: (bestImbalance - currentZone.imbalanceScore) * 100,
    };
  }
  
  return {
    recommendedZone: null,
    reason: "Current zone is optimal",
    expectedImprovement: 0,
  };
}
