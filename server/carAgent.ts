import OpenAI from "openai";
import type { Vehicle, Ride } from "@shared/schema";

// Lazily construct the OpenAI client so a missing/invalid key degrades to the
// data-only fallback at request time instead of crashing server startup.
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
    console.error("[carAgent] OpenAI init failed, will use fallback:", err);
    _openaiInitFailed = true;
    return null;
  }
}

export type WeeklyRank = {
  rank: number;
  total: number;
  percentile: number;
  weeklyEarnings: number;
} | null;

export interface VehicleEarnings {
  todayEarnings: number;
  todayTrips: number;
  weekEarnings: number;
  weekTrips: number;
}

// A real, nearby hub demand signal (from OpenClaw). recentRideCount and
// avgDemandScore are actual measured signals — never invented.
export interface HubDemand {
  name: string;
  distanceKm: number;
  recentRideCount: number;
  demandLevel: "high" | "medium" | "quiet";
}

// A single milestone in the car's "living profile" timeline. Every milestone is
// derived from real completed-ride / ratings data — never fabricated.
export interface VehicleMilestone {
  // Stable identifier, e.g. "first_trip", "trips_100", "best_day", "top_area".
  key: string;
  type: "first_trip" | "trip_count" | "best_day" | "top_area" | "reputation";
  // Short headline, e.g. "100th trip together".
  title: string;
  // One-line human description.
  description: string;
  // ISO timestamp of when the milestone happened (null when it's a standing fact).
  date: string | null;
  // Ionicons name suggestion for the client.
  icon: string;
  // Optional display value, e.g. "AED 340" or "12 trips".
  value?: string;
}

export interface CarAgentInput {
  vehicle: Vehicle;
  earnings: VehicleEarnings;
  recentRides: Ride[];
  rank: WeeklyRank;
  regionCode: string;
  hubDemand: HubDemand[];
  // Most recent milestones (newest first); the car may reference the latest one.
  milestones?: VehicleMilestone[];
}

export interface CarAgentSummary {
  // First-person, warm "we" message from the car to its owner.
  message: string;
  // One short, forward-looking "where to earn next" line.
  suggestion: string;
  // Short rank/standing line, or null when there's nothing honest to show.
  rankLine: string | null;
  // The currency code used in the figures (derived from the car's rides).
  currency: string;
  // True when the message came from real AI; false when we used the safe fallback.
  aiGenerated: boolean;
}

// Friendly display name for the car: nickname if set, else make + model.
function carName(v: Vehicle): string {
  return (v.nickname && v.nickname.trim()) || `${v.make} ${v.model}`.trim() || "your car";
}

// Pull a short, human area label out of a full address string.
function shortArea(address: string | null | undefined): string {
  if (!address) return "";
  const first = address.split(",")[0]?.trim();
  return first || address.trim();
}

interface DerivedStats {
  currency: string;
  todayEarnings: number;
  todayTrips: number;
  weekEarnings: number;
  weekTrips: number;
  topAreas: string[];
}

// Currency + place labels come from the recent ride sample (labels only).
// The money/trip numbers come from the SQL-aggregated earnings, not the sample.
function deriveStats(rides: Ride[], earnings: VehicleEarnings): DerivedStats {
  const areaCounts = new Map<string, number>();
  let currency = "AED";

  for (const r of rides) {
    if (r.currency) currency = r.currency;
    const area = shortArea(r.dropoffAddress) || shortArea(r.pickupAddress);
    if (area) areaCounts.set(area, (areaCounts.get(area) || 0) + 1);
  }

  const topAreas = [...areaCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([area]) => area);

  return {
    currency,
    todayEarnings: earnings.todayEarnings,
    todayTrips: earnings.todayTrips,
    weekEarnings: earnings.weekEarnings,
    weekTrips: earnings.weekTrips,
    topAreas,
  };
}

function buildRankLine(rank: WeeklyRank): string | null {
  if (!rank || rank.total < 3) return null; // not a meaningful field to rank against
  if (rank.percentile <= 50) {
    return `Top ${rank.percentile}% earning car in your city this week`;
  }
  return `Ranked ${rank.rank} of ${rank.total} earning cars in your city this week`;
}

// Pick the best honest "where to earn next" hint: a busy nearby hub if we have
// a real signal, else a place the car has done well, else just go online.
function buildSuggestion(stats: DerivedStats, hubDemand: HubDemand[]): string {
  const busy = hubDemand.find((h) => h.demandLevel === "high") || hubDemand.find((h) => h.demandLevel === "medium");
  if (busy) {
    return `${busy.name} is busy right now (${busy.distanceKm} km away) — a good place for us to head next.`;
  }
  if (stats.topAreas.length) {
    return `We've earned well around ${stats.topAreas[0]} lately — a good place to head back to.`;
  }
  return `Go online and I'll start learning where we earn best.`;
}

// Plain, honest fallback used when the AI is unavailable — never blocks the screen.
function fallbackSummary(
  stats: DerivedStats,
  rank: WeeklyRank,
  hubDemand: HubDemand[],
  latestMilestone: VehicleMilestone | null = null,
): CarAgentSummary {
  const c = stats.currency;
  let message: string;

  if (stats.weekTrips === 0) {
    message = `We're just getting started. Once we finish a few trips together, I'll show you what we earned and where we did best.`;
  } else if (stats.todayTrips > 0) {
    message = `Good day together — we earned ${c} ${stats.todayEarnings.toFixed(0)} across ${stats.todayTrips} ${stats.todayTrips === 1 ? "trip" : "trips"} today. This week we're at ${c} ${stats.weekEarnings.toFixed(0)}.`;
  } else {
    message = `This week we earned ${c} ${stats.weekEarnings.toFixed(0)} across ${stats.weekTrips} ${stats.weekTrips === 1 ? "trip" : "trips"}. Ready whenever you are to go again.`;
  }

  // Celebrate the most recent milestone when we have one and there's a journey
  // worth narrating — keeps the fallback as warm as the AI voice.
  if (latestMilestone && stats.weekTrips > 0) {
    message += ` ${latestMilestone.description}`;
  }

  return {
    message,
    suggestion: buildSuggestion(stats, hubDemand),
    rankLine: buildRankLine(rank),
    currency: c,
    aiGenerated: false,
  };
}

