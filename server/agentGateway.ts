import { Router, type Request, type Response } from "express";
import { createHash, createHmac, createPrivateKey, createPublicKey, randomBytes, randomUUID, sign as edSign } from "crypto";
import { db } from "./db";
import { agentBookings, agentWebhooks, agentWebhookDeliveries, apiKeys, rides } from "@shared/schema";
import { eq, and, desc, gte, lte, sql, inArray } from "drizzle-orm";
import { requirePartner, getPlanTier } from "./partnerApi";
import {
  getQuote,
  createBrainRide,
  ensureUserByPhone,
  normalizePhone,
  EngagedRideError,
  type RideQuote,
  type FareEstimate,
} from "./bookingBrain";
import { cancelRideAsRider, RIDER_CANCELLABLE_STATUSES } from "./rideLifecycle";
import { detectRegionFromCoordinates, getRegionByCode } from "./regionService";
import { storage } from "./storage";

/**
 * Agent Gateway — Travony as a tool for external AIs.
 *
 * ChatGPT, Alexa, in-car assistants and other agents book rides through five
 * deterministic tools: list_service_types, get_quote, book_ride,
 * get_ride_status, cancel_ride. Exposed twice over the same core:
 *
 *   REST  /api/partner/v1/agent/*   (OpenAPI spec at .../openapi.json)
 *   MCP   POST /mcp                 (JSON-RPC 2.0, streamable-HTTP style)
 *
 * Invariants:
 *  - All money fields are server-derived (quote → book re-derives everything
 *    from pickup coords; the agent never supplies a fare).
 *  - Bookings are idempotent per (API key, Idempotency-Key) — a retried tool
 *    call replays the stored response instead of creating a second ride.
 *  - Every booking carries the acting agent's identity (X-Agent-Id).
 *  - Per-key daily spend caps (approximate USD, cap-enforcement only).
 *  - Ride status transitions push signed webhooks (HMAC, Stripe-style header)
 *    with durable retries.
 *  - Completed bookings have an Ed25519 server-signed receipt anyone can
 *    verify against GET .../public-key.
 */

// ---------------------------------------------------------------------------
// Spend caps — approximate USD conversion used ONLY to enforce abuse caps.
// Never surfaced as a price to riders or agents; real money stays in the
// ride's own currency, engine-computed.
// ---------------------------------------------------------------------------

const FX_TO_USD: Record<string, number> = {
  USD: 1, AED: 0.2723, SAR: 0.2667, BDT: 0.0091, PKR: 0.0036, INR: 0.012,
  MXN: 0.059, EUR: 1.1, GBP: 1.3, EGP: 0.021, NGN: 0.00065, KES: 0.0077,
};

function toUsdApprox(amount: number, currency: string): number {
  const rate = FX_TO_USD[currency?.toUpperCase?.() || ""] ?? 1; // unknown → conservative 1:1
  return amount * rate;
}

const DEFAULT_DAILY_SPEND_CAP_USD: Record<string, number> = {
  free: 50,
  starter: 500,
  growth: 5000,
};

function dailySpendCapUsd(key: { planTier: string }, overrideCap: string | null | undefined): number {
  if (overrideCap != null) {
    const n = Number(overrideCap);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_DAILY_SPEND_CAP_USD[getPlanTier(key.planTier).id] ?? DEFAULT_DAILY_SPEND_CAP_USD.free;
}

// ---------------------------------------------------------------------------
// Receipt signing — deterministic Ed25519 keypair derived from SESSION_SECRET
// so it survives restarts/deploys without a new secret to manage. Publicly
// verifiable: anyone can check a receipt against GET .../public-key.
// ---------------------------------------------------------------------------

const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function receiptKeys() {
  const seed = createHash("sha256")
    .update(`travony-agent-receipts:${process.env.SESSION_SECRET || "dev-only-seed"}`)
    .digest();
  const privateKey = createPrivateKey({
    key: Buffer.concat([ED25519_PKCS8_PREFIX, seed]),
    format: "der",
    type: "pkcs8",
  });
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKeyPem: publicKey.export({ format: "pem", type: "spki" }).toString() };
}

const RECEIPT_KEYS = receiptKeys();

/** Stable stringify: objects get sorted keys so signatures are reproducible. */
function canonicalJson(value: any): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

function signReceipt(payload: Record<string, any>): { payload: any; canonical: string; signature: string; publicKey: string; algorithm: string } {
  const canonical = canonicalJson(payload);
  const signature = edSign(null, Buffer.from(canonical, "utf8"), RECEIPT_KEYS.privateKey).toString("base64");
  return {
    payload,
    canonical,
    signature,
    publicKey: RECEIPT_KEYS.publicKeyPem,
    algorithm: "Ed25519 over canonical JSON (sorted keys, UTF-8)",
  };
}

/** Coarse place summary — first address segment only, no exact coordinates. */
function coarsePlace(address: string | null | undefined): string {
  return String(address || "").split(",")[0].trim() || "Unknown";
}

// ---------------------------------------------------------------------------
// Core tool implementations (shared by REST + MCP)
// ---------------------------------------------------------------------------

function num(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parsePoint(raw: any, label: string): { lat: number; lng: number; address?: string } {
  const lat = num(raw?.lat);
  const lng = num(raw?.lng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    throw new ToolError("INVALID_COORDS", `${label} must include numeric lat/lng.`);
  }
  return { lat, lng, address: typeof raw?.address === "string" ? raw.address.slice(0, 200) : undefined };
}

export class ToolError extends Error {
  code: string;
  httpStatus: number;
  extra?: Record<string, any>;
  constructor(code: string, message: string, httpStatus = 400, extra?: Record<string, any>) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.extra = extra;
  }
}

function baseUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0] || process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "https://travony.replit.app";
}

async function coreListServiceTypes(args: { lat: any; lng: any }) {
  const p = parsePoint(args, "location");
  const regionCode = detectRegionFromCoordinates(p.lat, p.lng);
  const region = await getRegionByCode(regionCode).catch(() => null);
  const quote = await getQuote({ lat: p.lat, lng: p.lng }, { lat: p.lat + 0.045, lng: p.lng }); // ~5km probe for indicative fares
  return {
    regionCode,
    currency: region?.currency || quote.currency,
    serviceTypes: quote.estimates.map((e) => ({
      id: e.id,
      type: e.type,
      label: e.label,
      indicativeFare5km: e.fare,
    })),
    note: "indicativeFare5km is an engine-computed sample fare for a ~5km trip at this location. Use get_quote for a real route.",
  };
}

async function coreGetQuote(args: { pickup: any; dropoff: any }) {
  const pickup = parsePoint(args?.pickup, "pickup");
  const dropoff = parsePoint(args?.dropoff, "dropoff");
  const quote = await getQuote(pickup, dropoff);
  return {
    regionCode: quote.regionCode,
    currency: quote.currency,
    distanceKm: Number(quote.distanceKm.toFixed(2)),
    durationMin: quote.durationMin,
    options: quote.estimates.map((e) => ({ serviceTypeId: e.id, type: e.type, label: e.label, fare: e.fare })),
    disclaimer: "Fares are engine-computed at booking time from the pickup region. Quotes are live estimates.",
  };
}

interface KeyCtx { keyId: string; ownerId: string; planTier: string }

/** How long a pending intent may sit before a retry is allowed to rebook. */
const INTENT_STALE_MS = 2 * 60_000;

function buildBookingResponse(ride: any, extras: {
  serviceTypeId?: string; serviceTypeLabel?: string; agentId: string; idempotencyKey: string;
  driver?: { name: string; car: string; plate: string | null; etaMin: number | null } | null;
}) {
  return {
    rideId: ride.id,
    status: ride.status,
    fare: Number(ride.estimatedFare),
    currency: ride.currency,
    distanceKm: Number(ride.distance),
    serviceTypeId: extras.serviceTypeId ?? ride.rideType ?? undefined,
    serviceTypeLabel: extras.serviceTypeLabel ?? undefined,
    pickupOtp: ride.pickupOtp ?? ride.otp ?? undefined,
    trackingUrl: ride.shareToken ? `${baseUrl()}/track/${ride.shareToken}` : null,
    driver: extras.driver ?? null,
    agentId: extras.agentId,
    idempotencyKey: extras.idempotencyKey,
  };
}

