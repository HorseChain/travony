import { Router } from "express";
import { db } from "./db";
import { scheduledArrivals, rides, hubs, cities, type ScheduledArrival } from "@shared/schema";
import { eq, and, inArray, desc, or, isNull, ne } from "drizzle-orm";
import { storage } from "./storage";
import { calculateOptimalPrice } from "./aiEngine";
import { generateRideHash, calculateFeeBreakdown } from "./blockchain";
import { notifyOnlineDriversOfNewRide } from "./rideNotifications";
import { randomUUID } from "crypto";
import { getRegionByCode, detectRegionFromCoordinates } from "./regionService";

// On-Time Arrivals engine.
// pickup time = arrival deadline − travel ETA − category buffer
// The ride is auto-created (and broadcast to online drivers) DISPATCH_LEAD_MIN
// minutes before pickup time, so a driver is on the way exactly when needed.

const DISPATCH_LEAD_MIN = 7;
const ACTIVE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"] as const;

export const DEFAULT_BUFFERS: Record<string, number> = {
  airport: 90,
  university: 15,
  mall: 10,
  hotel: 10,
  other: 10,
};

const CATEGORIES = ["mall", "university", "airport", "hotel", "other"];

function calculateDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function etaFromDistanceKm(distanceKm: number): number {
  return Math.max(2, Math.round((distanceKm / 25) * 60));
}

// ---- Occurrence math -------------------------------------------------------

// For a weekly arrival, find the next deadline (as UTC Date) from daysOfWeek
// ("0,3,5" — 0=Sunday, local) + arriveTimeLocal ("HH:mm") + tzOffsetMinutes
// (local = UTC + offset). For a one-time arrival it's simply arriveAtUtc.
export function nextDeadline(sub: ScheduledArrival, now: Date): { deadline: Date; key: string } | null {
  if (sub.mode === "once") {
    if (!sub.arriveAtUtc) return null;
    const d = new Date(sub.arriveAtUtc);
    if (d.getTime() < now.getTime() - 5 * 60 * 1000) return null; // missed
    return { deadline: d, key: "once" };
  }
  // weekly
  if (!sub.daysOfWeek || !sub.arriveTimeLocal) return null;
  const days = sub.daysOfWeek.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => n >= 0 && n <= 6);
  if (days.length === 0) return null;
  const [hh, mm] = sub.arriveTimeLocal.split(":").map((s) => parseInt(s, 10));
  if (isNaN(hh) || isNaN(mm)) return null;
  const offsetMs = (sub.tzOffsetMinutes || 0) * 60 * 1000;

  // Walk day by day in the rider's local calendar until we find the next match.
  const localNow = new Date(now.getTime() + offsetMs);
  for (let i = 0; i < 8; i++) {
    const candidate = new Date(Date.UTC(
      localNow.getUTCFullYear(), localNow.getUTCMonth(), localNow.getUTCDate() + i, hh, mm, 0, 0,
    ));
    if (!days.includes(candidate.getUTCDay())) continue;
    const deadlineUtc = new Date(candidate.getTime() - offsetMs);
    if (deadlineUtc.getTime() < now.getTime() - 5 * 60 * 1000) continue; // already passed today
    const key = candidate.toISOString().slice(0, 10); // local occurrence date
    return { deadline: deadlineUtc, key };
  }
  return null;
}

export function computeTimes(sub: ScheduledArrival, now: Date) {
  const occ = nextDeadline(sub, now);
  if (!occ) return null;
  const distanceKm = calculateDistanceKm(
    parseFloat(sub.pickupLat), parseFloat(sub.pickupLng),
    parseFloat(sub.destLat), parseFloat(sub.destLng),
  );
  const etaMin = etaFromDistanceKm(distanceKm);
  const pickupAt = new Date(occ.deadline.getTime() - (etaMin + sub.bufferMinutes) * 60 * 1000);
  const dispatchAt = new Date(pickupAt.getTime() - DISPATCH_LEAD_MIN * 60 * 1000);
  return { ...occ, distanceKm, etaMin, pickupAt, dispatchAt };
}

