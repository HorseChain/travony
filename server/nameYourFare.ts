import { Router } from "express";
import { db } from "./db";
import { storage } from "./storage";
import { rides, fareBids, drivers, users, vehicles } from "@shared/schema";
import { eq, and, desc, gte, ne, sql } from "drizzle-orm";
import { getRegionByCode, calculateFare } from "./regionService";
import { recordRideEvent } from "./rideEventService";

// Name Your Fare (rider-proposed pricing).
// The rider opens an offer at their chosen price (clamped server-side between
// the region minimum fare and the surge-capped server estimate). Online
// drivers either accept at that price (normal PATCH accept path) or send a
// counter-bid here. The rider picks a bid, which atomically claims the ride
// for that driver at the countered price — every other bid closes instantly.

export const OFFER_WINDOW_MS = 5 * 60 * 1000; // 5 minutes per offer round
export const MAX_COUNTERS_PER_DRIVER = 3; // anti-spam cap per driver per ride

export interface NamedFareBounds {
  floor: number;
  ceiling: number;
  serverEstimate: number;
}

// Server-authoritative price guardrails. Floor = region minimum fare.
// Ceiling = surge-capped server fare estimate (recomputed from the ride's own
// distance/duration so neither side can spoof a higher ceiling). When the
// vehicle type isn't priced in the region config, fall back to the supplied
// base fare so the flow degrades safely instead of blocking the booking.
export async function computeNamedFareBounds(
  regionCode: string,
  vehicleType: string,
  distanceKm: number,
  durationMinutes: number,
  fallbackBaseFare: number,
): Promise<NamedFareBounds> {
  const region = await getRegionByCode(regionCode).catch(() => null);
  const surgeCap = region?.surgeCap ?? 1.5;
  const regionMinFare = region?.minFare ?? 5;

  let serverEstimate = fallbackBaseFare;
  try {
    if (distanceKm > 0) {
      const est = await calculateFare(regionCode, vehicleType, distanceKm, durationMinutes, 1.0);
      serverEstimate = est.fare;
    }
  } catch {
    // Vehicle type not in region config — keep the fallback estimate.
  }
  if (!(serverEstimate > 0)) serverEstimate = fallbackBaseFare;

  const floor = Math.round(regionMinFare * 100) / 100;
  const ceiling = Math.max(
    Math.round(serverEstimate * surgeCap * 100) / 100,
    floor,
  );
  return { floor, ceiling, serverEstimate: Math.round(serverEstimate * 100) / 100 };
}

export function clampToBounds(amount: number, bounds: NamedFareBounds): number {
  return Math.min(Math.max(amount, bounds.floor), bounds.ceiling);
}

// The ceiling is frozen into ride.offerCeiling at booking (surge-capped
// server estimate) so later raises/counters can never compound it upward.
async function boundsForRide(ride: any): Promise<NamedFareBounds> {
  const region = await getRegionByCode(ride.regionCode || "AE").catch(() => null);
  const floor = Math.round((region?.minFare ?? 5) * 100) / 100;
  const frozen = parseFloat(ride.offerCeiling || "0");
  if (frozen > 0) {
    return { floor, ceiling: Math.max(frozen, floor), serverEstimate: frozen };
  }
  const base = parseFloat(ride.riderProposedFare || ride.estimatedFare || "0");
  return computeNamedFareBounds(
    ride.regionCode || "AE",
    ride.serviceTypeId || "",
    parseFloat(ride.distance || "0"),
    ride.duration || 0,
    base,
  );
}

// Close every still-open bid on a ride (used when a driver accepts at asking
// price, when a picked bid wins, or when the ride ends). Best-effort.
export async function closeOpenBidsForRide(rideId: string, exceptBidId?: string): Promise<void> {
  try {
    const conditions = [eq(fareBids.rideId, rideId), eq(fareBids.status, "active")];
    if (exceptBidId) conditions.push(ne(fareBids.id, exceptBidId));
    const closed = await db
      .update(fareBids)
      .set({ status: "closed", updatedAt: new Date() })
      .where(and(...conditions))
      .returning({ id: fareBids.id });
    if (closed.length > 0) {
      recordRideEvent({
        rideId,
        eventType: "bids_closed",
        actorRole: "system",
        payload: { closedBidIds: closed.map((c) => c.id) },
      }).catch(console.error);
    }
  } catch (error) {
    console.error(`[NAMED-FARE] Failed closing bids for ride ${rideId}:`, error);
  }
}

export function isOfferExpired(ride: any): boolean {
  return Boolean(
    ride.isNamedFare &&
    ride.offerExpiresAt &&
    new Date(ride.offerExpiresAt).getTime() < Date.now(),
  );
}

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

const router = Router();

