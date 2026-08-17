/**
 * Zero-install booking: the /ride web page + /track/:token live tracking page
 * and their JSON API. No app, no Expo bundle — one ultra-light server-rendered
 * HTML page (inline CSS/JS) that books through the shared booking brain.
 *
 * Surfaces:
 *   GET  /ride                      — booking page (also the shareable Price
 *                                     Oracle card via ?pa=..&pb=.. params)
 *   GET  /track/:token              — public live tracking page (works for the
 *                                     app's existing share links too)
 *   GET  /api/ridelink/places       — destination autocomplete (brain)
 *   GET  /api/ridelink/revgeo       — reverse geocode "use my location"
 *   POST /api/ridelink/quote        — engine-computed fares (free, no auth)
 *   POST /api/ridelink/book         — create the ride (Bearer session token;
 *                                     riders verify by phone OTP via the
 *                                     existing /api/auth/send-otp endpoints)
 *   GET  /api/ridelink/track/:token — public ride status polling
 *   GET  /api/ridelink/active       — resume an active ride (auth)
 *   POST /api/ridelink/cancel       — cancel my active ride (auth)
 *
 * Security invariants:
 * - The fare is NEVER taken from the client: /book re-quotes server-side and
 *   uses the engine's number for the chosen vehicle type.
 * - Booking requires a verified phone session (the same OTP login the apps
 *   use), so "book for someone else" senders are always verified.
 * - Recipient notifications are rate-limited per sender per day.
 */
import { Router } from "express";
import { db } from "./db";
import { rides, drivers, users, vehicles } from "@shared/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { storage } from "./storage";
import * as brain from "./bookingBrain";
import { randomUUID } from "crypto";

export const rideLinkRouter = Router();

// ---------------------------------------------------------------------------
// Auth: same Bearer session tokens the apps get from /api/auth/verify-otp
// ---------------------------------------------------------------------------
async function requireLinkAuth(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication required" });
  }
  const token = authHeader.slice(7);
  const session = await storage.getSession(token);
  if (!session || new Date() > session.expiresAt) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  req.userId = session.userId;
  req.userRole = session.role;
  next();
}

// ---------------------------------------------------------------------------
// Simple in-memory rate limits (per-process; good enough for abuse damping)
// ---------------------------------------------------------------------------
const placesHits = new Map<string, { count: number; windowStart: number }>();
function allowPlaces(ip: string): boolean {
  const now = Date.now();
  const rec = placesHits.get(ip);
  if (!rec || now - rec.windowStart > 60_000) {
    placesHits.set(ip, { count: 1, windowStart: now });
    return true;
  }
  rec.count++;
  return rec.count <= 30; // 30 lookups/min/ip
}

const recipientSends = new Map<string, { count: number; day: string }>();
function allowRecipientSend(userId: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const rec = recipientSends.get(userId);
  if (!rec || rec.day !== day) {
    recipientSends.set(userId, { count: 1, day });
    return true;
  }
  rec.count++;
  return rec.count <= 5; // 5 send-a-ride texts per sender per day
}

// ---------------------------------------------------------------------------
// JSON API
// ---------------------------------------------------------------------------

rideLinkRouter.get("/api/ridelink/places", async (req, res) => {
  try {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.ip || "?";
    if (!allowPlaces(ip)) return res.status(429).json({ message: "Slow down a little" });
    const q = String(req.query.q || "").trim();
    if (q.length < 2) return res.json([]);
    const lat = parseFloat(String(req.query.lat || ""));
    const lng = parseFloat(String(req.query.lng || ""));
    const near = Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : undefined;
    const results = await brain.searchPlaces(q, near, 5);
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ message: "Search failed" });
  }
});

rideLinkRouter.get("/api/ridelink/revgeo", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (!allowPlaces(ip)) return res.status(429).json({ message: "Too many requests — slow down." });
  try {
    const lat = parseFloat(String(req.query.lat || ""));
    const lng = parseFloat(String(req.query.lng || ""));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ message: "lat and lng required" });
    }
    const address = await brain.reverseGeocodePoint(lat, lng);
    res.json({ address: address || "Pinned location" });
  } catch {
    res.json({ address: "Pinned location" });
  }
});

function parsePoint(raw: any): brain.Place | null {
  if (!raw || typeof raw !== "object") return null;
  const lat = Number(raw.lat);
  const lng = Number(raw.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const address = typeof raw.address === "string" && raw.address.trim()
    ? raw.address.trim().slice(0, 300)
    : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  return { lat, lng, address };
}

rideLinkRouter.post("/api/ridelink/quote", async (req, res) => {
  const ip = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "?").split(",")[0].trim();
  if (!allowPlaces(ip)) return res.status(429).json({ message: "Too many requests — slow down." });
  try {
    const pickup = parsePoint(req.body?.pickup);
    const dropoff = parsePoint(req.body?.dropoff);
    if (!pickup || !dropoff) return res.status(400).json({ message: "pickup and dropoff required" });
    const quote = await brain.getQuote(pickup, dropoff);
    if (quote.estimates.length === 0) {
      return res.status(503).json({ message: "Could not compute a fare right now" });
    }
    res.json(quote);
  } catch (error: any) {
    console.error("[RideLink] quote error:", error);
    res.status(500).json({ message: "Quote failed" });
  }
});

