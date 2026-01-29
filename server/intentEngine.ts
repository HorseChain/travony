import { db } from "./db";
import { drivers, rides, users } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface DriverIntentVector {
  directionality: number;
  timeConstraint: number;
  earningsUrgency: number;
  tripPreference: number;
  zoneAffinity: number;
  fatigueIndex: number;
}

export interface RiderIntentVector {
  priority: number;
  flexibility: number;
  pickupUrgency: number;
  destinationConstraint: number;
  reliabilitySensitivity: number;
}

export interface IntentAlignment {
  score: number;
  matchType: "instant" | "soft_commitment" | "wait_or_compensate";
  confidence: number;
}

interface DriverTelemetry {
  currentLat: number;
  currentLng: number;
  heading?: number;
  sessionStartTime: Date;
  homeAddress?: { lat: number; lng: number };
  recentAcceptanceRate: number;
  recentCancellations: number;
  todayEarnings: number;
  avgDailyEarnings: number;
  ridesCompletedToday: number;
  avgRidesPerDay: number;
}

interface RiderContext {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  priority: "fastest" | "cheapest" | "reliable";
  rideHistory: number;
  avgWaitTolerance: number;
  cancellationHistory: number;
}

const CITY_WEIGHTS = {
  default: {
    directionality: 0.25,
    timeConstraint: 0.15,
    earningsUrgency: 0.10,
    tripPreference: 0.15,
    zoneAffinity: 0.15,
    fatigueIndex: 0.20,
  },
  low_density: {
    directionality: 0.15,
    timeConstraint: 0.10,
    earningsUrgency: 0.15,
    tripPreference: 0.20,
    zoneAffinity: 0.20,
    fatigueIndex: 0.20,
  },
  high_density: {
    directionality: 0.30,
    timeConstraint: 0.20,
    earningsUrgency: 0.05,
    tripPreference: 0.15,
    zoneAffinity: 0.10,
    fatigueIndex: 0.20,
  },
};

const ALIGNMENT_THRESHOLDS = {
  instant: 0.85,
  soft_commitment: 0.70,
};

function calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const x = Math.sin(dLng) * Math.cos(lat2Rad);
  const y = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  return (Math.atan2(x, y) * 180 / Math.PI + 360) % 360;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeAngleDiff(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2);
  if (diff > 180) diff = 360 - diff;
  return 1 - (diff / 180);
}

export function computeDriverIntentVector(telemetry: DriverTelemetry): DriverIntentVector {
  const sessionHours = (Date.now() - telemetry.sessionStartTime.getTime()) / (1000 * 60 * 60);
  
  let directionality = 0;
  if (telemetry.homeAddress && telemetry.heading !== undefined) {
    const homeHeading = calculateBearing(
      telemetry.currentLat, telemetry.currentLng,
      telemetry.homeAddress.lat, telemetry.homeAddress.lng
    );
    directionality = normalizeAngleDiff(telemetry.heading, homeHeading) * 2 - 1;
  }
  
  const timeConstraint = Math.min(1, sessionHours / 8);
  
  const earningsGap = telemetry.avgDailyEarnings > 0 
    ? Math.max(0, 1 - (telemetry.todayEarnings / telemetry.avgDailyEarnings))
    : 0.5;
  const earningsUrgency = earningsGap;
  
  const ridesGap = telemetry.avgRidesPerDay > 0
    ? telemetry.ridesCompletedToday / telemetry.avgRidesPerDay
    : 0.5;
  const tripPreference = ridesGap < 0.5 ? 0.3 : ridesGap > 1 ? 0.7 : 0.5;
  
  const zoneAffinity = telemetry.recentAcceptanceRate;
  
  const fatigueIndex = Math.min(1, (sessionHours / 10) + (telemetry.recentCancellations * 0.1));
  
  return {
    directionality: Math.max(-1, Math.min(1, directionality)),
    timeConstraint: Math.max(0, Math.min(1, timeConstraint)),
    earningsUrgency: Math.max(0, Math.min(1, earningsUrgency)),
    tripPreference: Math.max(0, Math.min(1, tripPreference)),
    zoneAffinity: Math.max(0, Math.min(1, zoneAffinity)),
    fatigueIndex: Math.max(0, Math.min(1, fatigueIndex)),
  };
}

