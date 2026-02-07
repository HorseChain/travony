import { db } from "./db";
import { truthScores, truthRides } from "@shared/schema";
import { eq } from "drizzle-orm";

const WEIGHTS = {
  priceIntegrity: 0.30,
  pickupReliability: 0.25,
  cancellationBehavior: 0.20,
  routeIntegrity: 0.15,
  supportResolution: 0.10,
};

export interface PRTSResult {
  priceIntegrityScore: number;
  pickupReliabilityScore: number;
  cancellationScore: number;
  routeIntegrityScore: number;
  supportResolutionScore: number;
  totalScore: number;
  explanation: string;
}

export function computePRTS(ride: {
  quotedPrice?: string | null;
  finalPrice?: string | null;
  quotedEtaMinutes?: string | null;
  actualPickupMinutes?: string | null;
  driverCancelled?: boolean | null;
  cancellationCount?: number | null;
  expectedDistanceKm?: string | null;
  actualDistanceKm?: string | null;
  expectedDurationMin?: string | null;
  actualDurationMin?: string | null;
  supportResolved?: boolean | null;
  supportOutcome?: string | null;
}): PRTSResult {
  const price = scorePriceIntegrity(
    ride.quotedPrice ? parseFloat(ride.quotedPrice) : undefined,
    ride.finalPrice ? parseFloat(ride.finalPrice) : undefined
  );

  const pickup = scorePickupReliability(
    ride.quotedEtaMinutes ? parseFloat(ride.quotedEtaMinutes) : undefined,
    ride.actualPickupMinutes ? parseFloat(ride.actualPickupMinutes) : undefined
  );

  const cancellation = scoreCancellationBehavior(
    ride.driverCancelled ?? undefined,
    ride.cancellationCount ?? undefined
  );

  const route = scoreRouteIntegrity(
    ride.expectedDistanceKm ? parseFloat(ride.expectedDistanceKm) : undefined,
    ride.actualDistanceKm ? parseFloat(ride.actualDistanceKm) : undefined,
    ride.expectedDurationMin ? parseFloat(ride.expectedDurationMin) : undefined,
    ride.actualDurationMin ? parseFloat(ride.actualDurationMin) : undefined
  );

  const support = scoreSupportResolution(
    ride.supportResolved ?? undefined,
    ride.supportOutcome ?? undefined
  );

  const totalScore = Math.round(
    price * WEIGHTS.priceIntegrity +
    pickup * WEIGHTS.pickupReliability +
    cancellation * WEIGHTS.cancellationBehavior +
    route * WEIGHTS.routeIntegrity +
    support * WEIGHTS.supportResolution
  );

  const explanation = generateExplanation(price, pickup, cancellation, route, support, totalScore);

  return {
    priceIntegrityScore: price,
    pickupReliabilityScore: pickup,
    cancellationScore: cancellation,
    routeIntegrityScore: route,
    supportResolutionScore: support,
    totalScore,
    explanation,
  };
}

function scorePriceIntegrity(quoted?: number, final?: number): number {
  if (quoted === undefined || final === undefined) return 50;
  if (quoted === 0) return 50;

  const deviation = Math.abs(final - quoted) / quoted;
  if (deviation <= 0.02) return 100;
  if (deviation <= 0.05) return 90;
  if (deviation <= 0.10) return 75;
  if (deviation <= 0.20) return 55;
  if (deviation <= 0.30) return 35;
  if (deviation <= 0.50) return 15;
  return 0;
}

function scorePickupReliability(quotedEta?: number, actualPickup?: number): number {
  if (quotedEta === undefined || actualPickup === undefined) return 50;
  if (quotedEta === 0) return 50;

  const delayMin = actualPickup - quotedEta;
  if (delayMin <= 0) return 100;
  if (delayMin <= 1) return 95;
  if (delayMin <= 2) return 85;
  if (delayMin <= 5) return 70;
  if (delayMin <= 10) return 45;
  if (delayMin <= 15) return 25;
  return 5;
}

