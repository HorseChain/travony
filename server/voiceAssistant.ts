/**
 * Voice-first assistant — talk to Travony, actions appear as live cards.
 *
 * Two surfaces share one loop: record → transcribe (STT) → the SAME
 * deterministic assistant executor the typed chat uses → deterministic spoken
 * summary → TTS. The LLM never authors numbers anywhere in this file: every
 * figure in the spoken reply is interpolated from engine-computed card values
 * into fixed templates, and non-English speech goes through the digit-guarded
 * translator (translation falls back to English if any digit drifts).
 *
 * Endpoints:
 *   POST /api/voice/turn          — in-app rider assistant (session auth)
 *   POST /api/ridelink/voice-turn — zero-install /ride web page (public,
 *                                   IP rate-limited; quotes are public there)
 *
 * Invariants preserved:
 * - The assistant NEVER creates or cancels rides server-side from a voice
 *   turn. A voice "yes" returns an `action` that the CLIENT executes against
 *   the existing authenticated endpoints — exactly like a card tap.
 * - Confirmation detection is deterministic (multilingual word lists), never
 *   an LLM judgment, so "yes" cannot be hallucinated into a booking.
 */
import { Router } from "express";
import { Router as RouterType } from "express";
import {
  getSessionUser,
  runAssistantTurn,
  findActiveRide,
  type Point,
  type HistoryEntry,
} from "./assistantRoutes";
import {
  ensureCompatibleFormat,
  speechToText,
  textToSpeech,
  openai as audioOpenAI,
} from "./replit_integrations/audio/client";
import { translateKeepingDigits } from "./whatsappRiderBot";
import * as brain from "./bookingBrain";

export const voiceRouter: RouterType = Router();

// ---------------------------------------------------------------------------
// Deterministic multilingual confirmation / negation / cancel word lists.
// Matching is exact-or-prefix on a normalized short utterance — long free
// text is never treated as a confirmation.
// ---------------------------------------------------------------------------
const YES_WORDS = [
  // English
  "yes", "yeah", "yep", "yup", "sure", "ok", "okay", "confirm", "book it",
  "book", "go ahead", "do it", "please do", "correct", "sounds good", "lets go",
  "let's go", "yes please", "confirm it", "confirm ride", "book the ride",
  // Arabic
  "نعم", "ايوه", "أيوه", "اي", "أجل", "اجل", "تمام", "موافق", "اوكي", "أوكي", "احجز", "إحجز", "يلا",
  // Hindi / Urdu
  "haan", "han", "ji", "ji haan", "theek hai", "thik hai", "book karo", "ہاں", "جی", "ٹھیک ہے", "हाँ", "हां", "जी", "ठीक है", "बुक करो",
  // Spanish / French / Portuguese
  "si", "sí", "claro", "vale", "dale", "oui", "d'accord", "sim",
  // Russian
  "да", "давай", "хорошо", "подтверждаю",
  // Tagalog / Indonesian / Malay
  "oo", "sige", "ya", "iya", "boleh", "baik",
  // Bengali / Farsi / Turkish / Swahili / Chinese
  "হ্যাঁ", "بله", "آره", "evet", "tamam", "ndiyo", "sawa", "好", "好的", "是", "确认",
];

const NO_WORDS = [
  "no", "nope", "nah", "not now", "cancel that", "dont", "don't", "skip", "stop",
  "لا", "كلا", "مش الحين",
  "nahi", "nahin", "نہیں", "नहीं",
  "non", "нет", "не надо",
  "hindi", "tidak", "tak",
  "না", "نه", "خیر", "hayır", "hapana", "不", "不要", "不用",
];

const CANCEL_RIDE_PATTERNS = [
  /\bcancel\b.*\b(ride|trip|booking|car)\b/i,
  /\b(ride|trip|booking)\b.*\bcancel\b/i,
  /الغ(ي|اء).*(رحلة|مشوار)/,
  /(رحلة|مشوار).*(الغ|إلغاء)/,
  /راید.*کینسل|کینسل.*راید/,
  /свободен.*отмен|отмени.*поездку/i,
  /ride cancel karo|cancel karo/i,
];

