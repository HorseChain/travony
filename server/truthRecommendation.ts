import { db } from "./db";
import { truthProviders, truthAggregations } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { getRankings } from "./truthAggregation";

const MIN_CONFIDENCE = 0.3;
const MIN_SAMPLE_COUNT = 5;

export interface Recommendation {
  providerId: string;
  providerName: string;
  score: number;
  reason: string;
  confidence: number;
  deepLink: string | null;
  androidPackage: string | null;
  iosUrlScheme: string | null;
}

export async function getRecommendation(
  cityName: string,
  timeBlock?: string,
  routeType?: string
): Promise<Recommendation | null> {
  const rankings = await getRankings(cityName, timeBlock, routeType);

  const eligible = rankings.filter(r => r.confidence >= MIN_CONFIDENCE && r.sampleCount >= MIN_SAMPLE_COUNT);

  if (eligible.length === 0) return null;

  const top = eligible[0];
  const [provider] = await db.select().from(truthProviders)
    .where(eq(truthProviders.id, top.providerId))
    .limit(1);

  if (!provider) return null;

  const reason = generateReason(top, eligible);

  return {
    providerId: top.providerId,
    providerName: top.providerName,
    score: top.avgScore,
    reason,
    confidence: top.confidence,
    deepLink: provider.deepLinkScheme ? `${provider.deepLinkScheme}://` : null,
    androidPackage: provider.androidPackage,
    iosUrlScheme: provider.iosUrlScheme,
  };
}

function generateReason(top: any, all: any[]): string {
  const strengths: string[] = [];

  if (top.priceAvg >= 80) strengths.push("price accuracy");
  if (top.pickupAvg >= 80) strengths.push("pickup timing");
  if (top.cancellationAvg >= 80) strengths.push("low cancellations");
  if (top.routeAvg >= 80) strengths.push("route efficiency");
  if (top.supportAvg >= 80) strengths.push("support quality");

  if (strengths.length === 0) {
    return `${top.providerName} has the highest overall reliability score of ${top.avgScore} in this area.`;
  }

  const topStrength = strengths[0];
  return `${top.providerName} scores ${top.avgScore}/100 overall, strongest in ${topStrength} based on ${top.sampleCount} verified rides.`;
}

export async function getContextualRankings(
  cityName: string,
  timeBlock?: string,
  routeType?: string
): Promise<{
  rankings: Recommendation[];
  hasEnoughData: boolean;
  dataMessage: string;
}> {
  const rankings = await getRankings(cityName, timeBlock, routeType);

  if (rankings.length === 0) {
    return {
      rankings: [],
      hasEnoughData: false,
      dataMessage: "Not enough ride data in this area yet. Log rides to help build trust scores.",
    };
  }

  const eligible = rankings.filter(r => r.sampleCount >= MIN_SAMPLE_COUNT);

  if (eligible.length === 0) {
    return {
      rankings: [],
      hasEnoughData: false,
      dataMessage: `Data collection in progress. Need at least ${MIN_SAMPLE_COUNT} verified rides per provider.`,
    };
  }

  const recommendations: Recommendation[] = [];
  for (const rank of eligible) {
    const [provider] = await db.select().from(truthProviders)
      .where(eq(truthProviders.id, rank.providerId))
      .limit(1);

    if (!provider) continue;

    recommendations.push({
      providerId: rank.providerId,
      providerName: rank.providerName,
      score: rank.avgScore,
      reason: generateReason(rank, eligible),
      confidence: rank.confidence,
      deepLink: provider.deepLinkScheme ? `${provider.deepLinkScheme}://` : null,
      androidPackage: provider.androidPackage,
      iosUrlScheme: provider.iosUrlScheme,
    });
  }

  return {
    rankings: recommendations,
    hasEnoughData: true,
    dataMessage: `Rankings based on ${rankings.reduce((sum, r) => sum + r.sampleCount, 0)} verified rides.`,
  };
}
