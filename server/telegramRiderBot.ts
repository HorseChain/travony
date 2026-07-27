import { db } from "./db";
import {
  users, drivers, vehicles, rides, telegramBookingSessions,
  hubs, coffeeOrders, hubCheckIns,
} from "@shared/schema";
import { eq, and, desc, inArray, gte, isNull } from "drizzle-orm";
import { storage } from "./storage";
import { calculateOptimalPrice } from "./aiEngine";
import * as intentEngine from "./intentEngine";
import { generateRideHash, calculateFeeBreakdown } from "./blockchain";
import { sendRideMessage } from "./translationService";
import { sendTelegramMessage } from "./telegramBot";
import { buildAndSendRiderReceipt, notifyOnlineDriversOfNewRide } from "./rideNotifications";
import { nowPaymentsService } from "./nowpayments";
import {
  COFFEE_MENU,
  SIZE_MULTIPLIERS,
  getMenuItem,
  priceCoffee,
  createCoffeeOrder,
  type CoffeeMenuItem,
} from "./coffeeService";
import { randomUUID } from "crypto";
import { getRegionByCode, detectRegionFromCoordinates } from "./regionService";
import { getLiveTelegramStreams, getTravonyBaseUrl } from "./telegramStreaming";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

// Car types offered to riders (mapped to seeded service_types)
const CAR_TYPES: { id: string; type: string; label: string }[] = [
  { id: "st-economy", type: "economy", label: "Economy" },
  { id: "st-comfort", type: "comfort", label: "Comfort" },
  { id: "st-xl", type: "xl", label: "XL (larger group)" },
  { id: "st-premium", type: "premium", label: "Premium" },
];

const ACTIVE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"];
// Every status a rider can clear from Telegram. This intentionally includes
// started/in_progress: a stuck live trip (e.g. a driver who never taps
// "complete") would otherwise lock the rider out of booking until the 12h
// stale-ride cutoff. Cancelling moves no money in this cash flow — payouts,
// blockchain records and receipts are gated on the *completed* transition, not
// on cancellation — so ending an abandoned live trip is safe and recoverable.
const CANCELLABLE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"];
// A ride only blocks a new booking once a driver is actually engaged. A
// "pending" ride (still searching / not yet accepted) must never permanently
// block re-booking, so it's intentionally excluded here.
const ENGAGED_RIDE_STATUSES = ["accepted", "arriving", "started", "in_progress"];

type BookingStep =
  | "awaiting_contact"
  | "awaiting_pickup"
  | "awaiting_destination"
  | "awaiting_cartype"
  | "awaiting_payment"
  | "awaiting_confirm"
  // Coffee flow text/location inputs (button-driven steps don't need a step marker)
  | "awaiting_coffee_delivery"
  | "awaiting_coffee_hub_loc"
  | "awaiting_gift_name"
  | "awaiting_gift_phone"
  | "awaiting_gift_message"
  // Hub browsing
  | "awaiting_hub_loc"
  // Emailed ride receipt
  | "awaiting_receipt_email";

type PendingAction = "book" | "coffee" | "hubs" | "hub_pickup" | "hub_coffee";

interface CoffeeDraft {
  drinkId?: string;
  drinkName?: string;
  basePrice?: number;
  size?: "small" | "medium" | "large";
  qty?: number;
  mode?: "order" | "buy" | "gift";
  delivery?: { lat: number; lng: number; address: string };
  hubId?: string;
  hubName?: string;
  recipientName?: string;
  recipientPhone?: string;
  giftMessage?: string;
}

interface RiderSession {
  step?: BookingStep;
  userId?: string;
  pendingBook?: boolean;
  pendingAction?: PendingAction;
  pickup?: { lat: number; lng: number; address: string };
  destination?: { lat: number; lng: number; address: string };
  // Candidate destinations shown for the rider to pick from after a typed search.
  destCandidates?: { lat: number; lng: number; address: string }[];
  distanceKm?: number;
  estimates?: { id: string; type: string; label: string; fare: number }[];
  chosen?: { id: string; type: string; label: string; fare: number };
  // How the rider chose to pay for the ride being booked.
  paymentMethod?: "cash" | "usdt";
  activeRideId?: string;
  confirming?: boolean;
  // Coffee ordering draft (present only while ordering)
  coffee?: CoffeeDraft;
  coffeeSubmitting?: boolean;
  // Hub a cross-link should resume on after account linking
  pendingHubId?: string;
  // Ride the rider asked to have emailed (awaiting an email address)
  receiptRideId?: string;
  // Region detected from the pickup coordinates — drives currency labels, the
  // vehicle line-up shown, and the platform fee %, so budget markets (e.g. BD)
  // get their cheap fares in local currency rather than the AE/AED default.
  regionCode?: string;
  currency?: string;
  feePercent?: number;
}

// In-memory per-chat state, backed by the telegram_booking_sessions table so
// that in-progress bookings survive a backend restart.
const sessions = new Map<number, RiderSession>();
// Chats that currently have a persisted row, so we only issue DB deletes when needed.
const persistedChats = new Set<number>();

function getSession(chatId: number): RiderSession {
  let s = sessions.get(chatId);
  if (!s) {
    s = {};
    sessions.set(chatId, s);
  }
  return s;
}

// A session is worth persisting only while the rider is mid-booking. The
// transient `confirming` flag is excluded so a restart can't permanently block
// re-confirmation.
function isInProgress(s: RiderSession): boolean {
  return Boolean(s.step || s.pendingBook || s.pendingAction || s.coffee);
}

// Hydrate the in-memory map from the DB once per process (lazily, on the first
// rider update after a restart).
let hydrated = false;
async function ensureHydrated(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const rows = await db.select().from(telegramBookingSessions);
    for (const row of rows) {
      const chatId = Number(row.chatId);
      if (Number.isNaN(chatId)) continue;
      try {
        sessions.set(chatId, JSON.parse(row.data) as RiderSession);
        persistedChats.add(chatId);
      } catch (error) {
        console.error("[TelegramRider] Failed to parse persisted session:", error);
      }
    }
    if (rows.length) {
      console.log(`[TelegramRider] Restored ${persistedChats.size} in-progress booking session(s)`);
    }
  } catch (error) {
    hydrated = false; // allow a retry on the next update
    console.error("[TelegramRider] hydrate error:", error);
  }
}

// Persist the current session for a chat, or remove it once the booking is no
// longer in progress (completed/cancelled). Best-effort: persistence failures
// must never break the live chat flow.
async function persistSession(chatId: number): Promise<void> {
  const s = sessions.get(chatId);
  const key = chatId.toString();
  try {
    if (s && isInProgress(s)) {
      const data = JSON.stringify(s);
      await db
        .insert(telegramBookingSessions)
        .values({ chatId: key, data, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: telegramBookingSessions.chatId,
          set: { data, updatedAt: new Date() },
        });
      persistedChats.add(chatId);
    } else if (persistedChats.has(chatId)) {
      await db.delete(telegramBookingSessions).where(eq(telegramBookingSessions.chatId, key));
      persistedChats.delete(chatId);
    }
  } catch (error) {
    console.error("[TelegramRider] persistSession error:", error);
  }
}

function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function etaFromDistanceKm(distanceKm: number): number {
  // City-speed estimate (~25 km/h), floored at 2 minutes.
  return Math.max(2, Math.round((distanceKm / 25) * 60));
}

