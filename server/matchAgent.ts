import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { storage } from "./storage";
import {
  users,
  drivers,
  rides,
  userFollows,
  ridePosts,
  ridePostReactions,
  ridePostComments,
  giftsSent,
  matchSignals,
  matchWeights,
} from "@shared/schema";
import { eq, and, or, desc, gte, inArray, isNull, count, sql } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Social Match Agent — a self-learning people-to-people matching engine.
//
// Architecture (same trust-first pattern as the rest of Travony):
//   - All match SCORES are deterministic server code: a weighted sum over
//     real social-graph features (mutual follows, shared rides, gifts,
//     engagement overlap, city, recency, popularity, creator activity).
//   - The agent LEARNS every hour: it compares the feature snapshots of
//     suggestions that led to a real follow vs ones that were dismissed or
//     ignored, nudges the weights toward what actually worked, and saves a
//     new versioned weight vector ("brain") to the DB.
//   - Claude (Anthropic, via Replit AI Integrations) is the reasoning layer
//     ONLY: after each learning cycle it writes a short plain-language
//     insight about what changed. It never produces scores or numbers that
//     drive matching, and its output is checked by an honesty guard.
// ---------------------------------------------------------------------------

export const FEATURE_KEYS = [
  "mutuals", // people you follow who follow the candidate
  "sharedRide", // you two have completed a ride together
  "giftLink", // gifts exchanged between you
  "engagement", // reactions/comments between your posts
  "sameCity", // same city (or same country as fallback)
  "recency", // candidate active on the network recently
  "popularity", // follower count
  "creator", // published ride memories
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type FeatureVector = Record<FeatureKey, number>;
export type WeightVector = Record<FeatureKey, number>;

export const DEFAULT_WEIGHTS: WeightVector = {
  mutuals: 1.0,
  sharedRide: 0.9,
  giftLink: 0.8,
  engagement: 0.8,
  sameCity: 0.6,
  recency: 0.5,
  popularity: 0.5,
  creator: 0.4,
};
const WEIGHT_SUM = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
const WEIGHT_MIN = 0.05;
const WEIGHT_MAX = 3.0;
const LEARNING_RATE = 0.15;
const MIN_POSITIVES = 3;
const MIN_SAMPLES = 10;
const CYCLE_MS = 60 * 60 * 1000; // learn every 1 hour
const SIGNAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // learn from the last 7 days
const FOLLOW_ATTRIBUTION_MS = 48 * 60 * 60 * 1000; // follow within 48h of impression counts
const IMPRESSION_DEDUPE_MS = 24 * 60 * 60 * 1000;
const CLAUDE_MODEL = "claude-sonnet-4-6";

// --- live weights cache ------------------------------------------------------

let weightsCache: { version: number; weights: WeightVector; at: number } | null = null;

function sanitizeWeights(raw: any): WeightVector {
  const w = { ...DEFAULT_WEIGHTS };
  if (raw && typeof raw === "object") {
    for (const k of FEATURE_KEYS) {
      const v = Number(raw[k]);
      if (Number.isFinite(v)) w[k] = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, v));
    }
  }
  return w;
}

export async function getActiveWeights(): Promise<{ version: number; weights: WeightVector }> {
  if (weightsCache && Date.now() - weightsCache.at < 60 * 1000) {
    return { version: weightsCache.version, weights: weightsCache.weights };
  }
  try {
    const [row] = await db.select().from(matchWeights).orderBy(desc(matchWeights.version)).limit(1);
    const version = row?.version ?? 0;
    const weights = row ? sanitizeWeights(row.weights) : { ...DEFAULT_WEIGHTS };
    weightsCache = { version, weights, at: Date.now() };
    return { version, weights };
  } catch {
    return { version: 0, weights: { ...DEFAULT_WEIGHTS } };
  }
}

// --- deterministic scoring ---------------------------------------------------

