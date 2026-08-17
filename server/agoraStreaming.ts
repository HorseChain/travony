import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "./db";
import { storage } from "./storage";
import { ridePosts, streamProducts, streamAdBusinesses, rides, users, drivers, tvFeatureEvents } from "@shared/schema";
import type { StreamAdBusiness } from "@shared/schema";
import { eq, and, isNull, sql } from "drizzle-orm";
import agoraToken from "agora-token";
import { recordStreamSignal, scheduleHighlightGeneration } from "./streamHighlights";
import { recordSafetyPulse, recordStreamDropIfMoving, clearSafetyMotionState } from "./rideSafety";

const { RtcTokenBuilder, RtcRole, RtmTokenBuilder } = agoraToken;

// ---------------------------------------------------------------------------
// Agora interactive travel streaming — native in-app live video (RTC) plus a
// realtime UI event bus (Signaling/RTM). This module is the ONLY place that
// publishes signaling events; clients can never publish money-adjacent events
// because they log into RTM under their own user id, while every event here is
// published under the reserved server identity. Clients drop gift/product
// events whose publisher is not SERVER_UID.
//
// Invariants:
// - All publishes are post-commit, fire-and-forget: errors are logged and
//   dropped, never retried into a second effect, never fail the request.
// - Payloads are display-only. No balances, no coin/diamond numbers.
// - Publisher (host) video role is granted server-side only to participants
//   of the ride being streamed. The client never chooses its own role.
// ---------------------------------------------------------------------------

export const agoraRouter = Router();

/** Reserved RTM identity for server-published events. Real users log in with
 * their (uuid) user id, which can never equal this value. */
export const AGORA_SERVER_UID = "travony-server";

const TOKEN_TTL_SECONDS = 60 * 60; // ~1h
const VIEWER_POLL_MS = 4000; // presence poll cadence
const VIEWER_PUBLISH_MIN_MS = 3000; // never publish viewer.count more often
const HOST_GRACE_MS = 90 * 1000; // host absent (no presence AND no heartbeat) this long → ended
const VIEWER_PRESENCE_TTL_MS = 45 * 1000; // snapshot/share polls count as presence this long

function agoraConfig() {
  const appId = process.env.AGORA_APP_ID || "";
  const appCertificate = process.env.AGORA_APP_CERTIFICATE || "";
  const customerKey = process.env.AGORA_CUSTOMER_KEY || "";
  const customerSecret = process.env.AGORA_CUSTOMER_SECRET || "";
  return { appId, appCertificate, customerKey, customerSecret };
}

export function agoraEnabled(): boolean {
  const c = agoraConfig();
  return !!(c.appId && c.appCertificate);
}

function restEnabled(): boolean {
  const c = agoraConfig();
  return !!(c.appId && c.customerKey && c.customerSecret);
}

function restAuthHeader(): string {
  const c = agoraConfig();
  return "Basic " + Buffer.from(`${c.customerKey}:${c.customerSecret}`).toString("base64");
}

export function channelForPost(postId: string): string {
  return `stream:${postId}`;
}

// ---------------------------------------------------------------------------
// Auth helpers (same conventions as socialRoutes)
// ---------------------------------------------------------------------------

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

export async function getWriteUser(req: any) {
  const session = await getSessionUser(req);
  if (!session) return null;
  const user = await storage.getUser(session.userId);
  if (!user || user.isGuest) return null;
  return user;
}

async function getRideParticipants(ride: { customerId: string; driverId: string | null }) {
  let driverUserId: string | null = null;
  if (ride.driverId) {
    const [drv] = await db
      .select({ userId: drivers.userId })
      .from(drivers)
      .where(eq(drivers.id, ride.driverId));
    driverUserId = drv?.userId || null;
  }
  return { customerId: ride.customerId, driverUserId };
}

// ---------------------------------------------------------------------------
// Event envelope + stateless signaling publish
// ---------------------------------------------------------------------------

export type StreamEventType =
  | "gift.sent"
  | "product.push"
  | "product.clear"
  | "viewer.count"
  | "stream.state";

// Per-channel monotonic sequence. Dense (+1) within a server process so
// clients can detect missed events as a gap; the first event after a restart
// reseeds from the clock, which clients see as a (harmless) gap and answer
// with a refetch instead of a replay.
const seqByChannel = new Map<string, number>();
function nextSeq(channel: string): number {
  const current = seqByChannel.get(channel);
  const next = current ? current + 1 : Date.now();
  seqByChannel.set(channel, next);
  return next;
}

/**
 * Publish one event envelope to a stream channel via Agora's Signaling REST
 * API. Strictly fire-and-forget: logs and drops on any failure. Never await
 * this from inside a transaction — call only after commit.
 */