// ---- Engine ----------------------------------------------------------------

async function riderHasActiveRide(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: rides.id })
    .from(rides)
    .where(and(eq(rides.customerId, userId), inArray(rides.status, ACTIVE_RIDE_STATUSES as any)))
    .limit(1);
  return rows.length > 0;
}

async function dispatchArrivalRide(sub: ScheduledArrival, times: NonNullable<ReturnType<typeof computeTimes>>): Promise<void> {
  // Atomically claim this occurrence BEFORE creating the ride. The conditional
  // update only succeeds for one caller, so concurrent ticks (or a second
  // server instance) can never double-book the same occurrence. If ride
  // creation fails after the claim, we log loudly and miss rather than risk
  // dispatching the rider two cars.
  const claimed = await db
    .update(scheduledArrivals)
    .set({ lastScheduledKey: times.key, lastRideId: null, updatedAt: new Date() })
    .where(
      and(
        eq(scheduledArrivals.id, sub.id),
        eq(scheduledArrivals.status, "active"),
        or(isNull(scheduledArrivals.lastScheduledKey), ne(scheduledArrivals.lastScheduledKey, times.key)),
      ),
    )
    .returning({ id: scheduledArrivals.id });
  if (claimed.length === 0) return; // someone else got here first

  const pickupLat = parseFloat(sub.pickupLat);
  const pickupLng = parseFloat(sub.pickupLng);
  const destLat = parseFloat(sub.destLat);
  const destLng = parseFloat(sub.destLng);

  // Region, currency and fee % derived server-side from pickup coords —
  // same trust boundary as every other ride creation path.
  const regionCode = detectRegionFromCoordinates(pickupLat, pickupLng);
  const region = await getRegionByCode(regionCode).catch(() => null);
  const currency = region?.currency || "AED";
  const feePercent = region ? region.platformFeePercent : 10;

  const pricing = await calculateOptimalPrice(pickupLat, pickupLng, destLat, destLng, "economy", regionCode);
  const fare = pricing.total;
  const fees = calculateFeeBreakdown(fare, feePercent);

  const rideId = randomUUID();
  const blockchainHash = generateRideHash({
    rideId,
    customerId: sub.userId,
    driverId: "pending",
    pickupAddress: sub.pickupAddress,
    dropoffAddress: sub.destAddress,
    fare,
    platformFee: fees.platformFee,
    driverShare: fees.driverShare,
    timestamp: new Date(),
  } as any);

  try {
    await storage.createRide({
      id: rideId,
      customerId: sub.userId,
      serviceTypeId: "st-economy",
      pickupAddress: sub.pickupAddress,
      pickupLat: sub.pickupLat,
      pickupLng: sub.pickupLng,
      dropoffAddress: sub.destAddress,
      dropoffLat: sub.destLat,
      dropoffLng: sub.destLng,
      status: "pending",
      estimatedFare: fare.toFixed(2),
      distance: times.distanceKm.toFixed(2),
      duration: times.etaMin,
      paymentMethod: "cash",
      paymentStatus: "pending",
      platformFee: fees.platformFee.toFixed(2),
      driverEarnings: fees.driverShare.toFixed(2),
      blockchainHash,
      currency,
      regionCode,
      riderPriority: "reliable",
    } as any);
  } catch (error) {
    // Occurrence stays claimed: we miss this one rather than risk two cars.
    console.error(
      `[OnTimeArrivals] CRITICAL: occurrence ${times.key} claimed for "${sub.label}" (${sub.id}) but ride creation failed — no ride dispatched:`,
      error,
    );
    return;
  }

  await db
    .update(scheduledArrivals)
    .set({
      lastScheduledKey: times.key,
      lastRideId: rideId,
      status: sub.mode === "once" ? "done" : sub.status,
      updatedAt: new Date(),
    })
    .where(eq(scheduledArrivals.id, sub.id));

  // Broadcast to ALL online drivers — same rule as every pending ride.
  notifyOnlineDriversOfNewRide(rideId).catch((error) =>
    console.error("[OnTimeArrivals] broadcast error:", error),
  );

  console.log(
    `[OnTimeArrivals] Dispatched ride ${rideId} for "${sub.label}" (arrive by ${times.deadline.toISOString()}, pickup ${times.pickupAt.toISOString()})`,
  );
}