function formatDateTime(d: Date | string): string {
  try {
    return new Date(d).toLocaleString("en-GB", {
      timeZone: "Asia/Dubai",
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(d).toISOString();
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Telegram riders are auto-provisioned with a synthetic address, so a receipt
// can only be emailed once the rider supplies a real one.
function isPlaceholderEmail(email?: string | null): boolean {
  return !email || email.endsWith("@telegram.travony") || !isValidEmail(email);
}

// Thin wrapper kept for the bot's call sites; the canonical receipt builder lives
// in rideNotifications.ts and is shared with the automatic completion email.
async function emailRideReceipt(rideId: string, toEmail: string, fallbackName: string): Promise<boolean> {
  return buildAndSendRiderReceipt(rideId, toEmail, fallbackName);
}

interface DriverMatch {
  driverId: string;
  matchType: string;
  aiMatchScore: string;
  intentAlignmentScore?: string;
  distanceKm: number;
}

// Match a driver exactly the way the main app's POST /api/rides does, so a
// Telegram booking is assigned identically to an in-app booking — and only to
// an online, approved driver whose T Driver app is actively polling the
// database for assigned ride requests.
async function matchDriverLikeApp(
  userId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  priority: "fastest" | "cheapest" | "reliable" = "reliable",
): Promise<DriverMatch | null> {
  // 1) Intent-based matching (same engine the app uses). The intent engine
  // filters on isOnline but not approval status, so we re-check approval here:
  // an unapproved driver would be rejected by GET /api/drivers/pending-rides
  // and the request would strand. If it isn't approved, fall through to the
  // approved-only proximity fallback below.
  try {
    const best = await intentEngine.getBestAlignedDriver(
      userId, pickupLat, pickupLng, dropoffLat, dropoffLng, priority,
    );
    if (best) {
      const matchedDriver = await storage.getDriver(best.driverId);
      if (matchedDriver?.status === "approved") {
        return {
          driverId: best.driverId,
          matchType: best.alignment.matchType,
          aiMatchScore: (best.alignment.confidence * 100).toFixed(2),
          intentAlignmentScore: best.alignment.score.toFixed(2),
          distanceKm: best.distance,
        };
      }
      console.log(`[TelegramRider] intent match ${best.driverId} not approved — using proximity fallback`);
    }
  } catch (error) {
    console.error("[TelegramRider] intent match error:", error);
  }

  // 2) Proximity fallback: nearest online + approved driver within 50km.
  try {
    const onlineDrivers = await db
      .select()
      .from(drivers)
      .where(and(eq(drivers.isOnline, true), eq(drivers.status, "approved")));
    let nearest: { id: string } | null = null;
    let nearestDistance = 50;
    for (const driver of onlineDrivers) {
      const dLat = parseFloat(driver.currentLat || "0");
      const dLng = parseFloat(driver.currentLng || "0");
      if (dLat === 0 && dLng === 0) continue;
      const distance = calculateDistanceKm(pickupLat, pickupLng, dLat, dLng);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = driver;
      }
    }
    if (nearest) {
      return {
        driverId: nearest.id,
        matchType: "proximity_fallback",
        aiMatchScore: "0",
        distanceKm: nearestDistance,
      };
    }
  } catch (error) {
    console.error("[TelegramRider] proximity match error:", error);
  }

  return null;
}

async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`${TELEGRAM_API_URL}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId, text }),
    });
  } catch (error) {
    console.error("[TelegramRider] Error answering callback:", error);
  }
}

async function getUserByChatId(chatId: number) {
  const [user] = await db.select().from(users).where(eq(users.telegramChatId, chatId.toString())).limit(1);
  return user || undefined;
}

async function findUserByPhone(rawPhone: string) {
  const digits = rawPhone.replace(/[^0-9]/g, "");
  const candidates = Array.from(new Set([rawPhone, `+${digits}`, digits]));
  for (const candidate of candidates) {
    const user = await storage.getUserByPhone(candidate);
    if (user) return user;
  }
  return undefined;
}

async function getActiveRideForUser(userId: string) {
  const [ride] = await db
    .select()
    .from(rides)
    .where(and(eq(rides.customerId, userId), inArray(rides.status, ACTIVE_RIDE_STATUSES as any)))
    .orderBy(desc(rides.createdAt))
    .limit(1);
  return ride || undefined;
}

// A ride that genuinely blocks a new booking: a driver has accepted and is
// engaged. Unmatched "pending" rides are deliberately not blocking.
async function getEngagedRideForUser(userId: string) {
  const [ride] = await db
    .select()
    .from(rides)
    .where(and(eq(rides.customerId, userId), inArray(rides.status, ENGAGED_RIDE_STATUSES as any)))
    .orderBy(desc(rides.createdAt))
    .limit(1);
  return ride || undefined;
}

// Cancel the user's leftover unmatched "pending" rides so an abandoned search
// can never permanently block re-booking.
async function cancelPendingRidesForUser(userId: string): Promise<void> {
  const pendings = await db
    .select()
    .from(rides)
    .where(and(eq(rides.customerId, userId), eq(rides.status, "pending")));
  for (const r of pendings) {
    try {
      await storage.updateRide(r.id, { status: "cancelled", cancelledAt: new Date() });
    } catch (error) {
      console.error("[TelegramRider] cancel stale pending ride error:", error);
    }
  }
}

const shareContactKeyboard = {
  keyboard: [[{ text: "Share my phone number", request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

const sharePickupKeyboard = {
  keyboard: [[{ text: "Share my pickup location", request_location: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

const shareDeliveryKeyboard = {
  keyboard: [[{ text: "Share delivery location", request_location: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

const shareHubLocationKeyboard = {
  keyboard: [[{ text: "Share my location", request_location: true }]],
  resize_keyboard: true,
  one_time_keyboard: true,
};

const removeKeyboard = { remove_keyboard: true };

const mainMenuKeyboard = {
  inline_keyboard: [
    [{ text: "Book a ride", callback_data: "r:book" }],
    [
      { text: "Order coffee", callback_data: "r:coffee" },
      { text: "Explore hubs", callback_data: "r:hubs" },
    ],
    [
      { text: "Drive & earn", callback_data: "r:driver" },
      { text: "How it works", callback_data: "r:help" },
    ],
  ],
};

// Driver hub keyboard. These buttons use "/command" callback data (not the
// "r:" rider namespace) so they fall through to the driver command handler in
// telegramBot.ts via processTelegramUpdate.
const driverMenuKeyboard = {
  inline_keyboard: [
    [
      { text: "My status", callback_data: "/status" },
      { text: "Earnings", callback_data: "/earnings" },
    ],
    [
      { text: "Recent rides", callback_data: "/rides" },
      { text: "Referral code", callback_data: "/referral" },
    ],
    [
      { text: "Go online", callback_data: "/online" },
      { text: "Go offline", callback_data: "/offline" },
    ],
    [
      { text: "Earnings calculator", callback_data: "/calculator" },
      { text: "Driving tips", callback_data: "/tips" },
    ],
    [
      { text: "Why Travony", callback_data: "/whytravony" },
      { text: "Support", callback_data: "/support" },
    ],
    [{ text: "Back to menu", callback_data: "r:menu" }],
  ],
};

function riderWelcome(name: string): string {
  return `<b>Welcome to Travony, ${name}!</b>

Your intelligent mobility network — one place to <b>ride</b> and to <b>drive</b>.

<b>Ride</b>
• Book a car in three taps
• Order coffee — delivered, picked up, or gifted
• Discover lively hubs near you

<b>Drive</b>
• Turn your vehicle into income
• Keep 90% of every fare, 100% of tips

What would you like to do?`;
}

function driverHub(name: string): string {
  return `<b>Drive & earn with Travony, ${name}</b>

This is your operator hub.

<b>Why drive with us</b>
• Keep 90% of every fare — only a 10% platform fee
• Full yield visibility before you accept any route
• 100% of tips are yours
• Instant USDT payouts, AI-fair dispute resolution

<b>New here?</b>
1. Download <b>T Driver</b>: https://play.google.com/store/apps/details?id=com.travony.driver
2. Register as a vehicle operator
3. Link your account with /link [your phone]

Choose an option below:`;
}

function riderHelp(): string {
  return `<b>How Travony works</b>

<b>Ride</b>
/book — share pickup, set destination, pick a car, confirm. You'll get a pickup code and can message your driver right here.

<b>Coffee</b>
/coffee — choose a drink, then have it delivered, pick it up at a hub, or gift it to someone.

<b>Hubs</b>
/hubs — see lively pickup spots near you, and book or order coffee straight from one.

<b>Live Streams</b>
/live — watch drivers who are streaming live right now, right here in Telegram.

<b>Anytime</b>
/mytrip — your current ride · /myorders — your coffee orders
/cancelride — cancel a ride · /menu — back to the main menu

Tip: you can tap the menu button next to the message box to see every command.`;
}

async function startBooking(chatId: number, session: RiderSession): Promise<void> {
  session.step = "awaiting_pickup";
  session.pickup = undefined;
  session.destination = undefined;
  session.destCandidates = undefined;
  session.estimates = undefined;
  session.chosen = undefined;
  session.paymentMethod = undefined;
  await sendTelegramMessage(
    chatId,
    "<b>Step 1 of 3</b>\nTap the button below to share where you'd like to be picked up.",
    { reply_markup: sharePickupKeyboard } as any,
  );
}

async function promptLink(
  chatId: number,
  session: RiderSession,
  action: PendingAction = "book",
): Promise<void> {
  session.step = "awaiting_contact";
  session.pendingAction = action;
  await sendTelegramMessage(
    chatId,
    "Let's get you set up. Tap the button below to share your phone number so we can create your rider profile.",
    { reply_markup: shareContactKeyboard } as any,
  );
}

// Maps a region's vehicle type to a valid backend service-type id. The bot
// creates rides via storage.createRide directly (bypassing the HTTP route's
// serviceTypeId normalization), so the id must already be a valid st-* value.
const SERVICE_TYPE_BY_VEHICLE: Record<string, string> = {
  economy: "st-economy", comfort: "st-comfort", premium: "st-premium", xl: "st-xl",
  cng: "st-economy", rickshaw: "st-economy", tuktuk: "st-economy", moto: "st-economy", minibus: "st-xl",
};
function serviceTypeIdForVehicle(type: string): string {
  return SERVICE_TYPE_BY_VEHICLE[type] || "st-economy";
}

async function computeEstimates(
  pickup: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  regionCode: string,
): Promise<{ id: string; type: string; label: string; fare: number }[]> {
  const region = await getRegionByCode(regionCode).catch(() => null);
  // Use the region's own vehicle line-up (e.g. Bangladesh's Easy Bike / CNG Auto)
  // so budget markets see their cheap three-wheelers, not the default car tiers.
  const lineup = region?.vehicleTypes?.length
    ? region.vehicleTypes.map((v) => ({ id: serviceTypeIdForVehicle(v.type), type: v.type, label: v.localName }))
    : CAR_TYPES;
  const estimates: { id: string; type: string; label: string; fare: number }[] = [];
  for (const car of lineup) {
    try {
      const pricing = await calculateOptimalPrice(pickup.lat, pickup.lng, destination.lat, destination.lng, car.type, regionCode);
      estimates.push({ id: car.id, type: car.type, label: car.label, fare: pricing.total });
    } catch (error) {
      console.error(`[TelegramRider] Price error for ${car.type}:`, error);
    }
  }
  // Cheapest-first so low-income riders see the most affordable option at the top.
  estimates.sort((a, b) => a.fare - b.fare);
  return estimates;
}

async function showCarTypes(chatId: number, session: RiderSession): Promise<void> {
  if (!session.pickup || !session.destination) return;
  // Derive the region from the pickup coords (server-authoritative) so currency,
  // vehicle line-up and platform fee % all follow the rider's actual location.
  const regionCode = detectRegionFromCoordinates(session.pickup.lat, session.pickup.lng);
  const region = await getRegionByCode(regionCode).catch(() => null);
  session.regionCode = regionCode;
  session.currency = region?.currency || "AED";
  session.feePercent = region ? region.platformFeePercent : 10;
  const estimates = await computeEstimates(session.pickup, session.destination, regionCode);
  if (estimates.length === 0) {
    await sendTelegramMessage(chatId, "Sorry, we couldn't estimate a fare right now. Please try /book again.");
    session.step = undefined;
    return;
  }
  session.estimates = estimates;
  session.step = "awaiting_cartype";

  const cur = session.currency || "AED";
  const buttons = estimates.map((e) => [
    { text: `${e.label} — ${cur} ${e.fare.toFixed(2)}`, callback_data: `r:car:${e.type}` },
  ]);
  buttons.push([
    { text: "Back", callback_data: "r:rebook:dest" },
    { text: "Cancel", callback_data: "r:cancelbook" },
  ]);

  const dist = session.distanceKm ? ` (~${session.distanceKm.toFixed(1)} km)` : "";
  await sendTelegramMessage(
    chatId,
    `<b>Step 3 of 3</b>\nChoose your car${dist}. Fares are estimates — you'll pick how to pay next.`,
    { reply_markup: { inline_keyboard: buttons } } as any,
  );
}

async function showPaymentChoice(chatId: number, session: RiderSession): Promise<void> {
  if (!session.chosen || !session.pickup || !session.destination) return;
  session.step = "awaiting_payment";
  const text = `<b>How would you like to pay?</b>

Car: ${session.chosen.label}
Estimated fare: <b>${session.currency || "AED"} ${session.chosen.fare.toFixed(2)}</b>

<b>Cash</b> — pay your driver directly when you arrive.
<b>Crypto (USDT)</b> — we'll send a secure pay link to settle in crypto from your wallet when the trip ends.`;
  await sendTelegramMessage(chatId, text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Cash to driver", callback_data: "r:pay:cash" }],
        [{ text: "Crypto (USDT)", callback_data: "r:pay:usdt" }],
        [
          { text: "Back", callback_data: "r:rebook:car" },
          { text: "Cancel", callback_data: "r:cancelbook" },
        ],
      ],
    },
  } as any);
}

async function showConfirm(chatId: number, session: RiderSession): Promise<void> {
  if (!session.chosen || !session.pickup || !session.destination) return;
  session.step = "awaiting_confirm";
  const distLine = session.distanceKm ? `Distance: ~${session.distanceKm.toFixed(1)} km\n` : "";
  const payLine = session.paymentMethod === "usdt"
    ? "Payment: Crypto (USDT) — secure pay link sent when your trip ends"
    : "Payment: Cash to driver";
  const summary = `<b>Confirm your ride</b>

<b>From</b>  ${session.pickup.address}
<b>To</b>  ${session.destination.address}

Car: ${session.chosen.label}
${distLine}Estimated fare: <b>${session.currency || "AED"} ${session.chosen.fare.toFixed(2)}</b>
${payLine}

Tap confirm and we'll find your driver.`;
  await sendTelegramMessage(chatId, summary, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Confirm ride", callback_data: "r:confirm" }],
        [
          { text: "Back", callback_data: "r:rebook:pay" },
          { text: "Cancel", callback_data: "r:cancelbook" },
        ],
      ],
    },
  } as any);
}

