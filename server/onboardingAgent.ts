/**
 * AI Onboarding Agent — riders and drivers join by conversation, not forms.
 *
 * One concierge behind every door (WhatsApp, Telegram, web link):
 * - Riders need zero onboarding: the first message IS the ride request, the
 *   account materializes silently from the phone number (bookingBrain does
 *   this already — this module only adds the abandoned-quote nudge).
 * - Drivers onboard by chat: "I want to drive" starts an interview in the
 *   driver's own language. Car photos, license and registration are collected
 *   right in the chat, read by the existing AI vehicle scan, and the
 *   driver + vehicle records are created automatically.
 * - AI verification with human fallback: a clean scan fast-tracks the driver
 *   to approved (exactly like the in-app fresh-scan auto-approval); anything
 *   ambiguous lands in the existing admin review queue with the AI extraction
 *   attached. `ai_verified` is ONLY ever granted by a fresh, successful scan.
 * - Smart nudges: ONE well-timed follow-up for a stalled driver interview or
 *   an abandoned rider quote, with STOP opt-out. Never more than one per
 *   session (atomic nudgeSentAt claim).
 *
 * The LLM translates finished templates (digit-guarded) and reads documents.
 * It never authors numbers, never decides approvals — the decision rules are
 * deterministic and mirror the existing PATCH /api/drivers/vehicle path.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "./db";
import { onboardingSessions, driverVerificationQueue } from "@shared/schema";
import { and, eq, isNull, lt, gt } from "drizzle-orm";
import { storage } from "./storage";
import * as brain from "./bookingBrain";
import { getTravonyBaseUrl } from "./telegramStreaming";

// ---------------------------------------------------------------------------
// Channel plumbing (lazy imports to avoid cycles)
// ---------------------------------------------------------------------------
async function sendWhatsApp(phone: string, text: string): Promise<void> {
  const { sendWhatsAppMessage } = await import("./whatsappBot");
  await sendWhatsAppMessage(phone, text);
}

async function sendTelegram(chatId: string, text: string, options?: any): Promise<void> {
  const { sendTelegramMessage } = await import("./telegramBot");
  await sendTelegramMessage(chatId, text, options);
}

/** Translate a finished English template into the user's language (digit-guarded). */
async function translated(english: string, langSample?: string): Promise<string> {
  if (!langSample) return english;
  const { translateKeepingDigits } = await import("./whatsappRiderBot");
  return translateKeepingDigits(english, langSample);
}

async function sendToChannel(channel: string, channelKey: string, english: string, langSample?: string): Promise<void> {
  const text = await translated(english, langSample);
  if (channel === "whatsapp") await sendWhatsApp(channelKey, text);
  else await sendTelegram(channelKey, text);
}

// ---------------------------------------------------------------------------
// Durable sessions
// ---------------------------------------------------------------------------
interface DriverOnboardData {
  name?: string;
  phone?: string;
  langSample?: string;
  photoFront?: string; // base64 data URLs — cleared once written to records
  photoSide?: string;
  licensePhoto?: string;
  registrationPhoto?: string;
  aiResult?: any;
  licenseRead?: any;
  plate?: string;
  make?: string;
  model?: string;
}

interface RiderQuoteData {
  from?: string;
  to?: string;
  fareText?: string;
  langSample?: string;
}

type SessionRow = typeof onboardingSessions.$inferSelect;

function parseData<T>(row: SessionRow | undefined): T {
  if (!row) return {} as T;
  try {
    return JSON.parse(row.data) as T;
  } catch {
    return {} as T;
  }
}

async function getSessionRow(channel: string, channelKey: string, kind: string): Promise<SessionRow | undefined> {
  const [row] = await db
    .select()
    .from(onboardingSessions)
    .where(
      and(
        eq(onboardingSessions.channel, channel),
        eq(onboardingSessions.channelKey, channelKey),
        eq(onboardingSessions.kind, kind),
      ),
    )
    .limit(1);
  return row;
}

async function upsertSession(params: {
  channel: string;
  channelKey: string;
  kind: string;
  state: string;
  data: any;
  userId?: string | null;
  driverId?: string | null;
  completedAt?: Date | null;
  resetNudge?: boolean;
}): Promise<void> {
  const values: any = {
    channel: params.channel,
    channelKey: params.channelKey,
    kind: params.kind,
    state: params.state,
    data: JSON.stringify(params.data ?? {}),
    updatedAt: new Date(),
  };
  if (params.userId !== undefined) values.userId = params.userId;
  if (params.driverId !== undefined) values.driverId = params.driverId;
  if (params.completedAt !== undefined) values.completedAt = params.completedAt;
  const set: any = { state: values.state, data: values.data, updatedAt: values.updatedAt };
  if (params.userId !== undefined) set.userId = values.userId;
  if (params.driverId !== undefined) set.driverId = values.driverId;
  if (params.completedAt !== undefined) set.completedAt = values.completedAt;
  if (params.resetNudge) set.nudgeSentAt = null;
  await db
    .insert(onboardingSessions)
    .values(values)
    .onConflictDoUpdate({
      target: [onboardingSessions.channel, onboardingSessions.channelKey, onboardingSessions.kind],
      set,
    });
}

