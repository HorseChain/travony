import { Router } from "express";
import crypto from "crypto";
import { execFile } from "child_process";
import { promises as fs, existsSync } from "fs";
import path from "path";
import os from "os";
import OpenAI from "openai";
import { db } from "./db";
import { storage } from "./storage";
import { ridePosts, streamSignals, streamClips, cities, vehicles, drivers } from "@shared/schema";
import { eq, and, desc, isNull, sql, count } from "drizzle-orm";

// ---------------------------------------------------------------------------
// AI highlight clips — turns every ended Agora live stream into up to 3
// shareable 15–30s vertical clips.
//
// Design invariants:
// - Moment SELECTION is 100% deterministic (signal buckets: viewer deltas,
//   gift coin bursts, viewer "clip that" marks, duration segments as the
//   fallback). The LLM writes ONLY the title/caption — never picks moments,
//   never emits money or invented numbers (guarded below).
// - NOTHING goes public without the driver's explicit approval. Candidate
//   clips are visible only to the host; approval creates the feed post and
//   surfaces the clip on the car's public profile reel.
// - Location stays coarse: city name only (same rule as the social feed) —
//   no coordinates, no addresses anywhere in clip data or overlays.
// - Frames are buffered on local disk only while the stream is live and are
//   deleted after generation; the rendered clip is stored inline (base64
//   mp4) like every other media blob in this project.
// - This module must NOT import from agoraStreaming or socialRoutes
//   (agoraStreaming imports us — keep the dependency one-directional).
// ---------------------------------------------------------------------------

export const streamHighlightsRouter = Router();

const FRAMES_ROOT = path.join(os.tmpdir(), "travony-stream-frames");
const FRAME_MIN_INTERVAL_MS = 3500; // server-enforced per-post upload floor
const FRAME_MAX_PER_STREAM = 700; // ~70 min at 6 s cadence
const FRAME_MAX_CHARS = 900_000; // ~650 KB jpeg once base64-decoded
const CLIP_MARK_MIN_INTERVAL_MS = 8000; // per user per post
const CLIP_MARK_MAX_PER_STREAM = 500;
const MIN_STREAM_SEC = 45; // shorter streams get no clips
const MAX_CLIPS = 3;
const BUCKET_SEC = 10;
const TARGET_CLIP_SEC = 24; // inside the required 15–30 s envelope
const MAX_VIDEO_BYTES = 8 * 1024 * 1024;
const FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";

// ---------------------------------------------------------------------------
// Auth helpers (local copies — see module header for why no imports)
// ---------------------------------------------------------------------------

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

async function getWriteUser(req: any) {
  const session = await getSessionUser(req);
  if (!session) return null;
  const user = await storage.getUser(session.userId);
  if (!user || user.isGuest) return null;
  return user;
}

function baseUrl(): string {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0];
  if (domains) return `https://${domains}`;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return "https://travony.replit.app";
}

// ---------------------------------------------------------------------------
// Signal recording — called from agoraStreaming (viewer loop, gift hook) and
// the clip-mark endpoint below. Fire-and-forget, throttled in memory so the
// 4 s viewer loop can call it every tick without flooding the table.
// ---------------------------------------------------------------------------

const lastViewerSignal = new Map<string, { at: number; value: number }>();

export function recordStreamSignal(
  postId: string,
  kind: "viewer" | "gift" | "clip_mark",
  value: number,
  userId?: string | null,
): void {
  if (kind === "viewer") {
    const prev = lastViewerSignal.get(postId);
    const now = Date.now();
    // Only when the count changed, at most every 12 s.
    if (prev && (prev.value === value || now - prev.at < 12_000)) return;
    lastViewerSignal.set(postId, { at: now, value });
  }
  db.insert(streamSignals)
    .values({ postId, kind, value: Math.max(0, Math.round(value)), userId: userId ?? null })
    .then(() => {})
    .catch((err) => console.error("[Highlights] signal insert failed:", err?.message || err));
}

// ---------------------------------------------------------------------------
// Frame buffer — the broadcaster app uploads a low-res JPEG every ~6 s while
// live. Buffered on local disk only for the duration of the stream.
// ---------------------------------------------------------------------------

function framesDir(postId: string): string {
  // postId is validated as an existing uuid row before any write.
  return path.join(FRAMES_ROOT, postId.replace(/[^a-zA-Z0-9-]/g, ""));
}

const lastFrameAt = new Map<string, number>();
const frameCountCache = new Map<string, number>();

// Reads width/height straight out of the JPEG SOF segment without decoding
// any pixels — the cheap defense against decompression-bomb uploads (a tiny
// file declaring enormous dimensions would otherwise drive ffmpeg memory).
function jpegDimensions(buf: Buffer): { w: number; h: number } | null {
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const marker = buf[i + 1];
    if (marker === 0xff) { i++; continue; } // fill byte
    // Standalone markers carry no length field.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; }
    const len = buf.readUInt16BE(i + 2);
    if (len < 2) return null;
    // SOF0..SOF15 (minus DHT/JPG/DAC) hold the frame dimensions.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  return null;
}

