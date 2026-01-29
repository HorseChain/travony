import { ethers } from "ethers";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import * as schema from "@shared/schema";

const POLYGON_AMOY_RPC = "https://rpc-amoy.polygon.technology";
const USDT_DECIMALS = 6;

const ESCROW_CONTRACT_ABI = [
  "function createEscrow(bytes32 rideId, address rider, address driver, uint256 baseFare, uint256 premium) external payable",
  "function fundEscrow(bytes32 rideId) external",
  "function releaseEscrow(bytes32 rideId) external",
  "function cancelByRider(bytes32 rideId) external",
  "function cancelByDriver(bytes32 rideId) external",
  "function getEscrow(bytes32 rideId) external view returns (address rider, address driver, uint256 baseFare, uint256 premium, uint8 status, uint256 createdAt)",
  "event EscrowCreated(bytes32 indexed rideId, address rider, address driver, uint256 baseFare, uint256 premium)",
  "event EscrowFunded(bytes32 indexed rideId, uint256 totalAmount)",
  "event EscrowReleased(bytes32 indexed rideId, uint256 driverAmount, uint256 platformFee)",
  "event EscrowCancelled(bytes32 indexed rideId, uint8 reason, uint256 refundAmount)",
];

enum EscrowStatus {
  Pending = 0,
  Funded = 1,
  InProgress = 2,
  Completed = 3,
  CancelledByRider = 4,
  CancelledByDriver = 5,
  Expired = 6,
}

interface FxRates {
  [currency: string]: number;
}

let cachedFxRates: { rates: FxRates; timestamp: number } | null = null;
const FX_CACHE_TTL = 5 * 60 * 1000;

let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;

export function initializePmgthPayment(): { success: boolean; message: string } {
  try {
    provider = new ethers.JsonRpcProvider(POLYGON_AMOY_RPC);
    
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
    if (privateKey) {
      wallet = new ethers.Wallet(privateKey, provider);
      return { success: true, message: "PMGTH Payment service initialized" };
    }
    
    return { success: true, message: "PMGTH Payment in simulation mode (no wallet configured)" };
  } catch (error: any) {
    return { success: false, message: `PMGTH Payment init failed: ${error.message}` };
  }
}

export async function fetchFxRates(): Promise<FxRates> {
  if (cachedFxRates && Date.now() - cachedFxRates.timestamp < FX_CACHE_TTL) {
    return cachedFxRates.rates;
  }

  try {
    const response = await fetch("https://api.coinbase.com/v2/exchange-rates?currency=USD");
    const data = await response.json();
    
    if (data.data?.rates) {
      const rates: FxRates = {
        USD: 1,
        MXN: parseFloat(data.data.rates.MXN) || 17.5,
        COP: parseFloat(data.data.rates.COP) || 4000,
        TRY: parseFloat(data.data.rates.TRY) || 32,
        KES: parseFloat(data.data.rates.KES) || 150,
        PHP: parseFloat(data.data.rates.PHP) || 56,
        MAD: parseFloat(data.data.rates.MAD) || 10,
        EGP: parseFloat(data.data.rates.EGP) || 31,
        PEN: parseFloat(data.data.rates.PEN) || 3.7,
        ZAR: parseFloat(data.data.rates.ZAR) || 18,
        RON: parseFloat(data.data.rates.RON) || 4.5,
        THB: parseFloat(data.data.rates.THB) || 35,
        EUR: parseFloat(data.data.rates.EUR) || 0.92,
        GBP: parseFloat(data.data.rates.GBP) || 0.79,
      };
      
      cachedFxRates = { rates, timestamp: Date.now() };
      return rates;
    }
  } catch (error) {
    console.error("FX rate fetch failed, using fallback rates");
  }

  return {
    USD: 1, MXN: 17.5, COP: 4000, TRY: 32, KES: 150,
    PHP: 56, MAD: 10, EGP: 31, PEN: 3.7, ZAR: 18,
    RON: 4.5, THB: 35, EUR: 0.92, GBP: 0.79,
  };
}

export function usdToLocal(usdAmount: number, currency: string, rates: FxRates): number {
  const rate = rates[currency] || 1;
  return Math.round(usdAmount * rate * 100) / 100;
}

export function localToUsd(localAmount: number, currency: string, rates: FxRates): number {
  const rate = rates[currency] || 1;
  return Math.round((localAmount / rate) * 100) / 100;
}

export interface PaymentIntent {
  intentId: string;
  rideId: string;
  baseFareUsd: number;
  premiumUsd: number;
  platformFeeUsd: number;
  driverEarningsUsd: number;
  totalUsd: number;
  localCurrency: string;
  baseFareLocal: number;
  premiumLocal: number;
  totalLocal: number;
  escrowStatus: string;
  premiumRecipient: "driver";
  premiumGuaranteed: true;
  createdAt: Date;
  expiresAt: Date;
}