export function publishStreamEvent(postId: string, type: StreamEventType, data: Record<string, any>): void {
  if (!restEnabled()) return;
  const channel = channelForPost(postId);
  const envelope = {
    v: 1,
    type,
    seq: nextSeq(channel),
    ts: Date.now(),
    from: AGORA_SERVER_UID,
    data,
  };
  const { appId } = agoraConfig();
  const url = `https://api.agora.io/dev/v2/project/${encodeURIComponent(appId)}/rtm/users/${encodeURIComponent(AGORA_SERVER_UID)}/channel_messages`;
  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: restAuthHeader() },
    body: JSON.stringify({ channel_name: channel, enable_historical_messaging: false, payload: JSON.stringify(envelope) }),
  })
    .then(async (r) => {
      if (!r.ok) {
        const body = await r.text().catch(() => "");
        console.error(`[Agora] publish ${type} -> ${channel} failed: ${r.status} ${body.slice(0, 200)}`);
      }
    })
    .catch((err) => {
      console.error(`[Agora] publish ${type} -> ${channel} error:`, err?.message || err);
    });
}

// ---------------------------------------------------------------------------
// Gift broadcast hook — called by rewardsRoutes AFTER the gift transaction
// commits. Display-only payload; a failure here can never touch balances.
// ---------------------------------------------------------------------------

export function broadcastGiftIfLiveStream(postId: string, gift: {
  giftId: string;
  giftKey: string;
  giftName: string;
  coins: number;
  senderId: string;
}): void {
  (async () => {
    const [post] = await db
      .select({ id: ridePosts.id, type: ridePosts.type, provider: ridePosts.streamProvider, endedAt: ridePosts.endedAt })
      .from(ridePosts)
      .where(eq(ridePosts.id, postId));
    if (!post || post.type !== "stream" || post.provider !== "agora" || post.endedAt) return;
    // Feed the highlight scorer — gift bursts are a strong "great moment" signal.
    recordStreamSignal(postId, "gift", gift.coins, gift.senderId);
    const sender = await storage.getUser(gift.senderId);
    publishStreamEvent(postId, "gift.sent", {
      giftId: gift.giftId,
      giftKey: gift.giftKey,
      giftName: gift.giftName,
      tier: gift.coins >= 500 ? "premium" : "small",
      senderName: sender?.name || "A rider",
      senderAvatar: sender?.avatar || null,
    });
  })().catch((err) => {
    console.error("[Agora] gift broadcast error:", err?.message || err);
  });
}

// ---------------------------------------------------------------------------
// Shop the Look catalog — curated server-side so hosts can't fabricate labels.
// Price labels are display strings only (no checkout in this scope).
// ---------------------------------------------------------------------------

const PRODUCT_CATALOG = [
  { key: "travony_cap", title: "Travony Falcon Cap", priceLabel: "AED 79", imageUrl: null },
  { key: "desert_scarf", title: "Desert Rose Scarf", priceLabel: "AED 129", imageUrl: null },
  { key: "oud_travel_kit", title: "Oud Travel Kit", priceLabel: "AED 249", imageUrl: null },
  { key: "karak_flask", title: "Karak Road Flask", priceLabel: "AED 59", imageUrl: null },
  { key: "dune_shades", title: "Dune Rider Shades", priceLabel: "AED 199", imageUrl: null },
  { key: "marina_tote", title: "Marina Tote", priceLabel: "AED 149", imageUrl: null },
] as const;

// ---------------------------------------------------------------------------
// Public app-id endpoint — lets the broadcaster initialize the Agora engine
// with the real appId before the user taps "Go Live" (no auth required;
// the Agora App ID is not a secret — security comes from tokens).
// ---------------------------------------------------------------------------
agoraRouter.get("/api/agora/app-id", (_req, res) => {
  res.json({ appId: process.env.AGORA_APP_ID || "" });
});

// ---------------------------------------------------------------------------
// Token endpoint — RTC + RTM tokens, role decided server-side only
// ---------------------------------------------------------------------------

agoraRouter.post("/api/agora/token", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!agoraEnabled()) {
      return res.status(503).json({ error: "In-app streaming is not configured yet" });
    }
    const ridePostId = String(req.body?.ridePostId || "");
    if (!ridePostId) return res.status(400).json({ error: "ridePostId required" });

    const [post] = await db.select().from(ridePosts).where(eq(ridePosts.id, ridePostId));
    if (!post || post.type !== "stream" || post.streamProvider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }

    // Publisher role for ride participants (normal streams) or the stream
    // owner when rideId is null (Telegram-originated streams). Everyone else
    // is always subscriber — the client never chooses.
    let role: "publisher" | "subscriber" = "subscriber";
    if (post.rideId) {
      const ride = await storage.getRide(post.rideId);
      if (ride) {
        const { customerId, driverUserId } = await getRideParticipants(ride);
        if (user.id === customerId || user.id === driverUserId) role = "publisher";
      }
    } else if (user.id === post.userId) {
      role = "publisher";
    }

    const { appId, appCertificate } = agoraConfig();
    const channel = channelForPost(post.id);
    const expire = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
    const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channel,
      user.id,
      role === "publisher" ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
      TOKEN_TTL_SECONDS,
      TOKEN_TTL_SECONDS,
    );
    const rtmToken = RtmTokenBuilder.buildToken(appId, appCertificate, user.id, TOKEN_TTL_SECONDS);

    res.json({
      appId,
      channel,
      uid: user.id,
      role,
      rtcToken,
      rtmToken,
      serverUid: AGORA_SERVER_UID,
      expiresAt: expire,
    });
  } catch (error: any) {
    console.error("[Agora] token error:", error);
    res.status(500).json({ error: "Could not issue stream token" });
  }
});