export interface ScoredMatch {
  id: string;
  score: number;
  reason: string;
  features: FeatureVector;
  weightsVersion: number;
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

function reasonFor(features: FeatureVector, weights: WeightVector, cityName: string | null): string {
  let best: FeatureKey | null = null;
  let bestVal = 0;
  for (const k of FEATURE_KEYS) {
    const contribution = features[k] * weights[k];
    if (contribution > bestVal) {
      bestVal = contribution;
      best = k;
    }
  }
  switch (best) {
    case "mutuals":
      return "Followed by people you follow";
    case "sharedRide":
      return "You've shared a ride";
    case "giftLink":
      return "You've exchanged gifts";
    case "engagement":
      return "Engages with the same rides";
    case "sameCity":
      return cityName ? `Active in ${cityName}` : "Active near you";
    case "recency":
      return "Active this week";
    case "popularity":
      return "Popular on the network";
    case "creator":
      return "Shares ride memories";
    default:
      return "On the Travony network";
  }
}

/**
 * Score candidate users for `userId`. `candidates` carries the cheap counts
 * the caller already has (followers, published posts); this function bulk-loads
 * the relationship features and returns candidates ranked by the current brain.
 */
export async function scorePeopleMatches(
  userId: string,
  candidates: { id: string; followers: number; posts: number }[],
): Promise<ScoredMatch[]> {
  if (candidates.length === 0) return [];
  const candidateIds = candidates.map((c) => c.id);
  const { version, weights } = await getActiveWeights();
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [myFollowingRows, myDriverRows, candDriverRows, regionRows] = await Promise.all([
    db.select({ id: userFollows.followingId }).from(userFollows).where(eq(userFollows.followerId, userId)),
    db.select({ id: drivers.id }).from(drivers).where(eq(drivers.userId, userId)),
    db.select({ id: drivers.id, userId: drivers.userId }).from(drivers).where(inArray(drivers.userId, candidateIds)),
    db
      .select({ id: users.id, regionCode: users.regionCode })
      .from(users)
      .where(inArray(users.id, [...candidateIds, userId])),
  ]);

  const myFollowingIds = myFollowingRows.map((r) => r.id);
  const myDriverId = myDriverRows[0]?.id || null;
  const candDriverByDriverId = new Map(candDriverRows.map((r) => [r.id, r.userId]));
  const candDriverIds = candDriverRows.map((r) => r.id);
  const regionById = new Map(regionRows.map((r) => [r.id, r.regionCode || null]));

  const [mutualRows, giftRows, reactionsMine, reactionsTheirs, commentsMine, commentsTheirs, sharedRideRows, recentPostRows] =
    await Promise.all([
      myFollowingIds.length
        ? db
            .select({ id: userFollows.followingId, n: count() })
            .from(userFollows)
            .where(and(inArray(userFollows.followerId, myFollowingIds), inArray(userFollows.followingId, candidateIds)))
            .groupBy(userFollows.followingId)
        : Promise.resolve([] as { id: string; n: number }[]),
      db
        .select({ senderId: giftsSent.senderId, recipientId: giftsSent.recipientId })
        .from(giftsSent)
        .where(
          or(
            and(eq(giftsSent.senderId, userId), inArray(giftsSent.recipientId, candidateIds)),
            and(eq(giftsSent.recipientId, userId), inArray(giftsSent.senderId, candidateIds)),
          ),
        ),
      db
        .select({ id: ridePosts.userId, n: count() })
        .from(ridePostReactions)
        .innerJoin(ridePosts, eq(ridePostReactions.postId, ridePosts.id))
        .where(and(eq(ridePostReactions.userId, userId), inArray(ridePosts.userId, candidateIds)))
        .groupBy(ridePosts.userId),
      db
        .select({ id: ridePostReactions.userId, n: count() })
        .from(ridePostReactions)
        .innerJoin(ridePosts, eq(ridePostReactions.postId, ridePosts.id))
        .where(and(eq(ridePosts.userId, userId), inArray(ridePostReactions.userId, candidateIds)))
        .groupBy(ridePostReactions.userId),
      db
        .select({ id: ridePosts.userId, n: count() })
        .from(ridePostComments)
        .innerJoin(ridePosts, eq(ridePostComments.postId, ridePosts.id))
        .where(and(eq(ridePostComments.userId, userId), inArray(ridePosts.userId, candidateIds)))
        .groupBy(ridePosts.userId),
      db
        .select({ id: ridePostComments.userId, n: count() })
        .from(ridePostComments)
        .innerJoin(ridePosts, eq(ridePostComments.postId, ridePosts.id))
        .where(and(eq(ridePosts.userId, userId), inArray(ridePostComments.userId, candidateIds)))
        .groupBy(ridePostComments.userId),
      candDriverIds.length || myDriverId
        ? db
            .select({ customerId: rides.customerId, driverId: rides.driverId })
            .from(rides)
            .where(
              and(
                eq(rides.status, "completed"),
                or(
                  candDriverIds.length ? and(eq(rides.customerId, userId), inArray(rides.driverId, candDriverIds)) : sql`false`,
                  myDriverId ? and(eq(rides.driverId, myDriverId), inArray(rides.customerId, candidateIds)) : sql`false`,
                ),
              ),
            )
            .limit(200)
        : Promise.resolve([] as { customerId: string; driverId: string | null }[]),
      db
        .select({ userId: ridePosts.userId, cityName: ridePosts.cityName, createdAt: ridePosts.createdAt })
        .from(ridePosts)
        .where(and(inArray(ridePosts.userId, [...candidateIds, userId]), gte(ridePosts.createdAt, since30d)))
        .orderBy(desc(ridePosts.createdAt))
        .limit(300),
    ]);

  const mutualsById = new Map(mutualRows.map((r) => [r.id, Number(r.n)]));

  const giftCountById = new Map<string, number>();
  for (const g of giftRows) {
    const other = g.senderId === userId ? g.recipientId : g.senderId;
    giftCountById.set(other, (giftCountById.get(other) || 0) + 1);
  }

  const engagementById = new Map<string, number>();
  for (const rows of [reactionsMine, reactionsTheirs, commentsMine, commentsTheirs]) {
    for (const r of rows as { id: string; n: number }[]) {
      engagementById.set(r.id, (engagementById.get(r.id) || 0) + Number(r.n));
    }
  }

  const sharedRideIds = new Set<string>();
  for (const r of sharedRideRows) {
    if (r.customerId === userId && r.driverId) {
      const candUserId = candDriverByDriverId.get(r.driverId);
      if (candUserId) sharedRideIds.add(candUserId);
    } else if (r.customerId !== userId) {
      sharedRideIds.add(r.customerId);
    }
  }

  const latestCityById = new Map<string, string>();
  const latestPostAtById = new Map<string, number>();
  for (const p of recentPostRows) {
    if (p.cityName && !latestCityById.has(p.userId)) latestCityById.set(p.userId, p.cityName);
    if (!latestPostAtById.has(p.userId)) latestPostAtById.set(p.userId, new Date(p.createdAt).getTime());
  }
  const myCity = latestCityById.get(userId) || null;
  const myRegion = regionById.get(userId) || null;
  const now = Date.now();

  const scored: ScoredMatch[] = candidates.map((c) => {
    const candCity = latestCityById.get(c.id) || null;
    const lastPostAt = latestPostAtById.get(c.id) || 0;
    const ageDays = lastPostAt ? (now - lastPostAt) / (24 * 60 * 60 * 1000) : Infinity;
    const features: FeatureVector = {
      mutuals: clamp01((mutualsById.get(c.id) || 0) / 3),
      sharedRide: sharedRideIds.has(c.id) ? 1 : 0,
      giftLink: clamp01((giftCountById.get(c.id) || 0) / 2),
      engagement: clamp01((engagementById.get(c.id) || 0) / 3),
      sameCity: myCity && candCity && myCity === candCity ? 1 : myRegion && regionById.get(c.id) === myRegion ? 0.4 : 0,
      recency: ageDays <= 7 ? 1 : ageDays <= 30 ? 0.5 : 0,
      popularity: clamp01(c.followers / 20),
      creator: clamp01(c.posts / 5),
    };
    let score = 0;
    for (const k of FEATURE_KEYS) score += features[k] * weights[k];
    return {
      id: c.id,
      score: Math.round(score * 1000) / 1000,
      reason: reasonFor(features, weights, candCity),
      features,
      weightsVersion: version,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored;
}

/** Fire-and-forget impression logging (deduped per pair per 24h). */
export function recordImpressions(userId: string, shown: ScoredMatch[]): void {
  if (shown.length === 0) return;
  (async () => {
    const since = new Date(Date.now() - IMPRESSION_DEDUPE_MS);
    const recent = await db
      .select({ candidateId: matchSignals.candidateId })
      .from(matchSignals)
      .where(
        and(
          eq(matchSignals.userId, userId),
          eq(matchSignals.kind, "impression"),
          gte(matchSignals.createdAt, since),
          inArray(matchSignals.candidateId, shown.map((s) => s.id)),
        ),
      );
    const already = new Set(recent.map((r) => r.candidateId));
    const rows = shown
      .filter((s) => !already.has(s.id))
      .map((s) => ({
        userId,
        candidateId: s.id,
        kind: "impression",
        features: s.features,
        weightsVersion: s.weightsVersion,
      }));
    if (rows.length) await db.insert(matchSignals).values(rows);
  })().catch((err) => console.error("[match-agent] impression log failed:", err?.message || err));
}

// --- hourly learning cycle ---------------------------------------------------

interface CycleStats {
  at: string;
  learned: boolean;
  impressions: number;
  follows: number;
  dismissals: number;
  ignored: number;
  followRate: number;
  version: number;
  note: string;
}

let lastCycle: CycleStats | null = null;
let cycleRunning = false;
let agentStarted = false;
let nextCycleAt: number | null = null;

function claudeClient(): Anthropic | null {
  if (!process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY) return null;
  return new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });
}

// Honesty guard: the insight is commentary only. Reject crypto vocabulary and
// anything absurdly long; on rejection fall back to a deterministic sentence.
const BANNED_INSIGHT = /crypto|blockchain|usdt|token|nft|web3|smart contract/i;

async function writeClaudeInsight(
  metrics: Record<string, any>,
  oldWeights: WeightVector,
  newWeights: WeightVector,
): Promise<string | null> {
  const client = claudeClient();
  if (!client) return null;
  try {
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 250,
      system:
        "You are the learning reporter for a social matching engine inside a ride-hailing app. " +
        "You receive the deterministic statistics of one hourly learning cycle. Write 1-3 short, " +
        "plain-language sentences explaining what the matcher learned about how people connect " +
        "(which signals mattered more or less). Do not invent numbers that are not in the data. " +
        "Never mention crypto, blockchain or internal implementation details.",
      messages: [
        {
          role: "user",
          content: JSON.stringify({ metrics, oldWeights, newWeights }),
        },
      ],
    });
    const block = msg.content[0];
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text || text.length > 600 || BANNED_INSIGHT.test(text)) return null;
    return text;
  } catch (err: any) {
    console.error("[match-agent] Claude insight failed:", err?.message || err);
    return null;
  }
}