async function coreBookRide(key: KeyCtx, agentId: string, args: any) {
  const idempotencyKey = String(args?.idempotencyKey || "").trim();
  if (!idempotencyKey || idempotencyKey.length > 128) {
    throw new ToolError("IDEMPOTENCY_KEY_REQUIRED", "Provide idempotencyKey (<=128 chars, unique per booking attempt). Retries with the same key return the same booking.", 400);
  }
  const riderPhone = String(args?.riderPhone || "").replace(/[^0-9+]/g, "");
  if (riderPhone.replace(/[^0-9]/g, "").length < 8) {
    throw new ToolError("RIDER_PHONE_REQUIRED", "riderPhone (E.164, e.g. +9715...) is required — it identifies the rider the agent is booking for.", 400);
  }
  const pickup = parsePoint(args?.pickup, "pickup");
  const dropoff = parsePoint(args?.dropoff, "dropoff");
  const serviceTypeId = typeof args?.serviceTypeId === "string" ? args.serviceTypeId : undefined;

  const rider = await ensureUserByPhone(riderPhone, typeof args?.riderName === "string" ? args.riderName.slice(0, 80) : undefined, "agent");

  // Phase 1 — under a PER-KEY advisory lock (serializes ALL bookings for this
  // key, so the spend-cap check-and-reserve cannot race across concurrent
  // requests with distinct idempotency keys), either replay/recover an
  // existing booking or commit a spend-reserving intent row BEFORE any ride
  // is created. If the process dies between ride creation and phase 3, a
  // retry finds the pending intent and adopts the created ride instead of
  // booking a second one.
  const phase1 = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`agw-book:${key.keyId}`}))`);

    const [existing] = await tx
      .select()
      .from(agentBookings)
      .where(and(eq(agentBookings.keyId, key.keyId), eq(agentBookings.idempotencyKey, idempotencyKey)))
      .limit(1);

    if (existing?.status === "booked" && existing.responseJson) {
      return { kind: "replay" as const, response: existing.responseJson as any };
    }

    if (existing?.status === "pending") {
      // A previous attempt reserved this key but never finished. The intent
      // carries the PRE-GENERATED ride id that attempt would have used, so
      // recovery is exact: adopt only the ride with that id — never a ride
      // the rider booked through another channel.
      const [createdRide] = existing.rideId
        ? await db.select().from(rides).where(eq(rides.id, existing.rideId)).limit(1)
        : [undefined];
      if (createdRide) {
        const response = buildBookingResponse(createdRide, { agentId: existing.agentId, idempotencyKey });
        await tx.update(agentBookings)
          .set({ status: "booked", responseJson: response })
          .where(eq(agentBookings.id, existing.id));
        return { kind: "replay" as const, response };
      }
      if (Date.now() - existing.createdAt.getTime() < INTENT_STALE_MS) {
        throw new ToolError("BOOKING_IN_PROGRESS", "A booking with this idempotencyKey is still being processed. Retry in a few seconds.", 409);
      }
      // Stale crashed attempt whose ride was never created — rebook this row
      // (with a fresh preset ride id, assigned below).
    }

    // Server-authoritative quote — the agent never supplies money fields.
    const quote = await getQuote(pickup, dropoff);
    if (!quote.estimates.length) {
      throw new ToolError("NO_SERVICE", "No service types available for this route.", 422);
    }
    const choice: FareEstimate =
      (serviceTypeId && quote.estimates.find((e) => e.id === serviceTypeId)) || quote.estimates[0];

    // Per-key daily spend cap (approximate USD, enforcement only). Pending
    // intents count toward spend, so a reservation can never be raced past.
    const [keyRow] = await tx.select().from(apiKeys).where(eq(apiKeys.id, key.keyId)).limit(1);
    const cap = dailySpendCapUsd(key, keyRow?.agentDailySpendCapUsd);
    const spendUsd = toUsdApprox(choice.fare, quote.currency);
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const [spentRow] = await tx
      .select({ total: sql<string>`COALESCE(SUM(${agentBookings.spendUsd}), 0)` })
      .from(agentBookings)
      .where(and(
        eq(agentBookings.keyId, key.keyId),
        gte(agentBookings.createdAt, dayStart),
        existing ? sql`${agentBookings.id} <> ${existing.id}` : sql`TRUE`,
      ));
    const spent = Number(spentRow?.total ?? 0);
    if (spent + spendUsd > cap) {
      throw new ToolError(
        "SPEND_CAP_EXCEEDED",
        `This booking (~$${spendUsd.toFixed(2)}) would exceed the key's daily agent spend cap of $${cap.toFixed(2)} (≈$${spent.toFixed(2)} used today, UTC). Caps are approximate USD for abuse prevention.`,
        429,
        { capUsd: cap, spentUsd: Number(spent.toFixed(2)) },
      );
    }

    // Pre-generate the ride id and persist it on the intent BEFORE the ride
    // exists — this is the exact correlation recovery relies on.
    const presetRideId = randomUUID();
    let intentId: string;
    if (existing) {
      await tx.update(agentBookings)
        .set({ agentId, riderUserId: rider.id, rideId: presetRideId, fare: String(choice.fare.toFixed(2)), currency: quote.currency, spendUsd: String(spendUsd.toFixed(2)), createdAt: new Date() })
        .where(eq(agentBookings.id, existing.id));
      intentId = existing.id;
    } else {
      const [intent] = await tx.insert(agentBookings).values({
        keyId: key.keyId,
        ownerId: key.ownerId,
        agentId,
        idempotencyKey,
        status: "pending",
        rideId: presetRideId,
        riderUserId: rider.id,
        fare: String(choice.fare.toFixed(2)),
        currency: quote.currency,
        spendUsd: String(spendUsd.toFixed(2)),
      }).returning({ id: agentBookings.id });
      intentId = intent.id;
    }
    return { kind: "book" as const, intentId, presetRideId, quote, choice };
  });

  if (phase1.kind === "replay") {
    return { ...phase1.response, replayed: true };
  }

  // Phase 2 — create the ride (createBrainRide manages its own transaction
  // and per-rider advisory lock).
  let result;
  try {
    result = await createBrainRide({
      userId: rider.id,
      pickup: { ...pickup, address: pickup.address || `Pinned location (${pickup.lat.toFixed(4)}, ${pickup.lng.toFixed(4)})` },
      dropoff: { ...dropoff, address: dropoff.address || `Pinned location (${dropoff.lat.toFixed(4)}, ${dropoff.lng.toFixed(4)})` },
      choice: phase1.choice,
      quote: phase1.quote,
      paymentMethod: "cash",
      withShareToken: true,
      channel: "agent",
      presetRideId: phase1.presetRideId,
    });
  } catch (err) {
    // Booking failed before any ride existed — release the spend reservation.
    try {
      await db.delete(agentBookings)
        .where(and(eq(agentBookings.id, phase1.intentId), eq(agentBookings.status, "pending")));
    } catch (cleanupErr) {
      console.error("[AgentGateway] intent cleanup failed:", (cleanupErr as Error)?.message);
    }
    if (err instanceof EngagedRideError) {
      throw new ToolError("RIDER_ENGAGED", "This rider already has a ride in progress. Cancel or complete it first.", 409, { activeRideId: (err as any).ride?.id });
    }
    throw err;
  }

  // Phase 3 — persist the booking result on the intent row.
  const ride = result.ride;
  const response = buildBookingResponse(ride, {
    serviceTypeId: phase1.choice.id,
    serviceTypeLabel: phase1.choice.label,
    agentId,
    idempotencyKey,
    driver: result.driverInfo
      ? { name: result.driverInfo.name, car: result.driverInfo.carDesc, plate: result.driverInfo.plate ?? null, etaMin: result.matchedEtaMin ?? null }
      : null,
  });
  await db.update(agentBookings)
    .set({ status: "booked", responseJson: response }) // rideId already bound at intent time
    .where(eq(agentBookings.id, phase1.intentId));

  // Text the rider a tracking link so the human always knows an agent booked
  // for them (fire-and-forget; SMS failure never fails the booking).
  if (response.trackingUrl) {
    import("./twilioService")
      .then((m) => m.sendSmsMessage(normalizePhone(riderPhone), `Travony: a ride was booked for you${agentId !== "unknown" ? ` by ${agentId}` : ""}. Track it live: ${response.trackingUrl}`))
      .catch((e) => console.error("[AgentGateway] rider SMS failed:", e?.message || e));
  }

  return response;
}