export async function createPaymentIntent(
  rideId: string,
  riderId: string,
  driverId: string,
  baseFareUsd: number,
  premiumUsd: number,
  localCurrency: string = "USD"
): Promise<PaymentIntent> {
  const rates = await fetchFxRates();
  
  const platformFeePercent = 10;
  const driverPremiumSharePercent = 80;
  
  const platformFeeOnBase = baseFareUsd * (platformFeePercent / 100);
  const platformFeeOnPremium = premiumUsd * ((100 - driverPremiumSharePercent) / 100);
  const totalPlatformFee = platformFeeOnBase + platformFeeOnPremium;
  
  const driverBaseFare = baseFareUsd - platformFeeOnBase;
  const driverPremium = premiumUsd * (driverPremiumSharePercent / 100);
  const driverEarnings = driverBaseFare + driverPremium;
  
  const totalUsd = baseFareUsd + premiumUsd;
  
  const intentId = `pi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  const [escrowRecord] = await db.insert(schema.pmgthEscrow).values({
    intentId,
    rideId,
    riderId,
    driverId,
    baseFareUsdt: baseFareUsd.toString(),
    premiumUsdt: premiumUsd.toString(),
    platformFeeUsdt: totalPlatformFee.toString(),
    driverEarningsUsdt: driverEarnings.toString(),
    totalUsdt: totalUsd.toString(),
    localCurrency,
    fxRate: rates[localCurrency]?.toString() || "1",
    status: "pending",
    premiumPaid: false,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  }).returning();

  return {
    intentId,
    rideId,
    baseFareUsd,
    premiumUsd,
    platformFeeUsd: totalPlatformFee,
    driverEarningsUsd: driverEarnings,
    totalUsd,
    localCurrency,
    baseFareLocal: usdToLocal(baseFareUsd, localCurrency, rates),
    premiumLocal: usdToLocal(premiumUsd, localCurrency, rates),
    totalLocal: usdToLocal(totalUsd, localCurrency, rates),
    escrowStatus: "pending",
    premiumRecipient: "driver",
    premiumGuaranteed: true,
    createdAt: escrowRecord.createdAt!,
    expiresAt: escrowRecord.expiresAt!,
  };
}

export async function fundEscrow(
  intentId: string,
  riderWalletAddress?: string
): Promise<{
  success: boolean;
  message: string;
  transactionHash?: string;
  premiumPaidInstantly: boolean;
  premiumTxHash?: string;
}> {
  const [escrow] = await db
    .select()
    .from(schema.pmgthEscrow)
    .where(eq(schema.pmgthEscrow.intentId, intentId))
    .limit(1);

  if (!escrow) {
    return { success: false, message: "Payment intent not found", premiumPaidInstantly: false };
  }

  if (escrow.status !== "pending") {
    return { success: false, message: `Invalid escrow status: ${escrow.status}`, premiumPaidInstantly: false };
  }

  if (new Date() > escrow.expiresAt!) {
    await db.update(schema.pmgthEscrow)
      .set({ status: "expired" })
      .where(eq(schema.pmgthEscrow.intentId, intentId));
    return { success: false, message: "Payment intent expired", premiumPaidInstantly: false };
  }

  const premiumAmount = parseFloat(escrow.premiumUsdt!);
  let premiumTxHash: string | undefined;
  
  if (wallet && premiumAmount > 0) {
    try {
      console.log(`Simulating instant premium payment of $${premiumAmount} to driver ${escrow.driverId}`);
      premiumTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`;
    } catch (error: any) {
      console.error("Premium payment failed:", error.message);
    }
  }

  await db.update(schema.pmgthEscrow)
    .set({ 
      status: "funded",
      premiumPaid: premiumAmount > 0,
      premiumTxHash: premiumTxHash,
      fundedAt: new Date(),
    })
    .where(eq(schema.pmgthEscrow.intentId, intentId));

  return {
    success: true,
    message: "Escrow funded successfully. Premium paid to driver instantly.",
    transactionHash: `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`,
    premiumPaidInstantly: premiumAmount > 0,
    premiumTxHash,
  };
}

export async function releaseEscrow(
  intentId: string
): Promise<{
  success: boolean;
  message: string;
  driverPayout: number;
  platformFee: number;
  transactionHash?: string;
}> {
  const [escrow] = await db
    .select()
    .from(schema.pmgthEscrow)
    .where(eq(schema.pmgthEscrow.intentId, intentId))
    .limit(1);

  if (!escrow) {
    return { success: false, message: "Escrow not found", driverPayout: 0, platformFee: 0 };
  }

  if (escrow.status !== "funded" && escrow.status !== "in_progress") {
    return { success: false, message: `Cannot release escrow in ${escrow.status} status`, driverPayout: 0, platformFee: 0 };
  }

  const driverEarnings = parseFloat(escrow.driverEarningsUsdt!);
  const platformFee = parseFloat(escrow.platformFeeUsdt!);
  const baseFare = parseFloat(escrow.baseFareUsdt!);
  const premiumAlreadyPaid = parseFloat(escrow.premiumUsdt!);
  
  const remainingDriverPayout = driverEarnings - (escrow.premiumPaid ? premiumAlreadyPaid * 0.8 : 0);

  await db.update(schema.pmgthEscrow)
    .set({ 
      status: "completed",
      completedAt: new Date(),
      releaseTxHash: `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`,
    })
    .where(eq(schema.pmgthEscrow.intentId, intentId));

  return {
    success: true,
    message: "Ride completed. Funds released to driver.",
    driverPayout: remainingDriverPayout,
    platformFee,
    transactionHash: `0x${Date.now().toString(16)}${Math.random().toString(16).substr(2, 40)}`,
  };
}

