import { db } from "./db";
import { 
  users, drivers, vehicles, rides, disputes,
  cities, driverDocuments, driverVerificationQueue, cityTestChecklist,
  driverFeedback
} from "@shared/schema";
import { eq, sql, count, sum, desc, and, gte } from "drizzle-orm";

export async function getDashboardOverview() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalUsers] = await db.select({ count: count() }).from(users);
  const [totalDrivers] = await db.select({ count: count() }).from(drivers);
  const [totalRides] = await db.select({ count: count() }).from(rides);
  const [completedRides] = await db.select({ count: count() }).from(rides).where(eq(rides.status, "completed"));
  
  const [todayRides] = await db.select({ count: count() }).from(rides).where(gte(rides.createdAt, today));
  const [weekRides] = await db.select({ count: count() }).from(rides).where(gte(rides.createdAt, thisWeek));
  
  const [totalRevenue] = await db.select({ 
    total: sum(rides.actualFare) 
  }).from(rides).where(eq(rides.status, "completed"));

  const [todayRevenue] = await db.select({ 
    total: sum(rides.actualFare) 
  }).from(rides).where(and(eq(rides.status, "completed"), gte(rides.createdAt, today)));

  const [pendingDrivers] = await db.select({ count: count() }).from(drivers).where(eq(drivers.status, "pending"));
  const [onlineDrivers] = await db.select({ count: count() }).from(drivers).where(eq(drivers.isOnline, true));

  const [openDisputes] = await db.select({ count: count() }).from(disputes).where(eq(disputes.status, "open"));

  const [activeCities] = await db.select({ count: count() }).from(cities).where(eq(cities.launchStatus, "active"));
  const [totalCities] = await db.select({ count: count() }).from(cities);

  const platformFee = Number(totalRevenue.total || 0) * 0.10;

  return {
    users: {
      total: totalUsers.count,
      riders: totalUsers.count - totalDrivers.count,
      drivers: totalDrivers.count,
    },
    drivers: {
      total: totalDrivers.count,
      pending: pendingDrivers.count,
      online: onlineDrivers.count,
    },
    rides: {
      total: totalRides.count,
      completed: completedRides.count,
      today: todayRides.count,
      thisWeek: weekRides.count,
    },
    revenue: {
      total: Number(totalRevenue.total || 0),
      today: Number(todayRevenue.total || 0),
      platformFee: platformFee,
    },
    disputes: {
      open: openDisputes.count,
    },
    cities: {
      total: totalCities.count,
      active: activeCities.count,
    },
  };
}

export async function getRidersList(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  
  const riders = await db.select()
    .from(users)
    .where(eq(users.role, "customer"))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db.select({ count: count() }).from(users).where(eq(users.role, "customer"));

  return {
    riders,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit),
    },
  };
}

export async function getDriversList(page = 1, limit = 20, status?: string) {
  const offset = (page - 1) * limit;
  
  let driverList;
  if (status) {
    driverList = await db.select({
      driver: drivers,
      user: users,
    })
      .from(drivers)
      .leftJoin(users, eq(drivers.userId, users.id))
      .where(eq(drivers.status, status as any))
      .orderBy(desc(drivers.createdAt))
      .limit(limit)
      .offset(offset);
  } else {
    driverList = await db.select({
      driver: drivers,
      user: users,
    })
      .from(drivers)
      .leftJoin(users, eq(drivers.userId, users.id))
      .orderBy(desc(drivers.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const [total] = status 
    ? await db.select({ count: count() }).from(drivers).where(eq(drivers.status, status as any))
    : await db.select({ count: count() }).from(drivers);

  return {
    drivers: driverList,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit),
    },
  };
}

export async function getDriverDetails(driverId: string) {
  const [driver] = await db.select({
    driver: drivers,
    user: users,
  })
    .from(drivers)
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(drivers.id, driverId));

  if (!driver) return null;

  const vehicleList = await db.select().from(vehicles).where(eq(vehicles.driverId, driverId));
  const documents = await db.select().from(driverDocuments).where(eq(driverDocuments.driverId, driverId));
  const recentRides = await db.select().from(rides)
    .where(eq(rides.driverId, driverId))
    .orderBy(desc(rides.createdAt))
    .limit(10);

  return {
    ...driver,
    vehicles: vehicleList,
    documents,
    recentRides,
  };
}

export async function approveDriver(driverId: string) {
  await db.update(drivers)
    .set({ status: "approved", updatedAt: new Date() })
    .where(eq(drivers.id, driverId));
  
  const { sendDriverApprovalNotification } = await import("./telegramBot");
  const { sendDriverApprovalWhatsApp } = await import("./whatsappBot");
  
  await Promise.all([
    sendDriverApprovalNotification(driverId),
    sendDriverApprovalWhatsApp(driverId),
  ]);
  
  return { success: true };
}

