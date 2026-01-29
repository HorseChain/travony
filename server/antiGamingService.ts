import { db } from "./db";
import { rides, drivers } from "@shared/schema";
import { eq, desc, and, gte, sql } from "drizzle-orm";

export interface AntiGamingFlags {
  entropyScore: number;
  eligibilityDecay: number;
  suspicionLevel: "none" | "low" | "medium" | "high";
  restrictions: string[];
}

interface SessionPattern {
  avgSessionDuration: number;
  sessionsPerDay: number;
  locationVariance: number;
  acceptancePatternScore: number;
}

export async function analyzeDriverEntropy(driverId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentRides = await db.select()
    .from(rides)
    .where(and(
      eq(rides.driverId, driverId),
      gte(rides.createdAt, thirtyDaysAgo)
    ))
    .orderBy(desc(rides.createdAt));
  
  if (recentRides.length < 5) {
    return 1.0;
  }
  
  const uniquePickupZones = new Set<string>();
  const uniqueDropoffZones = new Set<string>();
  const hourDistribution: number[] = new Array(24).fill(0);
  const acceptedRides = recentRides.filter(r => r.status === "completed");
  
  for (const ride of recentRides) {
    const pickupLat = parseFloat(ride.pickupLat || "0");
    const pickupLng = parseFloat(ride.pickupLng || "0");
    const dropoffLat = parseFloat(ride.dropoffLat || "0");
    const dropoffLng = parseFloat(ride.dropoffLng || "0");
    
    uniquePickupZones.add(`${Math.floor(pickupLat * 100)}_${Math.floor(pickupLng * 100)}`);
    uniqueDropoffZones.add(`${Math.floor(dropoffLat * 100)}_${Math.floor(dropoffLng * 100)}`);
    
    const hour = new Date(ride.createdAt).getHours();
    hourDistribution[hour]++;
  }
  
  const zoneVariety = (uniquePickupZones.size + uniqueDropoffZones.size) / (recentRides.length * 2);
  
  const maxHourCount = Math.max(...hourDistribution);
  const hourEntropy = maxHourCount > 0 
    ? 1 - (maxHourCount / recentRides.length)
    : 1.0;
  
  const acceptanceRate = acceptedRides.length / recentRides.length;
  
  const entropyScore = (zoneVariety * 0.4) + (hourEntropy * 0.3) + (acceptanceRate * 0.3);
  
  return Math.round(entropyScore * 100) / 100;
}

export async function calculateEligibilityDecay(driverId: string): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentRides = await db.select()
    .from(rides)
    .where(and(
      eq(rides.driverId, driverId),
      gte(rides.createdAt, sevenDaysAgo)
    ));
  
  const cancelledRides = recentRides.filter(r => r.status === "cancelled");
  const completedRides = recentRides.filter(r => r.status === "completed");
  
  if (recentRides.length === 0) {
    return 1.0;
  }
  
  const cancellationRate = cancelledRides.length / recentRides.length;
  
  let lateArrivals = 0;
  for (const ride of completedRides) {
    if (ride.acceptedAt && ride.startedAt) {
      const acceptTime = new Date(ride.acceptedAt).getTime();
      const startTime = new Date(ride.startedAt).getTime();
      const arrivalMinutes = (startTime - acceptTime) / (1000 * 60);
      
      if (arrivalMinutes > 15) {
        lateArrivals++;
      }
    }
  }
  const lateRate = completedRides.length > 0 
    ? lateArrivals / completedRides.length 
    : 0;
  
  const eligibilityDecay = Math.max(0, 1 - (cancellationRate * 0.5) - (lateRate * 0.3));
  
  return Math.round(eligibilityDecay * 100) / 100;
}

export async function detectSuspiciousPatterns(driverId: string): Promise<{
  level: "none" | "low" | "medium" | "high";
  reasons: string[];
}> {
  const reasons: string[] = [];
  let suspicionScore = 0;
  
  const entropyScore = await analyzeDriverEntropy(driverId);
  if (entropyScore < 0.3) {
    reasons.push("Low location variety - possible zone manipulation");
    suspicionScore += 2;
  } else if (entropyScore < 0.5) {
    reasons.push("Moderate location variety concern");
    suspicionScore += 1;
  }
  
  const eligibilityDecay = await calculateEligibilityDecay(driverId);
  if (eligibilityDecay < 0.5) {
    reasons.push("High cancellation or late arrival rate");
    suspicionScore += 2;
  } else if (eligibilityDecay < 0.7) {
    reasons.push("Elevated cancellation rate");
    suspicionScore += 1;
  }
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const todayRides = await db.select()
    .from(rides)
    .where(and(
      eq(rides.driverId, driverId),
      gte(rides.createdAt, oneDayAgo)
    ));
  
  const acceptedToday = todayRides.filter(r => r.status === "accepted" || r.status === "completed");
  const cancelledToday = todayRides.filter(r => r.status === "cancelled");
  
  if (acceptedToday.length > 0 && cancelledToday.length / acceptedToday.length > 0.3) {
    reasons.push("High same-day cancellation rate");
    suspicionScore += 1;
  }
  
  let level: "none" | "low" | "medium" | "high" = "none";
  if (suspicionScore >= 4) {
    level = "high";
  } else if (suspicionScore >= 2) {
    level = "medium";
  } else if (suspicionScore >= 1) {
    level = "low";
  }
  
  return { level, reasons };
}

export async function getAntiGamingFlags(driverId: string): Promise<AntiGamingFlags> {
  const [entropyScore, eligibilityDecay, suspicionResult] = await Promise.all([
    analyzeDriverEntropy(driverId),
    calculateEligibilityDecay(driverId),
    detectSuspiciousPatterns(driverId),
  ]);
  
  const restrictions: string[] = [];
  
  if (entropyScore < 0.3) {
    restrictions.push("guarantee_ineligible");
  }
  
  if (eligibilityDecay < 0.5) {
    restrictions.push("priority_matching_disabled");
  }
  
  if (suspicionResult.level === "high") {
    restrictions.push("manual_review_required");
    restrictions.push("pmgth_disabled");
  } else if (suspicionResult.level === "medium") {
    restrictions.push("reduced_guarantee_payout");
  }
  
  return {
    entropyScore,
    eligibilityDecay,
    suspicionLevel: suspicionResult.level,
    restrictions,
  };
}

export async function isEligibleForGuarantee(driverId: string): Promise<{
  eligible: boolean;
  reason?: string;
}> {
  const flags = await getAntiGamingFlags(driverId);
  
  if (flags.restrictions.includes("guarantee_ineligible")) {
    return {
      eligible: false,
      reason: "Low location variety detected",
    };
  }
  
  if (flags.restrictions.includes("manual_review_required")) {
    return {
      eligible: false,
      reason: "Account under review",
    };
  }
  
  if (flags.eligibilityDecay < 0.3) {
    return {
      eligible: false,
      reason: "High cancellation rate",
    };
  }
  
  return { eligible: true };
}

export async function getAdjustedGuaranteeAmount(
  driverId: string,
  baseAmount: number
): Promise<number> {
  const flags = await getAntiGamingFlags(driverId);
  
  const eligibility = await isEligibleForGuarantee(driverId);
  if (!eligibility.eligible) {
    return 0;
  }
  
  let multiplier = 1.0;
  
  if (flags.restrictions.includes("reduced_guarantee_payout")) {
    multiplier = 0.7;
  }
  
  multiplier *= flags.eligibilityDecay;
  
  if (flags.entropyScore < 0.5) {
    multiplier *= 0.8;
  }
  
  return Math.round(baseAmount * multiplier * 100) / 100;
}