// ---------------------------------------------------------------------------
// PUBLIC web viewer token — lets the landing page play a live in-app stream
// in the browser. No auth on purpose (streaming is an explicitly public act,
// same stance as the public Twitch broadcast list), but strictly bounded:
// - SUBSCRIBER (audience) role only — never publisher, never RTM.
// - Only for currently-live Agora stream posts.
// - Short TTL and a throwaway guest uid, so the token is useless elsewhere.
// ---------------------------------------------------------------------------

const WEB_VIEWER_TTL_SECONDS = 15 * 60;

agoraRouter.post("/api/agora/web-viewer-token", async (req, res) => {
  try {
    if (!agoraEnabled()) {
      return res.status(503).json({ error: "In-app streaming is not configured yet" });
    }
    const postId = String(req.body?.postId || "");
    if (!postId) return res.status(400).json({ error: "postId required" });

    const [post] = await db
      .select({
        id: ridePosts.id,
        type: ridePosts.type,
        streamProvider: ridePosts.streamProvider,
        isLive: ridePosts.isLive,
        endedAt: ridePosts.endedAt,
      })
      .from(ridePosts)
      .where(eq(ridePosts.id, postId));
    if (!post || post.type !== "stream" || post.streamProvider !== "agora" || !post.isLive || post.endedAt) {
      return res.status(404).json({ error: "This stream is not live" });
    }

    const { appId, appCertificate } = agoraConfig();
    const channel = channelForPost(post.id);
    const uid = `web-${randomBytes(8).toString("hex")}`;
    const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.SUBSCRIBER,
      WEB_VIEWER_TTL_SECONDS,
      WEB_VIEWER_TTL_SECONDS,
    );

    res.json({
      appId,
      channel,
      uid,
      rtcToken,
      expiresAt: Math.floor(Date.now() / 1000) + WEB_VIEWER_TTL_SECONDS,
    });
  } catch (error: any) {
    console.error("[Agora] web viewer token error:", error);
    res.status(500).json({ error: "Could not issue viewer token" });
  }
});

// ---------------------------------------------------------------------------
// Stream lifecycle — start/stop an in-app Agora stream on a ride. Mirrors the
// Twitch flow but provider="agora" and no Twitch channel required.
// ---------------------------------------------------------------------------

const STREAMABLE_STATUSES = ["accepted", "arriving", "started", "in_progress"];

// ---------------------------------------------------------------------------
// Standalone stream start — no ride context (e.g. driver goes live via a
// rider's go-live request that was already accepted and has a postId,
// OR driver initiates without any active ride).
// ---------------------------------------------------------------------------
agoraRouter.post("/api/agora/streams/standalone/start", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!agoraEnabled()) {
      return res.status(503).json({ error: "In-app streaming is not configured yet" });
    }

    // Idempotent: return existing live standalone post if one exists
    const [existing] = await db
      .select()
      .from(ridePosts)
      .where(and(
        eq(ridePosts.userId, user.id),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.rideId),
        isNull(ridePosts.endedAt),
      ));
    if (existing) {
      hostLastSeen.set(existing.id, Date.now());
      return res.json({ post: existing });
    }

    const [post] = await db
      .insert(ridePosts)
      .values({
        rideId: null,
        userId: user.id,
        type: "stream",
        streamProvider: "agora",
        twitchChannel: (null as any),
        cityName: null,
        distanceKm: null,
        isLive: true,
        hostLastSeenAt: new Date(),
      })
      .returning();

    hostLastSeen.set(post.id, Date.now());
    publishStreamEvent(post.id, "stream.state", { state: "live", hostName: user.name });
    res.json({ post });
  } catch (error: any) {
    console.error("[Agora] standalone stream start error:", error);
    res.status(500).json({ error: "Could not start the stream" });
  }
});

