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
  // The hub's configured busy windows, e.g. "07:00-09:00,17:00-19:00".
  peakHours?: string | null;
}

// The car's own earning rhythm, aggregated from its real completed-ride history.
// Used to build an honest, forward-looking "plan for our next shift".
export interface EarningPatterns {
  // Hours of day (0-23, in the car's local time) ranked by earnings, best first.
  bestHours: Array<{ hour: number; trips: number; earnings: number }>;
  // Drop-off/pickup areas the car has earned in most, busiest first.
  topAreas: Array<{ area: string; trips: number }>;
  // How many completed trips the window analyzed (sample size / confidence).
  totalTrips: number;
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

// Deterministic Car Ladder facts computed by server/carLadder.ts — the ring's
// numbers. The LLM may only echo these; it never invents progress or targets.
export interface LadderFacts {
  hasGoal: boolean;
  status: string | null;
  target: { name: string; vehicleKind: string } | null;
  progressPercent: number;
  paceWeeksRemaining: number | null;
  qualified: boolean;
  claimed: boolean;
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
  // The car's own earning rhythm, used to plan the next shift honestly.
  earningPatterns?: EarningPatterns;
  // Car Ladder ring facts (deterministic; optional when the driver has no goal).
  ladder?: LadderFacts;
}

export interface CarAgentSummary {
  // First-person, warm "we" message from the car to its owner.
  message: string;
  // One short, forward-looking "where to earn next" line.
  suggestion: string;
  // A 1-2 sentence "plan for our next shift": the best hours + area to drive,
  // grounded in the car's own history or, failing that, nearby hub busy hours.
  plan: string;
  // Short rank/standing line, or null when there's nothing honest to show.
  rankLine: string | null;
  // One deterministic Car Ladder sentence ("I'm 41% of the way to your new
  // tuktuk — about 14 weeks at your pace"), or null when there's no goal.
  ladderLine: string | null;
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

// Below this many analyzed trips we don't trust the car's own hour pattern yet
// and fall back to nearby hub busy hours instead of guessing.
const MIN_TRIPS_FOR_PATTERN = 5;

// 24h hour -> 12h parts, e.g. 0 -> {12,"am"}, 17 -> {5,"pm"}, 24 -> {12,"am"}.
function formatHour12(hour: number): { num: number; suffix: "am" | "pm" } {
  const h = ((hour % 24) + 24) % 24;
  const suffix: "am" | "pm" = h < 12 ? "am" : "pm";
  let num = h % 12;
  if (num === 0) num = 12;
  return { num, suffix };
}

// Merge a set of hours (0-23) into contiguous windows and format them like
// "7-9am", "5-8pm", or "11am-2pm". A window for hour H covers H:00 to (H+1):00,
// so the displayed end is the hour after the last one in the run.
function formatHourWindows(hours: number[], maxWindows = 2): string {
  const uniq = [...new Set(hours.filter((h) => Number.isInteger(h)))].sort((a, b) => a - b);
  if (uniq.length === 0) return "";

  const ranges: Array<[number, number]> = [];
  let start = uniq[0];
  let prev = uniq[0];
  for (let i = 1; i < uniq.length; i++) {
    if (uniq[i] === prev + 1) {
      prev = uniq[i];
    } else {
      ranges.push([start, prev]);
      start = uniq[i];
      prev = uniq[i];
    }
  }
  ranges.push([start, prev]);

  const labels = ranges.slice(0, maxWindows).map(([s, e]) => {
    const a = formatHour12(s);
    const b = formatHour12(e + 1); // window end is exclusive
    return a.suffix === b.suffix ? `${a.num}-${b.num}${b.suffix}` : `${a.num}${a.suffix}-${b.num}${b.suffix}`;
  });
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

// Turn a hub's "07:00-09:00,17:00-19:00" peak string into "7-9am and 5-7pm".
function formatPeakHours(peakHours: string | null | undefined, maxWindows = 2): string {
  if (!peakHours) return "";
  const labels: string[] = [];
  for (const part of peakHours.split(",")) {
    const [fromRaw, toRaw] = part.split("-");
    const from = parseInt((fromRaw || "").trim().split(":")[0], 10);
    let to = parseInt((toRaw || "").trim().split(":")[0], 10);
    if (isNaN(from) || isNaN(to)) continue;
    if (to === 0) to = 24; // "00:00" end means midnight
    const a = formatHour12(from);
    const b = formatHour12(to);
    labels.push(a.suffix === b.suffix && from < to ? `${a.num}-${b.num}${b.suffix}` : `${a.num}${a.suffix}-${b.num}${b.suffix}`);
    if (labels.length >= maxWindows) break;
  }
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

// Join names into readable prose: "A", "A and B", "A, B and C".
function formatList(items: string[]): string {
  const xs = items.filter(Boolean);
  if (xs.length === 0) return "";
  if (xs.length === 1) return xs[0];
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

// Build an honest, forward-looking plan for the next shift, composed entirely
// from real signals (no AI free text). Prefers the car's own earning rhythm —
// its best hours plus its top 2-3 earning areas; otherwise leans on nearby hubs'
// known busy hours. Never invents demand or promises money.
function buildPlan(
  stats: DerivedStats,
  patterns: EarningPatterns | undefined,
  hubDemand: HubDemand[],
): string {
  if (patterns && patterns.totalTrips >= MIN_TRIPS_FOR_PATTERN && patterns.bestHours.length) {
    const windows = formatHourWindows(patterns.bestHours.slice(0, 3).map((h) => h.hour));
    const areas = (patterns.topAreas.length ? patterns.topAreas.map((a) => a.area) : stats.topAreas).slice(0, 3);
    if (windows && areas.length) {
      return `Our strongest hours are usually ${windows} — let's aim for those, focusing on ${formatList(areas)} where we've earned well.`;
    }
    if (windows) {
      return `Our strongest hours are usually ${windows} — a good window for us to be out together.`;
    }
  }

  const hubsWithPeak = hubDemand.filter((h) => formatPeakHours(h.peakHours)).slice(0, 2);
  if (hubsWithPeak.length) {
    const parts = hubsWithPeak.map((h) => `${h.name} (${formatPeakHours(h.peakHours)})`);
    return `Still learning our rhythm. Near here, ${formatList(parts)} tend to get busy — good places to start.`;
  }
  if (hubDemand.length) {
    return `Still learning our rhythm. ${formatList(hubDemand.slice(0, 3).map((h) => h.name))} are among the busier spots near us — good places to start.`;
  }
  return `Give me a few more trips and I'll map out the hours and areas where we earn the most.`;
}

// One deterministic Car Ladder sentence built entirely from engine numbers.
// Never mentions crypto/token vocabulary — just the vehicle, % and pace.
function buildLadderLine(ladder: LadderFacts | undefined): string | null {
  if (!ladder || !ladder.hasGoal || !ladder.target) return null;
  const what = ladder.target.vehicleKind === "car" || ladder.target.vehicleKind === "suv"
    ? `your new ${ladder.target.name}`
    : `your new ${ladder.target.vehicleKind} (${ladder.target.name})`;
  if (ladder.claimed) {
    return `We claimed ${what} — the dealer has your record. I'll celebrate the day you pick it up.`;
  }
  if (ladder.qualified) {
    return `We did it — you're fully qualified for ${what}. Tap the ring to claim it.`;
  }
  const pct = Math.round(ladder.progressPercent * 10) / 10;
  if (ladder.paceWeeksRemaining !== null && ladder.paceWeeksRemaining > 0) {
    return `I'm ${pct}% of the way to ${what} — about ${ladder.paceWeeksRemaining} ${ladder.paceWeeksRemaining === 1 ? "week" : "weeks"} at our pace.`;
  }
  if (pct > 0) {
    return `I'm ${pct}% of the way to ${what}. Every trip we finish together moves the ring.`;
  }
  return `Every trip we finish together now quietly builds toward ${what}.`;
}

// Plain, honest fallback used when the AI is unavailable — never blocks the screen.
function fallbackSummary(
  stats: DerivedStats,
  rank: WeeklyRank,
  hubDemand: HubDemand[],
  latestMilestone: VehicleMilestone | null = null,
  patterns: EarningPatterns | undefined = undefined,
  ladder: LadderFacts | undefined = undefined,
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
    plan: buildPlan(stats, patterns, hubDemand),
    rankLine: buildRankLine(rank),
    ladderLine: buildLadderLine(ladder),
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
  ladder: LadderFacts | undefined = undefined,
): boolean {
  const allowed = new Set<number>([
    // Ladder ring numbers the model was explicitly handed may be echoed.
    ...(ladder ? [Math.round(ladder.progressPercent), Math.round(ladder.progressPercent * 10) / 10, ...(ladder.paceWeeksRemaining !== null ? [ladder.paceWeeksRemaining] : [])] : []),
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

  // Catch fabricated money stated with the currency code (e.g. "AED 80") that
  // isn't one of our real earnings figures — even small or decimal amounts the
  // 3+ digit check above would miss.
  const c = stats.currency;
  if (c) {
    const moneyRe = new RegExp(`${c}\\s*([\\d,]+(?:\\.\\d+)?)|([\\d,]+(?:\\.\\d+)?)\\s*${c}`, "gi");
    const allowedMoney = new Set<number>([
      Math.round(stats.todayEarnings),
      Math.round(stats.weekEarnings),
    ]);
    let m: RegExpExecArray | null;
    while ((m = moneyRe.exec(text)) !== null) {
      const n = Math.round(parseFloat((m[1] || m[2] || "0").replace(/,/g, "")));
      if (!allowedMoney.has(n)) return false;
    }
  }

  // Hard vocabulary wall: the ladder's savings rail must never leak into
  // driver-facing words. Any crypto/token language forces the deterministic
  // fallback regardless of what the prompt asked for.
  if (/\b(crypto|cryptocurrency|token|tokens|blockchain|hrs|horsechain|erc[- ]?20|ethereum|wallet address|on[- ]?chain|coin|coins|stablecoin|usdt)\b/i.test(text)) {
    return false;
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
  const patterns = input.earningPatterns;
  const deterministicPlan = buildPlan(stats, patterns, input.hubDemand);
  const ladderLine = buildLadderLine(input.ladder);

  const client = getOpenAI();
  if (!client) return fallbackSummary(stats, input.rank, input.hubDemand, latestMilestone, patterns, input.ladder);

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
    // The Car Ladder ring — deterministic numbers the model may mention warmly.
    ladderProgress: input.ladder && input.ladder.hasGoal && input.ladder.target
      ? {
          targetVehicle: input.ladder.target.name,
          progressPercent: input.ladder.progressPercent,
          weeksRemainingAtCurrentPace: input.ladder.paceWeeksRemaining,
          qualified: input.ladder.qualified,
          claimed: input.ladder.claimed,
        }
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
- If ladderProgress is provided, you may warmly reference the journey toward the target vehicle using ONLY its exact progressPercent and weeksRemainingAtCurrentPace numbers. Never mention tokens, crypto, blockchain, HRS, or savings mechanics — it is simply "our progress toward your next vehicle".
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
    // serve the deterministic, honest summary instead. The plan is composed
    // deterministically from real signals, so it is grounded by construction.
    if (!message || !aiTextIsHonest(`${message} ${suggestion || ""}`, stats, input.hubDemand, latestMilestone, input.ladder)) {
      return fallbackSummary(stats, input.rank, input.hubDemand, latestMilestone, patterns, input.ladder);
    }

    return {
      message,
      suggestion: suggestion || buildSuggestion(stats, input.hubDemand),
      plan: deterministicPlan,
      rankLine,
      ladderLine,
      currency: stats.currency,
      aiGenerated: true,
    };
  } catch (err) {
    console.error("[carAgent] AI summary failed, using fallback:", err);
    return fallbackSummary(stats, input.rank, input.hubDemand, latestMilestone, patterns, input.ladder);
  }
}
