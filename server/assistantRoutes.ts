import { Router } from "express";
import OpenAI from "openai";
import { Router as RouterType } from "express";
import { storage } from "./storage";
import { db } from "./db";
import {
  assistantInteractions,
  prayerRideSubscriptions,
  scheduledArrivals,
} from "@shared/schema";
import { and, desc, eq, gte, sql } from "drizzle-orm";
import { calculateOptimalPrice } from "./aiEngine";
import { detectRegionFromCoordinates, getRegionByCode } from "./regionService";
import { getRiderDestinationSuggestions } from "./intentEngine";
import { COFFEE_MENU } from "./coffeeService";

const router: RouterType = Router();

// ============================================================================
// T Ride Assistant — the AI front door of the rider app.
//
// Hard rules (mirror the Car Agent honesty pattern):
//   - The LLM ONLY parses intent and phrases short replies. It NEVER authors
//     numbers: every fare, balance, ETA and price in a card comes from the
//     deterministic executor below, which calls the same services the classic
//     screens use.
//   - The assistant NEVER creates rides, orders or payments. Cards carry a
//     prepared payload; the client executes it only on an explicit tap against
//     the existing authenticated endpoints (POST /api/rides etc.), where the
//     server re-derives region/fees from pickup coords regardless of payload.
// ============================================================================

// ---------- session ----------
async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

// ---------- lazy OpenAI (same degrade-to-deterministic pattern as carAgent) ----------
let _openai: OpenAI | null = null;
let _openaiInitFailed = false;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  if (_openaiInitFailed) return null;
  try {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      _openaiInitFailed = true;
      return null;
    }
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    return _openai;
  } catch (err) {
    console.error("[assistant] OpenAI init failed, using keyword parser:", err);
    _openaiInitFailed = true;
    return null;
  }
}

// Shared system context for all LLM calls in this assistant.
const TRAVONY_SYSTEM_CONTEXT = `You are the Travony AI assistant, the friendly front door of the Travony ride-hailing app. Travony is an intelligent mobility network operating in the UAE, Saudi Arabia, Kuwait, and Bahrain.

What you can help riders with:
- Booking rides (economy, SUV, and local vehicle types depending on the city)
- Going to saved home or work addresses in one tap
- Ordering coffee and Gulf drinks (Karak Tea, Arabic Coffee, etc.) for delivery or pickup
- Prayer rides — completely free, volunteer drivers take riders to mosques
- Scheduled arrivals — book a ride that guarantees you arrive somewhere on time
- Viewing wallet balance and transaction history
- Checking current and past ride history

Pricing: transparent 10% platform commission, dynamic pricing based on demand and time of day. Fares shown in local currency (AED, SAR, KWD, BHD). Never promise a specific price — show a quote card instead.

Personality: warm, clear, and concise. One or two sentences max unless the user asks for detail. Never mention blockchain, crypto, tokens, or coins. Never invent numbers — when the user needs a fare or balance, say you'll pull it up and let the system card show the real figure.`;

// ---------- closed intent set ----------
const INTENTS = [
  "book_ride",
  "go_home",
  "go_work",
  "order_coffee",
  "prayer_ride",
  "schedule_arrival",
  "wallet",
  "ride_history",
  "active_ride",
  "open_map",
  "help",
] as const;
type AssistantIntent = (typeof INTENTS)[number];

interface ParsedMessage {
  intent: AssistantIntent;
  destination: string | null;
  reply: string | null; // LLM-phrased; must pass the honesty guard or is dropped
}