export async function runLearningCycle(): Promise<CycleStats> {
  if (cycleRunning) return lastCycle || makeStats(false, 0, 0, 0, 0, 0, "cycle already running");
  cycleRunning = true;
  try {
    const since = new Date(Date.now() - SIGNAL_WINDOW_MS);
    // Only unconsumed impressions — each outcome teaches the weights exactly
    // once. Pending impressions (still inside the follow-attribution window
    // with no outcome yet) stay unconsumed for a later cycle.
    const [impressions, dismissals] = await Promise.all([
      db
        .select({
          id: matchSignals.id,
          userId: matchSignals.userId,
          candidateId: matchSignals.candidateId,
          features: matchSignals.features,
          createdAt: matchSignals.createdAt,
        })
        .from(matchSignals)
        .where(
          and(
            eq(matchSignals.kind, "impression"),
            isNull(matchSignals.processedAt),
            gte(matchSignals.createdAt, since),
          ),
        ),
      db
        .select({ userId: matchSignals.userId, candidateId: matchSignals.candidateId })
        .from(matchSignals)
        .where(and(eq(matchSignals.kind, "dismiss"), gte(matchSignals.createdAt, since))),
    ]);

    if (impressions.length === 0) {
      lastCycle = makeStats(false, 0, 0, dismissals.length, 0, 0, "no impressions in window yet");
      return lastCycle;
    }

    // Ground truth: did a real follow happen after the impression?
    const followerIds = Array.from(new Set(impressions.map((i) => i.userId)));
    const followRows = await db
      .select({
        followerId: userFollows.followerId,
        followingId: userFollows.followingId,
        createdAt: userFollows.createdAt,
      })
      .from(userFollows)
      .where(and(inArray(userFollows.followerId, followerIds), gte(userFollows.createdAt, since)));
    const followAtByPair = new Map<string, number>();
    for (const f of followRows) {
      followAtByPair.set(`${f.followerId}:${f.followingId}`, new Date(f.createdAt).getTime());
    }
    const dismissedPairs = new Set(dismissals.map((d) => `${d.userId}:${d.candidateId}`));

    // Weighted feature means for positive vs negative outcomes.
    const posSum: Record<FeatureKey, number> = zeroVector();
    const negSum: Record<FeatureKey, number> = zeroVector();
    let posW = 0;
    let negW = 0;
    let follows = 0;
    let ignored = 0;
    const now = Date.now();
    const resolvedIds: string[] = [];

    for (const imp of impressions) {
      const f = sanitizeFeatures(imp.features);
      if (!f) {
        resolvedIds.push(imp.id); // malformed snapshot — consume, never learn from it
        continue;
      }
      const pair = `${imp.userId}:${imp.candidateId}`;
      const impAt = new Date(imp.createdAt).getTime();
      const followAt = followAtByPair.get(pair);
      if (followAt !== undefined && followAt >= impAt && followAt - impAt <= FOLLOW_ATTRIBUTION_MS) {
        follows++;
        posW += 1;
        for (const k of FEATURE_KEYS) posSum[k] += f[k];
        resolvedIds.push(imp.id);
      } else if (dismissedPairs.has(pair)) {
        negW += 1;
        for (const k of FEATURE_KEYS) negSum[k] += f[k];
        resolvedIds.push(imp.id);
      } else if (now - impAt > FOLLOW_ATTRIBUTION_MS) {
        // Shown, never dismissed, never followed — a soft negative.
        ignored++;
        negW += 0.25;
        for (const k of FEATURE_KEYS) negSum[k] += f[k] * 0.25;
        resolvedIds.push(imp.id);
      }
      // else: still pending — leave unconsumed for a future cycle.
    }

    const markConsumed = async () => {
      if (resolvedIds.length === 0) return;
      await db
        .update(matchSignals)
        .set({ processedAt: new Date() })
        .where(inArray(matchSignals.id, resolvedIds));
    };

    const followRate = impressions.length ? Math.round((follows / impressions.length) * 1000) / 1000 : 0;
    const sampleTotal = posW + negW;

    if (follows < MIN_POSITIVES || sampleTotal < MIN_SAMPLES) {
      lastCycle = makeStats(
        false,
        impressions.length,
        follows,
        dismissals.length,
        ignored,
        followRate,
        `not enough outcomes to learn (need ${MIN_POSITIVES}+ follows and ${MIN_SAMPLES}+ samples)`,
      );
      return lastCycle;
    }

    const { version, weights: oldWeights } = await getActiveWeights();
    const deltas: Partial<Record<FeatureKey, number>> = {};
    const updated: WeightVector = { ...oldWeights };
    for (const k of FEATURE_KEYS) {
      const meanPos = posSum[k] / posW;
      const meanNeg = negW > 0 ? negSum[k] / negW : 0;
      const delta = LEARNING_RATE * (meanPos - meanNeg);
      deltas[k] = Math.round(delta * 1000) / 1000;
      updated[k] = Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, oldWeights[k] + delta));
    }
    // Renormalize so total influence stays constant — learning shifts emphasis,
    // it never inflates scores. Re-clamp after normalization so stored weights
    // always respect the bounds.
    const sum = Object.values(updated).reduce((a, b) => a + b, 0);
    for (const k of FEATURE_KEYS) {
      const normalized = (updated[k] * WEIGHT_SUM) / sum;
      updated[k] = Math.round(Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, normalized)) * 1000) / 1000;
    }

    const changed = FEATURE_KEYS.some((k) => Math.abs(updated[k] - oldWeights[k]) > 0.001);
    if (!changed) {
      // Outcomes were evaluated and contributed no change — consume them so
      // they never re-teach the weights.
      await markConsumed();
      lastCycle = makeStats(false, impressions.length, follows, dismissals.length, ignored, followRate, "weights already converged");
      return lastCycle;
    }

    const metrics = {
      windowDays: SIGNAL_WINDOW_MS / (24 * 60 * 60 * 1000),
      impressions: impressions.length,
      follows,
      dismissals: dismissals.length,
      ignored,
      followRate,
      deltas,
    };
    const insight = await writeClaudeInsight(metrics, oldWeights, updated);
    const newVersion = version + 1;
    await db.insert(matchWeights).values({
      version: newVersion,
      weights: updated,
      metrics,
      insight:
        insight ||
        `Cycle ${newVersion}: re-tuned matching weights from ${follows} follows across ${impressions.length} suggestions.`,
    });
    weightsCache = null; // force reload
    await markConsumed();

    lastCycle = { ...makeStats(true, impressions.length, follows, dismissals.length, ignored, followRate, "weights updated"), version: newVersion };
    console.log(`[match-agent] learned: v${newVersion}, followRate=${followRate}, deltas=`, deltas);
    return lastCycle;
  } catch (err: any) {
    console.error("[match-agent] learning cycle failed:", err?.message || err);
    lastCycle = makeStats(false, 0, 0, 0, 0, 0, `cycle failed: ${err?.message || "unknown error"}`);
    return lastCycle;
  } finally {
    cycleRunning = false;
  }
}