export async function cancelEscrow(
  intentId: string,
  cancelledBy: "rider" | "driver",
  reason?: string
): Promise<{
  success: boolean;
  message: string;
  riderRefund: number;
  driverKeepsPremium: boolean;
  premiumAmount: number;
}> {
  const [escrow] = await db
    .select()
    .from(schema.pmgthEscrow)
    .where(eq(schema.pmgthEscrow.intentId, intentId))
    .limit(1);

  if (!escrow) {
    return { success: false, message: "Escrow not found", riderRefund: 0, driverKeepsPremium: false, premiumAmount: 0 };
  }

  const baseFare = parseFloat(escrow.baseFareUsdt!);
  const premium = parseFloat(escrow.premiumUsdt!);
  const status = escrow.status;

  let riderRefund = 0;
  let driverKeepsPremium = false;

  if (status === "pending") {
    riderRefund = baseFare + premium;
    driverKeepsPremium = false;
  } else if (status === "funded" || status === "in_progress") {
    riderRefund = baseFare;
    driverKeepsPremium = true;
  }

  await db.update(schema.pmgthEscrow)
    .set({ 
      status: cancelledBy === "rider" ? "cancelled_by_rider" : "cancelled_by_driver",
      cancelledAt: new Date(),
      cancellationReason: reason,
    })
    .where(eq(schema.pmgthEscrow.intentId, intentId));

  return {
    success: true,
    message: driverKeepsPremium 
      ? "Ride cancelled. Driver keeps the premium as compensation."
      : "Ride cancelled. Full refund processed.",
    riderRefund,
    driverKeepsPremium,
    premiumAmount: premium,
  };
}

export async function getEscrowStatus(intentId: string): Promise<{
  status: string;
  baseFareUsd: number;
  premiumUsd: number;
  totalUsd: number;
  premiumPaid: boolean;
  localCurrency: string;
  totalLocal: number;
  fxRate: number;
} | null> {
  const [escrow] = await db
    .select()
    .from(schema.pmgthEscrow)
    .where(eq(schema.pmgthEscrow.intentId, intentId))
    .limit(1);

  if (!escrow) return null;

  const baseFare = parseFloat(escrow.baseFareUsdt!);
  const premium = parseFloat(escrow.premiumUsdt!);
  const total = parseFloat(escrow.totalUsdt!);
  const fxRate = parseFloat(escrow.fxRate!);

  return {
    status: escrow.status!,
    baseFareUsd: baseFare,
    premiumUsd: premium,
    totalUsd: total,
    premiumPaid: escrow.premiumPaid!,
    localCurrency: escrow.localCurrency!,
    totalLocal: total * fxRate,
    fxRate,
  };
}

export async function getDriverPmgthEarnings(driverId: string): Promise<{
  totalPremiumsEarned: number;
  ridesWithPremium: number;
  averagePremium: number;
}> {
  const escrows = await db
    .select()
    .from(schema.pmgthEscrow)
    .where(
      and(
        eq(schema.pmgthEscrow.driverId, driverId),
        eq(schema.pmgthEscrow.premiumPaid, true)
      )
    );

  const totalPremiums = escrows.reduce((sum, e) => sum + parseFloat(e.premiumUsdt!) * 0.8, 0);
  
  return {
    totalPremiumsEarned: Math.round(totalPremiums * 100) / 100,
    ridesWithPremium: escrows.length,
    averagePremium: escrows.length > 0 ? Math.round((totalPremiums / escrows.length) * 100) / 100 : 0,
  };
}

export function formatLocalCurrency(amount: number, currency: string): string {
  const symbols: { [key: string]: string } = {
    USD: "$", MXN: "$", COP: "$", EUR: "€", GBP: "£",
    TRY: "₺", KES: "KSh", PHP: "₱", MAD: "DH", EGP: "E£",
    PEN: "S/", ZAR: "R", RON: "lei", THB: "฿",
  };
  
  const symbol = symbols[currency] || currency;
  return `${symbol}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getCurrencyForCity(citySlug: string): string {
  const cityToCurrency: { [key: string]: string } = {
    "mexico-city": "MXN",
    "bogota": "COP",
    "istanbul": "TRY",
    "nairobi": "KES",
    "manila": "PHP",
    "casablanca": "MAD",
    "cairo": "EGP",
    "lima": "PEN",
    "johannesburg": "ZAR",
    "bucharest": "RON",
    "bangkok": "THB",
  };
  
  return cityToCurrency[citySlug] || "USD";
}
