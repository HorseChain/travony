/**
 * channelFeatures — shared, channel-agnostic access to Travony's headline
 * features so every surface (Telegram bot, WhatsApp bot, rider/driver apps)
 * presents the SAME honest data. All numbers here come from real tables or
 * deterministic engines — nothing is invented (car-agent honesty rule).
 *
 * Bots and routes import from here instead of reaching into each other's
 * modules, so one fix updates every channel.
 */
import { db } from "./db";
import {
  ridePosts,
  streamClips,
  rideSafetyReports,
  vehicles,
  drivers,
  users,
} from "@shared/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { loadCarFacts, aboutCarReply, type CarFacts } from "./carPersonaRoutes";
import { forecastZonesNear, deterministicForecastReason } from "./demandForecast";

/** Public base URL for links sent out over chat channels. */
export function channelBaseUrl(): string {
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const domain = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domain) return `https://${domain}`;
  if (process.env.EXPO_PUBLIC_DOMAIN) return `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
  return "http://localhost:5000";
}

// ---------------------------------------------------------------------------
// Travony TV
// ---------------------------------------------------------------------------

export interface TvSnapshot {
  url: string;
  liveCount: number; // real count of currently-live streams
}

/** Real live-stream count + the public TV link. Never fabricates viewers. */
export async function getTvSnapshot(): Promise<TvSnapshot> {
  let liveCount = 0;
  try {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(ridePosts)
      .where(and(eq(ridePosts.isLive, true), isNull(ridePosts.endedAt)));
    liveCount = row?.n ?? 0;
  } catch (err) {
    console.error("[channelFeatures] tv snapshot failed:", err);
  }
  return { url: `${channelBaseUrl()}/tv`, liveCount };
}

/** Chat-ready TV card text (channel adapters may translate/format further). */
export async function buildTvCardText(): Promise<string> {
  const snap = await getTvSnapshot();
  const liveLine =
    snap.liveCount > 0
      ? `${snap.liveCount} ${snap.liveCount === 1 ? "car is" : "cars are"} live right now.`
      : "The channel is on air whenever cars go live.";
  return [
    "📺 Travony TV — one channel, the city's best live rides, auto-directed by AI.",
    liveLine,
    "Watching while signed in earns you ride credits that pay for your trips.",
    `Watch: ${snap.url}`,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Car AI personas
// ---------------------------------------------------------------------------

export interface FeaturedCarIntro {
  vehicleId: string;
  personaName: string;
  intro: string; // deterministic, honest self-introduction
}

/** Honest persona intro for a specific vehicle (null if not showable). */
export async function getCarIntro(vehicleId: string): Promise<FeaturedCarIntro | null> {
  try {
    const facts: CarFacts | null = await loadCarFacts(vehicleId);
    if (!facts) return null;
    return { vehicleId, personaName: facts.personaName, intro: aboutCarReply(facts) };
  } catch (err) {
    console.error("[channelFeatures] car intro failed:", err);
    return null;
  }
}

/**
 * Pick a showcase-worthy car for chat channels: the highest-reputation
 * vehicle whose driver is approved (prefer currently-online drivers).
 */
export async function getFeaturedCarIntro(): Promise<FeaturedCarIntro | null> {
  try {
    const rows = await db
      .select({ id: vehicles.id })
      .from(vehicles)
      .innerJoin(drivers, eq(drivers.id, vehicles.driverId))
      .where(eq(drivers.status, "approved"))
      .orderBy(
        desc(drivers.isOnline),
        desc(sql`coalesce(${vehicles.reputationScore}, '0')::numeric`),
        desc(vehicles.totalTrips),
      )
      .limit(1);
    if (!rows[0]) return null;
    return await getCarIntro(rows[0].id);
  } catch (err) {
    console.error("[channelFeatures] featured car failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Highlight clips (ONLY driver-approved clips are ever surfaced)
// ---------------------------------------------------------------------------

export interface SharedClip {
  id: string;
  title: string | null;
  caption: string | null;
  cityName: string | null;
  videoUrl: string; // publicly servable — approved clips only
}

export async function getLatestApprovedClips(limit = 3, vehicleId?: string): Promise<SharedClip[]> {
  try {
    const where = vehicleId
      ? and(eq(streamClips.status, "approved"), eq(streamClips.vehicleId, vehicleId))
      : eq(streamClips.status, "approved");
    const rows = await db
      .select({
        id: streamClips.id,
        title: streamClips.title,
        caption: streamClips.caption,
        cityName: streamClips.cityName,
      })
      .from(streamClips)
      .where(where)
      .orderBy(desc(streamClips.approvedAt))
      .limit(Math.min(Math.max(limit, 1), 5));
    const base = channelBaseUrl();
    return rows.map((r) => ({ ...r, videoUrl: `${base}/api/stream-clips/${r.id}/video` }));
  } catch (err) {
    console.error("[channelFeatures] clips lookup failed:", err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Ride safety reports
// ---------------------------------------------------------------------------

/**
 * Chat-ready safety report for a ride. Returns null when no report exists
 * (not every ride streams; reports generate asynchronously after completion).
 */
export async function getSafetyReportText(rideId: string): Promise<string | null> {
  try {
    const [rep] = await db
      .select({ status: rideSafetyReports.status, summary: rideSafetyReports.summary })
      .from(rideSafetyReports)
      .where(eq(rideSafetyReports.rideId, rideId))
      .limit(1);
    if (!rep) return null;
    const badge = rep.status === "calm" ? "🛡️ Safety report: Calm ride" : "🛡️ Safety report: Flagged for review";
    return `${badge}\n${rep.summary}`;
  } catch (err) {
    console.error("[channelFeatures] safety report lookup failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// City Brain demand tips (driver-facing)
// ---------------------------------------------------------------------------

/**
 * Deterministic top-zone demand tips near a point. Real historical rates
 * only — returns null when there isn't enough data (never fabricates).
 */
export async function getDemandTipsText(lat: number, lng: number): Promise<string | null> {
  try {
    const zones = await forecastZonesNear(lat, lng, 8);
    const top = zones.filter((z) => z.confidence > 0 && z.expectedRidesPerHour > 0).slice(0, 3);
    if (top.length === 0) return null;
    const lines = top.map((z, i) => {
      const etaMin = Math.max(2, Math.round((z.distanceKm / 22) * 60)); // 22 km/h city speed, same floor as city brain
      return `${i + 1}. ${deterministicForecastReason(z, etaMin)}`;
    });
    return `🔮 Where demand is heading near you:\n${lines.join("\n")}`;
  } catch (err) {
    console.error("[channelFeatures] demand tips failed:", err);
    return null;
  }
}
