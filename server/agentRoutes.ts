import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";
import { db } from "./db";
import {
  users,
  drivers,
  rides,
  walletTransactions,
  agentUserProfile,
  agentSessions,
  rewardAccounts,
  rewardTransactions,
  ridePosts,
  userFollows,
  trendingCache,
  hubs,
  prayerRideSubscriptions,
  coffeeOrders,
} from "@shared/schema";
import { eq, and, desc, gte, ilike, sql, or, inArray } from "drizzle-orm";
import { calculateOptimalPrice } from "./aiEngine";
import { detectRegionFromCoordinates, getRegionByCode } from "./regionService";
import { createCoffeeOrder, CoffeeValidationError, COFFEE_MENU } from "./coffeeService";
import {
  GIFT_CATALOG,
  COIN_PACKS,
  CHECKIN_SCHEDULE,
  MISSIONS,
  getOrCreateAccount,
  performDailyCheckIn,
  performDiamondCashout,
  performBuyCoins,
  performSendGift,
} from "./rewardsService";

export const agentRouter = Router();

// ============================================================================
// Travony AI — Claude claude-opus-4-5 execution agent.
//
// Architecture:
//  - buildContextSnapshot: deterministic full-context fetch injected into
//    system prompt on every message (no LLM guess-work).
//  - executeTool: delegates to existing storage/service functions; NEVER
//    reimplements business logic — it calls the same code paths as routes.
//  - learnFromToolCalls: post-session preference derivation (deterministic).
//  - Response contract: { reply, cards[], toolsUsed[] } — always arrays.
// ============================================================================

function getAnthropicClient(): Anthropic | null {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) return null;
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

function replyIsHonest(reply: string): boolean {
  if (/\d/.test(reply)) return false;
  // Mirrors assistantRoutes.ts guard exactly — no crypto/coin vocab in text
  if (/\b(crypto|cryptocurrency|token|tokens|blockchain|erc[- ]?20|ethereum|on[- ]?chain|coin|coins|stablecoin|usdt|hrs)\b/i.test(reply)) return false;
  return true;
}

function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return Math.max(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)), 0.5);
}

async function getOrCreateAgentProfile(userId: string) {
  const [existing] = await db
    .select()
    .from(agentUserProfile)
    .where(eq(agentUserProfile.userId, userId));
  if (existing) return existing;
  await db.insert(agentUserProfile).values({ userId }).onConflictDoNothing();
  const [fresh] = await db
    .select()
    .from(agentUserProfile)
    .where(eq(agentUserProfile.userId, userId));
  return fresh;
}

// ---------------------------------------------------------------------------
// Full deterministic context snapshot — injected into system prompt each turn
// ---------------------------------------------------------------------------
async function buildContextSnapshot(userId: string, userRole: string) {
  const user = await storage.getUser(userId);
  if (!user) return null;

  const recentRides = await db
    .select({
      id: rides.id,
      pickupAddress: rides.pickupAddress,
      dropoffAddress: rides.dropoffAddress,
      status: rides.status,
      estimatedFare: rides.estimatedFare,
      createdAt: rides.createdAt,
    })
    .from(rides)
    .where(eq(rides.customerId, userId))
    .orderBy(desc(rides.createdAt))
    .limit(6);

  const activeRide =
    recentRides.find((r) =>
      ["pending", "accepted", "arriving", "in_progress", "started"].includes(r.status || ""),
    ) || null;

  let driverInfo: any = null;
  if (userRole === "driver") {
    const [drv] = await db
      .select({
        id: drivers.id,
        status: drivers.status,
        isOnline: drivers.isOnline,
        rating: drivers.rating,
        totalTrips: drivers.totalTrips,
        walletBalance: drivers.walletBalance,
      })
      .from(drivers)
      .where(eq(drivers.userId, userId));
    if (drv) driverInfo = drv;
  }

  const acct = await getOrCreateAccount(userId).catch(() => null);
  const today = new Date().toISOString().slice(0, 10);
  const profile = await getOrCreateAgentProfile(userId);

  // Parse homeAddress — stored as JSON string "{lat, lng, address}" or plain text
  let savedPlaces: { label: string; address: string }[] = [];
  if ((user as any).homeAddress) {
    try {
      const parsed = JSON.parse((user as any).homeAddress as string);
      savedPlaces = [{ label: "Home", address: parsed.address || (user as any).homeAddress }];
    } catch {
      savedPlaces = [{ label: "Home", address: String((user as any).homeAddress) }];
    }
  }

  const hour = new Date().getHours();
  const period =
    hour < 6 ? "late-night" : hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 21 ? "evening" : "night";

  return {
    name: user.name,
    handle: (user as any).handle || null,
    role: userRole,
    walletAed: user.walletBalance || "0.00",
    city: (user as any).city || null,
    timePeriod: period,
    savedPlaces,
    activeRide: activeRide
      ? { id: activeRide.id, status: activeRide.status, to: activeRide.dropoffAddress }
      : null,
    recentRides: recentRides
      .filter((r) => r.status === "completed")
      .slice(0, 3)
      .map((r) => ({ from: r.pickupAddress, to: r.dropoffAddress, status: r.status })),
    rewards: acct
      ? {
          coins: acct.coins || 0,
          diamonds: acct.diamonds || 0,
          streakDay: acct.streakDay || 0,
          checkedInToday: acct.lastCheckInDate === today,
        }
      : null,
    driver: driverInfo,
    preferences: (profile?.preferences as Record<string, any>) || {},
    sessionCount: profile?.sessionCount || 0,
  };
}