// Fast deterministic keyword parser. Chip taps send exact phrases, and common
// free text is caught here without an LLM round-trip.
function keywordParse(text: string): ParsedMessage | null {
  const t = text.trim().toLowerCase();
  if (!t) return { intent: "help", destination: null, reply: null };

  const hasAny = (...words: string[]) => words.some((w) => t.includes(w));

  if (hasAny("take me home", "go home", "going home", "home please")) {
    return { intent: "go_home", destination: null, reply: null };
  }
  if (hasAny("take me to work", "go to work", "to the office", "to office", "work please")) {
    return { intent: "go_work", destination: null, reply: null };
  }
  if (hasAny("coffee", "karak", "latte", "espresso", "cappuccino", "americano", "mocha", "matcha")) {
    return { intent: "order_coffee", destination: null, reply: null };
  }
  if (hasAny("prayer", "mosque", "salah", "fajr", "dhuhr", "asr", "maghrib", "isha", "jumuah")) {
    return { intent: "prayer_ride", destination: null, reply: null };
  }
  if (hasAny("schedule", "arrive by", "arrival", "on time", "on-time")) {
    return { intent: "schedule_arrival", destination: null, reply: null };
  }
  if (hasAny("wallet", "balance", "top up", "topup", "payment method")) {
    return { intent: "wallet", destination: null, reply: null };
  }
  if (hasAny("history", "my rides", "past rides", "recent rides", "trips", "receipt", "invoice")) {
    return { intent: "ride_history", destination: null, reply: null };
  }
  if (hasAny("where is my", "my ride", "current ride", "ride status", "driver eta", "track")) {
    return { intent: "active_ride", destination: null, reply: null };
  }
  if (hasAny("map", "pick on map", "choose on map")) {
    return { intent: "open_map", destination: null, reply: null };
  }
  if (hasAny("help", "what can you do")) {
    return { intent: "help", destination: null, reply: null };
  }

  // "take me to X" / "ride to X" / "go to X" — extract the destination phrase.
  const destMatch = t.match(
    /(?:take me to|ride to|go to|bring me to|drive me to|i want to go to|book (?:a )?ride to|to)\s+(.+)/
  );
  if (destMatch && destMatch[1] && destMatch[1].length >= 2) {
    return { intent: "book_ride", destination: destMatch[1].trim(), reply: null };
  }
  if (hasAny("book", "ride")) {
    return { intent: "book_ride", destination: null, reply: null };
  }
  return null;
}

// Honesty guard for LLM-phrased replies: the reply may not contain ANY digits
// (all numbers reach the user through deterministic cards), and no crypto
// vocabulary may leak into rider-facing words.
function replyIsHonest(reply: string): boolean {
  if (/\d/.test(reply)) return false;
  if (/\b(crypto|cryptocurrency|token|tokens|blockchain|erc[- ]?20|ethereum|on[- ]?chain|coin|coins|stablecoin|usdt|hrs)\b/i.test(reply)) {
    return false;
  }
  return true;
}

type HistoryEntry = { role: "user" | "assistant"; text: string };

async function llmParse(text: string, history: HistoryEntry[] = []): Promise<ParsedMessage | null> {
  const client = getOpenAI();
  if (!client) return null;
  try {
    // Build multi-turn context: last 6 history entries + current message.
    const historyMessages = history.slice(-6).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.text.slice(0, 300),
    }));

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${TRAVONY_SYSTEM_CONTEXT}

Your task here: map the user's LATEST message to EXACTLY ONE intent from this closed set:
${INTENTS.join(", ")}

Meanings: book_ride = wants a ride somewhere (put the destination phrase, if any, in "destination"); go_home = wants to go to their saved home; go_work = saved work; order_coffee = coffee/drinks; prayer_ride = mosque/prayer rides; schedule_arrival = arrive somewhere on time / scheduled rides; wallet = balance, payments, top-up; ride_history = past trips, receipts, invoices; active_ride = asking about their current ride/driver; open_map = wants to pick a place on the map; help = anything else including general questions about Travony.

Also write "reply": ONE short, warm sentence acknowledging the request. STRICT RULES for reply: no numbers or digits of any kind, no prices, no promises about timing, no emojis.