function scoreCancellationBehavior(cancelled?: boolean, count?: number): number {
  if (cancelled === undefined) return 75;
  if (!cancelled && (count === undefined || count === 0)) return 100;
  if (cancelled && (count === undefined || count <= 1)) return 20;
  if (count !== undefined && count >= 3) return 0;
  if (count !== undefined && count === 2) return 10;
  return 40;
}

function scoreRouteIntegrity(expectedDist?: number, actualDist?: number, expectedDur?: number, actualDur?: number): number {
  let distScore = 50;
  let durScore = 50;
  let hasData = false;

  if (expectedDist !== undefined && actualDist !== undefined && expectedDist > 0) {
    hasData = true;
    const deviation = Math.abs(actualDist - expectedDist) / expectedDist;
    if (deviation <= 0.05) distScore = 100;
    else if (deviation <= 0.10) distScore = 90;
    else if (deviation <= 0.15) distScore = 75;
    else if (deviation <= 0.25) distScore = 55;
    else if (deviation <= 0.40) distScore = 30;
    else distScore = 10;
  }

  if (expectedDur !== undefined && actualDur !== undefined && expectedDur > 0) {
    hasData = true;
    const deviation = Math.abs(actualDur - expectedDur) / expectedDur;
    if (deviation <= 0.10) durScore = 100;
    else if (deviation <= 0.20) durScore = 85;
    else if (deviation <= 0.30) durScore = 65;
    else if (deviation <= 0.50) durScore = 40;
    else durScore = 15;
  }

  if (!hasData) return 50;
  return Math.round((distScore + durScore) / 2);
}

function scoreSupportResolution(resolved?: boolean, outcome?: string): number {
  if (resolved === undefined) return 50;
  if (resolved === true) {
    if (outcome === "full_refund") return 90;
    if (outcome === "partial_refund") return 70;
    if (outcome === "apology_credit") return 60;
    return 80;
  }
  if (outcome === "no_response") return 5;
  if (outcome === "denied") return 15;
  return 25;
}

function generateExplanation(
  price: number, pickup: number, cancellation: number, route: number, support: number, total: number
): string {
  const parts: string[] = [];

  if (total >= 80) {
    parts.push("This ride was highly reliable overall.");
  } else if (total >= 60) {
    parts.push("This ride had some reliability issues.");
  } else if (total >= 40) {
    parts.push("This ride had significant issues.");
  } else {
    parts.push("This ride had major problems.");
  }

  if (price >= 80) parts.push("The final price matched the quoted fare well.");
  else if (price < 50) parts.push("The final price deviated significantly from the quote.");

  if (pickup >= 80) parts.push("The driver arrived on time.");
  else if (pickup < 50) parts.push("The driver arrived much later than promised.");

  if (cancellation < 50) parts.push("There were driver cancellation issues.");

  if (route >= 80) parts.push("The route taken was efficient.");
  else if (route < 50) parts.push("The actual route differed significantly from expected.");

  if (support < 50 && support !== 50) parts.push("Support resolution was unsatisfactory.");

  return parts.join(" ");
}

export async function computeAndStorePRTS(truthRideId: string): Promise<PRTSResult> {
  const [ride] = await db.select().from(truthRides).where(eq(truthRides.id, truthRideId)).limit(1);
  if (!ride) throw new Error("Truth ride not found");

  const result = computePRTS(ride);

  await db.insert(truthScores).values({
    truthRideId,
    priceIntegrityScore: result.priceIntegrityScore.toString(),
    pickupReliabilityScore: result.pickupReliabilityScore.toString(),
    cancellationScore: result.cancellationScore.toString(),
    routeIntegrityScore: result.routeIntegrityScore.toString(),
    supportResolutionScore: result.supportResolutionScore.toString(),
    totalScore: result.totalScore.toString(),
    explanation: result.explanation,
  });

  return result;
}