async function createAndConfirmRide(chatId: number, session: RiderSession): Promise<void> {
  if (!session.userId || !session.chosen || !session.pickup || !session.destination) {
    await sendTelegramMessage(chatId, "Something went wrong. Please start again with /book.");
    session.step = undefined;
    return;
  }

  // Guard against double taps / replayed callbacks creating duplicate rides.
  if (session.confirming) return;
  session.confirming = true;

  try {
    // Auto-close abandoned rides (stale pending + long-inactive engaged) so a
    // rider is never permanently locked out by leftover records from old tests.
    await storage.expireStaleRides().catch(() => {});
    // Only an engaged ride (driver accepted, en route) should block a new
    // booking. Leftover unmatched "pending" rides are cleared so a previously
    // abandoned search can't permanently lock the rider out.
    const engaged = await getEngagedRideForUser(session.userId);
    if (engaged) {
      session.confirming = false;
      session.step = undefined;
      session.activeRideId = engaged.id;
      await sendTelegramMessage(
        chatId,
        "You already have an active trip. Use /mytrip to view it, or /cancelride before booking again.",
        { reply_markup: removeKeyboard } as any,
      );
      return;
    }
    await cancelPendingRidesForUser(session.userId);
  } catch (error) {
    console.error("[TelegramRider] active-ride check error:", error);
  }

  const fare = session.chosen.fare;
  const fees = calculateFeeBreakdown(fare, session.feePercent ?? 10);
  const distanceKm = session.distanceKm ?? calculateDistanceKm(
    session.pickup.lat, session.pickup.lng, session.destination.lat, session.destination.lng,
  );
  const durationMin = Math.round(distanceKm * 3 + 5);

  // Match a driver the same way the app does, so the assigned driver receives
  // the request in their T Driver app (which polls the DB for assigned rides).
  let intentData: Record<string, any> = {};
  let matchedEtaMin: number | undefined;
  const match = await matchDriverLikeApp(
    session.userId,
    session.pickup.lat, session.pickup.lng,
    session.destination.lat, session.destination.lng,
    "reliable",
  );
  if (match) {
    intentData = {
      driverId: match.driverId,
      matchType: match.matchType,
      aiMatchScore: match.aiMatchScore,
      ...(match.intentAlignmentScore ? { intentAlignmentScore: match.intentAlignmentScore } : {}),
    };
    matchedEtaMin = etaFromDistanceKm(match.distanceKm);
  }

  // Pre-generate the ride id so the blockchain hash matches the stored row,
  // exactly like the app's POST /api/rides flow.
  const rideId = randomUUID();
  const blockchainHash = generateRideHash({
    rideId,
    customerId: session.userId,
    driverId: intentData.driverId || "pending",
    pickupAddress: session.pickup.address,
    dropoffAddress: session.destination.address,
    fare,
    platformFee: fees.platformFee,
    driverShare: fees.driverShare,
    timestamp: new Date(),
  } as any);

  let ride;
  try {
    ride = await storage.createRide({
      id: rideId,
      customerId: session.userId,
      serviceTypeId: session.chosen.id,
      pickupAddress: session.pickup.address,
      pickupLat: session.pickup.lat.toString(),
      pickupLng: session.pickup.lng.toString(),
      dropoffAddress: session.destination.address,
      dropoffLat: session.destination.lat.toString(),
      dropoffLng: session.destination.lng.toString(),
      status: "pending",
      estimatedFare: fare.toFixed(2),
      distance: distanceKm.toFixed(2),
      duration: durationMin,
      paymentMethod: session.paymentMethod || "cash",
      paymentStatus: session.paymentMethod === "usdt" ? "awaiting_payment" : "pending",
      platformFee: fees.platformFee.toFixed(2),
      driverEarnings: fees.driverShare.toFixed(2),
      blockchainHash,
      currency: session.currency || "AED",
      regionCode: session.regionCode || "AE",
      riderPriority: "reliable",
      ...intentData,
    } as any);
  } catch (error: any) {
    console.error("[TelegramRider] Create ride error:", error);
    await sendTelegramMessage(chatId, "We couldn't create your ride right now. Please try /book again.");
    session.step = undefined;
    session.confirming = false;
    return;
  }

  session.step = undefined;
  session.confirming = false;
  session.activeRideId = ride.id;

  // Crypto (USDT): the rider pays up front. The ride is held out of the driver
  // pool (paymentStatus "awaiting_payment" — see storage.getPendingRides) until
  // the NOWPayments IPN confirms payment and releases it to drivers. We do NOT
  // broadcast here.
  if (session.paymentMethod === "usdt") {
    const payUrl = await createRideCryptoInvoice(ride.id, fare, ride.currency || "AED").catch(() => null);
    if (!payUrl) {
      await storage
        .updateRide(ride.id, { status: "cancelled", cancellationReason: "Crypto payment unavailable" } as any)
        .catch(() => {});
      session.activeRideId = undefined;
      await sendTelegramMessage(
        chatId,
        "<b>Crypto payment isn't available for this fare right now.</b>\nPlease type /book again and choose Cash to driver.",
        { reply_markup: removeKeyboard } as any,
      );
      return;
    }
    await sendTelegramMessage(
      chatId,
      `<b>Almost there — pay to confirm</b>

From: ${session.pickup.address}
To: ${session.destination.address}
Fare: <b>${ride.currency || "AED"} ${fare.toFixed(2)}</b> (USDT)

Tap below to pay securely. The moment your payment is confirmed, we'll find you a driver and message you right here.

/cancelride to cancel`,
      { reply_markup: { inline_keyboard: [[{ text: `Pay ${ride.currency || "AED"} ${fare.toFixed(2)} with crypto`, url: payUrl }]] } } as any,
    );
    return;
  }

  await sendTelegramMessage(
    chatId,
    `<b>Ride requested</b>

We're connecting you with a nearby driver.

Pickup code: <code>${ride.otp}</code>
Show this to your driver when you board.

Message your driver any time — just type here.
/mytrip to check status  ·  /cancelride to cancel`,
    { reply_markup: removeKeyboard } as any,
  );

  // Look up the matched driver + their vehicle once, then tell the rider who is coming
  // and notify the driver (if linked). The driver accepts in the app.
  if (intentData.driverId) {
    try {
      const driver = await storage.getDriver(intentData.driverId);
      if (driver) {
        const driverUser = await storage.getUser(driver.userId);
        const vehicles = await storage.getVehiclesByDriver(driver.id);
        const vehicle = vehicles?.[0];
        const driverName = driverUser?.name || "Your driver";
        const carDesc = vehicle
          ? `${vehicle.color ? vehicle.color + " " : ""}${vehicle.make} ${vehicle.model}`.trim()
          : session.chosen.label;
        const plate = vehicle?.plateNumber;
        const etaLine = matchedEtaMin
          ? `ETA: about ${matchedEtaMin} min away`
          : "ETA appears once the driver accepts";

        await sendTelegramMessage(
          chatId,
          `<b>Driver found</b>

Driver: ${driverName}
Car: ${carDesc}${plate ? `\nPlate: <code>${plate}</code>` : ""}
${etaLine}

Request sent to their app. You'll get a note here the moment they accept.`,
        );
      }
    } catch (error) {
      console.error("[TelegramRider] Driver notify error:", error);
    }
  } else {
    await sendTelegramMessage(
      chatId,
      `No drivers are free this second, but we're still looking. We'll message you here the moment one accepts.`,
    );
  }

  // Broadcast the new request to EVERY approved + online driver (Telegram, SMS,
  // WhatsApp, email). pending-rides is a broadcast model — any approved online
  // driver can claim it — so we ping them all, not just the proximity-matched one.
  // This is what actually surfaces the request to drivers; without it an
  // unmatched (or location-less) driver would never hear about a new ride.
  await notifyOnlineDriversOfNewRide(ride.id).catch((error) =>
    console.error("[TelegramRider] broadcast notify error:", error),
  );
}

// Commit a chosen destination and move the rider to car selection.
async function setTelegramDestination(
  chatId: number,
  session: RiderSession,
  dest: { lat: number; lng: number; address: string },
): Promise<void> {
  if (!session.pickup) return;
  session.destination = dest;
  session.destCandidates = undefined;
  session.distanceKm = calculateDistanceKm(
    session.pickup.lat, session.pickup.lng, dest.lat, dest.lng,
  );
  await sendTelegramMessage(chatId, `Destination set: <b>${dest.address}</b>`);
  await showCarTypes(chatId, session);
}

// Present the matching map places so the rider taps the exact destination.
async function offerDestinationChoices(
  chatId: number,
  session: RiderSession,
  candidates: { lat: number; lng: number; address: string }[],
): Promise<void> {
  session.destCandidates = candidates;
  const buttons = candidates.map((c, i) => [{
    text: c.address.length > 60 ? `${c.address.slice(0, 57)}...` : c.address,
    callback_data: `r:dest:${i}`,
  }]);
  buttons.push([{ text: "None of these — let me retype", callback_data: "r:dest:retry" }]);
  await sendTelegramMessage(
    chatId,
    "<b>Step 2 of 3</b>\nHere are the closest matches on the map. Tap the one you're heading to:",
    { reply_markup: { inline_keyboard: buttons } } as any,
  );
}

function readLocation(message: any): { lat: number; lng: number; address: string } | null {
  if (message?.location) {
    const venue = message.venue;
    const address = venue?.title
      ? `${venue.title}${venue.address ? `, ${venue.address}` : ""}`
      : "Pinned location";
    return { lat: message.location.latitude, lng: message.location.longitude, address };
  }
  return null;
}

