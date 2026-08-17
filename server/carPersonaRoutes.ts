import { Router } from "express";
import OpenAI from "openai";
import { Router as RouterType } from "express";
import { storage } from "./storage";
import { db } from "./db";
import { vehicles, drivers, users, rides, ridePosts } from "@shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { buildBookingCard, resolveDestination } from "./assistantRoutes";
import { getRiderDestinationSuggestions } from "./intentEngine";

const router: RouterType = Router();

// ============================================================================
// Car Personas — every car is a talking AI.
//
// Hard rules (same honesty pattern as carAgent + assistantRoutes):
//   - The LLM NEVER authors numbers. Every stat, ETA and fare shown to a rider
//     comes from deterministic engines. LLM output is guarded: any numeric
//     token not present in the handed-in fact set rejects the whole text and
//     we fall back to a deterministic template.
//   - Crypto vocabulary is hard-walled out of all rider/driver-facing text.
//   - Booking from car chat NEVER creates a ride here. The chat returns a
//     booking card whose confirmPayload targets this driver; the client POSTs
//     it to /api/rides where region/fees are re-derived server-side and the
//     targeted window falls back to normal broadcast matching.
//   - Returning-rider memory is consented (users.carChatPersonalization) and
//     coarse: ride counts + frequent-destination LABELS only, never exact
//     addresses or coordinates volunteered by the car.
// ============================================================================

// ---------- session ----------
async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

// ---------- lazy OpenAI (degrade to deterministic) ----------
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
    console.error("[carPersona] OpenAI init failed, deterministic only:", err);
    _openaiInitFailed = true;
    return null;
  }
}

// ---------- deterministic helpers ----------
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ~28 km/h effective urban speed, minimum 2 minutes.
function etaMinutesFromKm(km: number): number {
  return Math.max(2, Math.round((km / 28) * 60));
}

const CRYPTO_WALL =
  /\b(crypto|cryptocurrency|token|tokens|blockchain|erc[- ]?20|ethereum|on[- ]?chain|coin|coins|stablecoin|usdt|hrs|wallet address)\b/i;

// Honesty guard for AI-written car text: no crypto vocab, and every numeric
// token must be one of the real facts we handed the model.
function carTextIsHonest(text: string, allowedNumbers: Array<number | string>): boolean {
  if (!text || text.length > 400) return false;
  if (CRYPTO_WALL.test(text)) return false;
  const allowed = new Set<string>();
  for (const n of allowedNumbers) {
    const num = typeof n === "number" ? n : parseFloat(String(n));
    if (!Number.isFinite(num)) continue;
    allowed.add(String(num));
    allowed.add(num.toFixed(0));
    allowed.add(num.toFixed(1));
    allowed.add(num.toFixed(2));
    allowed.add(String(Math.round(num)));
  }
  const tokens = text.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) || [];
  return tokens.every((t) => allowed.has(t) || allowed.has(String(parseFloat(t))));
}

// ---------- car fact loading ----------
export interface CarFacts {
  vehicle: typeof vehicles.$inferSelect;
  driver: typeof drivers.$inferSelect;
  driverUser: typeof users.$inferSelect;
  personaName: string;
  tone: string;
  trips: number;
  rating: number | null;
  ratingCount: number;
  yearsInFleet: number;
  monthsInFleet: number;
}

export async function loadCarFacts(vehicleId: string): Promise<CarFacts | null> {
  const rows = await db
    .select({ vehicle: vehicles, driver: drivers, driverUser: users })
    .from(vehicles)
    .innerJoin(drivers, eq(drivers.id, vehicles.driverId))
    .innerJoin(users, eq(users.id, drivers.userId))
    .where(eq(vehicles.id, vehicleId))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.driver.status !== "approved") return null;

  const v = row.vehicle;
  const trips = v.totalTrips ?? 0;
  // Vehicle reputation is the car's own track record; only fall back to the
  // driver rating when the car has no ratings yet.
  const ratingCount = v.ratingCount ?? 0;
  const rating =
    ratingCount > 0 && v.reputationScore
      ? parseFloat(v.reputationScore)
      : row.driver.rating
        ? parseFloat(row.driver.rating)
        : null;
  const ageMs = Date.now() - new Date(v.createdAt as any).getTime();
  const monthsInFleet = Math.max(0, Math.floor(ageMs / (30 * 24 * 60 * 60 * 1000)));
  const yearsInFleet = Math.floor(monthsInFleet / 12);
  const personaName =
    (v.personaName && v.personaName.trim()) ||
    (v.nickname && v.nickname.trim()) ||
    `${v.make} ${v.model}`;

  return {
    vehicle: v,
    driver: row.driver,
    driverUser: row.driverUser,
    personaName,
    tone: v.personaTone || "warm",
    trips,
    rating: rating && Number.isFinite(rating) ? rating : null,
    ratingCount,
    yearsInFleet,
    monthsInFleet,
  };
}

