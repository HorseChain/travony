import { db } from "./db";
import { drivers, rides, users, savedAddresses } from "@shared/schema";
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

// ---------------------------------------------------------------------------
// Smart Rider Destination Suggestions
// ---------------------------------------------------------------------------
// Predicts where a rider is most likely headed *right now* by scoring their own
// completed-ride history on three signals — frequency, recency, and how well
// each destination matches the current time-of-day and day-of-week — then
// merges in saved Home/Work. No new tables: everything is derived from existing
// rides + saved_addresses. All time math is done in the rider's local frame
// using the timezone offset the client passes in.

export interface DestinationSuggestion {
  address: string;
  lat: number;
  lng: number;
  label: string;
  icon: string;
  reason: string;
  score: number;
  savedLabel?: "home" | "work" | null;
}

interface DestAgg {
  lat: number;
  lng: number;
  address: string;
  count: number;
  lastTs: number;
  contextSum: number;
}

function isWeekend(dow: number): boolean {
  // Sunday(0), Friday(5) and Saturday(6) are the common non-work days across
  // the app's regions; treat Fri/Sat/Sun as "weekend" for day-type matching.
  return dow === 5 || dow === 6 || dow === 0;
}

function circularHourDiff(a: number, b: number): number {
  let diff = Math.abs(a - b);
  if (diff > 12) diff = 24 - diff;
  return diff;
}

function shortenAddress(address: string): string {
  const trimmed = address.trim();
  if (trimmed.length <= 22) return trimmed;
  // Prefer the first comma-separated segment when it is reasonably short.
  const first = trimmed.split(",")[0].trim();
  if (first.length > 0 && first.length <= 22) return first;
  return trimmed.slice(0, 21) + "…";
}

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return calculateDistance(lat1, lng1, lat2, lng2) * 1000;
}

export async function getRiderDestinationSuggestions(
  userId: string,
  nowHour: number,
  nowDow: number,
  tzOffsetMinutes: number,
  limit: number = 6
): Promise<{ suggestions: DestinationSuggestion[]; source: "history" | "saved" | "empty" }> {
  const userRides = await db
    .select()
    .from(rides)
    .where(and(eq(rides.customerId, userId), eq(rides.status, "completed")))
    .orderBy(desc(rides.createdAt))
    .limit(200);

  const saved = await db
    .select()
    .from(savedAddresses)
    .where(eq(savedAddresses.userId, userId));

  const homeSaved = saved.find((s) => s.label?.toLowerCase() === "home");
  const workSaved = saved.find((s) => s.label?.toLowerCase() === "work");

  const now = Date.now();
  const aggregates = new Map<string, DestAgg>();

  for (const ride of userRides) {
    const lat = parseFloat(ride.dropoffLat || "0");
    const lng = parseFloat(ride.dropoffLng || "0");
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat === 0 && lng === 0) continue;
    if (!ride.dropoffAddress) continue;

    const ts = ride.createdAt ? new Date(ride.createdAt).getTime() : now;
    const localMs = ts + tzOffsetMinutes * 60 * 1000;
    const localDate = new Date(localMs);
    const rideHour = localDate.getUTCHours();
    const rideDow = localDate.getUTCDay();

    const hourDiff = circularHourDiff(rideHour, nowHour);
    const timeProximity = Math.max(0, 1 - hourDiff / 4); // full within same hour, 0 at 4h+
    const dayBonus = rideDow === nowDow ? 1 : isWeekend(rideDow) === isWeekend(nowDow) ? 0.6 : 0.2;
    const contextContribution = timeProximity * dayBonus;

    const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
    const existing = aggregates.get(key);
    if (existing) {
      existing.count += 1;
      existing.contextSum += contextContribution;
      if (ts > existing.lastTs) {
        existing.lastTs = ts;
        existing.address = ride.dropoffAddress;
      }
    } else {
      aggregates.set(key, {
        lat,
        lng,
        address: ride.dropoffAddress,
        count: 1,
        lastTs: ts,
        contextSum: contextContribution,
      });
    }
  }

  const aggList = Array.from(aggregates.values());
  const hasHistory = aggList.length > 0;

  const maxCount = Math.max(1, ...aggList.map((a) => a.count));
  const maxContext = Math.max(0, ...aggList.map((a) => a.contextSum));

  const suggestions: DestinationSuggestion[] = aggList.map((a) => {
    const freqNorm = a.count / maxCount;
    const daysSinceLast = (now - a.lastTs) / (1000 * 60 * 60 * 24);
    const recencyNorm = Math.exp(-daysSinceLast / 21);
    const contextNorm = maxContext > 0 ? a.contextSum / maxContext : 0;

    const wFreq = 0.3 * freqNorm;
    const wRecency = 0.25 * recencyNorm;
    const wContext = 0.45 * contextNorm;
    const score = wFreq + wRecency + wContext;

    // Match against saved places by proximity so a frequently-visited work
    // destination shows up labeled "Work" but ranked by real context.
    let savedLabel: "home" | "work" | null = null;
    let label = shortenAddress(a.address);
    let icon = "location-outline";
    if (homeSaved && parseFloat(homeSaved.lat) !== 0 &&
        distanceMeters(a.lat, a.lng, parseFloat(homeSaved.lat), parseFloat(homeSaved.lng)) <= 250) {
      savedLabel = "home";
      label = "Home";
      icon = "home-outline";
    } else if (workSaved && parseFloat(workSaved.lat) !== 0 &&
        distanceMeters(a.lat, a.lng, parseFloat(workSaved.lat), parseFloat(workSaved.lng)) <= 250) {
      savedLabel = "work";
      label = "Work";
      icon = "briefcase-outline";
    }

    // Honest reason from the dominant weighted signal.
    let reason: string;
    if (wContext >= wFreq && wContext >= wRecency && contextNorm > 0.15) {
      if (nowHour >= 5 && nowHour < 12) reason = "You usually head here in the mornings";
      else if (nowHour >= 12 && nowHour < 17) reason = "You usually go here around this time";
      else if (nowHour >= 17 && nowHour < 22) reason = "You usually head here in the evenings";
      else reason = "You usually go here around now";
    } else if (wFreq >= wRecency) {
      reason = a.count >= 3 ? "One of your regular spots" : "You've been here before";
    } else {
      reason = "One of your recent trips";
    }

    return { address: a.address, lat: a.lat, lng: a.lng, label, icon, reason, score, savedLabel };
  });

  const matchedSaved = new Set(
    suggestions.map((s) => s.savedLabel).filter((v): v is "home" | "work" => v !== null)
  );

  // Inject saved Home/Work that have no matching history so they never vanish.
  const injectSaved = (
    row: typeof homeSaved,
    kind: "home" | "work",
    labelText: string,
    icon: string
  ) => {
    if (!row || matchedSaved.has(kind)) return;
    const lat = parseFloat(row.lat);
    const lng = parseFloat(row.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
    if (!row.address) return;
    suggestions.push({
      address: row.address,
      lat,
      lng,
      label: labelText,
      icon,
      reason: "Saved place",
      score: hasHistory ? 0.35 : 0.6,
      savedLabel: kind,
    });
  };
  injectSaved(homeSaved, "home", "Home", "home-outline");
  injectSaved(workSaved, "work", "Work", "briefcase-outline");

  suggestions.sort((a, b) => b.score - a.score);
  const trimmed = suggestions.slice(0, limit);

  let source: "history" | "saved" | "empty" = "empty";
  if (hasHistory) source = "history";
  else if (trimmed.length > 0) source = "saved";

  return { suggestions: trimmed, source };
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