async function handleContact(chatId: number, message: any, firstName: string): Promise<void> {
  const session = getSession(chatId);
  const phone = message.contact?.phone_number;
  if (!phone) {
    await sendTelegramMessage(chatId, "We couldn't read your phone number. Please try again.");
    return;
  }

  // Only accept the sender's own contact. Telegram sets contact.user_id to the
  // sharer's id when they tap the Share button; a pasted contact card for
  // someone else will not match. This prevents linking another person's account.
  if (!message.contact?.user_id || message.contact.user_id !== message.from?.id) {
    await sendTelegramMessage(
      chatId,
      "Please tap the button to share your own number — we can't link a contact that isn't yours.",
      { reply_markup: shareContactKeyboard } as any,
    );
    return;
  }

  let user = await findUserByPhone(phone);
  if (user) {
    if (user.telegramChatId !== chatId.toString()) {
      await db.update(users).set({ telegramChatId: chatId.toString() }).where(eq(users.id, user.id));
    }
  } else {
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone.replace(/[^0-9]/g, "")}`;
    user = await storage.createUser({
      email: `tg_${chatId}@telegram.travony`,
      name: message.contact?.first_name || firstName || "Rider",
      phone: normalizedPhone,
      role: "customer",
      isGuest: true,
      telegramChatId: chatId.toString(),
      preferredLanguage: "en",
      regionCode: "AE",
    } as any);
  }

  session.userId = user.id;
  await sendTelegramMessage(chatId, `Thanks, ${user.name}! Your rider profile is ready.`, {
    reply_markup: removeKeyboard,
  } as any);

  const action = session.pendingAction;
  const pendingHubId = session.pendingHubId;
  session.pendingAction = undefined;
  session.pendingHubId = undefined;
  session.pendingBook = false;

  if ((action === "hub_pickup" || action === "hub_coffee") && pendingHubId) {
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, pendingHubId));
    if (hub) {
      if (action === "hub_pickup") {
        await setHubAsPickup(chatId, session, hub);
      } else {
        await startCoffeeAtHub(chatId, session, hub);
      }
      return;
    }
  }

  if (action === "coffee") {
    await startCoffee(chatId, session);
  } else if (action === "hubs") {
    await startHubBrowse(chatId, session);
  } else if (action === "book") {
    await startBooking(chatId, session);
  } else {
    await sendTelegramMessage(chatId, riderWelcome(user.name), {
      reply_markup: mainMenuKeyboard,
    } as any);
  }
}

async function handleLocation(chatId: number, message: any): Promise<boolean> {
  const session = getSession(chatId);
  const loc = readLocation(message);
  if (!loc) return false;

  if (session.step === "awaiting_pickup") {
    if (loc.address === "Pinned location") {
      const resolved = await reverseGeocode(loc.lat, loc.lng);
      if (resolved) loc.address = resolved;
    }
    session.pickup = loc;
    session.step = "awaiting_destination";
    await sendTelegramMessage(
      chatId,
      "<b>Step 2 of 3</b>\nNow your destination. Just type where you're going (e.g. \"Dubai Mall\") and I'll show you matching spots on the map to pick from.\n\nPrefer to drop a pin? Tap the attachment (clip) icon, choose <b>Location</b>, and send a spot.",
      { reply_markup: removeKeyboard } as any,
    );
    return true;
  }

  if (session.step === "awaiting_destination") {
    if (!session.pickup) {
      session.step = "awaiting_pickup";
      await sendTelegramMessage(chatId, "Let's set your pickup first.", { reply_markup: sharePickupKeyboard } as any);
      return true;
    }
    if (loc.address === "Pinned location") {
      const resolved = await reverseGeocode(loc.lat, loc.lng);
      if (resolved) loc.address = resolved;
    }
    await setTelegramDestination(chatId, session, loc);
    return true;
  }

  if (session.step === "awaiting_coffee_delivery") {
    if (!session.coffee) return false;
    session.coffee.delivery = loc;
    session.step = undefined;
    await showCoffeeConfirm(chatId, session);
    return true;
  }

  if (session.step === "awaiting_coffee_hub_loc") {
    session.step = undefined;
    await listCoffeeHubs(chatId, session, loc.lat, loc.lng);
    return true;
  }

  if (session.step === "awaiting_hub_loc") {
    session.step = undefined;
    await listHubsNearby(chatId, session, loc.lat, loc.lng);
    return true;
  }

  return false;
}

async function bridgeRiderMessageToDriver(chatId: number, session: RiderSession, text: string): Promise<boolean> {
  if (!session.userId) return false;

  let ride = session.activeRideId ? await storage.getRide(session.activeRideId) : undefined;
  if (!ride || !ACTIVE_RIDE_STATUSES.includes(ride.status)) {
    ride = await getActiveRideForUser(session.userId);
  }
  if (!ride) return false;

  session.activeRideId = ride.id;

  const riderUser = await storage.getUser(session.userId);
  const riderLang = riderUser?.preferredLanguage || "en";

  let driverLang = "en";
  let driverChatId: string | null = null;
  if (ride.driverId) {
    const driver = await storage.getDriver(ride.driverId);
    if (driver) {
      const driverUser = await storage.getUser(driver.userId);
      driverLang = driverUser?.preferredLanguage || "en";
      driverChatId = driverUser?.telegramChatId || null;
    }
  }

  let result;
  try {
    result = await sendRideMessage(ride.id, session.userId, "customer", text, riderLang, driverLang, false);
  } catch (error) {
    console.error("[TelegramRider] sendRideMessage error:", error);
    await sendTelegramMessage(chatId, "We couldn't send your message. Please try again.");
    return true;
  }

  if (driverChatId) {
    await sendTelegramMessage(driverChatId, `<b>Message from your rider</b>\n${result.translatedMessage}`);
    await sendTelegramMessage(chatId, "Sent to your driver.");
  } else if (ride.driverId) {
    // Driver uses the T Driver app (not Telegram). The message is saved and
    // appears in their in-app chat — confirm to the rider so the chat doesn't
    // feel one-way / broken.
    await sendTelegramMessage(chatId, "Sent to your driver.");
  } else {
    await sendTelegramMessage(chatId, "Message saved — we'll pass it to your driver as soon as one is assigned.");
  }
  return true;
}

// ───────────────────────────── Coffee ordering ─────────────────────────────

const COFFEE_SIZES: ("small" | "medium" | "large")[] = ["small", "medium", "large"];

function sizePrice(basePrice: number, size: string): number {
  return Math.round(basePrice * (SIZE_MULTIPLIERS[size] || 1) * 100) / 100;
}

async function startCoffee(chatId: number, session: RiderSession): Promise<void> {
  session.coffee = {};
  session.step = undefined;
  await showCoffeeMenu(chatId);
}

async function showCoffeeMenu(chatId: number): Promise<void> {
  const rows: any[] = [];
  for (let i = 0; i < COFFEE_MENU.length; i += 2) {
    rows.push(
      COFFEE_MENU.slice(i, i + 2).map((m) => ({
        text: `${m.name} · AED ${m.basePrice}`,
        callback_data: `r:cof:drink:${m.id}`,
      })),
    );
  }
  rows.push([{ text: "Cancel", callback_data: "r:cof:cancel" }]);
  await sendTelegramMessage(
    chatId,
    "<b>Travony Coffee</b>\nPick your drink — freshly made and brought to you by a nearby driver.",
    { reply_markup: { inline_keyboard: rows } } as any,
  );
}

async function showCoffeeSizes(chatId: number, session: RiderSession, item: CoffeeMenuItem): Promise<void> {
  const buttons = COFFEE_SIZES.map((s) => [
    {
      text: `${s[0].toUpperCase()}${s.slice(1)} — AED ${sizePrice(item.basePrice, s).toFixed(2)}`,
      callback_data: `r:cof:size:${s}`,
    },
  ]);
  buttons.push([
    { text: "Back", callback_data: "r:cof:back:drinks" },
    { text: "Cancel", callback_data: "r:cof:cancel" },
  ]);
  await sendTelegramMessage(
    chatId,
    `<b>${item.name}</b>\n${item.description}\n\nChoose a size:`,
    { reply_markup: { inline_keyboard: buttons } } as any,
  );
}

async function showCoffeeQty(chatId: number): Promise<void> {
  const row = [1, 2, 3, 4, 5].map((n) => ({ text: `${n}`, callback_data: `r:cof:qty:${n}` }));
  await sendTelegramMessage(chatId, "How many cups?", {
    reply_markup: {
      inline_keyboard: [
        row,
        [
          { text: "Back", callback_data: "r:cof:back:sizes" },
          { text: "Cancel", callback_data: "r:cof:cancel" },
        ],
      ],
    },
  } as any);
}

async function showCoffeeMode(chatId: number): Promise<void> {
  await sendTelegramMessage(
    chatId,
    "How would you like it?\n\n• <b>Deliver to me</b> — brought to your location (+AED 5)\n• <b>Pick up at a hub</b> — collect it yourself, no delivery fee\n• <b>Gift to someone</b> — send it to a friend (+AED 5)",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Deliver to me", callback_data: "r:cof:mode:order" }],
          [{ text: "Pick up at a hub", callback_data: "r:cof:mode:buy" }],
          [{ text: "Gift to someone", callback_data: "r:cof:mode:gift" }],
          [
            { text: "Back", callback_data: "r:cof:back:qty" },
            { text: "Cancel", callback_data: "r:cof:cancel" },
          ],
        ],
      },
    } as any,
  );
}

async function promptCoffeeDelivery(chatId: number, session: RiderSession): Promise<void> {
  session.step = "awaiting_coffee_delivery";
  await sendTelegramMessage(
    chatId,
    "Where should we bring it? Tap below to share your location, or type an address.",
    { reply_markup: shareDeliveryKeyboard } as any,
  );
}

async function listCoffeeHubs(
  chatId: number,
  session: RiderSession,
  lat: number,
  lng: number,
): Promise<void> {
  const nearby = await getNearbyHubsForBot(lat, lng, 6);
  if (nearby.length === 0) {
    await sendTelegramMessage(
      chatId,
      "We couldn't find a pickup hub near you. Try 'Deliver to me' instead with /coffee.",
      { reply_markup: removeKeyboard } as any,
    );
    session.coffee = undefined;
    return;
  }
  const buttons = nearby.map((n) => [
    {
      text: `${n.hub.name} · ${n.distanceKm.toFixed(1)} km`,
      callback_data: `r:cof:hub:${n.hub.id}`,
    },
  ]);
  buttons.push([{ text: "Cancel", callback_data: "r:cof:cancel" }]);
  await sendTelegramMessage(chatId, "<b>Pick a hub to collect from</b>", {
    reply_markup: { inline_keyboard: buttons },
  } as any);
}

async function promptGiftName(chatId: number, session: RiderSession): Promise<void> {
  session.step = "awaiting_gift_name";
  await sendTelegramMessage(
    chatId,
    "Who's the lucky recipient? Type their <b>name</b>.",
    { reply_markup: removeKeyboard } as any,
  );
}

async function showCoffeeConfirm(chatId: number, session: RiderSession): Promise<void> {
  const c = session.coffee;
  if (!c?.drinkId || !c.size || !c.qty || !c.mode) {
    await sendTelegramMessage(chatId, "Something went wrong. Type /coffee to start again.");
    session.coffee = undefined;
    return;
  }
  const item = getMenuItem(c.drinkId);
  if (!item) {
    await sendTelegramMessage(chatId, "That drink is no longer available. Type /coffee to start again.");
    session.coffee = undefined;
    return;
  }
  const pricing = priceCoffee(item, c.size, c.qty, c.mode);
  const sizeLabel = `${c.size[0].toUpperCase()}${c.size.slice(1)}`;

  let whereLine = "";
  if (c.mode === "order") {
    whereLine = `Deliver to: ${c.delivery?.address || "your shared location"}`;
  } else if (c.mode === "buy") {
    whereLine = `Pick up at: ${c.hubName || "selected hub"}`;
  } else {
    whereLine = `Gift to: ${c.recipientName || "recipient"}${c.recipientPhone ? ` (${c.recipientPhone})` : ""}`;
    if (c.giftMessage) whereLine += `\nMessage: "${c.giftMessage}"`;
  }

  const feeLine = pricing.deliveryFee > 0 ? `Delivery fee: AED ${pricing.deliveryFee.toFixed(2)}\n` : "";
  await sendTelegramMessage(
    chatId,
    `<b>Confirm your order</b>

${c.qty} × ${item.name} (${sizeLabel})
${whereLine}

Item: AED ${pricing.itemPrice.toFixed(2)} each
${feeLine}Total: <b>AED ${pricing.totalAmount.toFixed(2)}</b>
Payment: Card`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Place order", callback_data: "r:cof:confirm" }],
          [{ text: "Cancel", callback_data: "r:cof:cancel" }],
        ],
      },
    } as any,
  );
}

async function submitCoffeeOrder(chatId: number, session: RiderSession): Promise<void> {
  const c = session.coffee;
  if (!session.userId || !c?.drinkId || !c.size || !c.qty || !c.mode) {
    await sendTelegramMessage(chatId, "Something went wrong. Type /coffee to start again.");
    session.coffee = undefined;
    return;
  }
  if (session.coffeeSubmitting) return;
  session.coffeeSubmitting = true;

  try {
    const order = await createCoffeeOrder({
      ordererId: session.userId,
      orderType: c.mode,
      coffeeName: c.drinkId,
      coffeeSize: c.size,
      quantity: c.qty,
      hubId: c.mode === "buy" ? c.hubId : undefined,
      deliveryLat: c.mode === "order" ? c.delivery?.lat : undefined,
      deliveryLng: c.mode === "order" ? c.delivery?.lng : undefined,
      deliveryAddress: c.mode === "order" ? c.delivery?.address : undefined,
      recipientName: c.mode === "gift" ? c.recipientName : undefined,
      recipientPhone: c.mode === "gift" ? c.recipientPhone : undefined,
      giftMessage: c.mode === "gift" ? c.giftMessage : undefined,
      paymentMethod: "card",
    });

    const ref = order.id.slice(0, 8).toUpperCase();
    await sendTelegramMessage(
      chatId,
      `<b>Order placed — thank you!</b>
Order <code>#${ref}</code>

${order.quantity} × ${order.coffeeName} (${order.coffeeSize})
Total: <b>AED ${parseFloat(order.totalAmount).toFixed(2)}</b>

We're finding a driver to prepare and bring it over. You'll get updates here as it progresses.
/myorders to track  ·  /coffee to order again`,
      { reply_markup: removeKeyboard } as any,
    );
  } catch (error: any) {
    console.error("[TelegramRider] coffee order error:", error);
    await sendTelegramMessage(
      chatId,
      "We couldn't place your order right now. Please try /coffee again.",
      { reply_markup: removeKeyboard } as any,
    );
  } finally {
    session.coffee = undefined;
    session.coffeeSubmitting = false;
    session.step = undefined;
  }
}

// ───────────────────────────── Hubs (OpenClaw) ─────────────────────────────

interface NearbyHub {
  hub: typeof hubs.$inferSelect;
  distanceKm: number;
  staged: number;
}

const RIDE_STATUS_LABEL: Record<string, string> = {
  pending: "Finding your driver",
  accepted: "Driver confirmed — on the way",
  arriving: "Driver is arriving",
  started: "On the trip",
  in_progress: "On the trip",
  completed: "Completed",
  cancelled: "Cancelled",
};

function demandLabel(score: number): string {
  if (score >= 8) return "Very high demand";
  if (score >= 6) return "High demand";
  if (score >= 4) return "Moderate demand";
  if (score >= 1) return "Low demand";
  return "Quiet right now";
}

async function getNearbyHubsForBot(lat: number, lng: number, limit = 6): Promise<NearbyHub[]> {
  const activeHubs = await db.select().from(hubs).where(eq(hubs.status, "active"));
  const aeHubs = activeHubs.filter((h) => !h.regionCode || h.regionCode.startsWith("AE-"));

  let stagedByHub: Record<string, number> = {};
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const recent = await db
      .select({ hubId: hubCheckIns.hubId })
      .from(hubCheckIns)
      .where(and(gte(hubCheckIns.checkedInAt, twoHoursAgo), isNull(hubCheckIns.checkedOutAt)));
    stagedByHub = recent.reduce<Record<string, number>>((acc, c) => {
      acc[c.hubId] = (acc[c.hubId] || 0) + 1;
      return acc;
    }, {});
  } catch (error) {
    console.error("[TelegramRider] staged count error:", error);
  }

  return aeHubs
    .map((h) => ({
      hub: h,
      distanceKm: calculateDistanceKm(lat, lng, parseFloat(h.lat), parseFloat(h.lng)),
      staged: stagedByHub[h.id] || 0,
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

async function startHubBrowse(chatId: number, session: RiderSession): Promise<void> {
  session.step = "awaiting_hub_loc";
  await sendTelegramMessage(
    chatId,
    "<b>Explore hubs near you</b>\nShare your location and I'll show the liveliest pickup spots around — great places to catch a ride fast.",
    { reply_markup: shareHubLocationKeyboard } as any,
  );
}

async function listHubsNearby(
  chatId: number,
  session: RiderSession,
  lat: number,
  lng: number,
): Promise<void> {
  const nearby = await getNearbyHubsForBot(lat, lng, 6);
  if (nearby.length === 0) {
    await sendTelegramMessage(
      chatId,
      "No hubs found near you yet. You can still book a ride anytime with /book.",
      { reply_markup: removeKeyboard } as any,
    );
    return;
  }
  const buttons = nearby.map((n) => {
    const ev = n.hub.isEvHub ? " ⚡" : "";
    return [
      {
        text: `${n.hub.name}${ev} · ${n.distanceKm.toFixed(1)} km`,
        callback_data: `r:hub:view:${n.hub.id}`,
      },
    ];
  });
  await sendTelegramMessage(
    chatId,
    "<b>Hubs near you</b>\nTap a hub for details, then set it as your pickup or order a coffee there.",
    { reply_markup: { inline_keyboard: buttons } } as any,
  );
}

async function showHubDetail(chatId: number, session: RiderSession, hubId: string): Promise<void> {
  const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
  if (!hub) {
    await sendTelegramMessage(chatId, "That hub is no longer available. Type /hubs to look again.");
    return;
  }
  const score = parseFloat(hub.avgDemandScore || "0");
  const staged = (await getNearbyHubsForBot(parseFloat(hub.lat), parseFloat(hub.lng), 50)).find(
    (n) => n.hub.id === hub.id,
  )?.staged ?? 0;

  let body = `<b>${hub.name}</b>\n`;
  if (hub.description) body += `${hub.description}\n`;
  body += `\nDemand: ${demandLabel(score)}`;
  if (hub.peakHours) body += `\nBusy hours: ${hub.peakHours}`;
  body += `\nDrivers staged here: ${staged}`;
  if (hub.isEvHub) {
    body += `\nEV charging: ${hub.availablePorts ?? 0}/${hub.totalChargingPorts ?? 0} ports free`;
  }
  if (hub.address) body += `\nAddress: ${hub.address}`;

  await sendTelegramMessage(chatId, body, {
    reply_markup: {
      inline_keyboard: [
        [{ text: "Set as pickup & book", callback_data: `r:hub:pickup:${hub.id}` }],
        [{ text: "Order coffee here", callback_data: `r:hub:coffee:${hub.id}` }],
        [{ text: "Back to hubs", callback_data: "r:hubs" }],
      ],
    },
  } as any);
}

async function handleCoffeeCallback(
  chatId: number,
  session: RiderSession,
  rest: string,
): Promise<boolean> {
  if (rest === "cancel") {
    session.coffee = undefined;
    session.step = undefined;
    await sendTelegramMessage(chatId, "No problem — order cancelled. Type /coffee anytime.", {
      reply_markup: removeKeyboard,
    } as any);
    return true;
  }

  if (!session.coffee) session.coffee = {};
  const c = session.coffee;

  if (rest === "back:drinks") {
    await showCoffeeMenu(chatId);
    return true;
  }

  if (rest === "back:sizes") {
    const item = c.drinkId ? getMenuItem(c.drinkId) : undefined;
    if (!item) {
      await showCoffeeMenu(chatId);
      return true;
    }
    await showCoffeeSizes(chatId, session, item);
    return true;
  }

  if (rest === "back:qty") {
    await showCoffeeQty(chatId);
    return true;
  }

  if (rest.startsWith("drink:")) {
    const id = rest.slice("drink:".length);
    const item = getMenuItem(id);
    if (!item) {
      await sendTelegramMessage(chatId, "That drink isn't available. Type /coffee to start again.");
      return true;
    }
    c.drinkId = id;
    c.drinkName = item.name;
    c.basePrice = item.basePrice;
    await showCoffeeSizes(chatId, session, item);
    return true;
  }

  if (rest.startsWith("size:")) {
    c.size = rest.slice("size:".length) as CoffeeDraft["size"];
    await showCoffeeQty(chatId);
    return true;
  }

  if (rest.startsWith("qty:")) {
    c.qty = parseInt(rest.slice("qty:".length), 10) || 1;
    if (c.mode === "buy" && c.hubId) {
      await showCoffeeConfirm(chatId, session);
    } else {
      await showCoffeeMode(chatId);
    }
    return true;
  }

  if (rest.startsWith("mode:")) {
    const mode = rest.slice("mode:".length) as CoffeeDraft["mode"];
    c.mode = mode;
    if (mode === "order") {
      await promptCoffeeDelivery(chatId, session);
    } else if (mode === "buy") {
      session.step = "awaiting_coffee_hub_loc";
      await sendTelegramMessage(
        chatId,
        "Share your location and I'll find a nearby hub for you to pick up from.",
        { reply_markup: shareHubLocationKeyboard } as any,
      );
    } else {
      await promptGiftName(chatId, session);
    }
    return true;
  }

  if (rest.startsWith("hub:")) {
    const hubId = rest.slice("hub:".length);
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      await sendTelegramMessage(chatId, "That hub is no longer available. Type /coffee to retry.");
      return true;
    }
    c.mode = "buy";
    c.hubId = hub.id;
    c.hubName = hub.name;
    await showCoffeeConfirm(chatId, session);
    return true;
  }

  if (rest === "giftskip") {
    c.giftMessage = undefined;
    session.step = undefined;
    await showCoffeeConfirm(chatId, session);
    return true;
  }

  if (rest === "confirm") {
    await submitCoffeeOrder(chatId, session);
    return true;
  }

  return false;
}

async function setHubAsPickup(
  chatId: number,
  session: RiderSession,
  hub: typeof hubs.$inferSelect,
): Promise<void> {
  session.coffee = undefined;
  session.pickup = { lat: parseFloat(hub.lat), lng: parseFloat(hub.lng), address: hub.name };
  session.destination = undefined;
  session.estimates = undefined;
  session.chosen = undefined;
  session.step = "awaiting_destination";
  await sendTelegramMessage(
    chatId,
    `Pickup set to <b>${hub.name}</b>.\n\nNow send your destination — type where you're going, or share a location pin.`,
    { reply_markup: removeKeyboard } as any,
  );
}

