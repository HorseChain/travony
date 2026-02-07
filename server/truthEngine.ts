import { db } from "./db";
import { truthRides, truthSignals, truthConsent, truthProviders } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import OpenAI from "openai";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI();
  }
  return _openai;
}

export interface ExtractedSignals {
  quotedPrice?: number;
  finalPrice?: number;
  quotedEtaMinutes?: number;
  actualPickupMinutes?: number;
  driverCancelled?: boolean;
  cancellationCount?: number;
  expectedDistanceKm?: number;
  actualDistanceKm?: number;
  expectedDurationMin?: number;
  actualDurationMin?: number;
  supportResolved?: boolean;
  supportOutcome?: string;
  providerName?: string;
}

export interface GpsPoint {
  lat: number;
  lng: number;
  timestamp: number;
  speed?: number;
}

export async function extractSignalsFromScreenshot(screenshotBase64: string): Promise<ExtractedSignals> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a ride receipt analyzer. Extract ride details from screenshots of ride-hailing app receipts. Return ONLY a JSON object with these fields (use null for unavailable data):
{
  "quotedPrice": number or null,
  "finalPrice": number or null,
  "quotedEtaMinutes": number or null,
  "actualPickupMinutes": number or null,
  "driverCancelled": boolean or null,
  "cancellationCount": number or null,
  "expectedDistanceKm": number or null,
  "actualDistanceKm": number or null,
  "expectedDurationMin": number or null,
  "actualDurationMin": number or null,
  "supportResolved": boolean or null,
  "supportOutcome": string or null,
  "providerName": string or null
}
Do NOT infer or hallucinate values. Only extract what is clearly visible.`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract ride details from this receipt screenshot:" },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${screenshotBase64}` } }
          ]
        }
      ],
      max_tokens: 500,
      temperature: 0,
    });

    const content = response.choices[0]?.message?.content || "{}";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    const parsed = JSON.parse(jsonMatch[0]);
    const signals: ExtractedSignals = {};

    if (parsed.quotedPrice !== null && parsed.quotedPrice !== undefined) signals.quotedPrice = Number(parsed.quotedPrice);
    if (parsed.finalPrice !== null && parsed.finalPrice !== undefined) signals.finalPrice = Number(parsed.finalPrice);
    if (parsed.quotedEtaMinutes !== null && parsed.quotedEtaMinutes !== undefined) signals.quotedEtaMinutes = Number(parsed.quotedEtaMinutes);
    if (parsed.actualPickupMinutes !== null && parsed.actualPickupMinutes !== undefined) signals.actualPickupMinutes = Number(parsed.actualPickupMinutes);
    if (parsed.driverCancelled !== null && parsed.driverCancelled !== undefined) signals.driverCancelled = Boolean(parsed.driverCancelled);
    if (parsed.cancellationCount !== null && parsed.cancellationCount !== undefined) signals.cancellationCount = Number(parsed.cancellationCount);
    if (parsed.expectedDistanceKm !== null && parsed.expectedDistanceKm !== undefined) signals.expectedDistanceKm = Number(parsed.expectedDistanceKm);
    if (parsed.actualDistanceKm !== null && parsed.actualDistanceKm !== undefined) signals.actualDistanceKm = Number(parsed.actualDistanceKm);
    if (parsed.expectedDurationMin !== null && parsed.expectedDurationMin !== undefined) signals.expectedDurationMin = Number(parsed.expectedDurationMin);
    if (parsed.actualDurationMin !== null && parsed.actualDurationMin !== undefined) signals.actualDurationMin = Number(parsed.actualDurationMin);
    if (parsed.supportResolved !== null && parsed.supportResolved !== undefined) signals.supportResolved = Boolean(parsed.supportResolved);
    if (parsed.supportOutcome !== null && parsed.supportOutcome !== undefined) signals.supportOutcome = String(parsed.supportOutcome);
    if (parsed.providerName !== null && parsed.providerName !== undefined) signals.providerName = String(parsed.providerName);

    return signals;
  } catch (error) {
    console.error("Screenshot extraction failed:", error);
    return {};
  }
}

export function extractSignalsFromNotification(notificationText: string): Partial<ExtractedSignals> {
  const signals: Partial<ExtractedSignals> = {};

  const priceMatch = notificationText.match(/(?:fare|price|charged|total|amount)[:\s]*[\$£€₹]?\s*([\d,.]+)/i);
  if (priceMatch) signals.finalPrice = parseFloat(priceMatch[1].replace(/,/g, ""));

  const etaMatch = notificationText.match(/(?:arriving in|eta|pickup in)[:\s]*(\d+)\s*(?:min|minutes)/i);
  if (etaMatch) signals.quotedEtaMinutes = parseInt(etaMatch[1]);

  const cancelMatch = notificationText.match(/(?:driver\s+cancel|ride\s+cancel|trip\s+cancel)/i);
  if (cancelMatch) signals.driverCancelled = true;

  const distMatch = notificationText.match(/([\d.]+)\s*(?:km|kilometers|miles)/i);
  if (distMatch) signals.expectedDistanceKm = parseFloat(distMatch[1]);

  return signals;
}