agoraRouter.post("/api/agora/streams/:rideId/start", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (!agoraEnabled()) {
      return res.status(503).json({ error: "In-app streaming is not configured yet" });
    }
    const ride = await storage.getRide(req.params.rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });
    const { customerId, driverUserId } = await getRideParticipants(ride);
    if (user.id !== customerId && user.id !== driverUserId) {
      return res.status(403).json({ error: "Not your ride" });
    }
    if (!STREAMABLE_STATUSES.includes(ride.status)) {
      return res.status(400).json({ error: "You can only stream while the ride is happening" });
    }

    const [existing] = await db
      .select()
      .from(ridePosts)
      .where(and(
        eq(ridePosts.rideId, ride.id),
        eq(ridePosts.userId, user.id),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        isNull(ridePosts.endedAt),
      ));
    if (existing) {
      hostLastSeen.set(existing.id, Date.now()); // fresh grace window on rejoin
      return res.json({ post: existing });
    }

    const [post] = await db
      .insert(ridePosts)
      .values({
        rideId: ride.id,
        userId: user.id,
        type: "stream",
        streamProvider: "agora",
        twitchChannel: (null as any),
        cityName: null,
        distanceKm: ride.distance ?? null,
        isLive: true,
        hostLastSeenAt: new Date(),
      })
      .returning();

    hostLastSeen.set(post.id, Date.now());
    // Post-commit, fire-and-forget.
    publishStreamEvent(post.id, "stream.state", { state: "live", hostName: user.name });
    res.json({ post });
  } catch (error: any) {
    console.error("[Agora] stream start error:", error);
    res.status(500).json({ error: "Could not start the stream" });
  }
});

// ---------------------------------------------------------------------------
// Host heartbeat — the authoritative "I'm still broadcasting" signal.
// The broadcaster app POSTs this every ~15 s while live. It keeps the stream
// alive even when the Agora REST presence API is unavailable (no customer
// key/secret configured), which would otherwise make presence permanently
// stale and end every stream at the grace timeout.
// ---------------------------------------------------------------------------
agoraRouter.post("/api/agora/streams/:postId/heartbeat", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db
      .select({ id: ridePosts.id, userId: ridePosts.userId, type: ridePosts.type, provider: ridePosts.streamProvider, endedAt: ridePosts.endedAt, rideId: ridePosts.rideId, createdAt: ridePosts.createdAt })
      .from(ridePosts)
      .where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.provider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }
    if (post.userId !== user.id) return res.status(403).json({ error: "Not your stream" });
    if (post.endedAt) return res.json({ live: false });
    hostLastSeen.set(post.id, Date.now());
    // Safety layer: the broadcaster reports its GPS speed with each heartbeat;
    // the server derives deltas + motion state. Fire-and-forget.
    if (req.body?.speedKmh !== undefined) {
      recordSafetyPulse(post, req.body.speedKmh).catch(() => {});
    }
    // Durable liveness — survives server restarts and works across replicas.
    await db
      .update(ridePosts)
      .set({ hostLastSeenAt: new Date() })
      .where(and(eq(ridePosts.id, post.id), isNull(ridePosts.endedAt)));
    // Travony TV — is this stream currently the featured one on /tv?
    // (Direct table query, not an import from travonyTv, to avoid a module cycle.)
    let onTv = false;
    try {
      const [featured] = await db
        .select({ id: tvFeatureEvents.id })
        .from(tvFeatureEvents)
        .where(and(eq(tvFeatureEvents.postId, post.id), isNull(tvFeatureEvents.endedAt)))
        .limit(1);
      onTv = !!featured;
    } catch {}
    res.json({ live: true, viewerCount: getAgoraViewerCount(post.id), onTv });
  } catch (error: any) {
    console.error("[Agora] heartbeat error:", error?.message || error);
    res.status(500).json({ error: "Heartbeat failed" });
  }
});

/** End every live Agora stream attached to a ride. Called when the ride
 * completes or is cancelled so no ghost "live" cards outlive the trip. */
export async function endStreamsForRide(rideId: string): Promise<void> {
  const posts = await db
    .select({ id: ridePosts.id })
    .from(ridePosts)
    .where(and(
      eq(ridePosts.rideId, rideId),
      eq(ridePosts.type, "stream"),
      eq(ridePosts.streamProvider, "agora"),
      isNull(ridePosts.endedAt),
    ));
  for (const p of posts) {
    try {
      await endAgoraStream(p.id, "host_stopped");
    } catch (err: any) {
      console.error(`[Agora] end stream ${p.id} for ride ${rideId} failed:`, err?.message || err);
    }
  }
}