let engineStarted = false;
let ticking = false;

export async function runScheduledArrivalsTick(now = new Date()): Promise<void> {
  const subs = await db.select().from(scheduledArrivals).where(eq(scheduledArrivals.status, "active"));
  for (const sub of subs) {
    try {
      const times = computeTimes(sub, now);
      if (!times) {
        // One-time arrival whose deadline passed without dispatch → close out.
        if (sub.mode === "once") {
          await db
            .update(scheduledArrivals)
            .set({ status: "done", updatedAt: new Date() })
            .where(eq(scheduledArrivals.id, sub.id));
        }
        continue;
      }
      if (sub.lastScheduledKey === times.key) continue; // already dispatched or skipped
      if (now.getTime() < times.dispatchAt.getTime()) continue; // too early
      if (now.getTime() > times.deadline.getTime()) continue; // too late to help
      if (await riderHasActiveRide(sub.userId)) {
        console.log(`[OnTimeArrivals] Skipping "${sub.label}" — rider already has an active ride`);
        continue;
      }
      await dispatchArrivalRide(sub, times);
    } catch (error) {
      console.error(`[OnTimeArrivals] tick error for ${sub.id}:`, error);
    }
  }
}

export function startScheduledArrivalsEngine(): void {
  if (engineStarted) return;
  engineStarted = true;
  setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      await runScheduledArrivalsTick();
    } catch (error) {
      console.error("[OnTimeArrivals] engine error:", error);
    } finally {
      ticking = false;
    }
  }, 60 * 1000);
  console.log("[OnTimeArrivals] Engine started (60s tick)");
}

// ---- API -------------------------------------------------------------------

const router = Router();

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

function serialize(sub: ScheduledArrival, now: Date) {
  const times = sub.status === "active" ? computeTimes(sub, now) : null;
  return {
    ...sub,
    next: times
      ? {
          arriveBy: times.deadline.toISOString(),
          pickupAt: times.pickupAt.toISOString(),
          dispatchAt: times.dispatchAt.toISOString(),
          etaMin: times.etaMin,
          distanceKm: Math.round(times.distanceKm * 10) / 10,
          occurrenceKey: times.key,
          skipped: sub.lastScheduledKey === times.key,
        }
      : null,
  };
}

router.get("/api/scheduled-arrivals", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const subs = await db
      .select()
      .from(scheduledArrivals)
      .where(eq(scheduledArrivals.userId, session.userId))
      .orderBy(desc(scheduledArrivals.createdAt));
    const now = new Date();
    res.json(subs.map((s) => serialize(s, now)));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load scheduled arrivals" });
  }
});

