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
import { eq, and, desc, sql } from "drizzle-orm";

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

  async updateDriver(id: string, data: Partial<Driver>): Promise<Driver | undefined> {
    const [driver] = await db.update(drivers).set({ ...data, updatedAt: new Date() }).where(eq(drivers.id, id)).returning();
    return driver || undefined;
  }

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, id));
    return vehicle || undefined;
  }

  async getVehiclesByDriver(driverId: string): Promise<Vehicle[]> {
    return db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  }

  async createVehicle(data: Partial<Vehicle>): Promise<Vehicle> {
    const [vehicle] = await db.insert(vehicles).values(data as any).returning();
    return vehicle;
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
    return rating;
  }

  async getDriverRatings(driverId: string): Promise<Rating[]> {
    return db.select().from(ratings).where(eq(ratings.toDriverId, driverId)).orderBy(desc(ratings.createdAt));
  }

  async getPendingRides(): Promise<Ride[]> {
    return db.select().from(rides).where(eq(rides.status, "pending")).orderBy(desc(rides.createdAt));
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