export async function endAgoraStream(
  postId: string,
  reason: "host_stopped" | "host_lost",
  /** For host_lost: only end if the durable heartbeat is still older than
   * this cutoff — makes the grace decision atomic against a concurrent
   * heartbeat (same process or another replica). */
  notSeenSince?: Date,
) {
  const conditions = [eq(ridePosts.id, postId), isNull(ridePosts.endedAt)];
  if (reason === "host_lost" && notSeenSince) {
    conditions.push(
      sql`(${ridePosts.hostLastSeenAt} IS NULL OR ${ridePosts.hostLastSeenAt} < ${notSeenSince})`,
    );
  }
  const [updated] = await db
    .update(ridePosts)
    .set({ endedAt: new Date(), isLive: false })
    .where(and(...conditions))
    .returning({ id: ridePosts.id, rideId: ridePosts.rideId, createdAt: ridePosts.createdAt });
  // Only clean up in-memory state when the stream actually ended — a
  // host_lost attempt beaten by a concurrent heartbeat must not erase the
  // fresh liveness data.
  if (!updated) return false;
  // Safety layer: a host that vanished mid-motion is a flagged moment; a
  // normal stop just clears the in-memory motion state. Awaited (with its own
  // error guard) so "stream ended" implies its safety events are persisted —
  // report generation gates on all streams being ended.
  if (reason === "host_lost") {
    try {
      await recordStreamDropIfMoving(updated);
    } catch (err: any) {
      console.error("[safety] stream-drop check failed:", err?.message || err);
    }
  } else {
    clearSafetyMotionState(postId);
  }
  hostLastSeen.delete(postId);
  lastViewerPublish.delete(postId);
  lastViewerCount.delete(postId);
  peakViewerCount.delete(postId);
  viewerPresence.delete(postId);
  // Clear any active product card, then announce the end. Post-commit only.
  try {
    await db
      .update(streamProducts)
      .set({ clearedAt: new Date() })
      .where(and(eq(streamProducts.postId, postId), isNull(streamProducts.clearedAt)));
  } catch (err: any) {
    console.error("[Agora] product clear on end failed:", err?.message || err);
  }
  publishStreamEvent(postId, "product.clear", {});
  publishStreamEvent(postId, "stream.state", { state: "ended", reason });
  // Post-end, fire-and-forget: turn the stream's buffered frames + engagement
  // signals into up to 3 highlight clips for the driver to review.
  scheduleHighlightGeneration(postId);
  return true;
}

agoraRouter.post("/api/agora/streams/:postId/stop", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db.select().from(ridePosts).where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.streamProvider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }
    if (post.userId !== user.id) return res.status(403).json({ error: "Not your stream" });
    await endAgoraStream(post.id, "host_stopped");
    res.json({ stopped: true });
  } catch (error: any) {
    console.error("[Agora] stream stop error:", error);
    res.status(500).json({ error: "Could not stop the stream" });
  }
});

// Lightweight stream snapshot — the React Query key clients invalidate when
// RTM seq-gap detection fires after a reconnect.
agoraRouter.get("/api/agora/streams/:postId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db.select().from(ridePosts).where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.streamProvider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }
    const [host] = await db
      .select({ name: users.name, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, post.userId));
    const [product] = await db
      .select()
      .from(streamProducts)
      .where(and(eq(streamProducts.postId, post.id), isNull(streamProducts.clearedAt)));
    // Snapshot polls double as viewer presence when REST presence is off.
    if (!post.endedAt && session.userId !== post.userId) {
      recordViewerPresence(post.id, session.userId);
    }
    res.json({
      id: post.id,
      isLive: !post.endedAt,
      hostId: post.userId,
      hostName: host?.name || null,
      hostAvatar: host?.avatar || null,
      viewerCount: getAgoraViewerCount(post.id),
      activeProduct: product
        ? {
            productId: product.id,
            productKey: product.productKey,
            title: product.title,
            imageUrl: product.imageUrl,
            priceLabel: product.priceLabel,
            ttlSeconds: product.ttlSeconds,
            pushedAt: product.createdAt,
          }
        : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Shop the Look — host-only feature/clear + fire-and-forget tap logging
// ---------------------------------------------------------------------------

agoraRouter.get("/api/agora/products/catalog", async (req, res) => {
  const session = await getSessionUser(req);
  if (!session) return res.status(401).json({ error: "Unauthorized" });
  res.json({ products: PRODUCT_CATALOG });
});

agoraRouter.post("/api/agora/streams/:postId/product", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db.select().from(ridePosts).where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.streamProvider !== "agora" || post.endedAt) {
      return res.status(404).json({ error: "Live stream not found" });
    }
    // Host-owns-stream + still a ride participant.
    if (post.userId !== user.id) return res.status(403).json({ error: "Only the host can feature products" });
    const ride = post.rideId ? await storage.getRide(post.rideId) : null;
    if (ride) {
      const { customerId, driverUserId } = await getRideParticipants(ride);
      if (user.id !== customerId && user.id !== driverUserId) {
        return res.status(403).json({ error: "Not your ride" });
      }
    }

    const item = PRODUCT_CATALOG.find((p) => p.key === req.body?.productKey);
    if (!item) return res.status(400).json({ error: "Unknown product" });
    const ttlSeconds = Math.min(120, Math.max(15, Number(req.body?.ttlSeconds) || 45));

    // One active card at a time — clear the previous inside the same commit.
    const product = await db.transaction(async (tx) => {
      await tx
        .update(streamProducts)
        .set({ clearedAt: new Date() })
        .where(and(eq(streamProducts.postId, post.id), isNull(streamProducts.clearedAt)));
      const [row] = await tx
        .insert(streamProducts)
        .values({
          postId: post.id,
          productKey: item.key,
          title: item.title,
          imageUrl: item.imageUrl,
          priceLabel: item.priceLabel,
          ttlSeconds,
        })
        .returning();
      return row;
    });

    // Post-commit broadcast; snapshot is entirely server-derived.
    publishStreamEvent(post.id, "product.push", {
      productId: product.id,
      productKey: product.productKey,
      title: product.title,
      imageUrl: product.imageUrl,
      priceLabel: product.priceLabel,
      ttlSeconds: product.ttlSeconds,
    });
    res.json({ product });
  } catch (error: any) {
    console.error("[Agora] product push error:", error);
    res.status(500).json({ error: "Could not feature the product" });
  }
});