async function requireOwnedBooking(key: KeyCtx, rideId: string) {
  const [booking] = await db
    .select()
    .from(agentBookings)
    .where(and(
      eq(agentBookings.keyId, key.keyId),
      eq(agentBookings.rideId, rideId),
      eq(agentBookings.status, "booked"),
    ))
    .limit(1);
  if (!booking) throw new ToolError("RIDE_NOT_FOUND", "No booking with this rideId under your API key.", 404);
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  if (!ride) throw new ToolError("RIDE_NOT_FOUND", "Ride no longer exists.", 404);
  return { booking, ride };
}

async function coreRideStatus(key: KeyCtx, args: any) {
  const rideId = String(args?.rideId || "");
  const { booking, ride } = await requireOwnedBooking(key, rideId);

  let driver: any = null;
  if (ride.driverId) {
    try {
      const d = await storage.getDriver(ride.driverId);
      const du = d ? await storage.getUser(d.userId) : null;
      const vs = d ? await storage.getVehiclesByDriver(d.id) : [];
      const v = vs?.[0];
      driver = {
        name: du?.name || "Driver",
        car: v ? `${v.color ? v.color + " " : ""}${v.make} ${v.model}`.trim() : null,
        plate: v?.plateNumber || null,
        lat: d?.currentLat ? Number(d.currentLat) : null,
        lng: d?.currentLng ? Number(d.currentLng) : null,
      };
    } catch { /* driver info is best-effort */ }
  }

  const isPreTrip = ["pending", "accepted", "arriving"].includes(ride.status);
  return {
    rideId: ride.id,
    status: ride.status,
    fare: Number(ride.actualFare ?? ride.estimatedFare),
    currency: ride.currency,
    pickup: coarsePlace(ride.pickupAddress),
    dropoff: coarsePlace(ride.dropoffAddress),
    driver,
    pickupOtp: isPreTrip ? (ride as any).pickupOtp ?? (ride as any).otp ?? undefined : undefined,
    trackingUrl: ride.shareToken ? `${baseUrl()}/track/${ride.shareToken}` : null,
    agentId: booking.agentId,
    createdAt: ride.createdAt,
    completedAt: (ride as any).completedAt ?? null,
    receiptAvailable: ride.status === "completed",
  };
}

const CANCELLABLE: readonly string[] = RIDER_CANCELLABLE_STATUSES;

async function coreCancelRide(key: KeyCtx, args: any) {
  const rideId = String(args?.rideId || "");
  await requireOwnedBooking(key, rideId); // authorization: this key booked this ride

  // Shared, atomic rider-cancellation path: the transition is conditioned on
  // the ride still being cancellable (a driver racing it to started/completed
  // wins), and all standard cancellation side effects + notifications fire.
  const result = await cancelRideAsRider(rideId);
  if (!result.ok) {
    if (result.reason === "already_cancelled") return { rideId, status: "cancelled", alreadyCancelled: true };
    if (result.reason === "not_found") throw new ToolError("NOT_FOUND", "Ride not found.", 404);
    throw new ToolError("NOT_CANCELLABLE", `Ride is '${result.status}' — only ${CANCELLABLE.join("/")} rides can be cancelled by the agent.`, 409);
  }
  return { rideId, status: "cancelled" };
}

async function coreGetReceipt(key: KeyCtx, args: any) {
  const rideId = String(args?.rideId || "");
  const { booking, ride } = await requireOwnedBooking(key, rideId);
  if (ride.status !== "completed") {
    throw new ToolError("NOT_COMPLETED", `Receipts exist only for completed rides (current status: '${ride.status}').`, 409);
  }
  return signReceipt({
    type: "travony.agent_booking.receipt",
    version: 1,
    rideId: ride.id,
    agentId: booking.agentId,
    idempotencyKey: booking.idempotencyKey,
    apiKeyId: booking.keyId,
    fare: Number(ride.actualFare ?? ride.estimatedFare),
    currency: ride.currency,
    distanceKm: Number(ride.distance),
    route: { from: coarsePlace(ride.pickupAddress), to: coarsePlace(ride.dropoffAddress) },
    requestedAt: ride.createdAt?.toISOString?.() ?? String(ride.createdAt),
    completedAt: (ride as any).completedAt ? new Date((ride as any).completedAt).toISOString() : new Date().toISOString(),
    blockchainHash: ride.blockchainHash ?? null,
  });
}

// ---------------------------------------------------------------------------
// Webhooks — signed status callbacks with durable retries
// ---------------------------------------------------------------------------

const RETRY_BACKOFF_MIN = [1, 5, 15, 60, 180]; // minutes; attempts beyond → failed
const MAX_ATTEMPTS = RETRY_BACKOFF_MIN.length + 1;

// --- SSRF guards -----------------------------------------------------------
// Webhook URLs are attacker-controlled input to a server-side fetch. We only
// allow https on the default port, reject userinfo, verify every resolved IP
// is public at DELIVERY time (not just registration, defeating DNS swaps),
// and never follow redirects (a public URL 302ing to an internal service).

