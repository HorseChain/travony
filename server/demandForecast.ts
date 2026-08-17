// City Brain demand forecast — deterministic prediction of where rides will
// happen next, built ONLY from real ride history plus event overlays (prayer
// times). The forecast math is pure arithmetic over zone × hour-of-week
// rollups; the LLM's only job is to phrase the human explanation sentence,
// and its output is guarded so it can never introduce numbers we didn't
// compute ourselves. Earnings figures never come from here — they stay with
// computeAreaYieldPerHour (real completed rides or nothing).
import { Router } from "express";
import OpenAI from "openai";
import { db } from "./db";
import { cities, forecastRecommendations } from "@shared/schema";
import { eq, sql } from "drizzle-orm";
import { storage } from "./storage";
import { getZoneId, getZoneCenter } from "./cityBrain";
import { getPrayerTimesAround, PRAYER_NAMES, type PrayerName } from "./prayerTimes";

const ZONE_DEG = 0.027; // ~3km grid, must match cityBrain's getZoneId
const LOOKBACK_DAYS = 56; // 8 weeks
const ADVISORY_LOCK_ID = 894217306; // autopilot=...304, travonyTv=...305
const WINDOW_MINUTES = 60; // recommendation window for outcome tracking

// ---------------------------------------------------------------------------
// 1) History rollup — zone × hour-of-week ride counts, refreshed on a schedule
// ---------------------------------------------------------------------------

// Full rebuild of the rollup inside one transaction, serialized across
// instances by a transaction-scoped advisory lock. hour-of-week is derived
// from the stored UTC timestamp: a zone sits at a fixed longitude, so its UTC
// hour maps to a fixed local hour — patterns stay consistent per zone.
export async function refreshDemandHistory(): Promise<boolean> {
  return await db.transaction(async (tx) => {
    const lock = await tx.execute(sql`SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_ID}) AS locked`);
    const locked = (lock.rows?.[0] as any)?.locked === true;
    if (!locked) return false;

    await tx.execute(sql`DELETE FROM zone_demand_history`);
    await tx.execute(sql`
      INSERT INTO zone_demand_history (zone_id, hour_of_week, ride_count, weeks_span, updated_at)
      SELECT
        (floor(pickup_lat::numeric / ${sql.raw(String(ZONE_DEG))})::int)::text || '_' || (floor(pickup_lng::numeric / ${sql.raw(String(ZONE_DEG))})::int)::text AS zone_id,
        (extract(dow FROM created_at)::int * 24 + extract(hour FROM created_at)::int) AS hour_of_week,
        count(*)::int AS ride_count,
        greatest(1, least(8, ceil(extract(epoch FROM (now() - (SELECT min(created_at) FROM rides WHERE created_at >= now() - ${sql.raw(`interval '${LOOKBACK_DAYS} days'`)}))) / 604800)::int)) AS weeks_span,
        now() AS updated_at
      FROM rides
      WHERE created_at >= now() - ${sql.raw(`interval '${LOOKBACK_DAYS} days'`)}
        AND pickup_lat IS NOT NULL
        AND pickup_lng IS NOT NULL
      GROUP BY 1, 2
    `);
    return true;
  });
}

async function historyIsStale(): Promise<boolean> {
  const r = await db.execute(sql`SELECT max(updated_at) AS latest FROM zone_demand_history`);
  const latest = (r.rows?.[0] as any)?.latest;
  if (!latest) return true;
  return Date.now() - new Date(latest).getTime() > 6 * 60 * 60 * 1000;
}

// ---------------------------------------------------------------------------
// 2) Event overlays — hooks that boost zones for known upcoming events.
//    Prayer times are the only built-in overlay; new overlays plug in here.
//    Overlays NEVER invent earnings figures — they only shift ranking scores
//    and contribute a factual label for the reason line.
// ---------------------------------------------------------------------------

export interface OverlayEffect {
  zoneId: string;
  boost: number; // multiplier bonus, e.g. 0.75 => score * 1.75
  type: string; // "prayer" | future overlay types
  label: string; // factual, human-readable, e.g. "Friday prayer ~12:40 near Al Barsha Mosque"
}