function fleetTenureLabel(f: CarFacts): string {
  if (f.yearsInFleet >= 1) return `${f.yearsInFleet} ${f.yearsInFleet === 1 ? "year" : "years"}`;
  if (f.monthsInFleet >= 1) return `${f.monthsInFleet} ${f.monthsInFleet === 1 ? "month" : "months"}`;
  return "less than a month";
}

// Deterministic blurb — always honest, used as fallback and as guard baseline.
function deterministicBlurb(f: CarFacts): string {
  const v = f.vehicle;
  const parts: string[] = [];
  const desc = [v.color, v.make, v.model].filter(Boolean).join(" ");
  parts.push(`I'm ${f.personaName}, a ${desc}.`);
  if (f.trips > 0 && f.rating) {
    parts.push(`${f.trips} trips together with my riders, rated ${f.rating.toFixed(2)} stars.`);
  } else if (f.trips > 0) {
    parts.push(`${f.trips} trips and counting.`);
  } else {
    parts.push(`Freshly on the road with Travony.`);
  }
  parts.push(`Hop in — I'll get you there.`);
  return parts.join(" ");
}

function allowedFactNumbers(f: CarFacts): Array<number | string> {
  const nums: Array<number | string> = [f.trips];
  if (f.rating) nums.push(f.rating);
  if (f.vehicle.year) nums.push(f.vehicle.year);
  if (f.ratingCount) nums.push(f.ratingCount);
  if (f.yearsInFleet) nums.push(f.yearsInFleet);
  if (f.monthsInFleet) nums.push(f.monthsInFleet);
  return nums;
}