function ipIsPrivate(ip: string): boolean {
  const v4 = ip.startsWith("::ffff:") ? ip.slice(7) : ip;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v4)) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224 // multicast + reserved
    );
  }
  const lower = ip.toLowerCase();
  return (
    lower === "::" || lower === "::1" ||
    lower.startsWith("fc") || lower.startsWith("fd") || // ULA fc00::/7
    lower.startsWith("fe8") || lower.startsWith("fe9") ||
    lower.startsWith("fea") || lower.startsWith("feb") || // link-local fe80::/10
    lower.startsWith("::ffff:") // any remaining mapped form we couldn't parse
  );
}

/** Syntactic checks at registration time. Throws ToolError when unsafe. */
function assertWebhookUrlShape(raw: string): URL {
  let url: URL;
  try { url = new URL(raw); } catch { throw new ToolError("INVALID_URL", "url must be a valid https:// endpoint.", 400); }
  if (url.protocol !== "https:") throw new ToolError("INVALID_URL", "Webhook URLs must use https.", 400);
  if (url.username || url.password) throw new ToolError("INVALID_URL", "Webhook URLs must not embed credentials.", 400);
  if (url.port && url.port !== "443") throw new ToolError("INVALID_URL", "Webhook URLs must use the default https port (443).", 400);
  if (raw.length > 500) throw new ToolError("INVALID_URL", "Webhook URL too long (max 500 chars).", 400);
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new ToolError("INVALID_URL", "Webhook URLs must resolve to a public host.", 400);
  }
  // IP-literal hosts are checked immediately; DNS names are re-checked at delivery.
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (ipIsPrivate(host)) throw new ToolError("INVALID_URL", "Webhook URLs must resolve to a public IP.", 400);
  }
  return url;
}

/** Resolve the hostname, require EVERY address to be public, and return the
 *  validated addresses so the caller can PIN the connection to one of them. */
async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (/^[\d.]+$/.test(host) || host.includes(":")) {
    if (ipIsPrivate(host)) throw new Error("private IP");
    return [host];
  }
  const dns = await import("dns/promises");
  const addrs = await dns.lookup(host, { all: true, verbatim: true });
  if (!addrs.length) throw new Error("unresolvable host");
  for (const a of addrs) {
    if (ipIsPrivate(a.address)) throw new Error(`resolves to private IP ${a.address}`);
  }
  return addrs.map((a) => a.address);
}

async function assertResolvesPublic(hostname: string): Promise<void> {
  await resolvePublicAddresses(hostname);
}

/**
 * SSRF-safe webhook POST: connects to a validated public IP directly (so a
 * DNS-rebinding swap between validation and connect cannot steer the request
 * to an internal address), while keeping full TLS certificate verification
 * against the ORIGINAL hostname via SNI + checkServerIdentity. Redirects are
 * never followed (https.request does not follow them; 3xx = failure).
 */
async function postWebhookPinned(urlStr: string, headers: Record<string, string>, body: string, timeoutMs = 10_000): Promise<{ status: number }> {
  const url = assertWebhookUrlShape(urlStr);
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const [pinnedIp] = await resolvePublicAddresses(hostname);
  const https = await import("https");
  const tls = await import("tls");
  return await new Promise<{ status: number }>((resolve, reject) => {
    const req = https.request({
      host: pinnedIp,               // connect to the validated address, not DNS
      port: 443,
      path: `${url.pathname}${url.search}`,
      method: "POST",
      servername: hostname,         // SNI for the real host
      headers: { ...headers, Host: hostname, "Content-Length": Buffer.byteLength(body) },
      checkServerIdentity: (_host, cert) => tls.checkServerIdentity(hostname, cert), // cert must match the ORIGINAL hostname
      timeout: timeoutMs,
    }, (res) => {
      res.resume(); // drain; we only need the status
      res.on("end", () => resolve({ status: res.statusCode ?? 0 }));
    });
    req.on("timeout", () => req.destroy(Object.assign(new Error("timeout"), { name: "AbortError" })));
    req.on("error", reject);
    req.end(body);
  });
}

export async function notifyAgentRideUpdate(rideId: string, statusOverride?: string): Promise<void> {
  try {
    const [booking] = await db.select().from(agentBookings).where(eq(agentBookings.rideId, rideId)).limit(1);
    if (!booking) return; // not an agent booking
    const hooks = await db
      .select()
      .from(agentWebhooks)
      .where(and(eq(agentWebhooks.keyId, booking.keyId), eq(agentWebhooks.isActive, true)));
    if (!hooks.length) return;

    const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
    if (!ride) return;
    const status = statusOverride || ride.status;
    const payload = {
      event: `ride.${status}`,
      rideId: ride.id,
      status,
      agentId: booking.agentId,
      idempotencyKey: booking.idempotencyKey,
      fare: Number(ride.actualFare ?? ride.estimatedFare),
      currency: ride.currency,
      trackingUrl: ride.shareToken ? `${baseUrl()}/track/${ride.shareToken}` : null,
      occurredAt: new Date().toISOString(),
    };
    await db.insert(agentWebhookDeliveries).values(
      hooks.map((h) => ({ webhookId: h.id, rideId: ride.id, event: payload.event, payload })),
    );
    setImmediate(() => processWebhookDeliveries().catch(() => {}));
  } catch (err) {
    console.error("[AgentGateway] notify error:", (err as Error)?.message);
  }
}