type OverlayProvider = (centerLat: number, centerLng: number, now: Date) => Promise<OverlayEffect[]>;

let mosqueCache: { rows: { id: string; name: string; lat: number; lng: number }[]; expiresAt: number } | null = null;
async function getMosqueHubsWithNames(): Promise<{ id: string; name: string; lat: number; lng: number }[]> {
  if (mosqueCache && mosqueCache.expiresAt > Date.now()) return mosqueCache.rows;
  const r = await db.execute(sql`SELECT id, name, lat, lng FROM hubs WHERE type = 'mosque' AND status = 'active'`);
  const rows = (r.rows as any[]).map((h) => ({
    id: String(h.id),
    name: String(h.name),
    lat: parseFloat(h.lat),
    lng: parseFloat(h.lng),
  })).filter((h) => !isNaN(h.lat) && !isNaN(h.lng));
  mosqueCache = { rows, expiresAt: Date.now() + 5 * 60 * 1000 };
  return rows;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function fmtLocalTime(t: Date, tzOffsetMinutes: number): string {
  return new Date(t.getTime() + tzOffsetMinutes * 60 * 1000).toISOString().slice(11, 16);
}

const PRAYER_LABEL: Record<PrayerName, string> = {
  fajr: "Fajr prayer",
  dhuhr: "Dhuhr prayer",
  asr: "Asr prayer",
  maghrib: "Maghrib prayer",
  isha: "Isha prayer",
};

// Prayer overlay: a mosque hub whose prayer starts within the next ~75 minutes
// (or started in the last 25 — the post-prayer exit wave) boosts its zone.
const prayerOverlay: OverlayProvider = async (centerLat, centerLng, now) => {
  const effects: OverlayEffect[] = [];
  const mosques = (await getMosqueHubsWithNames()).filter(
    (m) => haversineKm(centerLat, centerLng, m.lat, m.lng) <= 12,
  );
  for (const m of mosques.slice(0, 6)) {
    try {
      // Bounded wait: on a cold cache the prayer-times fetch can be slow; a
      // driver poll must never stall on it. The underlying fetch still
      // completes and warms the cache for the next poll.
      const days = await Promise.race([
        getPrayerTimesAround(m.lat, m.lng, now),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("overlay timeout")), 1500)),
      ]);
      for (const day of days) {
        for (const p of PRAYER_NAMES) {
          const t = day.times[p];
          const deltaMin = (t.getTime() - now.getTime()) / 60000;
          if (deltaMin >= -25 && deltaMin <= 75) {
            const isJumuah = day.isFriday && p === "dhuhr";
            const name = isJumuah ? "Friday prayer" : PRAYER_LABEL[p];
            const local = fmtLocalTime(t, day.tzOffsetMinutes);
            effects.push({
              zoneId: getZoneId(m.lat, m.lng),
              boost: isJumuah ? 1.0 : 0.6,
              type: "prayer",
              label: `${name} ~${local} near ${m.name}`,
            });
          }
        }
      }
    } catch {
      // Prayer times API unavailable — forecast simply runs without the overlay.
    }
  }
  return effects;
};

const overlayProviders: OverlayProvider[] = [prayerOverlay];

// ---------------------------------------------------------------------------
// 3) Forecast — deterministic score per zone for the next hour
// ---------------------------------------------------------------------------

export interface ZoneForecast {
  zoneId: string;
  lat: number;
  lng: number;
  distanceKm: number;
  // Real historical average for this hour-of-week (rides per week ÷ weeks).
  expectedRidesPerHour: number;
  score: number; // ranking score (expected × overlay multiplier)
  confidence: number; // 0..1, honest — grows with samples and weeks of coverage
  weeksSpan: number;
  sampleCount: number;
  overlays: OverlayEffect[];
}