// ---------------------------------------------------------------------------
// Post-session preference learning (deterministic — no LLM involvement)
// ---------------------------------------------------------------------------
async function learnFromToolCalls(
  userId: string,
  toolCallLog: Array<{ tool: string; input: any; success: boolean }>,
) {
  try {
    const profile = await getOrCreateAgentProfile(userId);
    const prefs = { ...(profile?.preferences as Record<string, any>) };
    let updated = false;

    const toolCounts: Record<string, number> = {};
    for (const call of toolCallLog) {
      toolCounts[call.tool] = (toolCounts[call.tool] || 0) + 1;
    }

    const topTool = Object.entries(toolCounts).sort(([, a], [, b]) => b - a)[0]?.[0];
    if (topTool) { prefs.top_action = topTool; updated = true; }

    const onlineCalls = toolCallLog.filter((c) => c.tool === "go_driver_online" && c.success);
    if (onlineCalls.length) {
      const h = new Date().getHours();
      prefs.peak_online_hour = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
      updated = true;
    }

    for (const call of toolCallLog) {
      if (!call.success) continue;
      if (call.tool === "book_ride" && call.input?.confirm_payload?.dropoffAddress) {
        const dest = String(call.input.confirm_payload.dropoffAddress).slice(0, 80);
        const fk = `_freq_${dest.toLowerCase().replace(/[^a-z0-9]/g, "_").slice(0, 40)}`;
        prefs[fk] = (Number(prefs[fk]) || 0) + 1;
        if (Number(prefs[fk]) >= 2) { prefs.frequent_destination = dest; updated = true; }
        if (call.input.payment_method) { prefs.preferred_payment = call.input.payment_method; updated = true; }
      }
      if (call.tool === "order_coffee" && call.input?.item_id) {
        const ck = `_coffee_${call.input.item_id}`;
        prefs[ck] = (Number(prefs[ck]) || 0) + 1;
        if (Number(prefs[ck]) >= 2) { prefs.preferred_coffee = call.input.item_id; updated = true; }
      }
      if (call.tool === "do_daily_checkin") { prefs.daily_checkin_habit = "yes"; updated = true; }
    }

    if (updated) {
      await db
        .update(agentUserProfile)
        .set({ preferences: prefs, updatedAt: new Date() })
        .where(eq(agentUserProfile.userId, userId));
    }
  } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_user_context",
    description:
      "Refresh user state mid-conversation. Full live state is already injected at message start — only call this if something significant may have changed (e.g. after a booking).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "quote_ride",
    description: "Get a real-time fare quote between two points. Always call before book_ride.",
    input_schema: {
      type: "object" as const,
      properties: {
        pickup_address: { type: "string" },
        pickup_lat: { type: "number" },
        pickup_lng: { type: "number" },
        dropoff_address: { type: "string" },
        dropoff_lat: { type: "number" },
        dropoff_lng: { type: "number" },
      },
      required: ["pickup_address", "pickup_lat", "pickup_lng", "dropoff_address", "dropoff_lat", "dropoff_lng"],
    },
  },
  {
    name: "book_ride",
    description: "Book a ride. Only call after explicit user confirmation. Pass confirmPayload from quote_ride.",
    input_schema: {
      type: "object" as const,
      properties: {
        confirm_payload: { type: "object" },
        payment_method: { type: "string", enum: ["cash", "wallet"] },
      },
      required: ["confirm_payload"],
    },
  },
  {
    name: "cancel_ride",
    description: "Cancel the user's active ride.",
    input_schema: {
      type: "object" as const,
      properties: { ride_id: { type: "string" } },
      required: ["ride_id"],
    },
  },
  {
    name: "get_active_ride",
    description: "Get full details of the user's current active ride (status, driver, ETA, fare).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_wallet",
    description: "Get wallet balance and recent transactions as a card.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_ride_history",
    description: "Get the user's recent rides.",
    input_schema: {
      type: "object" as const,
      properties: { limit: { type: "number" } },
      required: [],
    },
  },
  {
    name: "get_coffee_menu",
    description: "Show the Travony coffee menu.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "order_coffee",
    description: "Place a coffee order for delivery to the user's location or for pickup at a hub.",
    input_schema: {
      type: "object" as const,
      properties: {
        item_id: { type: "string", description: "Coffee item ID from the menu" },
        size: { type: "string", enum: ["small", "medium", "large"], description: "Size" },
        order_type: { type: "string", enum: ["delivery", "pickup"], description: "Delivery or pickup" },
        delivery_address: { type: "string" },
        delivery_lat: { type: "number" },
        delivery_lng: { type: "number" },
        hub_id: { type: "string", description: "Hub ID for pickup orders" },
        special_instructions: { type: "string" },
        payment_method: { type: "string", enum: ["cash", "wallet"] },
      },
      required: ["item_id", "order_type"],
    },
  },
  {
    name: "get_rewards_info",
    description: "Get coins, diamonds, check-in streak, gift catalog, and coin packs.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_daily_missions",
    description: "Get today's daily missions and whether each is completed.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "do_daily_checkin",
    description: "Perform the daily check-in to earn coins (once per day).",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "buy_coins",
    description: "Look up a coin pack. Coins are now purchased with HRS tokens — direct the user to the Rewards screen to complete the payment.",
    input_schema: {
      type: "object" as const,
      properties: {
        pack_id: {
          type: "string",
          enum: ["starter", "cruiser", "booster", "turbo", "falcon", "legend"],
          description: "Coin pack ID",
        },
      },
      required: ["pack_id"],
    },
  },
  {
    name: "redeem_diamonds",
    description: "Cash out the user's diamonds to their AED wallet. Minimum 200 diamonds required.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "send_gift",
    description: "Send a gift to another user using coins. Can be sent on a ride or post.",
    input_schema: {
      type: "object" as const,
      properties: {
        gift_key: {
          type: "string",
          enum: ["rose", "karak", "coffee", "dates", "oud", "falcon", "dune_rider", "golden_wheel", "supercar", "travony_star"],
        },
        recipient_user_id: { type: "string" },
        post_id: { type: "string", description: "Optional post ID to attach gift to" },
        ride_id: { type: "string", description: "Optional ride ID to attach gift to" },
      },
      required: ["gift_key", "recipient_user_id"],
    },
  },
  {
    name: "get_nearby_hubs",
    description: "Find OpenClaw hubs near a location.",
    input_schema: {
      type: "object" as const,
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
        limit: { type: "number" },
      },
      required: ["lat", "lng"],
    },
  },
  {
    name: "get_trending",
    description: "Get trending routes and popular destinations right now.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "search_users",
    description: "Search for other Travony users by name.",
    input_schema: {
      type: "object" as const,
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "follow_user",
    description: "Follow another user by their ID.",
    input_schema: {
      type: "object" as const,
      properties: { target_user_id: { type: "string" } },
      required: ["target_user_id"],
    },
  },
  {
    name: "unfollow_user",
    description: "Unfollow a user by their ID.",
    input_schema: {
      type: "object" as const,
      properties: { target_user_id: { type: "string" } },
      required: ["target_user_id"],
    },
  },
  {
    name: "publish_memory",
    description:
      "Publish a completed ride as a memory/post to the Travony social feed. The ride must be completed and the user must be a participant.",
    input_schema: {
      type: "object" as const,
      properties: {
        ride_id: { type: "string" },
        caption: { type: "string" },
      },
      required: ["ride_id"],
    },
  },
  {
    name: "book_prayer_ride",
    description:
      "Subscribe to automated free prayer rides to a mosque. The system dispatches a ride before each selected prayer time.",
    input_schema: {
      type: "object" as const,
      properties: {
        hub_id: { type: "string", description: "Mosque hub ID from get_nearby_hubs" },
        pickup_address: { type: "string" },
        pickup_lat: { type: "number" },
        pickup_lng: { type: "number" },
        prayers: {
          type: "array",
          items: { type: "string" },
          description: "List of prayers: fajr, dhuhr, asr, maghrib, isha, jumuah",
        },
        buffer_minutes: { type: "number", description: "Minutes before prayer time to depart (default 10)" },
      },
      required: ["hub_id", "pickup_address", "pickup_lat", "pickup_lng", "prayers"],
    },
  },
  {
    name: "schedule_arrival",
    description:
      "Book a ride scheduled to arrive at a destination by a specific deadline time (e.g. flight, meeting). Calculates departure time based on estimated trip duration.",
    input_schema: {
      type: "object" as const,
      properties: {
        pickup_address: { type: "string" },
        pickup_lat: { type: "number" },
        pickup_lng: { type: "number" },
        dropoff_address: { type: "string" },
        dropoff_lat: { type: "number" },
        dropoff_lng: { type: "number" },
        arrive_by_iso: { type: "string", description: "ISO datetime the user must arrive by" },
        payment_method: { type: "string", enum: ["cash", "wallet"] },
      },
      required: ["pickup_address", "pickup_lat", "pickup_lng", "dropoff_address", "dropoff_lat", "dropoff_lng", "arrive_by_iso"],
    },
  },
  {
    name: "get_car_ladder",
    description: "Get the driver's Car Ladder progress — target vehicle, contributions, progress. Driver only.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "go_driver_online",
    description: "Set the driver as online. Driver only.",
    input_schema: {
      type: "object" as const,
      properties: {
        lat: { type: "number" },
        lng: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "go_driver_offline",
    description: "Set the driver as offline. Driver only.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_driver_info",
    description: "Get driver status, earnings, rating, trip counts. Driver only.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_driver_earnings",
    description: "Get the driver's recent earnings breakdown. Driver only.",
    input_schema: {
      type: "object" as const,
      properties: { days: { type: "number" } },
      required: [],
    },
  },
  {
    name: "get_pending_rides",
    description: "Get pending ride requests waiting for a driver to accept. Driver only.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_coffee_orders",
    description: "Get pending coffee orders available to fulfill. Driver only.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "get_social_feed",
    description: "Get recent ride memory posts from the social feed (Following or For You tab).",
    input_schema: {
      type: "object" as const,
      properties: {
        tab: { type: "string", enum: ["foryou", "following"], description: "Feed tab (default: foryou)" },
        limit: { type: "number" },
      },
      required: [],
    },
  },
  {
    name: "top_up_wallet",
    description:
      "Show available wallet top-up options. Returns coin pack prices so the user can choose a pack and call buy_coins, or explains how to add AED directly via the Wallet screen.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
  {
    name: "remember_preference",
    description: "Persistently save a user preference for future sessions.",
    input_schema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["key", "value"],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool executor — always delegates to existing service/storage functions
// ---------------------------------------------------------------------------

interface ToolCtx {
  userId: string;
  userRole: string;
  location?: { lat: number; lng: number } | null;
}

async function executeTool(
  name: string,
  input: any,
  ctx: ToolCtx,
): Promise<{ data?: any; cards?: any[]; error?: string }> {
  const { userId, userRole } = ctx;

  try {
    switch (name) {
      // ── refresh context ──────────────────────────────────────────────────
      case "get_user_context": {
        const snap = await buildContextSnapshot(userId, userRole);
        return { data: snap || { error: "Not found" } };
      }

      // ── quote ────────────────────────────────────────────────────────────
      case "quote_ride": {
        const { pickup_address, pickup_lat, pickup_lng, dropoff_address, dropoff_lat, dropoff_lng } = input;
        const regionCode = detectRegionFromCoordinates(pickup_lat, pickup_lng);
        const region = await getRegionByCode(regionCode).catch(() => null);
        const vehicleType = region?.vehicleTypes?.[0]?.type || "economy";
        const pricing = await calculateOptimalPrice(
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicleType, regionCode,
        );
        const dist = distKm(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng);
        const duration = Math.round(dist * 3);
        const multiplier = Math.min(
          pricing.demandMultiplier * pricing.timeOfDayMultiplier * pricing.trafficMultiplier,
          pricing.surgeCap,
        );
        const user = await storage.getUser(userId);
        const walletBalance = parseFloat(user?.walletBalance || "0") || 0;
        return {
          cards: [{
            type: "booking",
            pickup: { address: pickup_address, lat: pickup_lat, lng: pickup_lng },
            dropoff: { address: dropoff_address, lat: dropoff_lat, lng: dropoff_lng },
            vehicleType,
            regionCode,
            currency: pricing.currency,
            fare: Math.round(pricing.total * 100) / 100,
            platformFee: pricing.platformFee,
            driverEarnings: pricing.driverEarnings,
            distanceKm: Math.round(dist * 10) / 10,
            durationMin: duration,
            surgeMultiplier: Math.round(multiplier * 100) / 100,
            priceExplanation: pricing.priceExplanation,
            walletBalance,
            confirmPayload: {
              pickupAddress: pickup_address,
              pickupLat: pickup_lat.toString(),
              pickupLng: pickup_lng.toString(),
              dropoffAddress: dropoff_address,
              dropoffLat: dropoff_lat.toString(),
              dropoffLng: dropoff_lng.toString(),
              serviceTypeId: vehicleType,
              estimatedFare: pricing.total.toFixed(2),
              distance: Number(dist.toFixed(2)),
              duration,
              paymentMethod: "cash",
              surgeMultiplier: multiplier.toFixed(2),
              platformFee: pricing.platformFee.toFixed(2),
              driverEarnings: pricing.driverEarnings.toFixed(2),
              priceBreakdown: JSON.stringify({
                baseFare: pricing.baseFare,
                distanceCharge: pricing.distanceCharge,
                timeCharge: pricing.timeCharge,
                surgeMultiplier: multiplier,
                finalPrice: pricing.total,
                currency: pricing.currency,
              }),
              regionCode,
            },
          }],
          data: {
            fare: `${pricing.currency} ${pricing.total.toFixed(2)}`,
            distanceKm: Math.round(dist * 10) / 10,
            durationMin: duration,
          },
        };
      }

      // ── book ─────────────────────────────────────────────────────────────
      case "book_ride": {
        const { confirm_payload, payment_method } = input;
        if (!confirm_payload) return { error: "No confirmPayload" };
        const created = await storage.createRide({
          ...confirm_payload,
          customerId: userId,
          paymentMethod: payment_method || "cash",
        });
        if (!created) return { error: "Ride creation failed" };
        return { cards: [{ type: "live_ride", rideId: created.id }], data: { rideId: created.id } };
      }

      // ── cancel ───────────────────────────────────────────────────────────
      case "cancel_ride": {
        const ride = await storage.getRide(input.ride_id);
        if (!ride) return { error: "Ride not found" };
        if (ride.customerId !== userId) return { error: "Not your ride" };
        await storage.updateRide(input.ride_id, { status: "cancelled" });
        return { data: { cancelled: true, rideId: input.ride_id } };
      }

      // ── active ride ──────────────────────────────────────────────────────
      case "get_active_ride": {
        const [activeRide] = await db
          .select()
          .from(rides)
          .where(eq(rides.customerId, userId))
          .orderBy(desc(rides.createdAt))
          .limit(1);
        const isActive =
          activeRide &&
          ["pending", "accepted", "arriving", "in_progress", "started"].includes(activeRide.status || "");
        if (!isActive) return { data: { hasActiveRide: false } };
        return {
          cards: [{ type: "live_ride", rideId: activeRide.id }],
          data: { rideId: activeRide.id, status: activeRide.status, to: activeRide.dropoffAddress },
        };
      }

      // ── wallet ───────────────────────────────────────────────────────────
      case "get_wallet": {
        const user = await storage.getUser(userId);
        const txs = await db
          .select()
          .from(walletTransactions)
          .where(eq(walletTransactions.userId, userId))
          .orderBy(desc(walletTransactions.createdAt))
          .limit(8);
        return {
          cards: [{
            type: "wallet",
            balance: user?.walletBalance || "0.00",
            currency: "AED",
            transactions: txs.map((t) => ({
              id: t.id,
              type: t.type,
              amount: t.amount,
              currency: t.currency || "AED",
              description: t.description || t.type,
              status: t.status || "completed",
              createdAt: t.createdAt?.toISOString() || "",
            })),
          }],
          data: { balance: user?.walletBalance || "0.00" },
        };
      }

      // ── ride history ─────────────────────────────────────────────────────
      case "get_ride_history": {
        const lim = Math.min(Number(input.limit) || 5, 10);
        const recent = await db
          .select({
            id: rides.id,
            pickupAddress: rides.pickupAddress,
            dropoffAddress: rides.dropoffAddress,
            fare: rides.estimatedFare,
            status: rides.status,
            createdAt: rides.createdAt,
          })
          .from(rides)
          .where(eq(rides.customerId, userId))
          .orderBy(desc(rides.createdAt))
          .limit(lim);
        return {
          cards: [{
            type: "rides",
            rides: recent.map((r) => ({
              id: r.id,
              pickupAddress: r.pickupAddress || "",
              dropoffAddress: r.dropoffAddress || "",
              fare: r.fare || "0",
              currency: "AED",
              status: r.status,
              createdAt: r.createdAt?.toISOString() || "",
              hasBlockchainProof: false,
            })),
          }],
          data: { count: recent.length },
        };
      }

      // ── coffee menu ──────────────────────────────────────────────────────
      case "get_coffee_menu": {
        return {
          cards: [{
            type: "coffee",
            items: COFFEE_MENU.slice(0, 12).map((item) => ({
              id: item.id,
              name: item.name,
              basePrice: item.basePrice,
              currency: item.currency,
              description: item.description,
              category: item.category,
            })),
          }],
          data: { itemCount: COFFEE_MENU.length },
        };
      }

      // ── order coffee ─────────────────────────────────────────────────────
      case "order_coffee": {
        const {
          item_id, size, order_type, delivery_address, delivery_lat, delivery_lng,
          hub_id, special_instructions, payment_method,
        } = input;
        const menuItem = COFFEE_MENU.find((m) => m.id === item_id);
        if (!menuItem) return { error: "Unknown coffee item — call get_coffee_menu first" };
        // Map user-facing terms to coffeeOrderTypeEnum: "order"|"buy"|"gift"
        const domainType: "order" | "buy" | "gift" =
          order_type === "pickup" ? "buy" :
          order_type === "gift" ? "gift" : "order";
        const order = await createCoffeeOrder({
          ordererId: userId,
          orderType: domainType,
          coffeeName: item_id,
          coffeeSize: size || "medium",
          quantity: 1,
          specialInstructions: special_instructions || null,
          hubId: hub_id || null,
          deliveryLat: delivery_lat ? String(delivery_lat) : null,
          deliveryLng: delivery_lng ? String(delivery_lng) : null,
          deliveryAddress: delivery_address || null,
          paymentMethod: payment_method || "cash",
        });
        // Card shape matches CoffeeCard: must have items[] array.
        // We include orderId/status as extra fields for context (not rendered but harmless).
        return {
          cards: [{
            type: "coffee",
            orderId: order.id,
            status: order.status,
            items: [{
              id: menuItem.id,
              name: menuItem.name,
              basePrice: menuItem.basePrice,
              currency: menuItem.currency,
              description: menuItem.description,
              category: menuItem.category,
            }],
          }],
          data: { orderId: order.id, status: order.status },
        };
      }

      // ── rewards info ─────────────────────────────────────────────────────
      case "get_rewards_info": {
        const acct = await getOrCreateAccount(userId);
        const today = new Date().toISOString().slice(0, 10);
        const streakDay = acct?.streakDay || 0;
        const checkedInToday = acct?.lastCheckInDate === today;
        const nextDay = checkedInToday ? streakDay : streakDay + 1;
        const nextCheckInCoins = CHECKIN_SCHEDULE[(Math.max(nextDay, 1) - 1) % CHECKIN_SCHEDULE.length];
        const coins = acct?.coins || 0;
        const diamonds = acct?.diamonds || 0;
        const cashableAed = (diamonds * 0.05).toFixed(2);
        return {
          cards: [{
            type: "rewards",
            coins,
            diamonds,
            streakDay,
            checkedInToday,
            nextCheckInCoins,
            cashableAed,
          }],
          data: {
            coins,
            diamonds,
            streakDay,
            checkedInToday,
            nextCheckInCoins,
            giftCatalog: GIFT_CATALOG.map((g) => ({ key: g.key, name: g.name, coins: g.coins })),
            coinPacks: COIN_PACKS.map((p) => ({ id: p.id, coins: p.coins, priceHrs: p.priceHrs, label: p.label })),
            minimumDiamondCashout: 200,
            diamondValueAed: 0.05,
          },
        };
      }

      // ── daily missions ───────────────────────────────────────────────────
      case "get_daily_missions": {
        const today = new Date().toISOString().slice(0, 10);
        const completedTxs = await db
          .select({ refId: rewardTransactions.refId })
          .from(rewardTransactions)
          .where(
            and(
              eq(rewardTransactions.userId, userId),
              eq(rewardTransactions.kind, "mission"),
              gte(rewardTransactions.createdAt, new Date(today)),
            ),
          );
        const completedKeys = new Set(completedTxs.map((t) => t.refId?.split(":")?.[0] || ""));
        const missions = MISSIONS.map((m) => ({
          key: m.key,
          name: m.name,
          coins: m.coins,
          completed: completedKeys.has(m.key),
        }));
        return {
          cards: [{ type: "missions", missions }],
          data: { missions, totalDailyCap: 200 },
        };
      }

      // ── check-in (delegates to rewardsService) ───────────────────────────
      case "do_daily_checkin": {
        const result = await performDailyCheckIn(userId);
        return { data: result };
      }

      // ── buy coins (delegates to rewardsService) ──────────────────────────
      case "buy_coins": {
        const { pack_id } = input;
        const result = await performBuyCoins(userId, pack_id);
        if (result.unknownPack) return { error: "Unknown coin pack" };
        return {
          reply: `To buy the ${result.packId} pack (${result.priceHrs} HRS → ${COIN_PACKS.find(p => p.id === result.packId)?.coins} coins), open the Rewards screen and tap "Buy Coins" to complete the HRS token payment.`,
          data: result,
        };
      }

      // ── redeem diamonds (delegates to rewardsService) ────────────────────
      case "redeem_diamonds": {
        const result = await performDiamondCashout(userId);
        if (result.insufficient) {
          const acct = await getOrCreateAccount(userId);
          return { error: `Need at least 200 diamonds (you have ${acct?.diamonds || 0})` };
        }
        return { data: result };
      }

      // ── send gift (delegates to rewardsService) ──────────────────────────
      case "send_gift": {
        const { gift_key, recipient_user_id, post_id, ride_id } = input;
        if (!recipient_user_id) return { error: "recipient_user_id required" };
        const result = await performSendGift(userId, recipient_user_id, gift_key, post_id, ride_id);
        if (result.selfGift) return { error: "Cannot send a gift to yourself" };
        if (result.notEnoughCoins) {
          const acct = await getOrCreateAccount(userId);
          const gift = GIFT_CATALOG.find((g) => g.key === gift_key);
          return { error: `Not enough coins. You have ${acct?.coins || 0}, need ${gift?.coins || "?"}` };
        }
        return { data: result };
      }

      // ── nearby hubs ──────────────────────────────────────────────────────
      case "get_nearby_hubs": {
        const { lat, lng, limit: lim = 5 } = input;
        // hubs schema columns: id, name, type, lat, lng, address, regionCode,
        // cityId, isEvHub, totalChargingPorts, availablePorts (no city/country/totalCapacity)
        const allHubs = await db
          .select({
            id: hubs.id,
            name: hubs.name,
            type: hubs.type,
            address: hubs.address,
            lat: hubs.lat,
            lng: hubs.lng,
            regionCode: hubs.regionCode,
            isEvHub: hubs.isEvHub,
            totalChargingPorts: hubs.totalChargingPorts,
            availablePorts: hubs.availablePorts,
          })
          .from(hubs)
          .limit(200);
        const withDist = allHubs
          .map((h) => ({ ...h, distKm: distKm(lat, lng, Number(h.lat || 0), Number(h.lng || 0)) }))
          .sort((a, b) => a.distKm - b.distKm)
          .slice(0, Math.min(Number(lim), 10));
        return { data: { hubs: withDist, count: withDist.length } };
      }

      // ── trending ─────────────────────────────────────────────────────────
      case "get_trending": {
        // trending_cache is row-based: one row per type+referenceId pair.
        // Query top routes and top search terms separately, ordered by score.
        const [routes, terms] = await Promise.all([
          db.select({
            label: trendingCache.label,
            score1h: trendingCache.score1h,
            score24h: trendingCache.score24h,
            trendVelocity: trendingCache.trendVelocity,
            city: trendingCache.city,
            regionCode: trendingCache.regionCode,
          })
          .from(trendingCache)
          .where(eq(trendingCache.type, "route"))
          .orderBy(
            desc(sql`CAST(${trendingCache.trendVelocity} AS numeric)`),
            desc(sql`CAST(${trendingCache.score1h} AS numeric)`),
          )
          .limit(5),
          db.select({ label: trendingCache.label, score1h: trendingCache.score1h })
          .from(trendingCache)
          .where(eq(trendingCache.type, "search_term"))
          .orderBy(desc(sql`CAST(${trendingCache.score1h} AS numeric)`))
          .limit(5),
        ]);
        if (!routes.length && !terms.length) {
          return { data: { routes: [], terms: [], message: "No trending data yet" } };
        }
        return {
          data: {
            routes: routes.map((r) => ({
              label: r.label,
              city: r.city,
              score1h: r.score1h,
              rising: Number(r.trendVelocity) > 0,
            })),
            terms: terms.map((t) => ({ label: t.label, score1h: t.score1h })),
          },
        };
      }

      // ── search users ─────────────────────────────────────────────────────
      case "search_users": {
        const { query } = input;
        if (!query?.trim()) return { error: "query required" };
        const results = await db
          .select({ id: users.id, name: users.name, role: users.role })
          .from(users)
          .where(and(ilike(users.name, `%${query}%`), eq(users.isGuest, false)))
          .limit(10);
        return { data: { users: results.filter((u) => u.id !== userId), count: results.length } };
      }

      // ── follow / unfollow ────────────────────────────────────────────────
      case "follow_user": {
        const { target_user_id } = input;
        if (!target_user_id) return { error: "target_user_id required" };
        if (target_user_id === userId) return { error: "Cannot follow yourself" };
        await db
          .insert(userFollows)
          .values({ followerId: userId, followingId: target_user_id })
          .onConflictDoNothing();
        return { data: { following: true } };
      }

      case "unfollow_user": {
        const { target_user_id } = input;
        if (!target_user_id) return { error: "target_user_id required" };
        await db
          .delete(userFollows)
          .where(and(eq(userFollows.followerId, userId), eq(userFollows.followingId, target_user_id)));
        return { data: { unfollowed: true } };
      }

      // ── publish memory ───────────────────────────────────────────────────
      case "publish_memory": {
        const { ride_id, caption } = input;
        if (!ride_id) return { error: "ride_id required" };
        const ride = await storage.getRide(ride_id);
        if (!ride) return { error: "Ride not found" };

        if (ride.status !== "completed") return { error: "Ride must be completed before publishing" };

        // ride.driverId is the drivers table PK (not the user's ID).
        // Resolve to userId before the participant check.
        const dist = ride.distance ? Number(ride.distance) : null;
        let isDriver = false;
        if ((ride as any).driverId) {
          const [drv] = await db
            .select({ userId: drivers.userId })
            .from(drivers)
            .where(eq(drivers.id, (ride as any).driverId));
          isDriver = drv?.userId === userId;
        }
        const isParticipant = ride.customerId === userId || isDriver;
        if (!isParticipant) return { error: "You are not a participant in this ride" };

        const [post] = await db
          .insert(ridePosts)
          .values({
            rideId: ride_id,
            userId,
            type: "memory",
            caption: caption ? String(caption).slice(0, 200) : null,
            distanceKm: dist ? dist.toFixed(2) : null,
            isLive: false,
          })
          .returning();
        return { data: { postId: post.id, published: true } };
      }

      // ── book prayer ride ─────────────────────────────────────────────────
      case "book_prayer_ride": {
        const {
          hub_id, pickup_address, pickup_lat, pickup_lng,
          prayers = [], buffer_minutes = 10,
        } = input;
        if (!hub_id) return { error: "hub_id (mosque hub) is required" };
        const [hub] = await db.select().from(hubs).where(eq(hubs.id, String(hub_id)));
        if (!hub || hub.type !== "mosque") return { error: "hub_id must be a mosque hub" };
        const pLat = parseFloat(String(pickup_lat));
        const pLng = parseFloat(String(pickup_lng));
        if (!pickup_address || isNaN(pLat) || isNaN(pLng)) {
          return { error: "pickup_address, pickup_lat, and pickup_lng are required" };
        }
        const validPrayers = ["fajr", "dhuhr", "asr", "maghrib", "isha", "jumuah"];
        const selected = (prayers as string[]).filter((p: string) => validPrayers.includes(p));
        if (!selected.length) return { error: "Provide at least one valid prayer name" };
        const buffer = Math.min(60, Math.max(0, Number(buffer_minutes) || 10));

        const values = {
          hubId: hub.id,
          mosqueName: hub.name,
          mosqueAddress: hub.address,
          mosqueLat: hub.lat,
          mosqueLng: hub.lng,
          pickupAddress: String(pickup_address).slice(0, 300),
          pickupLat: pLat.toString(),
          pickupLng: pLng.toString(),
          prayers: selected.join(","),
          bufferMinutes: buffer,
          status: "active" as const,
          updatedAt: new Date(),
        };

        const [existing] = await db
          .select()
          .from(prayerRideSubscriptions)
          .where(eq(prayerRideSubscriptions.userId, userId));

        let subId: string;
        if (existing) {
          const [updated] = await db
            .update(prayerRideSubscriptions)
            .set(values)
            .where(eq(prayerRideSubscriptions.id, existing.id))
            .returning();
          subId = updated.id;
        } else {
          const [created] = await db
            .insert(prayerRideSubscriptions)
            .values({ ...values, userId })
            .returning();
          subId = created.id;
        }

        return {
          data: {
            subscriptionId: subId,
            mosqueName: hub.name,
            prayers: selected,
            bufferMinutes: buffer,
            note: "Free prayer rides are dispatched automatically before each selected prayer.",
          },
        };
      }

      // ── schedule arrival ─────────────────────────────────────────────────
      case "schedule_arrival": {
        const {
          pickup_address, pickup_lat, pickup_lng,
          dropoff_address, dropoff_lat, dropoff_lng,
          arrive_by_iso, payment_method,
        } = input;
        const arrivalDeadline = new Date(arrive_by_iso);
        if (isNaN(arrivalDeadline.getTime())) return { error: "Invalid arrive_by_iso — use ISO datetime" };
        const nowMs = Date.now();
        if (arrivalDeadline.getTime() <= nowMs + 5 * 60 * 1000) {
          return { error: "Arrival deadline must be at least 5 minutes in the future" };
        }
        const dist = distKm(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng);
        const estDurationMin = Math.round(dist * 3);
        const BUFFER_MIN = 5;
        const departMs = arrivalDeadline.getTime() - (estDurationMin + BUFFER_MIN) * 60 * 1000;
        if (departMs <= nowMs) {
          return { error: "Not enough time to arrange the ride before the deadline" };
        }
        const departAt = new Date(departMs);
        const regionCode = detectRegionFromCoordinates(pickup_lat, pickup_lng);
        const region = await getRegionByCode(regionCode).catch(() => null);
        const vehicleType = region?.vehicleTypes?.[0]?.type || "economy";
        const pricing = await calculateOptimalPrice(
          pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, vehicleType, regionCode,
        );
        const multiplier = Math.min(
          pricing.demandMultiplier * pricing.timeOfDayMultiplier * pricing.trafficMultiplier,
          pricing.surgeCap,
        );
        const user = await storage.getUser(userId);
        const walletBalance = parseFloat(user?.walletBalance || "0") || 0;
        // Full BookingCardData contract — all required fields included
        return {
          cards: [{
            type: "booking",
            pickup: { address: pickup_address, lat: pickup_lat, lng: pickup_lng },
            dropoff: { address: dropoff_address, lat: dropoff_lat, lng: dropoff_lng },
            vehicleType,
            regionCode,
            currency: pricing.currency,
            fare: Math.round(pricing.total * 100) / 100,
            platformFee: Math.round(pricing.platformFee * 100) / 100,
            driverEarnings: Math.round(pricing.driverEarnings * 100) / 100,
            distanceKm: Math.round(dist * 10) / 10,
            durationMin: estDurationMin,
            surgeMultiplier: Math.round(multiplier * 100) / 100,
            priceExplanation: pricing.priceExplanation || [
              `Base: ${pricing.currency} ${pricing.baseFare?.toFixed(2) || "—"}`,
              `Distance: ${pricing.currency} ${pricing.distanceCharge?.toFixed(2) || "—"}`,
              `Surge: x${multiplier.toFixed(2)}`,
            ],
            walletBalance,
            scheduledDepartureAt: departAt.toISOString(),
            arrivalDeadline: arrivalDeadline.toISOString(),
            confirmPayload: {
              pickupAddress: pickup_address,
              pickupLat: pickup_lat.toString(),
              pickupLng: pickup_lng.toString(),
              dropoffAddress: dropoff_address,
              dropoffLat: dropoff_lat.toString(),
              dropoffLng: dropoff_lng.toString(),
              serviceTypeId: vehicleType,
              estimatedFare: pricing.total.toFixed(2),
              distance: Number(dist.toFixed(2)),
              duration: estDurationMin,
              paymentMethod: payment_method || "cash",
              surgeMultiplier: multiplier.toFixed(2),
              platformFee: pricing.platformFee.toFixed(2),
              driverEarnings: pricing.driverEarnings.toFixed(2),
              priceBreakdown: JSON.stringify({
                baseFare: pricing.baseFare,
                distanceCharge: pricing.distanceCharge,
                timeCharge: pricing.timeCharge,
                surgeMultiplier: multiplier,
                finalPrice: pricing.total,
                currency: pricing.currency,
              }),
              arrivalDeadline: arrivalDeadline.toISOString(),
              regionCode,
            },
          }],
          data: {
            scheduledDepartureAt: departAt.toISOString(),
            estDurationMin,
            arrivalDeadline: arrivalDeadline.toISOString(),
          },
        };
      }

      // ── car ladder ───────────────────────────────────────────────────────
      case "get_car_ladder": {
        if (userRole !== "driver") return { error: "Driver role required" };
        const [drv] = await db.select().from(drivers).where(eq(drivers.userId, userId));
        if (!drv) return { error: "No driver record" };
        const { getLadderStatus } = await import("./carLadder");
        const state = await getLadderStatus(drv.id, (drv as any).regionCode || null).catch(() => null);
        if (!state) {
          return {
            cards: [{
              type: "ladder",
              targetName: "No target yet",
              totalContributed: 0,
              currency: "AED",
              progressPercent: 0,
              qualified: false,
              agentMessage: "Complete more rides to unlock the Car Ladder.",
            }],
            data: { message: "Complete more rides to unlock the Car Ladder." },
          };
        }
        const ladderCard = {
          type: "ladder",
          targetName: state.goal?.target?.name || "Not set",
          totalContributed: Number(state.goal?.totalContributed || 0),
          currency: state.goal?.currency || "AED",
          progressPercent: Number(state.goal?.progressPercent || 0),
          qualified: Boolean(state.goal?.isQualified),
          agentMessage: state.agentMessage || "",
        };
        return {
          cards: [ladderCard],
          data: ladderCard,
        };
      }

      // ── driver online/offline ────────────────────────────────────────────
      case "go_driver_online": {
        if (userRole !== "driver") return { error: "Driver role required" };
        const drv = await storage.getOrCreateDriver(userId, { status: "pending", isOnline: false });
        if (drv.status !== "approved") return { error: `Account not yet approved (status: ${drv.status})` };
        const update: any = { isOnline: true };
        if (input.lat) update.currentLat = String(input.lat);
        if (input.lng) update.currentLng = String(input.lng);
        await storage.updateDriver(drv.id, update);
        return { data: { isOnline: true } };
      }

      case "go_driver_offline": {
        if (userRole !== "driver") return { error: "Driver role required" };
        const drv = await storage.getOrCreateDriver(userId, { status: "pending", isOnline: false });
        await storage.updateDriver(drv.id, { isOnline: false });
        return { data: { isOnline: false } };
      }

      // ── driver info ──────────────────────────────────────────────────────
      case "get_driver_info": {
        if (userRole !== "driver") return { error: "Driver role required" };
        const [drv] = await db.select().from(drivers).where(eq(drivers.userId, userId));
        if (!drv) return { error: "No driver record" };
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const [{ n }] = await db
          .select({ n: sql<number>`count(*)` })
          .from(rides)
          .where(and(eq(rides.driverId, drv.id), eq(rides.status, "completed"), gte(rides.completedAt, since)));
        return {
          data: {
            status: drv.status,
            isOnline: drv.isOnline,
            rating: drv.rating,
            totalTrips: drv.totalTrips,
            walletBalance: drv.walletBalance,
            ridesLast30Days: Number(n),
          },
        };
      }

      // ── driver earnings ──────────────────────────────────────────────────
      case "get_driver_earnings": {
        if (userRole !== "driver") return { error: "Driver role required" };
        const [drv] = await db.select().from(drivers).where(eq(drivers.userId, userId));
        if (!drv) return { error: "No driver record" };
        const days = Math.min(Number(input.days) || 7, 30);
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const completedRides = await db
          .select({
            id: rides.id,
            estimatedFare: rides.estimatedFare,
            driverEarnings: rides.driverEarnings,
            completedAt: rides.completedAt,
            dropoffAddress: rides.dropoffAddress,
          })
          .from(rides)
          .where(and(eq(rides.driverId, drv.id), eq(rides.status, "completed"), gte(rides.completedAt, since)))
          .orderBy(desc(rides.completedAt))
          .limit(20);
        const totalEarnings = completedRides.reduce(
          (sum, r) => sum + parseFloat(r.driverEarnings || r.estimatedFare || "0"),
          0,
        );
        const totalAed = (Math.round(totalEarnings * 100) / 100).toFixed(2);
        const rideList = completedRides.slice(0, 5).map((r) => ({
          to: r.dropoffAddress || "Trip",
          earnings: r.driverEarnings || r.estimatedFare || "0",
          date: r.completedAt?.toISOString() || "",
        }));
        return {
          cards: [{
            type: "earnings",
            days,
            totalAed,
            rideCount: completedRides.length,
            rides: rideList,
          }],
          data: {
            days,
            completedRides: completedRides.length,
            totalEarningsAed: totalAed,
            rides: rideList,
          },
        };
      }

      // ── pending rides (driver) ───────────────────────────────────────────
      case "get_pending_rides": {
        if (userRole !== "driver") return { error: "Driver role required" };
        const pending = await db
          .select({
            id: rides.id,
            pickupAddress: rides.pickupAddress,
            dropoffAddress: rides.dropoffAddress,
            estimatedFare: rides.estimatedFare,
            distance: rides.distance,
            createdAt: rides.createdAt,
          })
          .from(rides)
          .where(eq(rides.status, "pending"))
          .orderBy(desc(rides.createdAt))
          .limit(10);
        const rideRows = pending.map((r) => ({
          id: r.id,
          pickup: r.pickupAddress || "",
          dropoff: r.dropoffAddress || "",
          fare: r.estimatedFare || "0",
          distance: r.distance || null,
        }));
        return {
          cards: [{ type: "pending_rides", rides: rideRows }],
          data: { count: pending.length, rides: rideRows },
        };
      }

      // ── coffee orders (driver) ───────────────────────────────────────────
      case "get_coffee_orders": {
        if (userRole !== "driver") return { error: "Driver role required" };
        const orders = await db
          .select({
            id: coffeeOrders.id,
            coffeeName: coffeeOrders.coffeeName,
            coffeeSize: coffeeOrders.coffeeSize,
            orderType: coffeeOrders.orderType,
            status: coffeeOrders.status,
            totalAmount: coffeeOrders.totalAmount,
            deliveryAddress: coffeeOrders.deliveryAddress,
            createdAt: coffeeOrders.createdAt,
          })
          .from(coffeeOrders)
          .where(eq(coffeeOrders.status, "pending"))
          .orderBy(desc(coffeeOrders.createdAt))
          .limit(10);
        const orderRows = orders.map((o) => ({
          id: o.id,
          item: o.coffeeName || "",
          size: o.coffeeSize || null,
          type: o.orderType || null,
          totalAmount: o.totalAmount || null,
          deliveryAddress: o.deliveryAddress || null,
          status: o.status,
        }));
        return {
          cards: [{ type: "coffee_orders", orders: orderRows }],
          data: { count: orders.length, orders: orderRows },
        };
      }

      // ── social feed ──────────────────────────────────────────────────────
      case "get_social_feed": {
        const tab = input.tab || "foryou";
        const lim = Math.min(Number(input.limit) || 5, 10);
        let posts;
        if (tab === "following") {
          // Posts from users this person follows + own posts
          const followedIds = await db
            .select({ id: userFollows.followingId })
            .from(userFollows)
            .where(eq(userFollows.followerId, userId));
          const ids = [userId, ...followedIds.map((f) => f.id)];
          posts = await db
            .select({
              id: ridePosts.id,
              userId: ridePosts.userId,
              caption: ridePosts.caption,
              distanceKm: ridePosts.distanceKm,
              cityName: ridePosts.cityName,
              isLive: ridePosts.isLive,
              createdAt: ridePosts.createdAt,
            })
            .from(ridePosts)
            .where(inArray(ridePosts.userId, ids))
            .orderBy(desc(ridePosts.createdAt))
            .limit(lim);
        } else {
          // For You — network-wide recent posts
          posts = await db
            .select({
              id: ridePosts.id,
              userId: ridePosts.userId,
              caption: ridePosts.caption,
              distanceKm: ridePosts.distanceKm,
              cityName: ridePosts.cityName,
              isLive: ridePosts.isLive,
              createdAt: ridePosts.createdAt,
            })
            .from(ridePosts)
            .orderBy(desc(ridePosts.createdAt))
            .limit(lim);
        }
        return {
          data: {
            tab,
            posts: posts.map((p) => ({
              id: p.id,
              caption: p.caption,
              city: p.cityName,
              isLive: p.isLive,
              createdAt: p.createdAt?.toISOString(),
            })),
            count: posts.length,
          },
        };
      }

      // ── top-up wallet ────────────────────────────────────────────────────
      case "top_up_wallet": {
        const user = await storage.getUser(userId);
        const acct = await getOrCreateAccount(userId).catch(() => null);
        return {
          data: {
            currentAedBalance: user?.walletBalance || "0.00",
            currentCoins: acct?.coins || 0,
            coinPacks: COIN_PACKS.map((p) => ({
              id: p.id,
              coins: p.coins,
              priceHrs: p.priceHrs,
              label: p.label,
            })),
            note: "Coins are purchased with HRS tokens. Open the Rewards screen and tap 'Buy Coins' to start the payment flow.",
          },
        };
      }

      // ── remember preference ──────────────────────────────────────────────
      case "remember_preference": {
        const { key, value } = input;
        if (!key || !value) return { error: "key and value are required" };
        const profile = await getOrCreateAgentProfile(userId);
        const newPrefs = {
          ...(profile?.preferences as Record<string, any>),
          [String(key).slice(0, 60)]: String(value).slice(0, 200),
        };
        await db
          .update(agentUserProfile)
          .set({ preferences: newPrefs, lastInteractionAt: new Date(), updatedAt: new Date() })
          .where(eq(agentUserProfile.userId, userId));
        return { data: { saved: { key, value } } };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: any) {
    if (err instanceof CoffeeValidationError) return { error: err.message };
    console.error(`[AgentTool] ${name}:`, err?.message || err);
    return { error: err?.message || "Tool error" };
  }
}

// ---------------------------------------------------------------------------
// GET /api/agent/context — fresh snapshot for session bootstrap
// ---------------------------------------------------------------------------

agentRouter.get("/api/agent/context", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Unauthorized" });
    const userRole = (session as any).role || "customer";
    const snap = await buildContextSnapshot(session.userId, userRole);
    if (!snap) return res.status(404).json({ message: "Not found" });
    res.json(snap);
  } catch (err: any) {
    console.error("[Agent] context:", err);
    res.status(500).json({ message: "Could not load context" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/agent/message — Claude agentic loop
// ---------------------------------------------------------------------------

agentRouter.post("/api/agent/message", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Unauthorized" });

    const user = await storage.getUser(session.userId);
    if (!user || user.isGuest) {
      return res.status(401).json({ message: "Sign in to use Travony AI" });
    }

    const { messages: clientMessages = [], location } = req.body || {};
    const userRole = (session as any).role || user.role || "customer";
    const ctx: ToolCtx = { userId: session.userId, userRole, location };

    // Deterministic full context injected into system prompt on every message
    const snapshot = await buildContextSnapshot(session.userId, userRole);
    const snapshotJson = JSON.stringify(snapshot, null, 2);

    const now = new Date();
    const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
    const dateStr = now.toLocaleDateString("en-US", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });

    const systemPrompt = `You are Travony AI — an intelligent personal agent for the Travony mobility network. You have real tools and can take real, immediate actions for the user.

LIVE USER STATE (injected every message from the live database — always up to date):
${snapshotJson}

Time: ${timeStr}, ${dateStr}
${location ? `User location: lat ${location.lat?.toFixed(4)}, lng ${location.lng?.toFixed(4)}` : "Location: not shared"}

EXECUTION RULES:
1. The state above is always fresh. You do NOT need to call get_user_context to begin. Only call it mid-conversation if meaningful state may have changed (e.g. after booking).
2. For rides: call quote_ride FIRST (shows the user the price card). Only call book_ride after explicit user confirmation ("yes", "book it", "go ahead", "confirm").
3. For prayer rides: use book_prayer_ride with a mosque hub ID from get_nearby_hubs (type === "mosque"). Prayer rides are completely free.
4. For arrivals/deadlines: use schedule_arrival to compute departure time and show a quote card. Confirm before booking.
5. Your text replies MUST NOT contain any digits or numbers — all numeric values appear in the interactive cards rendered below your message.
6. NEVER mention blockchain, crypto, tokens, wallet addresses, or internal system identifiers.
7. Driver-only tools (only suggest when role === "driver"): go_driver_online, go_driver_offline, get_driver_info, get_driver_earnings, get_pending_rides, get_coffee_orders, get_car_ladder.
8. Use remember_preference proactively to learn: preferred payment, frequent destinations, usual coffee, peak hours.
9. Be concise, warm, and locally culturally aware. Gulf/UAE context applies.
10. You can return multiple cards in one response by calling multiple tools in one turn.`;

    const anthropic = getAnthropicClient();
    if (!anthropic) {
      return res.json({ reply: "Travony AI is unavailable right now.", cards: [], toolsUsed: [] });
    }

    const history = (clientMessages as { role: string; content: string }[])
      .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
      .slice(-20)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const lastUserMsg =
      (clientMessages as any[]).filter((m) => m.role === "user").slice(-1)?.[0]?.content || "";

    let currentMessages: Anthropic.MessageParam[] = [...history];
    let finalReply = "";
    const allCards: any[] = [];
    const toolCallLog: Array<{ tool: string; input: any; success: boolean }> = [];
    const toolsUsed: string[] = [];
    const MAX_ROUNDS = 10;

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const response = await anthropic.messages.create({
        model: "claude-opus-4-5",
        max_tokens: 1024,
        system: systemPrompt,
        tools: AGENT_TOOLS,
        messages: currentMessages,
      });

      if (response.stop_reason === "end_turn") {
        const tb = response.content.find((b) => b.type === "text");
        if (tb && tb.type === "text") {
          finalReply = replyIsHonest(tb.text) ? tb.text : "Here's what I found for you.";
        }
        break;
      }

      if (response.stop_reason === "tool_use") {
        const tuBlocks = response.content.filter((b) => b.type === "tool_use");
        const txtBlocks = response.content.filter((b) => b.type === "text");
        if (txtBlocks.length && txtBlocks[0].type === "text") {
          const t = txtBlocks[0].text;
          if (t && replyIsHonest(t)) finalReply = t;
        }

        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const block of tuBlocks) {
          if (block.type !== "tool_use") continue;
          if (!toolsUsed.includes(block.name)) toolsUsed.push(block.name);
          const result = await executeTool(block.name, block.input, ctx);
          const success = !result.error;
          toolCallLog.push({ tool: block.name, input: block.input, success });
          if (result.cards) allCards.push(...result.cards);
          results.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(
              result.error ? { error: result.error } : (result.data || { ok: true }),
            ),
          });
        }

        currentMessages = [
          ...currentMessages,
          { role: "assistant", content: response.content },
          { role: "user", content: results },
        ];
        continue;
      }

      break;
    }

    if (!finalReply) finalReply = "I've taken care of that for you.";

    // Persist session + learn (fire-and-forget, never blocks response)
    Promise.all([
      db
        .insert(agentSessions)
        .values({
          userId: session.userId,
          messageText: lastUserMsg.slice(0, 2000),
          replyText: finalReply.slice(0, 2000),
          toolCallLog,
        })
        .catch(() => {}),
      db
        .update(agentUserProfile)
        .set({
          sessionCount: sql`${agentUserProfile.sessionCount} + 1`,
          lastInteractionAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(agentUserProfile.userId, session.userId))
        .catch(() => {}),
      learnFromToolCalls(session.userId, toolCallLog),
    ]).catch(() => {});

    res.json({ reply: finalReply, cards: allCards, toolsUsed });
  } catch (err: any) {
    console.error("[Agent] message:", err);
    res.status(500).json({ message: err?.message || "Agent error" });
  }
});