export function computeRiderIntentVector(context: RiderContext): RiderIntentVector {
  let priority = 0.5;
  switch (context.priority) {
    case "fastest":
      priority = 1.0;
      break;
    case "cheapest":
      priority = 0.0;
      break;
    case "reliable":
      priority = 0.5;
      break;
  }
  
  const tripDistance = calculateDistance(
    context.pickupLat, context.pickupLng,
    context.dropoffLat, context.dropoffLng
  );
  
  const flexibility = context.rideHistory > 10 
    ? Math.max(0.2, 1 - (context.cancellationHistory / context.rideHistory))
    : 0.5;
  
  const pickupUrgency = context.priority === "fastest" ? 0.9 : 0.5;
  
  const destinationConstraint = tripDistance > 15 ? 0.8 : tripDistance > 5 ? 0.5 : 0.3;
  
  const reliabilitySensitivity = context.priority === "reliable" ? 0.9 
    : context.cancellationHistory > 2 ? 0.7 : 0.4;
  
  return {
    priority: Math.max(0, Math.min(1, priority)),
    flexibility: Math.max(0, Math.min(1, flexibility)),
    pickupUrgency: Math.max(0, Math.min(1, pickupUrgency)),
    destinationConstraint: Math.max(0, Math.min(1, destinationConstraint)),
    reliabilitySensitivity: Math.max(0, Math.min(1, reliabilitySensitivity)),
  };
}

export function calculateAlignmentScore(
  driverVector: DriverIntentVector,
  riderVector: RiderIntentVector,
  driverLat: number,
  driverLng: number,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  cityType: "default" | "low_density" | "high_density" = "default"
): IntentAlignment {
  const weights = CITY_WEIGHTS[cityType];
  
  const pickupDistance = calculateDistance(driverLat, driverLng, pickupLat, pickupLng);
  const pickupProximity = Math.max(0, 1 - (pickupDistance / 10));
  
  let directionMatch = 0.5;
  if (driverVector.directionality > 0) {
    const dropoffBearing = calculateBearing(driverLat, driverLng, dropoffLat, dropoffLng);
    const driverHeading = (driverVector.directionality + 1) * 180;
    directionMatch = normalizeAngleDiff(dropoffBearing, driverHeading);
  }
  
  const timeMatch = 1 - Math.abs(driverVector.timeConstraint - riderVector.pickupUrgency);
  
  const priorityMatch = riderVector.priority === 1.0 
    ? (1 - driverVector.fatigueIndex) 
    : riderVector.priority === 0.0 
      ? driverVector.earningsUrgency 
      : (1 - driverVector.fatigueIndex) * 0.5 + 0.5;
  
  const zoneMatch = driverVector.zoneAffinity;
  
  const reliabilityMatch = riderVector.reliabilitySensitivity < 0.5 
    ? 0.8 
    : (1 - driverVector.fatigueIndex) * driverVector.zoneAffinity;
  
  const weightedScore = (
    directionMatch * weights.directionality +
    timeMatch * weights.timeConstraint +
    priorityMatch * weights.earningsUrgency +
    (1 - Math.abs(driverVector.tripPreference - riderVector.destinationConstraint)) * weights.tripPreference +
    zoneMatch * weights.zoneAffinity +
    (1 - driverVector.fatigueIndex) * weights.fatigueIndex
  );
  
  const proximityBonus = pickupProximity * 0.15;
  const finalScore = Math.min(1, weightedScore + proximityBonus);
  
  let matchType: "instant" | "soft_commitment" | "wait_or_compensate";
  if (finalScore >= ALIGNMENT_THRESHOLDS.instant) {
    matchType = "instant";
  } else if (finalScore >= ALIGNMENT_THRESHOLDS.soft_commitment) {
    matchType = "soft_commitment";
  } else {
    matchType = "wait_or_compensate";
  }
  
  const confidence = finalScore * (1 - driverVector.fatigueIndex * 0.3) * riderVector.flexibility;
  
  return {
    score: Math.round(finalScore * 100) / 100,
    matchType,
    confidence: Math.round(confidence * 100) / 100,
  };
}