rideLinkRouter.post("/api/ridelink/book", requireLinkAuth, async (req: any, res) => {
  try {
    const pickup = parsePoint(req.body?.pickup);
    const dropoff = parsePoint(req.body?.dropoff);
    if (!pickup || !dropoff) return res.status(400).json({ message: "pickup and dropoff required" });

    const vehicleType = typeof req.body?.vehicleType === "string" ? req.body.vehicleType : "";
    const recipientPhoneRaw = typeof req.body?.recipientPhone === "string" ? req.body.recipientPhone.trim() : "";
    const recipientName = typeof req.body?.recipientName === "string" ? req.body.recipientName.trim().slice(0, 60) : "";

    // Server-authoritative pricing: re-quote and use the engine's fare for the
    // chosen vehicle type. The client never supplies a price.
    const quote = await brain.getQuote(pickup, dropoff);
    if (quote.estimates.length === 0) {
      return res.status(503).json({ message: "Could not compute a fare right now" });
    }
    const choice = quote.estimates.find((e) => e.type === vehicleType) || quote.estimates[0];

    // Book-for-someone: validate + rate-limit BEFORE creating the ride.
    let recipientPhone: string | null = null;
    if (recipientPhoneRaw) {
      const digits = recipientPhoneRaw.replace(/[^0-9]/g, "");
      if (digits.length < 8 || digits.length > 15) {
        return res.status(400).json({ message: "That phone number doesn't look right" });
      }
      recipientPhone = `+${digits}`;
      if (!allowRecipientSend(req.userId)) {
        return res.status(429).json({ message: "You've sent the maximum rides for today" });
      }
    }

    let result: brain.CreateBrainRideResult;
    try {
      result = await brain.createBrainRide({
        userId: req.userId,
        pickup,
        dropoff,
        choice,
        quote,
        paymentMethod: "cash",
        withShareToken: true,
        channel: "link",
      });
    } catch (error: any) {
      if (error instanceof brain.EngagedRideError) {
        return res.status(409).json({
          message: "You already have an active trip",
          activeRideId: error.ride.id,
          shareToken: error.ride.shareToken || null,
        });
      }
      throw error;
    }

    const { ride, matchedEtaMin, driverInfo } = result;

    // Text the recipient their driver info + live tracking link. WhatsApp is
    // best-effort (sandbox sender in dev); SMS is the reliable channel.
    let recipientNotified = false;
    if (recipientPhone) {
      const base = getBaseUrl(req);
      const trackUrl = `${base}/track/${ride.shareToken}`;
      const sender = await storage.getUser(req.userId).catch(() => null);
      const who = sender?.name ? `${sender.name} booked` : "Someone booked";
      const driverLine = driverInfo
        ? ` Driver: ${driverInfo.name}, ${driverInfo.carDesc}${driverInfo.plate ? ` (${driverInfo.plate})` : ""}.`
        : "";
      const msg = `${who} you a Travony ride${recipientName ? `, ${recipientName}` : ""}!\nPickup: ${pickup.address}\nDrop-off: ${dropoff.address}\nPickup code: ${ride.otp}.${driverLine}\nTrack it live: ${trackUrl}`;
      try {
        const { sendWhatsAppMessage } = await import("./whatsappBot");
        const wa = await sendWhatsAppMessage(recipientPhone, msg).catch(() => false);
        const { sendSmsMessage } = await import("./twilioService");
        const sms = await sendSmsMessage(recipientPhone, msg).catch(() => ({ success: false }));
        recipientNotified = Boolean(wa || (sms as any)?.success);
      } catch (error) {
        console.error("[RideLink] recipient notify error:", error);
      }
    }

    res.json({
      rideId: ride.id,
      shareToken: ride.shareToken,
      otp: ride.otp,
      status: ride.status,
      fare: Number(ride.estimatedFare),
      currency: ride.currency,
      distanceKm: Number(ride.distance),
      etaMin: matchedEtaMin ?? null,
      driver: driverInfo || null,
      recipientNotified,
    });
  } catch (error: any) {
    console.error("[RideLink] book error:", error);
    res.status(500).json({ message: "Booking failed — please try again" });
  }
});

// Public live tracking JSON — polled by the page every few seconds. The share
// token is the capability; the link is only ever sent to the passenger.
rideLinkRouter.get("/api/ridelink/track/:token", async (req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    const token = String(req.params.token || "");
    if (!token || token.length < 8) return res.status(404).json({ message: "Not found" });
    const [ride] = await db.select().from(rides).where(eq(rides.shareToken, token)).limit(1);
    if (!ride) return res.status(404).json({ message: "Invalid or expired tracking link" });

    let driver: any = null;
    if (ride.driverId) {
      try {
        const d = await storage.getDriver(ride.driverId);
        if (d) {
          const du = await storage.getUser(d.userId);
          const vs = await storage.getVehiclesByDriver(d.id);
          const v = vs?.[0];
          driver = {
            name: du?.name || "Your driver",
            car: v ? `${v.color ? v.color + " " : ""}${v.make} ${v.model}`.trim() : null,
            plate: v?.plateNumber || null,
            lat: d.currentLat ? parseFloat(d.currentLat) : null,
            lng: d.currentLng ? parseFloat(d.currentLng) : null,
            rating: d.rating || null,
          };
        }
      } catch {}
    }

    res.json({
      status: ride.status,
      pickupAddress: ride.pickupAddress,
      dropoffAddress: ride.dropoffAddress,
      pickupLat: parseFloat(ride.pickupLat),
      pickupLng: parseFloat(ride.pickupLng),
      dropoffLat: parseFloat(ride.dropoffLat),
      dropoffLng: parseFloat(ride.dropoffLng),
      fare: Number(ride.actualFare || ride.estimatedFare || 0),
      currency: ride.currency || "AED",
      otp: ["pending", "accepted", "arriving"].includes(ride.status) ? ride.otp : null,
      driver,
      createdAt: ride.createdAt,
      startedAt: ride.startedAt,
      completedAt: ride.completedAt,
    });
  } catch (error: any) {
    console.error("[RideLink] track error:", error);
    res.status(500).json({ message: "Tracking failed" });
  }
});

