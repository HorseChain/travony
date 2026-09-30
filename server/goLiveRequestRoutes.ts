/**
 * Go Live Requests — riders ask a driver to broadcast a public Agora stream.
 *
 * POST   /api/go-live-requests           rider sends a request
 * GET    /api/go-live-requests/incoming  driver polls for pending requests
 * GET    /api/go-live-requests/:id       rider polls status
 * PATCH  /api/go-live-requests/:id/accept   driver accepts
 * PATCH  /api/go-live-requests/:id/decline  driver declines
 * PATCH  /api/go-live-requests/:id/cancel   rider cancels
 */

import { Router } from "express";
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "./db";
import { goLiveRequests, ridePosts, users, drivers } from "@shared/schema";
import { getWriteUser } from "./agoraStreaming";
import { notifyUser } from "./notificationService";

export const goLiveRequestRouter = Router();

const REQUEST_TTL_MS = 60_000; // allow time for polling and a human response

// ---------------------------------------------------------------------------
// POST /api/go-live-requests  — rider sends a request to a driver
// ---------------------------------------------------------------------------
goLiveRequestRouter.post("/api/go-live-requests", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { driverUserId: rawDriverUserId, driverId, rideId } = req.body as {
      driverUserId?: string;
      driverId?: string; // drivers.id — looked up to find users.id
      rideId?: string;
    };

    // Resolve to a users.id — accept either driverUserId directly or driverId
    let driverUserId = rawDriverUserId ?? null;
    if (!driverUserId && driverId) {
      const [drv] = await db
        .select({ userId: drivers.userId })
        .from(drivers)
        .where(eq(drivers.id, driverId));
      driverUserId = drv?.userId ?? null;
    }
    if (!driverUserId) return res.status(400).json({ error: "driverUserId or driverId required" });

    // Verify target user exists — fetch contact fields needed for notification
    const [targetUser] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, driverUserId));
    if (!targetUser) return res.status(404).json({ error: "Driver not found" });

    // Enforce one pending request per (rider, driver) pair — cancel older ones
    const now = new Date();
    await db
      .update(goLiveRequests)
      .set({ status: "expired" })
      .where(
        and(
          eq(goLiveRequests.riderId, user.id),
          eq(goLiveRequests.driverUserId, driverUserId),
          eq(goLiveRequests.status, "pending"),
        )
      );

    const expiresAt = new Date(now.getTime() + REQUEST_TTL_MS);
    const [created] = await db
      .insert(goLiveRequests)
      .values({
        riderId: user.id,
        driverUserId,
        rideId: rideId ?? null,
        status: "pending",
        expiresAt,
      })
      .returning();

    // Store an in-app notification even when an external gateway is unavailable.
    // High urgency also tries the driver's enabled Telegram/SMS channels and
    // queues email as a fallback. Never block creating the request on delivery.
    const riderName = user.name || "A rider";
    const notifMsg = `${riderName} wants you to go live — you have 60 seconds to accept. Open your T Driver app now.`;
    notifyUser({
      userId: driverUserId,
      kind: "go_live_request",
      title: "Go Live Request",
      body: notifMsg,
      urgency: "high",
      data: { requestId: created.id },
      dedupeKey: `go-live-request-${created.id}`,
    }).catch((e) => console.error("[GoLiveRequest] notify error:", e));

    return res.json({ request: created });
  } catch (err: any) {
    console.error("[GoLiveRequest] POST error:", err);
    return res.status(500).json({ error: "Could not send go-live request" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/go-live-requests/incoming — driver polls for their pending requests
// ---------------------------------------------------------------------------
goLiveRequestRouter.get("/api/go-live-requests/incoming", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const now = new Date();

    // Expire only requests whose TTL has passed (expiresAt < now)
    await db
      .update(goLiveRequests)
      .set({ status: "expired" })
      .where(
        and(
          eq(goLiveRequests.driverUserId, user.id),
          eq(goLiveRequests.status, "pending"),
          lt(goLiveRequests.expiresAt, now),
        )
      );

    // Re-fetch non-expired pending
    const pending = await db
      .select()
      .from(goLiveRequests)
      .where(
        and(
          eq(goLiveRequests.driverUserId, user.id),
          eq(goLiveRequests.status, "pending"),
          gt(goLiveRequests.expiresAt, now),
        )
      );

    // For each pending request, enrich with rider display info
    const enriched = await Promise.all(
      pending.map(async (r) => {
        const [rider] = await db
          .select({ name: users.name, avatar: users.avatar })
          .from(users)
          .where(eq(users.id, r.riderId));
        return {
          ...r,
          riderName: rider?.name ?? "Someone",
          riderAvatar: rider?.avatar ?? null,
        };
      })
    );

    return res.json({ requests: enriched });
  } catch (err: any) {
    console.error("[GoLiveRequest] incoming error:", err);
    return res.status(500).json({ error: "Could not fetch requests" });
  }
});

// ---------------------------------------------------------------------------
// GET /api/go-live-requests/:id — rider polls the status of their request
// ---------------------------------------------------------------------------
goLiveRequestRouter.get("/api/go-live-requests/:id", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const [request] = await db
      .select()
      .from(goLiveRequests)
      .where(eq(goLiveRequests.id, req.params.id));
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.riderId !== user.id && request.driverUserId !== user.id) {
      return res.status(403).json({ error: "Not your request" });
    }

    // Auto-expire if past TTL
    const now = new Date();
    if (request.status === "pending" && request.expiresAt < now) {
      await db
        .update(goLiveRequests)
        .set({ status: "expired" })
        .where(eq(goLiveRequests.id, request.id));
      return res.json({ request: { ...request, status: "expired" } });
    }

    let streamReady = false;
    let streamEnded = false;
    if (request.postId) {
      let [post] = await db
        .select({ isLive: ridePosts.isLive, endedAt: ridePosts.endedAt, createdAt: ridePosts.createdAt })
        .from(ridePosts)
        .where(eq(ridePosts.id, request.postId));
      // An accepted request can outlive its driver app (including a back
      // gesture while waiting for a token). Don't show "Connecting" forever.
      // The conditional write cannot end a post that won the /ready race.
      const cutoff = new Date(Date.now() - 45_000);
      if (request.status === "accepted" && post && !post.isLive && !post.endedAt && post.createdAt < cutoff) {
        await db.update(ridePosts)
          .set({ isLive: false, endedAt: now })
          .where(and(
            eq(ridePosts.id, request.postId),
            eq(ridePosts.isLive, false),
            isNull(ridePosts.endedAt),
            lt(ridePosts.createdAt, cutoff),
          ));
        [post] = await db
          .select({ isLive: ridePosts.isLive, endedAt: ridePosts.endedAt, createdAt: ridePosts.createdAt })
          .from(ridePosts)
          .where(eq(ridePosts.id, request.postId));
      }
      streamReady = post?.isLive === true && !post.endedAt;
      streamEnded = !post || !!post.endedAt;
    }

    return res.json({ request: { ...request, streamReady, streamEnded } });
  } catch (err: any) {
    console.error("[GoLiveRequest] GET error:", err);
    return res.status(500).json({ error: "Could not fetch request" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/go-live-requests/:id/accept — driver accepts, creates stream post
// ---------------------------------------------------------------------------
goLiveRequestRouter.patch("/api/go-live-requests/:id/accept", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const now = new Date();
    const result = await db.transaction(async (tx) => {
      // Atomically claim a still-pending, still-valid request. Two accept taps
      // can no longer create two stream posts.
      const [claimed] = await tx
        .update(goLiveRequests)
        .set({ status: "accepted" })
        .where(and(
          eq(goLiveRequests.id, req.params.id),
          eq(goLiveRequests.driverUserId, user.id),
          eq(goLiveRequests.status, "pending"),
          gt(goLiveRequests.expiresAt, now),
        ))
        .returning();
      if (!claimed) return null;

      // The post remains private until the native broadcaster joins Agora and
      // calls /ready. Riders may see "driver connecting" but never a blank live
      // viewer caused by accepting before camera/token initialization.
      const [post] = await tx
        .insert(ridePosts)
        .values({
          rideId: claimed.rideId ?? null,
          userId: user.id,
          type: "stream",
          streamProvider: "agora",
          twitchChannel: (null as any),
          cityName: null,
          distanceKm: null,
          isLive: false,
          hostLastSeenAt: null,
        })
        .returning();

      await tx
        .update(goLiveRequests)
        .set({ postId: post.id })
        .where(eq(goLiveRequests.id, claimed.id));
      return post;
    });
    if (!result) {
      const [request] = await db
        .select()
        .from(goLiveRequests)
        .where(eq(goLiveRequests.id, req.params.id));
      if (!request) return res.status(404).json({ error: "Request not found" });
      if (request.driverUserId !== user.id) return res.status(403).json({ error: "Not your request" });
      if (request.expiresAt <= now) {
        await db
          .update(goLiveRequests)
          .set({ status: "expired" })
          .where(and(eq(goLiveRequests.id, request.id), eq(goLiveRequests.status, "pending")));
        return res.status(400).json({ error: "Request has expired" });
      }
      return res.status(409).json({ error: `Request already ${request.status}` });
    }

    return res.json({ post: result, postId: result.id });
  } catch (err: any) {
    console.error("[GoLiveRequest] accept error:", err);
    return res.status(500).json({ error: "Could not accept request" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/go-live-requests/:id/decline — driver declines
// ---------------------------------------------------------------------------
goLiveRequestRouter.patch("/api/go-live-requests/:id/decline", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const [request] = await db
      .select()
      .from(goLiveRequests)
      .where(eq(goLiveRequests.id, req.params.id));
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.driverUserId !== user.id) return res.status(403).json({ error: "Not your request" });
    if (request.status !== "pending") {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const [updated] = await db
      .update(goLiveRequests)
      .set({ status: "declined" })
      .where(eq(goLiveRequests.id, request.id))
      .returning();

    return res.json({ request: updated });
  } catch (err: any) {
    console.error("[GoLiveRequest] decline error:", err);
    return res.status(500).json({ error: "Could not decline request" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/go-live-requests/:id/cancel — rider cancels
// ---------------------------------------------------------------------------
goLiveRequestRouter.patch("/api/go-live-requests/:id/cancel", async (req, res) => {
  try {
    const user = await getWriteUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const [request] = await db
      .select()
      .from(goLiveRequests)
      .where(eq(goLiveRequests.id, req.params.id));
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.riderId !== user.id) return res.status(403).json({ error: "Not your request" });
    if (request.status !== "pending") {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }

    const [updated] = await db
      .update(goLiveRequests)
      .set({ status: "cancelled" })
      .where(eq(goLiveRequests.id, request.id))
      .returning();

    return res.json({ request: updated });
  } catch (err: any) {
    console.error("[GoLiveRequest] cancel error:", err);
    return res.status(500).json({ error: "Could not cancel request" });
  }
});
