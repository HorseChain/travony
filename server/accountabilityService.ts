import { db } from "./db";
import { accountabilityCredits, users, drivers, rides } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

type CreditType = "eta_breach" | "pickup_wait" | "driver_cancel" | "rider_cancel_late" | "no_show" | "ride_delay" | "system_failure";

interface AccountabilityConfig {
  etaBreachThresholdMinutes: number;
  etaBreachCreditAmount: number;
  pickupWaitThresholdMinutes: number;
  pickupWaitCreditPerMinute: number;
  pickupWaitMaxCredit: number;
  driverCancelCreditAmount: number;
  riderLateCancelThresholdMinutes: number;
  riderLateCancelDriverCredit: number;
  noShowCreditAmount: number;
  dailyCreditCapPerUser: number;
  dailyCreditCapPerDriver: number;
  cooldownMinutes: number;
}

const DEFAULT_CONFIG: AccountabilityConfig = {
  etaBreachThresholdMinutes: 5,
  etaBreachCreditAmount: 5.00,
  pickupWaitThresholdMinutes: 3,
  pickupWaitCreditPerMinute: 1.00,
  pickupWaitMaxCredit: 10.00,
  driverCancelCreditAmount: 10.00,
  riderLateCancelThresholdMinutes: 5,
  riderLateCancelDriverCredit: 8.00,
  noShowCreditAmount: 15.00,
  dailyCreditCapPerUser: 50.00,
  dailyCreditCapPerDriver: 75.00,
  cooldownMinutes: 30,
};

async function getDailyCreditsTotal(userId?: string, driverId?: string): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let whereCondition = gte(accountabilityCredits.creditedAt, today);

  if (userId) {
    whereCondition = and(
      gte(accountabilityCredits.creditedAt, today),
      eq(accountabilityCredits.userId, userId)
    )!;
  } else if (driverId) {
    whereCondition = and(
      gte(accountabilityCredits.creditedAt, today),
      eq(accountabilityCredits.driverId, driverId)
    )!;
  }

  const result = await db.select({ total: sql<string>`COALESCE(SUM(${accountabilityCredits.amount}), '0')` })
    .from(accountabilityCredits)
    .where(whereCondition);

  return parseFloat(result[0]?.total || "0");
}

async function canIssueCredit(userId?: string, driverId?: string): Promise<boolean> {
  const config = DEFAULT_CONFIG;
  
  if (userId) {
    const dailyTotal = await getDailyCreditsTotal(userId);
    return dailyTotal < config.dailyCreditCapPerUser;
  }
  
  if (driverId) {
    const dailyTotal = await getDailyCreditsTotal(undefined, driverId);
    return dailyTotal < config.dailyCreditCapPerDriver;
  }
  
  return false;
}

async function checkRecentCredit(rideId: string, creditType: CreditType): Promise<boolean> {
  const existing = await db.select()
    .from(accountabilityCredits)
    .where(and(
      eq(accountabilityCredits.rideId, rideId),
      eq(accountabilityCredits.creditType, creditType)
    ))
    .limit(1);
  
  return existing.length > 0;
}

async function issueCredit(params: {
  userId?: string;
  driverId?: string;
  rideId?: string;
  creditType: CreditType;
  amount: number;
  currency?: string;
  reason?: string;
  metricsSnapshot?: object;
}): Promise<{ success: boolean; creditId?: string; reason?: string }> {
  const { userId, driverId, rideId, creditType, amount, currency = "AED", reason, metricsSnapshot } = params;

  if (!userId && !driverId) {
    return { success: false, reason: "No recipient specified" };
  }

  if (rideId) {
    const alreadyIssued = await checkRecentCredit(rideId, creditType);
    if (alreadyIssued) {
      return { success: false, reason: "Credit already issued for this ride" };
    }
  }

  const canIssue = await canIssueCredit(userId, driverId);
  if (!canIssue) {
    return { success: false, reason: "Daily credit cap reached" };
  }

  const [credit] = await db.insert(accountabilityCredits)
    .values({
      userId,
      driverId,
      rideId,
      creditType,
      amount: amount.toFixed(2),
      currency: currency as any,
      reason,
      metricsSnapshot: metricsSnapshot ? JSON.stringify(metricsSnapshot) : null,
      appliedToWallet: true,
    })
    .returning();

  if (userId) {
    await db.update(users)
      .set({ walletBalance: sql`${users.walletBalance} + ${amount.toFixed(2)}` })
      .where(eq(users.id, userId));
  } else if (driverId) {
    await db.update(drivers)
      .set({ walletBalance: sql`${drivers.walletBalance} + ${amount.toFixed(2)}` })
      .where(eq(drivers.id, driverId));
  }

  return { success: true, creditId: credit.id };
}

export async function processEtaBreach(
  rideId: string,
  estimatedArrivalMinutes: number,
  actualArrivalMinutes: number
): Promise<{ credited: boolean; amount?: number }> {
  const config = DEFAULT_CONFIG;
  const breachMinutes = actualArrivalMinutes - estimatedArrivalMinutes;

  if (breachMinutes < config.etaBreachThresholdMinutes) {
    return { credited: false };
  }

  const ride = await db.select()
    .from(rides)
    .where(eq(rides.id, rideId))
    .limit(1);

  if (!ride.length) return { credited: false };

  const result = await issueCredit({
    userId: ride[0].customerId,
    rideId,
    creditType: "eta_breach",
    amount: config.etaBreachCreditAmount,
    reason: `Driver arrived ${breachMinutes} min later than estimated`,
    metricsSnapshot: { estimatedArrivalMinutes, actualArrivalMinutes, breachMinutes },
  });

  return { credited: result.success, amount: result.success ? config.etaBreachCreditAmount : undefined };
}