router.post("/api/scheduled-arrivals", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const {
      label, category, hubId,
      destAddress, destLat, destLng,
      pickupAddress, pickupLat, pickupLng,
      mode, arriveAtUtc, daysOfWeek, arriveTimeLocal, tzOffsetMinutes,
      bufferMinutes,
    } = req.body || {};

    if (!label || typeof label !== "string") return res.status(400).json({ error: "A name for this trip is required" });
    const cat = CATEGORIES.includes(category) ? category : "other";
    const dLat = parseFloat(destLat), dLng = parseFloat(destLng);
    const pLat = parseFloat(pickupLat), pLng = parseFloat(pickupLng);
    if (!destAddress || isNaN(dLat) || isNaN(dLng)) return res.status(400).json({ error: "Destination is required" });
    if (!pickupAddress || isNaN(pLat) || isNaN(pLng)) return res.status(400).json({ error: "Pickup location is required" });

    const m = mode === "weekly" ? "weekly" : "once";
    let arriveAt: Date | null = null;
    if (m === "once") {
      arriveAt = arriveAtUtc ? new Date(arriveAtUtc) : null;
      if (!arriveAt || isNaN(arriveAt.getTime())) return res.status(400).json({ error: "Arrival time is required" });
      if (arriveAt.getTime() < Date.now() + 5 * 60 * 1000) {
        return res.status(400).json({ error: "Arrival time must be at least 5 minutes from now" });
      }
    } else {
      const days = String(daysOfWeek || "").split(",").map((s: string) => parseInt(s.trim(), 10)).filter((n: number) => n >= 0 && n <= 6);
      if (days.length === 0) return res.status(400).json({ error: "Pick at least one day of the week" });
      const tm = String(arriveTimeLocal || "").match(/^(\d{1,2}):(\d{2})$/);
      const tmH = tm ? parseInt(tm[1], 10) : -1;
      const tmM = tm ? parseInt(tm[2], 10) : -1;
      if (!tm || tmH < 0 || tmH > 23 || tmM < 0 || tmM > 59) {
        return res.status(400).json({ error: "Arrival time must be a valid time like 18:30" });
      }
    }

    const buffer = Number.isFinite(parseInt(bufferMinutes, 10))
      ? Math.min(240, Math.max(0, parseInt(bufferMinutes, 10)))
      : (DEFAULT_BUFFERS[cat] ?? 10);
    const tz = Number.isFinite(parseInt(tzOffsetMinutes, 10)) ? parseInt(tzOffsetMinutes, 10) : 0;

    const [created] = await db
      .insert(scheduledArrivals)
      .values({
        userId: session.userId,
        label: label.trim().slice(0, 80),
        category: cat,
        hubId: hubId || null,
        destAddress: String(destAddress).slice(0, 300),
        destLat: dLat.toString(),
        destLng: dLng.toString(),
        pickupAddress: String(pickupAddress).slice(0, 300),
        pickupLat: pLat.toString(),
        pickupLng: pLng.toString(),
        mode: m,
        arriveAtUtc: arriveAt,
        daysOfWeek: m === "weekly" ? String(daysOfWeek) : null,
        arriveTimeLocal: m === "weekly" ? String(arriveTimeLocal) : null,
        tzOffsetMinutes: tz,
        bufferMinutes: buffer,
        status: "active",
      })
      .returning();

    res.status(201).json(serialize(created, new Date()));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to create scheduled arrival" });
  }
});

router.patch("/api/scheduled-arrivals/:id", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const [sub] = await db.select().from(scheduledArrivals).where(eq(scheduledArrivals.id, req.params.id));
    if (!sub || sub.userId !== session.userId) return res.status(404).json({ error: "Not found" });

    const { action, bufferMinutes } = req.body || {};
    const updates: Record<string, any> = { updatedAt: new Date() };

    if (action === "pause") updates.status = "paused";
    else if (action === "resume") {
      updates.status = "active";
      if (sub.mode === "once" && sub.arriveAtUtc && new Date(sub.arriveAtUtc).getTime() < Date.now()) {
        return res.status(400).json({ error: "This arrival time has already passed" });
      }
    } else if (action === "skip") {
      // Skip the next occurrence: stamp its key so the engine passes it over.
      const times = computeTimes(sub, new Date());
      if (!times) return res.status(400).json({ error: "Nothing upcoming to skip" });
      if (sub.lastScheduledKey === times.key && sub.lastRideId) {
        return res.status(400).json({ error: "This ride is already booked — cancel it from your rides instead" });
      }
      updates.lastScheduledKey = times.key;
      updates.lastRideId = null;
      if (sub.mode === "once") updates.status = "done";
    } else if (bufferMinutes !== undefined) {
      const b = parseInt(bufferMinutes, 10);
      if (!Number.isFinite(b) || b < 0 || b > 240) return res.status(400).json({ error: "Buffer must be 0-240 minutes" });
      updates.bufferMinutes = b;
    } else {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const [updated] = await db
      .update(scheduledArrivals)
      .set(updates)
      .where(eq(scheduledArrivals.id, sub.id))
      .returning();
    res.json(serialize(updated, new Date()));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update" });
  }
});

