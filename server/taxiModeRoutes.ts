import type { Express, Request, Response, NextFunction } from "express";
import { db } from "./db";
import { users, drivers, vehicles, rides } from "@shared/schema";
import { and, eq, inArray, desc } from "drizzle-orm";
import { randomBytes, createHash, scryptSync } from "crypto";
import { v4 as uuidv4 } from "uuid";

/**
 * Taxi Mode API (v1) — the simplest way for an EV brand or fleet to turn a
 * car into a taxi and back.
 *
 * Three ideas, three calls:
 *   1. Onboard a car        -> POST   /api/v1/cars
 *   2. Flip the switch      -> POST   /api/v1/cars/:carId/taxi-mode  { "active": true|false }
 *   3. Check on it          -> GET    /api/v1/cars/:carId   (and GET /api/v1/cars for all)
 *
 * Every call is authenticated with a partner API key in the `X-API-Key` header.
 * Cars are owned by the key that created them, so a brand only ever sees its own.
 */

const ACTIVE_RIDE_STATUSES = ["accepted", "arriving", "started", "in_progress"] as const;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${hash}.${salt}`;
}

function requireKey(scope: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.apiKey) {
      return res.status(401).json({
        error: "API key required",
        code: "API_KEY_REQUIRED",
        message: "Pass your partner key in the 'X-API-Key' header. Get one at /developer.",
      });
    }
    if (!req.apiKey.scopes.includes(scope)) {
      return res.status(403).json({
        error: "Forbidden",
        code: "INSUFFICIENT_SCOPE",
        message: `This call needs the '${scope}' scope on your API key.`,
      });
    }
    next();
  };
}

async function getOwnedCar(carId: string, ownerId: string) {
  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, carId)).limit(1);
  if (!vehicle) return null;
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, vehicle.driverId)).limit(1);
  if (!driver || driver.fleetOwnerId !== ownerId) return null;
  const [owner] = await db.select().from(users).where(eq(users.id, driver.userId)).limit(1);
  return { vehicle, driver, owner };
}

function carBattery(vehicle: typeof vehicles.$inferSelect) {
  if (vehicle.manualBatteryPercent == null) {
    return { percent: null, source: "unknown", updatedAt: null };
  }
  return {
    percent: vehicle.manualBatteryPercent,
    source: "manual",
    updatedAt: vehicle.manualBatteryUpdatedAt,
  };
}

function carView(
  vehicle: typeof vehicles.$inferSelect,
  driver: typeof drivers.$inferSelect,
  owner: typeof users.$inferSelect | undefined,
  currentRide?: any,
) {
  return {
    carId: vehicle.id,
    taxiMode: !!driver.isOnline,
    status: driver.status,
    owner: owner ? { id: owner.id, name: owner.name, email: owner.email } : null,
    vehicle: {
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      plateNumber: vehicle.plateNumber,
      isElectric: !!vehicle.isElectric,
      verificationStatus: vehicle.verificationStatus,
    },
    battery: vehicle.isElectric ? carBattery(vehicle) : null,
    stats: {
      rating: driver.rating,
      totalTrips: driver.totalTrips,
      totalEarnings: driver.totalEarnings,
    },
    currentRide: currentRide
      ? {
          id: currentRide.id,
          status: currentRide.status,
          pickup: currentRide.pickupAddress,
          dropoff: currentRide.dropoffAddress,
          fare: currentRide.actualFare ?? currentRide.estimatedFare,
        }
      : null,
  };
}

export function setupTaxiModeRoutes(app: Express) {
  // 1. Onboard a car (and its owner) in a single call.
  app.post("/api/v1/cars", requireKey("fleet:write"), async (req: Request, res: Response) => {
    try {
      const {
        ownerName,
        ownerEmail,
        ownerPhone,
        make,
        model,
        plateNumber,
        color,
        year,
        type,
        isElectric,
        batteryCapacityKwh,
        ratedRangeKm,
      } = req.body || {};

      if (!ownerName || !ownerEmail || !make || !model || !plateNumber) {
        return res.status(400).json({
          error: "Missing fields",
          code: "MISSING_FIELDS",
          message: "ownerName, ownerEmail, make, model and plateNumber are required.",
        });
      }

      const existing = await db.select().from(users).where(eq(users.email, ownerEmail)).limit(1);
      if (existing.length) {
        return res.status(409).json({
          error: "Owner already exists",
          code: "OWNER_EXISTS",
          message: "An account with this email already exists. Use a different email per car owner.",
        });
      }

      const tempPassword = randomBytes(12).toString("hex");
      const [owner] = await db
        .insert(users)
        .values({
          id: uuidv4(),
          email: ownerEmail,
          password: hashPassword(tempPassword),
          name: ownerName,
          phone: ownerPhone || null,
          role: "driver",
        })
        .returning();

      const [driver] = await db
        .insert(drivers)
        .values({
          id: uuidv4(),
          userId: owner.id,
          status: "approved",
          isOnline: false,
          fleetOwnerId: req.apiKey!.ownerId,
        })
        .returning();

      const [vehicle] = await db
        .insert(vehicles)
        .values({
          id: uuidv4(),
          driverId: driver.id,
          type: type || "economy",
          make,
          model,
          plateNumber,
          color: color || null,
          year: year || null,
          isElectric: isElectric ?? true,
          evBatteryCapacityKwh: batteryCapacityKwh != null ? String(batteryCapacityKwh) : null,
          evRatedRangeKm: ratedRangeKm != null ? Number(ratedRangeKm) : null,
          verificationStatus: "admin_verified",
          isActive: true,
        })
        .returning();

      res.status(201).json({
        message: "Car onboarded. It is private until you turn taxi mode on.",
        ...carView(vehicle, driver, owner),
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to onboard car" });
    }
  });

  // 2. The one switch: turn taxi mode on or off.
  app.post("/api/v1/cars/:carId/taxi-mode", requireKey("rides:write"), async (req: Request, res: Response) => {
    try {
      const { active, lat, lng } = req.body || {};
      if (typeof active !== "boolean") {
        return res.status(400).json({
          error: "Missing 'active'",
          code: "MISSING_ACTIVE",
          message: "Send { \"active\": true } to go online or { \"active\": false } to go offline.",
        });
      }

      const car = await getOwnedCar(req.params.carId, req.apiKey!.ownerId);
      if (!car) {
        return res.status(404).json({ error: "Car not found", code: "CAR_NOT_FOUND" });
      }

      const [updatedDriver] = await db
        .update(drivers)
        .set({
          isOnline: active,
          currentLat: lat != null ? String(lat) : car.driver.currentLat,
          currentLng: lng != null ? String(lng) : car.driver.currentLng,
          lastOnlineAt: active ? new Date() : car.driver.lastOnlineAt,
          updatedAt: new Date(),
        })
        .where(eq(drivers.id, car.driver.id))
        .returning();

      res.json({
        carId: car.vehicle.id,
        taxiMode: active,
        message: active
          ? "Taxi mode ON. This car can now receive rides."
          : "Taxi mode OFF. This car is private again.",
        since: updatedDriver.lastOnlineAt,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to switch taxi mode" });
    }
  });

  // 3a. Status of one car.
  app.get("/api/v1/cars/:carId", requireKey("fleet:read"), async (req: Request, res: Response) => {
    try {
      const car = await getOwnedCar(req.params.carId, req.apiKey!.ownerId);
      if (!car) {
        return res.status(404).json({ error: "Car not found", code: "CAR_NOT_FOUND" });
      }
      const [currentRide] = await db
        .select()
        .from(rides)
        .where(and(eq(rides.driverId, car.driver.id), inArray(rides.status, [...ACTIVE_RIDE_STATUSES])))
        .orderBy(desc(rides.createdAt))
        .limit(1);
      res.json(carView(car.vehicle, car.driver, car.owner, currentRide));
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to load car" });
    }
  });

  // 3b. List every car under this API key.
  app.get("/api/v1/cars", requireKey("fleet:read"), async (req: Request, res: Response) => {
    try {
      const fleetDrivers = await db
        .select()
        .from(drivers)
        .where(eq(drivers.fleetOwnerId, req.apiKey!.ownerId));

      const cars: any[] = [];
      for (const driver of fleetDrivers) {
        const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1);
        if (!vehicle) continue;
        const [owner] = await db.select().from(users).where(eq(users.id, driver.userId)).limit(1);
        cars.push(carView(vehicle, driver, owner));
      }

      res.json({
        count: cars.length,
        online: cars.filter((c) => c.taxiMode).length,
        cars,
      });
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : "Failed to list cars" });
    }
  });

  console.log("Taxi Mode API: POST /api/v1/cars, POST /api/v1/cars/:id/taxi-mode, GET /api/v1/cars[/:id]");
}
