import { db } from "./db";
import { truthRides, truthScores, truthAggregations, truthProviders } from "@shared/schema";
import { eq, and, gte, sql, desc } from "drizzle-orm";

const MIN_SAMPLE_SIZE = 5;
const OUTLIER_CAP_PERCENTILE = 0.05;
const TIME_DECAY_HALF_LIFE_DAYS = 30;

interface AggregatedScore {
  providerId: string;
  providerName: string;
  avgScore: number;
  sampleCount: number;
  priceAvg: number;
  pickupAvg: number;
  cancellationAvg: number;
  routeAvg: number;
  supportAvg: number;
  confidence: number;
}

export async function aggregateScores(
  cityName: string,
  timeBlock?: string,
  routeType?: string
): Promise<AggregatedScore[]> {
  const providers = await db.select().from(truthProviders).where(eq(truthProviders.isActive, true));
  const results: AggregatedScore[] = [];

  for (const provider of providers) {
    const conditions = [
      eq(truthRides.providerId, provider.id),
      eq(truthRides.cityName, cityName),
    ];
    if (timeBlock) conditions.push(eq(truthRides.timeBlock, timeBlock));
    if (routeType) conditions.push(eq(truthRides.routeType, routeType));

    const rides = await db.select({
      rideId: truthRides.id,
      rideDate: truthRides.rideDate,
      totalScore: truthScores.totalScore,
      priceScore: truthScores.priceIntegrityScore,
      pickupScore: truthScores.pickupReliabilityScore,
      cancellationScore: truthScores.cancellationScore,
      routeScore: truthScores.routeIntegrityScore,
      supportScore: truthScores.supportResolutionScore,
    })
    .from(truthRides)
    .innerJoin(truthScores, eq(truthScores.truthRideId, truthRides.id))
    .where(and(...conditions))
    .orderBy(desc(truthRides.rideDate));

    if (rides.length < MIN_SAMPLE_SIZE) continue;

    const now = Date.now();
    let weightedTotal = 0;
    let weightedPrice = 0;
    let weightedPickup = 0;
    let weightedCancellation = 0;
    let weightedRoute = 0;
    let weightedSupport = 0;
    let totalWeight = 0;

    const scores = rides.map(r => parseFloat(r.totalScore || "0"));
    const { lower, upper } = getOutlierBounds(scores);

    for (const ride of rides) {
      const score = parseFloat(ride.totalScore || "0");
      if (score < lower || score > upper) continue;

      const ageMs = now - new Date(ride.rideDate).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      const weight = Math.pow(0.5, ageDays / TIME_DECAY_HALF_LIFE_DAYS);

      weightedTotal += score * weight;
      weightedPrice += parseFloat(ride.priceScore || "50") * weight;
      weightedPickup += parseFloat(ride.pickupScore || "50") * weight;
      weightedCancellation += parseFloat(ride.cancellationScore || "50") * weight;
      weightedRoute += parseFloat(ride.routeScore || "50") * weight;
      weightedSupport += parseFloat(ride.supportScore || "50") * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) continue;

    const sampleCount = rides.length;
    const confidence = Math.min(1, sampleCount / 50);

    results.push({
      providerId: provider.id,
      providerName: provider.name,
      avgScore: Math.round(weightedTotal / totalWeight),
      sampleCount,
      priceAvg: Math.round(weightedPrice / totalWeight),
      pickupAvg: Math.round(weightedPickup / totalWeight),
      cancellationAvg: Math.round(weightedCancellation / totalWeight),
      routeAvg: Math.round(weightedRoute / totalWeight),
      supportAvg: Math.round(weightedSupport / totalWeight),
      confidence: Math.round(confidence * 100) / 100,
    });
  }

  results.sort((a, b) => b.avgScore - a.avgScore);
  return results;
}

function getOutlierBounds(scores: number[]): { lower: number; upper: number } {
  if (scores.length < 5) return { lower: 0, upper: 100 };
  const sorted = [...scores].sort((a, b) => a - b);
  const lowerIdx = Math.floor(sorted.length * OUTLIER_CAP_PERCENTILE);
  const upperIdx = Math.floor(sorted.length * (1 - OUTLIER_CAP_PERCENTILE));
  return { lower: sorted[lowerIdx], upper: sorted[upperIdx] };
}

export async function updateAggregationCache(
  providerId: string,
  cityName: string,
  timeBlock?: string,
  routeType?: string
): Promise<void> {
  const scores = await aggregateScores(cityName, timeBlock, routeType);
  const providerScore = scores.find(s => s.providerId === providerId);
  if (!providerScore) return;

  const existing = await db.select().from(truthAggregations)
    .where(and(
      eq(truthAggregations.providerId, providerId),
      eq(truthAggregations.cityName, cityName),
      timeBlock ? eq(truthAggregations.timeBlock, timeBlock) : sql`${truthAggregations.timeBlock} IS NULL`,
      routeType ? eq(truthAggregations.routeType, routeType) : sql`${truthAggregations.routeType} IS NULL`
    ))
    .limit(1);

  const data = {
    providerId,
    cityName,
    timeBlock: timeBlock || null,
    routeType: routeType || null,
    avgScore: providerScore.avgScore.toString(),
    sampleCount: providerScore.sampleCount,
    priceAvg: providerScore.priceAvg.toString(),
    pickupAvg: providerScore.pickupAvg.toString(),
    cancellationAvg: providerScore.cancellationAvg.toString(),
    routeAvg: providerScore.routeAvg.toString(),
    supportAvg: providerScore.supportAvg.toString(),
    confidence: providerScore.confidence.toString(),
    lastUpdated: new Date(),
  };

  if (existing.length > 0) {
    await db.update(truthAggregations)
      .set(data)
      .where(eq(truthAggregations.id, existing[0].id));
  } else {
    await db.insert(truthAggregations).values(data);
  }
}

export async function getRankings(cityName: string, timeBlock?: string, routeType?: string): Promise<AggregatedScore[]> {
  return aggregateScores(cityName, timeBlock, routeType);
}