// ---------- AI blurb generation (driver preview/regenerate) ----------
async function generateBlurb(f: CarFacts, tone: string): Promise<{ blurb: string; source: "ai" | "deterministic" }> {
  const client = getOpenAI();
  if (client) {
    try {
      const v = f.vehicle;
      const facts = [
        `Car: ${[v.color, v.make, v.model].filter(Boolean).join(" ")}${v.year ? ` (${v.year})` : ""}`,
        `Persona name: ${f.personaName}`,
        `Completed trips: ${f.trips}`,
        f.rating ? `Rating: ${f.rating.toFixed(2)} out of 5 (${f.ratingCount} ratings)` : `No ratings yet`,
        `Time with Travony: ${fleetTenureLabel(f)}`,
      ].join("\n");
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You write a short first-person intro blurb for a ride-hailing car with a public persona. The CAR speaks, not the driver. Tone: ${tone}. 1-2 sentences, max 220 characters.
STRICT RULES: use ONLY the numbers in the facts below (you may omit numbers, never invent or change one). No prices or fares. No emojis. No crypto/blockchain/token/coin vocabulary. No promises about timing.
FACTS:
${facts}`,
          },
          { role: "user", content: "Write the blurb." },
        ],
        max_tokens: 120,
        temperature: 0.8,
      });
      const blurb = response.choices[0]?.message?.content?.trim().replace(/^"|"$/g, "") || "";
      if (blurb && blurb.length <= 280 && carTextIsHonest(blurb, allowedFactNumbers(f))) {
        return { blurb, source: "ai" };
      }
      console.warn("[carPersona] AI blurb failed honesty guard, using deterministic");
    } catch (err) {
      console.error("[carPersona] blurb generation failed:", err);
    }
  }
  return { blurb: deterministicBlurb(f), source: "deterministic" };
}

// ---------- live status ----------
async function getLiveStatus(driverUserId: string): Promise<{ isLive: boolean; postId: string | null }> {
  const rows = await db
    .select({ id: ridePosts.id })
    .from(ridePosts)
    .where(
      and(
        eq(ridePosts.userId, driverUserId),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
      ),
    )
    .limit(1);
  return { isLive: rows.length > 0, postId: rows[0]?.id ?? null };
}

// ============================================================================
// GET /api/cars/:vehicleId/profile — public car profile (safe stats only).
// Optional ?lat=&lng= adds a deterministic distance/ETA from the rider.
// ============================================================================
router.get("/api/cars/:vehicleId/profile", async (req: any, res) => {
  try {
    const f = await loadCarFacts(req.params.vehicleId);
    if (!f) return res.status(404).json({ message: "Car not found" });

    const v = f.vehicle;
    const live = await getLiveStatus(f.driverUser.id);

    // Deterministic distance/ETA when the rider shares coords and the driver
    // is online with a known position. Never expose the driver's exact coords.
    let distanceKm: number | null = null;
    let etaMinutes: number | null = null;
    const qLat = parseFloat(String(req.query.lat ?? ""));
    const qLng = parseFloat(String(req.query.lng ?? ""));
    if (
      isFinite(qLat) && isFinite(qLng) &&
      f.driver.isOnline && f.driver.currentLat && f.driver.currentLng
    ) {
      const km = haversineKm(qLat, qLng, parseFloat(f.driver.currentLat), parseFloat(f.driver.currentLng));
      distanceKm = Math.round(km * 10) / 10;
      etaMinutes = etaMinutesFromKm(km);
    }

    res.json({
      vehicleId: v.id,
      publicHandle: v.publicHandle,
      personaName: f.personaName,
      blurb: (v.personaBlurb && v.personaBlurb.trim()) || deterministicBlurb(f),
      tone: f.tone,
      make: v.make,
      model: v.model,
      color: v.color,
      year: v.year,
      photo: v.photo,
      rating: f.rating ? f.rating.toFixed(2) : null,
      ratingCount: f.ratingCount,
      totalTrips: f.trips,
      fleetTenure: fleetTenureLabel(f),
      // No driver identity fields here: this endpoint is unauthenticated and
      // the car persona IS the public face. The driver's name only appears in
      // authenticated surfaces (chat, booking flow).
      isOnline: !!f.driver.isOnline,
      isLive: live.isLive,
      postId: live.postId,
      distanceKm,
      etaMinutes,
    });
  } catch (error: any) {
    console.error("[carPersona] profile failed:", error);
    res.status(500).json({ message: "Failed to load car profile" });
  }
});

// ---------- driver ownership guard ----------
async function requireVehicleOwner(req: any, res: any): Promise<CarFacts | null> {
  const session = await getSessionUser(req);
  if (!session) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  const driver = await storage.getDriverByUserId(session.userId);
  if (!driver) {
    res.status(403).json({ message: "Driver account required" });
    return null;
  }
  const f = await loadCarFacts(req.params.vehicleId);
  if (!f || f.driver.id !== driver.id) {
    res.status(404).json({ message: "Vehicle not found" });
    return null;
  }
  return f;
}

const TONES = new Set(["warm", "playful", "professional"]);

// ============================================================================
// POST /api/cars/:vehicleId/persona/preview — driver generates/regenerates a
// blurb draft from REAL vehicle stats. Nothing is saved.
// ============================================================================
router.post("/api/cars/:vehicleId/persona/preview", async (req: any, res) => {
  try {
    const f = await requireVehicleOwner(req, res);
    if (!f) return;
    const tone = TONES.has(String(req.body.tone)) ? String(req.body.tone) : f.tone;
    const { blurb, source } = await generateBlurb(f, tone);
    res.json({ personaName: f.personaName, blurb, tone, source });
  } catch (error: any) {
    console.error("[carPersona] preview failed:", error);
    res.status(500).json({ message: "Failed to generate persona" });
  }
});

// ============================================================================
// PUT /api/cars/:vehicleId/persona — driver saves persona (name/blurb/tone).
// The blurb must pass the honesty guard against the car's real stats.
// ============================================================================
router.put("/api/cars/:vehicleId/persona", async (req: any, res) => {
  try {
    const f = await requireVehicleOwner(req, res);
    if (!f) return;

    const personaName = typeof req.body.personaName === "string" ? req.body.personaName.trim().slice(0, 40) : null;
    const blurb = typeof req.body.personaBlurb === "string" ? req.body.personaBlurb.trim() : "";
    const tone = TONES.has(String(req.body.personaTone)) ? String(req.body.personaTone) : f.tone;

    if (!blurb || blurb.length > 280) {
      return res.status(400).json({ message: "Blurb is required (max 280 characters)" });
    }
    // The persona name is public text too — same honesty rules as the blurb.
    if (personaName && !carTextIsHonest(personaName, allowedFactNumbers(f))) {
      return res.status(400).json({
        message: "The name can only use your car's real stats — remove made-up numbers or restricted terms.",
      });
    }
    if (!carTextIsHonest(blurb, allowedFactNumbers(f))) {
      return res.status(400).json({
        message: "The intro can only use your car's real stats — remove made-up numbers or restricted terms.",
      });
    }

    await db
      .update(vehicles)
      .set({
        personaName: personaName || null,
        personaBlurb: blurb,
        personaTone: tone,
        personaUpdatedAt: new Date(),
      })
      .where(eq(vehicles.id, f.vehicle.id));

    res.json({ success: true });
  } catch (error: any) {
    console.error("[carPersona] save failed:", error);
    res.status(500).json({ message: "Failed to save persona" });
  }
});

// ============================================================================
// Rider privacy toggle for car-chat personalization.
// ============================================================================
router.get("/api/me/car-chat-privacy", async (req: any, res) => {
  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ message: "Authentication required" });
  const user = await storage.getUser(session.userId);
  res.json({ enabled: user?.carChatPersonalization !== false });
});

router.post("/api/me/car-chat-privacy", async (req: any, res) => {
  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ message: "Authentication required" });
  const enabled = req.body.enabled === true;
  await db.update(users).set({ carChatPersonalization: enabled }).where(eq(users.id, session.userId));
  res.json({ enabled });
});

// ============================================================================
// POST /api/cars/:vehicleId/chat — talk to the car.
// Deterministic executor grounds every number; the LLM only phrases small talk
// (guarded). Booking replies carry a card targeted at THIS driver.
// ============================================================================

const CAR_INTENTS = ["book_ride", "about_car", "chat"] as const;
type CarIntent = (typeof CAR_INTENTS)[number];

function carKeywordParse(text: string): { intent: CarIntent; destination: string | null } | null {
  const t = text.trim().toLowerCase();
  const destMatch = t.match(
    /(?:take me to|ride to|go to|bring me to|drive me to|i want to go to|book (?:a )?ride to|to)\s+(.+)/,
  );
  if (destMatch && destMatch[1] && destMatch[1].length >= 2) {
    return { intent: "book_ride", destination: destMatch[1].trim() };
  }
  if (/\b(book|ride|pick me up|pickup|come get me)\b/.test(t)) {
    return { intent: "book_ride", destination: null };
  }
  if (/\b(rating|trips|how long|how old|who.s your driver|about you|your driver|your car)\b/.test(t)) {
    return { intent: "about_car", destination: null };
  }
  return null;
}

async function carLlmParse(
  text: string,
  history: Array<{ role: "user" | "assistant"; text: string }>,
  f: CarFacts,
): Promise<{ intent: CarIntent; destination: string | null; reply: string | null }> {
  const client = getOpenAI();
  if (!client) return { intent: "chat", destination: null, reply: null };
  try {
    const historyMessages = history.slice(-6).map((h) => ({
      role: h.role,
      content: h.text.slice(0, 300),
    }));
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are "${f.personaName}", a Travony ride-hailing car with a public persona (a ${[f.vehicle.color, f.vehicle.make, f.vehicle.model].filter(Boolean).join(" ")}). You speak in first person as the car. Tone: ${f.tone}. The rider is chatting with you inside the Travony app.

Map the rider's LATEST message to EXACTLY ONE intent:
- book_ride: they want a ride somewhere (put any destination phrase in "destination")
- about_car: they ask about you, your stats, or your driver
- chat: anything else

Also write "reply": ONE OR TWO short sentences in character. STRICT RULES for reply: no numbers or digits of ANY kind (the app shows real stats and fares in cards), no prices, no promises about timing, no emojis, no crypto/blockchain/token/coin vocabulary.

Respond ONLY as JSON: {"intent": string, "destination": string|null, "reply": string}`,
        },
        ...historyMessages,
        { role: "user", content: text.slice(0, 500) },
      ],
      response_format: { type: "json_object" },
      max_tokens: 180,
      temperature: 0.6,
    });
    const parsed = JSON.parse(response.choices[0]?.message?.content || "{}");
    const intent: CarIntent = CAR_INTENTS.includes(parsed.intent) ? parsed.intent : "chat";
    const destination =
      typeof parsed.destination === "string" && parsed.destination.trim()
        ? parsed.destination.trim().slice(0, 200)
        : null;
    let reply: string | null =
      typeof parsed.reply === "string" && parsed.reply.trim() ? parsed.reply.trim().slice(0, 300) : null;
    // Free-text replies may not contain digits at all — numbers arrive via facts we template in.
    if (reply && !carTextIsHonest(reply, [])) reply = null;
    return { intent, destination, reply };
  } catch (err) {
    console.error("[carPersona] chat parse failed:", err);
    return { intent: "chat", destination: null, reply: null };
  }
}

