/**
 * WhatsApp rider bot — book a Travony ride entirely inside WhatsApp.
 * The phone number IS the account (auto-provisioned via the booking brain).
 *
 * Channel adapter only: all money math, matching and ride creation live in
 * bookingBrain. Replies are template-built with engine numbers — the LLM is
 * used ONLY to translate templated text (with a digit-integrity guard) and
 * never authors a number itself.
 *
 * Also handles voice notes: incoming audio is transcribed and processed as
 * text, and the reply is ALSO sent back as a voice note in the same language.
 */
import { db } from "./db";
import { telegramBookingSessions } from "@shared/schema";
import { eq } from "drizzle-orm";
import * as brain from "./bookingBrain";
import { sendWhatsAppMessage, sendWhatsAppMedia } from "./whatsappBot";
import { getTravonyBaseUrl } from "./telegramStreaming";
import {
  buildTvCardText,
  getFeaturedCarIntro,
  getLatestApprovedClips,
  getSafetyReportText,
} from "./channelFeatures";
import { randomUUID } from "crypto";

// ---------------------------------------------------------------------------
// Session state — persisted in telegramBookingSessions with a "wa:" key so
// bookings survive restarts. Everything here must stay JSON-serializable.
// ---------------------------------------------------------------------------
interface WaSession {
  userId?: string;
  name?: string;
  step?: "awaiting_pickup" | "awaiting_dest" | "awaiting_dest_pick" | "awaiting_car" | "awaiting_confirm";
  pendingDestQuery?: string;
  pickup?: brain.Place;
  destination?: brain.Place;
  destCandidates?: brain.Place[];
  quote?: brain.RideQuote;
  chosen?: brain.FareEstimate;
  /** Last user text sample, used as the language reference for translation. */
  langSample?: string;
  /** Most recent ride that reached "completed" — used by the SAFETY keyword. */
  lastCompletedRideId?: string;
  updatedAtMs?: number;
}

const waSessions = new Map<string, WaSession>();
let sessionsLoaded = false;

function waKey(phone: string): string {
  return `wa:${phone}`;
}

async function loadWaSessions(): Promise<void> {
  if (sessionsLoaded) return;
  sessionsLoaded = true;
  try {
    const rows = await db.select().from(telegramBookingSessions);
    for (const row of rows) {
      if (!row.chatId.startsWith("wa:")) continue;
      try {
        waSessions.set(row.chatId.slice(3), JSON.parse(row.data));
      } catch {}
    }
  } catch (error) {
    console.error("[WaRider] session load error:", error);
  }
}

/**
 * True when this phone is mid-booking (an active step is set). Used by the
 * webhook router so driver-onboarding detection never hijacks a booking
 * answer ("I want to drive to the airport" while awaiting a destination).
 */
export async function hasActiveWaBookingStep(phone: string): Promise<boolean> {
  await loadWaSessions();
  return !!waSessions.get(phone)?.step;
}

async function persistWaSession(phone: string): Promise<void> {
  const key = waKey(phone);
  try {
    const session = waSessions.get(phone);
    if (session && (session.step || session.userId)) {
      await db
        .insert(telegramBookingSessions)
        .values({ chatId: key, data: JSON.stringify(session), updatedAt: new Date() })
        .onConflictDoUpdate({
          target: telegramBookingSessions.chatId,
          set: { data: JSON.stringify(session), updatedAt: new Date() },
        });
    } else {
      await db.delete(telegramBookingSessions).where(eq(telegramBookingSessions.chatId, key));
    }
  } catch (error) {
    console.error("[WaRider] persistSession error:", error);
  }
}