// Rider (or a bidding driver) watches the live bid list for an open offer.
router.get("/api/rides/:id/bids", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (!ride.isNamedFare) return res.status(400).json({ message: "Not a Name Your Fare ride" });

    const isRider = ride.customerId === session.userId;
    let isParticipantDriver = false;
    if (!isRider) {
      const driver = await storage.getDriverByUserId(session.userId);
      if (driver) {
        if (ride.driverId === driver.id) {
          isParticipantDriver = true;
        } else {
          const [ownBid] = await db
            .select({ id: fareBids.id })
            .from(fareBids)
            .where(and(eq(fareBids.rideId, ride.id), eq(fareBids.driverId, driver.id)))
            .limit(1);
          isParticipantDriver = Boolean(ownBid);
        }
      }
    }
    if (!isRider && !isParticipantDriver && session.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    const bounds = await boundsForRide(ride);
    const expired = ride.status === "pending" && isOfferExpired(ride);

    const rows = await db
      .select({
        id: fareBids.id,
        driverId: fareBids.driverId,
        amount: fareBids.amount,
        currency: fareBids.currency,
        status: fareBids.status,
        createdAt: fareBids.createdAt,
        driverRating: drivers.rating,
        driverLat: drivers.currentLat,
        driverLng: drivers.currentLng,
        driverName: users.name,
      })
      .from(fareBids)
      .innerJoin(drivers, eq(fareBids.driverId, drivers.id))
      .innerJoin(users, eq(drivers.userId, users.id))
      .where(eq(fareBids.rideId, ride.id))
      .orderBy(fareBids.amount);

    const pLat = parseFloat(String(ride.pickupLat || 0));
    const pLng = parseFloat(String(ride.pickupLng || 0));
    const bids = rows.map((b) => {
      let distanceKm: number | null = null;
      const dLat = parseFloat(String(b.driverLat || 0));
      const dLng = parseFloat(String(b.driverLng || 0));
      if (pLat && pLng && dLat && dLng) {
        const R = 6371;
        const a =
          Math.sin(((dLat - pLat) * Math.PI) / 360) ** 2 +
          Math.cos((pLat * Math.PI) / 180) *
            Math.cos((dLat * Math.PI) / 180) *
            Math.sin(((dLng - pLng) * Math.PI) / 360) ** 2;
        distanceKm = Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
      }
      return {
        id: b.id,
        driverId: b.driverId,
        amount: b.amount,
        currency: b.currency,
        status: b.status,
        createdAt: b.createdAt,
        driverName: b.driverName || "Driver",
        driverRating: b.driverRating || "5.00",
        distanceKm,
        etaMinutes: distanceKm != null ? Math.max(1, Math.round(distanceKm * 2)) : null,
      };
    });

    res.json({
      offer: {
        proposedFare: ride.riderProposedFare,
        currency: ride.currency,
        expiresAt: ride.offerExpiresAt,
        expired,
        rideStatus: ride.status,
        floor: bounds.floor,
        ceiling: bounds.ceiling,
      },
      bids,
    });
  } catch (error) {
    console.error("[NAMED-FARE] bids list error:", error);
    res.status(500).json({ message: "Failed to load bids" });
  }
});