// Resume: the booker returns to /ride later — surface their active ride.
rideLinkRouter.get("/api/ridelink/active", requireLinkAuth, async (req: any, res) => {
  try {
    const ride = await brain.getActiveRideForUser(req.userId);
    if (!ride) return res.json({ ride: null });
    let shareToken = ride.shareToken;
    if (!shareToken) {
      shareToken = `share_${randomUUID().replace(/-/g, "").substring(0, 16)}`;
      await storage.updateRide(ride.id, { shareToken } as any);
    }
    res.json({ ride: { id: ride.id, status: ride.status, shareToken } });
  } catch (error: any) {
    res.status(500).json({ message: "Lookup failed" });
  }
});

// Ephemeral TTS voice clips for WhatsApp voice-note replies (Twilio fetches
// this URL as the message MediaUrl). Clips expire after 10 minutes.
rideLinkRouter.get("/api/ridelink/voice/:id", async (req, res) => {
  try {
    const { getVoiceClip } = await import("./whatsappRiderBot");
    const clip = getVoiceClip(String(req.params.id || ""));
    if (!clip) return res.status(404).send("Gone");
    res.setHeader("Content-Type", clip.contentType);
    res.setHeader("Cache-Control", "no-store");
    res.send(clip.buffer);
  } catch {
    res.status(404).send("Gone");
  }
});

rideLinkRouter.post("/api/ridelink/cancel", requireLinkAuth, async (req: any, res) => {
  try {
    const n = await brain.cancelActiveRidesForUser(req.userId);
    res.json({ cancelled: n });
  } catch (error: any) {
    res.status(500).json({ message: "Cancel failed" });
  }
});

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function getBaseUrl(req: any): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  const host = req?.headers?.host;
  return host ? `https://${host}` : "https://travony.replit.app";
}

rideLinkRouter.get("/ride", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderRidePage({ mode: "book" }));
});

rideLinkRouter.get("/track/:token", (req, res) => {
  const token = String(req.params.token || "");
  // Share tokens are server-minted (share_<hex>); reject anything else before
  // it gets anywhere near the rendered page.
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(token)) {
    return res.status(404).send("Not found");
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(renderRidePage({ mode: "track", token }));
});

