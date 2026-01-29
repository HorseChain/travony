import { db } from "./db";
import { walletTransactions, users, drivers, platformLedger } from "@shared/schema";
import { eq, sql, desc, and, gte } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

type TransactionType = 
  | "ride_payment"
  | "wallet_topup"
  | "refund"
  | "withdrawal"
  | "payout"
  | "platform_fee"
  | "guarantee_payout"
  | "directional_premium"
  | "accountability_credit"
  | "ride_fare_debit";

interface WalletTransaction {
  userId?: string;
  driverId?: string;
  rideId?: string;
  type: TransactionType;
  amount: number;
  currency?: string;
  description?: string;
}

async function getPlatformBalance(): Promise<number> {
  const result = await db.select({
    income: sql<string>`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'platform_fee_income' THEN ${platformLedger.amount} ELSE 0 END), '0')`,
    expenses: sql<string>`COALESCE(SUM(CASE WHEN ${platformLedger.type} IN ('guarantee_payout', 'accountability_payout', 'operational_expense') THEN ${platformLedger.amount} ELSE 0 END), '0')`,
  }).from(platformLedger);
  
  const income = parseFloat(result[0]?.income || "0");
  const expenses = parseFloat(result[0]?.expenses || "0");
  return income - expenses;
}

async function recordPlatformLedger(entry: {
  type: "platform_fee_income" | "guarantee_payout" | "accountability_payout" | "operational_expense" | "adjustment";
  amount: number;
  currency?: string;
  rideId?: string;
  driverId?: string;
  userId?: string;
  description?: string;
}): Promise<void> {
  const balanceBefore = await getPlatformBalance();
  const balanceAfter = entry.type === "platform_fee_income" 
    ? balanceBefore + entry.amount 
    : balanceBefore - entry.amount;

  await db.insert(platformLedger).values({
    type: entry.type,
    amount: entry.amount.toFixed(2),
    currency: (entry.currency || "AED") as any,
    rideId: entry.rideId,
    driverId: entry.driverId,
    userId: entry.userId,
    description: entry.description,
    balanceBefore: balanceBefore.toFixed(2),
    balanceAfter: balanceAfter.toFixed(2),
  });
}

export async function creditUserWallet(
  userId: string,
  amount: number,
  type: TransactionType,
  options: { rideId?: string; description?: string; currency?: string } = {}
): Promise<{ success: boolean; newBalance: number }> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length) {
    return { success: false, newBalance: 0 };
  }

  const currentBalance = parseFloat(user[0].walletBalance || "0");
  const newBalance = currentBalance + amount;

  await db.update(users)
    .set({ walletBalance: newBalance.toFixed(2) })
    .where(eq(users.id, userId));

  await db.insert(walletTransactions).values({
    id: uuidv4(),
    userId,
    rideId: options.rideId,
    type,
    amount: amount.toFixed(2),
    currency: (options.currency || "AED") as any,
    status: "completed",
    description: options.description,
    completedAt: new Date(),
  });

  return { success: true, newBalance };
}

export async function debitUserWallet(
  userId: string,
  amount: number,
  type: TransactionType,
  options: { rideId?: string; description?: string; currency?: string } = {}
): Promise<{ success: boolean; newBalance: number; insufficientFunds?: boolean }> {
  const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user.length) {
    return { success: false, newBalance: 0 };
  }

  const currentBalance = parseFloat(user[0].walletBalance || "0");
  
  if (currentBalance < amount) {
    return { success: false, newBalance: currentBalance, insufficientFunds: true };
  }

  const newBalance = currentBalance - amount;

  await db.update(users)
    .set({ walletBalance: newBalance.toFixed(2) })
    .where(eq(users.id, userId));

  await db.insert(walletTransactions).values({
    id: uuidv4(),
    userId,
    rideId: options.rideId,
    type,
    amount: (-amount).toFixed(2),
    currency: (options.currency || "AED") as any,
    status: "completed",
    description: options.description,
    completedAt: new Date(),
  });

  return { success: true, newBalance };
}