streamHighlightsRouter.post("/api/agora/streams/:postId/frame", async (req, res) => {
  try {
    // Reject oversized payloads before doing any DB or decode work.
    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > FRAME_MAX_CHARS * 1.4) {
      return res.status(413).json({ error: "Frame too large" });
    }
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db
      .select({ id: ridePosts.id, userId: ridePosts.userId, type: ridePosts.type, provider: ridePosts.streamProvider, endedAt: ridePosts.endedAt })
      .from(ridePosts)
      .where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.provider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }
    if (post.userId !== user.id) return res.status(403).json({ error: "Not your stream" });
    if (post.endedAt) return res.status(409).json({ error: "Stream has ended" });

    const now = Date.now();
    const last = lastFrameAt.get(post.id) ?? 0;
    if (now - last < FRAME_MIN_INTERVAL_MS) return res.json({ ok: true, skipped: "throttled" });

    let b64 = String(req.body?.frame || "");
    const commaIdx = b64.indexOf(",");
    if (b64.startsWith("data:")) {
      if (!b64.startsWith("data:image/jpeg") && !b64.startsWith("data:image/jpg")) {
        return res.status(400).json({ error: "JPEG frames only" });
      }
      b64 = b64.slice(commaIdx + 1);
    }
    if (!b64 || b64.length > FRAME_MAX_CHARS) return res.status(400).json({ error: "Frame missing or too large" });

    const n = frameCountCache.get(post.id) ?? 0;
    if (n >= FRAME_MAX_PER_STREAM) return res.json({ ok: true, skipped: "buffer full" });

    const dir = framesDir(post.id);
    await fs.mkdir(dir, { recursive: true });
    const buf = Buffer.from(b64, "base64");
    // Cheap magic-byte check — a broken upload should never poison the render.
    if (buf.length < 1000 || buf[0] !== 0xff || buf[1] !== 0xd8) {
      return res.status(400).json({ error: "Not a valid JPEG" });
    }
    // Sanity-check declared dimensions before the file can ever reach ffmpeg.
    const dims = jpegDimensions(buf);
    if (!dims || dims.w < 16 || dims.h < 16 || dims.w > 4096 || dims.h > 4096) {
      return res.status(400).json({ error: "Unsupported frame dimensions" });
    }
    await fs.writeFile(path.join(dir, `${now}.jpg`), buf);
    lastFrameAt.set(post.id, now);
    frameCountCache.set(post.id, n + 1);
    res.json({ ok: true, frames: n + 1 });
  } catch (error: any) {
    console.error("[Highlights] frame upload error:", error?.message || error);
    res.status(500).json({ error: "Frame upload failed" });
  }
});

// ---------------------------------------------------------------------------
// "Clip that" — a viewer marks the current moment. Heavily weighted in the
// scorer. Rate-limited per user per stream.
// ---------------------------------------------------------------------------

const lastClipMark = new Map<string, number>(); // `${postId}:${userId}`

streamHighlightsRouter.post("/api/agora/streams/:postId/clip-mark", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db
      .select({ id: ridePosts.id, type: ridePosts.type, provider: ridePosts.streamProvider, endedAt: ridePosts.endedAt })
      .from(ridePosts)
      .where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.provider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }
    if (post.endedAt) return res.status(409).json({ error: "Stream has ended" });

    const key = `${post.id}:${user.id}`;
    const now = Date.now();
    if (now - (lastClipMark.get(key) ?? 0) < CLIP_MARK_MIN_INTERVAL_MS) {
      return res.json({ marked: true, throttled: true });
    }
    const [{ n }] = await db
      .select({ n: count() })
      .from(streamSignals)
      .where(and(eq(streamSignals.postId, post.id), eq(streamSignals.kind, "clip_mark")));
    if (Number(n) >= CLIP_MARK_MAX_PER_STREAM) return res.json({ marked: true });

    lastClipMark.set(key, now);
    recordStreamSignal(post.id, "clip_mark", 1, user.id);
    res.json({ marked: true });
  } catch (error: any) {
    console.error("[Highlights] clip-mark error:", error?.message || error);
    res.status(500).json({ error: "Could not mark the moment" });
  }
});

// ---------------------------------------------------------------------------
// Deterministic moment scoring
// ---------------------------------------------------------------------------

interface Candidate {
  startSec: number;
  durationSec: number;
  score: number;
  reasons: Record<string, number>;
}