async function startCoffeeAtHub(
  chatId: number,
  session: RiderSession,
  hub: typeof hubs.$inferSelect,
): Promise<void> {
  session.coffee = { mode: "buy", hubId: hub.id, hubName: hub.name };
  session.step = undefined;
  await sendTelegramMessage(chatId, `Ordering for pickup at <b>${hub.name}</b>.`);
  await showCoffeeMenu(chatId);
}

async function handleHubCallback(
  chatId: number,
  session: RiderSession,
  rest: string,
): Promise<boolean> {
  if (rest.startsWith("view:")) {
    await showHubDetail(chatId, session, rest.slice("view:".length));
    return true;
  }

  if (rest.startsWith("pickup:") || rest.startsWith("coffee:")) {
    const isPickup = rest.startsWith("pickup:");
    const hubId = rest.slice((isPickup ? "pickup:" : "coffee:").length);
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      await sendTelegramMessage(chatId, "That hub is no longer available. Type /hubs to retry.");
      return true;
    }
    const user = await getUserByChatId(chatId);
    if (!user) {
      session.pendingHubId = hub.id;
      await promptLink(chatId, session, isPickup ? "hub_pickup" : "hub_coffee");
      return true;
    }
    session.userId = user.id;
    if (isPickup) {
      await setHubAsPickup(chatId, session, hub);
    } else {
      await startCoffeeAtHub(chatId, session, hub);
    }
    return true;
  }

  return false;
}

const COFFEE_STATUS_LABEL: Record<string, string> = {
  pending: "Finding a driver",
  accepted: "A driver accepted your order",
  preparing: "Your drink is being prepared",
  ready: "Ready",
  picked_up: "Picked up by driver",
  delivering: "On the way to you",
  delivered: "Delivered — enjoy!",
  cancelled: "Cancelled",
};

async function showMyCoffeeOrders(chatId: number, userId: string): Promise<void> {
  const orders = await db
    .select()
    .from(coffeeOrders)
    .where(eq(coffeeOrders.ordererId, userId))
    .orderBy(desc(coffeeOrders.createdAt))
    .limit(5);

  if (orders.length === 0) {
    await sendTelegramMessage(chatId, "You have no coffee orders yet. Type /coffee to order a drink.");
    return;
  }

  const lines = orders.map((o) => {
    const ref = o.id.slice(0, 8).toUpperCase();
    const status = COFFEE_STATUS_LABEL[o.status] || o.status;
    return `<code>#${ref}</code> — ${o.quantity} × ${o.coffeeName} (${o.coffeeSize})\nAED ${parseFloat(o.totalAmount).toFixed(2)} · ${status}`;
  });

  await sendTelegramMessage(chatId, `<b>Your recent orders</b>\n\n${lines.join("\n\n")}`);
}