function normalizeUtterance(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?؟،。！？"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** True only for short, unambiguous confirmations. */
export function isAffirmative(text: string): boolean {
  const t = normalizeUtterance(text);
  if (!t || t.length > 40) return false;
  if (NO_WORDS.some((w) => t === w || t.startsWith(w + " "))) return false;
  return YES_WORDS.some((w) => t === w || t.startsWith(w + " ") || t.endsWith(" " + w));
}

export function isNegative(text: string): boolean {
  const t = normalizeUtterance(text);
  if (!t || t.length > 40) return false;
  return NO_WORDS.some((w) => t === w || t.startsWith(w + " "));
}

function wantsCancelRide(text: string): boolean {
  return CANCEL_RIDE_PATTERNS.some((p) => p.test(text));
}

function spokenPaymentMethod(text: string): "cash" | "wallet" {
  const t = normalizeUtterance(text);
  if (/\bwallet\b|محفظة|بالمحفظة|wallet se|кошел/i.test(t)) return "wallet";
  return "cash";
}

// ---------------------------------------------------------------------------
// Deterministic spoken summaries. Every number below is an engine value
// interpolated into a fixed template — the LLM never composes these.
// ---------------------------------------------------------------------------
function speechFactsForCard(card: any): string {
  if (!card || typeof card !== "object") return "";
  switch (card.type) {
    case "booking": {
      const fare = Number(card.fare);
      const currency = String(card.currency || "").slice(0, 5);
      const mins = Number(card.durationMin);
      const km = Number(card.distanceKm);
      if (!Number.isFinite(fare)) return "";
      let s = `The fare is ${fare.toFixed(2)} ${currency}`;
      if (Number.isFinite(km) && Number.isFinite(mins)) {
        s += `, about ${Math.round(mins)} minutes for ${km} kilometers`;
      }
      s += ". Say yes to book it, or no to skip.";
      return s;
    }
    case "wallet": {
      const bal = Number(card.balance);
      const currency = String(card.currency || "").slice(0, 5);
      if (!Number.isFinite(bal)) return "";
      return `Your wallet balance is ${bal.toFixed(2)} ${currency}.`;
    }
    case "places": {
      const places = Array.isArray(card.places) ? card.places : [];
      if (places.length === 0) return "";
      const first = String(places[0]?.label || places[0]?.address || "").split(",")[0];
      if (places.length === 1) return `I found ${first} — tap it for a quote.`;
      return `The closest match is ${first} — tap a place on screen, or say its full name.`;
    }
    default:
      return "";
  }
}

async function speakInRiderLanguage(englishSpeech: string, languageSample: string): Promise<string> {
  const speech = englishSpeech.trim().slice(0, 600);
  if (!speech) return "";
  return translateKeepingDigits(speech, languageSample);
}

async function synthesize(speech: string): Promise<string | null> {
  if (!speech) return null;
  try {
    const buf = await textToSpeech(speech, "alloy", "mp3");
    if (!buf || buf.length === 0) return null;
    return buf.toString("base64");
  } catch (err) {
    console.error("[voice] TTS failed (reply stays text-only):", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Audio intake: base64 → compatible buffer → transcript.
// ---------------------------------------------------------------------------
const MAX_AUDIO_BYTES = 6 * 1024 * 1024; // ~6MB decoded; far above a 60s clip
// Reject oversize payloads on the base64 STRING, before allocating the buffer.
const MAX_AUDIO_B64_CHARS = Math.ceil((MAX_AUDIO_BYTES * 4) / 3) + 16;

async function transcribeBase64(audioB64: string): Promise<{ transcript: string; sttMs: number }> {
  const t0 = Date.now();
  if (audioB64.length > MAX_AUDIO_B64_CHARS) throw Object.assign(new Error("Audio too large"), { status: 413 });
  const raw = Buffer.from(audioB64, "base64");
  if (raw.length < 200) return { transcript: "", sttMs: Date.now() - t0 };
  if (raw.length > MAX_AUDIO_BYTES) throw Object.assign(new Error("Audio too large"), { status: 413 });
  const { buffer, format } = await ensureCompatibleFormat(raw);
  const text = await speechToText(buffer, format);
  return { transcript: (text || "").trim().slice(0, 500), sttMs: Date.now() - t0 };
}

const DIDNT_CATCH =
  "Sorry, I didn't catch that — try again a little closer to the microphone.";

/**
 * STT appends sentence punctuation ("Take me to Dubai Mall.") that typed
 * users never send, and it breaks exact-ish place lookups. Strip terminal
 * punctuation for the executor; keep the raw transcript for display and as
 * the language sample.
 */
function toTurnText(transcript: string): string {
  return transcript.replace(/[.!?؟।。…]+$/g, "").trim();
}

// ---------------------------------------------------------------------------
// POST /api/voice/turn — the in-app rider assistant voice loop.
// ---------------------------------------------------------------------------
voiceRouter.post("/api/voice/turn", async (req: any, res) => {
  const tStart = Date.now();
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Authentication required" });
    const userId = session.userId;
    if (!allowVoiceUser(userId)) {
      return res.status(429).json({ message: "Too many voice requests — give it a moment." });
    }

    const audioB64 = typeof req.body.audio === "string" ? req.body.audio : "";
    if (!audioB64) return res.status(400).json({ message: "audio (base64) is required" });
    const wantAudio = req.body.wantAudio !== false; // Lite Mode sends false

    const rawHistory: any[] = Array.isArray(req.body.history) ? req.body.history : [];
    const history: HistoryEntry[] = rawHistory
      .filter((h) => (h.role === "user" || h.role === "assistant") && typeof h.text === "string" && h.text.trim())
      .slice(-10)
      .map((h) => ({ role: h.role as "user" | "assistant", text: h.text.trim().slice(0, 400) }));

    const pickup: Point | null =
      req.body.pickup &&
      Number.isFinite(parseFloat(req.body.pickup.lat)) &&
      Number.isFinite(parseFloat(req.body.pickup.lng))
        ? {
            address: String(req.body.pickup.address || "Current Location").slice(0, 300),
            lat: parseFloat(req.body.pickup.lat),
            lng: parseFloat(req.body.pickup.lng),
          }
        : null;

    // Client echoes back the pending state the server last gave it. It only
    // shapes CONFIRMATION routing — never amounts, payloads, or ride IDs used
    // for execution (the client executes its own stored card payload).
    const pendingRaw = req.body.pending;
    const pending: { type: string; rideId?: string } | null =
      pendingRaw && typeof pendingRaw === "object" && typeof pendingRaw.type === "string"
        ? { type: pendingRaw.type.slice(0, 30), rideId: typeof pendingRaw.rideId === "string" ? pendingRaw.rideId.slice(0, 60) : undefined }
        : null;

    let transcript = "";
    let sttMs = 0;
    try {
      ({ transcript, sttMs } = await transcribeBase64(audioB64));
    } catch (err: any) {
      if (err?.status === 413) return res.status(413).json({ message: "Audio too large" });
      throw err;
    }

    const finish = async (payload: {
      reply: string;
      card?: any;
      intent?: string;
      action?: any;
      pending?: any;
      facts?: string;
    }) => {
      const turnMsMark = Date.now();
      const englishSpeech = `${payload.reply} ${payload.facts || ""}`.trim();
      const speech = await speakInRiderLanguage(englishSpeech, transcript || "");
      const tTts = Date.now();
      const audio = wantAudio ? await synthesize(speech) : null;
      const timings = {
        sttMs,
        turnMs: turnMsMark - tStart - sttMs,
        ttsMs: Date.now() - tTts,
        totalMs: Date.now() - tStart,
      };
      console.log(
        `[voice] turn user=${userId.slice(0, 8)} stt=${timings.sttMs}ms turn=${timings.turnMs}ms tts=${timings.ttsMs}ms total=${timings.totalMs}ms intent=${payload.intent || "-"} action=${payload.action?.type || "-"}`
      );
      res.json({
        transcript,
        reply: payload.reply,
        speech,
        card: payload.card ?? null,
        intent: payload.intent ?? null,
        action: payload.action ?? null,
        pending: payload.pending ?? null,
        audio,
        audioMime: audio ? "audio/mpeg" : null,
        timings,
      });
    };

    if (!transcript) {
      return finish({ reply: DIDNT_CATCH });
    }

    // ---- 1) Pending confirmations (deterministic word lists only) ----
    if (pending?.type === "booking") {
      if (isAffirmative(transcript)) {
        return finish({
          reply: "Booking your ride now — watch the card for your driver.",
          action: { type: "confirm_booking", paymentMethod: spokenPaymentMethod(transcript) },
        });
      }
      if (isNegative(transcript)) {
        return finish({
          reply: "No problem — nothing was booked. Just ask when you're ready.",
          action: { type: "decline_booking" },
        });
      }
      // Anything else falls through to a normal turn (e.g. a new destination).
    }

    if (pending?.type === "cancel_ride" && pending.rideId) {
      if (isAffirmative(transcript)) {
        // Verify against the user's REAL active ride — never trust the echo.
        const active = await findActiveRide(userId);
        if (active && active.id === pending.rideId) {
          return finish({
            reply: "Cancelling your ride now.",
            action: { type: "cancel_ride", rideId: active.id },
          });
        }
        return finish({ reply: "That ride is no longer active, so there's nothing to cancel." });
      }
      if (isNegative(transcript)) {
        return finish({ reply: "Okay — your ride continues as planned." });
      }
    }

    // ---- 2) Voice cancel request → always confirmed in a second step ----
    if (wantsCancelRide(transcript)) {
      const active = await findActiveRide(userId);
      if (active) {
        return finish({
          reply: "You want to cancel your current ride — say yes to confirm, or no to keep it.",
          card: { type: "live_ride", rideId: active.id, status: active.status },
          pending: { type: "cancel_ride", rideId: active.id },
        });
      }
      return finish({ reply: "You don't have a ride in progress right now. Want to book one?" });
    }

    // ---- 3) Normal turn through the shared deterministic executor ----
    const parseIntParam = (v: any): number | undefined => {
      const n = parseInt(String(v), 10);
      return Number.isFinite(n) ? n : undefined;
    };
    const result = await runAssistantTurn(userId, {
      text: toTurnText(transcript),
      pickup,
      history,
      hour: parseIntParam(req.body.hour),
      dow: parseIntParam(req.body.dow),
      tzOffset: parseIntParam(req.body.tzOffset),
    });

    return finish({
      reply: result.reply,
      card: result.card,
      intent: result.intent,
      facts: speechFactsForCard(result.card),
      pending: result.card?.type === "booking" ? { type: "booking" } : null,
    });
  } catch (error: any) {
    console.error("[voice] turn failed:", error);
    res.status(500).json({ message: error.message || "Voice assistant failed" });
  }
});

// ---------------------------------------------------------------------------
// Zero-install /ride page: voice loop over the SAME booking-brain services the
// page already uses. Public like /api/ridelink/quote, but rate-limited harder
// because STT/TTS cost real money.
// ---------------------------------------------------------------------------
// Fixed 60s windows, keyed on proxy-validated req.ip — never the spoofable
// x-forwarded-for header. The map is HARD-bounded: expired keys are swept,
// and when the cap is still exceeded a new key is rejected outright (fail
// closed) rather than allocated — rotating IPs cannot grow it without bound.
const voiceHits = new Map<string, { count: number; windowStart: number }>();
const VOICE_HITS_MAX = 2000;
function sweepVoiceHits(now: number) {
  for (const [k, v] of voiceHits) {
    if (now - v.windowStart > 60_000) voiceHits.delete(k);
  }
}
function bumpWindow(key: string, limit: number): boolean {
  const now = Date.now();
  const rec = voiceHits.get(key);
  if (!rec || now - rec.windowStart > 60_000) {
    if (!rec && voiceHits.size >= VOICE_HITS_MAX) {
      sweepVoiceHits(now);
      if (voiceHits.size >= VOICE_HITS_MAX) return false; // cap reached: reject new keys
    }
    voiceHits.set(key, { count: 1, windowStart: now });
    return true;
  }
  rec.count++;
  return rec.count <= limit;
}
/** True when the window for `key` is already at/over `limit` — never allocates. */
function windowExhausted(key: string, limit: number): boolean {
  const rec = voiceHits.get(key);
  return !!rec && Date.now() - rec.windowStart <= 60_000 && rec.count >= limit;
}
// Per-IP for the public page, per-user for the app, plus a GLOBAL cap on the
// public endpoint so rotating IPs cannot amplify STT/TTS spend. The global
// window is PEEKED before any per-IP state is allocated (so exhaustion stops
// map growth) but only INCREMENTED for requests that pass the per-IP check
// (so one flooding IP cannot burn the global budget for everyone).
const GLOBAL_KEY = "global:ridelink";
const GLOBAL_LIMIT = 120;
const allowVoiceIp = (ip: string) => bumpWindow(`ip:${ip}`, 10);
const allowVoiceUser = (userId: string) => bumpWindow(`user:${userId}`, 20);
const voiceGlobalExhausted = () => windowExhausted(GLOBAL_KEY, GLOBAL_LIMIT);
const bumpVoiceGlobal = () => bumpWindow(GLOBAL_KEY, GLOBAL_LIMIT);

/** Deterministic route extraction first; LLM only extracts PHRASES (no numbers). */
async function parseRoutePhrases(
  text: string
): Promise<{ pickupPhrase: string | null; destPhrase: string | null }> {
  const t = text.trim();
  // "from X to Y"
  let m = t.match(/\bfrom\s+(.{2,80}?)\s+to\s+(.{2,80})$/i);
  if (m) return { pickupPhrase: m[1].trim(), destPhrase: m[2].trim() };
  // "take me to Y" / "to Y"
  m = t.match(/(?:take me to|ride to|go to|bring me to|drive me to|i want to go to|book (?:a )?ride to|to)\s+(.{2,80})$/i);
  if (m) return { pickupPhrase: null, destPhrase: m[1].trim() };

  // LLM fallback — phrase extraction only, never numbers.
  try {
    const resp = await audioOpenAI.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'The user (any language) is telling a taxi service where they want to go. Extract the place NAMES only. Respond ONLY as JSON: {"pickup": string|null, "destination": string|null}. Use null when a part is not mentioned. Never include prices or numbers that are not part of a place name.',
        },
        { role: "user", content: t.slice(0, 300) },
      ],
    });
    const parsed = JSON.parse(resp.choices[0]?.message?.content || "{}");
    return {
      pickupPhrase:
        typeof parsed.pickup === "string" && parsed.pickup.trim() ? parsed.pickup.trim().slice(0, 120) : null,
      destPhrase:
        typeof parsed.destination === "string" && parsed.destination.trim()
          ? parsed.destination.trim().slice(0, 120)
          : null,
    };
  } catch {
    return { pickupPhrase: null, destPhrase: null };
  }
}

