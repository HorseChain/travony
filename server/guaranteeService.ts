import { db } from "./db";
import { firstRideGuarantees, drivers, rides } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";

const GUARANTEE_AMOUNT = 15.00;
const GUARANTEE_DURATION_MINUTES = 10;
const COOLDOWN_HOURS = 24;

interface GuaranteeStatus {
  active: boolean;
  guarantee: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    expiresAt: Date;
    minutesRemaining: number;
  } | null;
  eligibleForNew: boolean;
}

export async function getGuaranteeStatus(driverId: string): Promise<GuaranteeStatus> {
  const activeGuarantee = await db.select()
    .from(firstRideGuarantees)
    .where(and(
      eq(firstRideGuarantees.driverId, driverId),
      eq(firstRideGuarantees.status, "pending")
    ))
    .orderBy(desc(firstRideGuarantees.createdAt))
    .limit(1);

  if (activeGuarantee.length > 0) {
    const g = activeGuarantee[0];
    const now = new Date();
    const expiresAt = new Date(g.expiresAt);
    const minutesRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 60000));

    return {
      active: true,
      guarantee: {
        id: g.id,
        status: g.status,
        amount: g.guaranteeAmount,
        currency: g.currency,
        expiresAt: expiresAt,
        minutesRemaining,
      },
      eligibleForNew: false,
    };
  }

  const eligibleForNew = await checkEligibility(driverId);
  return {
    active: false,
    guarantee: null,
    eligibleForNew,
  };
}

export async function checkEligibility(driverId: string): Promise<boolean> {
  const driver = await db.select()
    .from(drivers)
    .where(eq(drivers.id, driverId))
    .limit(1);

  if (!driver.length || driver[0].status !== "approved") {
    return false;
  }

  const cooldownTime = new Date(Date.now() - COOLDOWN_HOURS * 60 * 60 * 1000);
  const recentGuarantees = await db.select()
    .from(firstRideGuarantees)
    .where(and(
      eq(firstRideGuarantees.driverId, driverId),
      gte(firstRideGuarantees.createdAt, cooldownTime)
    ))
    .limit(1);

  return recentGuarantees.length === 0;
}

export async function startGuarantee(driverId: string, regionCode: string = "AE"): Promise<{
  started: boolean;
  guarantee?: {
    id: string;
    amount: string;
    currency: string;
    expiresAt: Date;
  };
  reason?: string;
}> {
  const eligible = await checkEligibility(driverId);
  if (!eligible) {
    return { started: false, reason: "Not eligible for guarantee" };
  }

  const existingActive = await db.select()
    .from(firstRideGuarantees)
    .where(and(
      eq(firstRideGuarantees.driverId, driverId),
      eq(firstRideGuarantees.status, "pending")
    ))
    .limit(1);

  if (existingActive.length > 0) {
    const g = existingActive[0];
    return {
      started: true,
      guarantee: {
        id: g.id,
        amount: g.guaranteeAmount,
        currency: g.currency,
        expiresAt: new Date(g.expiresAt),
      },
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + GUARANTEE_DURATION_MINUTES * 60 * 1000);

  const currency = regionCode === "AE" ? "AED" : "USD";

  const [guarantee] = await db.insert(firstRideGuarantees)
    .values({
      driverId,
      sessionStartedAt: now,
      status: "pending",
      guaranteeAmount: GUARANTEE_AMOUNT.toString(),
      currency,
      expiresAt,
    })
    .returning();

  scheduleGuaranteeCheck(guarantee.id, GUARANTEE_DURATION_MINUTES);

  return {
    started: true,
    guarantee: {
      id: guarantee.id,
      amount: guarantee.guaranteeAmount,
      currency: guarantee.currency,
      expiresAt: new Date(guarantee.expiresAt),
    },
  };
}

export async function fulfillByRide(driverId: string, rideId: string): Promise<boolean> {
  const [updated] = await db.update(firstRideGuarantees)
    .set({
      status: "fulfilled_by_ride",
      fulfilledAt: new Date(),
      rideId,
    })
    .where(and(
      eq(firstRideGuarantees.driverId, driverId),
      eq(firstRideGuarantees.status, "pending")
    ))
    .returning();

  return !!updated;
}

export async function processExpiredGuarantee(guaranteeId: string): Promise<{
  paid: boolean;
  amount?: string;
  currency?: string;
}> {
  const [guarantee] = await db.select()
    .from(firstRideGuarantees)
    .where(eq(firstRideGuarantees.id, guaranteeId))
    .limit(1);

  if (!guarantee || guarantee.status !== "pending") {
    return { paid: false };
  }

  const driver = await db.select()
    .from(drivers)
    .where(eq(drivers.id, guarantee.driverId))
    .limit(1);

  if (!driver.length || !driver[0].isOnline) {
    await db.update(firstRideGuarantees)
      .set({ status: "cancelled" })
      .where(eq(firstRideGuarantees.id, guaranteeId));
    return { paid: false };
  }

  const currentBalance = parseFloat(driver[0].walletBalance || "0");
  const newBalance = currentBalance + parseFloat(guarantee.guaranteeAmount);

  await db.update(drivers)
    .set({ walletBalance: newBalance.toFixed(2) })
    .where(eq(drivers.id, guarantee.driverId));

  await db.update(firstRideGuarantees)
    .set({
      status: "paid",
      paidAt: new Date(),
    })
    .where(eq(firstRideGuarantees.id, guaranteeId));

  return {
    paid: true,
    amount: guarantee.guaranteeAmount,
    currency: guarantee.currency,
  };
}

export async function cancelGuarantee(driverId: string): Promise<boolean> {
  const [updated] = await db.update(firstRideGuarantees)
    .set({ status: "cancelled" })
    .where(and(
      eq(firstRideGuarantees.driverId, driverId),
      eq(firstRideGuarantees.status, "pending")
    ))
    .returning();

  return !!updated;
}

const pendingChecks = new Map<string, NodeJS.Timeout>();

function scheduleGuaranteeCheck(guaranteeId: string, minutes: number) {
  if (pendingChecks.has(guaranteeId)) {
    clearTimeout(pendingChecks.get(guaranteeId)!);
  }

  const timeout = setTimeout(async () => {
    pendingChecks.delete(guaranteeId);
    await processExpiredGuarantee(guaranteeId);
  }, minutes * 60 * 1000);

  pendingChecks.set(guaranteeId, timeout);
}

export async function getRecentPayout(driverId: string): Promise<{
  amount: string;
  currency: string;
  paidAt: Date;
} | null> {
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  const [recent] = await db.select()
    .from(firstRideGuarantees)
    .where(and(
      eq(firstRideGuarantees.driverId, driverId),
      eq(firstRideGuarantees.status, "paid"),
      gte(firstRideGuarantees.paidAt, fiveMinutesAgo)
    ))
    .orderBy(desc(firstRideGuarantees.paidAt))
    .limit(1);

  if (recent && recent.paidAt) {
    return {
      amount: recent.guaranteeAmount,
      currency: recent.currency,
      paidAt: new Date(recent.paidAt),
    };
  }

  return null;
}