async function handleRiderCommand(chatId: number, command: string, firstName: string): Promise<boolean> {
  const session = getSession(chatId);

  if (command === "/start" || command === "/menu") {
    // Unified entry for everyone — riders and drivers alike see both paths.
    await sendTelegramMessage(chatId, riderWelcome(firstName), {
      reply_markup: mainMenuKeyboard,
    } as any);
    return true;
  }

  if (command === "/drive" || command === "/driver") {
    await sendTelegramMessage(chatId, driverHub(firstName), {
      reply_markup: driverMenuKeyboard,
    } as any);
    return true;
  }

  if (command === "/help") {
    await sendTelegramMessage(chatId, riderHelp(), { reply_markup: mainMenuKeyboard } as any);
    return true;
  }

  if (command === "/book" || command === "/ride") {
    const user = await getUserByChatId(chatId);
    if (!user) {
      await promptLink(chatId, session, "book");
    } else {
      session.userId = user.id;
      await startBooking(chatId, session);
    }
    return true;
  }

  if (command === "/coffee") {
    const user = await getUserByChatId(chatId);
    if (!user) {
      await promptLink(chatId, session, "coffee");
    } else {
      session.userId = user.id;
      await startCoffee(chatId, session);
    }
    return true;
  }

  if (command === "/hubs") {
    const user = await getUserByChatId(chatId);
    if (!user) {
      await promptLink(chatId, session, "hubs");
    } else {
      session.userId = user.id;
      await startHubBrowse(chatId, session);
    }
    return true;
  }

  if (command === "/myorders") {
    const user = session.userId ? { id: session.userId } : await getUserByChatId(chatId);
    if (!user) {
      await sendTelegramMessage(chatId, "You have no orders yet. Type /coffee to order a drink.");
      return true;
    }
    session.userId = user.id;
    await showMyCoffeeOrders(chatId, user.id);
    return true;
  }

  if (command === "/mytrip") {
    const user = session.userId ? { id: session.userId } : await getUserByChatId(chatId);
    if (!user) {
      await sendTelegramMessage(chatId, "You don't have a trip yet. Type /book to ride.");
      return true;
    }
    const ride = await getActiveRideForUser(user.id);
    if (!ride) {
      await sendTelegramMessage(chatId, "No active trip right now. Type /book to ride.");
      return true;
    }
    session.userId = user.id;
    session.activeRideId = ride.id;
    let driverLine = "We're still finding your driver.";
    if (ride.driverId) {
      const driver = await storage.getDriver(ride.driverId);
      const [veh] = driver ? await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1) : [];
      const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
      const vehText = veh ? ` — ${veh.make || ""} ${veh.model || ""} (${veh.plateNumber || ""})` : "";
      driverLine = `Driver: ${driverUser?.name || "Assigned"}${vehText}`;
    }
    const statusLabel = RIDE_STATUS_LABEL[ride.status] || ride.status;
    await sendTelegramMessage(
      chatId,
      `<b>Your trip</b>

Status: <b>${statusLabel}</b>
From: ${ride.pickupAddress}
To: ${ride.dropoffAddress}
Fare: ${ride.currency || "AED"} ${ride.estimatedFare || "0.00"} (cash)
Pickup code: <code>${ride.otp}</code>

${driverLine}

Type a message to chat with your driver, or /cancelride to cancel.`,
    );
    return true;
  }

  if (command === "/live") {
    const liveStreams = await getLiveTelegramStreams();
    if (liveStreams.length === 0) {
      await sendTelegramMessage(
        chatId,
        "No drivers are streaming live right now.\n\nCheck back soon — drivers use /golive to broadcast their rides.",
      );
      return true;
    }
    const base = getTravonyBaseUrl();
    const inlineKeyboard = liveStreams.map((s) => {
      const watchUrl = `${base}/tg-watch?postId=${encodeURIComponent(s.postId)}&name=${encodeURIComponent(s.driverName)}`;
      const minutesLive = Math.max(1, Math.round((Date.now() - s.startedAt.getTime()) / 60000));
      return [{ text: `${s.driverName} — ${minutesLive} min live`, web_app: { url: watchUrl } }];
    });
    await sendTelegramMessage(chatId, `<b>Live Streams (${liveStreams.length})</b>\n\nTap a button to watch:`, {
      reply_markup: { inline_keyboard: inlineKeyboard },
    } as any);
    return true;
  }

  if (command === "/cancelride") {
    const user = session.userId ? { id: session.userId } : await getUserByChatId(chatId);
    if (!user) {
      await sendTelegramMessage(chatId, "No active trip to cancel.");
      return true;
    }
    session.userId = user.id;
    // Cancel every active ride for this rider — pending, accepted, arriving, and
    // even started/in_progress — plus any leftover duplicates, so a rider can
    // never be permanently locked out of booking by a stuck trip.
    const cancellable = await db
      .select()
      .from(rides)
      .where(and(eq(rides.customerId, user.id), inArray(rides.status, CANCELLABLE_RIDE_STATUSES as any)));
    if (cancellable.length === 0) {
      await sendTelegramMessage(chatId, "You don't have a trip to cancel right now. Type /book to ride.");
      return true;
    }
    const hadLiveTrip = cancellable.some((r) => r.status === "started" || r.status === "in_progress");
    let cancelled = 0;
    for (const r of cancellable) {
      try {
        await storage.updateRide(r.id, { status: "cancelled", cancelledAt: new Date() });
        cancelled++;
      } catch (error) {
        console.error("[TelegramRider] cancelride error:", error);
      }
    }
    if (cancelled === 0) {
      await sendTelegramMessage(chatId, "We couldn't cancel your ride just now. Please try again in a moment.");
      return true;
    }
    session.activeRideId = undefined;
    await sendTelegramMessage(
      chatId,
      hadLiveTrip
        ? "Your trip has been ended and cancelled. Type /book whenever you need another."
        : "Your ride has been cancelled. Type /book whenever you need another.",
    );
    return true;
  }

  return false;
}

async function handleRiderCallback(chatId: number, data: string, firstName: string): Promise<boolean> {
  const session = getSession(chatId);

  if (data === "r:help") {
    await sendTelegramMessage(chatId, riderHelp(), { reply_markup: mainMenuKeyboard } as any);
    return true;
  }

  if (data === "r:menu") {
    await sendTelegramMessage(chatId, riderWelcome(firstName), {
      reply_markup: mainMenuKeyboard,
    } as any);
    return true;
  }

  if (data === "r:driver") {
    await sendTelegramMessage(chatId, driverHub(firstName), {
      reply_markup: driverMenuKeyboard,
    } as any);
    return true;
  }

  if (data === "r:book") {
    const user = await getUserByChatId(chatId);
    if (!user) {
      await promptLink(chatId, session, "book");
    } else {
      session.userId = user.id;
      await startBooking(chatId, session);
    }
    return true;
  }

  if (data === "r:coffee") {
    const user = await getUserByChatId(chatId);
    if (!user) {
      await promptLink(chatId, session, "coffee");
    } else {
      session.userId = user.id;
      await startCoffee(chatId, session);
    }
    return true;
  }

  if (data === "r:hubs") {
    const user = await getUserByChatId(chatId);
    if (!user) {
      await promptLink(chatId, session, "hubs");
    } else {
      session.userId = user.id;
      await startHubBrowse(chatId, session);
    }
    return true;
  }

  // ── Emailed ride receipt ──
  if (data.startsWith("r:rcpt:")) {
    const rideId = data.slice("r:rcpt:".length);
    const user = await getUserByChatId(chatId);
    if (!user) {
      await promptLink(chatId, session, "book");
      return true;
    }
    session.userId = user.id;
    // Only the rider who took the (completed) trip may have it emailed.
    const ride = await storage.getRide(rideId);
    if (!ride || ride.customerId !== user.id || ride.status !== "completed") {
      await sendTelegramMessage(chatId, "I couldn't find a completed trip of yours to send. Please try again from your trip's receipt.");
      return true;
    }
    if (!isPlaceholderEmail(user.email)) {
      const ok = await emailRideReceipt(rideId, user.email, user.name || firstName);
      await sendTelegramMessage(
        chatId,
        ok
          ? `Done — your receipt is on its way to <b>${user.email}</b>.`
          : "Sorry, I couldn't send the email right now. Please try again later.",
      );
    } else {
      session.step = "awaiting_receipt_email";
      session.receiptRideId = rideId;
      await sendTelegramMessage(chatId, "What email should I send your receipt to? Just type it here.");
    }
    return true;
  }

  // ── Coffee flow callbacks ──
  if (data.startsWith("r:cof:")) {
    return handleCoffeeCallback(chatId, session, data.slice("r:cof:".length));
  }

  // ── Hub flow callbacks ──
  if (data.startsWith("r:hub:")) {
    return handleHubCallback(chatId, session, data.slice("r:hub:".length));
  }

  if (data === "r:rebook:dest") {
    if (!session.pickup) {
      await startBooking(chatId, session);
      return true;
    }
    session.step = "awaiting_destination";
    session.destination = undefined;
    session.destCandidates = undefined;
    session.estimates = undefined;
    session.chosen = undefined;
    await sendTelegramMessage(
      chatId,
      "<b>Step 2 of 3</b>\nNow your destination. Just type where you're going (e.g. \"Dubai Mall\") and I'll show you matching spots on the map to pick from.\n\nPrefer to drop a pin? Tap the attachment (clip) icon, choose <b>Location</b>, and send a spot.",
    );
    return true;
  }

  if (data === "r:rebook:car") {
    if (!session.pickup || !session.destination) {
      await startBooking(chatId, session);
      return true;
    }
    session.chosen = undefined;
    await showCarTypes(chatId, session);
    return true;
  }

  if (data.startsWith("r:dest:")) {
    const rest = data.slice("r:dest:".length);
    if (rest === "retry") {
      session.destCandidates = undefined;
      session.step = "awaiting_destination";
      await sendTelegramMessage(
        chatId,
        "No problem — type your destination again (e.g. \"Dubai Mall, Downtown\"). Adding the area helps me find the right spot.",
      );
      return true;
    }
    const idx = parseInt(rest, 10);
    const choice = !Number.isNaN(idx) ? session.destCandidates?.[idx] : undefined;
    if (!choice || !session.pickup) {
      session.step = "awaiting_destination";
      await sendTelegramMessage(chatId, "That option expired. Please type your destination again.");
      return true;
    }
    await setTelegramDestination(chatId, session, choice);
    return true;
  }

  if (data.startsWith("r:car:")) {
    const type = data.slice("r:car:".length);
    const chosen = session.estimates?.find((e) => e.type === type);
    if (!chosen) {
      await sendTelegramMessage(chatId, "That option expired. Please start again with /book.");
      session.step = undefined;
      return true;
    }
    session.chosen = chosen;
    await showPaymentChoice(chatId, session);
    return true;
  }

  if (data === "r:pay:cash" || data === "r:pay:usdt") {
    if (!session.chosen) {
      await sendTelegramMessage(chatId, "That option expired. Please start again with /book.");
      session.step = undefined;
      return true;
    }
    session.paymentMethod = data === "r:pay:usdt" ? "usdt" : "cash";
    await showConfirm(chatId, session);
    return true;
  }

  if (data === "r:rebook:pay") {
    // If the session expired (no car/pickup/destination), restart cleanly rather
    // than calling showCarTypes, which early-returns and would dead-end.
    if (!session.chosen || !session.pickup || !session.destination || !session.estimates) {
      await startBooking(chatId, session);
      return true;
    }
    await showPaymentChoice(chatId, session);
    return true;
  }

  if (data === "r:confirm") {
    await createAndConfirmRide(chatId, session);
    return true;
  }

  if (data === "r:cancelbook") {
    session.step = undefined;
    session.pickup = undefined;
    session.destination = undefined;
    session.destCandidates = undefined;
    session.estimates = undefined;
    session.chosen = undefined;
    session.paymentMethod = undefined;
    await sendTelegramMessage(chatId, "Booking cancelled. Type /book whenever you're ready.", {
      reply_markup: removeKeyboard,
    } as any);
    return true;
  }

  return false;
}

