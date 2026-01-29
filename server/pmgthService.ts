import { db } from "./db";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import {
  pmgthSessions,
  pmgthRideMatches,
  pmgthDailyUsage,
  drivers,
  rides,
  savedAddresses,
  type PmgthSession,
  type PmgthRideMatch,
} from "../shared/schema";

interface LatLng {
  lat: number;
  lng: number;
}

interface DirectionCompatibility {
  isCompatible: boolean;
  angleDeviation: number;
  detourPercent: number;
  directionScore: number;
}

interface RideCompatibilityResult {
  rideId: string;
  isCompatible: boolean;
  directionScore: number;
  detourPercent: number;
  pickupProximityKm: number;
  premiumAmount: number;
  premiumPercent: number;
  estimatedArrivalMinutes: number;
  totalScore: number;
}

interface PmgthConfig {
  maxAngleDeviation: number;
  defaultDetourPercent: number;
  minPremiumPercent: number;
  maxPremiumPercent: number;
  maxPremiumCap: number;
  driverPremiumSharePercent: number;
  maxDailySessionsDefault: number;
  cooldownMinutesAfterNoMatch: number;
  weights: {
    directionalAlignment: number;
    pickupProximity: number;
    fareEfficiency: number;
  };
}

const DEFAULT_CONFIG: PmgthConfig = {
  maxAngleDeviation: 30,
  defaultDetourPercent: 15,
  minPremiumPercent: 5,
  maxPremiumPercent: 12,
  maxPremiumCap: 50,
  driverPremiumSharePercent: 80,
  maxDailySessionsDefault: 3,
  cooldownMinutesAfterNoMatch: 15,
  weights: {
    directionalAlignment: 0.4,
    pickupProximity: 0.35,
    fareEfficiency: 0.25,
  },
};

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

function toDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