// Pull every standalone number out of a string so milestone figures the model
// is allowed to echo (e.g. a best-day amount) don't trip the honesty guard.
function numbersIn(text: string | null | undefined): number[] {
  if (!text) return [];
  return (text.match(/\d[\d,]*/g) || []).map((raw) => parseInt(raw.replace(/,/g, ""), 10));
}

// Reject AI text that introduces money figures not present in our fact set.
// Numbers of 3+ digits are almost certainly money/distance claims; small
// numbers (trip counts, "first") are harmless and allowed through.
function aiTextIsHonest(
  text: string,
  stats: DerivedStats,
  hubDemand: HubDemand[],
  latestMilestone: VehicleMilestone | null = null,
): boolean {
  const allowed = new Set<number>([
    Math.round(stats.todayEarnings),
    Math.round(stats.weekEarnings),
    stats.todayTrips,
    stats.weekTrips,
    ...hubDemand.map((h) => Math.round(h.distanceKm)),
    ...hubDemand.map((h) => h.recentRideCount),
    // Numbers we explicitly handed the model via the milestone may be echoed.
    ...numbersIn(latestMilestone?.title),
    ...numbersIn(latestMilestone?.description),
    ...numbersIn(latestMilestone?.value),
  ]);
  const bigNumbers = text.match(/\d[\d,]{2,}/g) || [];
  for (const raw of bigNumbers) {
    const n = parseInt(raw.replace(/,/g, ""), 10);
    if (!allowed.has(n)) return false;
  }
  return true;
}

// Generate the car's warm, first-person status. Real data in, AI voice out;
// falls back to a clear data summary if the model is unavailable or strays.
export async function generateCarAgentSummary(input: CarAgentInput): Promise<CarAgentSummary> {
  const stats = deriveStats(input.recentRides, input.earnings);
  const name = carName(input.vehicle);
  const rankLine = buildRankLine(input.rank);
  const latestMilestone = input.milestones?.[0] ?? null;

  const client = getOpenAI();
  if (!client) return fallbackSummary(stats, input.rank, input.hubDemand, latestMilestone);

  const facts = {
    carName: name,
    currency: stats.currency,
    earnedToday: stats.todayEarnings,
    tripsToday: stats.todayTrips,
    earnedThisWeek: stats.weekEarnings,
    tripsThisWeek: stats.weekTrips,
    reputation: parseFloat(input.vehicle.reputationScore || "5"),
    strongAreasRecently: stats.topAreas,
    rankAmongCarsInCityThisWeek: rankLine,
    latestMilestone: latestMilestone
      ? { title: latestMilestone.title, description: latestMilestone.description }
      : null,
    nearbyHubDemand: input.hubDemand.map((h) => ({
      hub: h.name,
      distanceKm: h.distanceKm,
      demand: h.demandLevel,
      recentRides2h: h.recentRideCount,
    })),
  };

  const systemPrompt = `You are the voice of a specific car on the Travony mobility network, speaking directly to the person who owns it.
TONE (hard requirement): warm and personal, like a trusted partner. Speak in first person plural ("we") — you and your owner are a team. Encouraging and human. Never robotic, never salesy, never use emojis.
RULES:
- Use ONLY the facts provided. NEVER invent or alter numbers, money amounts, places, percentages, hubs, or demand you were not given.
- The only money figures you may mention are earnedToday and earnedThisWeek, with the given currency code, and only when trips exist.
- Keep the "message" to 1-2 short sentences a busy person reads at a glance. You may reference strongAreasRecently and the city rank.
- If latestMilestone is provided, you may warmly mention it (using its exact title/description, no new numbers) to celebrate the journey — but only when it feels natural and the message stays short.
- The "suggestion" is one short line about where to earn next. Prefer a hub from nearbyHubDemand with higher demand; otherwise suggest a strongAreasRecently place; otherwise suggest going online. Do not promise demand that isn't in nearbyHubDemand.
- If tripsThisWeek is 0, gently encourage a first trip instead of reporting numbers.
Respond ONLY as JSON: {"message": string, "suggestion": string}.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Here are the facts about ${name}:\n${JSON.stringify(facts, null, 2)}\n\nWrite the message and suggestion.` },
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.6,
    });

    const raw = response.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    const message = typeof parsed.message === "string" && parsed.message.trim() ? parsed.message.trim() : null;
    const suggestion = typeof parsed.suggestion === "string" && parsed.suggestion.trim() ? parsed.suggestion.trim() : null;

    // Guard against hallucinated figures — if the model strayed from the facts,
    // serve the deterministic, honest summary instead.
    if (!message || !aiTextIsHonest(`${message} ${suggestion || ""}`, stats, input.hubDemand, latestMilestone)) {
      return fallbackSummary(stats, input.rank, input.hubDemand, latestMilestone);
    }

    return {
      message,
      suggestion: suggestion || buildSuggestion(stats, input.hubDemand),
      rankLine,
      currency: stats.currency,
      aiGenerated: true,
    };
  } catch (err) {
    console.error("[carAgent] AI summary failed, using fallback:", err);
    return fallbackSummary(stats, input.rank, input.hubDemand, latestMilestone);
  }
}