export async function rejectDriver(driverId: string, reason?: string) {
  await db.update(drivers)
    .set({ status: "rejected", updatedAt: new Date() })
    .where(eq(drivers.id, driverId));
  return { success: true, reason };
}

export async function suspendDriver(driverId: string, reason?: string) {
  await db.update(drivers)
    .set({ status: "suspended", updatedAt: new Date() })
    .where(eq(drivers.id, driverId));
  return { success: true, reason };
}

export async function getRidesList(page = 1, limit = 20, status?: string) {
  const offset = (page - 1) * limit;
  
  let rideList;
  if (status) {
    rideList = await db.select({
      ride: rides,
      customer: users,
    })
      .from(rides)
      .leftJoin(users, eq(rides.customerId, users.id))
      .where(eq(rides.status, status as any))
      .orderBy(desc(rides.createdAt))
      .limit(limit)
      .offset(offset);
  } else {
    rideList = await db.select({
      ride: rides,
      customer: users,
    })
      .from(rides)
      .leftJoin(users, eq(rides.customerId, users.id))
      .orderBy(desc(rides.createdAt))
      .limit(limit)
      .offset(offset);
  }

  const [total] = status 
    ? await db.select({ count: count() }).from(rides).where(eq(rides.status, status as any))
    : await db.select({ count: count() }).from(rides);

  return {
    rides: rideList,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit),
    },
  };
}

export async function getDisputesList(page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  
  const disputeList = await db.select()
    .from(disputes)
    .orderBy(desc(disputes.createdAt))
    .limit(limit)
    .offset(offset);

  const [total] = await db.select({ count: count() }).from(disputes);

  return {
    disputes: disputeList,
    pagination: {
      page,
      limit,
      total: total.count,
      pages: Math.ceil(total.count / limit),
    },
  };
}

export async function getCitiesList() {
  const cityList = await db.select().from(cities).orderBy(cities.name);
  
  const citiesWithProgress = await Promise.all(cityList.map(async (city) => {
    const [testProgress] = await db.select({ 
      total: count(),
    }).from(cityTestChecklist).where(eq(cityTestChecklist.cityId, city.id));
    
    const [passed] = await db.select({ 
      count: count(),
    }).from(cityTestChecklist).where(and(
      eq(cityTestChecklist.cityId, city.id),
      eq(cityTestChecklist.status, "passed")
    ));

    return {
      ...city,
      testProgress: {
        total: testProgress.total,
        passed: passed.count,
        percentage: testProgress.total > 0 ? Math.round((passed.count / testProgress.total) * 100) : 0,
      },
    };
  }));

  return citiesWithProgress;
}

export async function getAnalytics(period: "day" | "week" | "month" = "week") {
  const now = new Date();
  let startDate: Date;
  
  switch (period) {
    case "day":
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case "week":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "month":
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      break;
  }

  const ridesByStatus = await db.select({
    status: rides.status,
    count: count(),
  })
    .from(rides)
    .where(gte(rides.createdAt, startDate))
    .groupBy(rides.status);

  const revenueByDay = await db.select({
    date: sql<string>`DATE(${rides.createdAt})`,
    revenue: sum(rides.actualFare),
    count: count(),
  })
    .from(rides)
    .where(and(gte(rides.createdAt, startDate), eq(rides.status, "completed")))
    .groupBy(sql`DATE(${rides.createdAt})`)
    .orderBy(sql`DATE(${rides.createdAt})`);

  const topDrivers = await db.select({
    driver: drivers,
    user: users,
  })
    .from(drivers)
    .leftJoin(users, eq(drivers.userId, users.id))
    .orderBy(desc(drivers.totalTrips))
    .limit(10);

  const newUsersCount = await db.select({ count: count() })
    .from(users)
    .where(gte(users.createdAt, startDate));

  const newDriversCount = await db.select({ count: count() })
    .from(drivers)
    .where(gte(drivers.createdAt, startDate));

  return {
    period,
    ridesByStatus,
    revenueByDay,
    topDrivers,
    newUsers: newUsersCount[0].count,
    newDrivers: newDriversCount[0].count,
  };
}

export async function getVerificationQueue() {
  const queue = await db.select({
    verification: driverVerificationQueue,
    driver: drivers,
    user: users,
  })
    .from(driverVerificationQueue)
    .leftJoin(drivers, eq(driverVerificationQueue.driverId, drivers.id))
    .leftJoin(users, eq(drivers.userId, users.id))
    .where(eq(driverVerificationQueue.status, "pending"))
    .orderBy(driverVerificationQueue.createdAt);

  return queue;
}

export async function getDriverFeedbackList(cityId?: string) {
  if (cityId) {
    return db.select().from(driverFeedback)
      .where(eq(driverFeedback.cityId, cityId))
      .orderBy(desc(driverFeedback.createdAt));
  }
  return db.select().from(driverFeedback).orderBy(desc(driverFeedback.createdAt));
}
