/**
 * Booking Brain — the channel-agnostic core every rider channel shares.
 *
 * Telegram, WhatsApp, and the zero-install /ride web page all book through
 * these functions so pricing, region/fee derivation, driver matching, ride
 * creation, and broadcast behave identically no matter where the request
 * came from. Channel adapters own ONLY their UI (buttons, message formats,
 * session steps) — money math and ride writes live here.
 *
 * Invariants enforced here (do not weaken in adapters):
 * - Fares are engine-computed (calculateOptimalPrice). No LLM ever authors a
 *   number that reaches a rider.
 * - Region, currency and fee % are derived server-side from pickup coords.
 * - Every non-crypto pending ride is broadcast via notifyOnlineDriversOfNewRide.
 * - Crypto (usdt) rides are held out of the pool (awaiting_payment) and are
 *   NOT broadcast here — the NOWPayments IPN releases them.
 */
import { db } from "./db";
import { users, drivers, rides } from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { storage } from "./storage";
import { calculateOptimalPrice } from "./aiEngine";
import * as intentEngine from "./intentEngine";
import { generateRideHash, calculateFeeBreakdown } from "./blockchain";
import { notifyOnlineDriversOfNewRide } from "./rideNotifications";
import { randomUUID, randomBytes } from "crypto";
import { getRegionByCode, detectRegionFromCoordinates } from "./regionService";

export interface Place {
  lat: number;
  lng: number;
  address: string;
}

export interface FareEstimate {
  id: string; // service type id (st-*)
  type: string; // vehicle type (economy/comfort/...)
  label: string;
  fare: number;
}

export interface RideQuote {
  regionCode: string;
  currency: string;
  feePercent: number;
  distanceKm: number;
  durationMin: number;
  estimates: FareEstimate[]; // cheapest first
}

export interface DriverMatch {
  driverId: string;
  matchType: string;
  aiMatchScore: string;
  intentAlignmentScore?: string;
  distanceKm: number;
}

export const ACTIVE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"];
export const ENGAGED_RIDE_STATUSES = ["accepted", "arriving", "started", "in_progress"];
export const CANCELLABLE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"];

// Car types offered to riders (mapped to seeded service_types)
export const CAR_TYPES: { id: string; type: string; label: string }[] = [
  { id: "st-economy", type: "economy", label: "Economy" },
  { id: "st-comfort", type: "comfort", label: "Comfort" },
  { id: "st-xl", type: "xl", label: "XL (larger group)" },
  { id: "st-premium", type: "premium", label: "Premium" },
];

// Maps a region's vehicle type to a valid backend service-type id. The brain
// creates rides via storage.createRide directly (bypassing the HTTP route's
// serviceTypeId normalization), so the id must already be a valid st-* value.
const SERVICE_TYPE_BY_VEHICLE: Record<string, string> = {
  economy: "st-economy", comfort: "st-comfort", premium: "st-premium", xl: "st-xl",
  cng: "st-economy", rickshaw: "st-economy", tuktuk: "st-economy", moto: "st-economy", minibus: "st-xl",
};
export function serviceTypeIdForVehicle(type: string): string {
  return SERVICE_TYPE_BY_VEHICLE[type] || "st-economy";
}

export function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function etaFromDistanceKm(distanceKm: number): number {
  // City-speed estimate (~25 km/h), floored at 2 minutes.
  return Math.max(2, Math.round((distanceKm / 25) * 60));
}

// ---------------------------------------------------------------------------
// Geocoding / place search (Google-first, Nominatim fallback)
// ---------------------------------------------------------------------------

async function searchAddressesGoogle(
  query: string,
  key: string,
  near?: { lat: number; lng: number },
  limit = 5,
): Promise<Place[]> {
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
    const out: Place[] = [];
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
    console.error("[BookingBrain] Google search error:", error);
    return [];
  }
}