router.delete("/api/scheduled-arrivals/:id", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [sub] = await db.select().from(scheduledArrivals).where(eq(scheduledArrivals.id, req.params.id));
    if (!sub || sub.userId !== session.userId) return res.status(404).json({ error: "Not found" });
    await db.delete(scheduledArrivals).where(eq(scheduledArrivals.id, sub.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete" });
  }
});

// ---- Public "try it" endpoints for the /ontime landing page ----------------
// Visitors can schedule a real arrival without the app: we key a guest rider
// account by phone number (namespaced email, NEVER attached to an existing
// account by phone) and create a real scheduled arrival that the engine
// dispatches to online drivers.

const MAX_ACTIVE_PER_GUEST = 3;

// Anti-abuse controls for the public scheduling endpoint. This surface creates
// real dispatchable rides, so beyond the per-guest active cap we rate-limit by
// caller IP (burst + daily) and by phone number (daily). Fixed windows kept in
// memory: coarse protection with zero DB cost; counters reset on deploy, which
// only ever makes the limits briefly more generous, never unsafe amounts.
const tryWindows = new Map<string, { count: number; resetAt: number }>();

function bumpWindow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const w = tryWindows.get(key);
  if (!w || now >= w.resetAt) {
    tryWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  w.count += 1;
  return w.count <= limit;
}

setInterval(() => {
  const now = Date.now();
  tryWindows.forEach((w, k) => { if (now >= w.resetAt) tryWindows.delete(k); });
}, 10 * 60 * 1000).unref?.();

function callerIp(req: any): string {
  const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.ip || req.socket?.remoteAddress || "unknown";
}

router.get("/api/ontime/hubs", async (_req, res) => {
  try {
    const activeHubs = await db.select().from(hubs).where(eq(hubs.status, "active"));
    const allCities = await db.select().from(cities);
    const cityById = new Map(allCities.map((c) => [c.id, c]));
    res.json(
      activeHubs.map((h) => {
        const city = h.cityId ? cityById.get(h.cityId) : null;
        return {
          id: h.id,
          name: h.name,
          address: h.address,
          lat: parseFloat(h.lat),
          lng: parseFloat(h.lng),
          city: city?.name || "",
          country: (city?.regionCode || h.regionCode || "").split("-")[0],
        };
      }),
    );
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load destinations" });
  }
});

