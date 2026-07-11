import { Router } from "express";
import { db } from "./db";
import {
  prayerRideSubscriptions,
  prayerRideDispatches,
  rides,
  hubs,
  drivers,
  type PrayerRideSubscription,
  type Driver,
} from "@shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { storage } from "./storage";
import { generateRideHash } from "./blockchain";
import { notifyOnlineDriversOfNewRide } from "./rideNotifications";
import { randomUUID } from "crypto";
import { getRegionByCode, detectRegionFromCoordinates } from "./regionService";
import { getPrayerTimesAround, PRAYER_NAMES, type PrayerName } from "./prayerTimes";
import { sendTelegramMessage } from "./telegramBot";
import { sendSmsMessage } from "./twilioService";
import { sendStatusUpdateEmail } from "./email";

// Prayer Rides deadline engine.
// Generic "deadline ride" math shared with On-Time Arrivals:
//   pickup time = deadline − travel ETA − buffer
//   dispatch    = pickup − DISPATCH_LEAD_MIN
// Here the deadline is the next prayer time at the rider's mosque (live from
// the Aladhan API) and the buffer is the wudu buffer (default 10 min).

const DISPATCH_LEAD_MIN = 7;
const ACTIVE_RIDE_STATUSES = ["pending", "accepted", "arriving", "started", "in_progress"] as const;

// Prayer-Pause: within this window before a chosen prayer, an opted-in driver
// stops seeing long trips and is prioritized for mosque-bound rides.
export const PRAYER_PAUSE_WINDOW_MIN = 30;
export const LONG_TRIP_KM = 10;

const SELECTABLE_PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha", "jumuah"] as const;
type SelectablePrayer = (typeof SELECTABLE_PRAYERS)[number];