// Driver sends (or updates) a counter-offer on an open named-fare ride.
router.post("/api/rides/:id/bids", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const driver = await storage.getDriverByUserId(session.userId);
    if (!driver || driver.status !== "approved") {
      return res.status(403).json({ message: "Only approved drivers can bid" });
    }

    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (!ride.isNamedFare) return res.status(400).json({ message: "This ride doesn't accept counter-offers" });
    if (ride.status !== "pending") return res.status(409).json({ message: "This offer has already closed" });
    if (ride.customerId === session.userId) return res.status(403).json({ message: "You can't bid on your own ride" });
    if (isOfferExpired(ride)) return res.status(409).json({ message: "This offer has expired" });

    // Same vehicle gate as the normal accept path: standard rides need an
    // active registered vehicle (named-fare excludes Safe Driver entirely).
    const driverVehicles = await storage.getDriverVehicles(driver.id);
    if (!driverVehicles.some((v: any) => v.isActive)) {
      return res.status(403).json({ code: "VEHICLE_REQUIRED", message: "You need a registered vehicle to bid on rides." });
    }

    const amount = Math.round(parseFloat(req.body?.amount) * 100) / 100;
    if (!(amount > 0)) return res.status(400).json({ message: "A valid counter amount is required" });

    const bounds = await boundsForRide(ride);
    if (amount < bounds.floor || amount > bounds.ceiling) {
      return res.status(400).json({
        code: "OUT_OF_BOUNDS",
        message: `Counter must be between ${bounds.floor.toFixed(2)} and ${bounds.ceiling.toFixed(2)} ${ride.currency}`,
        floor: bounds.floor,
        ceiling: bounds.ceiling,
      });
    }

    // Atomic upsert against the (ride_id, driver_id) unique constraint —
    // concurrent counters from the same driver land on one row, and the
    // status/counter-cap guards live inside the conflict clause so a racing
    // request can't bypass them. No row returned = a guard rejected it.
    const [bid] = await db
      .insert(fareBids)
      .values({
        rideId: ride.id,
        driverId: driver.id,
        amount: amount.toFixed(2),
        currency: ride.currency || "AED",
      })
      .onConflictDoUpdate({
        target: [fareBids.rideId, fareBids.driverId],
        set: {
          amount: amount.toFixed(2),
          counterCount: sql`${fareBids.counterCount} + 1`,
          updatedAt: new Date(),
        },
        setWhere: and(
          eq(fareBids.status, "active"),
          sql`${fareBids.counterCount} < ${MAX_COUNTERS_PER_DRIVER}`,
        ),
      })
      .returning();

    if (!bid) {
      const [existing] = await db
        .select({ status: fareBids.status, counterCount: fareBids.counterCount })
        .from(fareBids)
        .where(and(eq(fareBids.rideId, ride.id), eq(fareBids.driverId, driver.id)))
        .limit(1);
      if (existing && existing.status !== "active") {
        return res.status(409).json({ message: "Your bid on this ride is closed" });
      }
      return res.status(429).json({ message: `You can send up to ${MAX_COUNTERS_PER_DRIVER} counters per ride` });
    }

    recordRideEvent({
      rideId: ride.id,
      eventType: "bid_placed",
      actorId: driver.id,
      actorRole: "driver",
      payload: { bidId: bid.id, amount: bid.amount, counterCount: bid.counterCount },
    }).catch(console.error);

    res.status(bid.counterCount > 1 ? 200 : 201).json(bid);
  } catch (error) {
    console.error("[NAMED-FARE] place bid error:", error);
    res.status(500).json({ message: "Failed to send counter-offer" });
  }
});

// Rider raises their open offer (also resets the expiry window so the ride
// reappears in the driver feed after an expired round).
router.patch("/api/rides/:id/offer", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.customerId !== session.userId) return res.status(403).json({ message: "Access denied" });
    if (!ride.isNamedFare) return res.status(400).json({ message: "Not a Name Your Fare ride" });
    if (ride.status !== "pending") return res.status(409).json({ message: "This ride is no longer open" });

    const requested = Math.round(parseFloat(req.body?.proposedFare) * 100) / 100;
    if (!(requested > 0)) return res.status(400).json({ message: "A valid offer amount is required" });

    const bounds = await boundsForRide(ride);
    const current = parseFloat(ride.riderProposedFare || "0");
    if (requested <= current) {
      return res.status(400).json({ message: "New offer must be higher than your current offer" });
    }
    if (requested > bounds.ceiling) {
      return res.status(400).json({
        code: "OUT_OF_BOUNDS",
        message: `Offer can't exceed ${bounds.ceiling.toFixed(2)} ${ride.currency}`,
        floor: bounds.floor,
        ceiling: bounds.ceiling,
      });
    }

    // Keep money fields consistent with the new agreed-upon asking price.
    const region = await getRegionByCode(ride.regionCode || "AE").catch(() => null);
    const feePercent = region ? region.platformFeePercent : 10;
    const platformFee = (requested * feePercent) / 100;

    const updated = await storage.updateRide(ride.id, {
      riderProposedFare: requested.toFixed(2),
      estimatedFare: requested.toFixed(2),
      platformFee: platformFee.toFixed(2),
      driverEarnings: (requested - platformFee).toFixed(2),
      offerExpiresAt: new Date(Date.now() + OFFER_WINDOW_MS),
    } as any);

    recordRideEvent({
      rideId: ride.id,
      eventType: "offer_raised",
      actorId: session.userId,
      actorRole: "rider",
      payload: { from: ride.riderProposedFare, to: requested.toFixed(2) },
    }).catch(console.error);

    res.json({
      proposedFare: updated?.riderProposedFare,
      expiresAt: updated?.offerExpiresAt,
      floor: bounds.floor,
      ceiling: bounds.ceiling,
    });
  } catch (error) {
    console.error("[NAMED-FARE] raise offer error:", error);
    res.status(500).json({ message: "Failed to raise offer" });
  }
});