export function analyzeGpsTrace(trace: GpsPoint[]): { distanceKm: number; durationMin: number; isConsistent: boolean } {
  if (trace.length < 2) {
    return { distanceKm: 0, durationMin: 0, isConsistent: false };
  }

  let totalDistance = 0;
  let suspiciousJumps = 0;

  for (let i = 1; i < trace.length; i++) {
    const d = haversineDistance(trace[i - 1].lat, trace[i - 1].lng, trace[i].lat, trace[i].lng);
    totalDistance += d;

    const timeDiff = (trace[i].timestamp - trace[i - 1].timestamp) / 1000;
    if (timeDiff > 0) {
      const speedKmh = (d / timeDiff) * 3600;
      if (speedKmh > 200) suspiciousJumps++;
    }
  }

  const durationMin = (trace[trace.length - 1].timestamp - trace[0].timestamp) / 60000;
  const isConsistent = suspiciousJumps < trace.length * 0.1;

  return { distanceKm: totalDistance, durationMin, isConsistent };
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function storeSignals(truthRideId: string, signals: ExtractedSignals, method: string): Promise<void> {
  const signalEntries = [
    { type: "quoted_price", value: signals.quotedPrice?.toString() },
    { type: "final_price", value: signals.finalPrice?.toString() },
    { type: "quoted_eta", value: signals.quotedEtaMinutes?.toString() },
    { type: "actual_pickup", value: signals.actualPickupMinutes?.toString() },
    { type: "driver_cancelled", value: signals.driverCancelled?.toString() },
    { type: "cancellation_count", value: signals.cancellationCount?.toString() },
    { type: "expected_distance", value: signals.expectedDistanceKm?.toString() },
    { type: "actual_distance", value: signals.actualDistanceKm?.toString() },
    { type: "expected_duration", value: signals.expectedDurationMin?.toString() },
    { type: "actual_duration", value: signals.actualDurationMin?.toString() },
    { type: "support_resolved", value: signals.supportResolved?.toString() },
    { type: "support_outcome", value: signals.supportOutcome },
  ];

  for (const entry of signalEntries) {
    await db.insert(truthSignals).values({
      truthRideId,
      signalType: entry.type,
      rawValue: entry.value || null,
      status: entry.value ? "extracted" : "unknown",
      extractionMethod: method,
      confidence: entry.value ? "0.85" : "0.00",
    });
  }
}

export async function getOrCreateProvider(name: string): Promise<string> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "");
  const [existing] = await db.select().from(truthProviders).where(eq(truthProviders.slug, slug)).limit(1);
  if (existing) return existing.id;

  const deepLinks: Record<string, { android?: string; ios?: string; scheme?: string }> = {
    uber: { android: "com.ubercab", ios: "uber://", scheme: "uber" },
    lyft: { android: "me.lyft.android", ios: "lyft://", scheme: "lyft" },
    careem: { android: "com.careem.acma", ios: "careem://", scheme: "careem" },
    bolt: { android: "ee.mtakso.client", ios: "bolt://", scheme: "bolt" },
    grab: { android: "com.grabtaxi.passenger", ios: "grab://", scheme: "grab" },
    gojek: { android: "com.gojek.app", ios: "gojek://", scheme: "gojek" },
    ola: { android: "com.olacabs.customer", ios: "olacabs://", scheme: "ola" },
    indrive: { android: "sinet.startup.inDriver", ios: "indrive://", scheme: "indrive" },
    travony: { android: "com.travony.rider", ios: "travony://", scheme: "travony" },
  };

  const links = deepLinks[slug] || {};
  const [provider] = await db.insert(truthProviders).values({
    name,
    slug,
    androidPackage: links.android,
    iosUrlScheme: links.ios,
    deepLinkScheme: links.scheme,
  }).returning();

  return provider.id;
}

export async function checkUserConsent(userId: string): Promise<{ hasConsent: boolean; consent?: any }> {
  const [consent] = await db.select().from(truthConsent)
    .where(and(eq(truthConsent.userId, userId), eq(truthConsent.status, "granted")))
    .limit(1);
  return { hasConsent: !!consent, consent };
}

export function getTimeBlock(date: Date): string {
  const hour = date.getHours();
  if (hour >= 6 && hour < 10) return "morning_rush";
  if (hour >= 10 && hour < 16) return "midday";
  if (hour >= 16 && hour < 20) return "evening_rush";
  if (hour >= 20 || hour < 2) return "night";
  return "late_night";
}

export function getRouteType(distanceKm: number): string {
  if (distanceKm < 3) return "short";
  if (distanceKm < 10) return "medium";
  if (distanceKm < 25) return "long";
  return "intercity";
}