function shortAddr(address: string): string {
  return String(address || "").split(",")[0].trim().slice(0, 60);
}

function parseLinkPoint(raw: any): brain.Place | null {
  if (!raw || typeof raw !== "object") return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const address =
    typeof raw.address === "string" && raw.address.trim()
      ? raw.address.trim().slice(0, 300)
      : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return { lat, lng, address };
}

voiceRouter.post("/api/ridelink/voice-turn", async (req: any, res) => {
  const tStart = Date.now();
  // req.ip is proxy-validated via `app.set("trust proxy", 1)` in server/index.ts.
  const ip = req.ip || req.socket?.remoteAddress || "?";
  if (voiceGlobalExhausted()) {
    return res.status(429).json({ message: "Voice is busy right now — please try again shortly." });
  }
  if (!allowVoiceIp(ip)) return res.status(429).json({ message: "Too many voice requests — slow down." });
  if (!bumpVoiceGlobal()) {
    return res.status(429).json({ message: "Voice is busy right now — please try again shortly." });
  }
  try {
    const audioB64 = typeof req.body.audio === "string" ? req.body.audio : "";
    if (!audioB64) return res.status(400).json({ message: "audio (base64) is required" });

    const pagePickup = parseLinkPoint(req.body.pickup);
    const pageDest = parseLinkPoint(req.body.dest);
    const pending = typeof req.body.pending === "string" ? req.body.pending.slice(0, 20) : null;

    let transcript = "";
    let sttMs = 0;
    try {
      ({ transcript, sttMs } = await transcribeBase64(audioB64));
    } catch (err: any) {
      if (err?.status === 413) return res.status(413).json({ message: "Audio too large" });
      throw err;
    }

    const finish = async (payload: { speech: string; effect?: any }) => {
      const speech = await speakInRiderLanguage(payload.speech, transcript || "");
      const audio = await synthesize(speech);
      console.log(
        `[voice] link-turn ip=${ip} stt=${sttMs}ms total=${Date.now() - tStart}ms effect=${payload.effect?.type || "-"}`
      );
      res.json({
        transcript,
        speech,
        effect: payload.effect ?? null,
        audio,
        audioMime: audio ? "audio/mpeg" : null,
      });
    };

    if (!transcript) return finish({ speech: DIDNT_CATCH });

    // Confirmations against the page's visible state.
    if (pending === "quote") {
      if (isAffirmative(transcript)) {
        return finish({ speech: "Booking your ride now.", effect: { type: "book" } });
      }
      if (isNegative(transcript)) {
        return finish({
          speech: "No problem — tell me a different destination whenever you're ready.",
          effect: { type: "back" },
        });
      }
    }
    if (pending === "tracking" && (wantsCancelRide(transcript) || /\bcancel\b/i.test(transcript))) {
      return finish({ speech: "Okay — confirm the cancellation on screen.", effect: { type: "cancel" } });
    }

    // Route extraction → real places → engine quote.
    const { pickupPhrase, destPhrase } = await parseRoutePhrases(toTurnText(transcript));

    let pickup = pagePickup;
    if (pickupPhrase) {
      const found = await brain.searchPlaces(pickupPhrase, pagePickup || undefined, 1);
      if (found[0]) pickup = found[0];
    }
    let dest = pageDest;
    if (destPhrase) {
      const found = await brain.searchPlaces(destPhrase, pickup || pagePickup || undefined, 1);
      if (found[0]) dest = found[0];
    }

    if (destPhrase && !dest) {
      // destPhrase can come from the LLM extractor. Only speak it if every
      // digit in it also appears in the user's own transcript — otherwise an
      // LLM-authored number could reach TTS.
      const phraseDigits = destPhrase.match(/\d+/g) || [];
      const safePhrase = phraseDigits.every((d) => transcript.includes(d))
        ? destPhrase.slice(0, 60)
        : "that place";
      return finish({
        speech: `I couldn't find a place called ${safePhrase}. Try the full name, or type it in the destination box.`,
      });
    }

    if (dest && pickup) {
      const quote = await brain.getQuote(pickup, dest);
      if (quote.estimates.length === 0) {
        return finish({ speech: "I couldn't price that route right now — please try again in a moment." });
      }
      const est = quote.estimates[0];
      // Engine numbers in a fixed template — never LLM-composed.
      const speech = `${shortAddr(pickup.address)} to ${shortAddr(dest.address)}: ${est.label} is ${quote.currency} ${est.fare.toFixed(2)}, about ${Math.round(quote.durationMin)} minutes. Say yes to book it.`;
      return finish({ speech, effect: { type: "route", pickup, dest, quote } });
    }

    if (dest && !pickup) {
      return finish({
        speech: "Got your destination. Where should we pick you up? Tap My location, or say your pickup place.",
        effect: { type: "route", dest },
      });
    }

    return finish({
      speech: "Tell me where you're going — for example, take me to the airport.",
    });
  } catch (error: any) {
    console.error("[voice] link turn failed:", error);
    res.status(500).json({ message: error.message || "Voice failed" });
  }
});