const PRAYER_LABELS: Record<string, string> = {
  fajr: "Fajr",
  dhuhr: "Dhuhr",
  asr: "Asr",
  maghrib: "Maghrib",
  isha: "Isha",
  jumuah: "Jumu'ah",
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Same ETA model every other ride path uses (no new map provider).
function etaFromDistanceKm(distanceKm: number): number {
  return Math.max(2, Math.round((distanceKm / 25) * 60));
}

function parsePrayers(csv: string | null | undefined): SelectablePrayer[] {
  return String(csv || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is SelectablePrayer => (SELECTABLE_PRAYERS as readonly string[]).includes(s));
}

// ---- Occurrence math -------------------------------------------------------

export interface PrayerOccurrence {
  prayer: SelectablePrayer;
  prayerLabel: string;
  prayerTime: Date;
  dayKey: string;
  tzOffsetMinutes: number;
  key: string; // `${prayer}:${dayKey}` — idempotency key
}

/**
 * Upcoming prayer occurrences (today + tomorrow) for a set of selected
 * prayers at the given coordinates, sorted by time. Jumu'ah maps to Dhuhr
 * time on Fridays; when Jumu'ah is selected it replaces Dhuhr on Friday.
 */
export async function upcomingPrayerOccurrences(
  lat: number,
  lng: number,
  selected: SelectablePrayer[],
  now = new Date(),
): Promise<PrayerOccurrence[]> {
  const days = await getPrayerTimesAround(lat, lng, now);
  const out: PrayerOccurrence[] = [];
  for (const day of days) {
    for (const p of PRAYER_NAMES as PrayerName[]) {
      let occPrayer: SelectablePrayer | null = null;
      if (p === "dhuhr" && day.isFriday) {
        if (selected.includes("jumuah")) occPrayer = "jumuah";
        else if (selected.includes("dhuhr")) occPrayer = "dhuhr";
      } else if (selected.includes(p)) {
        occPrayer = p;
      }
      if (!occPrayer) continue;
      const t = day.times[p];
      if (t.getTime() < now.getTime() - 5 * 60 * 1000) continue; // already passed
      out.push({
        prayer: occPrayer,
        prayerLabel: PRAYER_LABELS[occPrayer],
        prayerTime: t,
        dayKey: day.dayKey,
        tzOffsetMinutes: day.tzOffsetMinutes,
        key: `${occPrayer}:${day.dayKey}`,
      });
    }
  }
  out.sort((a, b) => a.prayerTime.getTime() - b.prayerTime.getTime());
  return out;
}

export interface ComputedPrayerRide extends PrayerOccurrence {
  distanceKm: number;
  etaMin: number;
  pickupAt: Date;
  dispatchAt: Date;
}

export function computePrayerRideTimes(sub: PrayerRideSubscription, occ: PrayerOccurrence): ComputedPrayerRide {
  const distanceKm = haversineKm(
    parseFloat(sub.pickupLat), parseFloat(sub.pickupLng),
    parseFloat(sub.mosqueLat), parseFloat(sub.mosqueLng),
  );
  const etaMin = etaFromDistanceKm(distanceKm);
  const pickupAt = new Date(occ.prayerTime.getTime() - (etaMin + sub.bufferMinutes) * 60 * 1000);
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

async function getDispatchRecord(subscriptionId: string, occ: PrayerOccurrence) {
  const [row] = await db
    .select()
    .from(prayerRideDispatches)
    .where(and(
      eq(prayerRideDispatches.subscriptionId, subscriptionId),
      eq(prayerRideDispatches.prayer, occ.prayer),
      eq(prayerRideDispatches.dayKey, occ.dayKey),
    ))
    .limit(1);
  return row || null;
}

function fmtLocalTime(d: Date, tzOffsetMinutes: number): string {
  // Format in the mosque's local time using the UTC offset the Aladhan API
  // reported for this location.
  const local = new Date(d.getTime() + tzOffsetMinutes * 60 * 1000);
  const hh = local.getUTCHours();
  const mm = local.getUTCMinutes().toString().padStart(2, "0");
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${h12}:${mm} ${hh < 12 ? "AM" : "PM"}`;
}

async function notifyRiderLockedIn(sub: PrayerRideSubscription, times: ComputedPrayerRide): Promise<void> {
  try {
    const rider = await storage.getUser(sub.userId);
    if (!rider) return;
    const pickupStr = fmtLocalTime(times.pickupAt, times.tzOffsetMinutes);
    const msg =
      `Your ride is booked. Driver arrives at ${pickupStr} so you reach ${sub.mosqueName} before ${times.prayerLabel}. This ride is free — no charge.`;

    if (rider.telegramChatId) {
      await sendTelegramMessage(rider.telegramChatId, `\u{1F54C} <b>Prayer Ride locked in</b>\n\n${msg}`).catch(() => {});
    }
    if (rider.phone && /^\+?[1-9]\d{6,14}$/.test(rider.phone.replace(/[\s-]/g, ""))) {
      await sendSmsMessage(rider.phone, `Travony: ${msg}`).catch(() => {});
    }
    if (rider.email && rider.email.includes("@") && !rider.email.endsWith("@phone.travony.local")) {
      sendStatusUpdateEmail({
        to: rider.email,
        subject: `Prayer Ride booked — ${times.prayerLabel} at ${sub.mosqueName}`,
        headerSubtitle: "Prayer Rides",
        heading: "Your ride is booked",
        bodyHtml: `<p style="margin:0 0 16px;color:#555;font-size:14px;line-height:1.6;">${msg}</p>`,
      });
    }
  } catch (error) {
    console.error("[PrayerRides] rider lock-in notification error:", error);
  }
}

async function dispatchPrayerRide(sub: PrayerRideSubscription, times: ComputedPrayerRide): Promise<void> {
  const pickupLat = parseFloat(sub.pickupLat);
  const pickupLng = parseFloat(sub.pickupLng);
  const destLat = parseFloat(sub.mosqueLat);
  const destLng = parseFloat(sub.mosqueLng);

  // Idempotency: claim the (subscription, prayer, day) slot FIRST. The unique
  // constraint makes concurrent/repeated ticks a no-op.
  let dispatchId: string;
  try {
    const [claimed] = await db
      .insert(prayerRideDispatches)
      .values({
        subscriptionId: sub.id,
        userId: sub.userId,
        prayer: times.prayer,
        dayKey: times.dayKey,
        status: "dispatched",
      })
      .onConflictDoNothing()
      .returning({ id: prayerRideDispatches.id });
    if (!claimed) return; // already dispatched or skipped
    dispatchId = claimed.id;
  } catch {
    return;
  }

  // Region, currency and fee % derived server-side from pickup coords —
  // same trust boundary as every other ride creation path.
  const regionCode = detectRegionFromCoordinates(pickupLat, pickupLng);
  const region = await getRegionByCode(regionCode).catch(() => null);
  const currency = region?.currency || "AED";

  // Prayer rides are FREE — the rider pays nothing, there is no platform fee,
  // and no driver earnings. Drivers accept these voluntarily; every completed
  // prayer ride counts toward the driver's prayer rides badge instead.
  const fare = 0;
  const fees = { platformFee: 0, driverShare: 0 };

  const rideId = randomUUID();
  const dropoffAddress = sub.mosqueAddress || sub.mosqueName;
  const blockchainHash = generateRideHash({
    rideId,
    customerId: sub.userId,
    driverId: "pending",
    pickupAddress: sub.pickupAddress,
    dropoffAddress,
    fare,
    platformFee: fees.platformFee,
    driverShare: fees.driverShare,
    timestamp: new Date(),
  } as any);

  await storage.createRide({
    id: rideId,
    customerId: sub.userId,
    serviceTypeId: "st-economy",
    pickupAddress: sub.pickupAddress,
    pickupLat: sub.pickupLat,
    pickupLng: sub.pickupLng,
    dropoffAddress,
    dropoffLat: sub.mosqueLat,
    dropoffLng: sub.mosqueLng,
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

  await db
    .update(prayerRideDispatches)
    .set({ rideId })
    .where(eq(prayerRideDispatches.id, dispatchId));

  // Broadcast to ALL online drivers — same rule as every pending ride.
  notifyOnlineDriversOfNewRide(rideId).catch((error) =>
    console.error("[PrayerRides] broadcast error:", error),
  );

  notifyRiderLockedIn(sub, times).catch(() => {});

  console.log(
    `[PrayerRides] Dispatched ride ${rideId} for ${times.prayerLabel} at "${sub.mosqueName}" (prayer ${times.prayerTime.toISOString()}, pickup ${times.pickupAt.toISOString()})`,
  );
}

let engineStarted = false;
let ticking = false;

export async function runPrayerRidesTick(now = new Date()): Promise<void> {
  const subs = await db
    .select()
    .from(prayerRideSubscriptions)
    .where(eq(prayerRideSubscriptions.status, "active"));

  for (const sub of subs) {
    try {
      const selected = parsePrayers(sub.prayers);
      if (selected.length === 0) continue;
      const occurrences = await upcomingPrayerOccurrences(
        parseFloat(sub.mosqueLat), parseFloat(sub.mosqueLng), selected, now,
      );
      for (const occ of occurrences) {
        const times = computePrayerRideTimes(sub, occ);
        if (now.getTime() < times.dispatchAt.getTime()) break; // occurrences sorted — nothing due yet
        if (now.getTime() > times.prayerTime.getTime()) continue; // too late to help
        const existing = await getDispatchRecord(sub.id, occ);
        if (existing) continue; // dispatched or skipped
        if (await riderHasActiveRide(sub.userId)) {
          console.log(`[PrayerRides] Skipping ${occ.prayer} for user ${sub.userId} — active ride exists`);
          continue;
        }
        await dispatchPrayerRide(sub, times);
        break; // one prayer ride at a time per subscription
      }
    } catch (error) {
      console.error(`[PrayerRides] tick error for subscription ${sub.id}:`, error);
    }
  }
}

export function startPrayerRidesEngine(): void {
  if (engineStarted) return;
  engineStarted = true;
  setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      await runPrayerRidesTick();
    } catch (error) {
      console.error("[PrayerRides] engine error:", error);
    } finally {
      ticking = false;
    }
  }, 60 * 1000);
  console.log("[PrayerRides] Engine started (60s tick)");
}

// ---- Prayer-Pause (drivers) ------------------------------------------------

export interface PrayerPauseState {
  active: boolean;
  prayer?: string;
  prayerLabel?: string;
  prayerTime?: Date;
  until?: Date;
}

/**
 * Is this driver inside their Prayer-Pause window (within 30 min before a
 * selected prayer)? Uses the driver's last known location for prayer times.
 */
export async function getDriverPrayerPauseState(driver: Driver, now = new Date()): Promise<PrayerPauseState> {
  if (!driver.prayerPauseEnabled) return { active: false };
  const lat = parseFloat(driver.currentLat || "");
  const lng = parseFloat(driver.currentLng || "");
  if (isNaN(lat) || isNaN(lng)) return { active: false };
  const selected = parsePrayers(driver.prayerPausePrayers || "fajr,dhuhr,asr,maghrib,isha");
  if (selected.length === 0) return { active: false };
  try {
    const occurrences = await upcomingPrayerOccurrences(lat, lng, selected, now);
    for (const occ of occurrences) {
      const windowStart = occ.prayerTime.getTime() - PRAYER_PAUSE_WINDOW_MIN * 60 * 1000;
      if (now.getTime() >= windowStart && now.getTime() <= occ.prayerTime.getTime()) {
        return {
          active: true,
          prayer: occ.prayer,
          prayerLabel: occ.prayerLabel,
          prayerTime: occ.prayerTime,
          until: occ.prayerTime,
        };
      }
    }
  } catch (error) {
    console.error("[PrayerRides] prayer pause state error:", error);
  }
  return { active: false };
}

let mosqueHubCache: { hubs: { id: string; lat: number; lng: number; radiusMeters: number }[]; expiresAt: number } | null = null;

export async function getMosqueHubZones(): Promise<{ id: string; lat: number; lng: number; radiusMeters: number }[]> {
  if (mosqueHubCache && mosqueHubCache.expiresAt > Date.now()) return mosqueHubCache.hubs;
  const rows = await db
    .select({ id: hubs.id, lat: hubs.lat, lng: hubs.lng, radiusMeters: hubs.radiusMeters })
    .from(hubs)
    .where(and(eq(hubs.type, "mosque"), eq(hubs.status, "active")));
  const zones = rows.map((h) => ({
    id: h.id,
    lat: parseFloat(h.lat),
    lng: parseFloat(h.lng),
    radiusMeters: h.radiusMeters || 300,
  }));
  mosqueHubCache = { hubs: zones, expiresAt: Date.now() + 5 * 60 * 1000 };
  return zones;
}

export function isMosqueDestination(
  dropoffLat: number | string | null | undefined,
  dropoffLng: number | string | null | undefined,
  zones: { lat: number; lng: number; radiusMeters: number }[],
): boolean {
  const lat = parseFloat(String(dropoffLat ?? ""));
  const lng = parseFloat(String(dropoffLng ?? ""));
  if (isNaN(lat) || isNaN(lng)) return false;
  return zones.some((z) => haversineKm(lat, lng, z.lat, z.lng) * 1000 <= Math.max(z.radiusMeters, 500));
}

export function rideDistanceKm(ride: {
  pickupLat?: string | null; pickupLng?: string | null;
  dropoffLat?: string | null; dropoffLng?: string | null;
  distance?: string | null;
}): number {
  const stored = parseFloat(String(ride.distance ?? ""));
  if (!isNaN(stored) && stored > 0) return stored;
  const pLat = parseFloat(String(ride.pickupLat ?? ""));
  const pLng = parseFloat(String(ride.pickupLng ?? ""));
  const dLat = parseFloat(String(ride.dropoffLat ?? ""));
  const dLng = parseFloat(String(ride.dropoffLng ?? ""));
  if ([pLat, pLng, dLat, dLng].some(isNaN)) return 0;
  return haversineKm(pLat, pLng, dLat, dLng);
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

async function serializeSubscription(sub: PrayerRideSubscription, now: Date) {
  let next: any = null;
  if (sub.status === "active") {
    try {
      const selected = parsePrayers(sub.prayers);
      const occurrences = await upcomingPrayerOccurrences(
        parseFloat(sub.mosqueLat), parseFloat(sub.mosqueLng), selected, now,
      );
      for (const occ of occurrences) {
        const times = computePrayerRideTimes(sub, occ);
        if (now.getTime() > times.prayerTime.getTime()) continue;
        const record = await getDispatchRecord(sub.id, occ);
        next = {
          prayer: occ.prayer,
          prayerLabel: occ.prayerLabel,
          prayerTime: times.prayerTime.toISOString(),
          pickupAt: times.pickupAt.toISOString(),
          dispatchAt: times.dispatchAt.toISOString(),
          etaMin: times.etaMin,
          distanceKm: Math.round(times.distanceKm * 10) / 10,
          arriveMinutesBefore: sub.bufferMinutes,
          dayKey: occ.dayKey,
          skipped: record?.status === "skipped",
          dispatched: record?.status === "dispatched",
          rideId: record?.rideId || null,
        };
        break;
      }
    } catch (error) {
      console.error("[PrayerRides] serialize error:", error);
    }
  }
  return { ...sub, next };
}

// Mosque hubs for the picker.
router.get("/api/prayer-rides/mosques", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(hubs)
      .where(and(eq(hubs.type, "mosque"), eq(hubs.status, "active")));
    res.json(rows.map((h) => ({
      id: h.id,
      name: h.name,
      address: h.address,
      lat: h.lat,
      lng: h.lng,
      regionCode: h.regionCode,
      description: h.description,
    })));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load mosques" });
  }
});

// Today's prayer times for a location (setup screen preview).
router.get("/api/prayer-rides/times", async (req, res) => {
  try {
    const lat = parseFloat(String(req.query.lat));
    const lng = parseFloat(String(req.query.lng));
    if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: "lat and lng are required" });
    const days = await getPrayerTimesAround(lat, lng, new Date());
    const today = days[0];
    res.json({
      dayKey: today.dayKey,
      isFriday: today.isFriday,
      times: Object.fromEntries(
        (PRAYER_NAMES as PrayerName[]).map((p) => [p, today.times[p].toISOString()]),
      ),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load prayer times" });
  }
});

router.get("/api/prayer-rides", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const subs = await db
      .select()
      .from(prayerRideSubscriptions)
      .where(eq(prayerRideSubscriptions.userId, session.userId))
      .orderBy(desc(prayerRideSubscriptions.createdAt));
    const now = new Date();
    const out = [];
    for (const s of subs) out.push(await serializeSubscription(s, now));
    res.json(out);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load prayer rides" });
  }
});

router.post("/api/prayer-rides", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId, pickupAddress, pickupLat, pickupLng, prayers, bufferMinutes } = req.body || {};

    if (!hubId) return res.status(400).json({ error: "Choose your mosque" });
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, String(hubId)));
    if (!hub || hub.type !== "mosque") return res.status(400).json({ error: "Choose a mosque from the list" });

    const pLat = parseFloat(pickupLat), pLng = parseFloat(pickupLng);
    if (!pickupAddress || isNaN(pLat) || isNaN(pLng)) {
      return res.status(400).json({ error: "Pickup location is required" });
    }

    const selected = parsePrayers(Array.isArray(prayers) ? prayers.join(",") : String(prayers || ""));
    if (selected.length === 0) return res.status(400).json({ error: "Pick at least one prayer" });

    const buffer = Number.isFinite(parseInt(bufferMinutes, 10))
      ? Math.min(60, Math.max(0, parseInt(bufferMinutes, 10)))
      : 10;

    // One subscription per rider — creating again replaces the old one.
    const existing = await db
      .select()
      .from(prayerRideSubscriptions)
      .where(eq(prayerRideSubscriptions.userId, session.userId));

    const values = {
      hubId: hub.id,
      mosqueName: hub.name,
      mosqueAddress: hub.address,
      mosqueLat: hub.lat,
      mosqueLng: hub.lng,
      pickupAddress: String(pickupAddress).slice(0, 300),
      pickupLat: pLat.toString(),
      pickupLng: pLng.toString(),
      prayers: selected.join(","),
      bufferMinutes: buffer,
      status: "active" as const,
      updatedAt: new Date(),
    };

    let sub: PrayerRideSubscription;
    if (existing.length > 0) {
      const [updated] = await db
        .update(prayerRideSubscriptions)
        .set(values)
        .where(eq(prayerRideSubscriptions.id, existing[0].id))
        .returning();
      sub = updated;
    } else {
      const [created] = await db
        .insert(prayerRideSubscriptions)
        .values({ ...values, userId: session.userId })
        .returning();
      sub = created;
    }

    res.status(201).json(await serializeSubscription(sub, new Date()));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to save prayer rides" });
  }
});

router.patch("/api/prayer-rides/:id", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const [sub] = await db
      .select()
      .from(prayerRideSubscriptions)
      .where(eq(prayerRideSubscriptions.id, req.params.id));
    if (!sub || sub.userId !== session.userId) return res.status(404).json({ error: "Not found" });

    const { action } = req.body || {};

    if (action === "pause") {
      await db.update(prayerRideSubscriptions).set({ status: "paused", updatedAt: new Date() }).where(eq(prayerRideSubscriptions.id, sub.id));
    } else if (action === "resume") {
      await db.update(prayerRideSubscriptions).set({ status: "active", updatedAt: new Date() }).where(eq(prayerRideSubscriptions.id, sub.id));
    } else if (action === "skip") {
      // One-tap skip of the next upcoming prayer ride: claim its idempotency
      // slot with status "skipped" so the engine passes it over.
      const selected = parsePrayers(sub.prayers);
      const occurrences = await upcomingPrayerOccurrences(
        parseFloat(sub.mosqueLat), parseFloat(sub.mosqueLng), selected, new Date(),
      );
      const nextOcc = occurrences[0];
      if (!nextOcc) return res.status(400).json({ error: "Nothing upcoming to skip" });
      const existing = await getDispatchRecord(sub.id, nextOcc);
      if (existing?.status === "dispatched" && existing.rideId) {
        return res.status(400).json({ error: "This ride is already booked — cancel it from your rides instead" });
      }
      if (!existing) {
        await db.insert(prayerRideDispatches).values({
          subscriptionId: sub.id,
          userId: sub.userId,
          prayer: nextOcc.prayer,
          dayKey: nextOcc.dayKey,
          status: "skipped",
        }).onConflictDoNothing();
      }
    } else {
      return res.status(400).json({ error: "Nothing to update" });
    }

    const [fresh] = await db.select().from(prayerRideSubscriptions).where(eq(prayerRideSubscriptions.id, sub.id));
    res.json(await serializeSubscription(fresh, new Date()));
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update" });
  }
});

router.delete("/api/prayer-rides/:id", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [sub] = await db
      .select()
      .from(prayerRideSubscriptions)
      .where(eq(prayerRideSubscriptions.id, req.params.id));
    if (!sub || sub.userId !== session.userId) return res.status(404).json({ error: "Not found" });
    await db.delete(prayerRideSubscriptions).where(eq(prayerRideSubscriptions.id, sub.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete" });
  }
});

// ---- Driver Prayer-Pause endpoints ----

router.patch("/api/drivers/prayer-pause", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driver = await storage.getOrCreateDriver(session.userId, { status: "pending", isOnline: false });

    const { enabled, prayers } = req.body || {};
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (typeof enabled === "boolean") updates.prayerPauseEnabled = enabled;
    if (prayers !== undefined) {
      const selected = parsePrayers(Array.isArray(prayers) ? prayers.join(",") : String(prayers || ""));
      if (selected.length === 0) return res.status(400).json({ error: "Pick at least one prayer" });
      updates.prayerPausePrayers = selected.join(",");
    }
    if (Object.keys(updates).length === 1) return res.status(400).json({ error: "Nothing to update" });

    const [updated] = await db
      .update(drivers)
      .set(updates)
      .where(eq(drivers.id, driver.id))
      .returning();
    res.json({
      prayerPauseEnabled: updated.prayerPauseEnabled,
      prayerPausePrayers: updated.prayerPausePrayers,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to update Prayer-Pause" });
  }
});

router.get("/api/drivers/prayer-pause/status", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const driver = await storage.getOrCreateDriver(session.userId, { status: "pending", isOnline: false });
    const state = await getDriverPrayerPauseState(driver);
    res.json({
      enabled: !!driver.prayerPauseEnabled,
      prayers: driver.prayerPausePrayers || "fajr,dhuhr,asr,maghrib,isha",
      active: state.active,
      prayer: state.prayer || null,
      prayerLabel: state.prayerLabel || null,
      until: state.until ? state.until.toISOString() : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to load Prayer-Pause status" });
  }
});

export const prayerRidesRouter = router;