function candidateZoneIds(lat: number, lng: number, radiusKm: number): string[] {
  const latCells = Math.ceil(radiusKm / (ZONE_DEG * 111));
  const lngCells = Math.ceil(radiusKm / (ZONE_DEG * 111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180))));
  const baseLat = Math.floor(lat / ZONE_DEG);
  const baseLng = Math.floor(lng / ZONE_DEG);
  const ids: string[] = [];
  for (let dy = -latCells; dy <= latCells; dy++) {
    for (let dx = -lngCells; dx <= lngCells; dx++) {
      ids.push(`${baseLat + dy}_${baseLng + dx}`);
    }
  }
  return ids;
}

export async function forecastZonesNear(lat: number, lng: number, radiusKm = 8, now = new Date()): Promise<ZoneForecast[]> {
  const ids = candidateZoneIds(lat, lng, radiusKm);
  if (ids.length === 0) return [];

  // Blend this UTC hour-of-week with the next one by minutes-into-hour, so the
  // forecast looks at "the coming 60 minutes", not a hard hour boundary.
  const how = now.getUTCDay() * 24 + now.getUTCHours();
  const howNext = (how + 1) % 168;
  const frac = now.getUTCMinutes() / 60;

  const idArray = sql.join(ids.map((id) => sql`${id}`), sql`, `);
  const r = await db.execute(sql`
    SELECT zone_id, hour_of_week, ride_count, weeks_span
    FROM zone_demand_history
    WHERE zone_id IN (${idArray}) AND hour_of_week IN (${how}, ${howNext})
  `);

  const byZone = new Map<string, { c0: number; c1: number; weeks: number }>();
  for (const row of r.rows as any[]) {
    const z = String(row.zone_id);
    const e = byZone.get(z) || { c0: 0, c1: 0, weeks: 1 };
    if (Number(row.hour_of_week) === how) e.c0 = Number(row.ride_count);
    else e.c1 = Number(row.ride_count);
    e.weeks = Math.max(e.weeks, Number(row.weeks_span) || 1);
    byZone.set(z, e);
  }

  const overlays: OverlayEffect[] = [];
  for (const provider of overlayProviders) {
    try {
      overlays.push(...(await provider(lat, lng, now)));
    } catch {
      // an overlay failing must never take the forecast down
    }
  }
  const overlaysByZone = new Map<string, OverlayEffect[]>();
  for (const o of overlays) {
    const list = overlaysByZone.get(o.zoneId) || [];
    list.push(o);
    overlaysByZone.set(o.zoneId, list);
  }

  // Zones with either history or an active overlay are candidates.
  const zoneIds = new Set<string>([...byZone.keys(), ...overlaysByZone.keys()]);
  const out: ZoneForecast[] = [];
  for (const zoneId of zoneIds) {
    if (!ids.includes(zoneId)) continue;
    const center = getZoneCenter(zoneId);
    const distanceKm = haversineKm(lat, lng, center.lat, center.lng);
    if (distanceKm > radiusKm) continue;

    const hist = byZone.get(zoneId) || { c0: 0, c1: 0, weeks: 1 };
    const zoneOverlays = overlaysByZone.get(zoneId) || [];
    const expected = (hist.c0 * (1 - frac) + hist.c1 * frac) / Math.max(1, hist.weeks);
    const boost = zoneOverlays.reduce((s, o) => s + o.boost, 0);
    // Overlay-only zones (no history yet) get a small base score so a mosque
    // at prayer time can surface, but their confidence stays low and no
    // earnings figure is ever attached without real rides.
    const score = expected * (1 + boost) + (zoneOverlays.length > 0 && expected === 0 ? 0.4 : 0);
    if (score <= 0) continue;

    const samples = hist.c0 + hist.c1;
    const confidence = Math.min(
      0.9,
      Math.round(
        (0.1 + 0.6 * (samples / (samples + 8)) + 0.2 * Math.min(1, hist.weeks / 8) + (zoneOverlays.length > 0 ? 0.05 : 0)) * 100,
      ) / 100,
    );

    out.push({
      zoneId,
      lat: center.lat,
      lng: center.lng,
      distanceKm: Math.round(distanceKm * 10) / 10,
      expectedRidesPerHour: Math.round(expected * 100) / 100,
      score: Math.round(score * 1000) / 1000,
      confidence,
      weeksSpan: hist.weeks,
      sampleCount: samples,
      overlays: zoneOverlays,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}

// The single best forecast zone for a driver to reposition toward: not the
// zone they're already in, close enough to matter, strong enough to be worth
// the drive. Deterministic.
export async function getTopForecastZone(lat: number, lng: number, now = new Date()): Promise<ZoneForecast | null> {
  const currentZone = getZoneId(lat, lng);
  const zones = await forecastZonesNear(lat, lng, 8, now);
  const MIN_SCORE = 0.35;
  return zones.find((z) => z.zoneId !== currentZone && z.score >= MIN_SCORE) || null;
}

// Deterministic reason line — always available as the fallback (and the only
// source autopilot ever sees). Every number in it is real history.
export function deterministicForecastReason(z: ZoneForecast, etaMinutes: number): string {
  const overlay = z.overlays[0];
  if (overlay) {
    return `${overlay.label} — demand spike expected, ~${etaMinutes} min away`;
  }
  const perHour = Math.round(z.expectedRidesPerHour);
  if (perHour >= 2) {
    return `Usually about ${perHour} rides/hr here around this time (last ${z.weeksSpan} wk) — ~${etaMinutes} min away`;
  }
  return `Rides regularly start here around this time (last ${z.weeksSpan} wk) — ~${etaMinutes} min away`;
}

// ---------------------------------------------------------------------------
// 4) LLM explanation sentence — the ONLY thing the LLM writes. Guarded so it
//    cannot introduce numbers or money we didn't hand it; falls back to the
//    deterministic template on any failure.
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null;
function openaiClient(): OpenAI | null {
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) return null;
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

const reasonCache = new Map<string, { text: string; expiresAt: number }>();

function extractNumberTokens(s: string): string[] {
  return (s.match(/\d+(?:[.,:]\d+)*/g) || []).map((t) => t.replace(/[.,:]/g, ""));
}

const MONEY_WORDS = /(\$|€|£|aed|usd|bdt|pkr|inr|taka|dirham|rupee|dollar|euro|\/hr|per hour|earn)/i;

export async function llmForecastReason(z: ZoneForecast, etaMinutes: number): Promise<string> {
  const fallback = deterministicForecastReason(z, etaMinutes);
  const how = new Date().getUTCDay() * 24 + new Date().getUTCHours();
  const cacheKey = `${z.zoneId}:${how}:${z.overlays.map((o) => o.label).join("|")}`;
  const cached = reasonCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.text;

  const client = openaiClient();
  if (!client) return fallback;

  const facts = [
    z.overlays[0] ? `Event: ${z.overlays[0].label}` : null,
    z.expectedRidesPerHour >= 1 ? `Historical average: about ${Math.round(z.expectedRidesPerHour)} rides per hour at this time` : `Rides regularly start in this area at this time`,
    `History window: ${z.weeksSpan} weeks`,
    `Drive time: about ${etaMinutes} minutes`,
  ].filter(Boolean).join("\n");

  try {
    const resp = await client.chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_tokens: 60,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write ONE short sentence (max 130 characters) telling a ride-hail driver why a nearby area is worth heading to. Use ONLY the facts given. Never invent numbers, times, money, or place names. No emojis, no exclamation marks, plain confident tone.",
          },
          { role: "user", content: facts },
        ],
      },
      { timeout: 2500 },
    );
    const text = (resp.choices[0]?.message?.content || "").trim().replace(/\s+/g, " ");
    // Honesty guard: single short line, no new numbers, no money vocabulary.
    const allowed = new Set(extractNumberTokens(facts));
    const produced = extractNumberTokens(text);
    const ok =
      text.length > 0 &&
      text.length <= 140 &&
      !text.includes("\n") &&
      !MONEY_WORDS.test(text) &&
      produced.every((n) => allowed.has(n));
    const finalText = ok ? text : fallback;
    reasonCache.set(cacheKey, { text: finalText, expiresAt: Date.now() + 30 * 60 * 1000 });
    return finalText;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// 5) Outcome tracking — did a ride actually materialize in the recommended
//    zone within the window? Atomic per row (checked_at IS NULL claim).
// ---------------------------------------------------------------------------

export async function recordForecastServed(input: {
  driverId: string;
  zoneId: string;
  kind: string;
  lat: number;
  lng: number;
  score: number;
  confidence: number;
  reason: string;
}): Promise<void> {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + WINDOW_MINUTES * 60 * 1000);
  const windowKey = now.toISOString().slice(0, 13); // hour bucket for dedupe
  try {
    await db
      .insert(forecastRecommendations)
      .values({
        driverId: input.driverId,
        zoneId: input.zoneId,
        windowKey,
        kind: input.kind,
        lat: input.lat.toFixed(8),
        lng: input.lng.toFixed(8),
        score: input.score.toFixed(3),
        confidence: input.confidence.toFixed(3),
        reason: input.reason,
        windowStart: now,
        windowEnd,
      })
      .onConflictDoNothing();
  } catch (e) {
    console.error("[demandForecast] recordForecastServed failed:", e);
  }
}

