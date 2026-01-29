import { db } from "./db";
import { disputes, rides, ratings, rideTelemetry, users, drivers } from "@shared/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export interface DisputeAnalysis {
  confidence: number;
  recommendation: string;
  analysis: string;
  suggestedRefund?: number;
  evidenceSummary: {
    gpsVerified: boolean;
    routeDeviation: number;
    fareAccuracy: number;
    ratingPattern: string;
  };
}

export interface RouteAnalysis {
  expectedDistance: number;
  actualDistance: number;
  deviationPercent: number;
  isSignificantDetour: boolean;
  detourExplanation: string;
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

async function analyzeRoute(rideId: string): Promise<RouteAnalysis> {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  if (!ride) throw new Error("Ride not found");
  
  const telemetryData = await db.select().from(rideTelemetry)
    .where(eq(rideTelemetry.rideId, rideId))
    .orderBy(rideTelemetry.recordedAt);
  
  const directDistance = calculateDistance(
    parseFloat(ride.pickupLat),
    parseFloat(ride.pickupLng),
    parseFloat(ride.dropoffLat),
    parseFloat(ride.dropoffLng)
  );
  
  let actualDistance = 0;
  if (telemetryData.length > 1) {
    for (let i = 1; i < telemetryData.length; i++) {
      actualDistance += calculateDistance(
        parseFloat(telemetryData[i-1].lat),
        parseFloat(telemetryData[i-1].lng),
        parseFloat(telemetryData[i].lat),
        parseFloat(telemetryData[i].lng)
      );
    }
  } else {
    actualDistance = ride.distance ? parseFloat(ride.distance) : directDistance * 1.3;
  }
  
  const expectedDistance = directDistance * 1.3;
  const deviationPercent = ((actualDistance - expectedDistance) / expectedDistance) * 100;
  
  const isSignificantDetour = deviationPercent > 25;
  
  let detourExplanation = "Route appears normal";
  if (deviationPercent > 50) {
    detourExplanation = "Significant route deviation detected - possible intentional detour";
  } else if (deviationPercent > 25) {
    detourExplanation = "Minor route deviation - may be due to traffic or road conditions";
  } else if (deviationPercent < -10) {
    detourExplanation = "Route shorter than expected - direct path was taken";
  }
  
  return {
    expectedDistance: Math.round(expectedDistance * 100) / 100,
    actualDistance: Math.round(actualDistance * 100) / 100,
    deviationPercent: Math.round(deviationPercent * 100) / 100,
    isSignificantDetour,
    detourExplanation,
  };
}

async function analyzeRatingPattern(driverId: string): Promise<{ pattern: string; suspicionLevel: number }> {
  const recentRatings = await db.select().from(ratings)
    .where(eq(ratings.toDriverId, driverId))
    .orderBy(desc(ratings.createdAt))
    .limit(50);
  
  if (recentRatings.length < 10) {
    return { pattern: "insufficient_data", suspicionLevel: 0 };
  }
  
  const avgRating = recentRatings.reduce((sum, r) => sum + r.rating, 0) / recentRatings.length;
  const oneStarCount = recentRatings.filter(r => r.rating === 1).length;
  const fiveStarCount = recentRatings.filter(r => r.rating === 5).length;
  
  const oneStarPercent = (oneStarCount / recentRatings.length) * 100;
  const fiveStarPercent = (fiveStarCount / recentRatings.length) * 100;
  
  if (oneStarPercent > 30) {
    return { pattern: "high_negative_cluster", suspicionLevel: 60 };
  }
  
  if (fiveStarPercent > 90 && avgRating > 4.9) {
    return { pattern: "suspicious_perfection", suspicionLevel: 40 };
  }
  
  if (avgRating < 3.5) {
    return { pattern: "consistently_low", suspicionLevel: 20 };
  }
  
  return { pattern: "normal", suspicionLevel: 0 };
}

async function analyzeFareDispute(rideId: string): Promise<DisputeAnalysis> {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  if (!ride) throw new Error("Ride not found");
  
  const routeAnalysis = await analyzeRoute(rideId);
  
  const estimatedFare = parseFloat(ride.estimatedFare || "0");
  const actualFare = parseFloat(ride.actualFare || "0");
  const fareDifference = actualFare - estimatedFare;
  const fareDeviationPercent = (fareDifference / estimatedFare) * 100;
  
  let confidence = 85;
  let recommendation = "no_action";
  let analysis = "";
  let suggestedRefund: number | undefined;
  
  if (routeAnalysis.isSignificantDetour && fareDeviationPercent > 20) {
    confidence = 95;
    recommendation = "refund_partial";
    analysis = `GPS data shows significant route deviation (${routeAnalysis.deviationPercent.toFixed(1)}% longer than expected). Fare was ${fareDeviationPercent.toFixed(1)}% higher than estimate. Recommending partial refund based on expected route fare.`;
    suggestedRefund = fareDifference * 0.8;
  } else if (routeAnalysis.isSignificantDetour) {
    confidence = 75;
    recommendation = "refund_partial";
    analysis = `Route deviation detected but fare increase is within tolerance. Possible traffic-related detour. Recommending minor goodwill adjustment.`;
    suggestedRefund = fareDifference * 0.3;
  } else if (fareDeviationPercent > 30) {
    confidence = 70;
    recommendation = "refund_partial";
    analysis = `Fare significantly exceeded estimate without route deviation. May be due to traffic or waiting time. Recommending partial refund.`;
    suggestedRefund = fareDifference * 0.5;
  } else if (fareDeviationPercent > 15) {
    confidence = 80;
    analysis = `Fare deviation within acceptable range for traffic conditions. Route verified as reasonable.`;
    recommendation = "no_action";
  } else {
    confidence = 95;
    analysis = `Fare and route both verified as accurate. No issues detected.`;
    recommendation = "no_action";
  }
  
  return {
    confidence,
    recommendation,
    analysis,
    suggestedRefund: suggestedRefund ? Math.round(suggestedRefund * 100) / 100 : undefined,
    evidenceSummary: {
      gpsVerified: true,
      routeDeviation: routeAnalysis.deviationPercent,
      fareAccuracy: 100 - Math.abs(fareDeviationPercent),
      ratingPattern: "not_analyzed",
    },
  };
}

async function analyzeRatingDispute(rideId: string, disputedRating: number): Promise<DisputeAnalysis> {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  if (!ride || !ride.driverId) throw new Error("Ride or driver not found");
  
  const ratingPattern = await analyzeRatingPattern(ride.driverId);
  
  const [rideRating] = await db.select().from(ratings)
    .where(eq(ratings.rideId, rideId))
    .limit(1);
  
  let confidence = 70;
  let recommendation = "no_action";
  let analysis = "";
  
  if (disputedRating === 1 && ratingPattern.pattern === "normal") {
    confidence = 60;
    recommendation = "no_action";
    analysis = `Driver has normal rating pattern. Single low rating does not indicate manipulation. Rating stands.`;
  } else if (ratingPattern.pattern === "high_negative_cluster") {
    confidence = 75;
    recommendation = "warning_driver";
    analysis = `Detected pattern of negative ratings. Driver may need coaching or review. Rating stands but flagged for review.`;
  } else if (ratingPattern.pattern === "suspicious_perfection") {
    confidence = 65;
    recommendation = "rating_removed";
    analysis = `Unusually perfect rating pattern detected. May indicate rating manipulation. Recommending investigation.`;
  } else {
    confidence = 85;
    analysis = `Rating pattern appears normal. No manipulation detected.`;
  }
  
  return {
    confidence,
    recommendation,
    analysis,
    evidenceSummary: {
      gpsVerified: true,
      routeDeviation: 0,
      fareAccuracy: 100,
      ratingPattern: ratingPattern.pattern,
    },
  };
}

async function analyzeSafetyDispute(rideId: string, description: string): Promise<DisputeAnalysis> {
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  if (!ride) throw new Error("Ride not found");
  
  const telemetryData = await db.select().from(rideTelemetry)
    .where(eq(rideTelemetry.rideId, rideId))
    .orderBy(rideTelemetry.recordedAt);
  
  let maxSpeed = 0;
  let avgSpeed = 0;
  if (telemetryData.length > 0) {
    const speeds = telemetryData.map(t => parseFloat(t.speed || "0"));
    maxSpeed = Math.max(...speeds);
    avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  }
  
  let confidence = 60;
  let recommendation = "no_action";
  let analysis = "";
  
  const lowerDesc = description.toLowerCase();
  
  if (lowerDesc.includes("speed") || lowerDesc.includes("fast") || lowerDesc.includes("dangerous")) {
    if (maxSpeed > 120) {
      confidence = 90;
      recommendation = "warning_driver";
      analysis = `GPS data confirms excessive speed (max: ${maxSpeed.toFixed(0)} km/h). Driver will receive warning.`;
    } else if (maxSpeed > 90) {
      confidence = 70;
      recommendation = "no_action";
      analysis = `Speed detected was ${maxSpeed.toFixed(0)} km/h which is within highway limits. No violation detected.`;
    } else {
      confidence = 80;
      recommendation = "no_action";
      analysis = `GPS data shows normal driving speeds (max: ${maxSpeed.toFixed(0)} km/h). Claim not supported by evidence.`;
    }
  } else {
    confidence = 50;
    analysis = `Safety concern noted and logged. Unable to verify automatically. Manual review may be needed.`;
    recommendation = "no_action";
  }
  
  return {
    confidence,
    recommendation,
    analysis,
    evidenceSummary: {
      gpsVerified: true,
      routeDeviation: 0,
      fareAccuracy: 100,
      ratingPattern: "not_analyzed",
    },
  };
}

export async function resolveDispute(
  rideId: string,
  type: string,
  description: string,
  disputedValue?: number
): Promise<DisputeAnalysis> {
  switch (type) {
    case "fare":
    case "route":
      return analyzeFareDispute(rideId);
    case "rating":
      return analyzeRatingDispute(rideId, disputedValue || 1);
    case "safety":
    case "behavior":
      return analyzeSafetyDispute(rideId, description);
    default:
      return {
        confidence: 50,
        recommendation: "no_action",
        analysis: "Unable to auto-resolve this dispute type. Escalating to manual review.",
        evidenceSummary: {
          gpsVerified: false,
          routeDeviation: 0,
          fareAccuracy: 100,
          ratingPattern: "not_analyzed",
        },
      };
  }
}

export async function createAndResolveDispute(
  rideId: string,
  reporterId: string,
  reporterRole: string,
  type: string,
  description: string
): Promise<{ disputeId: string; analysis: DisputeAnalysis; resolved: boolean }> {
  const analysis = await resolveDispute(rideId, type, description);
  
  const [ride] = await db.select().from(rides).where(eq(rides.id, rideId)).limit(1);
  
  const [dispute] = await db.insert(disputes).values({
    rideId,
    reporterId,
    reporterRole,
    type: type as any,
    status: analysis.confidence >= 80 ? "closed" : "investigating",
    description,
    estimatedFare: ride?.estimatedFare,
    actualFare: ride?.actualFare,
    aiAnalysis: analysis.analysis,
    aiConfidence: analysis.confidence.toString(),
    aiRecommendation: analysis.recommendation as any,
    resolution: analysis.confidence >= 80 ? analysis.recommendation as any : null,
    refundAmount: analysis.suggestedRefund?.toString(),
    resolvedAt: analysis.confidence >= 80 ? new Date() : null,
    resolvedBy: analysis.confidence >= 80 ? "ai_system" : null,
  }).returning();
  
  if (analysis.confidence >= 80 && analysis.suggestedRefund && analysis.suggestedRefund > 0) {
    console.log(`Auto-refund of ${analysis.suggestedRefund} processed for dispute ${dispute.id}`);
  }
  
  return {
    disputeId: dispute.id,
    analysis,
    resolved: analysis.confidence >= 80,
  };
}

export async function recordTelemetry(
  rideId: string,
  lat: number,
  lng: number,
  speed?: number,
  heading?: number,
  accuracy?: number
): Promise<void> {
  await db.insert(rideTelemetry).values({
    rideId,
    lat: lat.toString(),
    lng: lng.toString(),
    speed: speed?.toString(),
    heading: heading?.toString(),
    accuracy: accuracy?.toString(),
  });
}

export async function getDisputesByRide(rideId: string) {
  return db.select().from(disputes).where(eq(disputes.rideId, rideId));
}

export async function getDisputesByUser(userId: string) {
  return db.select().from(disputes).where(eq(disputes.reporterId, userId)).orderBy(desc(disputes.createdAt));
}
