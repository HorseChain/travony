import { db } from "./db";
import { ghostRides, ghostMessages, offlineSyncQueue, cachedPricing, rides, users, drivers, vehicles } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export interface GhostRideRequest {
  localId: string;
  riderId: string;
  riderPeerId?: string;
  pickupLat: number;
  pickupLng: number;
  pickupAddress?: string;
  dropoffLat?: number;
  dropoffLng?: number;
  dropoffAddress?: string;
  vehicleType?: string;
  currency?: string;
  estimatedFare?: string;
  cityName?: string;
}

export interface GhostRideAcceptance {
  ghostRideLocalId: string;
  driverId: string;
  driverPeerId: string;
  agreedFare?: number;
}

export interface GhostRideCompletion {
  ghostRideLocalId: string;
  agreedFare: number;
  gpsTrace: string;
  chatMessages: string;
  completedAt: string;
}

export interface SyncResult {
  success: boolean;
  syncedRideId?: string;
  message: string;
}

export async function calculateOfflineFare(
  cityName: string,
  vehicleType: string,
  distanceKm: number,
  durationMin: number
): Promise<{ fare: number; currency: string; breakdown: any }> {
  const [pricing] = await db.select()
    .from(cachedPricing)
    .where(and(
      eq(cachedPricing.cityName, cityName),
      eq(cachedPricing.vehicleType, vehicleType as any)
    ))
    .orderBy(desc(cachedPricing.validFrom))
    .limit(1);

  if (!pricing) {
    const defaultFare = Math.max(5, distanceKm * 2.5 + durationMin * 0.5);
    return {
      fare: Math.round(defaultFare * 100) / 100,
      currency: "AED",
      breakdown: { baseFare: 3, distanceCharge: distanceKm * 2, timeCharge: durationMin * 0.5 },
    };
  }

  const baseFare = parseFloat(pricing.baseFare);
  const distanceCharge = distanceKm * parseFloat(pricing.perKmRate);
  const timeCharge = durationMin * parseFloat(pricing.perMinRate);
  const total = Math.max(parseFloat(pricing.minimumFare), baseFare + distanceCharge + timeCharge);

  return {
    fare: Math.round(total * 100) / 100,
    currency: pricing.currency || "AED",
    breakdown: { baseFare, distanceCharge, timeCharge, minimumFare: parseFloat(pricing.minimumFare) },
  };
}

export async function createGhostRide(request: GhostRideRequest): Promise<string> {
  const [ride] = await db.insert(ghostRides).values({
    localId: request.localId,
    riderId: request.riderId,
    riderPeerId: request.riderPeerId || `peer_${request.riderId.substring(0, 8)}_${Date.now()}`,
    pickupLat: request.pickupLat.toString(),
    pickupLng: request.pickupLng.toString(),
    pickupAddress: request.pickupAddress,
    dropoffLat: request.dropoffLat?.toString(),
    dropoffLng: request.dropoffLng?.toString(),
    dropoffAddress: request.dropoffAddress,
    vehicleType: request.vehicleType as any,
    currency: request.currency as any || "AED",
    estimatedFare: request.estimatedFare,
    cityName: request.cityName,
    status: "broadcasting",
    syncStatus: "pending",
  }).returning();

  return ride.id;
}

export async function acceptGhostRide(acceptance: GhostRideAcceptance): Promise<void> {
  const [ride] = await db.select()
    .from(ghostRides)
    .where(eq(ghostRides.localId, acceptance.ghostRideLocalId))
    .limit(1);

  if (!ride) throw new Error("Ghost ride not found");

  await db.update(ghostRides)
    .set({
      driverId: acceptance.driverId,
      driverPeerId: acceptance.driverPeerId,
      agreedFare: acceptance.agreedFare?.toString(),
      status: "accepted",
    })
    .where(eq(ghostRides.id, ride.id));
}

export async function startGhostRide(localId: string): Promise<void> {
  await db.update(ghostRides)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(ghostRides.localId, localId));
}

export async function completeGhostRide(completion: GhostRideCompletion): Promise<void> {
  await db.update(ghostRides)
    .set({
      agreedFare: completion.agreedFare.toString(),
      gpsTraceJson: completion.gpsTrace,
      chatMessagesJson: completion.chatMessages,
      status: "completed",
      completedAt: new Date(completion.completedAt),
    })
    .where(eq(ghostRides.localId, completion.ghostRideLocalId));
}