agoraRouter.post("/api/agora/streams/:postId/product/clear", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    const [post] = await db.select().from(ridePosts).where(eq(ridePosts.id, req.params.postId));
    if (!post || post.type !== "stream" || post.streamProvider !== "agora") {
      return res.status(404).json({ error: "Stream not found" });
    }
    if (post.userId !== user.id) return res.status(403).json({ error: "Only the host can clear products" });
    await db
      .update(streamProducts)
      .set({ clearedAt: new Date() })
      .where(and(eq(streamProducts.postId, post.id), isNull(streamProducts.clearedAt)));
    publishStreamEvent(post.id, "product.clear", {});
    res.json({ cleared: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Tap-through logging — fire-and-forget from the client; always 204.
agoraRouter.post("/api/agora/products/:productId/tap", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });
    await db
      .update(streamProducts)
      .set({ tapCount: sql`${streamProducts.tapCount} + 1` })
      .where(eq(streamProducts.id, req.params.productId));
  } catch (error: any) {
    console.error("[Agora] tap log error:", error?.message || error);
  }
  res.status(204).end();
});

// ---------------------------------------------------------------------------
// Viewer-count loop + host grace timeout. Polls Agora's channel presence REST
// per live stream and publishes viewer.count coalesced to at most one message
// every few seconds — never per-join spam. If the host has been absent from
// the channel longer than the grace window (app backgrounded / connection
// died), the stream is marked ended.
// ---------------------------------------------------------------------------

export const hostLastSeen = new Map<string, number>(); // postId -> ms epoch
const lastViewerPublish = new Map<string, number>(); // postId -> ms epoch
const lastViewerCount = new Map<string, number>(); // postId -> last count
const peakViewerCount = new Map<string, number>(); // postId -> peak count

// Fallback viewer presence when the Agora REST presence API is unavailable:
// every snapshot poll (in-app viewer) or share-page poll registers the caller
// here with a short TTL. postId -> (viewerKey -> lastSeen ms).
const viewerPresence = new Map<string, Map<string, number>>();

/** Register a viewer sighting for presence-based viewer counting. */
export function recordViewerPresence(postId: string, viewerKey: string): void {
  let m = viewerPresence.get(postId);
  if (!m) {
    m = new Map();
    viewerPresence.set(postId, m);
  }
  m.set(viewerKey, Date.now());
}

/** Count distinct viewers seen within the presence TTL (prunes as it goes). */
function presenceViewerCount(postId: string): number {
  const m = viewerPresence.get(postId);
  if (!m) return 0;
  const cutoff = Date.now() - VIEWER_PRESENCE_TTL_MS;
  for (const [k, ts] of m) {
    if (ts < cutoff) m.delete(k);
  }
  if (m.size === 0) viewerPresence.delete(postId);
  return m.size;
}

// ---------------------------------------------------------------------------
// Hyper-local geo stream ads
// ---------------------------------------------------------------------------