function zeroVector(): Record<FeatureKey, number> {
  const v = {} as Record<FeatureKey, number>;
  for (const k of FEATURE_KEYS) v[k] = 0;
  return v;
}

function sanitizeFeatures(raw: any): FeatureVector | null {
  if (!raw || typeof raw !== "object") return null;
  const f = zeroVector();
  for (const k of FEATURE_KEYS) {
    const v = Number(raw[k]);
    f[k] = Number.isFinite(v) ? clamp01(v) : 0;
  }
  return f;
}

function makeStats(
  learned: boolean,
  impressions: number,
  follows: number,
  dismissals: number,
  ignored: number,
  followRate: number,
  note: string,
): CycleStats {
  return {
    at: new Date().toISOString(),
    learned,
    impressions,
    follows,
    dismissals,
    ignored,
    followRate,
    version: weightsCache?.version ?? 0,
    note,
  };
}

export function startMatchAgent(): void {
  if (agentStarted) return;
  agentStarted = true;
  // First cycle shortly after boot, then every hour forever.
  setTimeout(() => {
    runLearningCycle().catch(() => {});
    nextCycleAt = Date.now() + CYCLE_MS;
    setInterval(() => {
      runLearningCycle().catch(() => {});
      nextCycleAt = Date.now() + CYCLE_MS;
    }, CYCLE_MS);
  }, 60 * 1000);
  nextCycleAt = Date.now() + 60 * 1000;
  console.log("[match-agent] started — learning every 60 minutes");
}