// ---------------------------------------------------------------------------
// Driver intent detection — deliberately explicit phrases (multilingual) so a
// rider saying "drive me to the mall" never trips it.
// ---------------------------------------------------------------------------
const DRIVE_INTENT_PATTERNS: RegExp[] = [
  /\b(?:become|be|as|register(?:\s+as)?|join(?:\s+as)?|apply(?:\s+as|\s+to\s+be)?)\s+a?\s*driver\b/i,
  /\bwant(?:s|ed)?\s+to\s+drive\b/i,
  /\bsign\s*up\s+(?:as|to)\s+driv/i,
  /\bdrive\s*(?:&|and)\s*earn\b/i,
  /\bdriver\s+sign\s*up\b/i,
  /\bstart\s+driving\b/i,
  /^driver$/i,
  /quiero\s+conducir|ser\s+conductor|manejar\s+con/i,
  /je\s+veux\s+conduire|devenir\s+chauffeur/i,
  /أريد\s*أن\s*أقود|اريد\s*ان\s*اقود|سائق/,
  /ড্রাইভার\s*হতে|চালক\s*হতে/,
  /driver\s*bann?a|gaa?di\s*chalan/i,
  /стать\s+водителем|хочу\s+водить/i,
  /haydovchi\s+bo['ʼ]?lmoq?chi/i,
];

export function detectDriveIntent(text: string): boolean {
  const t = (text || "").trim();
  if (!t || t.length > 200) return false;
  return DRIVE_INTENT_PATTERNS.some((p) => p.test(t));
}

// ---------------------------------------------------------------------------
// Media fetch — Twilio (basic auth) and Telegram (getFile) → base64 data URL.
// ---------------------------------------------------------------------------
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export async function fetchTwilioMediaAsDataUrl(url: string, contentType?: string): Promise<string | null> {
  try {
    const sid = (process.env.TWILIO_ACCOUNT_SID || "").trim();
    const tok = (process.env.TWILIO_AUTH_TOKEN || "").trim();
    const auth = Buffer.from(`${sid}:${tok}`).toString("base64");
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return null;
    const ct = (res.headers.get("content-type") || contentType || "image/jpeg").split(";")[0];
    if (!ct.startsWith("image/")) return null;
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch (error) {
    console.error("[Onboarding] Twilio media fetch error:", error);
    return null;
  }
}

export async function fetchTelegramPhotoAsDataUrl(fileId: string): Promise<string | null> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return null;
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`);
    const fileData: any = await fileRes.json().catch(() => null);
    const filePath = fileData?.result?.file_path;
    if (!filePath) return null;
    const res = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_PHOTO_BYTES) return null;
    return `data:image/jpeg;base64,${buf.toString("base64")}`;
  } catch (error) {
    console.error("[Onboarding] Telegram photo fetch error:", error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// License reading — AI extraction attached to the review queue. Reading a
// document NEVER approves anything by itself; it only contributes to the
// deterministic fast-track rule below.
// ---------------------------------------------------------------------------
interface LicenseReadResult {
  isLicense: boolean;
  legible: boolean;
  fullName?: string;
  licenseNumber?: string;
  expiryDate?: string;
  expired?: boolean;
  notes?: string;
}

export async function readLicenseImage(dataUrl: string): Promise<LicenseReadResult> {
  try {
    const { openai } = await import("./replit_integrations/audio/client");
    const res = await openai.chat.completions.create({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You read driver license photos for a ride-hailing platform. Respond with JSON: {"isLicense": boolean (is this a driving license/permit document?), "legible": boolean (are the key fields readable?), "fullName": string or null, "licenseNumber": string or null, "expiryDate": "YYYY-MM-DD" or null, "notes": string}. Read ONLY what is actually visible — never guess or invent a value; use null when unsure.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Read this driving license." },
            { type: "image_url", image_url: { url: dataUrl } },
          ] as any,
        },
      ],
    });
    const parsed = JSON.parse(res.choices[0]?.message?.content || "{}");
    const out: LicenseReadResult = {
      isLicense: !!parsed.isLicense,
      legible: !!parsed.legible,
      fullName: typeof parsed.fullName === "string" ? parsed.fullName : undefined,
      licenseNumber: typeof parsed.licenseNumber === "string" ? parsed.licenseNumber : undefined,
      expiryDate: typeof parsed.expiryDate === "string" ? parsed.expiryDate : undefined,
      notes: typeof parsed.notes === "string" ? parsed.notes : undefined,
    };
    const expiryTs = parseStrictDateUTC(out.expiryDate);
    if (expiryTs !== null) {
      // Expired = the expiry day has fully passed (end of day UTC).
      out.expired = expiryTs + 24 * 60 * 60 * 1000 - 1 < Date.now();
    } else {
      out.expiryDate = undefined; // malformed/impossible date → treat as unread
    }
    return out;
  } catch (error) {
    console.error("[Onboarding] license read error:", error);
    return { isLicense: false, legible: false, notes: "AI document reading failed" };
  }
}

/**
 * Strictly parse a YYYY-MM-DD string into a UTC midnight timestamp.
 * Returns null unless it is a REAL calendar date: format must match AND the
 * constructed Date must round-trip to the same year/month/day (this rejects
 * normalized impossible dates like 2099-99-99 or 2026-02-30, which the Date
 * constructor would otherwise silently roll over or mark invalid).
 */
export function parseStrictDateUTC(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (y < 1900 || y > 2200) return null;
  const ts = Date.UTC(y, mo - 1, d);
  if (!Number.isFinite(ts)) return null;
  const dt = new Date(ts);
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return ts;
}

/**
 * Fast-track eligibility for the license read: a real license, legible, with
 * a strictly-parsed, REAL, unexpired calendar expiry date. A missing,
 * malformed or impossible expiry is NOT good enough — that goes to human
 * review, never to auto-approval. The expiry is re-validated here from the
 * raw string (defense in depth — never trust a precomputed flag alone).
 */
export function isLicenseFastTrackEligible(read: LicenseReadResult): boolean {
  if (read.isLicense !== true || read.legible !== true) return false;
  const ts = parseStrictDateUTC(read.expiryDate);
  if (ts === null) return false;
  const endOfExpiryDay = ts + 24 * 60 * 60 * 1000 - 1;
  return endOfExpiryDay >= Date.now();
}

// Region context for the vehicle scan prompt only (fees/currency always come
// from server-side pickup-coordinate detection — never from this).
const PHONE_REGION_PREFIXES: Array<[string, string]> = [
  ["+880", "BD"], ["+971", "AE"], ["+92", "PK"], ["+91", "IN"], ["+20", "EG"],
  ["+254", "KE"], ["+234", "NG"], ["+62", "ID"], ["+63", "PH"], ["+94", "LK"],
  ["+966", "SA"], ["+974", "QA"], ["+965", "KW"], ["+968", "OM"], ["+973", "BH"],
];

function regionHintFromPhone(phone?: string): string {
  if (!phone) return "BD";
  for (const [prefix, region] of PHONE_REGION_PREFIXES) {
    if (phone.startsWith(prefix)) return region;
  }
  return "BD";
}

// ---------------------------------------------------------------------------
// Message templates (English — translated per user)
// ---------------------------------------------------------------------------
const APP_LINK = "https://play.google.com/store/apps/details?id=com.travony.driver";

const MSG_INTRO =
  `Great — let's get you driving with Travony. You keep 90% of every fare.\n` +
  `No forms: just send 4 photos right here in this chat.\n\n` +
  `First: send a photo of the FRONT of your car (plate visible).\n\n` +
  `You can reply CANCEL any time to stop.`;

const MSG_NEED_FRONT = "Please send a photo of the FRONT of your car (license plate visible).";
const MSG_NEED_SIDE = "Got it. Now send a photo of the SIDE of your car.";
const MSG_NEED_LICENSE = "Nice car! Now send a photo of your DRIVING LICENSE (the side with your details).";
const MSG_NEED_REG = "Almost done. Send a photo of your vehicle REGISTRATION document.";
const MSG_SCANNING = "Thanks — that's everything. Give me a moment while I check your photos…";

function msgApproved(channel: string): string {
  const goOnline = channel === "whatsapp" ? `Reply ONLINE here` : `Tap /online here`;
  return (
    `You're approved — welcome to Travony!\n\n` +
    `You can start earning right now, no app needed:\n` +
    `1. ${goOnline} to start receiving ride alerts in this chat.\n` +
    `2. Each new ride comes with an Accept link — tap it to take the job.\n` +
    `3. You keep 90% of every fare, cash straight from the rider.\n\n` +
    `When you're ready for the full experience (live map, navigation, earnings dashboard), get the T Driver app: ${APP_LINK}`
  );
}

const MSG_REVIEW =
  `Thanks — your photos are in. A few details need a human look, so our team will review your application (usually within 24 hours). We'll message you here the moment you're approved.`;

const MSG_CANCELLED = `No problem — your application is cancelled. Message me "I want to drive" any time to pick it back up.`;
const MSG_OPTED_OUT = `Okay — no more reminders from us. Message me any time if you change your mind.`;

// ---------------------------------------------------------------------------
// Interview engine (channel-agnostic)
// ---------------------------------------------------------------------------
export interface OnboardingInput {
  channel: "whatsapp" | "telegram";
  channelKey: string; // phone for WhatsApp, chat id for Telegram
  phone?: string; // known identity (always for WhatsApp; after contact share for Telegram)
  name?: string;
  text?: string;
  imageDataUrl?: string;
}

function isStop(text?: string): boolean {
  return !!text && /^(stop|unsubscribe|no more|basta)$/i.test(text.trim());
}

function isCancel(text?: string): boolean {
  return !!text && /^(cancel|cancelar|quit|exit)$/i.test(text.trim());
}

/** Opt the channelKey out of every nudge (driver + rider quote sessions). */
export async function optOutChannelKey(channel: string, channelKey: string): Promise<void> {
  await db
    .update(onboardingSessions)
    .set({ optOut: true, updatedAt: new Date() })
    .where(and(eq(onboardingSessions.channel, channel), eq(onboardingSessions.channelKey, channelKey)));
}

/**
 * A rider replying STOP after a quote nudge must be honored even though they
 * have no driver interview open. Consumes the message ONLY when we actually
 * hold a session for this key that isn't already opted out — so a stray
 * "stop" from someone we never nudged still flows to the normal rider bot.
 */
async function tryHandleStopForKey(channel: string, channelKey: string): Promise<boolean> {
  const rows = await db
    .select({ id: onboardingSessions.id, optOut: onboardingSessions.optOut, data: onboardingSessions.data })
    .from(onboardingSessions)
    .where(and(eq(onboardingSessions.channel, channel), eq(onboardingSessions.channelKey, channelKey)))
    .limit(5);
  if (rows.length === 0) return false;
  if (rows.every((r) => r.optOut)) return false; // already opted out — nothing to do
  await optOutChannelKey(channel, channelKey);
  let langSample: string | undefined;
  try {
    langSample = (JSON.parse(rows[0].data) as any)?.langSample;
  } catch {}
  await sendToChannel(channel, channelKey, MSG_OPTED_OUT, langSample);
  return true;
}

/**
 * Start the driver interview. Returns the message already sent? No — sends
 * itself. If the phone already belongs to an approved/pending driver, this
 * short-circuits with a status message instead of a duplicate interview.
 */
export async function startDriverOnboarding(input: OnboardingInput): Promise<void> {
  const { channel, channelKey } = input;
  const langSample = input.text;

  // Existing driver? Point them at their status instead of re-interviewing.
  if (input.phone) {
    const user = await brain.findUserByPhone(input.phone);
    if (user) {
      const driver = await storage.getDriverByUserId(user.id);
      if (driver?.status === "approved") {
        await sendToChannel(
          channel,
          channelKey,
          channel === "whatsapp"
            ? `You're already an approved Travony driver! Reply ONLINE to receive ride alerts here, or open your T Driver app.`
            : `You're already an approved Travony driver! Tap /online to receive ride alerts here, or open your T Driver app.`,
          langSample,
        );
        return;
      }
      if (driver && (driver.status === "pending" || driver.status === "suspended")) {
        const existing = await getSessionRow(channel, channelKey, "driver");
        if (!existing || existing.completedAt) {
          // A pending driver without an open interview → their docs are in
          // review (or they registered in-app). Don't restart from zero.
          const vs = await storage.getDriverVehicles(driver.id).catch(() => []);
          if (vs.length > 0 || driver.licensePhoto) {
            await sendToChannel(
              channel,
              channelKey,
              `Your driver application is with our review team — we'll message you here as soon as it's approved.`,
              langSample,
            );
            return;
          }
        }
      }
    }
  }

  const data: DriverOnboardData = {
    phone: input.phone,
    name: input.name,
    langSample,
  };
  const state = channel === "telegram" && !input.phone ? "contact" : "car_front";
  // Restarting reopens the session but never re-arms a spent nudge — one
  // nudge EVER per session row.
  await upsertSession({
    channel,
    channelKey,
    kind: "driver",
    state,
    data,
    completedAt: null,
  });

  if (state === "contact") {
    const text = await translated(
      `Great — let's get you driving with Travony. You keep 90% of every fare.\nFirst, tap the button below to share your phone number (that's your driver account).`,
      langSample,
    );
    await sendTelegram(channelKey, text, {
      reply_markup: {
        keyboard: [[{ text: "Share my phone number", request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      },
    } as any);
  } else {
    await sendToChannel(channel, channelKey, MSG_INTRO, langSample);
  }
}

/**
 * Advance an active interview with a new message. Returns true when the
 * message was consumed by the onboarding flow.
 */
export async function advanceDriverOnboarding(input: OnboardingInput): Promise<boolean> {
  const { channel, channelKey } = input;
  const row = await getSessionRow(channel, channelKey, "driver");
  if (!row || row.completedAt) return false;

  const data = parseData<DriverOnboardData>(row);
  if (input.text) data.langSample = input.text;
  if (input.name && !data.name) data.name = input.name;
  if (input.phone && !data.phone) data.phone = input.phone;

  if (isStop(input.text)) {
    await optOutChannelKey(channel, channelKey);
    await upsertSession({ channel, channelKey, kind: "driver", state: "opted_out", data, completedAt: new Date() });
    await sendToChannel(channel, channelKey, MSG_OPTED_OUT, data.langSample);
    return true;
  }
  if (isCancel(input.text)) {
    await upsertSession({ channel, channelKey, kind: "driver", state: "cancelled", data, completedAt: new Date() });
    await sendToChannel(channel, channelKey, MSG_CANCELLED, data.langSample);
    return true;
  }

  const save = (state: string) =>
    upsertSession({ channel, channelKey, kind: "driver", state, data, userId: row.userId, driverId: row.driverId });

  switch (row.state) {
    case "contact": {
      // Telegram-only: waiting on the contact share (handled by the Telegram
      // adapter, which calls back with input.phone set).
      if (input.phone) {
        data.phone = input.phone;
        await save("car_front");
        await sendToChannel(channel, channelKey, MSG_INTRO, data.langSample);
      } else {
        await sendToChannel(
          channel,
          channelKey,
          "Tap the button to share your phone number — that's how your driver account is created.",
          data.langSample,
        );
      }
      return true;
    }
    case "car_front": {
      if (!input.imageDataUrl) {
        await sendToChannel(channel, channelKey, MSG_NEED_FRONT, data.langSample);
        return true;
      }
      data.photoFront = input.imageDataUrl;
      await save("car_side");
      await sendToChannel(channel, channelKey, MSG_NEED_SIDE, data.langSample);
      return true;
    }
    case "car_side": {
      if (!input.imageDataUrl) {
        await sendToChannel(channel, channelKey, MSG_NEED_SIDE, data.langSample);
        return true;
      }
      data.photoSide = input.imageDataUrl;
      await save("license");
      await sendToChannel(channel, channelKey, MSG_NEED_LICENSE, data.langSample);
      return true;
    }
    case "license": {
      if (!input.imageDataUrl) {
        await sendToChannel(channel, channelKey, MSG_NEED_LICENSE, data.langSample);
        return true;
      }
      data.licensePhoto = input.imageDataUrl;
      await save("registration");
      await sendToChannel(channel, channelKey, MSG_NEED_REG, data.langSample);
      return true;
    }
    case "registration": {
      if (!input.imageDataUrl) {
        await sendToChannel(channel, channelKey, MSG_NEED_REG, data.langSample);
        return true;
      }
      data.registrationPhoto = input.imageDataUrl;
      await save("scanning");
      await sendToChannel(channel, channelKey, MSG_SCANNING, data.langSample);
      await runScanAndContinue(channel, channelKey, data, row);
      return true;
    }
    case "scanning": {
      // A message raced the scan — just acknowledge.
      await sendToChannel(channel, channelKey, "One moment — still checking your photos…", data.langSample);
      return true;
    }
    case "need_plate": {
      const plate = (input.text || "").trim();
      if (!plate || plate.length < 2 || plate.length > 20) {
        await sendToChannel(channel, channelKey, "What's your license plate number? Type it exactly as it appears on the plate.", data.langSample);
        return true;
      }
      data.plate = plate.toUpperCase();
      if (!resolvedMakeModel(data)) {
        await save("need_make_model");
        await sendToChannel(channel, channelKey, "And what's the make and model of your car? (e.g. Toyota Corolla)", data.langSample);
        return true;
      }
      await save("finalizing");
      await finalizeDriverOnboarding(channel, channelKey, data, row);
      return true;
    }
    case "need_make_model": {
      const t = (input.text || "").trim();
      if (!t || t.length < 3 || t.length > 60) {
        await sendToChannel(channel, channelKey, "What's the make and model of your car? (e.g. Toyota Corolla)", data.langSample);
        return true;
      }
      const parts = t.split(/\s+/);
      data.make = parts[0];
      data.model = parts.slice(1).join(" ") || parts[0];
      await save("finalizing");
      await finalizeDriverOnboarding(channel, channelKey, data, row);
      return true;
    }
    case "finalizing": {
      await sendToChannel(channel, channelKey, "One moment — finishing your application…", data.langSample);
      return true;
    }
    default:
      return false;
  }
}

function resolvedMakeModel(data: DriverOnboardData): boolean {
  return !!((data.aiResult?.make || data.make) && (data.aiResult?.model || data.model));
}

async function runScanAndContinue(
  channel: string,
  channelKey: string,
  data: DriverOnboardData,
  row: SessionRow,
): Promise<void> {
  try {
    const { verifyMultipleVehicleImages } = await import("./vehicleVerification");
    const regionCode = regionHintFromPhone(data.phone);
    const [aiResult, licenseRead] = await Promise.all([
      verifyMultipleVehicleImages([data.photoFront!, data.photoSide!].filter(Boolean), regionCode),
      readLicenseImage(data.licensePhoto!),
    ]);
    data.aiResult = aiResult;
    data.licenseRead = licenseRead;

    // Adaptive questions: ask ONLY for what the AI couldn't read.
    if (!aiResult.plateNumber && !data.plate) {
      await upsertSession({ channel, channelKey, kind: "driver", state: "need_plate", data, userId: row.userId, driverId: row.driverId });
      await sendToChannel(channel, channelKey, "I couldn't read your plate from the photo. What's your license plate number?", data.langSample);
      return;
    }
    if (!resolvedMakeModel(data)) {
      await upsertSession({ channel, channelKey, kind: "driver", state: "need_make_model", data, userId: row.userId, driverId: row.driverId });
      await sendToChannel(channel, channelKey, "What's the make and model of your car? (e.g. Toyota Corolla)", data.langSample);
      return;
    }
    await upsertSession({ channel, channelKey, kind: "driver", state: "finalizing", data, userId: row.userId, driverId: row.driverId });
    await finalizeDriverOnboarding(channel, channelKey, data, row);
  } catch (error) {
    console.error("[Onboarding] scan error:", error);
    await upsertSession({ channel, channelKey, kind: "driver", state: "registration", data, userId: row.userId, driverId: row.driverId });
    await sendToChannel(channel, channelKey, "Something went wrong checking your photos. Please send your vehicle REGISTRATION photo again.", data.langSample);
  }
}

/**
 * Create the user + driver + vehicle records and decide the track:
 * - Clean AI scan + readable, unexpired license → approved (identical rule to
 *   the in-app fresh-scan fast-track; `ai_verified` comes ONLY from the scan).
 * - Anything ambiguous → pending + admin review queue with the AI extraction
 *   attached for the human reviewer.
 */
async function finalizeDriverOnboarding(
  channel: string,
  channelKey: string,
  data: DriverOnboardData,
  row: SessionRow,
): Promise<void> {
  try {
    const phone = data.phone!;
    const aiResult = data.aiResult;
    const licenseRead: LicenseReadResult = data.licenseRead || { isLicense: false, legible: false };

    // 1. Account (phone == account; synthetic email for chat channels).
    const user = await brain.ensureUserByPhone(phone, data.name, channel === "whatsapp" ? "whatsapp" : "link");
    if (user.role === "customer") {
      await storage.updateUser(user.id, { role: "driver" } as any);
    }
    if (channel === "telegram" && !user.telegramChatId) {
      await storage.updateUser(user.id, { telegramChatId: channelKey } as any);
    }

    // 2. Driver record (pending by default) + document photos.
    const driver = await storage.getOrCreateDriver(user.id, {});
    await storage.updateDriver(driver.id, {
      licensePhoto: data.licensePhoto || driver.licensePhoto,
      registrationPhoto: data.registrationPhoto || driver.registrationPhoto,
      licenseNumber: licenseRead.licenseNumber || driver.licenseNumber,
    });

    // 3. Vehicle — AI identity fields win; the driver only fills blanks the
    //    camera couldn't read (same rule as PATCH /api/drivers/vehicle).
    const { mapCategoryToVehicleType } = await import("./vehicleVerification");
    const scanValid = !!aiResult?.isValid;
    const vehicleData: any = {
      type: (aiResult ? mapCategoryToVehicleType(aiResult.category) : undefined) || "economy",
      make: aiResult?.make || data.make || "Unknown",
      model: aiResult?.model || data.model || "Unknown",
      year: aiResult?.year || undefined,
      color: aiResult?.color || undefined,
      plateNumber: aiResult?.plateNumber || data.plate || "",
      photoFront: data.photoFront,
      photoSide: data.photoSide,
      verificationStatus: scanValid ? "ai_verified" : "pending",
      aiCategory: aiResult?.category,
      aiConfidence: aiResult?.confidence != null ? String(aiResult.confidence) : undefined,
      aiConditionScore: aiResult?.conditionScore,
      aiPassengerCapacity: aiResult?.passengerCapacity,
      aiIssues: aiResult?.issues?.length ? JSON.stringify(aiResult.issues) : undefined,
      aiVerifiedAt: scanValid ? new Date() : undefined,
      isActive: true,
    };
    const existingVehicles = await storage.getDriverVehicles(driver.id);
    let vehicle = existingVehicles[0];
    if (vehicle) {
      vehicle = (await storage.updateVehicle(vehicle.id, vehicleData)) || vehicle;
    } else {
      const { v4: uuidv4 } = await import("uuid");
      vehicle = await storage.createVehicle({ id: uuidv4(), driverId: driver.id, ...vehicleData });
    }

    // 4. Decide the track.
    const licenseOk = isLicenseFastTrackEligible(licenseRead);
    const fastTrack = scanValid && licenseOk;

    if (fastTrack) {
      // Provisional approval — a real approval decision, same as the in-app
      // fresh-scan instant activation. Matching still requires approved.
      if (driver.status === "pending") {
        await storage.updateDriver(driver.id, { status: "approved" });
      }
      await upsertSession({
        channel, channelKey, kind: "driver", state: "approved",
        data: stripPhotos(data), userId: user.id, driverId: driver.id, completedAt: new Date(),
      });
      await sendToChannel(channel, channelKey, msgApproved(channel), data.langSample);
    } else {
      // Human fallback — existing admin review queue, AI extraction attached.
      const extraction = {
        source: "chat_onboarding",
        channel,
        vehicleScan: aiResult
          ? {
              isValid: aiResult.isValid,
              category: aiResult.category,
              confidence: aiResult.confidence,
              make: aiResult.make,
              model: aiResult.model,
              year: aiResult.year,
              color: aiResult.color,
              plateNumber: aiResult.plateNumber,
              conditionScore: aiResult.conditionScore,
              issues: aiResult.issues,
              details: aiResult.details,
            }
          : null,
        licenseRead: {
          isLicense: licenseRead.isLicense,
          legible: licenseRead.legible,
          fullName: licenseRead.fullName,
          licenseNumber: licenseRead.licenseNumber,
          expiryDate: licenseRead.expiryDate,
          expired: licenseRead.expired,
          notes: licenseRead.notes,
        },
        driverAnswers: { plate: data.plate, make: data.make, model: data.model },
      };
      const [openItem] = await db
        .select({ id: driverVerificationQueue.id })
        .from(driverVerificationQueue)
        .where(and(eq(driverVerificationQueue.driverId, driver.id), eq(driverVerificationQueue.status, "pending")))
        .limit(1);
      if (openItem) {
        await db
          .update(driverVerificationQueue)
          .set({ notes: `AI onboarding extraction: ${JSON.stringify(extraction)}`, updatedAt: new Date() })
          .where(eq(driverVerificationQueue.id, openItem.id));
      } else {
        await db.insert(driverVerificationQueue).values({
          driverId: driver.id,
          status: "pending",
          documentsComplete: !!(data.licensePhoto && data.registrationPhoto && data.photoFront && data.photoSide),
          vehicleVerified: false,
          licenseVerified: false,
          notes: `AI onboarding extraction: ${JSON.stringify(extraction)}`,
        });
      }
      await upsertSession({
        channel, channelKey, kind: "driver", state: "review",
        data: stripPhotos(data), userId: user.id, driverId: driver.id, completedAt: new Date(),
      });
      await sendToChannel(channel, channelKey, MSG_REVIEW, data.langSample);
    }
  } catch (error) {
    console.error("[Onboarding] finalize error:", error);
    await upsertSession({ channel, channelKey, kind: "driver", state: "registration", data, userId: row.userId, driverId: row.driverId });
    await sendToChannel(channel, channelKey, "Something went wrong saving your application. Please send your vehicle REGISTRATION photo again.", data.langSample);
  }
}

/** Photos are on the driver/vehicle records now — keep the session row small. */
function stripPhotos(data: DriverOnboardData): DriverOnboardData {
  const { photoFront, photoSide, licensePhoto, registrationPhoto, ...rest } = data;
  return rest;
}

// ---------------------------------------------------------------------------
// WhatsApp adapter
// ---------------------------------------------------------------------------
export async function tryHandleWhatsAppOnboarding(params: {
  from: string;
  body: string;
  mediaUrl?: string;
  mediaContentType?: string;
  profileName?: string;
}): Promise<boolean> {
  try {
    const phone = brain.normalizePhone(params.from.replace(/^whatsapp:/, ""));
    const text = (params.body || "").trim();

    let imageDataUrl: string | undefined;
    const isImage = !!params.mediaUrl && (params.mediaContentType || "").startsWith("image");

    const row = await getSessionRow("whatsapp", phone, "driver");
    const active = !!row && !row.completedAt;

    if (!active) {
      // STOP after a quote/interview nudge is honored even with no interview open.
      if (isStop(text)) return await tryHandleStopForKey("whatsapp", phone);
      if (!text || !detectDriveIntent(text)) return false;
      await startDriverOnboarding({
        channel: "whatsapp",
        channelKey: phone,
        phone,
        name: params.profileName,
        text,
      });
      return true;
    }

    if (isImage) {
      imageDataUrl = (await fetchTwilioMediaAsDataUrl(params.mediaUrl!, params.mediaContentType)) || undefined;
      if (!imageDataUrl) {
        const data = parseData<DriverOnboardData>(row);
        await sendToChannel("whatsapp", phone, "We couldn't download that photo — please send it again.", data.langSample);
        return true;
      }
    }

    return await advanceDriverOnboarding({
      channel: "whatsapp",
      channelKey: phone,
      phone,
      name: params.profileName,
      text: text || undefined,
      imageDataUrl,
    });
  } catch (error) {
    console.error("[Onboarding] WhatsApp adapter error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Telegram adapter
// ---------------------------------------------------------------------------
async function answerTelegramCallback(callbackQueryId: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) return;
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch {}
}

export async function tryHandleTelegramOnboarding(update: any): Promise<boolean> {
  try {
    // "Apply here in chat" button.
    if (update.callback_query?.data === "ob:apply") {
      const chatId = update.callback_query.message?.chat?.id;
      if (!chatId) return false;
      await answerTelegramCallback(update.callback_query.id);
      const key = String(chatId);
      const { users } = await import("@shared/schema");
      const [linked] = await db.select().from(users).where(eq(users.telegramChatId, key)).limit(1);
      await startDriverOnboarding({
        channel: "telegram",
        channelKey: key,
        phone: linked?.phone || undefined,
        name: linked?.name || update.callback_query.from?.first_name,
        text: undefined,
      });
      return true;
    }

    const message = update.message;
    if (!message) return false;
    const chatType = message.chat?.type;
    if (chatType === "group" || chatType === "supergroup") return false;
    const key = String(message.chat.id);

    const row = await getSessionRow("telegram", key, "driver");
    const active = !!row && !row.completedAt;
    const text: string | undefined = typeof message.text === "string" ? message.text.trim() : undefined;

    if (!active) {
      // STOP after a quote/interview nudge is honored even with no interview open.
      if (isStop(text)) return await tryHandleStopForKey("telegram", key);
      if (text && !text.startsWith("/") && detectDriveIntent(text)) {
        await startDriverOnboarding({
          channel: "telegram",
          channelKey: key,
          name: message.from?.first_name,
          text,
        });
        return true;
      }
      return false;
    }

    // Contact share while we wait for identity.
    if (message.contact && row!.state === "contact") {
      if (!message.contact.user_id || message.contact.user_id !== message.from?.id) {
        const data = parseData<DriverOnboardData>(row);
        await sendToChannel("telegram", key, "Please tap the button to share your OWN number — we can't use a contact card that isn't yours.", data.langSample);
        return true;
      }
      const phone = brain.normalizePhone(message.contact.phone_number || "");
      return await advanceDriverOnboarding({
        channel: "telegram",
        channelKey: key,
        phone,
        name: message.contact.first_name || message.from?.first_name,
      });
    }

    // Photos (Telegram sends an array of sizes — take the largest).
    if (Array.isArray(message.photo) && message.photo.length > 0) {
      const best = message.photo[message.photo.length - 1];
      const imageDataUrl = (await fetchTelegramPhotoAsDataUrl(best.file_id)) || undefined;
      if (!imageDataUrl) {
        const data = parseData<DriverOnboardData>(row);
        await sendToChannel("telegram", key, "We couldn't download that photo — please send it again.", data.langSample);
        return true;
      }
      return await advanceDriverOnboarding({ channel: "telegram", channelKey: key, imageDataUrl });
    }

    // Documents sent as files (uncompressed image).
    if (message.document && (message.document.mime_type || "").startsWith("image/")) {
      const imageDataUrl = (await fetchTelegramPhotoAsDataUrl(message.document.file_id)) || undefined;
      if (imageDataUrl) {
        return await advanceDriverOnboarding({ channel: "telegram", channelKey: key, imageDataUrl });
      }
    }

    if (text) {
      // Let real bot commands (e.g. /online after approval) pass through,
      // except an explicit /cancel which cancels the interview.
      if (text.startsWith("/") && !/^\/cancel/i.test(text)) return false;
      return await advanceDriverOnboarding({
        channel: "telegram",
        channelKey: key,
        text: /^\/cancel/i.test(text) ? "cancel" : text,
        name: message.from?.first_name,
      });
    }
    return false;
  } catch (error) {
    console.error("[Onboarding] Telegram adapter error:", error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Rider quote tracking — an abandoned quote gets exactly one nudge.
// ---------------------------------------------------------------------------
export async function trackRiderQuote(
  channel: "whatsapp" | "telegram",
  channelKey: string,
  info: { from?: string; to?: string; fareText?: string; langSample?: string },
): Promise<void> {
  try {
    const data: RiderQuoteData = {
      from: info.from,
      to: info.to,
      fareText: info.fareText,
      langSample: info.langSample,
    };
    // One nudge EVER per (channel, key) quote session: a fresh quote reopens
    // the session but never re-arms an already-spent nudge, and never
    // overrides opt-out.
    await upsertSession({
      channel,
      channelKey,
      kind: "rider_quote",
      state: "quoted",
      data,
      completedAt: null,
    });
  } catch (error) {
    console.error("[Onboarding] trackRiderQuote error:", error);
  }
}

export async function resolveRiderQuote(channel: "whatsapp" | "telegram", channelKey: string): Promise<void> {
  try {
    await db
      .update(onboardingSessions)
      .set({ completedAt: new Date(), state: "booked", updatedAt: new Date() })
      .where(
        and(
          eq(onboardingSessions.channel, channel),
          eq(onboardingSessions.channelKey, channelKey),
          eq(onboardingSessions.kind, "rider_quote"),
          isNull(onboardingSessions.completedAt),
        ),
      );
  } catch (error) {
    console.error("[Onboarding] resolveRiderQuote error:", error);
  }
}

// ---------------------------------------------------------------------------
// Nudge sweep — ONE follow-up per stalled session, claimed atomically so a
// restart or overlapping sweep can never double-send. Opt-out respected.
// ---------------------------------------------------------------------------
const DRIVER_NUDGE_AFTER_MS = 6 * 60 * 60 * 1000; // stalled ≥ 6h
const DRIVER_NUDGE_WINDOW_MS = 72 * 60 * 60 * 1000; // …but not older than 72h
const QUOTE_NUDGE_AFTER_MS = 45 * 60 * 1000; // abandoned ≥ 45min
const QUOTE_NUDGE_WINDOW_MS = 24 * 60 * 60 * 1000; // …but not older than 24h

let sweepStarted = false;
let sweepRunning = false;

export function startOnboardingNudgeSweep(): void {
  if (sweepStarted) return;
  sweepStarted = true;
  setInterval(() => {
    runNudgeSweepOnce().catch((e) => console.error("[Onboarding] nudge sweep error:", e));
  }, 10 * 60 * 1000);
  console.log("[Onboarding] nudge sweep started (every 10 min)");
}

export async function runNudgeSweepOnce(): Promise<{ driverNudges: number; quoteNudges: number }> {
  if (sweepRunning) return { driverNudges: 0, quoteNudges: 0 };
  sweepRunning = true;
  let driverNudges = 0;
  let quoteNudges = 0;
  try {
    const now = Date.now();

    // Stalled driver interviews.
    const stalled = await db
      .select()
      .from(onboardingSessions)
      .where(
        and(
          eq(onboardingSessions.kind, "driver"),
          isNull(onboardingSessions.completedAt),
          isNull(onboardingSessions.nudgeSentAt),
          eq(onboardingSessions.optOut, false),
          lt(onboardingSessions.updatedAt, new Date(now - DRIVER_NUDGE_AFTER_MS)),
          gt(onboardingSessions.updatedAt, new Date(now - DRIVER_NUDGE_WINDOW_MS)),
        ),
      )
      .limit(50);
    for (const s of stalled) {
      const claimed = await claimNudge(s.id);
      if (!claimed) continue;
      const data = parseData<DriverOnboardData>(s);
      const stepHint = stepReminder(s.state);
      await sendToChannel(
        s.channel,
        s.channelKey,
        `You're close to earning with Travony — ${stepHint} and you're done. Drivers keep 90% of every fare.\n\nReply STOP if you'd rather not hear from us again.`,
        data.langSample,
      ).catch((e) => console.error("[Onboarding] driver nudge send error:", e));
      driverNudges++;
    }

    // Abandoned rider quotes.
    const abandoned = await db
      .select()
      .from(onboardingSessions)
      .where(
        and(
          eq(onboardingSessions.kind, "rider_quote"),
          isNull(onboardingSessions.completedAt),
          isNull(onboardingSessions.nudgeSentAt),
          eq(onboardingSessions.optOut, false),
          lt(onboardingSessions.updatedAt, new Date(now - QUOTE_NUDGE_AFTER_MS)),
          gt(onboardingSessions.updatedAt, new Date(now - QUOTE_NUDGE_WINDOW_MS)),
        ),
      )
      .limit(50);
    for (const s of abandoned) {
      const claimed = await claimNudge(s.id);
      if (!claimed) continue;
      const data = parseData<RiderQuoteData>(s);
      const route = data.from && data.to ? `${data.from} → ${data.to}` : "your trip";
      const fare = data.fareText ? ` (${data.fareText})` : "";
      const bookHint = s.channel === "whatsapp" ? `Reply BOOK to grab it` : `Tap /book to grab it`;
      await sendToChannel(
        s.channel,
        s.channelKey,
        `Still need that ride? Your quote for ${route}${fare} is ready. ${bookHint}.\n\nReply STOP if you'd rather not hear from us again.`,
        data.langSample,
      ).catch((e) => console.error("[Onboarding] quote nudge send error:", e));
      quoteNudges++;
    }
  } finally {
    sweepRunning = false;
  }
  return { driverNudges, quoteNudges };
}

function stepReminder(state: string): string {
  switch (state) {
    case "contact": return "one tap to share your number";
    case "car_front": return "just send a photo of the front of your car";
    case "car_side": return "just send a photo of the side of your car";
    case "license": return "just send a photo of your driving license";
    case "registration": return "just send a photo of your registration";
    case "need_plate": return "just type your plate number";
    case "need_make_model": return "just type your car's make and model";
    default: return "one more step";
  }
}

/** Atomic one-nudge claim: UPDATE … WHERE nudge_sent_at IS NULL RETURNING. */
async function claimNudge(id: string): Promise<boolean> {
  const rows = await db
    .update(onboardingSessions)
    .set({ nudgeSentAt: new Date() })
    .where(and(eq(onboardingSessions.id, id), isNull(onboardingSessions.nudgeSentAt)))
    .returning({ id: onboardingSessions.id });
  return rows.length > 0;
}

// ---------------------------------------------------------------------------
// Secure ride-accept links — HMAC(SESSION_SECRET) tokens sent with the
// WhatsApp broadcast, so a provisionally-approved driver can take jobs before
// installing anything. The link only proves WHO the driver is; the actual
// accept goes through the normal PATCH /api/rides/:id (atomic claim + every
// eligibility gate) with a real session.
// ---------------------------------------------------------------------------
function acceptSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required for ride-accept links");
  return secret;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function buildRideAcceptToken(rideId: string, driverId: string, ttlMs = 30 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  const payload = `${rideId}:${driverId}:${exp}`;
  const sig = b64url(createHmac("sha256", acceptSecret()).update(`ride-accept:${payload}`).digest());
  return `${b64url(Buffer.from(payload, "utf8"))}.${sig}`;
}

export function verifyRideAcceptToken(token: string): { rideId: string; driverId: string } | null {
  try {
    const [payloadB64, sig] = token.split(".");
    if (!payloadB64 || !sig) return null;
    const payload = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const expected = b64url(createHmac("sha256", acceptSecret()).update(`ride-accept:${payload}`).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const parts = payload.split(":");
    if (parts.length !== 3) return null;
    const [rideId, driverId, expStr] = parts;
    const exp = parseInt(expStr, 10);
    if (!Number.isFinite(exp) || Date.now() > exp) return null;
    if (!rideId || !driverId) return null;
    return { rideId, driverId };
  } catch {
    return null;
  }
}

export function buildRideAcceptUrl(rideId: string, driverId: string): string {
  return `${getTravonyBaseUrl()}/go/a/${buildRideAcceptToken(rideId, driverId)}`;
}
