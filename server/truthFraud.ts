import { db } from "./db";
import { truthRides, truthConsent, truthScores, truthSignals } from "@shared/schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";
import type { GpsPoint } from "./truthEngine";

const MAX_USER_INFLUENCE_PERCENT = 15;
const MIN_GPS_POINTS = 5;
const MAX_SPEED_KMH = 200;
const SUSPICIOUS_SUBMISSION_RATE = 20;

export interface FraudCheckResult {
  passed: boolean;
  flags: string[];
  trustWeight: number;
}

export async function validateRideSubmission(
  userId: string,
  providerId: string,
  cityName: string,
  gpsTrace?: GpsPoint[]
): Promise<FraudCheckResult> {
  const flags: string[] = [];
  let trustWeight = 1.0;

  const influenceCheck = await checkUserInfluence(userId, providerId, cityName);
  if (influenceCheck.exceeds) {
    flags.push("user_influence_cap_exceeded");
    trustWeight *= 0.3;
  }

  const rateCheck = await checkSubmissionRate(userId);
  if (rateCheck.suspicious) {
    flags.push("suspicious_submission_rate");
    trustWeight *= 0.5;
  }

  if (gpsTrace && gpsTrace.length > 0) {
    const gpsCheck = validateGpsConsistency(gpsTrace);
    if (!gpsCheck.consistent) {
      flags.push(...gpsCheck.issues);
      trustWeight *= 0.4;
    }
  }

  const duplicateCheck = await checkDuplicateSubmission(userId, providerId);
  if (duplicateCheck.isDuplicate) {
    flags.push("duplicate_submission");
    trustWeight = 0;
  }

  return {
    passed: flags.length === 0,
    flags,
    trustWeight: Math.max(0, trustWeight),
  };
}

async function checkUserInfluence(
  userId: string,
  providerId: string,
  cityName: string
): Promise<{ exceeds: boolean; percentage: number }> {
  const [totalResult] = await db.select({ count: count() })
    .from(truthRides)
    .where(and(
      eq(truthRides.providerId, providerId),
      eq(truthRides.cityName, cityName)
    ));

  const [userResult] = await db.select({ count: count() })
    .from(truthRides)
    .where(and(
      eq(truthRides.userId, userId),
      eq(truthRides.providerId, providerId),
      eq(truthRides.cityName, cityName)
    ));

  const total = totalResult?.count || 0;
  const userCount = userResult?.count || 0;

  if (total < 10) return { exceeds: false, percentage: 0 };

  const percentage = (userCount / total) * 100;
  return {
    exceeds: percentage > MAX_USER_INFLUENCE_PERCENT,
    percentage,
  };
}

async function checkSubmissionRate(userId: string): Promise<{ suspicious: boolean; count: number }> {
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);

  const [result] = await db.select({ count: count() })
    .from(truthRides)
    .where(and(
      eq(truthRides.userId, userId),
      gte(truthRides.createdAt, oneDayAgo)
    ));

  const dayCount = result?.count || 0;
  return {
    suspicious: dayCount > SUSPICIOUS_SUBMISSION_RATE,
    count: dayCount,
  };
}

export function validateGpsConsistency(trace: GpsPoint[]): { consistent: boolean; issues: string[] } {
  const issues: string[] = [];

  if (trace.length < MIN_GPS_POINTS) {
    issues.push("insufficient_gps_points");
    return { consistent: false, issues };
  }

  const timestamps = trace.map(p => p.timestamp);
  for (let i = 1; i < timestamps.length; i++) {
    if (timestamps[i] <= timestamps[i - 1]) {
      issues.push("non_monotonic_timestamps");
      break;
    }
  }

  let teleportCount = 0;
  for (let i = 1; i < trace.length; i++) {
    const dist = haversineKm(trace[i - 1].lat, trace[i - 1].lng, trace[i].lat, trace[i].lng);
    const timeSec = (trace[i].timestamp - trace[i - 1].timestamp) / 1000;
    if (timeSec > 0) {
      const speedKmh = (dist / timeSec) * 3600;
      if (speedKmh > MAX_SPEED_KMH) teleportCount++;
    }
  }

  if (teleportCount > trace.length * 0.1) {
    issues.push("gps_teleportation_detected");
  }

  const uniqueLocations = new Set(trace.map(p => `${p.lat.toFixed(4)}_${p.lng.toFixed(4)}`));
  if (uniqueLocations.size < trace.length * 0.3) {
    issues.push("stationary_gps_pattern");
  }

  return { consistent: issues.length === 0, issues };
}

async function checkDuplicateSubmission(userId: string, providerId: string): Promise<{ isDuplicate: boolean }> {
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

  const [result] = await db.select({ count: count() })
    .from(truthRides)
    .where(and(
      eq(truthRides.userId, userId),
      eq(truthRides.providerId, providerId),
      gte(truthRides.createdAt, tenMinutesAgo)
    ));

  return { isDuplicate: (result?.count || 0) > 0 };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function grantConsent(userId: string, permissions: {
  screenshotCapture?: boolean;
  notificationParsing?: boolean;
  gpsTracking?: boolean;
  postRideConfirmation?: boolean;
}): Promise<void> {
  const [existing] = await db.select().from(truthConsent)
    .where(eq(truthConsent.userId, userId))
    .limit(1);

  if (existing) {
    await db.update(truthConsent)
      .set({
        ...permissions,
        status: "granted",
        updatedAt: new Date(),
      })
      .where(eq(truthConsent.id, existing.id));
  } else {
    await db.insert(truthConsent).values({
      userId,
      screenshotCapture: permissions.screenshotCapture ?? false,
      notificationParsing: permissions.notificationParsing ?? false,
      gpsTracking: permissions.gpsTracking ?? false,
      postRideConfirmation: permissions.postRideConfirmation ?? true,
      status: "granted",
    });
  }
}

export async function revokeConsent(userId: string): Promise<void> {
  await db.update(truthConsent)
    .set({ status: "revoked", revokedAt: new Date(), updatedAt: new Date() })
    .where(eq(truthConsent.userId, userId));
}

export async function deleteUserTruthData(userId: string): Promise<{ deletedRides: number }> {
  const userRides = await db.select({ id: truthRides.id })
    .from(truthRides)
    .where(eq(truthRides.userId, userId));

  for (const ride of userRides) {
    await db.delete(truthSignals).where(eq(truthSignals.truthRideId, ride.id));
    await db.delete(truthScores).where(eq(truthScores.truthRideId, ride.id));
  }

  await db.delete(truthRides).where(eq(truthRides.userId, userId));
  await db.delete(truthConsent).where(eq(truthConsent.userId, userId));

  return { deletedRides: userRides.length };
}