/** Haversine distance between two lat/lng pairs in metres. */
function haversineMetres(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // Earth radius in metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Returns the highest-priority active ad business whose radius covers the
 * given coordinates, or null when no match exists.
 *
 * Loads all active, date-eligible businesses from the DB and filters in JS
 * via Haversine — acceptable because the admin-managed table is small.
 */
async function matchNearbyAd(lat: number, lng: number): Promise<StreamAdBusiness | null> {
  const now = new Date();
  const candidates = await db
    .select()
    .from(streamAdBusinesses)
    .where(eq(streamAdBusinesses.isActive, true));

  let best: StreamAdBusiness | null = null;
  for (const ad of candidates) {
    // Date-range gate (null = open-ended).
    if (ad.startsAt && now < ad.startsAt) continue;
    if (ad.endsAt   && now > ad.endsAt)   continue;

    const adLat = parseFloat(String(ad.lat));
    const adLng = parseFloat(String(ad.lng));
    const dist  = haversineMetres(lat, lng, adLat, adLng);
    if (dist > ad.radiusMetres) continue;

    // Prefer higher priority; tie-break by shorter distance.
    if (!best || ad.priority > best.priority) {
      best = ad;
    }
  }
  return best;
}

/**
 * Called from the viewer-count loop for each live Agora stream.
 * Reads the driver's current GPS position, runs `matchNearbyAd`, and
 * auto-pins or clears the ad product card as needed.
 *
 * Manual host pins (adBusinessId = null) are NEVER overwritten — the host's
 * choice always takes precedence until they clear it themselves.
 */
async function autoUpdateStreamAd(postId: string, rideId: string): Promise<void> {
  // Resolve driver's current location from the ride.
  const [driverLoc] = await db
    .select({ lat: drivers.currentLat, lng: drivers.currentLng })
    .from(rides)
    .innerJoin(drivers, eq(drivers.id, rides.driverId))
    .where(eq(rides.id, rideId))
    .limit(1);

  if (!driverLoc?.lat || !driverLoc?.lng) return;
  const driverLat = parseFloat(String(driverLoc.lat));
  const driverLng = parseFloat(String(driverLoc.lng));
  if (isNaN(driverLat) || isNaN(driverLng)) return;

  // Check the currently active product for this stream.
  const [currentProduct] = await db
    .select({ id: streamProducts.id, adBusinessId: streamProducts.adBusinessId })
    .from(streamProducts)
    .where(and(eq(streamProducts.postId, postId), isNull(streamProducts.clearedAt)));

  // Manual pin: adBusinessId is null → host chose this card; do not override.
  if (currentProduct && currentProduct.adBusinessId === null) return;

  const nearbyAd = await matchNearbyAd(driverLat, driverLng);
  const currentAdId = currentProduct?.adBusinessId ?? null;
  const newAdId     = nearbyAd?.id ?? null;

  // No change — skip (avoid redundant DB writes on every tick).
  if (currentAdId === newAdId) return;

  await db.transaction(async (tx) => {
    // Clear whatever is active (could be an ad product, or nothing).
    await tx
      .update(streamProducts)
      .set({ clearedAt: new Date() })
      .where(and(eq(streamProducts.postId, postId), isNull(streamProducts.clearedAt)));

    if (nearbyAd) {
      // Pin the newly matched ad as a product card.
      const [product] = await tx
        .insert(streamProducts)
        .values({
          postId,
          productKey:   "stream_ad",
          title:        nearbyAd.name,
          imageUrl:     nearbyAd.logoUrl,
          priceLabel:   nearbyAd.offerText,
          ttlSeconds:   7200, // long TTL — geo-engine manages lifecycle, not expiry
          adBusinessId: nearbyAd.id,
        })
        .returning();

      publishStreamEvent(postId, "product.push", {
        productId:   product.id,
        productKey:  product.productKey,
        title:       product.title,
        imageUrl:    product.imageUrl,
        priceLabel:  product.priceLabel,
        ttlSeconds:  product.ttlSeconds,
        isAd:        true,
        adBusinessId: nearbyAd.id,
      });
    } else {
      // Driver moved out of range — clear the ad card.
      publishStreamEvent(postId, "product.clear", {});
    }
  });
}

/** Last known viewer count for a live Agora stream. Uses the REST presence
 * count when available, otherwise the snapshot-poll presence fallback. */
export function getAgoraViewerCount(postId: string): number {
  const rest = lastViewerCount.get(postId);
  const presence = presenceViewerCount(postId);
  return Math.max(rest ?? 0, presence);
}

/** Peak viewer count observed for a stream since it started (0 when unknown). */
export function getPeakViewerCount(postId: string): number {
  return peakViewerCount.get(postId) ?? 0;
}

async function channelUsers(channel: string): Promise<string[] | null> {
  if (!restEnabled()) return null;
  const { appId } = agoraConfig();
  const url = `https://api.agora.io/dev/v1/channel/user/${encodeURIComponent(appId)}/${encodeURIComponent(channel)}`;
  try {
    const r = await fetch(url, { headers: { Authorization: restAuthHeader() } });
    if (!r.ok) return null;
    const body: any = await r.json().catch(() => null);
    const data = body?.data;
    if (!data) return null;
    // Broadcast-mode channels report hosts (broadcasters) and audience_total.
    const broadcasters: string[] = Array.isArray(data.broadcasters) ? data.broadcasters.map(String) : [];
    const audienceTotal = Number(data.audience_total ?? (Array.isArray(data.users) ? data.users.length : 0)) || 0;
    // Encode as [host uids..., synthetic audience markers] — callers only need
    // host presence + a total.
    return broadcasters.concat(new Array(audienceTotal).fill("audience"));
  } catch {
    return null;
  }
}

async function viewerLoopTick() {
  try {
    const live = await db
      .select({
        id: ridePosts.id,
        userId: ridePosts.userId,
        createdAt: ridePosts.createdAt,
        rideId: ridePosts.rideId,
        hostLastSeenAt: ridePosts.hostLastSeenAt,
      })
      .from(ridePosts)
      .where(and(
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        isNull(ridePosts.endedAt),
      ));
    if (live.length === 0) return;

    for (const post of live) {
      const channel = channelForPost(post.id);
      const members = await channelUsers(channel);
      const now = Date.now();

      if (members !== null) {
        const hostPresent = members.includes(post.userId);
        if (hostPresent) hostLastSeen.set(post.id, now);
        const count = Math.max(
          0,
          members.filter((m) => m !== post.userId).length,
          presenceViewerCount(post.id),
        );

        const lastAt = lastViewerPublish.get(post.id) ?? 0;
        const lastCount = lastViewerCount.get(post.id);
        const prevPeak = peakViewerCount.get(post.id) ?? 0;
        if (count > prevPeak) peakViewerCount.set(post.id, count);
        if (count !== lastCount && now - lastAt >= VIEWER_PUBLISH_MIN_MS) {
          lastViewerCount.set(post.id, count);
          lastViewerPublish.set(post.id, now);
          publishStreamEvent(post.id, "viewer.count", { count });
        }
      }

      // Highlight scorer timeline — works with or without REST presence
      // (getAgoraViewerCount falls back to snapshot-poll presence). Throttled
      // and deduped inside recordStreamSignal.
      recordStreamSignal(post.id, "viewer", getAgoraViewerCount(post.id));

      // Grace timeout. Liveness = freshest of (in-memory sighting, durable
      // DB heartbeat). Brand-new streams and post-restart streams get a full
      // window seeded from max(createdAt, loop boot) so a genuinely-live
      // stream isn't ended before its host's next heartbeat arrives.
      const memorySeen = hostLastSeen.get(post.id)
        ?? Math.max(new Date(post.createdAt).getTime(), viewerLoopBootedAt);
      if (!hostLastSeen.has(post.id)) hostLastSeen.set(post.id, memorySeen);
      const dbSeen = post.hostLastSeenAt ? new Date(post.hostLastSeenAt).getTime() : 0;
      const seen = Math.max(memorySeen, dbSeen);
      if (now - seen > HOST_GRACE_MS) {
        // Atomic: the end only lands if the durable heartbeat is still older
        // than the cutoff — a concurrent heartbeat wins and the stream lives.
        const cutoff = new Date(now - HOST_GRACE_MS);
        const ended = await endAgoraStream(post.id, "host_lost", cutoff);
        if (ended) {
          console.log(`[Agora] host absent > grace for stream ${post.id}, marked ended`);
          continue; // stream ended — skip geo-ad check
        }
      }

      // Geo-ad auto-pin: fire-and-forget so it never blocks the viewer loop.
      if (post.rideId) {
        autoUpdateStreamAd(post.id, post.rideId).catch((err: any) => {
          console.error("[Agora] geo-ad auto-pin error:", err?.message || err);
        });
      }
    }
  } catch (err: any) {
    console.error("[Agora] viewer loop error:", err?.message || err);
  }
}

let viewerLoopStarted = false;
let viewerLoopBootedAt = Date.now();
export function startAgoraViewerLoop() {
  if (viewerLoopStarted) return;
  viewerLoopStarted = true;
  viewerLoopBootedAt = Date.now();
  // One-time sweep: retire legacy non-Agora (Twitch-era) live rows so they
  // can never surface as permanent unplayable "live" cards — the Agora grace
  // loop only manages agora streams and would never end them.
  db.update(ridePosts)
    .set({ isLive: false, endedAt: new Date() })
    .where(and(
      eq(ridePosts.type, "stream"),
      isNull(ridePosts.endedAt),
      sql`${ridePosts.streamProvider} <> 'agora'`,
    ))
    .returning({ id: ridePosts.id })
    .then((rows) => {
      if (rows.length) console.log(`[Agora] retired ${rows.length} legacy non-agora live stream rows`);
    })
    .catch((err) => console.error("[Agora] legacy stream sweep failed:", err?.message || err));
  setInterval(() => {
    viewerLoopTick().catch(() => {});
  }, VIEWER_POLL_MS);
  console.log("[Agora] viewer-count / host-grace loop started");
}