/**
 * Resolve a typed address to coordinates using OpenStreetMap's Nominatim
 * (no API key required). Biased toward the rider's pickup area when provided.
 */
async function geocodeAddress(
  query: string,
  near?: { lat: number; lng: number },
): Promise<{ lat: number; lng: number; address: string } | null> {
  const results = await searchAddresses(query, near, 1);
  return results[0] ?? null;
}

/**
 * Google Places Text Search — Google-Maps-quality lookup of POIs, malls,
 * landmarks, and addresses. Returns matches with coordinates so the rider picks
 * the exact spot. Requires GOOGLE_API_KEY with the Places API enabled; biased
 * toward the rider's pickup area when provided.
 */
async function searchAddressesGoogle(
  query: string,
  key: string,
  near?: { lat: number; lng: number },
  limit = 5,
): Promise<{ lat: number; lng: number; address: string }[]> {
  try {
    const params = new URLSearchParams({ query, key, language: "en" });
    if (near) {
      params.set("location", `${near.lat},${near.lng}`);
      params.set("radius", "60000"); // ~60km bias around pickup
    }
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/textsearch/json?${params.toString()}`,
    );
    if (!res.ok) return [];
    const data: any = await res.json();
    if (!Array.isArray(data?.results)) return [];
    const out: { lat: number; lng: number; address: string }[] = [];
    for (const item of data.results) {
      const lat = item?.geometry?.location?.lat;
      const lng = item?.geometry?.location?.lng;
      if (typeof lat !== "number" || typeof lng !== "number") continue;
      const name = typeof item.name === "string" ? item.name : "";
      const formatted = typeof item.formatted_address === "string" ? item.formatted_address : "";
      const address = name
        ? formatted && !formatted.startsWith(name)
          ? `${name}, ${formatted}`
          : name
        : formatted || query;
      out.push({ lat, lng, address });
      if (out.length >= limit) break;
    }
    return out;
  } catch (error) {
    console.error("[TelegramRider] Google search error:", error);
    return [];
  }
}

/**
 * Search a typed place name and return up to `limit` matching map locations so
 * the rider can pick the exact one — an autocomplete-style experience instead of
 * silently guessing the first hit. Biased toward the rider's area when provided.
 */
async function searchAddresses(
  query: string,
  near?: { lat: number; lng: number },
  limit = 5,
): Promise<{ lat: number; lng: number; address: string }[]> {
  // Prefer Google Places (Google-Maps-quality POI/landmark/address search) when a
  // key is configured; fall back to OpenStreetMap Nominatim otherwise.
  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey) {
    const google = await searchAddressesGoogle(query, googleKey, near, limit);
    if (google.length > 0) return google;
  }
  try {
    const params = new URLSearchParams({
      format: "json",
      q: query,
      limit: String(limit),
      addressdetails: "0",
    });
    if (near) {
      const d = 0.6; // ~60km box around pickup to prefer nearby results
      params.set("viewbox", `${near.lng - d},${near.lat - d},${near.lng + d},${near.lat + d}`);
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "User-Agent": "Travony/1.0 (ride booking)", "Accept-Language": "en" },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    if (!Array.isArray(data)) return [];
    const out: { lat: number; lng: number; address: string }[] = [];
    for (const item of data) {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) continue;
      const address = typeof item.display_name === "string"
        ? item.display_name.split(",").slice(0, 3).join(",").trim()
        : query;
      out.push({ lat, lng, address });
    }
    return out;
  } catch (error) {
    console.error("[TelegramRider] search error:", error);
    return [];
  }
}

/**
 * Turn raw GPS coordinates (e.g. a pinned map location) into a human-readable
 * street address so the driver sees a real place name, not just "Pinned location".
 */
async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // Prefer Google reverse geocoding when a key is set, for cleaner place names.
  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey) {
    try {
      const gp = new URLSearchParams({ latlng: `${lat},${lng}`, key: googleKey, language: "en" });
      const gr = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?${gp.toString()}`,
      );
      if (gr.ok) {
        const gd: any = await gr.json();
        const first = Array.isArray(gd?.results) ? gd.results[0] : undefined;
        if (first?.formatted_address) return first.formatted_address as string;
      }
    } catch (error) {
      console.error("[TelegramRider] Google reverse geocode error:", error);
    }
  }
  try {
    const params = new URLSearchParams({
      format: "json",
      lat: String(lat),
      lon: String(lng),
      zoom: "18",
      addressdetails: "0",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      headers: { "User-Agent": "Travony/1.0 (ride booking)", "Accept-Language": "en" },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (typeof data?.display_name === "string") {
      return data.display_name.split(",").slice(0, 3).join(",").trim();
    }
    return null;
  } catch (error) {
    console.error("[TelegramRider] reverse geocode error:", error);
    return null;
  }
}

export async function tryHandleRiderUpdate(update: any): Promise<boolean> {
  await ensureHydrated();
  const chatId: number | undefined = update.callback_query
    ? update.callback_query.message?.chat?.id
    : update.message?.chat?.id;
  try {
    return await handleRiderUpdateInner(update);
  } finally {
    if (typeof chatId === "number") {
      await persistSession(chatId);
    }
  }
}

async function handleRiderUpdateInner(update: any): Promise<boolean> {
  // Callback buttons in the rider namespace
  if (update.callback_query) {
    const data: string | undefined = update.callback_query.data;
    const chatId = update.callback_query.message?.chat.id;
    if (data && chatId && data.startsWith("r:")) {
      await answerCallbackQuery(update.callback_query.id);
      return handleRiderCallback(chatId, data, update.callback_query.from.first_name);
    }
    return false;
  }

  const message = update.message;
  if (!message) return false;
  const chatId = message.chat.id;
  const firstName = message.from?.first_name || "there";

  // Shared phone number
  if (message.contact) {
    await handleContact(chatId, message, firstName);
    return true;
  }

  // Shared / pinned location (pickup or destination)
  if (message.location) {
    const handled = await handleLocation(chatId, message);
    if (handled) return true;
    return false;
  }

  if (!message.text) return false;
  const text: string = message.text.trim();

  // Rider-specific commands (and /start choice screen)
  if (text.startsWith("/")) {
    const command = text.split(" ")[0].toLowerCase().split("@")[0];
    return handleRiderCommand(chatId, command, firstName);
  }

  // Mid-booking text guidance
  const session = getSession(chatId);

  // Coffee: typed delivery address
  if (session.step === "awaiting_coffee_delivery") {
    if (!session.coffee) {
      session.step = undefined;
      return false;
    }
    await sendTelegramMessage(chatId, "Looking up that address...");
    const loc = await geocodeAddress(text);
    if (!loc) {
      await sendTelegramMessage(
        chatId,
        "I couldn't find that address. Try adding the city/area, or tap the button to share your location.",
        { reply_markup: shareDeliveryKeyboard } as any,
      );
      return true;
    }
    session.coffee.delivery = loc;
    session.step = undefined;
    await showCoffeeConfirm(chatId, session);
    return true;
  }

  // Coffee gift flow text inputs
  if (session.step === "awaiting_gift_name") {
    if (!session.coffee) {
      session.step = undefined;
      return false;
    }
    session.coffee.recipientName = text.slice(0, 80);
    session.step = "awaiting_gift_phone";
    await sendTelegramMessage(chatId, "Got it. What's their <b>phone number</b>? (with country code)");
    return true;
  }
  if (session.step === "awaiting_gift_phone") {
    if (!session.coffee) {
      session.step = undefined;
      return false;
    }
    const digits = text.replace(/[^\d+]/g, "");
    if (digits.replace(/\D/g, "").length < 7) {
      await sendTelegramMessage(chatId, "That doesn't look like a valid number. Please type their phone number.");
      return true;
    }
    session.coffee.recipientPhone = digits;
    session.step = "awaiting_gift_message";
    await sendTelegramMessage(
      chatId,
      "Add a short <b>gift message</b> (or skip).",
      { reply_markup: { inline_keyboard: [[{ text: "Skip message", callback_data: "r:cof:giftskip" }]] } } as any,
    );
    return true;
  }
  if (session.step === "awaiting_gift_message") {
    if (!session.coffee) {
      session.step = undefined;
      return false;
    }
    session.coffee.giftMessage = text.slice(0, 200);
    session.step = undefined;
    await showCoffeeConfirm(chatId, session);
    return true;
  }

  // Emailed ride receipt: rider typed the address to send it to
  if (session.step === "awaiting_receipt_email") {
    const email = text.trim();
    if (!isValidEmail(email)) {
      await sendTelegramMessage(chatId, "That doesn't look like a valid email. Please type a valid address (e.g. name@example.com).");
      return true;
    }
    const rideId = session.receiptRideId;
    session.step = undefined;
    session.receiptRideId = undefined;
    if (!rideId) {
      await sendTelegramMessage(chatId, "Sorry, I lost track of which trip to send. Open your trip and tap the receipt button again.");
      return true;
    }
    // Save the address so future receipts go out automatically.
    if (session.userId) {
      try {
        await storage.updateUser(session.userId, { email });
      } catch (error) {
        console.error("[TelegramRider] save receipt email error:", error);
      }
    }
    await sendTelegramMessage(chatId, "Sending your receipt...");
    const ok = await emailRideReceipt(rideId, email, firstName);
    await sendTelegramMessage(
      chatId,
      ok
        ? `Done — your receipt is on its way to <b>${email}</b>.`
        : "Sorry, I couldn't send the email right now. Please try again later.",
    );
    return true;
  }

  // Hubs / coffee-pickup: typed location instead of sharing
  if (session.step === "awaiting_hub_loc" || session.step === "awaiting_coffee_hub_loc") {
    const wasCoffee = session.step === "awaiting_coffee_hub_loc";
    await sendTelegramMessage(chatId, "Looking up that location...");
    const loc = await geocodeAddress(text);
    if (!loc) {
      await sendTelegramMessage(
        chatId,
        "I couldn't find that place. Try adding the city/area, or tap the button to share your location.",
        { reply_markup: shareHubLocationKeyboard } as any,
      );
      return true;
    }
    session.step = undefined;
    if (wasCoffee) {
      await listCoffeeHubs(chatId, session, loc.lat, loc.lng);
    } else {
      await listHubsNearby(chatId, session, loc.lat, loc.lng);
    }
    return true;
  }

  if (session.step === "awaiting_pickup") {
    await sendTelegramMessage(chatId, "Please tap the button to share your pickup location.", {
      reply_markup: sharePickupKeyboard,
    } as any);
    return true;
  }
  if (session.step === "awaiting_destination") {
    if (!session.pickup) {
      session.step = "awaiting_pickup";
      await sendTelegramMessage(chatId, "Let's set your pickup first.", { reply_markup: sharePickupKeyboard } as any);
      return true;
    }
    await sendTelegramMessage(chatId, "Searching the map for that destination...");
    const matches = await searchAddresses(text, session.pickup, 5);
    if (matches.length === 0) {
      await sendTelegramMessage(
        chatId,
        "I couldn't find that place. Try adding the city or area, or share it as a location: tap the attachment (clip) icon, choose Location, and send the spot.",
      );
      return true;
    }
    if (matches.length === 1) {
      await setTelegramDestination(chatId, session, matches[0]);
      return true;
    }
    await offerDestinationChoices(chatId, session, matches);
    return true;
  }

  // Plain text from a rider with an active trip -> chat to driver
  if (!session.userId) {
    const user = await getUserByChatId(chatId);
    if (user) session.userId = user.id;
  }
  if (session.userId) {
    const bridged = await bridgeRiderMessageToDriver(chatId, session, text);
    if (bridged) return true;
  }

  return false;
}

function publicBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  if (process.env.EXPO_PUBLIC_DOMAIN) return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  return "http://localhost:5000";
}