// --- routes ------------------------------------------------------------------

export const matchRouter = Router();

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

// Explicit negative signal — the user dismissed a suggestion card.
// Guests can't follow, so their dismissals aren't learning signals either.
matchRouter.post("/api/match/feedback", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const user = await storage.getUser(session.userId);
    if (!user || user.isGuest) return res.status(403).json({ error: "Full account required" });
    const candidateId = typeof req.body?.candidateId === "string" ? req.body.candidateId : "";
    const action = req.body?.action;
    if (!candidateId || action !== "dismiss") {
      return res.status(400).json({ error: "candidateId and action='dismiss' required" });
    }
    if (candidateId === session.userId) return res.status(400).json({ error: "Invalid candidate" });
    const { version } = await getActiveWeights();
    await db.insert(matchSignals).values({
      userId: session.userId,
      candidateId,
      kind: "dismiss",
      weightsVersion: version,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed to record feedback" });
  }
});

// Agent status — current brain version, weights, last cycle, latest insight.
matchRouter.get("/api/match/agent/status", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const { version, weights } = await getActiveWeights();
    const [latest] = await db.select().from(matchWeights).orderBy(desc(matchWeights.version)).limit(1);
    const [signalCount] = await db
      .select({ n: count() })
      .from(matchSignals)
      .where(gte(matchSignals.createdAt, new Date(Date.now() - SIGNAL_WINDOW_MS)));
    res.json({
      agent: "social-match",
      model: CLAUDE_MODEL,
      learningIntervalMinutes: CYCLE_MS / 60000,
      version,
      weights,
      defaultWeights: DEFAULT_WEIGHTS,
      signalsLast7Days: Number(signalCount?.n || 0),
      lastCycle,
      nextCycleAt: nextCycleAt ? new Date(nextCycleAt).toISOString() : null,
      latestInsight: latest?.insight || null,
      latestMetrics: latest?.metrics || null,
      latestLearnedAt: latest?.createdAt || null,
    });
  } catch {
    res.status(500).json({ error: "Failed to load agent status" });
  }
});