function getWaSession(phone: string): WaSession {
  let s = waSessions.get(phone);
  if (!s) {
    s = {};
    waSessions.set(phone, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Voice notes: ephemeral clip store served by /api/ridelink/voice/:id so
// Twilio can fetch the TTS reply as a MediaUrl. 10-minute TTL.
// ---------------------------------------------------------------------------
const voiceClips = new Map<string, { buffer: Buffer; contentType: string; expires: number }>();

export function getVoiceClip(id: string): { buffer: Buffer; contentType: string } | null {
  const clip = voiceClips.get(id);
  if (!clip) return null;
  if (Date.now() > clip.expires) {
    voiceClips.delete(id);
    return null;
  }
  return { buffer: clip.buffer, contentType: clip.contentType };
}

function storeVoiceClip(buffer: Buffer): string {
  // Opportunistic sweep so the map can't grow unbounded.
  const now = Date.now();
  for (const [k, v] of Array.from(voiceClips.entries())) {
    if (now > v.expires) voiceClips.delete(k);
  }
  const id = randomUUID().replace(/-/g, "");
  voiceClips.set(id, { buffer, contentType: "audio/mpeg", expires: now + 10 * 60_000 });
  return id;
}

// ---------------------------------------------------------------------------
// Same-language replies. Deterministic English templates are translated by
// the LLM into the rider's language, guarded so every digit survives intact.
// If the guard trips (or the text is already English) we send the original.
// The LLM NEVER composes content — translation of a finished template only.
// ---------------------------------------------------------------------------
function digitMultiset(text: string): string {
  return (text.match(/[0-9]/g) || []).sort().join("");
}

export async function translateKeepingDigits(reply: string, languageSample: string): Promise<string> {
  if (!languageSample || /^[\x00-\x7F\s]*$/.test(languageSample)) {
    // Pure-ASCII sample: quick LLM check is still useful (Spanish etc. is
    // ASCII), but skip when the sample looks English to save a call.
    if (/^(?:[a-z0-9\s.,!?'"+\-:;()\/&@#%*]|$)+$/i.test(languageSample) &&
        /\b(the|to|from|ride|how|much|price|book|cancel|status|where|my|a|is)\b/i.test(languageSample)) {
      return reply;
    }
  }
  try {
    const { openai } = await import("./replit_integrations/audio/client");
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You translate text. Detect the language of the SAMPLE message. If it is English, output the REPLY unchanged. Otherwise translate the REPLY into that language. Keep every digit, number, currency code, URL and code EXACTLY as-is. Output only the translated reply, nothing else.",
        },
        { role: "user", content: `SAMPLE:\n${languageSample.slice(0, 300)}\n\nREPLY:\n${reply}` },
      ],
    });
    const translated = res.choices[0]?.message?.content?.trim();
    if (!translated) return reply;
    // Digit-integrity guard: the translation must contain exactly the same
    // digits as the template. Any drift → fall back to English.
    if (digitMultiset(translated) !== digitMultiset(reply)) return reply;
    return translated;
  } catch {
    return reply;
  }
}

// ---------------------------------------------------------------------------
// Reply plumbing: text always; voice note additionally when the rider sent one.
// ---------------------------------------------------------------------------
interface ReplyCtx {
  phone: string;
  voiceReply: boolean;
  langSample: string;
}

async function reply(ctx: ReplyCtx, englishText: string): Promise<void> {
  const text = await translateKeepingDigits(englishText, ctx.langSample);
  if (ctx.voiceReply) {
    try {
      const { textToSpeech } = await import("./replit_integrations/audio/client");
      // Strip URLs for the spoken version — nobody wants a URL read aloud.
      const spoken = text.replace(/https?:\/\/\S+/g, "").replace(/\n{2,}/g, ". ").replace(/\n/g, ". ").trim();
      if (spoken.length > 2) {
        const mp3 = await textToSpeech(spoken.slice(0, 900), "alloy", "mp3");
        if (mp3 && mp3.length > 1000) {
          const id = storeVoiceClip(mp3);
          const mediaUrl = `${getTravonyBaseUrl()}/api/ridelink/voice/${id}`;
          const ok = await sendWhatsAppMedia(ctx.phone, text, mediaUrl);
          if (ok) return;
        }
      }
    } catch (error) {
      console.error("[WaRider] voice reply error:", error);
    }
  }
  await sendWhatsAppMessage(ctx.phone, text);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const HELP_TEXT = `Travony — book a ride right here. Try:
- "How much from Dubai Mall to the airport" — instant price, free
- "Book a ride to Dubai Mall" — we'll find your driver
- "Status" — where's my ride
- "Cancel" — cancel my ride
- "TV" — watch the city's best live rides
- "CAR" — meet a Travony car and chat
- "CLIPS" — today's ride highlights
- "SAFETY" — the safety report for your last ride
You can also send your location pin to set your pickup, or send a voice note.
Prefer buttons? Book in your browser: {BOOK_URL} (no install).`;

function bookPageUrl(): string {
  return `${getTravonyBaseUrl()}/ride`;
}

function priceLinkFor(pickup: brain.Place, dropoff: brain.Place): string {
  const enc = (p: brain.Place) => `${p.lat.toFixed(6)},${p.lng.toFixed(6)},${encodeURIComponent(p.address)}`;
  return `${getTravonyBaseUrl()}/ride?pa=${enc(pickup)}&pb=${enc(dropoff)}`;
}

async function ensureWaUser(session: WaSession, phone: string, profileName?: string): Promise<string> {
  if (session.userId) return session.userId;
  const user = await brain.ensureUserByPhone(phone, profileName, "whatsapp");
  session.userId = user.id;
  session.name = user.name;
  return user.id;
}

function numberedList(places: brain.Place[]): string {
  return places.map((p, i) => `${i + 1}. ${p.address}`).join("\n");
}

// ---------------------------------------------------------------------------
// Flow steps
// ---------------------------------------------------------------------------
async function askDestination(ctx: ReplyCtx, session: WaSession): Promise<void> {
  session.step = "awaiting_dest";
  await reply(ctx, `Pickup set: ${session.pickup!.address}\nWhere are you going? Type the destination.`);
}

async function resolveDestination(ctx: ReplyCtx, session: WaSession, query: string): Promise<void> {
  const candidates = await brain.searchPlaces(query, session.pickup || undefined, 5);
  if (candidates.length === 0) {
    session.step = "awaiting_dest";
    await reply(ctx, `We couldn't find "${query}" on the map. Try a landmark or a fuller address.`);
    return;
  }
  if (candidates.length === 1) {
    session.destination = candidates[0];
    await showCars(ctx, session);
    return;
  }
  session.destCandidates = candidates;
  session.step = "awaiting_dest_pick";
  await reply(ctx, `Which one? Reply with the number:\n${numberedList(candidates)}\n0. None of these — retype`);
}

async function showCars(ctx: ReplyCtx, session: WaSession): Promise<void> {
  if (!session.pickup || !session.destination) return;
  const quote = await brain.getQuote(session.pickup, session.destination);
  if (quote.estimates.length === 0) {
    session.step = undefined;
    await reply(ctx, "We couldn't price that route right now. Please try again in a minute.");
    return;
  }
  session.quote = quote;
  session.step = "awaiting_car";
  const lines = quote.estimates
    .map((e, i) => `${i + 1}. ${e.label} — ${quote.currency} ${e.fare.toFixed(2)}`)
    .join("\n");
  await reply(
    ctx,
    `${session.pickup.address} → ${session.destination.address} (~${quote.distanceKm.toFixed(1)} km)\nPick your car — reply with the number:\n${lines}`,
  );
  await trackQuoteForNudge(ctx, session);
}

/** Abandoned-quote nudge tracking: one follow-up max, opt-out respected. */
async function trackQuoteForNudge(ctx: ReplyCtx, session: WaSession): Promise<void> {
  try {
    if (!session.pickup || !session.destination || !session.quote) return;
    const { trackRiderQuote } = await import("./onboardingAgent");
    const cheapest = session.quote.estimates[0];
    await trackRiderQuote("whatsapp", ctx.phone, {
      from: session.pickup.address,
      to: session.destination.address,
      fareText: cheapest ? `${session.quote.currency} ${cheapest.fare.toFixed(2)}` : undefined,
      langSample: session.langSample,
    });
  } catch (e) {
    console.error("[WaRider] quote tracking error:", e);
  }
}

async function showConfirm(ctx: ReplyCtx, session: WaSession): Promise<void> {
  if (!session.chosen || !session.quote) return;
  session.step = "awaiting_confirm";
  await reply(
    ctx,
    `Confirm your ride:\nFrom: ${session.pickup!.address}\nTo: ${session.destination!.address}\nCar: ${session.chosen.label}\nFare: ${session.quote.currency} ${session.chosen.fare.toFixed(2)} — cash to driver\n\nReply YES to book, NO to cancel.`,
  );
}

async function createWaRide(ctx: ReplyCtx, session: WaSession, profileName?: string): Promise<void> {
  const userId = await ensureWaUser(session, ctx.phone, profileName);
  try {
    const result = await brain.createBrainRide({
      userId,
      pickup: session.pickup!,
      dropoff: session.destination!,
      choice: session.chosen!,
      quote: session.quote!,
      paymentMethod: "cash",
      withShareToken: true,
      channel: "whatsapp",
    });
    const { ride, matchedEtaMin, driverInfo } = result;
    session.step = undefined;
    session.destCandidates = undefined;
    session.quote = undefined;
    session.chosen = undefined;
    session.pendingDestQuery = undefined;
    // Quote converted into a booking — cancel the abandoned-quote nudge.
    import("./onboardingAgent")
      .then(({ resolveRiderQuote }) => resolveRiderQuote("whatsapp", ctx.phone))
      .catch(() => {});
    const trackUrl = `${getTravonyBaseUrl()}/track/${ride.shareToken}`;
    const driverPart = driverInfo
      ? `Driver: ${driverInfo.name}\nCar: ${driverInfo.carDesc}${driverInfo.plate ? `\nPlate: ${driverInfo.plate}` : ""}${matchedEtaMin ? `\nETA: about ${matchedEtaMin} min` : ""}`
      : "We're finding your driver — you'll get a message here the moment one accepts.";
    await reply(
      ctx,
      `Ride booked!\n${driverPart}\n\nPickup code: ${ride.otp} — show it when you board.\nTrack live: ${trackUrl}\n\nReply STATUS any time, or CANCEL to cancel.`,
    );
  } catch (error: any) {
    if (error instanceof brain.EngagedRideError) {
      session.step = undefined;
      await reply(ctx, `You already have an active trip. Reply STATUS to see it, or CANCEL first.`);
      return;
    }
    console.error("[WaRider] create ride error:", error);
    session.step = undefined;
    await reply(ctx, "We couldn't book that ride right now. Please try again.");
  }
}

// ---------------------------------------------------------------------------
// Intent handlers
// ---------------------------------------------------------------------------
async function handlePrice(ctx: ReplyCtx, session: WaSession, from: string | undefined, to: string): Promise<void> {
  let pickup: brain.Place | null = null;
  if (from) {
    const hits = await brain.searchPlaces(from, session.pickup || undefined, 1);
    pickup = hits[0] || null;
    if (!pickup) {
      await reply(ctx, `We couldn't find "${from}" on the map. Try a landmark or a fuller address.`);
      return;
    }
  } else if (session.pickup) {
    pickup = session.pickup;
  } else {
    await reply(ctx, `Where from? Ask like: "How much from Dubai Mall to ${to}" — or share your location pin first.`);
    return;
  }
  const destHits = await brain.searchPlaces(to, pickup, 1);
  if (!destHits[0]) {
    await reply(ctx, `We couldn't find "${to}" on the map. Try a landmark or a fuller address.`);
    return;
  }
  const quote = await brain.getQuote(pickup, destHits[0]);
  if (quote.estimates.length === 0) {
    await reply(ctx, "We couldn't price that route right now. Please try again in a minute.");
    return;
  }
  const card = brain.buildPriceCardText(quote, pickup.address, destHits[0].address, priceLinkFor(pickup, destHits[0]));
  await reply(ctx, `${card}\n\nReply BOOK to book the cheapest option now.`);
  // Seed the session so a follow-up "book" books this exact route.
  session.pickup = pickup;
  session.destination = destHits[0];
  session.quote = quote;
  session.chosen = quote.estimates[0];
  session.step = undefined;
  await trackQuoteForNudge(ctx, session);
}

async function handleStatus(ctx: ReplyCtx, session: WaSession): Promise<void> {
  const user = session.userId
    ? { id: session.userId }
    : await brain.findUserByPhone(ctx.phone);
  if (!user) {
    await reply(ctx, `No rides yet from this number. Say "book a ride to ..." to get started.`);
    return;
  }
  session.userId = user.id;
  const ride = await brain.getActiveRideForUser(user.id);
  if (!ride) {
    await reply(ctx, `No active ride right now. Say "book a ride to ..." when you need one.`);
    return;
  }
  let text = await brain.describeRideStatusText(ride);
  if (ride.shareToken) text += `\nTrack live: ${getTravonyBaseUrl()}/track/${ride.shareToken}`;
  await reply(ctx, text);
}

async function handleCancel(ctx: ReplyCtx, session: WaSession): Promise<void> {
  // Cancel an in-progress booking conversation first.
  if (session.step) {
    session.step = undefined;
    session.destCandidates = undefined;
    session.pendingDestQuery = undefined;
    await reply(ctx, "Okay, booking cancelled. Say \"book a ride to ...\" any time.");
    return;
  }
  const user = session.userId ? { id: session.userId } : await brain.findUserByPhone(ctx.phone);
  if (!user) {
    await reply(ctx, "Nothing to cancel — no rides from this number yet.");
    return;
  }
  const n = await brain.cancelActiveRidesForUser(user.id);
  await reply(ctx, n > 0 ? "Your ride is cancelled." : "You have no active ride to cancel.");
}

// --- Channel features: Travony TV, car personas, highlight clips, safety ---

async function handleTv(ctx: ReplyCtx): Promise<void> {
  const card = await buildTvCardText();
  await reply(ctx, card);
}

async function handleCar(ctx: ReplyCtx): Promise<void> {
  const car = await getFeaturedCarIntro();
  if (!car) {
    await reply(ctx, "No cars are free to chat right now — try again soon, or say \"book a ride to ...\".");
    return;
  }
  await reply(ctx, `${car.personaName}: ${car.intro}\n\nReply with your destination to book me.`);
}

async function handleClips(ctx: ReplyCtx): Promise<void> {
  const clips = await getLatestApprovedClips(3);
  if (clips.length === 0) {
    await reply(ctx, "No highlights yet — they show up here once drivers approve their best moments. Check back soon!");
    return;
  }
  const lines = clips.map((c) => {
    const title = c.title || c.caption || "Ride highlight";
    const place = c.cityName ? ` — ${c.cityName}` : "";
    return `🎬 ${title}${place}\n${c.videoUrl}`;
  });
  await reply(ctx, `Today's ride highlights:\n\n${lines.join("\n\n")}`);
}

async function handleSafety(ctx: ReplyCtx, session: WaSession): Promise<void> {
  const rideId = session.lastCompletedRideId;
  const report = rideId ? await getSafetyReportText(rideId) : null;
  if (!report) {
    await reply(ctx, "No safety report yet. It appears here shortly after a streamed ride wraps up.");
    return;
  }
  await reply(ctx, report);
}

// ---------------------------------------------------------------------------
// Main entry — returns true when the message was handled as a rider message.
// ---------------------------------------------------------------------------
export async function tryHandleWhatsAppRider(params: {
  from: string;
  body: string;
  latitude?: number;
  longitude?: number;
  mediaUrl?: string;
  mediaContentType?: string;
  profileName?: string;
}): Promise<boolean> {
  await loadWaSessions();
  const phone = brain.normalizePhone(params.from.replace(/^whatsapp:/, ""));
  const session = getWaSession(phone);
  let text = (params.body || "").trim();
  let voiceReply = false;

  // Voice note → transcribe, then treat the transcript as the message and
  // answer with a voice note too.
  if (params.mediaUrl && (params.mediaContentType || "").startsWith("audio")) {
    try {
      const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
      const tok = (process.env.TWILIO_AUTH_TOKEN || "").trim();
      const auth = Buffer.from(`${sid}:${tok}`).toString("base64");
      const mediaRes = await fetch(params.mediaUrl, { headers: { Authorization: `Basic ${auth}` } });
      if (!mediaRes.ok) throw new Error(`media fetch ${mediaRes.status}`);
      const audioBuffer = Buffer.from(await mediaRes.arrayBuffer());
      const { ensureCompatibleFormat, speechToText } = await import("./replit_integrations/audio/client");
      const compat = await ensureCompatibleFormat(audioBuffer);
      const transcript = (await speechToText(compat.buffer, compat.format)).trim();
      if (!transcript) throw new Error("empty transcript");
      text = transcript;
      voiceReply = true;
    } catch (error) {
      console.error("[WaRider] voice note error:", error);
      await sendWhatsAppMessage(phone, "We couldn't hear that voice note — mind typing it instead?");
      return true;
    }
  }

  const ctx: ReplyCtx = { phone, voiceReply, langSample: text };
  if (text) session.langSample = text;

  try {
    // Location pin (Twilio sends Latitude/Longitude on location messages).
    if (typeof params.latitude === "number" && typeof params.longitude === "number") {
      const address = (await brain.reverseGeocodePoint(params.latitude, params.longitude)) || "Pinned location";
      session.pickup = { lat: params.latitude, lng: params.longitude, address };
      if (session.pendingDestQuery) {
        const q = session.pendingDestQuery;
        session.pendingDestQuery = undefined;
        await resolveDestination(ctx, session, q);
      } else {
        await askDestination(ctx, session);
      }
      return true;
    }

    if (!text) return false;
    const lower = text.toLowerCase();

    // Mid-flow numbered/yes-no replies take priority over intent parsing.
    if (session.step === "awaiting_dest_pick" && /^\d{1,2}$/.test(lower)) {
      const n = parseInt(lower, 10);
      if (n === 0 || !session.destCandidates || n > session.destCandidates.length) {
        session.step = "awaiting_dest";
        await reply(ctx, "Okay — type the destination again.");
        return true;
      }
      session.destination = session.destCandidates[n - 1];
      session.destCandidates = undefined;
      await showCars(ctx, session);
      return true;
    }
    if (session.step === "awaiting_car" && /^\d{1,2}$/.test(lower)) {
      const n = parseInt(lower, 10);
      const est = session.quote?.estimates?.[n - 1];
      if (!est) {
        await reply(ctx, "Reply with one of the numbers in the list above.");
        return true;
      }
      session.chosen = est;
      await showConfirm(ctx, session);
      return true;
    }
    if (session.step === "awaiting_confirm") {
      if (/^(yes|y|si|sí|yeah|ok|okay|confirm|book|1)\b/i.test(lower)) {
        await createWaRide(ctx, session, params.profileName);
        return true;
      }
      if (/^(no|n|cancel|stop|0)\b/i.test(lower)) {
        session.step = undefined;
        await reply(ctx, "No problem — nothing booked. Say \"book a ride to ...\" any time.");
        return true;
      }
    }
    if (session.step === "awaiting_pickup") {
      // Typed pickup address.
      const hits = await brain.searchPlaces(text, undefined, 1);
      if (!hits[0]) {
        await reply(ctx, `We couldn't find "${text}". Try a landmark, or share your location pin.`);
        return true;
      }
      session.pickup = hits[0];
      if (session.pendingDestQuery) {
        const q = session.pendingDestQuery;
        session.pendingDestQuery = undefined;
        await resolveDestination(ctx, session, q);
      } else {
        await askDestination(ctx, session);
      }
      return true;
    }
    if (session.step === "awaiting_dest") {
      await resolveDestination(ctx, session, text);
      return true;
    }

    // Channel-feature keywords (checked before booking intent parsing so a
    // bare "tv"/"car"/"clips"/"safety" never gets read as a place name).
    // Only when NO booking step is active — mid-flow text always belongs to
    // the flow (e.g. an unrecognized reply while awaiting confirmation).
    if (!session.step && /^(tv|travony tv|watch)\b/i.test(lower)) {
      await handleTv(ctx);
      return true;
    }
    if (!session.step && /^(car|talk to a car|meet a car)\b/i.test(lower)) {
      await handleCar(ctx);
      return true;
    }
    if (!session.step && /^(clips|highlights)\b/i.test(lower)) {
      await handleClips(ctx);
      return true;
    }
    if (!session.step && /^safety\b/i.test(lower)) {
      await handleSafety(ctx, session);
      return true;
    }

    // Fresh intent.
    const intent = brain.parseRiderText(text);

    // "BOOK" right after a price card books the seeded route.
    if (/^book\s*$/i.test(lower) && session.pickup && session.destination && session.chosen && session.quote) {
      await ensureWaUser(session, phone, params.profileName);
      await showConfirm(ctx, session);
      return true;
    }

    switch (intent.kind) {
      case "help":
        await reply(ctx, HELP_TEXT.replace("{BOOK_URL}", bookPageUrl()));
        return true;
      case "price":
        await handlePrice(ctx, session, intent.from, intent.to);
        return true;
      case "status":
        await handleStatus(ctx, session);
        return true;
      case "cancel":
        await handleCancel(ctx, session);
        return true;
      case "book": {
        await ensureWaUser(session, phone, params.profileName);
        if (intent.from) {
          const hits = await brain.searchPlaces(intent.from, undefined, 1);
          if (hits[0]) session.pickup = hits[0];
        }
        if (!session.pickup) {
          session.step = "awaiting_pickup";
          session.pendingDestQuery = intent.to;
          await reply(ctx, "Where should the driver pick you up? Share your location pin (attach → Location) or type the pickup address.");
          return true;
        }
        await resolveDestination(ctx, session, intent.to);
        return true;
      }
      default:
        break;
    }

    // Unknown text from someone mid-nothing: only claim it if they're already
    // a rider-flow user (session exists with data); otherwise let the driver
    // command handler take it.
    if (session.userId || session.pickup) {
      await reply(ctx, HELP_TEXT.replace("{BOOK_URL}", bookPageUrl()));
      return true;
    }
    return false;
  } finally {
    session.updatedAtMs = Date.now();
    await persistWaSession(phone);
  }
}

/**
 * Notify a WhatsApp-channel rider about a ride status change (called from the
 * ride status update hook). Only fires for riders whose account was
 * provisioned via WhatsApp (wa_*@wa.travony) so app users don't get texts.
 */
export async function notifyWhatsAppRiderRideUpdate(rideId: string): Promise<void> {
  try {
    const { storage } = await import("./storage");
    const ride = await storage.getRide(rideId);
    if (!ride) return;
    const user = await storage.getUser(ride.customerId);
    if (!user?.phone) return;
    if (!user.email || !user.email.endsWith("@wa.travony")) return;
    let text = await brain.describeRideStatusText(ride);
    if (ride.shareToken) text += `\nTrack live: ${getTravonyBaseUrl()}/track/${ride.shareToken}`;
    // On completion, remember the ride for the SAFETY keyword and append the
    // safety report inline when one already exists (honest — may arrive later).
    if (ride.status === "completed") {
      try {
        await loadWaSessions();
        const phone = brain.normalizePhone(user.phone);
        const session = getWaSession(phone);
        session.lastCompletedRideId = ride.id;
        session.updatedAtMs = Date.now();
        await persistWaSession(phone);
        const report = await getSafetyReportText(ride.id);
        if (report) text += `\n\n${report}`;
      } catch (e) {
        console.error("[WaRider] safety follow-up error:", e);
      }
    }
    await sendWhatsAppMessage(user.phone, text);
  } catch (error) {
    console.error("[WaRider] status notify error:", error);
  }
}