function calculateBearing(from: LatLng, to: LatLng): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const dLng = toRadians(to.lng - from.lng);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  let bearing = toDegrees(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function calculateDistance(from: LatLng, to: LatLng): number {
  const R = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);
  
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function angleDifference(angle1: number, angle2: number): number {
  let diff = Math.abs(angle1 - angle2) % 360;
  if (diff > 180) {
    diff = 360 - diff;
  }
  return diff;
}

function checkDirectionCompatibility(
  driverLocation: LatLng,
  driverDestination: LatLng,
  ridePickup: LatLng,
  rideDropoff: LatLng,
  maxAngleDeviation: number = DEFAULT_CONFIG.maxAngleDeviation,
  maxDetourPercent: number = DEFAULT_CONFIG.defaultDetourPercent
): DirectionCompatibility {
  const bearingToHome = calculateBearing(driverLocation, driverDestination);
  const bearingToPickup = calculateBearing(driverLocation, ridePickup);
  const bearingPickupToDropoff = calculateBearing(ridePickup, rideDropoff);
  const bearingDropoffToHome = calculateBearing(rideDropoff, driverDestination);

  const pickupAngleDeviation = angleDifference(bearingToHome, bearingToPickup);
  const dropoffAngleDeviation = angleDifference(bearingToHome, bearingDropoffToHome);
  const rideAngleDeviation = angleDifference(bearingToHome, bearingPickupToDropoff);

  const avgAngleDeviation = (pickupAngleDeviation + dropoffAngleDeviation + rideAngleDeviation) / 3;

  const directDistance = calculateDistance(driverLocation, driverDestination);
  const detourDistance = 
    calculateDistance(driverLocation, ridePickup) +
    calculateDistance(ridePickup, rideDropoff) +
    calculateDistance(rideDropoff, driverDestination);
  
  const detourPercent = directDistance > 0 
    ? ((detourDistance - directDistance) / directDistance) * 100 
    : 0;

  const isCompatible = avgAngleDeviation <= maxAngleDeviation && detourPercent <= maxDetourPercent;
  const directionScore = Math.max(0, 100 - (avgAngleDeviation / maxAngleDeviation) * 50 - (detourPercent / maxDetourPercent) * 50);

  return {
    isCompatible,
    angleDeviation: avgAngleDeviation,
    detourPercent,
    directionScore,
  };
}

function calculatePremium(
  baseFare: number,
  directionScore: number,
  config: PmgthConfig = DEFAULT_CONFIG
): { premiumAmount: number; premiumPercent: number; driverShare: number; platformShare: number } {
  const scoreMultiplier = 1 - (directionScore / 100) * 0.5;
  let premiumPercent = config.minPremiumPercent + 
    (config.maxPremiumPercent - config.minPremiumPercent) * scoreMultiplier;
  
  premiumPercent = Math.min(Math.max(premiumPercent, config.minPremiumPercent), config.maxPremiumPercent);
  
  let premiumAmount = baseFare * (premiumPercent / 100);
  premiumAmount = Math.min(premiumAmount, config.maxPremiumCap);

  const driverShare = premiumAmount * (config.driverPremiumSharePercent / 100);
  const platformShare = premiumAmount - driverShare;

  return {
    premiumAmount: Math.round(premiumAmount * 100) / 100,
    premiumPercent: Math.round(premiumPercent * 100) / 100,
    driverShare: Math.round(driverShare * 100) / 100,
    platformShare: Math.round(platformShare * 100) / 100,
  };
}

function calculateTotalScore(
  directionScore: number,
  pickupProximityKm: number,
  fareEfficiency: number,
  config: PmgthConfig = DEFAULT_CONFIG
): number {
  const normalizedProximity = Math.max(0, 100 - (pickupProximityKm * 10));
  
  return (
    config.weights.directionalAlignment * directionScore +
    config.weights.pickupProximity * normalizedProximity +
    config.weights.fareEfficiency * fareEfficiency
  );
}

export async function activatePmgthSession(
  driverId: string,
  destinationAddress: string,
  destinationLat: number,
  destinationLng: number,
  timeWindowMinutes: number = 45,
  maxDetourPercent: number = 15
): Promise<PmgthSession> {
  const existingSession = await db.select()
    .from(pmgthSessions)
    .where(and(
      eq(pmgthSessions.driverId, driverId),
      eq(pmgthSessions.status, "active")
    ))
    .limit(1);

  if (existingSession.length > 0) {
    throw new Error("You already have an active Going Home session. Please end it first.");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const [dailyUsage] = await db.select()
    .from(pmgthDailyUsage)
    .where(and(
      eq(pmgthDailyUsage.driverId, driverId),
      gte(pmgthDailyUsage.date, today)
    ))
    .limit(1);

  if (dailyUsage) {
    if (dailyUsage.cooldownUntil && new Date(dailyUsage.cooldownUntil) > new Date()) {
      const remaining = Math.ceil((new Date(dailyUsage.cooldownUntil).getTime() - Date.now()) / 60000);
      throw new Error(`Please wait ${remaining} minutes before starting another Going Home session.`);
    }
    
    if ((dailyUsage.sessionsStarted || 0) >= DEFAULT_CONFIG.maxDailySessionsDefault) {
      throw new Error("You've reached the maximum Going Home sessions for today.");
    }
  }

  const driver = await db.select()
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver.length || !driver[0].currentLat || !driver[0].currentLng) {
    throw new Error("Unable to determine your current location. Please enable location services.");
  }

  const expiresAt = new Date(Date.now() + timeWindowMinutes * 60 * 1000);

  const [session] = await db.insert(pmgthSessions)
    .values({
      driverId,
      destinationAddress,
      destinationLat: destinationLat.toString(),
      destinationLng: destinationLng.toString(),
      startLat: driver[0].currentLat,
      startLng: driver[0].currentLng,
      timeWindowMinutes,
      maxDetourPercent: maxDetourPercent.toString(),
      status: "active",
      expiresAt,
    })
    .returning();

  if (dailyUsage) {
    await db.update(pmgthDailyUsage)
      .set({ sessionsStarted: (dailyUsage.sessionsStarted || 0) + 1 })
      .where(eq(pmgthDailyUsage.id, dailyUsage.id));
  } else {
    await db.insert(pmgthDailyUsage)
      .values({
        driverId,
        date: today,
        sessionsStarted: 1,
      });
  }

  return session;
}

export async function deactivatePmgthSession(
  driverId: string,
  reason: "completed" | "cancelled" | "expired" = "cancelled"
): Promise<PmgthSession | null> {
  const [session] = await db.select()
    .from(pmgthSessions)
    .where(and(
      eq(pmgthSessions.driverId, driverId),
      eq(pmgthSessions.status, "active")
    ))
    .limit(1);

  if (!session) {
    return null;
  }

  const [updated] = await db.update(pmgthSessions)
    .set({
      status: reason,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pmgthSessions.id, session.id))
    .returning();

  if (reason === "completed") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await db.update(pmgthDailyUsage)
      .set({ sessionsCompleted: sql`${pmgthDailyUsage.sessionsCompleted} + 1` })
      .where(and(
        eq(pmgthDailyUsage.driverId, driverId),
        gte(pmgthDailyUsage.date, today)
      ));
  }

  return updated;
}

export async function getActivePmgthSession(driverId: string): Promise<PmgthSession | null> {
  const [session] = await db.select()
    .from(pmgthSessions)
    .where(and(
      eq(pmgthSessions.driverId, driverId),
      eq(pmgthSessions.status, "active")
    ))
    .limit(1);

  if (session && new Date(session.expiresAt) < new Date()) {
    await deactivatePmgthSession(driverId, "expired");
    return null;
  }

  return session || null;
}