export async function syncGhostRide(ghostRideId: string): Promise<SyncResult> {
  const [ghost] = await db.select()
    .from(ghostRides)
    .where(eq(ghostRides.id, ghostRideId))
    .limit(1);

  if (!ghost) return { success: false, message: "Ghost ride not found" };
  if (ghost.syncStatus === "synced") return { success: true, syncedRideId: ghost.syncedRideId || undefined, message: "Already synced" };
  if (ghost.status !== "completed") return { success: false, message: "Ride not completed yet" };

  try {
    await db.update(ghostRides)
      .set({ syncStatus: "syncing" })
      .where(eq(ghostRides.id, ghostRideId));

    const [newRide] = await db.insert(rides).values({
      customerId: ghost.riderId!,
      driverId: ghost.driverId,
      pickupAddress: ghost.pickupAddress || "Ghost Mode Pickup",
      pickupLat: ghost.pickupLat,
      pickupLng: ghost.pickupLng,
      dropoffAddress: ghost.dropoffAddress || "Ghost Mode Dropoff",
      dropoffLat: ghost.dropoffLat || "0",
      dropoffLng: ghost.dropoffLng || "0",
      estimatedFare: ghost.estimatedFare || ghost.agreedFare,
      actualFare: ghost.agreedFare,
      status: "completed",
      isGhostRide: true,
      ghostRideLocalId: ghost.localId,
    }).returning();

    await db.update(ghostRides)
      .set({
        syncStatus: "synced",
        syncedRideId: newRide.id,
        syncedAt: new Date(),
      })
      .where(eq(ghostRides.id, ghostRideId));

    return { success: true, syncedRideId: newRide.id, message: "Ghost ride synced successfully" };
  } catch (error: any) {
    await db.update(ghostRides)
      .set({ syncStatus: "failed" })
      .where(eq(ghostRides.id, ghostRideId));

    return { success: false, message: `Sync failed: ${error.message}` };
  }
}

export async function syncAllPendingGhostRides(userId: string): Promise<SyncResult[]> {
  const pending = await db.select()
    .from(ghostRides)
    .where(and(
      eq(ghostRides.riderId, userId),
      eq(ghostRides.status, "completed"),
      eq(ghostRides.syncStatus, "pending")
    ));

  const results: SyncResult[] = [];
  for (const ride of pending) {
    const result = await syncGhostRide(ride.id);
    results.push(result);
  }
  return results;
}

export async function queueForSync(
  userId: string,
  entityType: string,
  entityLocalId: string,
  payload: any
): Promise<void> {
  await db.insert(offlineSyncQueue).values({
    userId,
    entityType,
    entityLocalId,
    payload: JSON.stringify(payload),
    syncStatus: "pending",
  });
}

export async function processSyncQueue(userId: string): Promise<{ processed: number; failed: number }> {
  const pending = await db.select()
    .from(offlineSyncQueue)
    .where(and(
      eq(offlineSyncQueue.userId, userId),
      eq(offlineSyncQueue.syncStatus, "pending")
    ))
    .orderBy(offlineSyncQueue.queuedAt);

  let processed = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      if (item.entityType === "ghost_ride") {
        const [ride] = await db.select()
          .from(ghostRides)
          .where(eq(ghostRides.localId, item.entityLocalId))
          .limit(1);
        if (ride) await syncGhostRide(ride.id);
      }

      await db.update(offlineSyncQueue)
        .set({ syncStatus: "synced", syncedAt: new Date() })
        .where(eq(offlineSyncQueue.id, item.id));
      processed++;
    } catch (error: any) {
      const retryCount = (item.retryCount || 0) + 1;
      await db.update(offlineSyncQueue)
        .set({
          syncStatus: retryCount >= 3 ? "failed" : "pending",
          retryCount,
          lastError: error.message,
        })
        .where(eq(offlineSyncQueue.id, item.id));
      failed++;
    }
  }

  return { processed, failed };
}

export async function getCachedPricingForCity(cityName: string): Promise<any[]> {
  return db.select()
    .from(cachedPricing)
    .where(eq(cachedPricing.cityName, cityName))
    .orderBy(desc(cachedPricing.validFrom));
}

export async function updateCachedPricing(
  cityName: string,
  regionCode: string,
  vehicleType: string,
  rates: { baseFare: number; perKmRate: number; perMinRate: number; minimumFare: number; currency: string }
): Promise<void> {
  const [existing] = await db.select()
    .from(cachedPricing)
    .where(and(
      eq(cachedPricing.cityName, cityName),
      eq(cachedPricing.vehicleType, vehicleType as any)
    ))
    .limit(1);

  const data = {
    cityName,
    regionCode,
    vehicleType: vehicleType as any,
    baseFare: rates.baseFare.toString(),
    perKmRate: rates.perKmRate.toString(),
    perMinRate: rates.perMinRate.toString(),
    minimumFare: rates.minimumFare.toString(),
    currency: rates.currency as any,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(cachedPricing).set(data).where(eq(cachedPricing.id, existing.id));
  } else {
    await db.insert(cachedPricing).values({ ...data, validFrom: new Date() });
  }
}