// Rider picks a winning bid — atomically claims the ride for that driver at
// the countered price. Every other bid closes instantly.
router.post("/api/rides/:id/bids/:bidId/accept", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const ride = await storage.getRide(req.params.id);
    if (!ride) return res.status(404).json({ message: "Ride not found" });
    if (ride.customerId !== session.userId) return res.status(403).json({ message: "Access denied" });
    if (!ride.isNamedFare) return res.status(400).json({ message: "Not a Name Your Fare ride" });
    if (ride.status !== "pending") return res.status(409).json({ message: "This ride is no longer open" });
    // Expired offer window: bids placed against it are stale — the rider must
    // raise the offer (resetting the window) before accepting anything.
    if (isOfferExpired(ride)) {
      return res.status(409).json({
        code: "OFFER_EXPIRED",
        message: "Your offer window has expired. Raise your offer to reopen it before accepting a bid.",
      });
    }

    const [bid] = await db
      .select()
      .from(fareBids)
      .where(and(eq(fareBids.id, req.params.bidId), eq(fareBids.rideId, ride.id)))
      .limit(1);
    if (!bid) return res.status(404).json({ message: "Bid not found" });
    if (bid.status !== "active") return res.status(409).json({ message: "This bid is no longer available" });

    const bidDriver = await storage.getDriver(bid.driverId);
    if (!bidDriver || bidDriver.status !== "approved") {
      return res.status(409).json({ message: "This driver is no longer available" });
    }

    // Defense in depth: the bid amount was validated against the guardrails
    // when placed, but re-clamp before freezing it into the ride.
    const bounds = await boundsForRide(ride);
    const agreed = clampToBounds(parseFloat(bid.amount), bounds);

    // Atomic claim — exactly one winner even if the driver simultaneously
    // taps Accept on the asking price.
    const claimed = await storage.claimPendingRide(ride.id, bid.driverId);
    if (!claimed) {
      return res.status(409).json({ message: "This ride was just taken. Please book again." });
    }

    // Freeze the agreed price into the money fields the downstream flow reads
    // (90/10 split, receipts, wallets, blockchain all key off estimatedFare).
    const region = await getRegionByCode(ride.regionCode || "AE").catch(() => null);
    const feePercent = region ? region.platformFeePercent : 10;
    const platformFee = (agreed * feePercent) / 100;

    const bidVehicles = await storage.getDriverVehicles(bid.driverId);
    const activeVehicle = bidVehicles.find((v: any) => v.isActive);

    const updated = await storage.updateRide(ride.id, {
      estimatedFare: agreed.toFixed(2),
      platformFee: platformFee.toFixed(2),
      driverEarnings: (agreed - platformFee).toFixed(2),
      ...(activeVehicle ? { vehicleId: activeVehicle.id } : {}),
    } as any);

    await db
      .update(fareBids)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(fareBids.id, bid.id));
    await closeOpenBidsForRide(ride.id, bid.id);

    recordRideEvent({
      rideId: ride.id,
      eventType: "bid_accepted",
      actorId: session.userId,
      actorRole: "rider",
      payload: { bidId: bid.id, driverId: bid.driverId, agreedFare: agreed.toFixed(2) },
      previousState: "pending",
      newState: "accepted",
    }).catch(console.error);

    res.json(updated);
  } catch (error) {
    console.error("[NAMED-FARE] accept bid error:", error);
    res.status(500).json({ message: "Failed to accept bid" });
  }
});

// Driver polls their recent bids to learn "you won" (bid accepted → navigate
// to the active ride) or "offer closed" outcomes.
router.get("/api/drivers/my-bids", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const driver = await storage.getDriverByUserId(session.userId);
    if (!driver) return res.status(403).json({ message: "Driver profile required" });

    const since = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const rows = await db
      .select({
        id: fareBids.id,
        rideId: fareBids.rideId,
        amount: fareBids.amount,
        currency: fareBids.currency,
        status: fareBids.status,
        counterCount: fareBids.counterCount,
        updatedAt: fareBids.updatedAt,
        rideStatus: rides.status,
        rideDriverId: rides.driverId,
        riderProposedFare: rides.riderProposedFare,
        offerExpiresAt: rides.offerExpiresAt,
        pickupAddress: rides.pickupAddress,
        dropoffAddress: rides.dropoffAddress,
      })
      .from(fareBids)
      .innerJoin(rides, eq(fareBids.rideId, rides.id))
      .where(and(eq(fareBids.driverId, driver.id), gte(fareBids.createdAt, since)))
      .orderBy(desc(fareBids.updatedAt));

    res.json({
      bids: rows.map((r) => ({
        ...r,
        won: r.status === "accepted" && r.rideDriverId === driver.id,
        offerExpired: r.rideStatus === "pending" && r.offerExpiresAt
          ? new Date(r.offerExpiresAt).getTime() < Date.now()
          : false,
      })),
    });
  } catch (error) {
    console.error("[NAMED-FARE] my-bids error:", error);
    res.status(500).json({ message: "Failed to load your bids" });
  }
});

export const nameYourFareRouter = router;