export async function findCompatibleRides(
  session: PmgthSession,
  pendingRides: Array<{
    id: string;
    pickupLat: string;
    pickupLng: string;
    dropoffLat: string;
    dropoffLng: string;
    estimatedFare: string | null;
  }>
): Promise<RideCompatibilityResult[]> {
  const driver = await db.select()
    .from(drivers)
    .where(eq(drivers.id, session.driverId))
    .limit(1);

  if (!driver.length || !driver[0].currentLat || !driver[0].currentLng) {
    return [];
  }

  const driverLocation: LatLng = {
    lat: parseFloat(driver[0].currentLat),
    lng: parseFloat(driver[0].currentLng),
  };

  const destination: LatLng = {
    lat: parseFloat(session.destinationLat),
    lng: parseFloat(session.destinationLng),
  };

  const maxDetour = parseFloat(session.maxDetourPercent || "15");
  const compatibleRides: RideCompatibilityResult[] = [];

  for (const ride of pendingRides) {
    const ridePickup: LatLng = {
      lat: parseFloat(ride.pickupLat),
      lng: parseFloat(ride.pickupLng),
    };

    const rideDropoff: LatLng = {
      lat: parseFloat(ride.dropoffLat),
      lng: parseFloat(ride.dropoffLng),
    };

    const compatibility = checkDirectionCompatibility(
      driverLocation,
      destination,
      ridePickup,
      rideDropoff,
      DEFAULT_CONFIG.maxAngleDeviation,
      maxDetour
    );

    if (compatibility.isCompatible) {
      const pickupProximityKm = calculateDistance(driverLocation, ridePickup);
      const baseFare = parseFloat(ride.estimatedFare || "0");
      const premium = calculatePremium(baseFare, compatibility.directionScore);
      const fareEfficiency = baseFare > 0 ? Math.min(100, baseFare * 2) : 50;
      const estimatedArrivalMinutes = Math.round((pickupProximityKm / 30) * 60);

      const totalScore = calculateTotalScore(
        compatibility.directionScore,
        pickupProximityKm,
        fareEfficiency
      );

      compatibleRides.push({
        rideId: ride.id,
        isCompatible: true,
        directionScore: Math.round(compatibility.directionScore * 100) / 100,
        detourPercent: Math.round(compatibility.detourPercent * 100) / 100,
        pickupProximityKm: Math.round(pickupProximityKm * 100) / 100,
        premiumAmount: premium.premiumAmount,
        premiumPercent: premium.premiumPercent,
        estimatedArrivalMinutes,
        totalScore: Math.round(totalScore * 100) / 100,
      });
    }
  }

  return compatibleRides.sort((a, b) => b.totalScore - a.totalScore);
}

export async function recordPmgthRideMatch(
  sessionId: string,
  rideId: string,
  compatibility: RideCompatibilityResult,
  wasAccepted: boolean
): Promise<PmgthRideMatch> {
  const driverShare = compatibility.premiumAmount * (DEFAULT_CONFIG.driverPremiumSharePercent / 100);
  const platformShare = compatibility.premiumAmount - driverShare;

  const [match] = await db.insert(pmgthRideMatches)
    .values({
      sessionId,
      rideId,
      directionScore: compatibility.directionScore.toString(),
      detourPercent: compatibility.detourPercent.toString(),
      pickupProximityKm: compatibility.pickupProximityKm.toString(),
      premiumAmount: compatibility.premiumAmount.toString(),
      premiumPercent: compatibility.premiumPercent.toString(),
      driverPremiumShare: driverShare.toString(),
      platformPremiumShare: platformShare.toString(),
      estimatedArrivalMinutes: compatibility.estimatedArrivalMinutes,
      wasAccepted,
    })
    .returning();

  if (wasAccepted) {
    await db.update(pmgthSessions)
      .set({
        ridesCompleted: sql`${pmgthSessions.ridesCompleted} + 1`,
        totalPremiumEarnings: sql`${pmgthSessions.totalPremiumEarnings} + ${driverShare}`,
        updatedAt: new Date(),
      })
      .where(eq(pmgthSessions.id, sessionId));

    await db.update(rides)
      .set({
        isPmgthRide: true,
        pmgthPremiumAmount: compatibility.premiumAmount.toString(),
        pmgthPremiumPercent: compatibility.premiumPercent.toString(),
      })
      .where(eq(rides.id, rideId));
  }

  return match;
}

export async function getDriverHomeAddress(driverId: string): Promise<{
  address: string;
  lat: number;
  lng: number;
} | null> {
  const driver = await db.select()
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver.length) return null;

  const [homeAddress] = await db.select()
    .from(savedAddresses)
    .where(and(
      eq(savedAddresses.userId, driver[0].userId),
      eq(savedAddresses.label, "Home")
    ))
    .limit(1);

  if (homeAddress) {
    return {
      address: homeAddress.address,
      lat: parseFloat(homeAddress.lat),
      lng: parseFloat(homeAddress.lng),
    };
  }

  return null;
}

