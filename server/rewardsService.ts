import { v4 as uuidv4 } from "uuid";
import { db } from "./db";
import {
  rewardAccounts,
  rewardTransactions,
  walletTransactions,
  giftsSent,
  users,
} from "@shared/schema";
import { eq, sql } from "drizzle-orm";

// ── Shared catalog & schedule constants ────────────────────────────────────

export const GIFT_CATALOG = [
  { key: "fuel_up", name: "Fuel Up", coins: 5, icon: "flash-outline" },
  { key: "karak_break", name: "Karak Break", coins: 10, icon: "cafe-outline" },
  { key: "route_star", name: "Route Star", coins: 25, icon: "star-outline" },
  { key: "green_light", name: "Green Light", coins: 50, icon: "checkmark-circle-outline" },
  { key: "road_king", name: "Road King", coins: 100, icon: "car-sport-outline" },
  { key: "express_lane", name: "Express Lane", coins: 500, icon: "navigate-outline" },
  { key: "golden_carriage", name: "Golden Carriage", coins: 1000, icon: "ribbon-outline" },
  { key: "fleet_legend", name: "Fleet Legend", coins: 5000, icon: "trophy-outline" },
  { key: "travony_crown", name: "Travony Crown", coins: 10000, icon: "diamond-outline" },
] as const;

export type GiftKey = (typeof GIFT_CATALOG)[number]["key"];

export const COIN_PACKS = [
  { id: "starter", coins: 70, priceHrs: 70, label: "Starter" },
  { id: "cruiser", coins: 350, priceHrs: 350, label: "Cruiser" },
  { id: "booster", coins: 700, priceHrs: 700, label: "Booster" },
  { id: "turbo", coins: 1400, priceHrs: 1400, label: "Turbo" },
  { id: "falcon", coins: 3500, priceHrs: 3500, label: "Falcon" },
  { id: "legend", coins: 7000, priceHrs: 7000, label: "Legend" },
] as const;

export type CoinPackId = (typeof COIN_PACKS)[number]["id"];

export const CHECKIN_SCHEDULE = [5, 10, 15, 20, 25, 30, 50] as const;

export const MISSIONS = [
  { key: "complete_ride", name: "Complete a ride", coins: 30, target: 1, icon: "car-outline" },
  { key: "publish_memory", name: "Publish a ride memory", coins: 20, target: 1, icon: "images-outline" },
  { key: "react_3", name: "React to 3 ride posts", coins: 10, target: 3, icon: "heart-outline" },
  { key: "follow_someone", name: "Follow someone new", coins: 10, target: 1, icon: "person-add-outline" },
] as const;

// ── Shared helpers ─────────────────────────────────────────────────────────

export async function getOrCreateAccount(userId: string) {
  const [existing] = await db
    .select()
    .from(rewardAccounts)
    .where(eq(rewardAccounts.userId, userId));
  if (existing) return existing;
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();
  await db
    .insert(rewardAccounts)
    .values({ id: uuidv4(), userId, referralCode: code })
    .onConflictDoNothing();
  const [fresh] = await db
    .select()
    .from(rewardAccounts)
    .where(eq(rewardAccounts.userId, userId));
  return fresh;
}

export async function creditRewards(
  tx: any,
  userId: string,
  kind: string,
  refId: string,
  coinsDelta: number,
  diamondsDelta: number,
  meta?: string,
) {
  await tx.insert(rewardTransactions).values({
    id: uuidv4(),
    userId,
    kind,
    coinsDelta,
    diamondsDelta,
    refId,
    meta: meta || null,
  });
  await tx
    .update(rewardAccounts)
    .set({
      coins: sql`${rewardAccounts.coins} + ${coinsDelta}`,
      diamonds: sql`${rewardAccounts.diamonds} + ${diamondsDelta}`,
      updatedAt: new Date(),
    })
    .where(eq(rewardAccounts.userId, userId));
}

// ── Service functions used by rewardsRoutes + agentRoutes ─────────────────

export interface CheckInResult {
  alreadyCheckedIn: boolean;
  coinsEarned?: number;
  streakDay?: number;
}

