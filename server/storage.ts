import { 
  users, drivers, vehicles, rides, ratings, savedAddresses, 
  serviceTypes, coupons, paymentMethods, emergencyContacts, userCoupons, payments,
  walletTransactions, driverPayouts, driverBankAccounts, sessions, driverCryptoSettings, rideInvoices,
  type User, type Driver, type Vehicle, type Ride, type Rating,
  type SavedAddress, type ServiceType, type Coupon, type PaymentMethod, type EmergencyContact,
  type WalletTransaction, type DriverPayout, type DriverBankAccount, type Payment,
  type InsertUser, type Session, type DriverCryptoSettings, type RideInvoice
} from "@shared/schema";
import { db } from "./db";
import { eq, and, asc, desc, sql, lt, inArray, isNull } from "drizzle-orm";
import type { VehicleMilestone, EarningPatterns } from "./carAgent";

// Stable, human-readable public identity for a vehicle (e.g. "TRV-7Q2K9X").
// Used as the car's handle in the operator-facing Vehicle Wallet view.
export function generateVehicleHandle(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous 0/O/1/I
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `TRV-${suffix}`;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<User>): Promise<User | undefined>;
  
  getDriver(id: string): Promise<Driver | undefined>;
  getDriverByUserId(userId: string): Promise<Driver | undefined>;
  getAvailableDrivers(lat: number, lng: number, radius: number): Promise<Driver[]>;
  createDriver(data: Partial<Driver>): Promise<Driver>;
  updateDriver(id: string, data: Partial<Driver>): Promise<Driver | undefined>;
  
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehiclesByDriver(driverId: string): Promise<Vehicle[]>;
  getDriverVehicles(driverId: string): Promise<Vehicle[]>;
  createVehicle(data: Partial<Vehicle>): Promise<Vehicle>;
  updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle | undefined>;
  getPendingVehicleVerifications(): Promise<Vehicle[]>;
  getVehicleVerificationStats(): Promise<{ pending: number; aiVerified: number; adminVerified: number; rejected: number; total: number }>;
  getVehiclesByRegion(): Promise<{ regionCode: string; count: number; vehicleTypes: Record<string, number> }[]>;
  
  getRide(id: string): Promise<Ride | undefined>;
  getRidesByCustomer(customerId: string): Promise<Ride[]>;
  getRidesByDriver(driverId: string): Promise<Ride[]>;
  createRide(data: Partial<Ride>): Promise<Ride>;
  updateRide(id: string, data: Partial<Ride>): Promise<Ride | undefined>;
  
  getSavedAddresses(userId: string): Promise<SavedAddress[]>;
  createSavedAddress(data: Partial<SavedAddress>): Promise<SavedAddress>;
  deleteSavedAddress(id: string): Promise<void>;
  
  getServiceTypes(): Promise<ServiceType[]>;
  getServiceType(id: string): Promise<ServiceType | undefined>;
  
  getCoupon(code: string): Promise<Coupon | undefined>;
  
  getPaymentMethods(userId: string): Promise<PaymentMethod[]>;
  createPaymentMethod(data: Partial<PaymentMethod>): Promise<PaymentMethod>;
  
  getEmergencyContacts(userId: string): Promise<EmergencyContact[]>;
  createEmergencyContact(data: Partial<EmergencyContact>): Promise<EmergencyContact>;
  deleteEmergencyContact(id: string): Promise<void>;
  
  createRating(data: Partial<Rating>): Promise<Rating>;
  getDriverRatings(driverId: string): Promise<Rating[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<User>): Promise<User | undefined> {
    const [user] = await db.update(users).set({ ...data, updatedAt: new Date() }).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getDriver(id: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.id, id));
    return driver || undefined;
  }

  async getDriverByUserId(userId: string): Promise<Driver | undefined> {
    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, userId));
    return driver || undefined;
  }

  async getAvailableDrivers(lat: number, lng: number, radius: number): Promise<Driver[]> {
    const result = await db.select().from(drivers)
      .where(and(eq(drivers.isOnline, true), eq(drivers.status, "approved")));
    return result.filter(driver => {
      if (!driver.currentLat || !driver.currentLng) return false;
      const distance = this.calculateDistance(lat, lng, parseFloat(driver.currentLat), parseFloat(driver.currentLng));
      return distance <= radius;
    });
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async createDriver(data: Partial<Driver>): Promise<Driver> {
    const [driver] = await db.insert(drivers).values(data as any).returning();
    return driver;
  }

  // Idempotent: returns the existing driver for a user, or creates one.
  // Race-safe when the unique userId constraint exists (a concurrent duplicate
  // insert throws and we re-read), and still functional if the constraint has
  // not yet been applied (e.g. prod migration lag) — it just falls back to a
  // plain create.
  async getOrCreateDriver(userId: string, defaults: Partial<Driver> = {}): Promise<Driver> {
    const existing = await this.getDriverByUserId(userId);
    if (existing) return existing;
    try {
      return await this.createDriver({ userId, ...defaults });
    } catch (err) {
      const driver = await this.getDriverByUserId(userId);
      if (driver) return driver;
      throw err;
    }
  }

  async updateDriver(id: string, data: Partial<Driver>): Promise<Driver | undefined> {
    const [driver] = await db.update(drivers).set({ ...data, updatedAt: new Date() }).where(eq(drivers.id, id)).returning();
    return driver || undefined;
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    if (!vehicle) return undefined;
    // Lazily backfill the stable public identity for vehicles that predate the
    // public_handle column (e.g. rows that existed before the economic layer was
    // added to a given environment). Idempotent: only writes when missing.
    if (!vehicle.publicHandle) {
      return (await this.ensureVehicleHandle(vehicle)) ?? vehicle;
    }
    return vehicle;
  }

  // Assign and persist a stable TRV-XXXXXX handle to a vehicle that lacks one,
  // retrying on the (astronomically unlikely) unique collision. Returns the
  // updated vehicle, or undefined to let the caller fall back to the original.
  private async ensureVehicleHandle(vehicle: Vehicle): Promise<Vehicle | undefined> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [updated] = await db
          .update(vehicles)
          .set({ publicHandle: generateVehicleHandle() })
          .where(and(eq(vehicles.id, vehicle.id), isNull(vehicles.publicHandle)))
          .returning();
        // If no row came back, another request already assigned a handle; re-read it.
        if (!updated) {
          const [current] = await db.select().from(vehicles).where(eq(vehicles.id, vehicle.id));
          return current || undefined;
        }
        return updated;
      } catch (err: any) {
        // Unique violation on public_handle: regenerate and retry.
        if (err?.code === "23505") continue;
        console.error("[storage] failed to backfill vehicle public_handle:", err);
        return undefined;
      }
    }
    return undefined;
  }

  async getVehiclesByDriver(driverId: string): Promise<Vehicle[]> {
    return db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  }

  async createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const values: any = { ...data };
    if (!values.publicHandle) {
      values.publicHandle = generateVehicleHandle();
    }
    const [vehicle] = await db.insert(vehicles).values(values).returning();
    return vehicle;
  }

  // --- Vehicle wallet & identity (vehicle is the economic actor) ---

  // Adjust a vehicle's liquid wallet balance by `amount` (can be negative).
  async updateVehicleWalletBalance(vehicleId: string, amount: number): Promise<Vehicle | undefined> {
    const vehicle = await this.getVehicle(vehicleId);
    if (!vehicle) return undefined;
    const current = parseFloat(vehicle.walletBalance || "0");
    const newBalance = (current + amount).toFixed(2);
    return this.updateVehicle(vehicleId, { walletBalance: newBalance });
  }

  // Increment a vehicle's lifetime earnings and trip count on ride completion.
  async creditVehicleEarnings(vehicleId: string, earnings: number): Promise<Vehicle | undefined> {
    const vehicle = await this.getVehicle(vehicleId);
    if (!vehicle) return undefined;
    const currentEarnings = parseFloat(vehicle.totalEarnings || "0");
    return this.updateVehicle(vehicleId, {
      totalEarnings: (currentEarnings + earnings).toFixed(2),
      totalTrips: (vehicle.totalTrips || 0) + 1,
    });
  }

  // Recompute a vehicle's reputation from the ratings on its own rides.
  // Reputation reflects the car, not the person: average of all star ratings
  // given on rides that used this vehicle. Falls back to 5.00 with no ratings.
  async recomputeVehicleReputation(vehicleId: string): Promise<{ score: number; count: number }> {
    const rows = await db
      .select({ rating: ratings.rating })
      .from(ratings)
      .innerJoin(rides, eq(ratings.rideId, rides.id))
      .where(eq(rides.vehicleId, vehicleId));
    const count = rows.length;
    const score = count > 0 ? rows.reduce((s, r) => s + r.rating, 0) / count : 5;
    await this.updateVehicle(vehicleId, {
      reputationScore: score.toFixed(2),
      ratingCount: count,
    });
    return { score, count };
  }

  async getVehicleTransactions(vehicleId: string): Promise<WalletTransaction[]> {
    return db
      .select()
      .from(walletTransactions)
      .where(eq(walletTransactions.vehicleId, vehicleId))
      .orderBy(desc(walletTransactions.createdAt));
  }

  // Recent completed rides for a vehicle — used by the AI car agent only for
  // place labels (pickup/drop areas) and the car's latest location/region.
  // Money/trip totals come from getVehicleEarningsStats (full SQL window), not
  // from this limited sample. Real data only.
  async getRecentVehicleRides(vehicleId: string, limit: number = 15): Promise<Ride[]> {
    return db
      .select()
      .from(rides)
      .where(and(eq(rides.vehicleId, vehicleId), eq(rides.status, "completed")))
      .orderBy(desc(rides.completedAt))
      .limit(limit);
  }

  // Accurate today/this-week earnings + trip counts for a car, aggregated in
  // SQL over the full window (NOT sampled from recent rides). The week window
  // is the trailing 7 days.
  async getVehicleEarningsStats(vehicleId: string): Promise<{
    todayEarnings: number;
    todayTrips: number;
    weekEarnings: number;
    weekTrips: number;
  }> {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [row] = await db
      .select({
        todayEarnings: sql<string>`COALESCE(SUM(${rides.driverEarnings}) FILTER (WHERE ${rides.completedAt} >= ${startOfToday}), 0)`,
        todayTrips: sql<string>`COUNT(*) FILTER (WHERE ${rides.completedAt} >= ${startOfToday})`,
        weekEarnings: sql<string>`COALESCE(SUM(${rides.driverEarnings}), 0)`,
        weekTrips: sql<string>`COUNT(*)`,
      })
      .from(rides)
      .where(
        and(
          eq(rides.vehicleId, vehicleId),
          eq(rides.status, "completed"),
          sql`${rides.completedAt} >= ${weekAgo}`
        )
      );

    return {
      todayEarnings: Math.round(parseFloat(row?.todayEarnings || "0") * 100) / 100,
      todayTrips: parseInt(row?.todayTrips || "0", 10),
      weekEarnings: Math.round(parseFloat(row?.weekEarnings || "0") * 100) / 100,
      weekTrips: parseInt(row?.weekTrips || "0", 10),
    };
  }

  // The car's own earning rhythm: which hours of day and which areas it has
  // actually earned most in, aggregated from completed rides over the trailing
  // ~60 days. Hours are bucketed in the car's LOCAL time (utcOffsetMinutes is
  // applied in JS since completedAt is stored in UTC). Powers the honest,
  // forward-looking "plan for our next shift". Real data only — never fabricated.
  async getVehicleEarningPatterns(
    vehicleId: string,
    utcOffsetMinutes: number = 0
  ): Promise<EarningPatterns & { currency: string }> {
    const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        completedAt: rides.completedAt,
        earnings: rides.driverEarnings,
        dropoffAddress: rides.dropoffAddress,
        pickupAddress: rides.pickupAddress,
        currency: rides.currency,
      })
      .from(rides)
      .where(
        and(
          eq(rides.vehicleId, vehicleId),
          eq(rides.status, "completed"),
          sql`${rides.completedAt} >= ${since}`
        )
      );

    const hourMap = new Map<number, { trips: number; earnings: number }>();
    const areaMap = new Map<string, number>();
    let currency = "AED";

    for (const r of rows) {
      if (!r.completedAt) continue;
      if (r.currency) currency = r.currency;

      const local = new Date(new Date(r.completedAt).getTime() + utcOffsetMinutes * 60000);
      const hour = local.getUTCHours();
      const e = parseFloat(r.earnings || "0");
      const cur = hourMap.get(hour) || { trips: 0, earnings: 0 };
      cur.trips += 1;
      cur.earnings += e;
      hourMap.set(hour, cur);

      const area = (r.dropoffAddress || r.pickupAddress || "").split(",")[0]?.trim();
      if (area) areaMap.set(area, (areaMap.get(area) || 0) + 1);
    }

    const bestHours = Array.from(hourMap.entries())
      .map(([hour, v]) => ({ hour, trips: v.trips, earnings: Math.round(v.earnings * 100) / 100 }))
      .sort((a, b) => b.earnings - a.earnings);

    const topAreas = Array.from(areaMap.entries())
      .map(([area, trips]) => ({ area, trips }))
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 3);

    return { bestHours, topAreas, totalTrips: rows.length, currency };
  }

  // Rank a vehicle against other cars IN THE SAME REGION by earnings over the
  // last 7 days. Returns the car's position, the field size, and a percentile
  // band (e.g. percentile 12 => "top 12%"). Null when the car had no earning
  // trips this week in that region (nothing honest to rank). Real data only.
  async getVehicleWeeklyRank(
    vehicleId: string,
    regionCode: string
  ): Promise<{
    rank: number;
    total: number;
    percentile: number;
    weeklyEarnings: number;
  } | null> {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const rows = await db
      .select({
        vehicleId: rides.vehicleId,
        earned: sql<string>`COALESCE(SUM(${rides.driverEarnings}), 0)`,
      })
      .from(rides)
      .where(
        and(
          eq(rides.status, "completed"),
          eq(rides.regionCode, regionCode),
          sql`${rides.completedAt} >= ${weekAgo}`,
          sql`${rides.vehicleId} IS NOT NULL`
        )
      )
      .groupBy(rides.vehicleId);

    const ranked = rows
      .map((r) => ({ vehicleId: r.vehicleId as string, earned: parseFloat(r.earned || "0") }))
      .filter((r) => r.earned > 0)
      .sort((a, b) => b.earned - a.earned);

    const total = ranked.length;
    const idx = ranked.findIndex((r) => r.vehicleId === vehicleId);
    if (idx === -1 || total === 0) return null;

    const rank = idx + 1;
    const percentile = Math.max(1, Math.round((rank / total) * 100));
    return { rank, total, percentile, weeklyEarnings: ranked[idx].earned };
  }

  // The car's "living profile" timeline: a chronological list of real milestones
  // computed entirely from completed-ride and ratings data. NOTHING is fabricated
  // — every entry is anchored to an actual event date and real figures. Returned
  // newest-first so the most recent milestone is index 0 (the AI agent references
  // it). Returns [] for a car with no completed trips yet.
  async getVehicleMilestones(vehicleId: string): Promise<VehicleMilestone[]> {
    const completed = await db
      .select({
        completedAt: rides.completedAt,
        driverEarnings: rides.driverEarnings,
        dropoffAddress: rides.dropoffAddress,
        pickupAddress: rides.pickupAddress,
        currency: rides.currency,
      })
      .from(rides)
      .where(and(eq(rides.vehicleId, vehicleId), eq(rides.status, "completed")))
      .orderBy(rides.completedAt);

    if (completed.length === 0) return [];

    // Currency label: take the most recent ride's currency, default AED.
    let currency = "AED";
    for (const r of completed) if (r.currency) currency = r.currency;

    const shortArea = (addr: string | null | undefined): string => {
      if (!addr) return "";
      return (addr.split(",")[0]?.trim() || addr.trim());
    };
    const dayKey = (d: Date): string =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const milestones: VehicleMilestone[] = [];

    // 1) First trip together.
    const first = completed[0];
    if (first.completedAt) {
      const area = shortArea(first.dropoffAddress) || shortArea(first.pickupAddress);
      milestones.push({
        key: "first_trip",
        type: "first_trip",
        title: "First trip together",
        description: area
          ? `Our journey began with a trip to ${area}.`
          : `Our journey began with our very first trip.`,
        date: first.completedAt.toISOString(),
        icon: "flag-outline",
      });
    }

    // 2) Trip-count milestones — date of the Nth completed trip.
    const TRIP_THRESHOLDS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000];
    for (const n of TRIP_THRESHOLDS) {
      if (completed.length >= n) {
        const ride = completed[n - 1];
        if (ride?.completedAt) {
          milestones.push({
            key: `trips_${n}`,
            type: "trip_count",
            title: `${n.toLocaleString()}th trip`,
            description: `We reached ${n.toLocaleString()} trips together.`,
            date: ride.completedAt.toISOString(),
            icon: "ribbon-outline",
            value: `${n.toLocaleString()} trips`,
          });
        }
      }
    }

    // 3) Best earning day — the calendar day with the highest total earnings.
    const dayTotals = new Map<string, { total: number; date: Date }>();
    for (const r of completed) {
      if (!r.completedAt) continue;
      const earn = parseFloat(r.driverEarnings || "0");
      if (!(earn > 0)) continue;
      const key = dayKey(r.completedAt);
      const prev = dayTotals.get(key);
      if (prev) prev.total += earn;
      else dayTotals.set(key, { total: earn, date: r.completedAt });
    }
    let bestDay: { total: number; date: Date } | null = null;
    for (const v of dayTotals.values()) {
      if (!bestDay || v.total > bestDay.total) bestDay = v;
    }
    if (bestDay && bestDay.total > 0) {
      const amount = `${currency} ${Math.round(bestDay.total)}`;
      milestones.push({
        key: "best_day",
        type: "best_day",
        title: "Best earning day",
        description: `Our best day yet — we earned ${amount} in a single day.`,
        date: bestDay.date.toISOString(),
        icon: "trophy-outline",
        value: amount,
      });
    }

    // 4) Area we know best — the most frequent drop-off area (needs real volume).
    const areaCounts = new Map<string, { count: number; last: Date }>();
    for (const r of completed) {
      const area = shortArea(r.dropoffAddress);
      if (!area || !r.completedAt) continue;
      const prev = areaCounts.get(area);
      if (prev) {
        prev.count += 1;
        if (r.completedAt > prev.last) prev.last = r.completedAt;
      } else {
        areaCounts.set(area, { count: 1, last: r.completedAt });
      }
    }
    let topArea: { name: string; count: number; last: Date } | null = null;
    for (const [name, v] of areaCounts.entries()) {
      if (!topArea || v.count > topArea.count) topArea = { name, count: v.count, last: v.last };
    }
    if (topArea && topArea.count >= 5) {
      milestones.push({
        key: "top_area",
        type: "top_area",
        title: `${topArea.name} is our turf`,
        description: `We know ${topArea.name} best — ${topArea.count} trips there and counting.`,
        date: topArea.last.toISOString(),
        icon: "map-outline",
        value: `${topArea.count} trips`,
      });
    }

    // 5) Reputation milestone — a strong star rating earned across real ratings.
    const ratingRows = await db
      .select({ rating: ratings.rating, createdAt: ratings.createdAt })
      .from(ratings)
      .innerJoin(rides, eq(ratings.rideId, rides.id))
      .where(eq(rides.vehicleId, vehicleId))
      .orderBy(ratings.createdAt);
    if (ratingRows.length >= 5) {
      const avg = ratingRows.reduce((s, r) => s + r.rating, 0) / ratingRows.length;
      if (avg >= 4.5) {
        const last = ratingRows[ratingRows.length - 1].createdAt;
        milestones.push({
          key: "reputation",
          type: "reputation",
          title: "Trusted on the network",
          description: `We've earned a ${avg.toFixed(2)} star reputation across ${ratingRows.length} ratings.`,
          date: last ? last.toISOString() : null,
          icon: "star-outline",
          value: `${avg.toFixed(2)} stars`,
        });
      }
    }

    // Newest-first so milestones[0] is the most recent. Undated entries last.
    return milestones.sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  // The operator's withdrawable balance is derived from the vehicle wallets
  // (single source of truth). Any residual driver.walletBalance is included so
  // legacy rides without an associated vehicle are never stranded.
  async getOperatorWalletBalance(driverId: string): Promise<number> {
    const driver = await this.getDriver(driverId);
    if (!driver) return 0;
    const vehs = await this.getDriverVehicles(driverId);
    const vehicleTotal = vehs.reduce((sum, v) => sum + parseFloat(v.walletBalance || "0"), 0);
    const legacy = parseFloat(driver.walletBalance || "0");
    return vehicleTotal + legacy;
  }

  // Debit a withdrawal from the operator's wallets. Pulls from the vehicle
  // wallets first (active vehicle, then highest balance), then from any legacy
  // driver balance, so funds are never double-counted.
  async debitOperatorWallet(
    driverId: string,
    amount: number,
  ): Promise<{ success: boolean; newBalance: number; insufficientFunds?: boolean }> {
    const aggregate = await this.getOperatorWalletBalance(driverId);
    if (aggregate < amount) {
      return { success: false, newBalance: aggregate, insufficientFunds: true };
    }
    const vehs = await this.getDriverVehicles(driverId);
    const ordered = [...vehs].sort((a, b) => {
      const aActive = a.isActive ? 1 : 0;
      const bActive = b.isActive ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      return parseFloat(b.walletBalance || "0") - parseFloat(a.walletBalance || "0");
    });
    let remaining = amount;
    for (const v of ordered) {
      if (remaining <= 0) break;
      const avail = parseFloat(v.walletBalance || "0");
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      await this.updateVehicleWalletBalance(v.id, -take);
      remaining -= take;
    }
    if (remaining > 0) {
      await this.updateDriverWalletBalance(driverId, -remaining);
      remaining = 0;
    }
    return { success: true, newBalance: aggregate - amount };
  }

  // Credit funds back to the operator (e.g. a failed crypto payout). Returns to
  // the active/primary vehicle wallet to keep the vehicle as source of truth.
  async creditOperatorWallet(driverId: string, amount: number): Promise<number> {
    const vehs = await this.getDriverVehicles(driverId);
    const primary = vehs.find((v) => v.isActive) || vehs[0];
    if (primary) {
      await this.updateVehicleWalletBalance(primary.id, amount);
    } else {
      await this.updateDriverWalletBalance(driverId, amount);
    }
    return this.getOperatorWalletBalance(driverId);
  }

  async getDriverVehicles(driverId: string): Promise<Vehicle[]> {
    return db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  }

  async updateVehicle(id: string, data: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const [vehicle] = await db.update(vehicles).set(data as any).where(eq(vehicles.id, id)).returning();
    return vehicle || undefined;
  }

  async getPendingVehicleVerifications(): Promise<Vehicle[]> {
    return db.select().from(vehicles).where(eq(vehicles.verificationStatus, 'pending')).orderBy(desc(vehicles.createdAt));
  }

  async getVehicleVerificationStats(): Promise<{ pending: number; aiVerified: number; adminVerified: number; rejected: number; total: number }> {
    const allVehicles = await db.select().from(vehicles);
    const stats = {
      pending: 0,
      aiVerified: 0,
      adminVerified: 0,
      rejected: 0,
      total: allVehicles.length,
    };
    for (const v of allVehicles) {
      if (v.verificationStatus === 'pending') stats.pending++;
      else if (v.verificationStatus === 'ai_verified') stats.aiVerified++;
      else if (v.verificationStatus === 'admin_verified') stats.adminVerified++;
      else if (v.verificationStatus === 'rejected') stats.rejected++;
    }
    return stats;
  }

  async getVehiclesByRegion(): Promise<{ regionCode: string; count: number; vehicleTypes: Record<string, number> }[]> {
    const allVehicles = await db.select().from(vehicles);
    const allDrivers = await db.select().from(drivers);
    const allUsers = await db.select().from(users);
    
    const driverUserMap = new Map(allDrivers.map(d => [d.id, d.userId]));
    const userRegionMap = new Map(allUsers.map(u => [u.id, u.regionCode || 'AE']));
    
    const regionData: Record<string, { count: number; vehicleTypes: Record<string, number> }> = {};
    
    for (const vehicle of allVehicles) {
      const userId = driverUserMap.get(vehicle.driverId);
      const regionCode = userId ? userRegionMap.get(userId) || 'AE' : 'AE';
      
      if (!regionData[regionCode]) {
        regionData[regionCode] = { count: 0, vehicleTypes: {} };
      }
      regionData[regionCode].count++;
      const vType = vehicle.type || 'unknown';
      regionData[regionCode].vehicleTypes[vType] = (regionData[regionCode].vehicleTypes[vType] || 0) + 1;
    }
    
    return Object.entries(regionData).map(([regionCode, data]) => ({
      regionCode,
      count: data.count,
      vehicleTypes: data.vehicleTypes,
    }));
  }

  async getRide(id: string): Promise<Ride | undefined> {
    const [ride] = await db.select().from(rides).where(eq(rides.id, id));
    return ride || undefined;
  }

  async getRidesByCustomer(customerId: string): Promise<Ride[]> {
    return db.select().from(rides).where(eq(rides.customerId, customerId)).orderBy(desc(rides.createdAt));
  }

  async getRidesByDriver(driverId: string): Promise<Ride[]> {
    return db.select().from(rides).where(eq(rides.driverId, driverId)).orderBy(desc(rides.createdAt));
  }

  async getRidesByPoolGroup(groupId: string): Promise<Ride[]> {
    return db.select().from(rides).where(eq(rides.poolGroupId, groupId)).orderBy(asc(rides.acceptedAt), asc(rides.createdAt));
  }

  async createRide(data: Partial<Ride>): Promise<Ride> {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const [ride] = await db.insert(rides).values({ ...data, otp } as any).returning();
    return ride;
  }

  async updateRide(id: string, data: Partial<Ride>): Promise<Ride | undefined> {
    const [ride] = await db.update(rides).set({ ...data, updatedAt: new Date() }).where(eq(rides.id, id)).returning();
    return ride || undefined;
  }

  async getSavedAddresses(userId: string): Promise<SavedAddress[]> {
    return db.select().from(savedAddresses).where(eq(savedAddresses.userId, userId));
  }

  async createSavedAddress(data: Partial<SavedAddress>): Promise<SavedAddress> {
    const [address] = await db.insert(savedAddresses).values(data as any).returning();
    return address;
  }

  async deleteSavedAddress(id: string): Promise<void> {
    await db.delete(savedAddresses).where(eq(savedAddresses.id, id));
  }

  async getServiceTypes(): Promise<ServiceType[]> {
    return db.select().from(serviceTypes).where(eq(serviceTypes.isActive, true));
  }

  async getServiceType(id: string): Promise<ServiceType | undefined> {
    const [type] = await db.select().from(serviceTypes).where(eq(serviceTypes.id, id));
    return type || undefined;
  }

  async getCoupon(code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(and(eq(coupons.code, code), eq(coupons.isActive, true)));
    return coupon || undefined;
  }

  async getPaymentMethods(userId: string): Promise<PaymentMethod[]> {
    return db.select().from(paymentMethods).where(eq(paymentMethods.userId, userId));
  }

  async createPaymentMethod(data: Partial<PaymentMethod>): Promise<PaymentMethod> {
    const [method] = await db.insert(paymentMethods).values(data as any).returning();
    return method;
  }

  async getEmergencyContacts(userId: string): Promise<EmergencyContact[]> {
    return db.select().from(emergencyContacts).where(eq(emergencyContacts.userId, userId));
  }

  async createEmergencyContact(data: Partial<EmergencyContact>): Promise<EmergencyContact> {
    const [contact] = await db.insert(emergencyContacts).values(data as any).returning();
    return contact;
  }

  async deleteEmergencyContact(id: string): Promise<void> {
    await db.delete(emergencyContacts).where(eq(emergencyContacts.id, id));
  }

  async createRating(data: Partial<Rating>): Promise<Rating> {
    const [rating] = await db.insert(ratings).values(data as any).returning();
    if (data.toDriverId) {
      const driverRatings = await this.getDriverRatings(data.toDriverId);
      const avgRating = driverRatings.reduce((sum, r) => sum + r.rating, 0) / driverRatings.length;
      await this.updateDriver(data.toDriverId, { rating: avgRating.toFixed(2) });
    }
    // Reputation belongs to the car: recompute the rated ride's vehicle score.
    if (data.rideId) {
      const ride = await this.getRide(data.rideId);
      if (ride?.vehicleId) {
        await this.recomputeVehicleReputation(ride.vehicleId);
      }
    }
    return rating;
  }

  async getDriverRatings(driverId: string): Promise<Rating[]> {
    return db.select().from(ratings).where(eq(ratings.toDriverId, driverId)).orderBy(desc(ratings.createdAt));
  }

  async getPendingRides(): Promise<Ride[]> {
    // Crypto rides awaiting up-front payment are held out of the driver pool
    // until the NOWPayments IPN flips paymentStatus to "paid" and releases them.
    return db
      .select()
      .from(rides)
      .where(
        and(
          eq(rides.status, "pending"),
          sql`${rides.paymentStatus} is distinct from 'awaiting_payment'`,
        ),
      )
      .orderBy(desc(rides.createdAt));
  }

  // Auto-close abandoned rides so riders are never permanently blocked from
  // re-booking and drivers don't see stale requests.
  // - "pending" rides with no driver acceptance after 20 min are cancelled
  //   (scheduled rides are left alone).
  // - "engaged" rides (accepted/arriving/started/in_progress) that have sat for
  //   over 12 hours are treated as abandoned and closed out.
  async expireStaleRides(): Promise<number> {
    const pendingCutoff = new Date(Date.now() - 20 * 60 * 1000);
    const engagedCutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);

    const expiredPending = await db
      .update(rides)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: "Auto-expired: no driver accepted in time",
      })
      .where(
        and(
          eq(rides.status, "pending"),
          lt(rides.createdAt, pendingCutoff),
          isNull(rides.scheduledAt),
        ),
      )
      .returning({ id: rides.id });

    const expiredEngaged = await db
      .update(rides)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancellationReason: "Auto-closed: ride inactive too long",
      })
      .where(
        and(
          inArray(rides.status, ["accepted", "arriving", "started", "in_progress"]),
          // Use the most recent activity timestamp (started > accepted > created)
          // so a long-scheduled ride that was just engaged isn't wrongly closed.
          lt(
            sql`COALESCE(${rides.startedAt}, ${rides.acceptedAt}, ${rides.createdAt})`,
            engagedCutoff,
          ),
        ),
      )
      .returning({ id: rides.id });

    const total = expiredPending.length + expiredEngaged.length;
    if (total > 0) {
      console.log(
        `[STALE-RIDES] Auto-closed ${expiredPending.length} stale pending + ${expiredEngaged.length} abandoned engaged rides`,
      );
    }
    return total;
  }

  // Atomically claim a pending ride for a driver. Returns the updated ride, or
  // undefined if another driver already took it (status no longer "pending").
  async claimPendingRide(rideId: string, driverId: string): Promise<Ride | undefined> {
    const [row] = await db
      .update(rides)
      .set({ status: "accepted", driverId, acceptedAt: new Date() })
      .where(
        and(
          eq(rides.id, rideId),
          eq(rides.status, "pending"),
          // Crypto rides awaiting up-front payment must not be claimable until the
          // NOWPayments IPN flips paymentStatus to "paid" and releases them.
          sql`${rides.paymentStatus} is distinct from 'awaiting_payment'`,
        ),
      )
      .returning();
    return row;
  }

  async getDriverEarnings(driverId: string, period: string): Promise<any> {
    const now = new Date();
    let startDate = new Date();
    
    switch (period) {
      case "today":
        startDate.setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate.setDate(now.getDate() - 7);
        break;
      case "month":
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      default:
        startDate.setHours(0, 0, 0, 0);
    }

    const completedRides = await db.select().from(rides)
      .where(and(eq(rides.driverId, driverId), eq(rides.status, "completed")));
    
    const filteredRides = completedRides.filter(ride => 
      ride.completedAt && new Date(ride.completedAt) >= startDate
    );

    const totalEarnings = filteredRides.reduce((sum, ride) => 
      sum + (parseFloat(ride.actualFare || ride.estimatedFare || "0")), 0
    );

    return {
      totalEarnings: totalEarnings.toFixed(2),
      totalTrips: filteredRides.length,
      period,
      rides: filteredRides,
    };
  }

  async getAdminStats(): Promise<any> {
    const allUsers = await db.select().from(users);
    const allDrivers = await db.select().from(drivers);
    const allRides = await db.select().from(rides);
    
    const completedRides = allRides.filter(r => r.status === "completed");
    const totalRevenue = completedRides.reduce((sum, ride) => 
      sum + parseFloat(ride.actualFare || ride.estimatedFare || "0"), 0
    );

    return {
      totalUsers: allUsers.filter(u => u.role === "customer").length,
      totalDrivers: allDrivers.length,
      totalRides: allRides.length,
      completedRides: completedRides.length,
      pendingRides: allRides.filter(r => r.status === "pending").length,
      cancelledRides: allRides.filter(r => r.status === "cancelled").length,
      totalRevenue: totalRevenue.toFixed(2),
      approvedDrivers: allDrivers.filter(d => d.status === "approved").length,
      pendingDrivers: allDrivers.filter(d => d.status === "pending").length,
    };
  }

  async getAllUsers(role?: string, page: number = 1, limit: number = 20): Promise<{ users: User[], total: number }> {
    let allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
    if (role) {
      allUsers = allUsers.filter(u => u.role === role);
    }
    const total = allUsers.length;
    const start = (page - 1) * limit;
    return { users: allUsers.slice(start, start + limit), total };
  }

  async getAllDrivers(status?: string, page: number = 1, limit: number = 20): Promise<{ drivers: any[], total: number }> {
    let allDrivers = await db.select({
      driver: drivers,
      user: users,
    }).from(drivers)
      .leftJoin(users, eq(drivers.userId, users.id))
      .orderBy(desc(drivers.createdAt));
    
    if (status) {
      allDrivers = allDrivers.filter(d => d.driver.status === status);
    }
    
    const total = allDrivers.length;
    const start = (page - 1) * limit;
    return { drivers: allDrivers.slice(start, start + limit), total };
  }

  async getAllRides(status?: string, page: number = 1, limit: number = 20): Promise<{ rides: Ride[], total: number }> {
    let allRides = await db.select().from(rides).orderBy(desc(rides.createdAt));
    if (status) {
      allRides = allRides.filter(r => r.status === status);
    }
    const total = allRides.length;
    const start = (page - 1) * limit;
    return { rides: allRides.slice(start, start + limit), total };
  }

  async createWalletTransaction(data: Partial<WalletTransaction>): Promise<WalletTransaction> {
    const [transaction] = await db.insert(walletTransactions).values(data as any).returning();
    return transaction;
  }

  async getWalletTransactions(userId: string): Promise<WalletTransaction[]> {
    return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt));
  }

  async getDriverTransactions(driverId: string): Promise<WalletTransaction[]> {
    return db.select().from(walletTransactions).where(eq(walletTransactions.driverId, driverId)).orderBy(desc(walletTransactions.createdAt));
  }

  async updateWalletTransaction(id: string, data: Partial<WalletTransaction>): Promise<WalletTransaction | undefined> {
    const [transaction] = await db.update(walletTransactions).set(data as any).where(eq(walletTransactions.id, id)).returning();
    return transaction || undefined;
  }

  async createPayment(data: Partial<Payment>): Promise<Payment> {
    const [payment] = await db.insert(payments).values(data as any).returning();
    return payment;
  }

  async getPayment(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment || undefined;
  }

  async updatePayment(id: string, data: Partial<Payment>): Promise<Payment | undefined> {
    const [payment] = await db.update(payments).set(data as any).where(eq(payments.id, id)).returning();
    return payment || undefined;
  }

  async getPaymentByRideId(rideId: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.rideId, rideId));
    return payment || undefined;
  }

  async updateUserWalletBalance(userId: string, amount: number): Promise<User | undefined> {
    const user = await this.getUser(userId);
    if (!user) return undefined;
    const currentBalance = parseFloat(user.walletBalance || "0");
    const newBalance = (currentBalance + amount).toFixed(2);
    return this.updateUser(userId, { walletBalance: newBalance });
  }

  async updateDriverWalletBalance(driverId: string, amount: number): Promise<Driver | undefined> {
    const driver = await this.getDriver(driverId);
    if (!driver) return undefined;
    const currentBalance = parseFloat(driver.walletBalance || "0");
    const newBalance = (currentBalance + amount).toFixed(2);
    return this.updateDriver(driverId, { walletBalance: newBalance });
  }

  async createDriverPayout(data: Partial<DriverPayout>): Promise<DriverPayout> {
    const [payout] = await db.insert(driverPayouts).values(data as any).returning();
    return payout;
  }

  async getDriverPayouts(driverId: string): Promise<DriverPayout[]> {
    return db.select().from(driverPayouts).where(eq(driverPayouts.driverId, driverId)).orderBy(desc(driverPayouts.createdAt));
  }

  async updateDriverPayout(id: string, data: Partial<DriverPayout>): Promise<DriverPayout | undefined> {
    const [payout] = await db.update(driverPayouts).set(data as any).where(eq(driverPayouts.id, id)).returning();
    return payout || undefined;
  }

  async getDriverBankAccounts(driverId: string): Promise<DriverBankAccount[]> {
    return db.select().from(driverBankAccounts).where(eq(driverBankAccounts.driverId, driverId));
  }

  async createDriverBankAccount(data: Partial<DriverBankAccount>): Promise<DriverBankAccount> {
    const [account] = await db.insert(driverBankAccounts).values(data as any).returning();
    return account;
  }

  async deleteDriverBankAccount(id: string): Promise<void> {
    await db.delete(driverBankAccounts).where(eq(driverBankAccounts.id, id));
  }

  async setDefaultPaymentMethod(userId: string, paymentMethodId: string): Promise<void> {
    await db.update(paymentMethods).set({ isDefault: false }).where(eq(paymentMethods.userId, userId));
    await db.update(paymentMethods).set({ isDefault: true }).where(eq(paymentMethods.id, paymentMethodId));
  }

  async deletePaymentMethod(id: string): Promise<void> {
    await db.delete(paymentMethods).where(eq(paymentMethods.id, id));
  }

  async getDefaultPaymentMethod(userId: string): Promise<PaymentMethod | undefined> {
    const [method] = await db.select().from(paymentMethods).where(and(eq(paymentMethods.userId, userId), eq(paymentMethods.isDefault, true)));
    return method || undefined;
  }

  async getActiveRidesCount(): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(rides)
      .where(
        sql`${rides.status} IN ('pending', 'accepted', 'arriving', 'started', 'in_progress')`
      );
    return Number(result[0]?.count || 0);
  }

  async getAvailableDriversCount(lat: number, lng: number, radius: number): Promise<number> {
    const availableDrivers = await this.getAvailableDrivers(lat, lng, radius);
    return availableDrivers.length;
  }

  async getAvailableDriversWithVehicles(lat: number, lng: number, radius: number): Promise<any[]> {
    const availableDrivers = await db.select({
      id: drivers.id,
      userId: drivers.userId,
      currentLat: drivers.currentLat,
      currentLng: drivers.currentLng,
      rating: drivers.rating,
      totalTrips: drivers.totalTrips,
      vehicleType: vehicles.type,
      vehicleMake: vehicles.make,
      vehicleModel: vehicles.model,
      plateNumber: vehicles.plateNumber,
      isElectric: vehicles.isElectric,
    })
    .from(drivers)
    .innerJoin(vehicles, eq(vehicles.driverId, drivers.id))
    .innerJoin(users, eq(users.id, drivers.userId))
    .where(
      and(
        eq(drivers.isOnline, true),
        eq(drivers.status, "approved"),
        eq(vehicles.isActive, true)
      )
    );

    return availableDrivers.filter(driver => {
      if (!driver.currentLat || !driver.currentLng) return false;
      const distance = this.calculateDistance(lat, lng, parseFloat(driver.currentLat), parseFloat(driver.currentLng));
      return distance <= radius;
    }).map(driver => ({
      ...driver,
      name: "Driver",
    }));
  }

  async getAvailableEvDriversCount(lat: number, lng: number, radius: number): Promise<number> {
    const all = await this.getAvailableDriversWithVehicles(lat, lng, radius);
    return all.filter(d => d.isElectric).length;
  }

  async createSession(token: string, userId: string, role: string, expiresAt: Date): Promise<Session> {
    const [session] = await db.insert(sessions).values({
      token,
      userId,
      role,
      expiresAt,
    }).returning();
    return session;
  }

  async getSession(token: string): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.token, token));
    return session || undefined;
  }

  async deleteSession(token: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.token, token));
  }

  async deleteExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(sql`${sessions.expiresAt} < NOW()`);
  }

  async getDriverCryptoSettings(driverId: string): Promise<DriverCryptoSettings | undefined> {
    const [settings] = await db.select().from(driverCryptoSettings).where(eq(driverCryptoSettings.driverId, driverId));
    return settings || undefined;
  }

  async createDriverCryptoSettings(data: Partial<DriverCryptoSettings>): Promise<DriverCryptoSettings> {
    const [settings] = await db.insert(driverCryptoSettings).values(data as any).returning();
    return settings;
  }

  async updateDriverCryptoSettings(driverId: string, data: Partial<DriverCryptoSettings>): Promise<DriverCryptoSettings | undefined> {
    const [settings] = await db.update(driverCryptoSettings)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(driverCryptoSettings.driverId, driverId))
      .returning();
    return settings || undefined;
  }

  async createRideInvoice(data: Partial<RideInvoice>): Promise<RideInvoice> {
    const [invoice] = await db.insert(rideInvoices).values(data as any).returning();
    return invoice;
  }

  async getRideInvoice(id: string): Promise<RideInvoice | undefined> {
    const [invoice] = await db.select().from(rideInvoices).where(eq(rideInvoices.id, id));
    return invoice || undefined;
  }

  async getRideInvoicesByRide(rideId: string): Promise<RideInvoice[]> {
    return db.select().from(rideInvoices).where(eq(rideInvoices.rideId, rideId));
  }

  async getRideInvoicesByRecipient(recipientId: string, invoiceType?: "customer" | "driver"): Promise<RideInvoice[]> {
    if (invoiceType) {
      return db.select().from(rideInvoices)
        .where(and(eq(rideInvoices.recipientId, recipientId), eq(rideInvoices.invoiceType, invoiceType)))
        .orderBy(desc(rideInvoices.createdAt));
    }
    return db.select().from(rideInvoices)
      .where(eq(rideInvoices.recipientId, recipientId))
      .orderBy(desc(rideInvoices.createdAt));
  }

  async getDriverPayout(id: string): Promise<DriverPayout | undefined> {
    const [payout] = await db.select().from(driverPayouts).where(eq(driverPayouts.id, id));
    return payout || undefined;
  }

  async getDriverUsdtBalance(driverId: string): Promise<number> {
    const transactions = await db.select().from(walletTransactions)
      .where(and(
        eq(walletTransactions.driverId, driverId),
        eq(walletTransactions.currency, "USDT"),
        eq(walletTransactions.status, "completed")
      ));
    
    let balance = 0;
    for (const tx of transactions) {
      const amount = parseFloat(tx.amount);
      if (tx.type === "payout" || tx.type === "withdrawal") {
        balance -= amount;
      } else {
        balance += amount;
      }
    }
    return Math.max(0, balance);
  }
}

export const storage = new DatabaseStorage();