export async function saveDriverHomeAddress(
  userId: string,
  home: { address: string; lat: number; lng: number }
): Promise<{ address: string; lat: number; lng: number }> {
  const existing = await db.select()
    .from(savedAddresses)
    .where(and(
      eq(savedAddresses.userId, userId),
      eq(savedAddresses.label, "Home")
    ))
    .limit(1);

  if (existing.length > 0) {
    await db.update(savedAddresses)
      .set({
        address: home.address,
        lat: home.lat.toString(),
        lng: home.lng.toString(),
      })
      .where(eq(savedAddresses.id, existing[0].id));
  } else {
    await db.insert(savedAddresses).values({
      userId,
      label: "Home",
      address: home.address,
      lat: home.lat.toString(),
      lng: home.lng.toString(),
      isDefault: true,
    });
  }

  return home;
}

export async function findPmgthDriversForRide(
  ridePickupLat: number,
  ridePickupLng: number,
  rideDropoffLat: number,
  rideDropoffLng: number,
  baseFare: number
): Promise<Array<{
  driverId: string;
  sessionId: string;
  directionScore: number;
  premiumAmount: number;
  premiumPercent: number;
  estimatedPickupMinutes: number;
}>> {
  const activeSessions = await db.select()
    .from(pmgthSessions)
    .where(eq(pmgthSessions.status, "active"));

  const eligibleDrivers: Array<{
    driverId: string;
    sessionId: string;
    directionScore: number;
    premiumAmount: number;
    premiumPercent: number;
    estimatedPickupMinutes: number;
  }> = [];

  for (const session of activeSessions) {
    if (new Date(session.expiresAt) < new Date()) {
      await deactivatePmgthSession(session.driverId, "expired");
      continue;
    }

    const driver = await db.select()
      .from(drivers)
      .where(eq(drivers.id, session.driverId))
      .limit(1);

    if (!driver.length || !driver[0].currentLat || !driver[0].currentLng || !driver[0].isOnline) {
      continue;
    }

    const driverLocation: LatLng = {
      lat: parseFloat(driver[0].currentLat),
      lng: parseFloat(driver[0].currentLng),
    };

    const destination: LatLng = {
      lat: parseFloat(session.destinationLat),
      lng: parseFloat(session.destinationLng),
    };

    const ridePickup: LatLng = { lat: ridePickupLat, lng: ridePickupLng };
    const rideDropoff: LatLng = { lat: rideDropoffLat, lng: rideDropoffLng };

    const maxDetour = parseFloat(session.maxDetourPercent || "15");
    const compatibility = checkDirectionCompatibility(
      driverLocation,
      destination,
      ridePickup,
      rideDropoff,
      DEFAULT_CONFIG.maxAngleDeviation,
      maxDetour
    );

    if (compatibility.isCompatible) {
      const pickupDistance = calculateDistance(driverLocation, ridePickup);
      const premium = calculatePremium(baseFare, compatibility.directionScore);
      const estimatedPickupMinutes = Math.round((pickupDistance / 30) * 60);

      eligibleDrivers.push({
        driverId: session.driverId,
        sessionId: session.id,
        directionScore: compatibility.directionScore,
        premiumAmount: premium.premiumAmount,
        premiumPercent: premium.premiumPercent,
        estimatedPickupMinutes,
      });
    }
  }

  return eligibleDrivers.sort((a, b) => {
    if (b.estimatedPickupMinutes !== a.estimatedPickupMinutes) {
      return a.estimatedPickupMinutes - b.estimatedPickupMinutes;
    }
    return b.directionScore - a.directionScore;
  });
}

export async function getPmgthSessionStats(sessionId: string): Promise<{
  ridesCompleted: number;
  totalEarnings: string;
  totalPremiumEarnings: string;
  minutesRemaining: number;
  status: string;
} | null> {
  const [session] = await db.select()
    .from(pmgthSessions)
    .where(eq(pmgthSessions.id, sessionId))
    .limit(1);

  if (!session) return null;

  const minutesRemaining = Math.max(0, Math.round(
    (new Date(session.expiresAt).getTime() - Date.now()) / 60000
  ));

  return {
    ridesCompleted: session.ridesCompleted || 0,
    totalEarnings: session.totalEarnings || "0.00",
    totalPremiumEarnings: session.totalPremiumEarnings || "0.00",
    minutesRemaining,
    status: session.status || "active",
  };
}

export { DEFAULT_CONFIG, calculateDistance, checkDirectionCompatibility, calculatePremium };
