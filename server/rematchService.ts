import { db } from "./db";
import { rides, drivers, vehicles } from "@shared/schema";
import { eq, and, ne, isNull, sql } from "drizzle-orm";
import * as accountabilityService from "./accountabilityService";

const MAX_REMATCH_ATTEMPTS = 3;
const REMATCH_TIMEOUT_MS = 120000; // 2 minutes to find new driver
const SEARCH_RADIUS_KM = 10;

interface RematchResult {
  success: boolean;
  newRideId?: string;
  newDriverId?: string;
  message: string;
  creditIssued?: boolean;
  creditAmount?: number;
}

export async function initiateRematch(
  cancelledRideId: string,
  cancelledByDriverId: string,
  minutesAfterAccept: number
): Promise<RematchResult> {
  try {
    const [ride] = await db.select()
      .from(rides)
      .where(eq(rides.id, cancelledRideId))
      .limit(1);

    if (!ride) {
      return { success: false, message: "Ride not found" };
    }

    const currentRematchCount = ride.rematchCount || 0;
    if (currentRematchCount >= MAX_REMATCH_ATTEMPTS) {
      const creditResult = await accountabilityService.processDriverCancellation(
        cancelledRideId,
        minutesAfterAccept
      );
      return {
        success: false,
        message: `Max rematch attempts (${MAX_REMATCH_ATTEMPTS}) reached. Refunding rider.`,
        creditIssued: creditResult.credited,
        creditAmount: creditResult.amount
      };
    }

    await db.update(rides)
      .set({ isRematchInProgress: true })
      .where(eq(rides.id, cancelledRideId));

    const originalFare = ride.originalGuaranteedFare || ride.estimatedFare;

    const availableDrivers = await findAvailableDrivers(
      Number(ride.pickupLat),
      Number(ride.pickupLng),
      cancelledByDriverId,
      ride.serviceTypeId
    );

    if (availableDrivers.length === 0) {
      await db.update(rides)
        .set({ 
          isRematchInProgress: false,
          status: "cancelled",
          cancellationReason: "No drivers available for rematch"
        })
        .where(eq(rides.id, cancelledRideId));

      const creditResult = await accountabilityService.processDriverCancellation(
        cancelledRideId,
        minutesAfterAccept
      );

      return {
        success: false,
        message: "No available drivers for rematch",
        creditIssued: creditResult.credited,
        creditAmount: creditResult.amount
      };
    }

    const [newRide] = await db.insert(rides).values({
      customerId: ride.customerId,
      serviceTypeId: ride.serviceTypeId,
      pickupAddress: ride.pickupAddress,
      pickupLat: ride.pickupLat,
      pickupLng: ride.pickupLng,
      dropoffAddress: ride.dropoffAddress,
      dropoffLat: ride.dropoffLat,
      dropoffLng: ride.dropoffLng,
      status: "pending",
      estimatedFare: originalFare,
      originalGuaranteedFare: originalFare,
      distance: ride.distance,
      duration: ride.duration,
      surgeMultiplier: ride.surgeMultiplier,
      paymentMethod: ride.paymentMethod,
      regionCode: ride.regionCode,
      currency: ride.currency,
      riderPriority: ride.riderPriority,
      rematchCount: currentRematchCount + 1,
      rematchFromRideId: cancelledRideId,
      priceBreakdown: ride.priceBreakdown,
      platformFee: ride.platformFee,
      driverEarnings: ride.driverEarnings,
    }).returning();

    await db.update(rides)
      .set({ 
        isRematchInProgress: false,
        status: "cancelled",
        cancellationReason: `Driver cancelled - rematch initiated (attempt ${currentRematchCount + 1})`
      })
      .where(eq(rides.id, cancelledRideId));

    console.log(`Rematch initiated: ${cancelledRideId} -> ${newRide.id} (attempt ${currentRematchCount + 1})`);

    return {
      success: true,
      newRideId: newRide.id,
      message: `Rematch initiated successfully (attempt ${currentRematchCount + 1}/${MAX_REMATCH_ATTEMPTS})`,
    };
  } catch (error: any) {
    console.error("Rematch error:", error);
    
    await db.update(rides)
      .set({ isRematchInProgress: false })
      .where(eq(rides.id, cancelledRideId));

    return { success: false, message: error.message };
  }
}

async function findAvailableDrivers(
  pickupLat: number,
  pickupLng: number,
  excludeDriverId: string,
  serviceTypeId: string | null
): Promise<Array<{ driverId: string; distance: number }>> {
  const earthRadiusKm = 6371;
  
  const availableDrivers = await db.select({
    driverId: drivers.id,
    lat: drivers.currentLat,
    lng: drivers.currentLng,
    vehicleType: vehicles.type,
  })
    .from(drivers)
    .leftJoin(vehicles, eq(vehicles.driverId, drivers.id))
    .where(
      and(
        eq(drivers.isOnline, true),
        eq(drivers.status, "approved"),
        ne(drivers.id, excludeDriverId)
      )
    );

  const driversWithDistance = availableDrivers
    .filter(d => d.lat && d.lng)
    .map(d => {
      const dLat = (Number(d.lat) - pickupLat) * Math.PI / 180;
      const dLng = (Number(d.lng) - pickupLng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(pickupLat * Math.PI / 180) * Math.cos(Number(d.lat) * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = earthRadiusKm * c;

      return { driverId: d.driverId, distance };
    })
    .filter(d => d.distance <= SEARCH_RADIUS_KM)
    .sort((a, b) => a.distance - b.distance);

  return driversWithDistance;
}

export async function getRematchStatus(rideId: string): Promise<{
  isRematch: boolean;
  rematchCount: number;
  originalRideId?: string;
  guaranteedFare?: string;
}> {
  const [ride] = await db.select()
    .from(rides)
    .where(eq(rides.id, rideId))
    .limit(1);

  if (!ride) {
    return { isRematch: false, rematchCount: 0 };
  }

  return {
    isRematch: !!ride.rematchFromRideId,
    rematchCount: ride.rematchCount || 0,
    originalRideId: ride.rematchFromRideId || undefined,
    guaranteedFare: ride.originalGuaranteedFare?.toString() || ride.estimatedFare?.toString(),
  };
}