export async function creditDriverWallet(
  driverId: string,
  amount: number,
  type: TransactionType,
  options: { rideId?: string; description?: string; currency?: string } = {}
): Promise<{ success: boolean; newBalance: number }> {
  const driver = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!driver.length) {
    return { success: false, newBalance: 0 };
  }

  const currentBalance = parseFloat(driver[0].walletBalance || "0");
  const newBalance = currentBalance + amount;

  await db.update(drivers)
    .set({ walletBalance: newBalance.toFixed(2) })
    .where(eq(drivers.id, driverId));

  await db.insert(walletTransactions).values({
    id: uuidv4(),
    driverId,
    rideId: options.rideId,
    type,
    amount: amount.toFixed(2),
    currency: (options.currency || "AED") as any,
    status: "completed",
    description: options.description,
    completedAt: new Date(),
  });

  return { success: true, newBalance };
}

export async function processRidePayment(rideId: string, riderId: string, driverId: string, fare: number, options: {
  pmgthPremium?: number;
  currency?: string;
} = {}): Promise<{
  success: boolean;
  riderDeducted: number;
  driverEarnings: number;
  platformFee: number;
  premiumPaid: number;
}> {
  const currency = options.currency || "AED";
  const platformFeePercent = 0.10;
  const platformFee = fare * platformFeePercent;
  const driverBaseFare = fare - platformFee;
  const premiumAmount = options.pmgthPremium || 0;
  const totalDriverEarnings = driverBaseFare + premiumAmount;
  const totalRiderPayment = fare + premiumAmount;

  const riderDebit = await debitUserWallet(riderId, totalRiderPayment, "ride_fare_debit", {
    rideId,
    description: `Ride payment${premiumAmount > 0 ? " + Faster Pickup premium" : ""}`,
    currency,
  });

  if (!riderDebit.success) {
    return {
      success: false,
      riderDeducted: 0,
      driverEarnings: 0,
      platformFee: 0,
      premiumPaid: 0,
    };
  }

  await creditDriverWallet(driverId, totalDriverEarnings, "ride_payment", {
    rideId,
    description: `Ride earnings${premiumAmount > 0 ? ` (includes AED ${premiumAmount.toFixed(2)} premium)` : ""}`,
    currency,
  });

  await recordPlatformLedger({
    type: "platform_fee_income",
    amount: platformFee,
    rideId,
    driverId,
    description: `10% platform fee from ride`,
    currency,
  });

  return {
    success: true,
    riderDeducted: totalRiderPayment,
    driverEarnings: totalDriverEarnings,
    platformFee,
    premiumPaid: premiumAmount,
  };
}

export async function processGuaranteePayout(driverId: string, amount: number, currency: string = "AED"): Promise<boolean> {
  const result = await creditDriverWallet(driverId, amount, "guarantee_payout", {
    description: "Guaranteed First Ride payout",
    currency,
  });

  if (result.success) {
    await recordPlatformLedger({
      type: "guarantee_payout",
      amount,
      driverId,
      description: "Guaranteed First Ride operational payout",
      currency,
    });
  }

  return result.success;
}

export async function processAccountabilityCredit(
  userId: string | undefined,
  driverId: string | undefined,
  amount: number,
  reason: string,
  rideId?: string,
  currency: string = "AED"
): Promise<boolean> {
  let success = false;

  if (userId) {
    const result = await creditUserWallet(userId, amount, "accountability_credit", {
      rideId,
      description: reason,
      currency,
    });
    success = result.success;
  } else if (driverId) {
    const result = await creditDriverWallet(driverId, amount, "accountability_credit", {
      rideId,
      description: reason,
      currency,
    });
    success = result.success;
  }

  if (success) {
    await recordPlatformLedger({
      type: "accountability_payout",
      amount,
      userId,
      driverId,
      rideId,
      description: `Accountability credit: ${reason}`,
      currency,
    });
  }

  return success;
}