router.post("/api/ontime/try", async (req, res) => {
  try {
    const ip = callerIp(req);
    const DAY = 24 * 60 * 60 * 1000;
    if (!bumpWindow(`ip-min:${ip}`, 5, 60 * 1000)) {
      return res.status(429).json({ error: "Too many requests — give it a minute" });
    }
    if (!bumpWindow(`ip-day:${ip}`, 20, DAY)) {
      return res.status(429).json({ error: "Daily limit reached — come back tomorrow or use the T Ride app" });
    }

    const { name, phone, hubId, category, arriveAtUtc, pickupHubId, pickupLat, pickupLng, pickupAddress } = req.body || {};

    const cleanName = String(name || "").trim().slice(0, 60);
    if (!cleanName) return res.status(400).json({ error: "Your name is required" });

    const digits = String(phone || "").replace(/[^0-9]/g, "");
    if (digits.length < 8 || digits.length > 15) {
      return res.status(400).json({ error: "Enter a valid phone number with country code" });
    }
    const normalizedPhone = `+${digits}`;
    if (!bumpWindow(`phone-day:${digits}`, 10, DAY)) {
      return res.status(429).json({ error: "This number has hit today's limit — use the T Ride app for more" });
    }

    const arriveAt = arriveAtUtc ? new Date(arriveAtUtc) : null;
    if (!arriveAt || isNaN(arriveAt.getTime())) return res.status(400).json({ error: "Pick an arrival time" });
    if (arriveAt.getTime() < Date.now() + 20 * 60 * 1000) {
      return res.status(400).json({ error: "Arrival time must be at least 20 minutes from now" });
    }
    if (arriveAt.getTime() > Date.now() + 7 * 24 * 60 * 60 * 1000) {
      return res.status(400).json({ error: "Arrival time must be within the next 7 days" });
    }

    // Destination must be a real network hub.
    const [destHub] = await db.select().from(hubs).where(and(eq(hubs.id, String(hubId || "")), eq(hubs.status, "active")));
    if (!destHub) return res.status(400).json({ error: "Pick a destination from the list" });

    // Pickup: either device location or another hub.
    let pLat: number, pLng: number, pAddr: string;
    if (pickupHubId) {
      const [pHub] = await db.select().from(hubs).where(and(eq(hubs.id, String(pickupHubId)), eq(hubs.status, "active")));
      if (!pHub) return res.status(400).json({ error: "Pick a valid pickup point" });
      if (pHub.id === destHub.id) return res.status(400).json({ error: "Pickup and destination can't be the same place" });
      pLat = parseFloat(pHub.lat); pLng = parseFloat(pHub.lng); pAddr = `${pHub.name}, ${pHub.address}`;
    } else {
      pLat = parseFloat(pickupLat); pLng = parseFloat(pickupLng);
      if (isNaN(pLat) || isNaN(pLng) || Math.abs(pLat) > 90 || Math.abs(pLng) > 180) {
        return res.status(400).json({ error: "Share your location or pick a pickup point" });
      }
      pAddr = String(pickupAddress || "My location").trim().slice(0, 300) || "My location";
      // Sanity: pickup must be within ~150km of the destination hub.
      const dKm = calculateDistanceKm(pLat, pLng, parseFloat(destHub.lat), parseFloat(destHub.lng));
      if (dKm > 150) return res.status(400).json({ error: "Pickup looks too far from this destination — pick a pickup point from the list" });
    }

    // Guest account keyed by phone via namespaced email — never attaches to an
    // existing rider account, so nobody can book rides on someone else's profile.
    const guestEmail = `ontime_${digits}@web.travony`;
    let user = await storage.getUserByEmail(guestEmail);
    if (!user) {
      const regionCode = detectRegionFromCoordinates(pLat, pLng);
      user = await storage.createUser({
        email: guestEmail,
        name: cleanName,
        phone: normalizedPhone,
        role: "customer",
        isGuest: true,
        preferredLanguage: "en",
        regionCode,
      } as any);
    }

    const activeCount = await db
      .select({ id: scheduledArrivals.id })
      .from(scheduledArrivals)
      .where(and(eq(scheduledArrivals.userId, user.id), eq(scheduledArrivals.status, "active")));
    if (activeCount.length >= MAX_ACTIVE_PER_GUEST) {
      return res.status(429).json({ error: "You already have 3 upcoming arrivals — one has to happen first" });
    }

    const cat = CATEGORIES.includes(category) ? category : "other";
    const [created] = await db
      .insert(scheduledArrivals)
      .values({
        userId: user.id,
        label: `${destHub.name}`.slice(0, 80),
        category: cat,
        hubId: destHub.id,
        destAddress: `${destHub.name}, ${destHub.address}`.slice(0, 300),
        destLat: destHub.lat,
        destLng: destHub.lng,
        pickupAddress: pAddr,
        pickupLat: pLat.toString(),
        pickupLng: pLng.toString(),
        mode: "once",
        arriveAtUtc: arriveAt,
        tzOffsetMinutes: 0,
        bufferMinutes: DEFAULT_BUFFERS[cat] ?? 10,
        status: "active",
      })
      .returning();

    const times = computeTimes(created, new Date());
    res.status(201).json({
      success: true,
      rider: cleanName,
      destination: destHub.name,
      next: times
        ? {
            arriveBy: times.deadline.toISOString(),
            pickupAt: times.pickupAt.toISOString(),
            dispatchAt: times.dispatchAt.toISOString(),
            etaMin: times.etaMin,
            distanceKm: Math.round(times.distanceKm * 10) / 10,
            bufferMinutes: created.bufferMinutes,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[OnTimeArrivals] try endpoint error:", error);
    res.status(500).json({ error: "Something went wrong — try again" });
  }
});

export const scheduledArrivalsRouter = router;