export async function checkForecastOutcomes(): Promise<number> {
  const r = await db.execute(sql`
    UPDATE forecast_recommendations fr
    SET checked_at = now(),
        materialized_rides = c.cnt,
        materialized = c.cnt > 0
    FROM (
      SELECT fr2.id, (
        SELECT count(*)::int FROM rides r
        WHERE r.created_at >= fr2.window_start AND r.created_at < fr2.window_end
          AND r.pickup_lat IS NOT NULL
          AND r.pickup_lng IS NOT NULL
          AND (floor(r.pickup_lat::numeric / ${sql.raw(String(ZONE_DEG))})::int)::text || '_' || (floor(r.pickup_lng::numeric / ${sql.raw(String(ZONE_DEG))})::int)::text = fr2.zone_id
      ) AS cnt
      FROM forecast_recommendations fr2
      WHERE fr2.checked_at IS NULL AND fr2.window_end < now()
      LIMIT 500
    ) c
    WHERE fr.id = c.id AND fr.checked_at IS NULL
  `);
  return r.rowCount ?? 0;
}

export async function getForecastHitRate(): Promise<{
  checked: number;
  hits: number;
  hitRate: number | null;
  last7d: { checked: number; hits: number; hitRate: number | null };
}> {
  const r = await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE checked_at IS NOT NULL)::int AS checked,
      count(*) FILTER (WHERE materialized = true)::int AS hits,
      count(*) FILTER (WHERE checked_at IS NOT NULL AND created_at >= now() - interval '7 days')::int AS checked_7d,
      count(*) FILTER (WHERE materialized = true AND created_at >= now() - interval '7 days')::int AS hits_7d
    FROM forecast_recommendations
  `);
  const row = (r.rows?.[0] as any) || {};
  const checked = Number(row.checked || 0);
  const hits = Number(row.hits || 0);
  const checked7 = Number(row.checked_7d || 0);
  const hits7 = Number(row.hits_7d || 0);
  return {
    checked,
    hits,
    hitRate: checked > 0 ? Math.round((hits / checked) * 100) / 100 : null,
    last7d: { checked: checked7, hits: hits7, hitRate: checked7 > 0 ? Math.round((hits7 / checked7) * 100) / 100 : null },
  };
}

// ---------------------------------------------------------------------------
// 6) Engine — one 5-minute tick handles outcome checking and (when stale) the
//    history rollup refresh. Refresh is serialized via the advisory xact lock.
// ---------------------------------------------------------------------------

let engineStarted = false;

export function startDemandForecastEngine(): void {
  if (engineStarted) return;
  engineStarted = true;

  const tick = async () => {
    try {
      const checked = await checkForecastOutcomes();
      if (checked > 0) console.log(`[demandForecast] checked ${checked} recommendation outcomes`);
      if (await historyIsStale()) {
        const did = await refreshDemandHistory();
        if (did) console.log("[demandForecast] demand history rollup refreshed");
      }
    } catch (e) {
      console.error("[demandForecast] tick failed:", e);
    }
  };

  setTimeout(tick, 15 * 1000);
  setInterval(tick, 5 * 60 * 1000);
  console.log("[demandForecast] engine started (5-minute tick)");
}

// ---------------------------------------------------------------------------
// 7) Admin/debug view — forecast heat by zone per city + hit-rate metric.
//    Same guard as /api/debug/*: x-admin-token header (query token accepted
//    for the browser heat page only).
// ---------------------------------------------------------------------------

// JSON API: header-only, same as /api/debug/*. The admin token must never
// ride in a URL where it lands in logs/history/referrers.
function requireForecastAdmin(req: any, res: any, next: any) {
  const expected = process.env.ADMIN_DEBUG_TOKEN || process.env.ADMIN_PASSWORD;
  if (!expected || req.get("x-admin-token") !== expected) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

// Driver auth for the in-app forecast route: a Bearer session token that maps
// to a logged-in user WITH a driver record. Mirrors requireAuth + the
// getDriverByUserId lookup used by the /api/drivers/* endpoints. This route is
// NOT admin-gated — any signed-in driver can see forecasts for their location.
async function requireDriver(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  const session = await storage.getSession(token);
  if (!session || new Date() > session.expiresAt) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  const driver = await storage.getDriverByUserId(session.userId);
  if (!driver) {
    return res.status(403).json({ message: "Driver account required" });
  }
  req.driver = driver;
  next();
}

export const demandForecastRouter = Router();

// Driver-facing City Brain forecast: top zones near the driver's current
// location, each with the deterministic reason line and a drive-time ETA.
// coords are numeric (city-brain memory) — validate as finite numbers, no
// regex parsing. Returns { zones: [] } honestly when there's no signal.
demandForecastRouter.get("/api/driver/forecast", requireDriver, async (req: any, res: any) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "Provide finite lat & lng" });
    }
    const zones = await forecastZonesNear(lat, lng, 8);
    const top = zones.slice(0, 3).map((z) => {
      const etaMinutes = Math.max(2, Math.round((z.distanceKm / 22) * 60)); // 22 km/h city speed, same floor as channelFeatures
      return {
        zoneId: z.zoneId,
        lat: z.lat,
        lng: z.lng,
        distanceKm: z.distanceKm,
        etaMinutes,
        reason: deterministicForecastReason(z, etaMinutes),
        confidence: z.confidence,
        expectedRidesPerHour: z.expectedRidesPerHour,
        weeksSpan: z.weeksSpan,
      };
    });
    res.json({ zones: top });
  } catch (e) {
    console.error("[demandForecast] driver forecast endpoint failed:", e);
    res.status(500).json({ message: "Forecast failed" });
  }
});

// JSON heat data: ?lat=..&lng=.. or ?city=<slug>. Includes hit-rate metric.
demandForecastRouter.get("/api/citybrain/forecast", requireForecastAdmin, async (req: any, res: any) => {
  try {
    let lat = parseFloat(req.query.lat);
    let lng = parseFloat(req.query.lng);
    let cityName: string | null = null;
    if ((isNaN(lat) || isNaN(lng)) && req.query.city) {
      const [city] = await db.select().from(cities).where(eq(cities.slug, String(req.query.city)));
      if (!city || !city.centerLat || !city.centerLng) {
        return res.status(404).json({ message: "City not found or has no center coordinates" });
      }
      lat = parseFloat(city.centerLat);
      lng = parseFloat(city.centerLng);
      cityName = city.name;
    }
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ message: "Provide lat & lng, or city=<slug>" });
    }
    const radiusKm = Math.min(30, Math.max(2, parseFloat(req.query.radiusKm) || 12));
    const [zones, hitRate] = await Promise.all([
      forecastZonesNear(lat, lng, radiusKm),
      getForecastHitRate(),
    ]);
    res.json({
      center: { lat, lng },
      city: cityName,
      radiusKm,
      generatedAt: new Date().toISOString(),
      zones,
      hitRate,
    });
  } catch (e) {
    console.error("[demandForecast] forecast endpoint failed:", e);
    res.status(500).json({ message: "Forecast failed" });
  }
});

// Minimal browser heatmap (Leaflet). The shell is a static page with no data;
// it asks for the admin token once (kept in sessionStorage, sent as the
// x-admin-token HEADER — the token never appears in a URL). All API-sourced
// strings are HTML-escaped before rendering.
demandForecastRouter.get("/citybrain/heat", async (_req: any, res: any) => {
  res.set("Referrer-Policy", "no-referrer");
  res.type("html").send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="referrer" content="no-referrer" />
<title>City Brain — forecast heat</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { height: 100%; margin: 0; }
  #panel { position: absolute; top: 10px; right: 10px; z-index: 1000; background: #fff; padding: 10px 14px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,.25); font: 13px system-ui, sans-serif; max-width: 280px; }
  #panel h3 { margin: 0 0 6px; font-size: 14px; }
  #panel input, #panel button { font: inherit; margin-top: 4px; }
  .muted { color: #666; }
</style>
</head>
<body>
<div id="map"></div>
<div id="panel"><h3>City Brain forecast</h3><div id="stats" class="muted">Loading…</div></div>
<script>
(function () {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const stats = document.getElementById('stats');

  function askToken() {
    stats.innerHTML = '';
    const label = document.createElement('div');
    label.textContent = 'Admin token required';
    const input = document.createElement('input');
    input.type = 'password';
    input.placeholder = 'x-admin-token';
    const btn = document.createElement('button');
    btn.textContent = 'Load';
    btn.onclick = () => {
      sessionStorage.setItem('cbToken', input.value);
      load();
    };
    stats.append(label, input, btn);
  }

  async function load() {
    const token = sessionStorage.getItem('cbToken');
    if (!token) return askToken();
    const params = new URLSearchParams(location.search);
    const qs = new URLSearchParams();
    for (const k of ['lat', 'lng', 'city', 'radiusKm']) {
      const v = params.get(k);
      if (v) qs.set(k, v);
    }
    stats.textContent = 'Loading…';
    const res = await fetch('/api/citybrain/forecast?' + qs.toString(), { headers: { 'x-admin-token': token } });
    if (res.status === 403) { sessionStorage.removeItem('cbToken'); return askToken(); }
    if (!res.ok) { stats.textContent = 'Error ' + res.status; return; }
    const data = await res.json();
    const map = L.map('map').setView([data.center.lat, data.center.lng], 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    const max = Math.max(0.001, ...data.zones.map(z => z.score));
    for (const z of data.zones) {
      const heat = Math.min(1, z.score / max);
      const color = heat > 0.66 ? '#d32f2f' : heat > 0.33 ? '#f57c00' : '#fbc02d';
      L.circle([z.lat, z.lng], { radius: 1400, color, fillColor: color, fillOpacity: 0.18 + 0.4 * heat, weight: 1 })
        .addTo(map)
        .bindPopup('<b>Zone ' + esc(z.zoneId) + '</b><br/>score ' + esc(z.score) + ' · conf ' + esc(z.confidence) +
          '<br/>~' + esc(z.expectedRidesPerHour) + ' rides/hr (hist, ' + esc(z.weeksSpan) + ' wk)' +
          (z.overlays.length ? '<br/>' + z.overlays.map(o => esc(o.label)).join('<br/>') : ''));
    }
    const hr = data.hitRate;
    stats.innerHTML =
      (data.city ? '<b>' + esc(data.city) + '</b><br/>' : '') +
      esc(data.zones.length) + ' zones with signal<br/>' +
      'Hit rate: ' + (hr.hitRate == null ? 'n/a' : Math.round(hr.hitRate * 100) + '%') + ' (' + esc(hr.hits) + '/' + esc(hr.checked) + ')<br/>' +
      'Last 7d: ' + (hr.last7d.hitRate == null ? 'n/a' : Math.round(hr.last7d.hitRate * 100) + '%') + ' (' + esc(hr.last7d.hits) + '/' + esc(hr.last7d.checked) + ')';
  }

  load();
})();
</script>
</body>
</html>`);
});