export async function processPickupWait(
  rideId: string,
  waitTimeMinutes: number
): Promise<{ credited: boolean; amount?: number }> {
  const config = DEFAULT_CONFIG;

  if (waitTimeMinutes < config.pickupWaitThresholdMinutes) {
    return { credited: false };
  }

  const ride = await db.select()
    .from(rides)
    .where(eq(rides.id, rideId))
    .limit(1);

  if (!ride.length) return { credited: false };

  const excessWait = waitTimeMinutes - config.pickupWaitThresholdMinutes;
  const creditAmount = Math.min(
    excessWait * config.pickupWaitCreditPerMinute,
    config.pickupWaitMaxCredit
  );

  const result = await issueCredit({
    userId: ride[0].customerId,
    rideId,
    creditType: "pickup_wait",
    amount: creditAmount,
    reason: `Waited ${waitTimeMinutes} min for pickup`,
    metricsSnapshot: { waitTimeMinutes, excessWait, creditAmount },
  });

  return { credited: result.success, amount: result.success ? creditAmount : undefined };
}

export async function processDriverCancellation(
  rideId: string,
  minutesAfterAccept: number
): Promise<{ credited: boolean; amount?: number }> {
  const config = DEFAULT_CONFIG;

  const ride = await db.select()
    .from(rides)
    .where(eq(rides.id, rideId))
    .limit(1);

  if (!ride.length) return { credited: false };

  const result = await issueCredit({
    userId: ride[0].customerId,
    rideId,
    creditType: "driver_cancel",
    amount: config.driverCancelCreditAmount,
    reason: `Driver cancelled ${minutesAfterAccept} min after accepting`,
    metricsSnapshot: { minutesAfterAccept },
  });

  return { credited: result.success, amount: result.success ? config.driverCancelCreditAmount : undefined };
}

export async function processRiderLateCancellation(
  rideId: string,
  minutesAfterAccept: number
): Promise<{ credited: boolean; amount?: number }> {
  const config = DEFAULT_CONFIG;

  if (minutesAfterAccept < config.riderLateCancelThresholdMinutes) {
    return { credited: false };
  }

  const ride = await db.select()
    .from(rides)
    .where(eq(rides.id, rideId))
    .limit(1);

  if (!ride.length || !ride[0].driverId) return { credited: false };

  const result = await issueCredit({
    driverId: ride[0].driverId,
    rideId,
    creditType: "rider_cancel_late",
    amount: config.riderLateCancelDriverCredit,
    reason: `Rider cancelled ${minutesAfterAccept} min after driver accepted`,
    metricsSnapshot: { minutesAfterAccept },
  });

  return { credited: result.success, amount: result.success ? config.riderLateCancelDriverCredit : undefined };
}

export async function processNoShow(
  rideId: string,
  reportedBy: "driver" | "system"
): Promise<{ credited: boolean; amount?: number }> {
  const config = DEFAULT_CONFIG;

  const ride = await db.select()
    .from(rides)
    .where(eq(rides.id, rideId))
    .limit(1);

  if (!ride.length || !ride[0].driverId) return { credited: false };

  const result = await issueCredit({
    driverId: ride[0].driverId,
    rideId,
    creditType: "no_show",
    amount: config.noShowCreditAmount,
    reason: `Rider no-show reported by ${reportedBy}`,
    metricsSnapshot: { reportedBy },
  });

  return { credited: result.success, amount: result.success ? config.noShowCreditAmount : undefined };
}

export async function getRecentCredits(
  userId?: string,
  driverId?: string,
  limit: number = 10
): Promise<Array<{
  id: string;
  creditType: string;
  amount: string;
  currency: string;
  reason: string | null;
  creditedAt: Date;
  seen: boolean;
}>> {
  let query = db.select({
    id: accountabilityCredits.id,
    creditType: accountabilityCredits.creditType,
    amount: accountabilityCredits.amount,
    currency: accountabilityCredits.currency,
    reason: accountabilityCredits.reason,
    creditedAt: accountabilityCredits.creditedAt,
    seen: accountabilityCredits.seenByUser,
  })
  .from(accountabilityCredits)
  .orderBy(desc(accountabilityCredits.creditedAt))
  .limit(limit);

  if (userId) {
    query = query.where(eq(accountabilityCredits.userId, userId)) as any;
  } else if (driverId) {
    query = query.where(eq(accountabilityCredits.driverId, driverId)) as any;
  }

  const credits = await query;
  return credits.map(c => ({
    ...c,
    seen: c.seen ?? false,
  }));
}

export async function markCreditsSeen(creditIds: string[]): Promise<void> {
  if (creditIds.length === 0) return;
  
  await db.update(accountabilityCredits)
    .set({ seenByUser: true })
    .where(sql`${accountabilityCredits.id} = ANY(${creditIds})`);
}

export async function getUnseenCreditsCount(
  userId?: string,
  driverId?: string
): Promise<number> {
  let baseWhere = eq(accountabilityCredits.seenByUser, false);
  
  if (userId) {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(accountabilityCredits)
      .where(and(baseWhere, eq(accountabilityCredits.userId, userId)));
    return result[0]?.count || 0;
  }
  
  if (driverId) {
    const result = await db.select({ count: sql<number>`count(*)` })
      .from(accountabilityCredits)
      .where(and(baseWhere, eq(accountabilityCredits.driverId, driverId)));
    return result[0]?.count || 0;
  }
  
  return 0;
}

export function getAccountabilityConfig(): AccountabilityConfig {
  return { ...DEFAULT_CONFIG };
}
