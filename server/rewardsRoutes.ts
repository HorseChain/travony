import { Router } from "express";
import { randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";
import { db } from "./db";
import {
  users,
  drivers,
  rides,
  ridePosts,
  ridePostReactions,
  userFollows,
  rewardAccounts,
  rewardTransactions,
  giftsSent,
  walletTransactions,
  hrsPaymentIntents,
} from "@shared/schema";
import { eq, and, desc, gte, sql, count, inArray } from "drizzle-orm";
import { broadcastGiftIfLiveStream } from "./agoraStreaming";
import { verifyHrsTransfer, getPlatformAddress, isValidEthAddress } from "./hrsToken";

// Travony Rewards — TikTok-style economy adapted for a mobility network.
//   BUY:        Coins purchased from the existing AED wallet (packs).
//   CONTRIBUTE: Gifts sent on feed ride posts, or straight to your driver
//               after a completed trip. Recipient earns Diamonds.
//   EARN:       Daily check-in streak, ride-flavored missions, and invite
//               codes that only qualify once the invitee completes a ride.
// Every number is deterministic server code. Clients never send amounts.
// All balance moves are atomic (guarded UPDATEs inside db.transaction) and
// the reward_transactions UNIQUE(user, kind, ref) index is the idempotency
// wall for check-ins, missions, referral bonuses and milestones.

export const rewardsRouter = Router();

// ---------------------------------------------------------------------------
// Economy constants (server-owned; mirror TikTok's shape, Travony-tuned)
// ---------------------------------------------------------------------------

// Coins are topped up with HRS tokens (1 coin = 1 HRS). A gifted coin becomes
// 1 diamond for the recipient; diamonds cash out at AED 0.05.
const DIAMOND_VALUE_AED = 0.05;
const MIN_CASHOUT_DIAMONDS = 200;
const DAILY_EARN_CAP = 200; // coins/day from check-in + missions combined

const COIN_PACKS = [
  { id: "starter", coins: 70, priceHrs: 70, label: "Starter" },
  { id: "cruiser", coins: 350, priceHrs: 350, label: "Cruiser" },
  { id: "booster", coins: 700, priceHrs: 700, label: "Booster" },
  { id: "turbo", coins: 1400, priceHrs: 1400, label: "Turbo" },
  { id: "falcon", coins: 3500, priceHrs: 3500, label: "Falcon" },
  { id: "legend", coins: 7000, priceHrs: 7000, label: "Legend" },
] as const;

// Social + transportation gift catalog (icon = Ionicons name).
const GIFT_CATALOG = [
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

// Day 1..7 check-in rewards; an unbroken streak cycles back through the
// schedule (day 8 pays like day 1 again, TikTok-style weekly cycle).
const CHECKIN_SCHEDULE = [5, 10, 15, 20, 25, 30, 50] as const;

// Daily missions — every one verified against real rows, never self-reported.
const MISSIONS = [
  { key: "complete_ride", name: "Complete a ride", coins: 30, target: 1, icon: "car-outline" },
  { key: "publish_memory", name: "Publish a ride memory", coins: 20, target: 1, icon: "images-outline" },
  { key: "react_3", name: "React to 3 ride posts", coins: 10, target: 3, icon: "heart-outline" },
  { key: "follow_someone", name: "Follow someone new", coins: 10, target: 1, icon: "person-add-outline" },
] as const;

const REFERRAL_INVITEE_COINS = 100; // paid to the new user at redeem time
const REFERRAL_QUALIFIED_COINS = 200; // paid to the inviter at first completed ride
const REFERRAL_REDEEM_WINDOW_DAYS = 7;
const REFERRAL_MILESTONES = [
  { qualified: 3, coins: 300 },
  { qualified: 10, coins: 1000 },
  { qualified: 25, coins: 3000 },
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

// All rewards writes (and the hub itself) require a full account.
async function getWriteUser(req: any) {
  const session = await getSessionUser(req);
  if (!session) return null;
  const user = await storage.getUser(session.userId);
  if (!user || user.isGuest) return null;
  return user;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function startOfUtcDay(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function makeReferralCode(): string {
  // 8 chars, unambiguous alphabet.
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function getOrCreateAccount(userId: string) {
  const [existing] = await db
    .select()
    .from(rewardAccounts)
    .where(eq(rewardAccounts.userId, userId));
  if (existing) return existing;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db
        .insert(rewardAccounts)
        .values({ id: uuidv4(), userId, referralCode: makeReferralCode() })
        .onConflictDoNothing({ target: rewardAccounts.userId });
      break;
    } catch {
      // referral code collision — retry with a fresh code
    }
  }
  const [account] = await db
    .select()
    .from(rewardAccounts)
    .where(eq(rewardAccounts.userId, userId));
  return account;
}

async function earnedCoinsToday(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`COALESCE(SUM(${rewardTransactions.coinsDelta}), 0)` })
    .from(rewardTransactions)
    .where(
      and(
        eq(rewardTransactions.userId, userId),
        inArray(rewardTransactions.kind, ["checkin", "mission"]),
        gte(rewardTransactions.createdAt, startOfUtcDay()),
      ),
    );
  return Number(row?.total || 0);
}

// Insert a ledger row + bump balances atomically. Throws on duplicate refId
// (callers catch and treat as "already claimed").
async function creditRewards(
  tx: Tx,
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

function isDuplicateKeyError(err: any): boolean {
  return err?.code === "23505" || /duplicate key/i.test(String(err?.message || ""));
}

// ---------------------------------------------------------------------------
// Mission progress — all derived from real activity rows for the UTC day
// ---------------------------------------------------------------------------

async function missionProgress(userId: string): Promise<Record<string, number>> {
  const dayStart = startOfUtcDay();

  const [drv] = await db
    .select({ id: drivers.id })
    .from(drivers)
    .where(eq(drivers.userId, userId));

  const rideFilter = drv
    ? sql`(${rides.customerId} = ${userId} OR ${rides.driverId} = ${drv.id})`
    : sql`${rides.customerId} = ${userId}`;

  const [rideRow] = await db
    .select({ n: count() })
    .from(rides)
    .where(and(eq(rides.status, "completed"), gte(rides.completedAt, dayStart), rideFilter));

  const [postRow] = await db
    .select({ n: count() })
    .from(ridePosts)
    .where(and(eq(ridePosts.userId, userId), gte(ridePosts.createdAt, dayStart)));

  const [reactRow] = await db
    .select({ n: count() })
    .from(ridePostReactions)
    .where(and(eq(ridePostReactions.userId, userId), gte(ridePostReactions.createdAt, dayStart)));

  const [followRow] = await db
    .select({ n: count() })
    .from(userFollows)
    .where(and(eq(userFollows.followerId, userId), gte(userFollows.createdAt, dayStart)));

  return {
    complete_ride: Number(rideRow?.n || 0),
    publish_memory: Number(postRow?.n || 0),
    react_3: Number(reactRow?.n || 0),
    follow_someone: Number(followRow?.n || 0),
  };
}

// ---------------------------------------------------------------------------
// GET /api/rewards/me — single hub payload
// ---------------------------------------------------------------------------

rewardsRouter.get("/api/rewards/me", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in to see rewards" });

    const account = await getOrCreateAccount(user.id);
    const today = todayKey();
    const progress = await missionProgress(user.id);

    const claimedRows = await db
      .select({ kind: rewardTransactions.kind, refId: rewardTransactions.refId })
      .from(rewardTransactions)
      .where(
        and(
          eq(rewardTransactions.userId, user.id),
          inArray(rewardTransactions.kind, ["checkin", "mission"]),
          gte(rewardTransactions.createdAt, startOfUtcDay()),
        ),
      );
    const claimedMissions = new Set(
      claimedRows.filter((r) => r.kind === "mission").map((r) => r.refId.split(":")[0]),
    );
    const checkedInToday = account.lastCheckInDate === today;

    // Streak shown resets visually if yesterday was missed.
    const effectiveStreak =
      account.lastCheckInDate === today || account.lastCheckInDate === yesterdayKey()
        ? account.streakDay
        : 0;
    const nextDay = checkedInToday ? effectiveStreak : effectiveStreak + 1;
    const nextCheckInCoins = CHECKIN_SCHEDULE[(Math.max(nextDay, 1) - 1) % 7];

    // Referral stats
    const [redeemedRow] = await db
      .select({ n: count() })
      .from(rewardAccounts)
      .where(eq(rewardAccounts.referredBy, user.id));
    const [qualifiedRow] = await db
      .select({ n: count() })
      .from(rewardAccounts)
      .where(and(eq(rewardAccounts.referredBy, user.id), eq(rewardAccounts.referralQualified, true)));

    const signupAgeDays =
      (Date.now() - new Date(user.createdAt as any).getTime()) / (24 * 60 * 60 * 1000);

    const [giftStats] = await db
      .select({
        received: sql<number>`COALESCE(SUM(CASE WHEN ${giftsSent.recipientId} = ${user.id} THEN ${giftsSent.diamonds} ELSE 0 END), 0)`,
        sent: sql<number>`COALESCE(SUM(CASE WHEN ${giftsSent.senderId} = ${user.id} THEN ${giftsSent.coins} ELSE 0 END), 0)`,
      })
      .from(giftsSent);

    res.json({
      coins: account.coins,
      diamonds: account.diamonds,
      diamondValueAed: DIAMOND_VALUE_AED,
      minCashoutDiamonds: MIN_CASHOUT_DIAMONDS,
      cashoutValueAed: Number((account.diamonds * DIAMOND_VALUE_AED).toFixed(2)),
      checkIn: {
        checkedInToday,
        streakDay: effectiveStreak,
        nextCoins: nextCheckInCoins,
        schedule: CHECKIN_SCHEDULE,
      },
      missions: MISSIONS.map((m) => ({
        key: m.key,
        name: m.name,
        coins: m.coins,
        target: m.target,
        icon: m.icon,
        progress: Math.min(progress[m.key] || 0, m.target),
        claimable: (progress[m.key] || 0) >= m.target && !claimedMissions.has(m.key),
        claimed: claimedMissions.has(m.key),
      })),
      referral: {
        code: account.referralCode,
        invited: Number(redeemedRow?.n || 0),
        qualified: Number(qualifiedRow?.n || 0),
        milestones: REFERRAL_MILESTONES,
        inviteeCoins: REFERRAL_INVITEE_COINS,
        qualifiedCoins: REFERRAL_QUALIFIED_COINS,
        canRedeem: !account.referredBy && signupAgeDays <= REFERRAL_REDEEM_WINDOW_DAYS,
      },
      giftTotals: {
        diamondsReceived: Number(giftStats?.received || 0),
        coinsGifted: Number(giftStats?.sent || 0),
      },
      packs: COIN_PACKS,
      catalog: GIFT_CATALOG,
      dailyEarnCap: DAILY_EARN_CAP,
      ethWalletAddress: (user as any).ethWalletAddress ?? null,
      platformHrsAddress: getPlatformAddress(),
    });
  } catch (err: any) {
    console.error("[Rewards] me error:", err);
    res.status(500).json({ message: "Could not load rewards" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rewards/check-in
// ---------------------------------------------------------------------------

rewardsRouter.post("/api/rewards/check-in", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const account = await getOrCreateAccount(user.id);
    const today = todayKey();
    if (account.lastCheckInDate === today) {
      return res.status(409).json({ message: "Already checked in today" });
    }

    const newStreak = account.lastCheckInDate === yesterdayKey() ? account.streakDay + 1 : 1;
    const coins = CHECKIN_SCHEDULE[(newStreak - 1) % 7];

    const earned = await earnedCoinsToday(user.id);
    if (earned + coins > DAILY_EARN_CAP) {
      return res.status(429).json({ message: "Daily earn limit reached — come back tomorrow" });
    }

    await db.transaction(async (tx) => {
      await creditRewards(tx, user.id, "checkin", today, coins, 0);
      await tx
        .update(rewardAccounts)
        .set({ streakDay: newStreak, lastCheckInDate: today, updatedAt: new Date() })
        .where(eq(rewardAccounts.userId, user.id));
    });

    res.json({ coins, streakDay: newStreak });
  } catch (err: any) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ message: "Already checked in today" });
    }
    console.error("[Rewards] check-in error:", err);
    res.status(500).json({ message: "Check-in failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rewards/missions/claim { key }
// ---------------------------------------------------------------------------

rewardsRouter.post("/api/rewards/missions/claim", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const mission = MISSIONS.find((m) => m.key === req.body?.key);
    if (!mission) return res.status(400).json({ message: "Unknown mission" });

    await getOrCreateAccount(user.id);
    const progress = await missionProgress(user.id);
    if ((progress[mission.key] || 0) < mission.target) {
      return res.status(400).json({ message: "Mission not finished yet" });
    }

    const earned = await earnedCoinsToday(user.id);
    if (earned + mission.coins > DAILY_EARN_CAP) {
      return res.status(429).json({ message: "Daily earn limit reached — come back tomorrow" });
    }

    const refId = `${mission.key}:${todayKey()}`;
    await db.transaction(async (tx) => {
      await creditRewards(tx, user.id, "mission", refId, mission.coins, 0, mission.name);
    });

    res.json({ coins: mission.coins });
  } catch (err: any) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ message: "Already claimed today" });
    }
    console.error("[Rewards] mission claim error:", err);
    res.status(500).json({ message: "Claim failed" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/rewards/wallet-address { ethAddress } — save ETH wallet
// ---------------------------------------------------------------------------

rewardsRouter.patch("/api/rewards/wallet-address", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });
    const { ethAddress } = req.body || {};
    if (!ethAddress || !isValidEthAddress(ethAddress)) {
      return res.status(400).json({ message: "Enter a valid Ethereum wallet address" });
    }
    await db
      .update(users)
      .set({ ethWalletAddress: ethAddress } as any)
      .where(eq(users.id, user.id));
    res.json({ saved: true });
  } catch (err: any) {
    console.error("[Rewards] wallet-address error:", err);
    res.status(500).json({ message: "Could not save wallet address" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rewards/coins/hrs-initiate { packId, ethAddress? }
// Creates a 30-min payment intent. User sends HRS on Ethereum mainnet,
// then calls hrs-verify to confirm and receive coins.
// ---------------------------------------------------------------------------

rewardsRouter.post("/api/rewards/coins/hrs-initiate", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const pack = COIN_PACKS.find((p) => p.id === req.body?.packId);
    if (!pack) return res.status(400).json({ message: "Unknown coin pack" });

    const ethAddress = (req.body?.ethAddress || (user as any).ethWalletAddress || "").trim();
    if (!ethAddress || !isValidEthAddress(ethAddress)) {
      return res.status(400).json({ message: "Enter a valid Ethereum wallet address first" });
    }

    const platform = getPlatformAddress();
    if (!platform) {
      return res.status(503).json({ message: "Payment is temporarily unavailable" });
    }

    if (ethAddress !== (user as any).ethWalletAddress) {
      await db
        .update(users)
        .set({ ethWalletAddress: ethAddress } as any)
        .where(eq(users.id, user.id));
    }

    await getOrCreateAccount(user.id);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const [intent] = await db
      .insert(hrsPaymentIntents)
      .values({
        userId: user.id,
        packId: pack.id,
        hrsAmount: pack.priceHrs.toString(),
        coins: pack.coins,
        platformAddress: platform,
        userEthAddress: ethAddress,
        expiresAt,
      })
      .returning();

    res.json({
      intentId: intent.id,
      hrsAmount: pack.priceHrs,
      coins: pack.coins,
      platformAddress: platform,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err: any) {
    console.error("[Rewards] hrs-initiate error:", err);
    res.status(500).json({ message: "Could not create payment" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rewards/coins/hrs-verify { intentId }
// Scans Ethereum mainnet for the HRS transfer and credits coins if found.
// ---------------------------------------------------------------------------

rewardsRouter.post("/api/rewards/coins/hrs-verify", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const { intentId } = req.body || {};
    if (!intentId) return res.status(400).json({ message: "Intent ID required" });

    const [intent] = await db
      .select()
      .from(hrsPaymentIntents)
      .where(and(eq(hrsPaymentIntents.id, intentId), eq(hrsPaymentIntents.userId, user.id)));

    if (!intent) return res.status(404).json({ message: "Payment not found" });

    if (intent.status === "verified") {
      return res.json({ verified: true, coins: intent.coins, alreadyVerified: true });
    }
    if (intent.status === "expired" || new Date() > intent.expiresAt) {
      await db
        .update(hrsPaymentIntents)
        .set({ status: "expired" })
        .where(eq(hrsPaymentIntents.id, intentId));
      return res.status(400).json({ message: "This payment window has expired. Start a new one." });
    }

    const check = await verifyHrsTransfer(
      intent.userEthAddress,
      intent.platformAddress,
      Number(intent.hrsAmount),
    );

    if (!check.found || !check.txHash) {
      return res.status(202).json({
        verified: false,
        message: "Payment not detected yet. Send the HRS and try again.",
      });
    }

    // Guard against double-claiming the same on-chain transfer.
    const [existing] = await db
      .select({ id: hrsPaymentIntents.id })
      .from(hrsPaymentIntents)
      .where(
        and(
          eq(hrsPaymentIntents.txHash, check.txHash),
          eq(hrsPaymentIntents.status, "verified"),
        ),
      );
    if (existing) {
      return res.status(409).json({ message: "This payment was already used" });
    }

    await db.transaction(async (tx) => {
      await tx
        .update(hrsPaymentIntents)
        .set({ status: "verified", txHash: check.txHash })
        .where(eq(hrsPaymentIntents.id, intentId));
      await creditRewards(tx, user.id, "coin_purchase", intentId, intent.coins, 0, intent.packId);
    });

    res.json({ verified: true, coins: intent.coins, txHash: check.txHash });
  } catch (err: any) {
    console.error("[Rewards] hrs-verify error:", err);
    res.status(500).json({ message: "Verification failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rewards/gifts/send { giftKey, postId? | rideId? }
// ---------------------------------------------------------------------------

rewardsRouter.post("/api/rewards/gifts/send", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const gift = GIFT_CATALOG.find((g) => g.key === req.body?.giftKey);
    if (!gift) return res.status(400).json({ message: "Unknown gift" });

    const { postId, rideId } = req.body || {};
    if ((!postId && !rideId) || (postId && rideId)) {
      return res.status(400).json({ message: "Send a gift on a post or a ride" });
    }

    let recipientId: string | null = null;
    let context: "post" | "ride" = "post";

    if (postId) {
      const [post] = await db.select().from(ridePosts).where(eq(ridePosts.id, postId));
      if (!post) return res.status(404).json({ message: "Post not found" });
      recipientId = post.userId;
      context = "post";
    } else {
      const ride = await storage.getRide(rideId);
      if (!ride) return res.status(404).json({ message: "Ride not found" });
      if (ride.status !== "completed") {
        return res.status(400).json({ message: "You can gift your driver after the trip ends" });
      }
      if (ride.customerId !== user.id) {
        return res.status(403).json({ message: "Only the rider can gift this trip's driver" });
      }
      if (!ride.driverId) return res.status(400).json({ message: "No driver on this trip" });
      const [drv] = await db
        .select({ userId: drivers.userId })
        .from(drivers)
        .where(eq(drivers.id, ride.driverId));
      recipientId = drv?.userId || null;
      context = "ride";
    }

    if (!recipientId) return res.status(404).json({ message: "Recipient not found" });
    if (recipientId === user.id) {
      return res.status(400).json({ message: "You can't send a gift to yourself" });
    }

    const senderAccount = await getOrCreateAccount(user.id);
    if (senderAccount.coins < gift.coins) {
      return res.status(400).json({ message: "Not enough coins", needCoins: gift.coins });
    }
    await getOrCreateAccount(recipientId);

    const giftId = uuidv4();
    const ok = await db.transaction(async (tx) => {
      // Guarded coin debit — fails cleanly if balance raced away.
      const debit = await tx.execute(sql`
        UPDATE reward_accounts
        SET coins = coins - ${gift.coins}, updated_at = NOW()
        WHERE user_id = ${user.id} AND coins >= ${gift.coins}
        RETURNING coins
      `);
      if (!debit.rows.length) return false;

      await tx.insert(giftsSent).values({
        id: giftId,
        senderId: user.id,
        recipientId: recipientId!,
        giftKey: gift.key,
        coins: gift.coins,
        diamonds: gift.coins,
        context,
        postId: postId || null,
        rideId: rideId || null,
      });

      await tx.insert(rewardTransactions).values({
        id: uuidv4(),
        userId: user.id,
        kind: "gift_sent",
        coinsDelta: -gift.coins,
        diamondsDelta: 0,
        refId: giftId,
        meta: gift.name,
      });

      await creditRewards(tx, recipientId!, "gift_received", giftId, 0, gift.coins, gift.name);
      return true;
    });

    if (!ok) return res.status(400).json({ message: "Not enough coins" });

    // Post-commit, fire-and-forget: if this gift landed on a live in-app
    // stream, broadcast a display-only gift.sent event to viewers. A failure
    // here can never touch balances or this response; the giftId lets the
    // sender's client dedupe the echo of its own optimistic animation.
    if (postId) {
      broadcastGiftIfLiveStream(postId, {
        giftId,
        giftKey: gift.key,
        giftName: gift.name,
        coins: gift.coins,
        senderId: user.id,
      });
    }

    res.json({ sent: true, gift: gift.key, coins: gift.coins, giftId });
  } catch (err: any) {
    console.error("[Rewards] gift error:", err);
    res.status(500).json({ message: "Gift failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rewards/diamonds/cashout — all diamonds → AED wallet
// ---------------------------------------------------------------------------

rewardsRouter.post("/api/rewards/diamonds/cashout", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const account = await getOrCreateAccount(user.id);
    if (account.diamonds < MIN_CASHOUT_DIAMONDS) {
      return res.status(400).json({
        message: `You need at least ${MIN_CASHOUT_DIAMONDS} diamonds to cash out`,
      });
    }

    const result = await db.transaction(async (tx) => {
      // CTE captures the pre-update diamond count while locking the row, so
      // the drain amount and the zeroing are one atomic statement.
      const drain = await tx.execute(sql`
        WITH old AS (
          SELECT user_id, diamonds FROM reward_accounts
          WHERE user_id = ${user.id} AND diamonds >= ${MIN_CASHOUT_DIAMONDS}
          FOR UPDATE
        )
        UPDATE reward_accounts a
        SET diamonds = 0, updated_at = NOW()
        FROM old
        WHERE a.user_id = old.user_id
        RETURNING old.diamonds AS drained
      `);
      if (!drain.rows.length) return null;

      const drained = Number((drain.rows[0] as any).drained);
      const aed = Number((drained * DIAMOND_VALUE_AED).toFixed(2));

      const credit = await tx.execute(sql`
        UPDATE users
        SET wallet_balance = wallet_balance + ${aed.toFixed(2)}::numeric
        WHERE id = ${user.id}
        RETURNING wallet_balance
      `);

      await tx.insert(walletTransactions).values({
        id: uuidv4(),
        userId: user.id,
        type: "reward_cashout",
        amount: aed.toFixed(2),
        currency: "AED",
        status: "completed",
        description: `Rewards cash out — ${drained} diamonds`,
        completedAt: new Date(),
      });

      await tx.insert(rewardTransactions).values({
        id: uuidv4(),
        userId: user.id,
        kind: "cashout",
        coinsDelta: 0,
        diamondsDelta: -drained,
        refId: uuidv4(),
        meta: `${aed.toFixed(2)} AED`,
      });

      return {
        diamonds: drained,
        aed,
        walletBalance: String((credit.rows[0] as any)?.wallet_balance ?? ""),
      };
    });

    if (!result) {
      return res.status(400).json({ message: "Not enough diamonds to cash out" });
    }

    res.json(result);
  } catch (err: any) {
    console.error("[Rewards] cashout error:", err);
    res.status(500).json({ message: "Cash out failed" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rewards/referral/redeem { code }
// ---------------------------------------------------------------------------

rewardsRouter.post("/api/rewards/referral/redeem", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const code = String(req.body?.code || "").trim().toUpperCase();
    if (!code) return res.status(400).json({ message: "Enter an invite code" });

    const account = await getOrCreateAccount(user.id);
    if (account.referredBy) {
      return res.status(409).json({ message: "You already used an invite code" });
    }

    const signupAgeDays =
      (Date.now() - new Date(user.createdAt as any).getTime()) / (24 * 60 * 60 * 1000);
    if (signupAgeDays > REFERRAL_REDEEM_WINDOW_DAYS) {
      return res.status(400).json({
        message: `Invite codes can only be used within ${REFERRAL_REDEEM_WINDOW_DAYS} days of joining`,
      });
    }

    const [referrer] = await db
      .select()
      .from(rewardAccounts)
      .where(eq(rewardAccounts.referralCode, code));
    if (!referrer) return res.status(404).json({ message: "That invite code doesn't exist" });
    if (referrer.userId === user.id) {
      return res.status(400).json({ message: "You can't use your own code" });
    }

    await db.transaction(async (tx) => {
      const updated = await tx.execute(sql`
        UPDATE reward_accounts SET referred_by = ${referrer.userId}, updated_at = NOW()
        WHERE user_id = ${user.id} AND referred_by IS NULL
        RETURNING user_id
      `);
      if (!updated.rows.length) throw Object.assign(new Error("already redeemed"), { code: "23505" });
      await creditRewards(
        tx,
        user.id,
        "referral_invitee",
        referrer.userId,
        REFERRAL_INVITEE_COINS,
        0,
      );
    });

    res.json({ coins: REFERRAL_INVITEE_COINS });
  } catch (err: any) {
    if (isDuplicateKeyError(err)) {
      return res.status(409).json({ message: "You already used an invite code" });
    }
    console.error("[Rewards] referral redeem error:", err);
    res.status(500).json({ message: "Could not redeem code" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/rewards/history — recent ledger for the hub
// ---------------------------------------------------------------------------

rewardsRouter.get("/api/rewards/history", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ message: "Sign in first" });

    const rows = await db
      .select({
        id: rewardTransactions.id,
        kind: rewardTransactions.kind,
        coinsDelta: rewardTransactions.coinsDelta,
        diamondsDelta: rewardTransactions.diamondsDelta,
        meta: rewardTransactions.meta,
        createdAt: rewardTransactions.createdAt,
      })
      .from(rewardTransactions)
      .where(eq(rewardTransactions.userId, user.id))
      .orderBy(desc(rewardTransactions.createdAt))
      .limit(50);

    res.json(rows);
  } catch (err: any) {
    console.error("[Rewards] history error:", err);
    res.status(500).json({ message: "Could not load history" });
  }
});

// ---------------------------------------------------------------------------
// Ride-completion hook — referral qualification + inviter milestones.
// Fire-and-forget from the authorized completed transition in routes.ts.
// ---------------------------------------------------------------------------

export async function qualifyReferralsForRide(ride: {
  customerId: string;
  driverId: string | null;
}) {
  const participantUserIds: string[] = [ride.customerId];
  if (ride.driverId) {
    const [drv] = await db
      .select({ userId: drivers.userId })
      .from(drivers)
      .where(eq(drivers.id, ride.driverId));
    if (drv?.userId) participantUserIds.push(drv.userId);
  }

  for (const userId of participantUserIds) {
    try {
      const [account] = await db
        .select()
        .from(rewardAccounts)
        .where(eq(rewardAccounts.userId, userId));
      if (!account?.referredBy || account.referralQualified) continue;

      await db.transaction(async (tx) => {
        const updated = await tx.execute(sql`
          UPDATE reward_accounts SET referral_qualified = TRUE, updated_at = NOW()
          WHERE user_id = ${userId} AND referral_qualified = FALSE AND referred_by IS NOT NULL
          RETURNING referred_by
        `);
        if (!updated.rows.length) return;
        const referrerId = (updated.rows[0] as any).referred_by as string;

        await getOrCreateAccountTx(tx, referrerId);
        await creditRewards(
          tx,
          referrerId,
          "referral_qualified",
          userId,
          REFERRAL_QUALIFIED_COINS,
          0,
        );

        const [qRow] = await tx
          .select({ n: count() })
          .from(rewardAccounts)
          .where(
            and(
              eq(rewardAccounts.referredBy, referrerId),
              eq(rewardAccounts.referralQualified, true),
            ),
          );
        const qualified = Number(qRow?.n || 0);
        for (const m of REFERRAL_MILESTONES) {
          if (qualified === m.qualified) {
            await creditRewards(
              tx,
              referrerId,
              "referral_milestone",
              `milestone:${m.qualified}`,
              m.coins,
              0,
            );
          }
        }
      });
    } catch (err: any) {
      if (!isDuplicateKeyError(err)) {
        console.error("[Rewards] referral qualification error:", err);
      }
    }
  }
}

// Tx-scoped account creation used inside the qualification transaction.
async function getOrCreateAccountTx(tx: Tx, userId: string) {
  await tx
    .insert(rewardAccounts)
    .values({ id: uuidv4(), userId, referralCode: makeReferralCode() })
    .onConflictDoNothing({ target: rewardAccounts.userId });
}