export async function getDriverTelemetry(driverId: string): Promise<DriverTelemetry | null> {
  const driver = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!driver.length) return null;
  
  const d = driver[0];
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentRides = await db.select()
    .from(rides)
    .where(and(
      eq(rides.driverId, driverId),
      gte(rides.createdAt, thirtyDaysAgo)
    ))
    .orderBy(desc(rides.createdAt));
  
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  
  const todayRides = recentRides.filter(r => r.createdAt >= todayStart && r.status === "completed");
  const todayEarnings = todayRides.reduce((sum, r) => sum + parseFloat(r.actualFare || r.estimatedFare || "0"), 0);
  
  const completedRides = recentRides.filter(r => r.status === "completed");
  const cancelledRides = recentRides.filter(r => r.status === "cancelled");
  
  const totalDays = Math.max(1, Math.ceil((Date.now() - thirtyDaysAgo.getTime()) / (1000 * 60 * 60 * 24)));
  const avgDailyEarnings = completedRides.reduce((sum, r) => sum + parseFloat(r.actualFare || r.estimatedFare || "0"), 0) / totalDays;
  const avgRidesPerDay = completedRides.length / totalDays;
  
  const acceptanceRate = recentRides.length > 0 
    ? completedRides.length / recentRides.length 
    : 0.8;
  
  let homeAddress: { lat: number; lng: number } | undefined;
  try {
    if ((d as any).homeAddress) {
      const parsed = JSON.parse((d as any).homeAddress as string);
      if (parsed.lat && parsed.lng) {
        homeAddress = { lat: parsed.lat, lng: parsed.lng };
      }
    }
  } catch {}
  
  return {
    currentLat: parseFloat(d.currentLat || "0"),
    currentLng: parseFloat(d.currentLng || "0"),
    heading: (d as any).currentHeading ? parseFloat((d as any).currentHeading) : undefined,
    sessionStartTime: (d as any).lastOnlineAt || new Date(),
    homeAddress,
    recentAcceptanceRate: acceptanceRate,
    recentCancellations: cancelledRides.length,
    todayEarnings,
    avgDailyEarnings,
    ridesCompletedToday: todayRides.length,
    avgRidesPerDay,
  };
}

export async function getRiderContext(
  userId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  priority: "fastest" | "cheapest" | "reliable"
): Promise<RiderContext> {
  const userRides = await db.select()
    .from(rides)
    .where(eq(rides.customerId, userId))
    .orderBy(desc(rides.createdAt))
    .limit(50);
  
  const completedRides = userRides.filter(r => r.status === "completed");
  const cancelledRides = userRides.filter(r => r.status === "cancelled");
  
  return {
    pickupLat,
    pickupLng,
    dropoffLat,
    dropoffLng,
    priority,
    rideHistory: completedRides.length,
    avgWaitTolerance: 5,
    cancellationHistory: cancelledRides.length,
  };
}

export async function findAlignedDrivers(
  userId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  priority: "fastest" | "cheapest" | "reliable" = "reliable",
  cityType: "default" | "low_density" | "high_density" = "default"
): Promise<Array<{
  driverId: string;
  alignment: IntentAlignment;
  driverVector: DriverIntentVector;
  distance: number;
}>> {
  const onlineDrivers = await db.select()
    .from(drivers)
    .where(eq(drivers.isOnline, true));
  
  const riderContext = await getRiderContext(userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority);
  const riderVector = computeRiderIntentVector(riderContext);
  
  const alignedDrivers: Array<{
    driverId: string;
    alignment: IntentAlignment;
    driverVector: DriverIntentVector;
    distance: number;
  }> = [];
  
  for (const driver of onlineDrivers) {
    const telemetry = await getDriverTelemetry(driver.id);
    if (!telemetry) continue;
    
    const driverVector = computeDriverIntentVector(telemetry);
    const driverLat = parseFloat(driver.currentLat || "0");
    const driverLng = parseFloat(driver.currentLng || "0");
    
    if (driverLat === 0 && driverLng === 0) continue;
    
    const distance = calculateDistance(driverLat, driverLng, pickupLat, pickupLng);
    
    if (distance > 15) continue;
    
    const alignment = calculateAlignmentScore(
      driverVector,
      riderVector,
      driverLat,
      driverLng,
      pickupLat,
      pickupLng,
      dropoffLat,
      dropoffLng,
      cityType
    );
    
    alignedDrivers.push({
      driverId: driver.id,
      alignment,
      driverVector,
      distance,
    });
  }
  
  alignedDrivers.sort((a, b) => b.alignment.score - a.alignment.score);
  
  return alignedDrivers;
}

export async function getBestAlignedDriver(
  userId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  priority: "fastest" | "cheapest" | "reliable" = "reliable"
): Promise<{
  driverId: string;
  alignment: IntentAlignment;
  distance: number;
} | null> {
  const aligned = await findAlignedDrivers(userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority);
  
  if (aligned.length === 0) return null;
  
  const instantMatches = aligned.filter(d => d.alignment.matchType === "instant");
  if (instantMatches.length > 0) {
    return instantMatches[0];
  }
  
  const softMatches = aligned.filter(d => d.alignment.matchType === "soft_commitment");
  if (softMatches.length > 0) {
    return softMatches[0];
  }
  
  return aligned[0];
}