export async function performDailyCheckIn(userId: string): Promise<CheckInResult> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const acct = await getOrCreateAccount(userId);
  if (acct?.lastCheckInDate === today) return { alreadyCheckedIn: true };
  const newStreak = acct?.lastCheckInDate === yesterday ? (acct.streakDay || 0) + 1 : 1;
  const coins = CHECKIN_SCHEDULE[(newStreak - 1) % CHECKIN_SCHEDULE.length];
  try {
    await db.transaction(async (tx) => {
      await tx.insert(rewardTransactions).values({
        id: uuidv4(),
        userId,
        kind: "checkin",
        coinsDelta: coins,
        diamondsDelta: 0,
        refId: today,
      });
      await tx
        .update(rewardAccounts)
        .set({
          coins: sql`${rewardAccounts.coins} + ${coins}`,
          streakDay: newStreak,
          lastCheckInDate: today,
          updatedAt: new Date(),
        })
        .where(eq(rewardAccounts.userId, userId));
    });
    return { alreadyCheckedIn: false, coinsEarned: coins, streakDay: newStreak };
  } catch (err: any) {
    if (err?.code === "23505") return { alreadyCheckedIn: true };
    throw err;
  }
}

export interface CashoutResult {
  insufficient?: boolean;
  diamondsRedeemed?: number;
  aedCredited?: number;
}

export async function performDiamondCashout(userId: string): Promise<CashoutResult> {
  const MIN = 200;
  const RATE = 0.05; // AED per diamond
  const acct = await getOrCreateAccount(userId);
  if (!acct || (acct.diamonds || 0) < MIN) {
    return { insufficient: true };
  }
  const diamonds = acct.diamonds;
  const aed = Math.floor(diamonds * RATE * 100) / 100;
  const refId = uuidv4();
  await db.transaction(async (tx) => {
    await tx.insert(rewardTransactions).values({
      id: uuidv4(),
      userId,
      kind: "cashout",
      coinsDelta: 0,
      diamondsDelta: -diamonds,
      refId,
    });
    await tx
      .update(rewardAccounts)
      .set({ diamonds: 0, updatedAt: new Date() })
      .where(eq(rewardAccounts.userId, userId));
    await tx.insert(walletTransactions).values({
      id: uuidv4(),
      userId,
      type: "reward_cashout",
      amount: aed.toFixed(2),
      currency: "AED",
      status: "completed",
      description: `Diamond cashout: ${diamonds} diamonds`,
      referenceId: refId,
    });
    await tx
      .update(users)
      .set({
        walletBalance: sql`CAST(COALESCE(CAST(wallet_balance AS numeric), 0) + ${aed} AS text)`,
      } as any)
      .where(eq(users.id, userId));
  });
  return { diamondsRedeemed: diamonds, aedCredited: aed };
}

export interface BuyCoinsResult {
  hrsRequired?: boolean;
  unknownPack?: boolean;
  coinsAdded?: number;
  priceHrs?: number;
  packId?: string;
}

export async function performBuyCoins(_userId: string, packId: string): Promise<BuyCoinsResult> {
  const pack = COIN_PACKS.find((p) => p.id === packId);
  if (!pack) return { unknownPack: true };
  return { hrsRequired: true, priceHrs: pack.priceHrs, packId: pack.id };
}

export interface SendGiftResult {
  notEnoughCoins?: boolean;
  selfGift?: boolean;
  giftId?: string;
  giftName?: string;
  diamondsAwarded?: number;
}

export async function performSendGift(
  senderId: string,
  recipientId: string,
  giftKey: string,
  postId?: string,
  rideId?: string,
): Promise<SendGiftResult> {
  if (senderId === recipientId) return { selfGift: true };
  const gift = GIFT_CATALOG.find((g) => g.key === giftKey);
  if (!gift) throw new Error("Unknown gift key");
  const senderAcct = await getOrCreateAccount(senderId);
  if ((senderAcct?.coins || 0) < gift.coins) return { notEnoughCoins: true };
  const giftId = uuidv4();
  await db.transaction(async (tx) => {
    const debit = await tx.execute(sql`
      UPDATE reward_accounts
      SET coins = coins - ${gift.coins}, updated_at = NOW()
      WHERE user_id = ${senderId} AND coins >= ${gift.coins}
      RETURNING coins
    `);
    if (!debit.rows.length) throw new Error("Insufficient coins");
    await tx.insert(rewardTransactions).values({
      id: uuidv4(),
      userId: senderId,
      kind: "gift_sent",
      coinsDelta: -gift.coins,
      diamondsDelta: 0,
      refId: giftId,
      meta: gift.name,
    });
    await tx.insert(giftsSent).values({
      id: giftId,
      senderId,
      recipientId,
      giftKey: gift.key,
      coins: gift.coins,
      diamonds: gift.coins,
      context: postId ? "post" : "ride", // notNull field required by schema
      ...(postId ? { postId } : {}),
      ...(rideId ? { rideId } : {}),
    });
    await creditRewards(tx, recipientId, "gift_received", giftId, 0, gift.coins, gift.name);
  });
  return { giftId, giftName: gift.name, diamondsAwarded: gift.coins };
}