export async function topUpWallet(userId: string, amount: number, currency: string = "AED"): Promise<{
  success: boolean;
  newBalance: number;
}> {
  return creditUserWallet(userId, amount, "wallet_topup", {
    description: `Wallet top-up`,
    currency,
  });
}

export async function processDriverWithdrawal(driverId: string, amount: number, currency: string = "AED"): Promise<{
  success: boolean;
  newBalance?: number;
  insufficientFunds?: boolean;
}> {
  const driver = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
  if (!driver.length) {
    return { success: false };
  }

  const currentBalance = parseFloat(driver[0].walletBalance || "0");
  
  if (currentBalance < amount) {
    return { success: false, insufficientFunds: true, newBalance: currentBalance };
  }

  const newBalance = currentBalance - amount;

  await db.update(drivers)
    .set({ walletBalance: newBalance.toFixed(2) })
    .where(eq(drivers.id, driverId));

  await db.insert(walletTransactions).values({
    id: uuidv4(),
    driverId,
    type: "withdrawal",
    amount: (-amount).toFixed(2),
    currency: currency as any,
    status: "completed",
    description: "Wallet withdrawal",
    completedAt: new Date(),
  });

  return { success: true, newBalance };
}

export async function getWalletSummary(userId?: string, driverId?: string): Promise<{
  balance: number;
  totalEarnings: number;
  totalSpent: number;
  recentTransactions: Array<{
    id: string;
    type: string;
    amount: string;
    description: string | null;
    createdAt: Date;
  }>;
}> {
  let balance = 0;
  let transactions: any[] = [];

  if (userId) {
    const user = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    balance = parseFloat(user[0]?.walletBalance || "0");
    
    transactions = await db.select()
      .from(walletTransactions)
      .where(eq(walletTransactions.userId, userId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(20);
  } else if (driverId) {
    const driver = await db.select().from(drivers).where(eq(drivers.id, driverId)).limit(1);
    balance = parseFloat(driver[0]?.walletBalance || "0");
    
    transactions = await db.select()
      .from(walletTransactions)
      .where(eq(walletTransactions.driverId, driverId))
      .orderBy(desc(walletTransactions.createdAt))
      .limit(20);
  }

  const totalEarnings = transactions
    .filter(t => parseFloat(t.amount) > 0)
    .reduce((sum, t) => sum + parseFloat(t.amount), 0);

  const totalSpent = transactions
    .filter(t => parseFloat(t.amount) < 0)
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);

  return {
    balance,
    totalEarnings,
    totalSpent,
    recentTransactions: transactions.map(t => ({
      id: t.id,
      type: t.type,
      amount: t.amount,
      description: t.description,
      createdAt: t.createdAt,
    })),
  };
}

export async function getPlatformFinancials(): Promise<{
  totalPlatformFees: number;
  totalGuaranteePayouts: number;
  totalAccountabilityPayouts: number;
  netBalance: number;
}> {
  const result = await db.select({
    platformFees: sql<string>`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'platform_fee_income' THEN ${platformLedger.amount} ELSE 0 END), '0')`,
    guaranteePayouts: sql<string>`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'guarantee_payout' THEN ${platformLedger.amount} ELSE 0 END), '0')`,
    accountabilityPayouts: sql<string>`COALESCE(SUM(CASE WHEN ${platformLedger.type} = 'accountability_payout' THEN ${platformLedger.amount} ELSE 0 END), '0')`,
  }).from(platformLedger);

  const totalPlatformFees = parseFloat(result[0]?.platformFees || "0");
  const totalGuaranteePayouts = parseFloat(result[0]?.guaranteePayouts || "0");
  const totalAccountabilityPayouts = parseFloat(result[0]?.accountabilityPayouts || "0");
  const netBalance = totalPlatformFees - totalGuaranteePayouts - totalAccountabilityPayouts;

  return {
    totalPlatformFees,
    totalGuaranteePayouts,
    totalAccountabilityPayouts,
    netBalance,
  };
}