Respond ONLY as JSON: {"intent": string, "destination": string|null, "reply": string}`,
        },
        ...historyMessages,
        { role: "user", content: text.slice(0, 500) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 150,
      temperature: 0.3,
    });
    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const intent: AssistantIntent = INTENTS.includes(parsed.intent) ? parsed.intent : "help";
    const destination =
      typeof parsed.destination === "string" && parsed.destination.trim()
        ? parsed.destination.trim().slice(0, 200)
        : null;
    let reply: string | null =
      typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim().slice(0, 240) : null;
    if (reply && !replyIsHonest(reply)) reply = null;
    return { intent, destination, reply };
  } catch (err) {
    console.error("[assistant] LLM parse failed, using keyword parser:", err);
    return null;
  }
}

// For general/conversational messages (help intent) — the LLM writes a full
// reply using the conversation history. The honesty guard still applies.
async function conversationalReply(text: string, history: HistoryEntry[]): Promise<string | null> {
  const client = getOpenAI();
  if (!client) return null;
  try {
    const historyMessages = history.slice(-8).map((h) => ({
      role: h.role as "user" | "assistant",
      content: h.text.slice(0, 400),
    }));

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `${TRAVONY_SYSTEM_CONTEXT}

The user is having a general conversation with you — not booking a ride right now. Answer naturally and helpfully. Keep replies short (1-3 sentences). STRICT RULES: no numbers or digits, no specific prices, no emojis, no crypto vocabulary.`,
        },
        ...historyMessages,
        { role: "user", content: text.slice(0, 500) },
      ],
      max_tokens: 200,
      temperature: 0.6,
    });
    const reply = response.choices[0]?.message?.content?.trim() || null;
    if (reply && !replyIsHonest(reply)) return null;
    return reply;
  } catch (err) {
    console.error("[assistant] conversational reply failed:", err);
    return null;
  }
}

// ---------- deterministic quote builder ----------
interface Point {
  address: string;
  lat: number;
  lng: number;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.max(R * c, 1);
}

// Builds the booking card: a real, deterministic quote plus the exact payload
// the client will POST to /api/rides when (and only when) the rider taps
// Confirm. The rides endpoint re-derives region and fees from pickup coords
// server-side, so this payload is a convenience, not a trust surface.
async function buildBookingCard(userId: string, pickup: Point, dropoff: Point) {
  const regionCode = detectRegionFromCoordinates(pickup.lat, pickup.lng);
  const region = await getRegionByCode(regionCode).catch(() => null);
  const vehicleType = region?.vehicleTypes?.[0]?.type || "economy";

  const pricing = await calculateOptimalPrice(
    pickup.lat,
    pickup.lng,
    dropoff.lat,
    dropoff.lng,
    vehicleType,
    regionCode
  );

  const dist = distanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const duration = Math.round(dist * 3);

  const combinedMultiplier = Math.min(
    pricing.demandMultiplier * pricing.timeOfDayMultiplier * pricing.trafficMultiplier,
    pricing.surgeCap
  );

  const user = await storage.getUser(userId);
  const walletBalance = parseFloat(user?.walletBalance || "0") || 0;

  return {
    type: "booking" as const,
    pickup,
    dropoff,
    vehicleType,
    regionCode,
    currency: pricing.currency,
    fare: Math.round(pricing.total * 100) / 100,
    platformFee: pricing.platformFee,
    driverEarnings: pricing.driverEarnings,
    distanceKm: Math.round(dist * 10) / 10,
    durationMin: duration,
    surgeMultiplier: Math.round(combinedMultiplier * 100) / 100,
    priceExplanation: pricing.priceExplanation,
    walletBalance,
    confirmPayload: {
      pickupAddress: pickup.address,
      pickupLat: pickup.lat.toString(),
      pickupLng: pickup.lng.toString(),
      dropoffAddress: dropoff.address,
      dropoffLat: dropoff.lat.toString(),
      dropoffLng: dropoff.lng.toString(),
      serviceTypeId: vehicleType,
      estimatedFare: pricing.total.toFixed(2),
      distance: Number(dist.toFixed(2)),
      duration,
      paymentMethod: "cash",
      surgeMultiplier: combinedMultiplier.toFixed(2),
      platformFee: pricing.platformFee.toFixed(2),
      driverEarnings: pricing.driverEarnings.toFixed(2),
      priceBreakdown: JSON.stringify({
        baseFare: pricing.baseFare,
        distanceCharge: pricing.distanceCharge,
        timeCharge: pricing.timeCharge,
        surgeMultiplier: combinedMultiplier,
        finalPrice: pricing.total,
        currency: pricing.currency,
      }),
      regionCode,
      currency: pricing.currency,
    },
  };
}

// ---------- destination resolution (saved places → ride history) ----------
async function resolveDestination(
  userId: string,
  query: string,
  hour: number,
  dow: number,
  tzOffset: number
): Promise<{ resolved: Point | null; options: Array<Point & { label: string; icon: string; reason: string }> }> {
  const q = query.trim().toLowerCase();
  const saved = await storage.getSavedAddresses(userId);

  const savedMatches = saved.filter((s) => {
    const label = (s.label || "").toLowerCase();
    const addr = (s.address || "").toLowerCase();
    return label.includes(q) || q.includes(label) || addr.includes(q);
  });
  if (savedMatches.length === 1) {
    const m = savedMatches[0];
    return {
      resolved: { address: m.address, lat: parseFloat(m.lat), lng: parseFloat(m.lng) },
      options: [],
    };
  }

  const { suggestions } = await getRiderDestinationSuggestions(userId, hour, dow, tzOffset);
  const suggMatches = suggestions.filter((s) => {
    const label = (s.label || "").toLowerCase();
    const addr = (s.address || "").toLowerCase();
    return label.includes(q) || addr.includes(q);
  });
  if (savedMatches.length === 0 && suggMatches.length === 1) {
    const m = suggMatches[0];
    return { resolved: { address: m.address, lat: m.lat, lng: m.lng }, options: [] };
  }

  const options = [
    ...savedMatches.map((s) => ({
      address: s.address,
      lat: parseFloat(s.lat),
      lng: parseFloat(s.lng),
      label: s.label,
      icon: s.label?.toLowerCase() === "home" ? "home-outline" : "location-outline",
      reason: "Saved place",
    })),
    ...suggMatches.map((s) => ({
      address: s.address,
      lat: s.lat,
      lng: s.lng,
      label: s.label,
      icon: s.icon,
      reason: s.reason,
    })),
  ].slice(0, 5);

  return { resolved: null, options };
}

// ---------- card builders for lookups ----------
const ACTIVE_STATUSES = ["pending", "accepted", "arriving", "in_progress", "started"];

async function findActiveRide(userId: string) {
  const rides = await storage.getRidesByCustomer(userId);
  return rides.find((r) => ACTIVE_STATUSES.includes(r.status)) || null;
}

async function buildWalletCard(userId: string) {
  const user = await storage.getUser(userId);
  const transactions = await storage.getWalletTransactions(userId);
  const recent = transactions.slice(0, 5).map((t) => ({
    id: t.id,
    type: t.type,
    amount: t.amount,
    currency: t.currency || "AED",
    description: t.description || "",
    status: t.status,
    createdAt: t.createdAt,
  }));
  return {
    type: "wallet" as const,
    balance: user?.walletBalance || "0.00",
    currency: recent[0]?.currency || "AED",
    transactions: recent,
  };
}

async function buildRidesCard(userId: string) {
  const rides = await storage.getRidesByCustomer(userId);
  const completed = rides
    .filter((r) => r.status === "completed")
    .sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      pickupAddress: r.pickupAddress,
      dropoffAddress: r.dropoffAddress,
      fare: r.actualFare || r.estimatedFare || "0.00",
      currency: r.currency || "AED",
      status: r.status,
      createdAt: r.createdAt,
      hasBlockchainProof: !!(r.blockchainTxHash || r.blockchainHash),
    }));
  return { type: "rides" as const, rides: completed };
}

function buildCoffeeCard() {
  return {
    type: "coffee" as const,
    items: COFFEE_MENU.slice(0, 6).map((i) => ({
      id: i.id,
      name: i.name,
      basePrice: i.basePrice,
      currency: i.currency,
      description: i.description,
      category: i.category,
    })),
  };
}

async function buildPrayerCard(userId: string) {
  const subs = await db
    .select()
    .from(prayerRideSubscriptions)
    .where(eq(prayerRideSubscriptions.userId, userId))
    .orderBy(desc(prayerRideSubscriptions.createdAt))
    .limit(3);
  return {
    type: "prayer" as const,
    subscriptions: subs.map((s) => ({
      id: s.id,
      mosqueName: s.mosqueName,
      prayers: s.prayers,
      status: s.status,
    })),
  };
}

async function buildArrivalCard(userId: string) {
  const rows = await db
    .select()
    .from(scheduledArrivals)
    .where(and(eq(scheduledArrivals.userId, userId), eq(scheduledArrivals.status, "active")))
    .orderBy(desc(scheduledArrivals.createdAt))
    .limit(3);
  return {
    type: "arrival" as const,
    arrivals: rows.map((a) => ({
      id: a.id,
      label: a.label,
      destAddress: a.destAddress,
      mode: a.mode,
      arriveTimeLocal: a.arriveTimeLocal,
      arriveAtUtc: a.arriveAtUtc,
      status: a.status,
    })),
  };
}

// ---------- interaction logging ----------
async function logInteraction(
  userId: string,
  intent: string,
  opts: {
    queryText?: string | null;
    destination?: Point | null;
    accepted?: boolean | null;
    hour?: number;
    dow?: number;
  } = {}
) {
  try {
    const now = new Date();
    await db.insert(assistantInteractions).values({
      userId,
      intent,
      queryText: opts.queryText ? opts.queryText.slice(0, 500) : null,
      destinationAddress: opts.destination?.address?.slice(0, 500) || null,
      destinationLat: opts.destination ? opts.destination.lat.toString() : null,
      destinationLng: opts.destination ? opts.destination.lng.toString() : null,
      hourOfDay: Number.isFinite(opts.hour) ? (opts.hour as number) : now.getHours(),
      dayOfWeek: Number.isFinite(opts.dow) ? (opts.dow as number) : now.getDay(),
      accepted: opts.accepted ?? null,
    });
  } catch (err) {
    console.error("[assistant] interaction log failed:", err);
  }
}

// ============================================================================
// GET /api/assistant/home — greeting + adaptive chips + current live context.
// ============================================================================
router.get("/api/assistant/home", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });
    const userId = session.userId;

    const parseIntParam = (v: any, fallback: number) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const now = new Date();
    const hour = Math.max(0, Math.min(23, parseIntParam(req.query.hour, now.getHours())));
    const dow = Math.max(0, Math.min(6, parseIntParam(req.query.dow, now.getDay())));
    const tzOffset = parseIntParam(req.query.tzOffset, -now.getTimezoneOffset());

    const [user, saved, activeRide] = await Promise.all([
      storage.getUser(userId),
      storage.getSavedAddresses(userId),
      findActiveRide(userId),
    ]);

    const firstName = (user?.name || "").split(" ")[0] || "there";
    let timeGreeting: string;
    if (hour < 5) timeGreeting = "Late night";
    else if (hour < 12) timeGreeting = "Good morning";
    else if (hour < 18) timeGreeting = "Good afternoon";
    else timeGreeting = "Good evening";
    const greeting = `${timeGreeting}, ${firstName}`;

    // ---- adaptive chips from the user's own interaction history ----
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentInteractions = await db
      .select({
        intent: assistantInteractions.intent,
        hourOfDay: assistantInteractions.hourOfDay,
        count: sql<number>`count(*)::int`,
      })
      .from(assistantInteractions)
      .where(and(eq(assistantInteractions.userId, userId), gte(assistantInteractions.createdAt, thirtyDaysAgo)))
      .groupBy(assistantInteractions.intent, assistantInteractions.hourOfDay);

    // Weight usage of each intent by proximity to the current hour so evening
    // habits float up in the evening.
    const intentScore = new Map<string, number>();
    for (const row of recentInteractions) {
      const hd = Math.min(
        Math.abs(row.hourOfDay - hour),
        24 - Math.abs(row.hourOfDay - hour)
      );
      const proximity = Math.max(0.25, 1 - hd / 6); // same hour = 1, 6h+ away = 0.25
      intentScore.set(row.intent, (intentScore.get(row.intent) || 0) + row.count * proximity);
    }

    const hasHome = saved.some((s) => s.label?.toLowerCase() === "home");
    const hasWork = saved.some((s) => s.label?.toLowerCase() === "work");

    interface Chip {
      id: string;
      label: string;
      icon: string;
      message: string;
      baseScore: number;
    }
    const chips: Chip[] = [];
    if (hasHome) {
      // Evening/weekday bias: the "Home?" chip leads after 4pm.
      const eveningBoost = hour >= 16 && hour <= 23 ? 3 : 0;
      chips.push({ id: "go_home", label: "Take me home", icon: "home-outline", message: "Take me home", baseScore: 2 + eveningBoost });
    }
    if (hasWork) {
      const morningBoost = hour >= 5 && hour <= 11 && dow >= 1 && dow <= 5 ? 3 : 0;
      chips.push({ id: "go_work", label: "To work", icon: "briefcase-outline", message: "Take me to work", baseScore: 1.5 + morningBoost });
    }
    chips.push({ id: "book_ride", label: "Book a ride", icon: "car-outline", message: "Book a ride", baseScore: 2 });
    chips.push({ id: "order_coffee", label: "Coffee", icon: "cafe-outline", message: "Order coffee", baseScore: 1 });
    chips.push({ id: "prayer_ride", label: "Prayer ride", icon: "moon-outline", message: "Prayer rides", baseScore: 0.8 });
    chips.push({ id: "schedule_arrival", label: "Arrive on time", icon: "alarm-outline", message: "Schedule an arrival", baseScore: 0.7 });
    chips.push({ id: "wallet", label: "Wallet", icon: "wallet-outline", message: "Show my wallet", baseScore: 0.6 });
    chips.push({ id: "ride_history", label: "My trips", icon: "time-outline", message: "Show my recent trips", baseScore: 0.5 });

    const chipIntentMap: Record<string, string> = {
      go_home: "go_home",
      go_work: "go_work",
      book_ride: "book_ride",
      order_coffee: "order_coffee",
      prayer_ride: "prayer_ride",
      schedule_arrival: "schedule_arrival",
      wallet: "wallet",
      ride_history: "ride_history",
    };
    const ranked = chips
      .map((c) => ({
        ...c,
        score: c.baseScore + (intentScore.get(chipIntentMap[c.id]) || 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ id, label, icon, message }) => ({ id, label, icon, message }));

    // Personal subline from the top time-slot destination (deterministic).
    let subline = "Where to? Ask me anything.";
    try {
      const { suggestions, source } = await getRiderDestinationSuggestions(userId, hour, dow, tzOffset, 1);
      if (source === "history" && suggestions[0]) {
        subline = `Heading to ${suggestions[0].label}?`;
      }
    } catch {
      // best-effort personalization
    }

    res.json({
      greeting,
      subline,
      chips: ranked,
      activeRideId: activeRide?.id || null,
      hasHome,
      hasWork,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to load assistant home" });
  }
});

// ============================================================================
// POST /api/assistant/message — parse intent, run the deterministic executor,
// reply with text + a structured card. Never creates rides or moves money.
// ============================================================================
router.post("/api/assistant/message", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });
    const userId = session.userId;

    const text = typeof req.body.text === "string" ? req.body.text.trim().slice(0, 500) : "";
    if (!text) return res.status(400).json({ message: "Message text is required" });

    // Conversation history (last N messages from the client).
    const rawHistory: any[] = Array.isArray(req.body.history) ? req.body.history : [];
    const history: HistoryEntry[] = rawHistory
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.text === "string" && h.text.trim())
      .slice(-10)
      .map((h) => ({ role: h.role as "user" | "assistant", text: h.text.trim().slice(0, 400) }));

    const pickup: Point | null =
      req.body.pickup &&
      Number.isFinite(parseFloat(req.body.pickup.lat)) &&
      Number.isFinite(parseFloat(req.body.pickup.lng))
        ? {
            address: String(req.body.pickup.address || "Current Location").slice(0, 300),
            lat: parseFloat(req.body.pickup.lat),
            lng: parseFloat(req.body.pickup.lng),
          }
        : null;

    // Optional explicit destination (rider tapped a place option in a card) —
    // skips text resolution and goes straight to a deterministic quote.
    const explicitDest: Point | null =
      req.body.destination &&
      Number.isFinite(parseFloat(req.body.destination.lat)) &&
      Number.isFinite(parseFloat(req.body.destination.lng))
        ? {
            address: String(req.body.destination.address || "Destination").slice(0, 300),
            lat: parseFloat(req.body.destination.lat),
            lng: parseFloat(req.body.destination.lng),
          }
        : null;

    const now = new Date();
    const parseIntParam = (v: any, fallback: number) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const hour = Math.max(0, Math.min(23, parseIntParam(req.body.hour, now.getHours())));
    const dow = Math.max(0, Math.min(6, parseIntParam(req.body.dow, now.getDay())));
    const tzOffset = parseIntParam(req.body.tzOffset, -now.getTimezoneOffset());

    // 1) Parse: explicit destination beats everything, then keyword fast-path,
    // then LLM for free text.
    let parsed: ParsedMessage | null = explicitDest
      ? { intent: "book_ride", destination: null, reply: null }
      : keywordParse(text);
    if (!parsed) parsed = await llmParse(text, history);
    if (!parsed) parsed = { intent: "help", destination: null, reply: null };

    // 2) Deterministic executor.
    let reply = parsed.reply || "";
    let card: any = null;
    let loggedDestination: Point | null = null;

    const needPickupReply =
      "I need your pickup location for a quote. Enable location access, or pick your pickup on the map.";

    switch (parsed.intent) {
      case "go_home":
      case "go_work": {
        const wanted = parsed.intent === "go_home" ? "home" : "work";
        const saved = await storage.getSavedAddresses(userId);
        const place = saved.find((s) => s.label?.toLowerCase() === wanted);
        if (!place) {
          reply = `You haven't saved a ${wanted} address yet. Add it in Saved Places and I'll take you there with one tap.`;
          card = { type: "action", action: "open_saved_addresses", label: "Open Saved Places" };
          break;
        }
        if (!pickup) {
          reply = needPickupReply;
          card = { type: "action", action: "open_map", label: "Pick on map" };
          break;
        }
        const dropoff: Point = {
          address: place.address,
          lat: parseFloat(place.lat),
          lng: parseFloat(place.lng),
        };
        card = await buildBookingCard(userId, pickup, dropoff);
        loggedDestination = dropoff;
        if (!reply) reply = wanted === "home" ? "Let's get you home. Here's your ride:" : "Off to work. Here's your ride:";
        break;
      }

      case "book_ride": {
        if (explicitDest) {
          if (!pickup) {
            reply = needPickupReply;
            card = { type: "action", action: "open_map", label: "Pick on map" };
            break;
          }
          card = await buildBookingCard(userId, pickup, explicitDest);
          loggedDestination = explicitDest;
          if (!reply) reply = "Here's your ride:";
          break;
        }
        if (!parsed.destination) {
          const { suggestions } = await getRiderDestinationSuggestions(userId, hour, dow, tzOffset);
          if (suggestions.length > 0) {
            card = {
              type: "places",
              places: suggestions.slice(0, 4).map((s) => ({
                address: s.address,
                lat: s.lat,
                lng: s.lng,
                label: s.label,
                icon: s.icon,
                reason: s.reason,
              })),
              mapOption: true,
            };
            if (!reply) reply = "Where would you like to go? Here are your usual spots, or pick on the map:";
          } else {
            card = { type: "action", action: "open_map", label: "Pick on map" };
            if (!reply) reply = "Where to? Pick your destination on the map and I'll get you a quote.";
          }
          break;
        }
        const { resolved, options } = await resolveDestination(userId, parsed.destination, hour, dow, tzOffset);
        if (resolved) {
          if (!pickup) {
            reply = needPickupReply;
            card = { type: "action", action: "open_map", label: "Pick on map" };
            break;
          }
          card = await buildBookingCard(userId, pickup, resolved);
          loggedDestination = resolved;
          if (!reply) reply = "Here's your ride:";
        } else if (options.length > 0) {
          card = { type: "places", places: options, mapOption: true };
          if (!reply) reply = "I found a few matching places — which one?";
        } else {
          card = { type: "action", action: "open_map", label: "Pick on map" };
          if (!reply)
            reply = `I couldn't find "${parsed.destination}" in your saved places or trip history. Pick it on the map and I'll quote it.`;
        }
        break;
      }

      case "active_ride": {
        const active = await findActiveRide(userId);
        if (active) {
          card = { type: "live_ride", rideId: active.id, status: active.status };
          if (!reply) reply = "Here's your ride right now:";
        } else {
          if (!reply) reply = "You don't have a ride in progress. Want to book one?";
          card = null;
        }
        break;
      }

      case "wallet": {
        card = await buildWalletCard(userId);
        if (!reply) reply = "Here's your wallet:";
        break;
      }

      case "ride_history": {
        card = await buildRidesCard(userId);
        if (!reply) reply = "Here are your recent trips:";
        break;
      }

      case "order_coffee": {
        card = buildCoffeeCard();
        if (!reply) reply = "Here's the menu — tap anything to order, or open the full coffee screen:";
        break;
      }

      case "prayer_ride": {
        card = await buildPrayerCard(userId);
        if (!reply)
          reply =
            (card.subscriptions.length > 0
              ? "Your prayer rides:"
              : "Prayer rides are completely free — drivers volunteer. Set up your mosque and prayers:");
        break;
      }

      case "schedule_arrival": {
        card = await buildArrivalCard(userId);
        if (!reply)
          reply =
            (card.arrivals.length > 0
              ? "Your scheduled arrivals:"
              : "Tell me where you need to be and when — I'll dispatch the ride so you arrive on time. Set one up:");
        break;
      }

      case "open_map": {
        card = { type: "action", action: "open_map", label: "Open map" };
        if (!reply) reply = "Opening the map view:";
        break;
      }

      case "help":
      default: {
        if (!reply) {
          // Try a full conversational reply using history context.
          const aiReply = await conversationalReply(text, history);
          reply = aiReply ||
            "I can book rides, take you home, order coffee, set up prayer rides and on-time arrivals, and show your wallet or trips. Just tell me what you need.";
        }
        card = null;
        break;
      }
    }

    // 3) Log for the user-understanding layer (best-effort).
    logInteraction(userId, parsed.intent, {
      queryText: text,
      destination: loggedDestination,
      hour,
      dow,
    });

    res.json({ reply, card, intent: parsed.intent });
  } catch (error: any) {
    console.error("[assistant] message failed:", error);
    res.status(500).json({ message: error.message || "Assistant failed" });
  }
});

// ============================================================================
// POST /api/assistant/event — record card outcomes (confirmed / declined /
// drilled), so chips and defaults adapt to what the user actually does.
// ============================================================================
router.post("/api/assistant/event", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });

    const intent = typeof req.body.intent === "string" ? req.body.intent.slice(0, 50) : "";
    if (!intent) return res.status(400).json({ message: "intent is required" });
    if (!INTENTS.includes(intent as AssistantIntent)) {
      return res.status(400).json({ message: "Unknown intent" });
    }
    const accepted = typeof req.body.accepted === "boolean" ? req.body.accepted : null;

    let destination: Point | null = null;
    if (
      req.body.destination &&
      Number.isFinite(parseFloat(req.body.destination.lat)) &&
      Number.isFinite(parseFloat(req.body.destination.lng))
    ) {
      destination = {
        address: String(req.body.destination.address || "").slice(0, 500),
        lat: parseFloat(req.body.destination.lat),
        lng: parseFloat(req.body.destination.lng),
      };
    }

    const now = new Date();
    const parseIntParam = (v: any, fallback: number) => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : fallback;
    };
    await logInteraction(session.userId, intent, {
      queryText: typeof req.body.queryText === "string" ? req.body.queryText : null,
      destination,
      accepted,
      hour: Math.max(0, Math.min(23, parseIntParam(req.body.hour, now.getHours()))),
      dow: Math.max(0, Math.min(6, parseIntParam(req.body.dow, now.getDay()))),
    });
    res.json({ ok: true });
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to log event" });
  }
});

export { router as assistantRouter };