function renderRidePage(opts: { mode: "book" | "track"; token?: string }): string {
  // \u003c-escape so no value can ever close the inline <script> block.
  const boot = JSON.stringify({ mode: opts.mode, token: opts.token || null }).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${opts.mode === "track" ? "Track your Travony ride" : "Book a ride — Travony"}</title>
<meta name="description" content="Book a Travony ride in seconds — no app, no install. Live prices, verified drivers, live tracking.">
<meta property="og:title" content="${opts.mode === "track" ? "Track this Travony ride live" : "Travony — book a ride with one link"}">
<meta property="og:description" content="No install needed. Real prices, real drivers, live tracking.">
<style>
:root{--bg:#101317;--panel:#181c22;--panel2:#1f242c;--line:#2a3038;--text:#f2f4f6;--dim:#9aa3ad;--amber:#ffb020;--amber-dark:#e69500;--green:#37d67a;--red:#ff5a56}
*{margin:0;padding:0;box-sizing:border-box}
html,body{height:100%}
body{background:var(--bg);color:var(--text);font-family:"Helvetica Neue","Segoe UI",Arial,sans-serif;-webkit-font-smoothing:antialiased;display:flex;flex-direction:column;min-height:100dvh}
.wrap{width:100%;max-width:460px;margin:0 auto;padding:0 16px;flex:1;display:flex;flex-direction:column}
header{display:flex;align-items:center;gap:10px;padding:18px 0 10px}
.logo{width:34px;height:34px;border-radius:9px;background:var(--amber);display:flex;align-items:center;justify-content:center;font-weight:800;color:#101317;font-size:19px}
.brand{font-size:19px;font-weight:700;letter-spacing:.3px}
.tag{margin-left:auto;font-size:11px;color:var(--dim);border:1px solid var(--line);padding:4px 9px;border-radius:99px}
h1{font-size:22px;font-weight:700;margin:10px 0 4px}
.sub{color:var(--dim);font-size:14px;margin-bottom:16px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:14px}
.field{position:relative;margin-bottom:12px}
.field label{display:block;font-size:12px;color:var(--dim);margin-bottom:6px;font-weight:600;letter-spacing:.4px;text-transform:uppercase}
input[type=text],input[type=tel]{width:100%;background:var(--panel2);border:1px solid var(--line);color:var(--text);border-radius:11px;padding:13px 13px;font-size:16px;outline:none}
input:focus{border-color:var(--amber)}
.suggest{position:absolute;left:0;right:0;top:100%;z-index:30;background:var(--panel2);border:1px solid var(--line);border-radius:11px;margin-top:4px;overflow:hidden;box-shadow:0 12px 30px rgba(0,0,0,.5)}
.suggest div{padding:11px 13px;font-size:14px;cursor:pointer;border-bottom:1px solid var(--line)}
.suggest div:last-child{border-bottom:none}
.suggest div:active,.suggest div:hover{background:#262c35}
.btn{width:100%;border:none;border-radius:12px;padding:15px;font-size:16px;font-weight:700;cursor:pointer;transition:opacity .15s}
.btn:disabled{opacity:.45;cursor:default}
.btn-amber{background:var(--amber);color:#101317}
.btn-ghost{background:transparent;color:var(--amber);border:1px solid var(--amber)}
.btn-dim{background:var(--panel2);color:var(--text);border:1px solid var(--line)}
.btn-red{background:transparent;color:var(--red);border:1px solid var(--red)}
.row{display:flex;gap:10px}
.loc-btn{background:var(--panel2);border:1px solid var(--line);color:var(--amber);border-radius:11px;padding:0 14px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap}
.fare-opt{display:flex;align-items:center;justify-content:space-between;background:var(--panel2);border:1.5px solid var(--line);border-radius:12px;padding:13px 14px;margin-bottom:9px;cursor:pointer}
.fare-opt.sel{border-color:var(--amber);background:#231f14}
.fare-opt .nm{font-size:15px;font-weight:600}
.fare-opt .fr{font-size:16px;font-weight:800;color:var(--amber)}
.meta{display:flex;gap:14px;color:var(--dim);font-size:13px;margin-bottom:12px}
.hidden{display:none!important}
.err{color:var(--red);font-size:13px;margin:8px 0}
.ok{color:var(--green);font-size:13px;margin:8px 0}
.switch{display:flex;align-items:center;gap:10px;margin:6px 0 10px;cursor:pointer;font-size:14px;color:var(--dim)}
.switch input{width:18px;height:18px;accent-color:var(--amber)}
.status-pill{display:inline-block;padding:5px 13px;border-radius:99px;font-size:13px;font-weight:700;letter-spacing:.3px}
.st-pending{background:#3a3320;color:var(--amber)}
.st-live{background:#173627;color:var(--green)}
.st-done{background:#20303a;color:#7cc6ff}
.st-cancelled{background:#3a2020;color:var(--red)}
.otp-big{font-size:34px;font-weight:800;letter-spacing:10px;color:var(--amber);text-align:center;padding:8px 0}
.driver-card{display:flex;align-items:center;gap:13px}
.avatar{width:46px;height:46px;border-radius:50%;background:var(--panel2);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:var(--amber)}
#map{height:250px;border-radius:14px;border:1px solid var(--line);margin-bottom:12px;background:var(--panel2)}
.spin{display:inline-block;width:15px;height:15px;border:2px solid #10131744;border-top-color:#101317;border-radius:50%;animation:sp 1s linear infinite;vertical-align:-2px;margin-right:7px}
@keyframes sp{to{transform:rotate(360deg)}}
footer{padding:18px 0 26px;text-align:center;color:var(--dim);font-size:13px}
footer a{color:var(--amber);text-decoration:none;font-weight:600}
.addr{font-size:14px;line-height:1.45}
.addr b{color:var(--dim);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.4px;display:block}
.divider{height:1px;background:var(--line);margin:12px 0}
.linkline{color:var(--amber);font-size:14px;cursor:pointer;font-weight:600;text-align:center;padding:8px 0}
#btn-voice{position:fixed;right:18px;bottom:18px;width:56px;height:56px;border-radius:50%;border:none;background:var(--amber);color:#101317;font-size:22px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.45);z-index:50;display:flex;align-items:center;justify-content:center}
#btn-voice.v-rec{background:var(--red);color:#fff;animation:vpulse 1.2s ease-in-out infinite}
@keyframes vpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
#v-status{position:fixed;right:18px;bottom:82px;max-width:72%;background:var(--panel);border:1px solid var(--line);color:var(--dim);font-size:13px;padding:8px 12px;border-radius:12px;z-index:50}
</style>
</head>
<body>
<div class="wrap">
<header>
  <div class="logo">T</div><div class="brand">Travony</div>
  <div class="tag">No install needed</div>
</header>

<!-- STEP: ROUTE -->
<section id="s-route">
  <h1>Where to?</h1>
  <div class="sub">Live prices in seconds. Book only if you like the fare.</div>
  <div class="card">
    <div class="field">
      <label>Pickup</label>
      <div class="row">
        <div style="flex:1;position:relative">
          <input type="text" id="in-pickup" placeholder="Search pickup place" autocomplete="off">
          <div class="suggest hidden" id="sg-pickup"></div>
        </div>
        <button class="loc-btn" id="btn-gps">📍 My location</button>
      </div>
    </div>
    <div class="field">
      <label>Destination</label>
      <input type="text" id="in-dest" placeholder="Where are you going?" autocomplete="off">
      <div class="suggest hidden" id="sg-dest"></div>
    </div>
    <div class="err hidden" id="err-route"></div>
    <button class="btn btn-amber" id="btn-quote" disabled>See prices</button>
  </div>
</section>

<!-- STEP: QUOTE -->
<section id="s-quote" class="hidden">
  <h1>Your price</h1>
  <div class="sub" id="quote-route"></div>
  <div class="card">
    <div class="meta"><span id="q-dist"></span><span id="q-time"></span></div>
    <div id="fare-list"></div>
    <div class="divider"></div>
    <label class="switch"><input type="checkbox" id="chk-someone"> This ride is for someone else</label>
    <div id="recipient-box" class="hidden">
      <div class="field"><label>Their phone (with country code)</label><input type="tel" id="in-rphone" placeholder="+9715xxxxxxxx"></div>
      <div class="field"><label>Their name (optional)</label><input type="text" id="in-rname" placeholder="e.g. Mum"></div>
      <div class="sub" style="margin-bottom:8px">They'll get a text with the driver's details and a live tracking link. Nothing to install.</div>
    </div>
    <div class="err hidden" id="err-quote"></div>
    <button class="btn btn-amber" id="btn-book">Book now · pay cash to driver</button>
    <div class="linkline" id="btn-share-price">Share this price</div>
    <div class="linkline" id="btn-back-route">← Change route</div>
  </div>
</section>

<!-- STEP: VERIFY -->
<section id="s-verify" class="hidden">
  <h1>Quick check — it's really you</h1>
  <div class="sub">We text a code to your phone. That's your whole login.</div>
  <div class="card">
    <div id="v-phone-box">
      <div class="field"><label>Your phone (with country code)</label><input type="tel" id="in-phone" placeholder="+9715xxxxxxxx"></div>
      <div class="err hidden" id="err-phone"></div>
      <button class="btn btn-amber" id="btn-sendotp">Text me the code</button>
    </div>
    <div id="v-code-box" class="hidden">
      <div class="field"><label>6-digit code</label><input type="tel" id="in-otp" placeholder="123456" maxlength="6"></div>
      <div class="field hidden" id="name-box"><label>Your name</label><input type="text" id="in-name" placeholder="So the driver knows who to greet"></div>
      <div class="err hidden" id="err-otp"></div>
      <button class="btn btn-amber" id="btn-verify">Verify & book</button>
      <div class="linkline" id="btn-resend">Resend code</div>
    </div>
    <div class="linkline" id="btn-back-quote">← Back to price</div>
  </div>
</section>

<!-- STEP: TRACK -->
<section id="s-track" class="hidden">
  <h1 id="t-title">Your ride</h1>
  <div class="sub"><span class="status-pill st-pending" id="t-pill">finding driver…</span></div>
  <div class="card hidden" id="t-otp-card" style="text-align:center">
    <div style="color:var(--dim);font-size:13px">Pickup code — show it when you board</div>
    <div class="otp-big" id="t-otp"></div>
  </div>
  <div class="card hidden" id="t-driver-card">
    <div class="driver-card">
      <div class="avatar" id="t-avatar">D</div>
      <div>
        <div style="font-weight:700;font-size:16px" id="t-driver-name"></div>
        <div style="color:var(--dim);font-size:13px" id="t-driver-car"></div>
      </div>
      <div style="margin-left:auto;font-weight:800;color:var(--amber)" id="t-plate"></div>
    </div>
  </div>
  <div id="map"></div>
  <div class="card">
    <div class="addr"><b>From</b><span id="t-from"></span></div>
    <div class="divider"></div>
    <div class="addr"><b>To</b><span id="t-to"></span></div>
    <div class="divider"></div>
    <div class="addr"><b>Fare</b><span id="t-fare"></span> <span style="color:var(--dim)">· cash to driver</span></div>
  </div>
  <div class="ok hidden" id="t-sent-note"></div>
  <button class="btn btn-red hidden" id="btn-cancel">Cancel this ride</button>
  <div class="err hidden" id="err-track"></div>
  <div class="linkline hidden" id="btn-again">Book another ride</div>
</section>

<footer>
  Prefer the full experience? <a href="/">Get the Travony app</a> — live streams, wallets, rewards & more.
</footer>
</div>

<div id="v-status" class="hidden"></div>
<button id="btn-voice" class="hidden" title="Talk to Travony">🎤</button>

<script>
var BOOT=${boot};
var S={pickup:null,dest:null,quote:null,choice:null,token:localStorage.getItem("tv_link_token")||null,shareToken:BOOT.token,booked:false,map:null,mDriver:null,mPick:null,mDrop:null,leafletTried:false,pollTimer:null,regToken:null};
function $(id){return document.getElementById(id)}
function show(id){["s-route","s-quote","s-verify","s-track"].forEach(function(s){$(s).classList.toggle("hidden",s!==id)});window.scrollTo(0,0)}
function err(id,msg){var e=$(id);if(!msg){e.classList.add("hidden");return}e.textContent=msg;e.classList.remove("hidden")}
function api(path,opts){opts=opts||{};opts.headers=opts.headers||{};opts.headers["Content-Type"]="application/json";if(S.token)opts.headers["Authorization"]="Bearer "+S.token;return fetch(path,opts).then(function(r){return r.json().catch(function(){return{}}).then(function(j){return{ok:r.ok,status:r.status,body:j}})})}

/* ---------- autocomplete ---------- */
function debounce(fn,ms){var t;return function(){var a=arguments;clearTimeout(t);t=setTimeout(function(){fn.apply(null,a)},ms)}}
function wireSearch(inputId,sgId,setter){
  var inp=$(inputId),sg=$(sgId);
  inp.addEventListener("input",debounce(function(){
    var q=inp.value.trim();setter(null);updateQuoteBtn();
    if(q.length<2){sg.classList.add("hidden");return}
    var near=S.pickup?("&lat="+S.pickup.lat+"&lng="+S.pickup.lng):"";
    api("/api/ridelink/places?q="+encodeURIComponent(q)+near).then(function(r){
      if(!r.ok||!Array.isArray(r.body)||!r.body.length){sg.classList.add("hidden");return}
      sg.innerHTML="";
      r.body.forEach(function(p){
        var d=document.createElement("div");d.textContent=p.address;
        d.onclick=function(){inp.value=p.address;sg.classList.add("hidden");setter(p);updateQuoteBtn()};
        sg.appendChild(d);
      });
      sg.classList.remove("hidden");
    });
  },350));
  document.addEventListener("click",function(ev){if(!sg.contains(ev.target)&&ev.target!==inp)sg.classList.add("hidden")});
}
wireSearch("in-pickup","sg-pickup",function(p){S.pickup=p});
wireSearch("in-dest","sg-dest",function(p){S.dest=p});
function updateQuoteBtn(){$("btn-quote").disabled=!(S.pickup&&S.dest)}

$("btn-gps").onclick=function(){
  err("err-route",null);
  if(!navigator.geolocation){err("err-route","Location isn't available in this browser — search for your pickup instead.");return}
  $("btn-gps").textContent="Locating…";
  navigator.geolocation.getCurrentPosition(function(pos){
    var lat=pos.coords.latitude,lng=pos.coords.longitude;
    api("/api/ridelink/revgeo?lat="+lat+"&lng="+lng).then(function(r){
      var addr=(r.body&&r.body.address)||"My location";
      S.pickup={lat:lat,lng:lng,address:addr};
      $("in-pickup").value=addr;$("btn-gps").textContent="📍 My location";updateQuoteBtn();
    });
  },function(){
    $("btn-gps").textContent="📍 My location";
    err("err-route","Couldn't get your location — please allow access or search instead.");
  },{enableHighAccuracy:true,timeout:10000});
};

/* ---------- quote ---------- */
$("btn-quote").onclick=function(){getQuote()};
function getQuote(){
  err("err-route",null);
  var b=$("btn-quote");b.disabled=true;b.innerHTML='<span class="spin"></span>Checking live prices…';
  api("/api/ridelink/quote",{method:"POST",body:JSON.stringify({pickup:S.pickup,dropoff:S.dest})}).then(function(r){
    b.disabled=false;b.textContent="See prices";
    if(!r.ok){err("err-route",r.body.message||"Couldn't price that route.");return}
    S.quote=r.body;S.choice=r.body.estimates[0];
    renderQuote();show("s-quote");
  });
}
function renderQuote(){
  $("quote-route").textContent=S.pickup.address+" → "+S.dest.address;
  $("q-dist").textContent="~"+S.quote.distanceKm.toFixed(1)+" km";
  $("q-time").textContent="about "+S.quote.durationMin+" min";
  var fl=$("fare-list");fl.innerHTML="";
  S.quote.estimates.forEach(function(e){
    var d=document.createElement("div");
    d.className="fare-opt"+(S.choice&&S.choice.type===e.type?" sel":"");
    d.innerHTML='<span class="nm">'+e.label+'</span><span class="fr">'+S.quote.currency+' '+e.fare.toFixed(2)+'</span>';
    d.onclick=function(){S.choice=e;renderQuote()};
    fl.appendChild(d);
  });
}
$("btn-back-route").onclick=function(){show("s-route")};
$("chk-someone").onchange=function(){$("recipient-box").classList.toggle("hidden",!this.checked)};
$("btn-share-price").onclick=function(){
  var u=location.origin+"/ride?pa="+S.pickup.lat.toFixed(6)+","+S.pickup.lng.toFixed(6)+","+encodeURIComponent(S.pickup.address)+"&pb="+S.dest.lat.toFixed(6)+","+S.dest.lng.toFixed(6)+","+encodeURIComponent(S.dest.address);
  var txt="Travony price: "+S.pickup.address+" → "+S.dest.address+" from "+S.quote.currency+" "+S.quote.estimates[0].fare.toFixed(2)+". Check it live: "+u;
  if(navigator.share){navigator.share({title:"Travony price",text:txt,url:u}).catch(function(){})}
  else{navigator.clipboard.writeText(txt).then(function(){$("btn-share-price").textContent="Copied! Send it to anyone"});}
};

/* ---------- booking / auth ---------- */
$("btn-book").onclick=function(){
  err("err-quote",null);
  if($("chk-someone").checked){
    var ph=$("in-rphone").value.trim();
    if(ph.replace(/[^0-9]/g,"").length<8){err("err-quote","Enter their phone number with country code first.");return}
  }
  if(S.token){doBook()}else{show("s-verify")}
};
$("btn-back-quote").onclick=function(){show("s-quote")};
$("btn-sendotp").onclick=sendOtp;
$("btn-resend").onclick=sendOtp;
function sendOtp(){
  err("err-phone",null);err("err-otp",null);
  var phone=$("in-phone").value.trim();
  if(phone.replace(/[^0-9]/g,"").length<8){err("err-phone","Enter your phone with country code, e.g. +9715…");return}
  var b=$("btn-sendotp");b.disabled=true;b.innerHTML='<span class="spin"></span>Sending…';
  api("/api/auth/send-otp",{method:"POST",body:JSON.stringify({phone:phone})}).then(function(r){
    b.disabled=false;b.textContent="Text me the code";
    if(!r.ok){err("err-phone",r.body.message||"Couldn't send the code.");return}
    $("v-phone-box").classList.add("hidden");$("v-code-box").classList.remove("hidden");
    setTimeout(function(){$("in-otp").focus()},50);
  });
}
$("btn-verify").onclick=function(){
  err("err-otp",null);
  var phone=$("in-phone").value.trim(),code=$("in-otp").value.trim();
  if(code.length<4){err("err-otp","Enter the code we texted you.");return}
  if(S.regToken){completeReg();return}
  var b=$("btn-verify");b.disabled=true;b.innerHTML='<span class="spin"></span>Verifying…';
  api("/api/auth/verify-otp",{method:"POST",body:JSON.stringify({phone:phone,otp:code})}).then(function(r){
    b.disabled=false;b.textContent="Verify & book";
    if(!r.ok){err("err-otp",r.body.message||"That code didn't match.");return}
    if(r.body.isNewUser){
      S.regToken=r.body.sessionToken;
      completeReg();return;
    }
    S.token=r.body.token;localStorage.setItem("tv_link_token",S.token);
    doBook();
  });
};
function completeReg(){
  var nm=$("in-name").value.trim();
  var b=$("btn-verify");b.disabled=true;b.innerHTML='<span class="spin"></span>Creating account…';
  api("/api/auth/complete-registration",{method:"POST",body:JSON.stringify({sessionToken:S.regToken,name:nm||undefined,role:"customer"})}).then(function(r){
    b.disabled=false;b.textContent="Verify & book";
    if(!r.ok){err("err-otp",r.body.message||"Couldn't finish signup.");return}
    S.token=r.body.token;localStorage.setItem("tv_link_token",S.token);S.regToken=null;
    doBook();
  });
}
function doBook(){
  var payload={pickup:S.pickup,dropoff:S.dest,vehicleType:S.choice?S.choice.type:null};
  if($("chk-someone").checked){
    payload.recipientPhone=$("in-rphone").value.trim();
    payload.recipientName=$("in-rname").value.trim();
  }
  var b1=$("btn-book"),b2=$("btn-verify");
  b1.disabled=true;b2.disabled=true;b1.innerHTML='<span class="spin"></span>Booking…';
  api("/api/ridelink/book",{method:"POST",body:JSON.stringify(payload)}).then(function(r){
    b1.disabled=false;b2.disabled=false;b1.textContent="Book now · pay cash to driver";
    if(r.status===401){S.token=null;localStorage.removeItem("tv_link_token");show("s-verify");return}
    if(r.status===409&&r.body.shareToken){S.shareToken=r.body.shareToken;S.booked=true;startTracking();return}
    if(!r.ok){var t=(BOOT.mode==="book"&&!$("s-quote").classList.contains("hidden"))?"err-quote":"err-otp";err(t,r.body.message||"Booking failed — try again.");return}
    S.shareToken=r.body.shareToken;S.booked=true;
    if(r.body.recipientNotified){$("t-sent-note").textContent="We texted them the driver's details and this tracking link.";$("t-sent-note").classList.remove("hidden")}
    startTracking();
  });
}

/* ---------- tracking ---------- */
function startTracking(){
  show("s-track");
  if(S.booked){$("btn-cancel").classList.remove("hidden")}
  pollTrack();S.pollTimer=setInterval(pollTrack,5000);
  loadLeaflet();
}
function pillFor(st){
  if(st==="pending")return["st-pending","finding your driver…"];
  if(st==="accepted"||st==="arriving")return["st-live","driver on the way"];
  if(st==="started"||st==="in_progress")return["st-live","trip in progress"];
  if(st==="completed")return["st-done","trip completed"];
  if(st==="cancelled")return["st-cancelled","cancelled"];
  return["st-pending",st];
}
function pollTrack(){
  if(!S.shareToken)return;
  api("/api/ridelink/track/"+S.shareToken).then(function(r){
    if(!r.ok){err("err-track",r.body.message||"Tracking link not found.");clearInterval(S.pollTimer);return}
    var d=r.body,p=pillFor(d.status);
    $("t-pill").className="status-pill "+p[0];$("t-pill").textContent=p[1];
    $("t-from").textContent=d.pickupAddress;$("t-to").textContent=d.dropoffAddress;
    $("t-fare").textContent=d.currency+" "+d.fare.toFixed(2);
    if(d.otp){$("t-otp").textContent=d.otp;$("t-otp-card").classList.remove("hidden")}else{$("t-otp-card").classList.add("hidden")}
    if(d.driver){
      $("t-driver-card").classList.remove("hidden");
      $("t-driver-name").textContent=d.driver.name;
      $("t-avatar").textContent=(d.driver.name||"D").charAt(0).toUpperCase();
      $("t-driver-car").textContent=(d.driver.car||"")+(d.driver.rating?" · ★"+Number(d.driver.rating).toFixed(1):"");
      $("t-plate").textContent=d.driver.plate||"";
    }
    if(d.status==="completed"||d.status==="cancelled"){
      clearInterval(S.pollTimer);$("btn-cancel").classList.add("hidden");$("btn-again").classList.remove("hidden");
    }
    updateMap(d);
  });
}
function loadLeaflet(){
  if(S.leafletTried)return;S.leafletTried=true;
  var css=document.createElement("link");css.rel="stylesheet";css.href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";document.head.appendChild(css);
  var js=document.createElement("script");js.src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
  js.onload=function(){/* map initializes on next poll */};
  js.onerror=function(){$("map").style.display="none"};
  document.head.appendChild(js);
}
function updateMap(d){
  if(!window.L||!d.pickupLat)return;
  if(!S.map){
    S.map=L.map("map",{zoomControl:false,attributionControl:false}).setView([d.pickupLat,d.pickupLng],13);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",{maxZoom:19}).addTo(S.map);
    S.mPick=L.circleMarker([d.pickupLat,d.pickupLng],{radius:7,color:"#ffb020",fillColor:"#ffb020",fillOpacity:1}).addTo(S.map);
    S.mDrop=L.circleMarker([d.dropoffLat,d.dropoffLng],{radius:7,color:"#37d67a",fillColor:"#37d67a",fillOpacity:1}).addTo(S.map);
    S.map.fitBounds([[d.pickupLat,d.pickupLng],[d.dropoffLat,d.dropoffLng]],{padding:[30,30]});
  }
  if(d.driver&&d.driver.lat){
    if(!S.mDriver){S.mDriver=L.circleMarker([d.driver.lat,d.driver.lng],{radius:9,color:"#fff",weight:2,fillColor:"#e91916",fillOpacity:1}).addTo(S.map)}
    else{S.mDriver.setLatLng([d.driver.lat,d.driver.lng])}
  }
}
$("btn-cancel").onclick=function(){
  if(!confirm("Cancel this ride?"))return;
  api("/api/ridelink/cancel",{method:"POST",body:"{}"}).then(function(r){
    if(r.ok){pollTrack()}
  });
};
$("btn-again").onclick=function(){location.href="/ride"};

/* ---------- voice: talk to Travony (record → server STT/quote → TTS) ---------- */
var V={rec:null,stream:null,chunks:[],state:"idle",audio:null};
function micOk(){return !!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia&&window.MediaRecorder)}
function vSet(st,msg){
  V.state=st;var b=$("btn-voice");
  b.classList.toggle("v-rec",st==="rec");
  b.innerHTML=st==="rec"?"&#9632;":(st==="busy"?'<span class="spin"></span>':"&#127908;");
  var t=$("v-status");if(msg){t.textContent=msg;t.classList.remove("hidden")}else{t.classList.add("hidden")}
}
function vPending(){
  if(!$("s-quote").classList.contains("hidden"))return "quote";
  if(!$("s-track").classList.contains("hidden")&&S.booked)return "tracking";
  return null;
}
function vStart(){
  if(V.audio){try{V.audio.pause()}catch(e){}V.audio=null}
  navigator.mediaDevices.getUserMedia({audio:true}).then(function(st){
    V.chunks=[];V.stream=st;
    var mr;try{mr=new MediaRecorder(st,{mimeType:"audio/webm"})}catch(e){mr=new MediaRecorder(st)}
    V.rec=mr;
    mr.ondataavailable=function(e){if(e.data&&e.data.size)V.chunks.push(e.data)};
    mr.start();
    vSet("rec","Listening — speak any language, tap &#9632; when done".replace("&#9632;","\u25A0"));
  }).catch(function(){vSet("idle","Microphone blocked — type instead")});
}
function vStop(){
  var mr=V.rec;if(!mr)return;V.rec=null;
  mr.onstop=function(){
    try{V.stream.getTracks().forEach(function(t){t.stop()})}catch(e){}
    var blob=new Blob(V.chunks,{type:mr.mimeType||"audio/webm"});
    if(blob.size<300){vSet("idle","");return}
    var fr=new FileReader();
    fr.onloadend=function(){
      var b64=String(fr.result).split(",")[1];
      vSet("busy","Thinking…");
      api("/api/ridelink/voice-turn",{method:"POST",body:JSON.stringify({audio:b64,pickup:S.pickup,dest:S.dest,pending:vPending()})}).then(function(r){
        if(!r.ok){vSet("idle",(r.body&&r.body.message)||"Voice failed — try again");return}
        vApply(r.body);
      }).catch(function(){vSet("idle","Voice failed — try again")});
    };
    fr.readAsDataURL(blob);
  };
  mr.stop();
}
function vApply(d){
  var e=d.effect;
  if(e&&e.type==="route"){
    if(e.pickup){S.pickup=e.pickup;$("in-pickup").value=e.pickup.address}
    if(e.dest){S.dest=e.dest;$("in-dest").value=e.dest.address}
    updateQuoteBtn();
    if(e.quote&&e.quote.estimates&&e.quote.estimates.length){
      S.quote=e.quote;S.choice=e.quote.estimates[0];renderQuote();show("s-quote");
    }else if(!(S.pickup&&S.dest)){show("s-route")}
  }else if(e&&e.type==="book"){$("btn-book").onclick()}
  else if(e&&e.type==="back"){show("s-route")}
  else if(e&&e.type==="cancel"){$("btn-cancel").onclick()}
  if(d.audio){
    var a=new Audio("data:"+(d.audioMime||"audio/mpeg")+";base64,"+d.audio);
    V.audio=a;vSet("speak",d.speech||"");
    a.onended=function(){V.audio=null;vSet("idle","")};
    a.onerror=function(){V.audio=null;vSet("idle","")};
    a.play().catch(function(){V.audio=null;vSet("idle",d.speech||"")});
  }else{vSet("idle",d.speech||"")}
}
if(micOk()){
  $("btn-voice").classList.remove("hidden");
  $("btn-voice").onclick=function(){
    if(V.state==="rec"){vStop();return}
    if(V.state==="busy")return;
    vStart(); // idle starts; speak interrupts playback and starts listening
  };
}

/* ---------- boot ---------- */
(function(){
  if(BOOT.mode==="track"&&BOOT.token){S.shareToken=BOOT.token;startTracking();return}
  // Shared price link: /ride?pa=lat,lng,addr&pb=lat,lng,addr
  var qs=new URLSearchParams(location.search);
  var pa=qs.get("pa"),pb=qs.get("pb");
  if(pa&&pb){
    var A=pa.split(","),B=pb.split(",");
    if(A.length>=3&&B.length>=3){
      S.pickup={lat:parseFloat(A[0]),lng:parseFloat(A[1]),address:decodeURIComponent(A.slice(2).join(","))};
      S.dest={lat:parseFloat(B[0]),lng:parseFloat(B[1]),address:decodeURIComponent(B.slice(2).join(","))};
      $("in-pickup").value=S.pickup.address;$("in-dest").value=S.dest.address;
      updateQuoteBtn();getQuote();return;
    }
  }
  // Returning rider with an active trip? Resume tracking.
  if(S.token){
    api("/api/ridelink/active").then(function(r){
      if(r.ok&&r.body.ride&&r.body.ride.shareToken){S.shareToken=r.body.ride.shareToken;S.booked=true;startTracking()}
    });
  }
})();
</script>
</body>
</html>`;
}