export function scoreMoments(
  signals: { kind: string; value: number; ts: Date }[],
  streamStartMs: number,
  streamDurationSec: number,
): Candidate[] {
  const nBuckets = Math.max(1, Math.ceil(streamDurationSec / BUCKET_SEC));
  const viewerMax = new Array<number>(nBuckets).fill(0);
  const giftCoins = new Array<number>(nBuckets).fill(0);
  const clipMarks = new Array<number>(nBuckets).fill(0);

  for (const s of signals) {
    const offSec = (new Date(s.ts).getTime() - streamStartMs) / 1000;
    const b = Math.floor(offSec / BUCKET_SEC);
    if (b < 0 || b >= nBuckets) continue;
    if (s.kind === "viewer") viewerMax[b] = Math.max(viewerMax[b], s.value);
    else if (s.kind === "gift") giftCoins[b] += s.value;
    else if (s.kind === "clip_mark") clipMarks[b] += 1;
  }

  const scores: { b: number; score: number; reasons: Record<string, number> }[] = [];
  let prevViewers = 0;
  for (let b = 0; b < nBuckets; b++) {
    const v = viewerMax[b] || prevViewers; // carry level through silent buckets
    const delta = Math.max(0, v - prevViewers);
    prevViewers = v;
    const reasons: Record<string, number> = {};
    let score = 0;
    if (clipMarks[b] > 0) { reasons.clipMarks = clipMarks[b]; score += clipMarks[b] * 50; }
    if (giftCoins[b] > 0) { reasons.giftCoins = giftCoins[b]; score += Math.min(300, giftCoins[b] * 0.6); }
    if (delta > 0) { reasons.viewerSpike = delta; score += Math.min(150, delta * 15); }
    if (v > 0) { reasons.viewers = v; score += Math.min(40, v * 2); }
    if (score > 0) scores.push({ b, score, reasons });
  }

  // Fallback: no engagement signals at all → deterministic duration segments
  // (evenly spread through the stream) so long quiet scenic streams still
  // produce clips.
  if (scores.length === 0) {
    for (const frac of [0.3, 0.6, 0.85]) {
      const b = Math.min(nBuckets - 1, Math.floor((streamDurationSec * frac) / BUCKET_SEC));
      scores.push({ b, score: 1, reasons: { durationSegment: Math.round(frac * 100) } });
    }
  }

  scores.sort((a, z) => z.score - a.score || a.b - z.b);

  const picked: Candidate[] = [];
  for (const s of scores) {
    if (picked.length >= MAX_CLIPS) break;
    const start = Math.max(0, s.b * BUCKET_SEC - BUCKET_SEC); // lead-in before the peak
    const duration = Math.min(TARGET_CLIP_SEC, Math.max(15, streamDurationSec - start));
    if (duration < 15) continue;
    const end = start + duration;
    const overlaps = picked.some((p) => start < p.startSec + p.durationSec + 20 && p.startSec < end + 20);
    if (overlaps) continue;
    picked.push({ startSec: start, durationSec: duration, score: s.score, reasons: s.reasons });
  }
  return picked.sort((a, z) => z.score - a.score);
}

// ---------------------------------------------------------------------------
// Rendering — ffmpeg slideshow of buffered frames, 720x1280 vertical, with
// the Travony watermark, the car's public handle, and the booking hook.
// ---------------------------------------------------------------------------

function ff(args: string[], timeoutMs = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile("ffmpeg", args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, _out, stderr) => {
      if (err) reject(new Error(`ffmpeg failed: ${String(stderr).slice(-400)}`));
      else resolve();
    });
  });
}

function drawtextEscape(text: string): string {
  // Restrict to characters that need no drawtext escaping at all.
  return text.replace(/[^a-zA-Z0-9@ _.\-·]/g, "").slice(0, 48);
}

async function renderClip(opts: {
  framePaths: string[];
  outPath: string;
  handle: string;
  durationSec: number;
}): Promise<void> {
  const n = opts.framePaths.length;
  const per = Math.max(1.5, Math.min(5, opts.durationSec / n));
  const args: string[] = ["-y"];
  for (const f of opts.framePaths) args.push("-loop", "1", "-t", per.toFixed(2), "-i", f);

  const chains: string[] = [];
  const labels: string[] = [];
  for (let i = 0; i < n; i++) {
    chains.push(`[${i}:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,setsar=1,fps=24[v${i}]`);
    labels.push(`[v${i}]`);
  }
  let post = `${labels.join("")}concat=n=${n}:v=1:a=0[cat]`;
  const handleText = drawtextEscape(`@${opts.handle}`);
  const useFont = existsSync(FONT);
  if (useFont) {
    const dt = (text: string, size: number, y: string) =>
      `drawtext=fontfile=${FONT}:text='${text}':fontcolor=white:fontsize=${size}:x=40:y=${y}:box=1:boxcolor=black@0.4:boxborderw=14`;
    post += `;[cat]${dt("TRAVONY HIGHLIGHT", 26, "60")},${dt(handleText, 44, "h-250")},${dt("Book this car on Travony", 30, "h-160")}[out]`;
  } else {
    post += `;[cat]null[out]`;
  }
  chains.push(post);

  args.push(
    "-filter_complex", chains.join(";"),
    "-map", "[out]",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "30",
    "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an",
    opts.outPath,
  );
  await ff(args);
}

