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
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "./db";
import { goLiveRequests, ridePosts, users, drivers } from "@shared/schema";
import { getWriteUser, hostLastSeen, publishStreamEvent } from "./agoraStreaming";
import { sendTelegramMessage } from "./telegramBot";
import { sendSmsMessage } from "./twilioService";

export const goLiveRequestRouter = Router();

const REQUEST_TTL_MS = 30_000; // 30 seconds

// ---------------------------------------------------------------------------
// Helper — mark a request expired if its expiresAt has passed
// ---------------------------------------------------------------------------
async function expireIfStale(reqId: string) {
  const now = new Date();
  await db
    .update(goLiveRequests)
    .set({ status: "expired" })
    .where(
      and(
        eq(goLiveRequests.id, reqId),
        eq(goLiveRequests.status, "pending"),
        // expiresAt < now — handled by checking returned row below
      )
    );
}

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
      .select({ id: users.id, name: users.name, telegramChatId: users.telegramChatId, phone: users.phone })
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

    // Notify the driver immediately — Telegram first, SMS as fallback.
    // Fire-and-forget: never let notification errors block the API response.
    const riderName = user.name || "A rider";
    const notifMsg = `${riderName} wants you to go live — you have 30 seconds to accept. Open your T Driver app now.`;
    if (targetUser.telegramChatId) {
      sendTelegramMessage(targetUser.telegramChatId, notifMsg).catch((e) =>
        console.error("[GoLiveRequest] Telegram notify error:", e),
      );
    } else if (targetUser.phone && /^\+?\d{7,15}$/.test(targetUser.phone.trim().replace(/[\s-]/g, ""))) {
      sendSmsMessage(targetUser.phone, `Travony: ${notifMsg}`).catch((e) =>
        console.error("[GoLiveRequest] SMS notify error:", e),
      );
    }

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

    return res.json({ request });
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

    const [request] = await db
      .select()
      .from(goLiveRequests)
      .where(eq(goLiveRequests.id, req.params.id));
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.driverUserId !== user.id) return res.status(403).json({ error: "Not your request" });

    const now = new Date();
    if (request.status !== "pending") {
      return res.status(400).json({ error: `Request already ${request.status}` });
    }
    if (request.expiresAt < now) {
      await db.update(goLiveRequests).set({ status: "expired" }).where(eq(goLiveRequests.id, request.id));
      return res.status(400).json({ error: "Request has expired" });
    }

    // Create a standalone stream post (no rideId required)
    const [post] = await db
      .insert(ridePosts)
      .values({
        rideId: request.rideId ?? null,
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

    // Update request with accepted status + postId
    await db
      .update(goLiveRequests)
      .set({ status: "accepted", postId: post.id })
      .where(eq(goLiveRequests.id, request.id));

    return res.json({ post, postId: post.id });
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