let deliveryLoopStarted = false;
let processing = false;

export function startAgentWebhookWorker(): void {
  if (deliveryLoopStarted) return;
  deliveryLoopStarted = true;
  setInterval(() => processWebhookDeliveries().catch(() => {}), 60_000).unref?.();
}

async function processWebhookDeliveries(): Promise<void> {
  if (processing) return;
  processing = true;
  try {
    const due = await db
      .select()
      .from(agentWebhookDeliveries)
      .where(and(eq(agentWebhookDeliveries.status, "pending"), lte(agentWebhookDeliveries.nextAttemptAt, new Date())))
      .orderBy(agentWebhookDeliveries.nextAttemptAt)
      .limit(20);
    if (!due.length) return;

    const hookIds = Array.from(new Set(due.map((d) => d.webhookId)));
    const hooks = await db.select().from(agentWebhooks).where(inArray(agentWebhooks.id, hookIds));
    const hookById = new Map(hooks.map((h) => [h.id, h]));

    for (const delivery of due) {
      const hook = hookById.get(delivery.webhookId);
      if (!hook || !hook.isActive) {
        await db.update(agentWebhookDeliveries).set({ status: "failed" }).where(eq(agentWebhookDeliveries.id, delivery.id));
        continue;
      }
      const body = JSON.stringify(delivery.payload);
      const t = Math.floor(Date.now() / 1000);
      const v1 = createHmac("sha256", hook.secret).update(`${t}.${body}`).digest("hex");
      let ok = false;
      let errMsg = "";
      try {
        // SSRF guard on every attempt: validate + resolve, then PIN the
        // connection to the validated IP (defeats DNS-rebinding TOCTOU).
        const res = await postWebhookPinned(hook.url, {
          "Content-Type": "application/json",
          "X-Travony-Event": delivery.event,
          "X-Travony-Signature": `t=${t},v1=${v1}`,
        }, body);
        ok = res.status >= 200 && res.status < 300;
        if (!ok) errMsg = res.status >= 300 && res.status < 400 ? "redirects not allowed" : `HTTP ${res.status}`;
      } catch (e: any) {
        errMsg = e?.name === "AbortError" ? "timeout" : String(e?.message || e).slice(0, 200);
      }

      if (ok) {
        await db.update(agentWebhookDeliveries)
          .set({ status: "delivered", deliveredAt: new Date(), attempts: delivery.attempts + 1 })
          .where(eq(agentWebhookDeliveries.id, delivery.id));
        await db.update(agentWebhooks)
          .set({ lastDeliveryAt: new Date(), failCount: 0, lastError: null })
          .where(eq(agentWebhooks.id, hook.id));
      } else {
        const attempts = delivery.attempts + 1;
        const exhausted = attempts >= MAX_ATTEMPTS;
        const backoffMin = RETRY_BACKOFF_MIN[Math.min(attempts - 1, RETRY_BACKOFF_MIN.length - 1)];
        await db.update(agentWebhookDeliveries)
          .set({
            attempts,
            status: exhausted ? "failed" : "pending",
            nextAttemptAt: new Date(Date.now() + backoffMin * 60_000),
          })
          .where(eq(agentWebhookDeliveries.id, delivery.id));
        await db.update(agentWebhooks)
          .set({ failCount: sql`${agentWebhooks.failCount} + 1`, lastError: errMsg })
          .where(eq(agentWebhooks.id, hook.id));
      }
    }
  } finally {
    processing = false;
  }
}

// ---------------------------------------------------------------------------
// REST router
// ---------------------------------------------------------------------------

function keyCtx(req: Request): KeyCtx {
  const k = req.apiKey!;
  return { keyId: k.keyId, ownerId: k.ownerId, planTier: k.planTier };
}

function agentIdOf(req: Request): string {
  const raw = req.headers["x-agent-id"] || (req.body && req.body.agentId);
  return String(raw || "unknown").slice(0, 120);
}

function sendToolError(res: Response, err: any) {
  if (err instanceof ToolError) {
    return res.status(err.httpStatus).json({ error: err.code, code: err.code, message: err.message, ...(err.extra || {}) });
  }
  console.error("[AgentGateway] error:", err);
  res.status(500).json({ error: "Internal error", code: "INTERNAL", message: "Something went wrong. Retry with the same idempotencyKey — bookings are idempotent." });
}

export const agentGatewayRouter = Router();
const base = "/api/partner/v1/agent";