async function renderThumbnail(framePath: string, outPath: string): Promise<void> {
  await ff([
    "-y", "-i", framePath,
    "-vf", "scale=360:640:force_original_aspect_ratio=increase,crop=360:640",
    "-frames:v", "1", "-q:v", "7", outPath,
  ]);
}

// ---------------------------------------------------------------------------
// AI caption — the ONLY LLM-authored part. Deterministic fallback template;
// honesty guard rejects currency-adjacent output and anything that looks
// like an invented address.
// ---------------------------------------------------------------------------

let _openai: OpenAI | null = null;
let _openaiFailed = false;
function getOpenAI(): OpenAI | null {
  if (_openai) return _openai;
  if (_openaiFailed) return null;
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) { _openaiFailed = true; return null; }
  try {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
    return _openai;
  } catch { _openaiFailed = true; return null; }
}

function fallbackCaption(cityName: string | null, handle: string): { title: string; caption: string } {
  return {
    title: cityName ? `Live from ${cityName}` : "Highlights from a live ride",
    caption: `${cityName ? `Cruising through ${cityName}` : "Moments from a live Travony ride"} — the moments viewers loved. Book this car on Travony. #Travony #LiveRide`,
  };
}

async function generateCaption(facts: {
  cityName: string | null;
  handle: string;
  peakViewers: number;
  giftCount: number;
  clipMarks: number;
}): Promise<{ title: string; caption: string }> {
  const fallback = fallbackCaption(facts.cityName, facts.handle);
  const client = getOpenAI();
  if (!client) return fallback;
  try {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 160,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'You write short social captions for auto-generated highlight clips of live ride streams on Travony (a ride-hailing app). Reply as JSON {"title": string, "caption": string}. Title under 40 chars, caption under 160 chars with 1-2 tasteful hashtags. Use ONLY the facts given — never invent places, numbers, money, prices, or discounts. Never mention money or currency. Warm, energetic, TikTok-native tone.',
        },
        {
          role: "user",
          content: JSON.stringify({
            city: facts.cityName || undefined,
            carHandle: facts.handle,
            peakViewers: facts.peakViewers || undefined,
            giftsReceived: facts.giftCount || undefined,
            viewerClipRequests: facts.clipMarks || undefined,
          }),
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const title = String(parsed.title || "").trim().slice(0, 60);
    const caption = String(parsed.caption || "").trim().slice(0, 200);
    if (!title || !caption) return fallback;
    // Honesty guard: no currency, no street-level location leakage.
    if (/[$€£₹]|AED|USD|PKR|BDT|price|discount|% ?off|street|avenue|building/i.test(`${title} ${caption}`)) {
      return fallback;
    }
    return { title, caption };
  } catch (err: any) {
    console.error("[Highlights] caption LLM failed, using fallback:", err?.message || err);
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Coarse city label (local copy of the feed's rule: city name only, derived
// from the ride pickup against the cities table — never coordinates out).
// ---------------------------------------------------------------------------

async function coarseCityForRide(rideId: string | null): Promise<string | null> {
  if (!rideId) return null;
  const ride = await storage.getRide(rideId).catch(() => null);
  if (!ride) return null;
  const lat = parseFloat(String(ride.pickupLat));
  const lng = parseFloat(String(ride.pickupLng));
  if (isNaN(lat) || isNaN(lng)) return null;
  const rows = await db.select().from(cities);
  let best: string | null = null;
  let bestDist = Infinity;
  for (const c of rows) {
    const cLat = parseFloat(String(c.centerLat));
    const cLng = parseFloat(String(c.centerLng));
    const radius = parseFloat(String(c.radiusKm)) || 30;
    const dLat = ((cLat - lat) * Math.PI) / 180;
    const dLng = ((cLng - lng) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat * Math.PI) / 180) * Math.cos((cLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    const dist = 2 * 6371 * Math.asin(Math.sqrt(a));
    if (dist <= radius && dist < bestDist) { best = c.name; bestDist = dist; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Generation pipeline — fired (post-commit, fire-and-forget) when an Agora
// stream ends. Idempotent per stream.
// ---------------------------------------------------------------------------

const generating = new Set<string>();

export function scheduleHighlightGeneration(postId: string): void {
  if (generating.has(postId)) return;
  // Mark BEFORE the settle delay — the review screen starts polling the
  // instant the stream stops, and an unmarked gap would read as
  // "generating: false, clips: []" and end its polling prematurely.
  generating.add(postId);
  // Small delay lets the broadcaster's final frame upload land.
  setTimeout(() => {
    runGeneration(postId)
      .catch((err) =>
        console.error(`[Highlights] generation for ${postId} failed:`, err?.message || err),
      )
      .finally(() => generating.delete(postId));
  }, 3000);
}

export async function generateHighlightClips(postId: string): Promise<void> {
  if (generating.has(postId)) return;
  generating.add(postId);
  try {
    await runGeneration(postId);
  } finally {
    generating.delete(postId);
  }
}

async function runGeneration(postId: string): Promise<void> {
  const dir = framesDir(postId);
  try {
    const [post] = await db.select().from(ridePosts).where(eq(ridePosts.id, postId));
    if (!post || post.type !== "stream" || post.streamProvider !== "agora" || !post.endedAt) return;

    // Idempotent: one generation per stream, ever.
    const [{ n: existing }] = await db
      .select({ n: count() })
      .from(streamClips)
      .where(eq(streamClips.postId, postId));
    if (Number(existing) > 0) return;

    const streamStartMs = new Date(post.createdAt).getTime();
    const durationSec = (new Date(post.endedAt).getTime() - streamStartMs) / 1000;
    if (durationSec < MIN_STREAM_SEC) return;

    // Clips are car marketing — only driver-hosted streams.
    const driver = await storage.getDriverByUserId(post.userId);
    if (!driver) return;

    // Vehicle attribution must be exact: a clip in Vehicle A's public reel
    // watermarked with A's handle when the stream was Vehicle B's ride is a
    // profile-integrity bug. Binding order:
    //   1. the vehicle assigned to the streamed ride (authoritative),
    //   2. the driver's only vehicle (unambiguous),
    //   3. otherwise NO vehicle binding — the clip still goes through review
    //      and the feed, but never lands in any car reel, and the watermark
    //      carries the brand handle instead of a guessed car.
    let vehicle: any = null;
    if (post.rideId) {
      const ride = await storage.getRide(post.rideId).catch(() => undefined);
      if (ride?.vehicleId) {
        vehicle = await storage.getVehicle(ride.vehicleId).catch(() => undefined) || null;
      }
    }
    if (!vehicle) {
      const vehiclesList = await storage.getDriverVehicles(driver.id).catch(() => []);
      if (vehiclesList.length === 1) vehicle = vehiclesList[0];
    }
    const handle = vehicle
      ? vehicle.publicHandle ||
        `${String(vehicle.make || "car")}${String(vehicle.model || "")}`.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20)
      : "travony";

    // Frames buffered during the stream.
    let frameFiles: { ms: number; path: string }[] = [];
    try {
      const names = await fs.readdir(dir);
      frameFiles = names
        .filter((f) => f.endsWith(".jpg"))
        .map((f) => ({ ms: parseInt(f, 10), path: path.join(dir, f) }))
        .filter((f) => !isNaN(f.ms))
        .sort((a, z) => a.ms - z.ms);
    } catch { /* no frames dir */ }
    if (frameFiles.length < 4) {
      console.log(`[Highlights] stream ${postId}: only ${frameFiles.length} frames buffered — skipping`);
      return;
    }

    const signals = await db
      .select({ kind: streamSignals.kind, value: streamSignals.value, ts: streamSignals.ts })
      .from(streamSignals)
      .where(eq(streamSignals.postId, postId));

    const candidates = scoreMoments(signals, streamStartMs, durationSec).filter((c) => {
      const winStart = streamStartMs + (c.startSec - 5) * 1000;
      const winEnd = streamStartMs + (c.startSec + c.durationSec + 5) * 1000;
      return frameFiles.filter((f) => f.ms >= winStart && f.ms <= winEnd).length >= 3;
    });
    if (candidates.length === 0) {
      console.log(`[Highlights] stream ${postId}: no candidate windows with frame coverage`);
      return;
    }

    const cityName = post.cityName || (await coarseCityForRide(post.rideId));
    const totals = {
      peakViewers: Math.max(0, ...signals.filter((s) => s.kind === "viewer").map((s) => s.value)),
      giftCount: signals.filter((s) => s.kind === "gift").length,
      clipMarks: signals.filter((s) => s.kind === "clip_mark").length,
    };

    console.log(`[Highlights] stream ${postId}: rendering ${candidates.length} clip(s), ${frameFiles.length} frames, city=${cityName || "?"}`);

    const prepared = candidates.map((cand) => {
      const winStart = streamStartMs + (cand.startSec - 5) * 1000;
      const winEnd = streamStartMs + (cand.startSec + cand.durationSec + 5) * 1000;
      return {
        cand,
        winStart,
        winEnd,
        winFrames: frameFiles.filter((f) => f.ms >= winStart && f.ms <= winEnd).slice(0, 10),
      };
    });

    // Claim generation atomically: an advisory-locked transaction re-checks
    // that no other worker (restart, replica) has inserted clips for this
    // stream, then inserts ALL rows while still holding the lock. Whoever
    // loses the claim exits without rendering — no duplicate clips, ever.
    const rows = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`hl-gen:${postId}`}))`);
      const [{ n }] = await tx.select({ n: count() }).from(streamClips).where(eq(streamClips.postId, postId));
      if (Number(n) > 0) return null;
      const inserted: (typeof streamClips.$inferSelect)[] = [];
      for (const p of prepared) {
        const [row] = await tx
          .insert(streamClips)
          .values({
            postId,
            rideId: post.rideId,
            hostUserId: post.userId,
            vehicleId: vehicle ? vehicle.id : null,
            handle,
            startOffsetSec: Math.round(p.cand.startSec),
            durationSec: Math.round(p.cand.durationSec),
            score: p.cand.score.toFixed(2),
            reasons: p.cand.reasons,
            cityName,
            status: "rendering",
            frameCount: p.winFrames.length,
            peakViewers: totals.peakViewers,
            giftCoins: signals.filter((s) => s.kind === "gift" && new Date(s.ts).getTime() >= p.winStart && new Date(s.ts).getTime() <= p.winEnd).reduce((a, s) => a + s.value, 0),
            clipMarks: signals.filter((s) => s.kind === "clip_mark" && new Date(s.ts).getTime() >= p.winStart && new Date(s.ts).getTime() <= p.winEnd).length,
          })
          .returning();
        inserted.push(row);
      }
      return inserted;
    });
    if (!rows) {
      console.log(`[Highlights] stream ${postId}: another worker already generated — skipping`);
      return;
    }

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const { cand, winFrames } = prepared[idx];

      try {
        const outPath = path.join(os.tmpdir(), `travony-clip-${row.id}.mp4`);
        const thumbPath = path.join(os.tmpdir(), `travony-clip-${row.id}.jpg`);
        await renderClip({
          framePaths: winFrames.map((f) => f.path),
          outPath,
          handle,
          durationSec: cand.durationSec,
        });
        const stat = await fs.stat(outPath);
        if (stat.size > MAX_VIDEO_BYTES) throw new Error(`clip too large: ${stat.size} bytes`);
        await renderThumbnail(winFrames[Math.floor(winFrames.length / 2)].path, thumbPath);

        const [videoBuf, thumbBuf] = await Promise.all([fs.readFile(outPath), fs.readFile(thumbPath)]);
        const caption = await generateCaption({ cityName, handle, ...totals });

        await db
          .update(streamClips)
          .set({
            status: "ready",
            videoData: videoBuf.toString("base64"),
            thumbnailData: `data:image/jpeg;base64,${thumbBuf.toString("base64")}`,
            title: caption.title,
            caption: caption.caption,
          })
          .where(eq(streamClips.id, row.id));
        await Promise.all([fs.rm(outPath, { force: true }), fs.rm(thumbPath, { force: true })]);
      } catch (err: any) {
        console.error(`[Highlights] render failed for clip ${row.id}:`, err?.message || err);
        await db.update(streamClips).set({ status: "failed" }).where(eq(streamClips.id, row.id));
      }
    }
  } finally {
    lastFrameAt.delete(postId);
    frameCountCache.delete(postId);
    lastViewerSignal.delete(postId);
    fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Boot sweep: clear any frame buffers older than a day (crashed generations).
fs.readdir(FRAMES_ROOT)
  .then(async (names) => {
    for (const name of names) {
      const p = path.join(FRAMES_ROOT, name);
      const st = await fs.stat(p).catch(() => null);
      if (st && Date.now() - st.mtimeMs > 24 * 3600 * 1000) {
        await fs.rm(p, { recursive: true, force: true }).catch(() => {});
      }
    }
  })
  .catch(() => {});

// ---------------------------------------------------------------------------
// Driver review endpoints
// ---------------------------------------------------------------------------

const clipListColumns = {
  id: streamClips.id,
  postId: streamClips.postId,
  status: streamClips.status,
  title: streamClips.title,
  caption: streamClips.caption,
  cityName: streamClips.cityName,
  handle: streamClips.handle,
  vehicleId: streamClips.vehicleId,
  startOffsetSec: streamClips.startOffsetSec,
  durationSec: streamClips.durationSec,
  score: streamClips.score,
  reasons: streamClips.reasons,
  thumbnailData: streamClips.thumbnailData,
  peakViewers: streamClips.peakViewers,
  giftCoins: streamClips.giftCoins,
  clipMarks: streamClips.clipMarks,
  createdAt: streamClips.createdAt,
  approvedAt: streamClips.approvedAt,
};

streamHighlightsRouter.get("/api/streams/:postId/clips", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db
      .select({ id: ridePosts.id, userId: ridePosts.userId, endedAt: ridePosts.endedAt })
      .from(ridePosts)
      .where(eq(ridePosts.id, req.params.postId));
    if (!post) return res.status(404).json({ error: "Stream not found" });
    if (post.userId !== session.userId) return res.status(403).json({ error: "Not your stream" });

    const rows = await db
      .select(clipListColumns)
      .from(streamClips)
      .where(eq(streamClips.postId, post.id))
      .orderBy(desc(streamClips.score));
    res.json({
      generating: !post.endedAt || generating.has(post.id),
      // previewToken lets the (already-authenticated, host-only) caller play
      // unapproved clips in surfaces that can't send auth headers (WebView).
      clips: rows.map((c) => ({
        ...c,
        videoUrl: `/api/stream-clips/${c.id}/video`,
        previewToken: c.status === "ready" ? makePreviewToken(c.id) : null,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

async function requireOwnClip(req: any, res: any) {
  const session = await getSessionUser(req);
  if (!session) { res.status(401).json({ error: "Unauthorized" }); return null; }
  const [clip] = await db.select().from(streamClips).where(eq(streamClips.id, req.params.id));
  if (!clip) { res.status(404).json({ error: "Clip not found" }); return null; }
  if (clip.hostUserId !== session.userId) { res.status(403).json({ error: "Not your clip" }); return null; }
  return clip;
}

// Approve: the driver's explicit publish action. Creates the feed post and
// makes the clip visible on the car's public highlight reel.
streamHighlightsRouter.post("/api/stream-clips/:id/approve", async (req, res) => {
  try {
    const clip = await requireOwnClip(req, res);
    if (!clip) return;

    // Row-locked transaction: concurrent approves collapse to exactly one
    // feed post; approve racing a discard sees the final status and 409s.
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(streamClips).where(eq(streamClips.id, clip.id)).for("update");
      if (!row) return { error: 404 as const };
      if (row.status === "approved") return { feedPostId: row.feedPostId };
      if (row.status !== "ready") return { error: 409 as const };
      const [feedPost] = await tx
        .insert(ridePosts)
        .values({
          rideId: row.rideId,
          userId: row.hostUserId,
          type: "clip",
          streamProvider: "agora",
          caption: row.caption,
          photoUrl: row.thumbnailData,
          cityName: row.cityName,
          isLive: false,
        })
        .returning({ id: ridePosts.id });
      await tx
        .update(streamClips)
        .set({ status: "approved", approvedAt: new Date(), feedPostId: feedPost.id })
        .where(eq(streamClips.id, row.id));
      return { feedPostId: feedPost.id };
    });
    if ("error" in result) {
      return res
        .status(result.error === 409 ? 409 : 404)
        .json({ error: result.error === 409 ? "This clip can't be posted" : "Clip not found" });
    }
    res.json({ approved: true, feedPostId: result.feedPostId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

streamHighlightsRouter.post("/api/stream-clips/:id/discard", async (req, res) => {
  try {
    const clip = await requireOwnClip(req, res);
    if (!clip) return;

    // Row-locked transaction mirrors approve: the feed-post delete and the
    // status flip land together, and a racing approve can't resurrect it.
    const result = await db.transaction(async (tx) => {
      const [row] = await tx.select().from(streamClips).where(eq(streamClips.id, clip.id)).for("update");
      if (!row) return { error: 404 as const };
      if (row.status === "discarded") return { ok: true };
      if (row.status === "rendering") return { error: 409 as const };
      if (row.feedPostId) {
        await tx.delete(ridePosts).where(eq(ridePosts.id, row.feedPostId));
      }
      // Drop the heavy video payload too — a discarded clip is gone for good.
      await tx
        .update(streamClips)
        .set({ status: "discarded", videoData: null, feedPostId: null })
        .where(eq(streamClips.id, row.id));
      return { ok: true };
    });
    if ("error" in result) {
      return res
        .status(result.error === 409 ? 409 : 404)
        .json({ error: result.error === 409 ? "Still rendering — try again shortly" : "Clip not found" });
    }
    res.json({ discarded: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Video / thumbnail delivery. ONLY approved clips are publicly servable —
// approval is the driver's explicit publication consent. Before approval the
// host reviews via a short-lived HMAC preview token (`pt` query param) issued
// only to them by the host-only clip list; the WebView player and the <video>
// tag inside the preview page can't send auth headers, hence a token in the
// URL rather than a session check. Range support so <video> seeking works.
// ---------------------------------------------------------------------------

const PREVIEW_TOKEN_TTL_MS = 30 * 60 * 1000;

function makePreviewToken(clipId: string): string {
  const exp = Date.now() + PREVIEW_TOKEN_TTL_MS;
  const sig = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "travony-dev")
    .update(`clip-preview:${clipId}:${exp}`)
    .digest("hex");
  return `${exp}.${sig}`;
}

function verifyPreviewToken(clipId: string, token: unknown): boolean {
  if (typeof token !== "string") return false;
  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = crypto
    .createHmac("sha256", process.env.SESSION_SECRET || "travony-dev")
    .update(`clip-preview:${clipId}:${exp}`)
    .digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function loadServableClip(id: string, previewTok?: unknown) {
  const [clip] = await db.select().from(streamClips).where(eq(streamClips.id, id));
  if (!clip || !clip.videoData) return null;
  if (clip.status === "approved") return clip;
  // Unapproved footage stays private: a ready clip is servable only to the
  // holder of a valid, unexpired preview token (issued host-only).
  if (clip.status === "ready" && verifyPreviewToken(id, previewTok)) return clip;
  return null;
}

streamHighlightsRouter.get("/api/stream-clips/:id/video", async (req, res) => {
  try {
    const clip = await loadServableClip(req.params.id, req.query.pt);
    if (!clip) return res.status(404).json({ error: "Clip not found" });
    const buf = Buffer.from(clip.videoData!, "base64");
    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=3600");
    if (req.query.download !== undefined) {
      res.setHeader("Content-Disposition", `attachment; filename="travony-highlight-${clip.id.slice(0, 8)}.mp4"`);
    }
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(String(range));
      let start = m && m[1] ? parseInt(m[1], 10) : 0;
      let end = m && m[2] ? Math.min(parseInt(m[2], 10), buf.length - 1) : buf.length - 1;
      if (isNaN(start) || start > end || start >= buf.length) {
        res.setHeader("Content-Range", `bytes */${buf.length}`);
        return res.status(416).end();
      }
      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${buf.length}`);
      res.setHeader("Content-Length", end - start + 1);
      return res.end(buf.subarray(start, end + 1));
    }
    res.setHeader("Content-Length", buf.length);
    res.end(buf);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Public highlight reel for a car profile — APPROVED clips only.
// ---------------------------------------------------------------------------

streamHighlightsRouter.get("/api/cars/:vehicleId/clips", async (req, res) => {
  try {
    const rows = await db
      .select(clipListColumns)
      .from(streamClips)
      .where(and(eq(streamClips.vehicleId, req.params.vehicleId), eq(streamClips.status, "approved")))
      .orderBy(desc(streamClips.approvedAt))
      .limit(12);
    res.json({
      clips: rows.map((c) => ({
        id: c.id,
        title: c.title,
        caption: c.caption,
        cityName: c.cityName,
        handle: c.handle,
        durationSec: c.durationSec,
        thumbnailData: c.thumbnailData,
        videoUrl: `/api/stream-clips/${c.id}/video`,
        pageUrl: `/clip/${c.id}`,
        createdAt: c.approvedAt || c.createdAt,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve a feed post (type="clip") back to its clip for playback.
streamHighlightsRouter.get("/api/stream-clips/by-feed-post/:postId", async (req, res) => {
  try {
    const [clip] = await db
      .select(clipListColumns)
      .from(streamClips)
      .where(and(eq(streamClips.feedPostId, req.params.postId), eq(streamClips.status, "approved")));
    if (!clip) return res.status(404).json({ error: "Clip not found" });
    res.json({ ...clip, videoUrl: `/api/stream-clips/${clip.id}/video`, pageUrl: `/clip/${clip.id}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Public web page — the share/download surface (and the app's WebView
// player). Approved clips only, except the host's tokenized preview —
// same stance as the video endpoint.
// ---------------------------------------------------------------------------

streamHighlightsRouter.get("/clip/:id", async (req, res) => {
  try {
    const clip = await loadServableClip(req.params.id, req.query.pt);
    if (!clip) return res.status(404).send("This clip is no longer available.");
    const esc = (s: string | null) => String(s || "").replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[ch] as string));
    const title = esc(clip.title) || "Travony ride highlight";
    const caption = esc(clip.caption);
    const handle = esc(clip.handle);
    // Preview pages must thread the token through to the <video>/download
    // URLs — the browser fetches those separately, without the page's query.
    const pt = clip.status === "ready" && typeof req.query.pt === "string"
      ? `?pt=${encodeURIComponent(req.query.pt)}`
      : "";
    const videoUrl = `/api/stream-clips/${clip.id}/video${pt}`;
    const downloadUrl = `/api/stream-clips/${clip.id}/video${pt ? `${pt}&` : "?"}download`;
    const bookUrl = `${baseUrl()}/ride`;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Travony</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${caption}">
<meta property="og:type" content="video.other">
<meta property="og:video" content="${baseUrl()}${videoUrl}">
<style>
  body{margin:0;background:#0a0a12;color:#fff;font-family:system-ui,-apple-system,sans-serif;display:flex;flex-direction:column;align-items:center;min-height:100vh}
  .wrap{width:100%;max-width:420px;padding:16px;box-sizing:border-box}
  video{width:100%;aspect-ratio:9/16;border-radius:16px;background:#000;display:block}
  h1{font-size:18px;margin:14px 2px 4px}
  p{color:#b9b9c9;font-size:14px;margin:4px 2px 14px}
  .handle{color:#8f7bff;font-weight:700}
  .row{display:flex;gap:10px}
  a.btn{flex:1;text-align:center;text-decoration:none;padding:13px 0;border-radius:12px;font-weight:700;font-size:15px}
  .book{background:#6C4DF6;color:#fff}
  .dl{background:#1e1e2c;color:#fff}
</style></head><body>
<div class="wrap">
  <video src="${videoUrl}" controls autoplay muted loop playsinline></video>
  <h1>${title}</h1>
  <p><span class="handle">@${handle}</span>${clip.cityName ? ` · ${esc(clip.cityName)}` : ""}</p>
  ${caption ? `<p>${caption}</p>` : ""}
  <div class="row">
    <a class="btn book" href="${bookUrl}">Book this car</a>
    <a class="btn dl" href="${downloadUrl}" download>Download</a>
  </div>
</div>
</body></html>`);
  } catch (error: any) {
    res.status(500).send("Something went wrong.");
  }
});