/**
 * Mint a hosted NOWPayments invoice so a Telegram rider can settle a crypto
 * (USDT) ride from their wallet. Returns the pay URL, or null if crypto can't be
 * offered for this fare (provider unavailable, or the amount is below the crypto
 * network minimum). The orderId is `ride_<rideId>_...` so the existing
 * /api/payments/nowpayments/ipn handler reconciles it on payment.
 */
async function createRideCryptoInvoice(rideId: string, fare: number, currency: string): Promise<string | null> {
  try {
    const minUsdt = await nowPaymentsService.getMinimumPaymentAmount("usdttrc20").catch(() => 1);
    // Convert the local-currency fare to USDT via NOWPayments' own rates so the
    // minimum-amount gate is correct in every region (AED, BDT, PKR, ...) rather
    // than assuming an AED-pegged 3.67 divisor.
    const estimatedUsdt = await nowPaymentsService
      .getEstimatedCryptoAmount(fare, currency, "usdttrc20")
      .catch(() => null);
    if (estimatedUsdt !== null && estimatedUsdt < minUsdt) return null;

    const baseUrl = publicBaseUrl();
    const invoice = await nowPaymentsService.createInvoice({
      price: fare,
      currency: currency.toLowerCase(),
      orderId: `ride_${rideId}_${Date.now()}`,
      description: `Travony ride payment ${rideId.slice(0, 8)}`,
      callbackUrl: `${baseUrl}/api/payments/nowpayments/ipn`,
      successUrl: `${baseUrl}/payment-success?type=usdt`,
      cancelUrl: `${baseUrl}/payment-cancelled`,
    });
    return invoice?.invoice_url || null;
  } catch (error) {
    console.error("[TelegramRider] crypto invoice error:", error);
    return null;
  }
}

/**
 * Tell a Telegram rider their up-front crypto payment landed and we're now
 * dispatching. Called from the NOWPayments IPN once the ride is released.
 */
export async function notifyRiderPaymentConfirmed(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const rider = await storage.getUser(ride.customerId);
    if (!rider?.telegramChatId) return;
    await sendTelegramMessage(
      rider.telegramChatId,
      "<b>Payment received — thank you!</b>\nWe're finding you a driver now. You'll get a message here the moment one accepts.",
    );
  } catch (error) {
    console.error("[TelegramRider] notifyRiderPaymentConfirmed error:", error);
  }
}

/**
 * Tell a Telegram rider their crypto payment arrived AFTER the ride had already
 * expired (no driver was assigned in time), so it won't be dispatched.
 */
export async function notifyRiderPaymentExpired(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const rider = await storage.getUser(ride.customerId);
    if (!rider?.telegramChatId) return;
    await sendTelegramMessage(
      rider.telegramChatId,
      "<b>We received your payment, but this ride had already expired</b> before a driver was assigned.\n\nPlease contact support to arrange a refund, or type /book to start a new ride.",
    );
  } catch (error) {
    console.error("[TelegramRider] notifyRiderPaymentExpired error:", error);
  }
}

/**
 * Push a ride status update to the rider's Telegram chat (if they booked via Telegram).
 */
export async function notifyRiderRideUpdate(rideId: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const rider = await storage.getUser(ride.customerId);
    if (!rider?.telegramChatId) return;

    let text: string | null = null;
    switch (ride.status) {
      case "accepted": {
        let driverInfo = "";
        if (ride.driverId) {
          const driver = await storage.getDriver(ride.driverId);
          const [veh] = driver ? await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1) : [];
          const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
          const carDesc = veh ? `${veh.color ? veh.color + " " : ""}${veh.make || ""} ${veh.model || ""}`.trim() : "";
          driverInfo = `\n\nDriver: ${driverUser?.name || "Assigned"}`;
          if (carDesc) driverInfo += `\nCar: ${carDesc}`;
          if (veh?.plateNumber) driverInfo += `\nPlate: <code>${veh.plateNumber}</code>`;
        }
        text = `<b>Driver confirmed — on the way</b>${driverInfo}\n\nPickup code: <code>${ride.otp}</code>\nShow it to your driver when you board.\n\nNeed to reach them? Just type a message here.`;
        break;
      }
      case "arriving":
        text = "<b>Your driver is almost there</b>\nPlease start making your way to the pickup point.";
        break;
      case "started":
      case "in_progress":
        text = "<b>Trip started</b>\nSit back and enjoy the ride. Your receipt will appear here when you arrive.";
        break;
      case "completed": {
        const total = parseFloat(ride.actualFare || ride.estimatedFare || "0");
        // Use the ride's own region (persisted at booking) so the receipt shows
        // local currency and the correct platform fee % (e.g. BD = 5%, not 10%).
        const cmplRegion = await getRegionByCode(ride.regionCode || "AE").catch(() => null);
        const fees = calculateFeeBreakdown(total, cmplRegion ? cmplRegion.platformFeePercent : 10);
        const cur = ride.currency || "AED";
        const receipt = ride.id.slice(0, 8).toUpperCase();
        const when = formatDateTime(ride.completedAt || new Date());

        let driverBlock = "";
        if (ride.driverId) {
          const driver = await storage.getDriver(ride.driverId);
          const [veh] = driver ? await db.select().from(vehicles).where(eq(vehicles.driverId, driver.id)).limit(1) : [];
          const driverUser = driver ? await storage.getUser(driver.userId) : undefined;
          const carDesc = veh ? `${veh.color ? veh.color + " " : ""}${veh.make || ""} ${veh.model || ""}`.trim() : "";
          driverBlock = `\n<b>Driver</b>\n${driverUser?.name || "Driver"}`;
          if (carDesc) driverBlock += `\n${carDesc}${veh?.plateNumber ? ` · ${veh.plateNumber}` : ""}`;
          driverBlock += "\n";
        }

        const distLine = ride.distance ? `Distance: ${parseFloat(ride.distance).toFixed(1)} km\n` : "";
        const durLine = ride.duration ? `Duration: ~${ride.duration} min\n` : "";

        const isCrypto = (ride as any).paymentMethod === "usdt";
        // Up-front crypto rides are already settled (paymentStatus "paid" set by
        // the NOWPayments IPN before dispatch), so just confirm it. Legacy/app
        // usdt rides that weren't prepaid still get a hosted pay link to settle.
        const cryptoPaid = isCrypto && (ride as any).paymentStatus === "paid";
        let cryptoPayUrl: string | null = null;
        if (isCrypto && !cryptoPaid && total > 0) {
          cryptoPayUrl = await createRideCryptoInvoice(ride.id, total, ride.currency || "AED").catch(() => null);
        }

        const methodLine = !isCrypto
          ? "Method: Cash (paid to your driver)"
          : cryptoPaid
            ? "Method: Crypto (USDT) — paid"
            : (cryptoPayUrl
                ? "Method: Crypto (USDT) — tap below to pay securely"
                : "Method: Crypto (USDT) — pay link unavailable right now, please contact support to settle");

        text = `<b>Trip completed — thank you!</b>
Receipt <code>#${receipt}</code>

<b>Trip</b>
From: ${ride.pickupAddress}
To: ${ride.dropoffAddress}
${distLine}${durLine}Date: ${when}
${driverBlock}
<b>Payment</b>
Total fare: <b>${cur} ${total.toFixed(2)}</b>
Driver earnings (${fees.driverSharePercent}%): ${cur} ${fees.driverShare.toFixed(2)}
Platform fee (${fees.platformFeePercent}%): ${cur} ${fees.platformFee.toFixed(2)}
${methodLine}

We hope you enjoyed the ride. Type /book to ride again.`;

        const completedButtons: any[][] = [];
        if (cryptoPayUrl) {
          completedButtons.push([{ text: `Pay ${cur} ${total.toFixed(2)} with crypto`, url: cryptoPayUrl }]);
        }
        completedButtons.push([{ text: "Email me this receipt", callback_data: `r:rcpt:${ride.id}` }]);

        await sendTelegramMessage(rider.telegramChatId, text, {
          reply_markup: { inline_keyboard: completedButtons },
        } as any);
        return;
      }
      case "cancelled":
        text = "<b>Ride cancelled</b>\nNo in-app charge was processed. If your trip had already started, please settle any cash owed directly with your driver. Type /book whenever you need another ride.";
        break;
    }
    if (text) {
      await sendTelegramMessage(rider.telegramChatId, text);
    }
  } catch (error) {
    console.error("[TelegramRider] notifyRiderRideUpdate error:", error);
  }
}

/**
 * Push a coffee order status update to the orderer's Telegram chat (if they
 * ordered via Telegram). Wired from the coffee REST routes on accept/status/cancel.
 */
export async function notifyCoffeeOrderUpdate(orderId: string): Promise<void> {
  try {
    const [order] = await db.select().from(coffeeOrders).where(eq(coffeeOrders.id, orderId));
    if (!order) return;
    const orderer = await storage.getUser(order.ordererId);
    if (!orderer?.telegramChatId) return;

    const ref = order.id.slice(0, 8).toUpperCase();
    const itemLine = `${order.quantity} × ${order.coffeeName} (${order.coffeeSize})`;
    let text: string | null = null;

    switch (order.status) {
      case "accepted":
        text = `<b>A driver accepted your coffee order</b>\nOrder <code>#${ref}</code>\n${itemLine}\n\nThey're getting it ready now.`;
        break;
      case "preparing":
        text = `<b>Your order is being prepared</b>\nOrder <code>#${ref}</code>\n${itemLine}`;
        break;
      case "ready":
        text = order.orderType === "buy"
          ? `<b>Your order is ready for pickup</b>\nOrder <code>#${ref}</code>\n${itemLine}\nCollect it at ${order.pickupAddress || "the hub"}.`
          : `<b>Your order is ready</b>\nOrder <code>#${ref}</code>\n${itemLine}`;
        break;
      case "picked_up":
        text = `<b>Your coffee is picked up</b>\nOrder <code>#${ref}</code>\n${itemLine}\nA driver has it and is heading out.`;
        break;
      case "delivering":
        text = `<b>Your coffee is on the way</b>\nOrder <code>#${ref}</code>\n${itemLine}\nIt'll reach you shortly.`;
        break;
      case "delivered": {
        const total = parseFloat(order.totalAmount || "0");
        text = `<b>Order completed — enjoy!</b>\nOrder <code>#${ref}</code>\n${itemLine}\nTotal: AED ${total.toFixed(2)}\n\nType /coffee to order again.`;
        break;
      }
      case "cancelled":
        text = `<b>Coffee order cancelled</b>\nOrder <code>#${ref}</code>\nNo charge applied. Type /coffee to order again.`;
        break;
    }

    if (text) {
      await sendTelegramMessage(orderer.telegramChatId, text);
    }
  } catch (error) {
    console.error("[TelegramRider] notifyCoffeeOrderUpdate error:", error);
  }
}

/**
 * Push a driver's chat message to the rider's Telegram chat.
 */
export async function pushDriverMessageToRider(rideId: string, translatedMessage: string): Promise<void> {
  try {
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const rider = await storage.getUser(ride.customerId);
    if (!rider?.telegramChatId) return;
    await sendTelegramMessage(rider.telegramChatId, `<b>Message from your driver</b>\n${translatedMessage}`);
  } catch (error) {
    console.error("[TelegramRider] pushDriverMessageToRider error:", error);
  }
}