/**
 * Search a typed place name and return up to `limit` matching map locations so
 * the rider can pick the exact one — autocomplete instead of silently guessing
 * the first hit. Biased toward the rider's area when provided.
 */
export async function searchPlaces(
  query: string,
  near?: { lat: number; lng: number },
  limit = 5,
): Promise<Place[]> {
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
      const d = 0.6; // ~60km box to prefer nearby results
      params.set("viewbox", `${near.lng - d},${near.lat - d},${near.lng + d},${near.lat + d}`);
    }
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "User-Agent": "Travony/1.0 (ride booking)", "Accept-Language": "en" },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    if (!Array.isArray(data)) return [];
    const out: Place[] = [];
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
    console.error("[BookingBrain] search error:", error);
    return [];
  }
}

/**
 * Turn raw GPS coordinates (e.g. a pinned/shared location) into a readable
 * street address so the driver sees a real place name, not "Pinned location".
 */
export async function reverseGeocodePoint(lat: number, lng: number): Promise<string | null> {
  const googleKey = process.env.GOOGLE_API_KEY;
  if (googleKey) {
    try {
      const gp = new URLSearchParams({ latlng: `${lat},${lng}`, key: googleKey, language: "en" });
      const gr = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${gp.toString()}`);
      if (gr.ok) {
        const gd: any = await gr.json();
        const first = Array.isArray(gd?.results) ? gd.results[0] : undefined;
        if (first?.formatted_address) return first.formatted_address as string;
      }
    } catch (error) {
      console.error("[BookingBrain] Google reverse geocode error:", error);
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
    console.error("[BookingBrain] reverse geocode error:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Quoting (the Price Oracle) — engine-computed, no auth required
// ---------------------------------------------------------------------------

/**
 * Full quote for a route: region/currency/fee derived from PICKUP coords
 * (server-authoritative), per-vehicle engine-computed fares, cheapest first.
 * Works with no user account — this is the free Price Oracle every channel
 * exposes.
 */
export async function getQuote(
  pickup: { lat: number; lng: number },
  dropoff: { lat: number; lng: number },
): Promise<RideQuote> {
  const regionCode = detectRegionFromCoordinates(pickup.lat, pickup.lng);
  const region = await getRegionByCode(regionCode).catch(() => null);
  const currency = region?.currency || "AED";
  const feePercent = region ? region.platformFeePercent : 10;
  const distanceKm = calculateDistanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const durationMin = Math.round(distanceKm * 3 + 5);

  // Use the region's own vehicle line-up (e.g. Bangladesh's Easy Bike / CNG
  // Auto) so budget markets see their cheap three-wheelers.
  const lineup = region?.vehicleTypes?.length
    ? region.vehicleTypes.map((v: any) => ({ id: serviceTypeIdForVehicle(v.type), type: v.type, label: v.localName }))
    : CAR_TYPES;
  const estimates: FareEstimate[] = [];
  for (const car of lineup) {
    try {
      const pricing = await calculateOptimalPrice(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, car.type, regionCode);
      estimates.push({ id: car.id, type: car.type, label: car.label, fare: pricing.total });
    } catch (error) {
      console.error(`[BookingBrain] Price error for ${car.type}:`, error);
    }
  }
  estimates.sort((a, b) => a.fare - b.fare);

  return { regionCode, currency, feePercent, distanceKm, durationMin, estimates };
}

/**
 * Plain-text shareable price card (WhatsApp / Telegram / SMS). All numbers
 * come from the engine-computed quote. `bookUrl` is appended as the one-tap
 * booking link.
 */
export function buildPriceCardText(
  quote: RideQuote,
  fromAddress: string,
  toAddress: string,
  bookUrl?: string,
): string {
  const lines: string[] = [];
  lines.push(`Travony price check`);
  lines.push(``);
  lines.push(`From: ${fromAddress}`);
  lines.push(`To: ${toAddress}`);
  lines.push(`Distance: ~${quote.distanceKm.toFixed(1)} km · about ${quote.durationMin} min`);
  lines.push(``);
  for (const e of quote.estimates) {
    lines.push(`${e.label}: ${quote.currency} ${e.fare.toFixed(2)}`);
  }
  lines.push(``);
  lines.push(`Fares are live estimates — no booking needed to check.`);
  if (bookUrl) lines.push(`Book in one tap: ${bookUrl}`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Accounts: phone == account
// ---------------------------------------------------------------------------

export function normalizePhone(rawPhone: string): string {
  const digits = rawPhone.replace(/[^0-9]/g, "");
  return `+${digits}`;
}

export async function findUserByPhone(rawPhone: string) {
  const digits = rawPhone.replace(/[^0-9]/g, "");
  const candidates = Array.from(new Set([rawPhone, `+${digits}`, digits]));
  for (const candidate of candidates) {
    const user = await storage.getUserByPhone(candidate);
    if (user) return user;
  }
  return undefined;
}

/**
 * Find or auto-provision a customer account keyed on the phone number. Used
 * by channels where the phone IS the identity (WhatsApp). `channel` decides
 * the synthetic email domain so receipts know it's a placeholder.
 */
export async function ensureUserByPhone(
  rawPhone: string,
  name?: string,
  channel: "whatsapp" | "link" | "agent" = "whatsapp",
): Promise<any> {
  const existing = await findUserByPhone(rawPhone);
  if (existing) return existing;
  const phone = normalizePhone(rawPhone);
  const digits = phone.replace(/[^0-9]/g, "");
  const prefix = channel === "whatsapp" ? "wa" : channel === "agent" ? "agent" : "link";
  const domain = `${prefix === "wa" ? "wa" : prefix}.travony`;
  const user = await storage.createUser({
    email: `${prefix}_${digits}@${domain}`,
    password: randomBytes(24).toString("hex"), // unusable placeholder; login is OTP-only
    name: name || "Travony rider",
    phone,
    role: "customer",
  } as any);
  return user;
}

// A synthetic address provisioned by a chat channel — receipts can only be
// emailed once the rider supplies a real one.
export function isPlaceholderEmail(email?: string | null): boolean {
  return (
    !email ||
    email.endsWith("@telegram.travony") ||
    email.endsWith("@wa.travony") ||
    email.endsWith("@link.travony") ||
    email.endsWith("@agent.travony") ||
    email.endsWith("@travony.local") ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  );
}

// ---------------------------------------------------------------------------
// Ride lookups shared by every channel
// ---------------------------------------------------------------------------

export async function getActiveRideForUser(userId: string) {
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
export async function getEngagedRideForUser(userId: string) {
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
export async function cancelPendingRidesForUser(userId: string): Promise<void> {
  const pendings = await db
    .select()
    .from(rides)
    .where(and(eq(rides.customerId, userId), eq(rides.status, "pending")));
  for (const r of pendings) {
    try {
      await storage.updateRide(r.id, { status: "cancelled", cancelledAt: new Date() });
    } catch (error) {
      console.error("[BookingBrain] cancel stale pending ride error:", error);
    }
  }
}

/** Cancel every cancellable ride for a user. Returns how many were cancelled. */
export async function cancelActiveRidesForUser(userId: string): Promise<number> {
  const active = await db
    .select()
    .from(rides)
    .where(and(eq(rides.customerId, userId), inArray(rides.status, CANCELLABLE_RIDE_STATUSES as any)));
  let n = 0;
  for (const r of active) {
    try {
      await storage.updateRide(r.id, { status: "cancelled", cancelledAt: new Date() });
      n++;
    } catch (error) {
      console.error("[BookingBrain] cancel ride error:", error);
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Driver matching — identical to the app's POST /api/rides
// ---------------------------------------------------------------------------

/**
 * Match a driver exactly the way the main app's POST /api/rides does, so a
 * channel booking is assigned identically to an in-app booking — and only to
 * an online, APPROVED driver whose T Driver app is actively polling.
 */
export async function matchDriverLikeApp(
  userId: string,
  pickupLat: number,
  pickupLng: number,
  dropoffLat: number,
  dropoffLng: number,
  priority: "fastest" | "cheapest" | "reliable" = "reliable",
): Promise<DriverMatch | null> {
  // 1) Intent-based matching (same engine the app uses). The intent engine
  // filters on isOnline but not approval status, so re-check approval here.
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
      console.log(`[BookingBrain] intent match ${best.driverId} not approved — using proximity fallback`);
    }
  } catch (error) {
    console.error("[BookingBrain] intent match error:", error);
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
    console.error("[BookingBrain] proximity match error:", error);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Ride creation — the one shared write path for chat/link channels
// ---------------------------------------------------------------------------

export class EngagedRideError extends Error {
  ride: any;
  constructor(ride: any) {
    super("User already has an engaged ride");
    this.name = "EngagedRideError";
    this.ride = ride;
  }
}

export interface CreateBrainRideInput {
  userId: string;
  pickup: Place;
  dropoff: Place;
  /** Chosen estimate (from getQuote) — its fare is the engine-computed one. */
  choice: FareEstimate;
  quote: Pick<RideQuote, "regionCode" | "currency" | "feePercent" | "distanceKm" | "durationMin">;
  paymentMethod?: "cash" | "usdt";
  /** Generate a public shareToken for the ride (link-channel tracking pages). */
  withShareToken?: boolean;
  channel: "telegram" | "whatsapp" | "link" | "agent";
  /** Use this exact ride id (must be a fresh UUID) — lets callers persist a
   *  durable intent → ride binding BEFORE the ride exists. */
  presetRideId?: string;
}

export interface CreateBrainRideResult {
  ride: any;
  match: DriverMatch | null;
  matchedEtaMin?: number;
  /** Display info for the matched driver, when one was found. */
  driverInfo?: { name: string; carDesc: string; plate?: string };
}

/**
 * Create a ride exactly like the Telegram bot / app flow:
 * stale-ride expiry → engaged-ride guard (throws EngagedRideError) → clear
 * leftover pendings → fee breakdown → driver match → blockchain hash →
 * insert (status pending) → broadcast to ALL online approved drivers
 * (unless usdt, which waits for the payment IPN).
 */
export async function createBrainRide(input: CreateBrainRideInput): Promise<CreateBrainRideResult> {
  const { userId, pickup, dropoff, choice, quote, channel } = input;
  const paymentMethod = input.paymentMethod || "cash";

  // Serialize bookings per user with a transaction-scoped advisory lock so a
  // double-submitted web form or a retried webhook can never slip two rides
  // past the engaged-ride guard concurrently. The guard/cancel/insert below
  // run while the lock is held; a competing call blocks here until this one's
  // writes are committed and therefore sees them.
  return await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);

  await storage.expireStaleRides().catch(() => {});
  const engaged = await getEngagedRideForUser(userId);
  if (engaged) throw new EngagedRideError(engaged);
  await cancelPendingRidesForUser(userId);

  const fare = choice.fare;
  const fees = calculateFeeBreakdown(fare, quote.feePercent ?? 10);
  const distanceKm = quote.distanceKm ?? calculateDistanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const durationMin = quote.durationMin ?? Math.round(distanceKm * 3 + 5);

  let intentData: Record<string, any> = {};
  let matchedEtaMin: number | undefined;
  const match = await matchDriverLikeApp(userId, pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, "reliable");
  if (match) {
    intentData = {
      driverId: match.driverId,
      matchType: match.matchType,
      aiMatchScore: match.aiMatchScore,
      ...(match.intentAlignmentScore ? { intentAlignmentScore: match.intentAlignmentScore } : {}),
    };
    matchedEtaMin = etaFromDistanceKm(match.distanceKm);
  }

  // Pre-generate the ride id so the blockchain hash matches the stored row.
  // Callers may supply presetRideId to bind the ride to a prior durable intent
  // (Agent Gateway idempotency recovery relies on this exact correlation).
  const rideId = input.presetRideId || randomUUID();
  const blockchainHash = generateRideHash({
    rideId,
    customerId: userId,
    driverId: intentData.driverId || "pending",
    pickupAddress: pickup.address,
    dropoffAddress: dropoff.address,
    fare,
    platformFee: fees.platformFee,
    driverShare: fees.driverShare,
    timestamp: new Date(),
  } as any);

  const ride = await storage.createRide({
    id: rideId,
    customerId: userId,
    serviceTypeId: choice.id,
    pickupAddress: pickup.address,
    pickupLat: pickup.lat.toString(),
    pickupLng: pickup.lng.toString(),
    dropoffAddress: dropoff.address,
    dropoffLat: dropoff.lat.toString(),
    dropoffLng: dropoff.lng.toString(),
    status: "pending",
    estimatedFare: fare.toFixed(2),
    distance: distanceKm.toFixed(2),
    duration: durationMin,
    paymentMethod,
    paymentStatus: paymentMethod === "usdt" ? "awaiting_payment" : "pending",
    platformFee: fees.platformFee.toFixed(2),
    driverEarnings: fees.driverShare.toFixed(2),
    blockchainHash,
    currency: quote.currency || "AED",
    regionCode: quote.regionCode || "AE",
    riderPriority: "reliable",
    ...(input.withShareToken ? { shareToken: `share_${randomUUID().replace(/-/g, "").substring(0, 16)}` } : {}),
    ...intentData,
  } as any);

  // Matched-driver display info for the confirmation message/screen.
  let driverInfo: CreateBrainRideResult["driverInfo"];
  if (intentData.driverId) {
    try {
      const driver = await storage.getDriver(intentData.driverId);
      if (driver) {
        const driverUser = await storage.getUser(driver.userId);
        const vehiclesList = await storage.getVehiclesByDriver(driver.id);
        const vehicle = vehiclesList?.[0];
        driverInfo = {
          name: driverUser?.name || "Your driver",
          carDesc: vehicle
            ? `${vehicle.color ? vehicle.color + " " : ""}${vehicle.make} ${vehicle.model}`.trim()
            : choice.label,
          plate: vehicle?.plateNumber || undefined,
        };
      }
    } catch (error) {
      console.error("[BookingBrain] driver info lookup error:", error);
    }
  }

  // Broadcast to EVERY approved + online driver — pending-rides is a broadcast
  // model. Crypto rides wait for the payment IPN instead.
  if (paymentMethod !== "usdt") {
    await notifyOnlineDriversOfNewRide(ride.id).catch((error) =>
      console.error(`[BookingBrain:${channel}] broadcast notify error:`, error),
    );
  }

  return { ride, match, matchedEtaMin, driverInfo };
  });
}

// ---------------------------------------------------------------------------
// Status text shared by chat channels
// ---------------------------------------------------------------------------

/** Human status summary for a ride — used by WhatsApp / status queries. */
export async function describeRideStatusText(ride: any): Promise<string> {
  const cur = ride.currency || "AED";
  let driverLine = "";
  if (ride.driverId) {
    try {
      const driver = await storage.getDriver(ride.driverId);
      if (driver) {
        const driverUser = await storage.getUser(driver.userId);
        const vehiclesList = await storage.getVehiclesByDriver(driver.id);
        const vehicle = vehiclesList?.[0];
        const car = vehicle ? `${vehicle.color ? vehicle.color + " " : ""}${vehicle.make} ${vehicle.model}`.trim() : "";
        driverLine = `\nDriver: ${driverUser?.name || "Assigned"}${car ? ` · ${car}` : ""}${vehicle?.plateNumber ? ` · Plate ${vehicle.plateNumber}` : ""}`;
      }
    } catch {}
  }
  const base = `From: ${ride.pickupAddress}\nTo: ${ride.dropoffAddress}\nFare: ${cur} ${Number(ride.estimatedFare || 0).toFixed(2)}${driverLine}`;
  switch (ride.status) {
    case "pending":
      return `Looking for your driver...\n\n${base}\n\nPickup code: ${ride.otp}`;
    case "accepted":
    case "arriving":
      return `Your driver is on the way!\n\n${base}\n\nPickup code: ${ride.otp} — show it when you board.`;
    case "started":
    case "in_progress":
      return `Trip in progress.\n\n${base}`;
    case "completed":
      return `Trip completed. Total: ${cur} ${Number(ride.actualFare || ride.estimatedFare || 0).toFixed(2)}. Thanks for riding with Travony!`;
    case "cancelled":
      return `That ride was cancelled.`;
    default:
      return base;
  }
}

// ---------------------------------------------------------------------------
// Lightweight intent parsing (deterministic — no LLM in the money path)
// ---------------------------------------------------------------------------

export type ParsedIntent =
  | { kind: "price"; from?: string; to: string }
  | { kind: "book"; from?: string; to: string }
  | { kind: "status" }
  | { kind: "cancel" }
  | { kind: "help" }
  | { kind: "unknown" };

/**
 * Deterministic parse of a rider's free-text message. Handles the Price
 * Oracle ("how much from X to Y"), booking ("ride to X [from Y]"), status
 * and cancel. Purely regex-based so replies stay template-built with
 * engine numbers only.
 */
export function parseRiderText(raw: string): ParsedIntent {
  const text = raw.trim();
  const lower = text.toLowerCase();

  if (/^(help|menu|start|hi|hello|hey|salam|hola)\b/.test(lower)) return { kind: "help" };
  if (/\b(cancel|stop the ride|cancel ride|cancel my ride)\b/.test(lower)) return { kind: "cancel" };
  if (/\b(status|where is my (ride|driver|car)|my trip|mytrip|my ride)\b/.test(lower)) return { kind: "status" };

  // Price oracle: "how much from X to Y", "price from X to Y",
  // "fare from X to Y", "how much to Y from X", "how much to Y"
  const PRICE_HEAD = "(?:how much|price|quote|fare|cost)(?:\\s+is(?:\\s+it)?)?(?:\\s+for\\s+a\\s+ride)?";
  const priceFromTo = text.match(new RegExp(`^${PRICE_HEAD}\\s+from\\s+(.+?)\\s+to\\s+(.+?)\\s*\\??$`, "i"));
  if (priceFromTo) return { kind: "price", from: priceFromTo[1].trim(), to: priceFromTo[2].trim() };
  const priceToFrom = text.match(new RegExp(`^${PRICE_HEAD}\\s+to\\s+(.+?)\\s+from\\s+(.+?)\\s*\\??$`, "i"));
  if (priceToFrom) return { kind: "price", from: priceToFrom[2].trim(), to: priceToFrom[1].trim() };
  const priceTo = text.match(new RegExp(`^${PRICE_HEAD}\\s+to\\s+(.+?)\\s*\\??$`, "i"));
  if (priceTo) return { kind: "price", to: priceTo[1].trim() };

  // Booking: "ride to X from Y" / "book a ride to X" / "take me to X" /
  // "go to X" / "I need a ride to X"
  const bookMatch =
    text.match(/^(?:book(?:\s+a)?\s+ride|ride|take me|go|i need a ride|need a ride|get me)\s+to\s+(.+?)(?:\s+from\s+(.+?))?\s*\??$/i);
  if (bookMatch) {
    return { kind: "book", to: bookMatch[1].trim(), ...(bookMatch[2] ? { from: bookMatch[2].trim() } : {}) };
  }

  return { kind: "unknown" };
}