agentGatewayRouter.get(`${base}/service-types`, requirePartner("pricing:read"), async (req, res) => {
  try { res.json(await coreListServiceTypes({ lat: req.query.lat, lng: req.query.lng })); }
  catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.post(`${base}/quote`, requirePartner("pricing:read"), async (req, res) => {
  try { res.json(await coreGetQuote(req.body || {})); }
  catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.post(`${base}/rides`, requirePartner("rides:write"), async (req, res) => {
  try {
    const args = { ...(req.body || {}), idempotencyKey: req.headers["idempotency-key"] || req.body?.idempotencyKey };
    const out = await coreBookRide(keyCtx(req), agentIdOf(req), args);
    res.status(out.replayed ? 200 : 201).json(out);
  } catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.get(`${base}/rides/:rideId`, requirePartner("rides:read"), async (req, res) => {
  try { res.json(await coreRideStatus(keyCtx(req), { rideId: req.params.rideId })); }
  catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.post(`${base}/rides/:rideId/cancel`, requirePartner("rides:write"), async (req, res) => {
  try { res.json(await coreCancelRide(keyCtx(req), { rideId: req.params.rideId })); }
  catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.get(`${base}/rides/:rideId/receipt`, requirePartner("rides:read"), async (req, res) => {
  try { res.json(await coreGetReceipt(keyCtx(req), { rideId: req.params.rideId })); }
  catch (err) { sendToolError(res, err); }
});

// Webhook registration — the secret is returned exactly once.
agentGatewayRouter.post(`${base}/webhooks`, requirePartner("rides:read"), async (req, res) => {
  try {
    const url = String(req.body?.url || "");
    const parsed = assertWebhookUrlShape(url);
    try {
      await assertResolvesPublic(parsed.hostname);
    } catch (e: any) {
      return res.status(400).json({ error: "INVALID_URL", code: "INVALID_URL", message: `Webhook host rejected: ${e?.message || "must resolve to a public IP"}.` });
    }
    const existing = await db.select().from(agentWebhooks)
      .where(and(eq(agentWebhooks.keyId, req.apiKey!.keyId), eq(agentWebhooks.isActive, true)));
    if (existing.length >= 3) {
      return res.status(409).json({ error: "TOO_MANY_WEBHOOKS", code: "TOO_MANY_WEBHOOKS", message: "Up to 3 active webhook endpoints per key. Delete one first." });
    }
    const secret = `whsec_${randomBytes(24).toString("hex")}`;
    const [hook] = await db.insert(agentWebhooks)
      .values({ keyId: req.apiKey!.keyId, url, secret })
      .returning();
    res.status(201).json({
      id: hook.id,
      url: hook.url,
      secret,
      warning: "Store this secret now — it is not shown again. Verify deliveries: signature header is 't=<unix>,v1=<hex>' where v1 = HMAC-SHA256(secret, `${t}.${rawBody}`).",
    });
  } catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.get(`${base}/webhooks`, requirePartner("rides:read"), async (req, res) => {
  try {
    const hooks = await db.select().from(agentWebhooks).where(eq(agentWebhooks.keyId, req.apiKey!.keyId));
    res.json({
      webhooks: hooks.map((h) => ({
        id: h.id, url: h.url, isActive: h.isActive, failCount: h.failCount,
        lastDeliveryAt: h.lastDeliveryAt, lastError: h.lastError, createdAt: h.createdAt,
      })),
    });
  } catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.delete(`${base}/webhooks/:id`, requirePartner("rides:read"), async (req, res) => {
  try {
    await db.update(agentWebhooks).set({ isActive: false })
      .where(and(eq(agentWebhooks.id, req.params.id), eq(agentWebhooks.keyId, req.apiKey!.keyId)));
    res.json({ success: true });
  } catch (err) { sendToolError(res, err); }
});

agentGatewayRouter.get(`${base}/public-key`, (_req, res) => {
  res.json({ algorithm: "Ed25519", publicKeyPem: RECEIPT_KEYS.publicKeyPem, canonicalization: "JSON with sorted object keys, UTF-8" });
});

// ---------------------------------------------------------------------------
// MCP tool definitions (shared with tools/list)
// ---------------------------------------------------------------------------

const POINT_SCHEMA = {
  type: "object",
  required: ["lat", "lng"],
  properties: {
    lat: { type: "number" },
    lng: { type: "number" },
    address: { type: "string", description: "Human-readable address shown to the driver (optional but recommended)" },
  },
};

export const AGENT_TOOLS = [
  {
    name: "list_service_types",
    description: "List available Travony vehicle/service types at a location with indicative sample fares. Use get_quote for a real route price.",
    scope: "pricing:read",
    inputSchema: { type: "object", required: ["lat", "lng"], properties: { lat: { type: "number" }, lng: { type: "number" } } },
  },
  {
    name: "get_quote",
    description: "Get live engine-computed fares for a pickup→dropoff route across every available service type. Free, no booking created. Returns currency, distance and per-type fares (cheapest first).",
    scope: "pricing:read",
    inputSchema: { type: "object", required: ["pickup", "dropoff"], properties: { pickup: POINT_SCHEMA, dropoff: POINT_SCHEMA } },
  },
  {
    name: "book_ride",
    description: "Book a Travony ride for a rider identified by phone number. IDEMPOTENT: pass a unique idempotencyKey per booking attempt; retrying with the same key returns the original booking instead of double-booking. Fare is server-computed (cash, paid by the rider). Returns rideId, fare, pickup OTP and a live trackingUrl (also texted to the rider).",
    scope: "rides:write",
    inputSchema: {
      type: "object",
      required: ["pickup", "dropoff", "riderPhone", "idempotencyKey"],
      properties: {
        pickup: POINT_SCHEMA,
        dropoff: POINT_SCHEMA,
        riderPhone: { type: "string", description: "Rider's phone in E.164 (e.g. +971501234567). The phone IS the rider's account." },
        riderName: { type: "string" },
        serviceTypeId: { type: "string", description: "From get_quote options; defaults to the cheapest." },
        idempotencyKey: { type: "string", description: "Unique key per booking attempt (e.g. a UUID). Reuse on retries." },
      },
    },
  },
  {
    name: "get_ride_status",
    description: "Current status of a ride booked by this API key: pending/accepted/arriving/started/completed/cancelled, driver info and live tracking URL. Receipts become available when completed.",
    scope: "rides:read",
    inputSchema: { type: "object", required: ["rideId"], properties: { rideId: { type: "string" } } },
  },
  {
    name: "cancel_ride",
    description: "Cancel a ride booked by this API key (only while pending/accepted/arriving).",
    scope: "rides:write",
    inputSchema: { type: "object", required: ["rideId"], properties: { rideId: { type: "string" } } },
  },
] as const;

export async function callAgentTool(key: KeyCtx, agentId: string, name: string, args: any): Promise<any> {
  switch (name) {
    case "list_service_types": return coreListServiceTypes(args || {});
    case "get_quote": return coreGetQuote(args || {});
    case "book_ride": return coreBookRide(key, agentId, args || {});
    case "get_ride_status": return coreRideStatus(key, args || {});
    case "cancel_ride": return coreCancelRide(key, args || {});
    default: throw new ToolError("UNKNOWN_TOOL", `Unknown tool '${name}'.`, 404);
  }
}

export function toolScope(name: string): string | null {
  const t = AGENT_TOOLS.find((t) => t.name === name);
  return t ? t.scope : null;
}

// ---------------------------------------------------------------------------
// Focused OpenAPI tool manifest (also linked from the developer portal)
// ---------------------------------------------------------------------------

agentGatewayRouter.get(`${base}/openapi.json`, (_req, res) => {
  res.json(buildAgentOpenApi());
});

function buildAgentOpenApi() {
  const server = `${baseUrl()}`;
  const err = (desc: string) => ({ description: desc, content: { "application/json": { schema: { type: "object", properties: { code: { type: "string" }, message: { type: "string" } } } } } });
  return {
    openapi: "3.0.3",
    info: {
      title: "Travony Agent Gateway",
      version: "1.0.0",
      description:
        "Book Travony rides from any AI agent. Auth: X-API-Key header (get one at /developer, scopes pricing:read + rides:read + rides:write). Idempotent booking via Idempotency-Key. Identify your agent with X-Agent-Id. All fares are server-computed — never send money fields. MCP endpoint: POST " + server + "/mcp (same key, same five tools).",
    },
    servers: [{ url: server }],
    components: {
      securitySchemes: { ApiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } },
    },
    security: [{ ApiKeyAuth: [] }],
    paths: {
      [`${base}/service-types`]: {
        get: {
          operationId: "list_service_types",
          summary: "List service types at a location",
          parameters: [
            { name: "lat", in: "query", required: true, schema: { type: "number" } },
            { name: "lng", in: "query", required: true, schema: { type: "number" } },
          ],
          responses: { "200": { description: "Service types with indicative fares" }, "403": err("Missing pricing:read scope") },
        },
      },
      [`${base}/quote`]: {
        post: {
          operationId: "get_quote",
          summary: "Live fare quote for a route",
          requestBody: { required: true, content: { "application/json": { schema: AGENT_TOOLS[1].inputSchema as any } } },
          responses: { "200": { description: "Engine-computed fares, cheapest first" }, "403": err("Missing pricing:read scope") },
        },
      },
      [`${base}/rides`]: {
        post: {
          operationId: "book_ride",
          summary: "Book a ride (idempotent)",
          description: "Pass Idempotency-Key header (or body idempotencyKey). Retries return the original booking. X-Agent-Id identifies the acting agent.",
          parameters: [
            { name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } },
            { name: "X-Agent-Id", in: "header", required: false, schema: { type: "string" } },
          ],
          requestBody: { required: true, content: { "application/json": { schema: AGENT_TOOLS[2].inputSchema as any } } },
          responses: {
            "201": { description: "Ride booked — rideId, server-computed fare, pickup OTP, trackingUrl" },
            "200": { description: "Idempotent replay of an earlier booking (replayed: true)" },
            "409": err("Rider already has an active ride (RIDER_ENGAGED)"),
            "429": err("Daily spend cap or rate limit exceeded"),
          },
        },
      },
      [`${base}/rides/{rideId}`]: {
        get: {
          operationId: "get_ride_status",
          summary: "Ride status",
          parameters: [{ name: "rideId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Status, driver, tracking URL" }, "404": err("Not booked by this key") },
        },
      },
      [`${base}/rides/{rideId}/cancel`]: {
        post: {
          operationId: "cancel_ride",
          summary: "Cancel a ride",
          parameters: [{ name: "rideId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Cancelled" }, "409": err("No longer cancellable") },
        },
      },
      [`${base}/rides/{rideId}/receipt`]: {
        get: {
          operationId: "get_ride_receipt",
          summary: "Ed25519-signed receipt for a completed ride",
          parameters: [{ name: "rideId", in: "path", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "payload + signature + publicKey (verify against /public-key)" }, "409": err("Ride not completed yet") },
        },
      },
      [`${base}/webhooks`]: {
        post: {
          operationId: "register_webhook",
          summary: "Register a status-callback endpoint",
          description: "Ride status transitions (ride.accepted, ride.arriving, ride.started, ride.completed, ride.cancelled) POST to your https URL, signed with 'X-Travony-Signature: t=<unix>,v1=HMAC-SHA256(secret, t + \".\" + rawBody)'. Retried with backoff.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["url"], properties: { url: { type: "string" } } } } } },
          responses: { "201": { description: "Webhook registered — secret shown once" } },
        },
        get: { operationId: "list_webhooks", summary: "List webhook endpoints", responses: { "200": { description: "Webhooks with delivery health" } } },
      },
    },
  };
}