// Deterministic "about me" answer — all numbers from real stats.
export function aboutCarReply(f: CarFacts): string {
  const bits: string[] = [];
  bits.push(`I'm ${f.personaName}, a ${[f.vehicle.color, f.vehicle.make, f.vehicle.model].filter(Boolean).join(" ")}${f.vehicle.year ? ` from ${f.vehicle.year}` : ""}.`);
  if (f.trips > 0 && f.rating) bits.push(`I've done ${f.trips} trips and riders rate me ${f.rating.toFixed(2)} stars.`);
  else if (f.trips > 0) bits.push(`I've done ${f.trips} trips so far.`);
  bits.push(`I've been with Travony for ${fleetTenureLabel(f)}, driven by ${(f.driverUser.name || "my driver").split(" ")[0]}.`);
  return bits.join(" ");
}

router.post("/api/cars/:vehicleId/chat", async (req: any, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });
    const userId = session.userId;

    const f = await loadCarFacts(req.params.vehicleId);
    if (!f) return res.status(404).json({ message: "Car not found" });

    const text = typeof req.body.text === "string" ? req.body.text.trim().slice(0, 500) : "";
    if (!text) return res.status(400).json({ message: "Message text is required" });

    const rawHistory: any[] = Array.isArray(req.body.history) ? req.body.history : [];
    const history = rawHistory
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.text === "string" && h.text.trim())
      .slice(-10)
      .map((h) => ({ role: h.role as "user" | "assistant", text: h.text.trim().slice(0, 400) }));

    const pickup =
      req.body.pickup &&
      Number.isFinite(parseFloat(req.body.pickup.lat)) &&
      Number.isFinite(parseFloat(req.body.pickup.lng))
        ? {
            address: String(req.body.pickup.address || "Current Location").slice(0, 300),
            lat: parseFloat(req.body.pickup.lat),
            lng: parseFloat(req.body.pickup.lng),
          }
        : null;

    const explicitDest =
      req.body.destination &&
      Number.isFinite(parseFloat(req.body.destination.lat)) &&
      Number.isFinite(parseFloat(req.body.destination.lng))
        ? {
            address: String(req.body.destination.address || "Destination").slice(0, 300),
            lat: parseFloat(req.body.destination.lat),
            lng: parseFloat(req.body.destination.lng),
          }
        : null;

    // Deterministic ETA from the driver's live position to the rider.
    let etaMinutes: number | null = null;
    if (pickup && f.driver.isOnline && f.driver.currentLat && f.driver.currentLng) {
      etaMinutes = etaMinutesFromKm(
        haversineKm(pickup.lat, pickup.lng, parseFloat(f.driver.currentLat), parseFloat(f.driver.currentLng)),
      );
    }

    const now = new Date();
    const hour = now.getHours();
    const dow = now.getDay();
    const tzOffset = -now.getTimezoneOffset();

    // Augments a generic quote card into a "this car" targeted booking card.
    const targetCard = async (dropoff: { address: string; lat: number; lng: number }) => {
      const card: any = await buildBookingCard(userId, pickup!, dropoff);
      card.confirmPayload.targetDriverId = f.driver.id;
      card.car = {
        vehicleId: f.vehicle.id,
        driverId: f.driver.id,
        personaName: f.personaName,
        etaMinutes,
      };
      return card;
    };

    // ---- Greeting (client sends "__greet__" on mount; never shown as a user bubble)
    if (text === "__greet__") {
      const bits: string[] = [];
      const desc = [f.vehicle.color, f.vehicle.make, f.vehicle.model].filter(Boolean).join(" ");
      bits.push(`Hi! I'm ${f.personaName} — a ${desc}.`);
      if (f.trips > 0 && f.rating) bits.push(`${f.trips} trips, ${f.rating.toFixed(2)} stars.`);

      // Consented, coarse returning-rider memory: ride count with THIS car and
      // frequent-destination labels only (no exact addresses volunteered).
      let suggestions: any[] = [];
      const user = await storage.getUser(userId);
      if (user?.carChatPersonalization !== false) {
        const together = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(rides)
          .where(
            and(eq(rides.customerId, userId), eq(rides.vehicleId, f.vehicle.id), eq(rides.status, "completed")),
          );
        const ridesTogether = together[0]?.count ?? 0;
        if (ridesTogether > 0) {
          bits.push(`Good to see you again — we've done ${ridesTogether} ${ridesTogether === 1 ? "ride" : "rides"} together.`);
        }
        try {
          const { suggestions: sugg, source } = await getRiderDestinationSuggestions(userId, hour, dow, tzOffset);
          if (source === "history" && sugg[0]?.label) {
            bits.push(`Heading to ${sugg[0].label} again?`);
          }
          suggestions = sugg;
        } catch {
          // best-effort personalization
        }
      }

      if (!f.driver.isOnline) {
        bits.push(`I'm parked right now, but ask me anything.`);
      } else if (etaMinutes !== null) {
        bits.push(`I'm about ${etaMinutes} min from you. Where can I take you?`);
      } else {
        bits.push(`Where can I take you?`);
      }

      let card: any = null;
      if (pickup && f.driver.isOnline && suggestions.length > 0) {
        card = {
          type: "places",
          places: suggestions.slice(0, 4).map((s: any) => ({
            address: s.address,
            lat: s.lat,
            lng: s.lng,
            label: s.label,
            icon: s.icon,
            reason: s.reason,
          })),
          mapOption: true,
        };
      }
      return res.json({ reply: bits.join(" "), card });
    }

    // ---- Explicit destination (rider tapped a place option) → targeted quote
    if (explicitDest) {
      if (!f.driver.isOnline) {
        return res.json({
          reply: `I'm parked right now, so I can't come get you — but the Travony assistant can find you another ride.`,
          card: null,
        });
      }
      if (!pickup) {
        return res.json({
          reply: `I need your pickup location for a quote — enable location access and try again.`,
          card: null,
        });
      }
      const card = await targetCard(explicitDest);
      const replyBits = [`Let's go.`];
      if (etaMinutes !== null) replyBits.push(`I can be at your pickup in about ${etaMinutes} min.`);
      replyBits.push(`Here's your ride — it comes straight to me first:`);
      return res.json({ reply: replyBits.join(" "), card });
    }

    // ---- Parse free text
    let parsed = carKeywordParse(text) as { intent: CarIntent; destination: string | null; reply?: string | null } | null;
    let llmReply: string | null = null;
    if (!parsed) {
      const llm = await carLlmParse(text, history, f);
      parsed = llm;
      llmReply = llm.reply;
    }

    switch (parsed.intent) {
      case "book_ride": {
        if (!f.driver.isOnline) {
          return res.json({
            reply: `I'm parked right now, so I can't take this one — try the Travony assistant for the nearest car.`,
            card: null,
          });
        }
        if (!pickup) {
          return res.json({
            reply: `I need your pickup location for a quote — enable location access and try again.`,
            card: null,
          });
        }
        if (!parsed.destination) {
          return res.json({
            reply: `Where to? Tell me a destination — for example "take me to the marina".`,
            card: null,
          });
        }
        const { resolved, options } = await resolveDestination(userId, parsed.destination, hour, dow, tzOffset);
        if (resolved) {
          const card = await targetCard(resolved);
          const replyBits: string[] = [];
          if (etaMinutes !== null) replyBits.push(`I can be at your pickup in about ${etaMinutes} min.`);
          replyBits.push(`Here's your ride — it comes straight to me first:`);
          return res.json({ reply: replyBits.join(" "), card });
        }
        if (options.length > 0) {
          return res.json({
            reply: `I found a few matching places — which one?`,
            card: { type: "places", places: options, mapOption: true },
          });
        }
        return res.json({
          reply: `I couldn't find "${parsed.destination}" in your saved places or trip history. Try a more specific name.`,
          card: null,
        });
      }

      case "about_car":
        return res.json({ reply: aboutCarReply(f), card: null });

      default: {
        // Small talk: guarded LLM voice, deterministic fallback.
        const reply =
          llmReply ||
          `Happy to chat! Ask me about my trips or rating, or tell me where you want to go.`;
        return res.json({ reply, card: null });
      }
    }
  } catch (error: any) {
    console.error("[carPersona] chat failed:", error);
    res.status(500).json({ message: "Failed to talk to the car" });
  }
});

export { router as carPersonaRouter };
