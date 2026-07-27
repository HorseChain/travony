/**
 * Safety Stream Share — lets a rider generate a short-lived public URL so a
 * trusted contact can watch the driver's live Agora stream in any browser,
 * no account or app install required.
 *
 * Token lifecycle: stored in memory, scoped to one ride + one live post.
 * Expires 24 h after creation OR when the ride ends (enforced at validation).
 * Server restart invalidates tokens — acceptable for a short-lived feature.
 */

import { Router } from "express";
import { randomBytes } from "crypto";
import { db } from "./db";
import { storage } from "./storage";
import { ridePosts, drivers, users } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { agoraEnabled } from "./agoraStreaming";
import { getTravonyBaseUrl } from "./telegramStreaming";
import agoraToken from "agora-token";

const { RtcTokenBuilder, RtcRole } = agoraToken;

export const streamShareRouter = Router();

// ---------------------------------------------------------------------------
// In-memory token store
// ---------------------------------------------------------------------------

interface ShareTokenData {
  rideId: string;
  postId: string;
  riderId: string;
  expiresAt: Date;
}
const shareTokenStore = new Map<string, ShareTokenData>();

// Prune expired tokens every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [tok, data] of shareTokenStore.entries()) {
    if (data.expiresAt.getTime() < now) shareTokenStore.delete(tok);
  }
}, 10 * 60 * 1000);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

const ACTIVE_STATUSES = ["accepted", "arriving", "started", "in_progress"];
const ENDED_STATUSES  = ["completed", "cancelled"];

// ---------------------------------------------------------------------------
// GET /api/rides/:id/stream
// Returns current live-stream status for a ride (auth required).
// Used by the rider app to decide whether to show the Share Live button.
// ---------------------------------------------------------------------------

streamShareRouter.get("/api/rides/:id/stream", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Authentication required" });

    const rideId = req.params.id;
    const ride   = await storage.getRide(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    const [post] = await db
      .select({ id: ridePosts.id, userId: ridePosts.userId })
      .from(ridePosts)
      .where(and(
        eq(ridePosts.rideId, rideId),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
      ))
      .limit(1);

    if (!post) return res.json({ isLive: false, postId: null });

    const host = await storage.getUser(post.userId);
    res.json({
      isLive:     true,
      postId:     post.id,
      hostName:   host?.name   || null,
      hostAvatar: host?.avatar || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/rides/:id/stream-share
// Creates (or returns existing) a stream-share token for the live ride.
// Caller must be the ride's customer (rider).
// ---------------------------------------------------------------------------

streamShareRouter.post("/api/rides/:id/stream-share", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Authentication required" });

    const rideId = req.params.id;
    const ride   = await storage.getRide(rideId);
    if (!ride) return res.status(404).json({ error: "Ride not found" });

    if (ride.customerId !== session.userId) {
      return res.status(403).json({ error: "Only the rider can share this ride" });
    }
    if (!ACTIVE_STATUSES.includes(ride.status)) {
      return res.status(400).json({ error: "The ride must be active to generate a share link" });
    }

    // Find the current live stream post
    const [post] = await db
      .select({ id: ridePosts.id })
      .from(ridePosts)
      .where(and(
        eq(ridePosts.rideId, rideId),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
      ))
      .limit(1);

    if (!post) {
      return res.status(404).json({
        error: "No live stream found for this ride. The driver must start streaming first.",
      });
    }

    // Reuse an unexpired token for the same ride if one exists
    let shareToken: string | null = null;
    for (const [tok, data] of shareTokenStore.entries()) {
      if (data.rideId === rideId && data.expiresAt.getTime() > Date.now()) {
        data.postId = post.id; // update in case stream was restarted
        shareToken  = tok;
        break;
      }
    }

    if (!shareToken) {
      shareToken = randomBytes(24).toString("hex");
      shareTokenStore.set(shareToken, {
        rideId,
        postId:    post.id,
        riderId:   session.userId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      });
    }

    const shareUrl = `${getTravonyBaseUrl()}/watch/${shareToken}`;
    res.json({ shareUrl, token: shareToken });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /api/stream-share/:token
// Public — validates the token and returns driver / stream metadata.
// Polled by the share page every 10 s to refresh driver location.
// ---------------------------------------------------------------------------

streamShareRouter.get("/api/stream-share/:token", async (req, res) => {
  try {
    const data = shareTokenStore.get(req.params.token);
    if (!data || data.expiresAt.getTime() < Date.now()) {
      return res.status(404).json({ error: "This share link has expired or is invalid" });
    }

    const ride = await storage.getRide(data.rideId);
    if (!ride || ENDED_STATUSES.includes(ride.status)) {
      return res.status(410).json({ error: "This ride has ended" });
    }

    // Verify the stream post is still live
    const [post] = await db
      .select({ id: ridePosts.id, endedAt: ridePosts.endedAt })
      .from(ridePosts)
      .where(eq(ridePosts.id, data.postId))
      .limit(1);

    if (!post || post.endedAt) {
      return res.status(410).json({ error: "The live stream has ended" });
    }

    // Driver info + last-known location (coarse — matches the rides table lat/lng)
    let driverName: string | null = null;
    let driverPhoto: string | null = null;
    let driverLat:   number | null = null;
    let driverLng:   number | null = null;

    if (ride.driverId) {
      const [row] = await db
        .select({
          name:       users.name,
          avatar:     users.avatar,
          currentLat: drivers.currentLat,
          currentLng: drivers.currentLng,
        })
        .from(drivers)
        .innerJoin(users, eq(users.id, drivers.userId))
        .where(eq(drivers.id, ride.driverId))
        .limit(1);

      if (row) {
        driverName  = row.name;
        // Only return https:// avatar URLs to the public endpoint — prevents
        // javascript:, data:, or protocol-relative URLs reaching the share page.
        driverPhoto = (row.avatar && row.avatar.startsWith("https://"))
          ? row.avatar
          : null;
        driverLat   = row.currentLat ? parseFloat(String(row.currentLat)) : null;
        driverLng   = row.currentLng ? parseFloat(String(row.currentLng)) : null;
      }
    }

    res.json({
      postId:     data.postId,
      rideId:     data.rideId,
      driverName,
      driverPhoto,
      driverLat,
      driverLng,
      isLive:     true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// POST /api/stream-share/:token/viewer-token
// Public — issues a short-TTL Agora SUBSCRIBER token for the share page.
// The share token acts as the credential; no Travony account needed.
// ---------------------------------------------------------------------------

const SHARE_VIEWER_TTL = 15 * 60; // 15 min; page re-fetches automatically

streamShareRouter.post("/api/stream-share/:token/viewer-token", async (req, res) => {
  try {
    const data = shareTokenStore.get(req.params.token);
    if (!data || data.expiresAt.getTime() < Date.now()) {
      return res.status(404).json({ error: "This share link has expired or is invalid" });
    }

    if (!agoraEnabled()) {
      return res.status(503).json({ error: "Streaming is not configured" });
    }

    const appId          = process.env.AGORA_APP_ID          || "";
    const appCertificate = process.env.AGORA_APP_CERTIFICATE || "";
    const channel = `stream:${data.postId}`;
    const uid     = `share-${randomBytes(6).toString("hex")}`;

    const rtcToken = RtcTokenBuilder.buildTokenWithUserAccount(
      appId,
      appCertificate,
      channel,
      uid,
      RtcRole.SUBSCRIBER,
      SHARE_VIEWER_TTL,
      SHARE_VIEWER_TTL,
    );

    res.json({
      appId,
      channel,
      uid,
      rtcToken,
      expiresAt: Math.floor(Date.now() / 1000) + SHARE_VIEWER_TTL,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /watch/:token  — server-rendered share viewer page
// Opens the Agora stream in-browser, shows driver info + live location link.
// No account or app install required.
// ---------------------------------------------------------------------------

streamShareRouter.get("/watch/:token", (req, res) => {
  const token = req.params.token;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Live Ride — Travony</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #0d1117; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    #root { display: flex; flex-direction: column; width: 100%; height: 100%; }

    /* ── Video layer ── */
    #video-container {
      position: relative; width: 100%; height: 100%;
      background: #0d1117; display: none;
    }
    #remote-video { width: 100%; height: 100%; }
    #remote-video video { width: 100%; height: 100%; object-fit: cover; }

    /* ── Overlay UI ── */
    #overlay {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      justify-content: space-between; pointer-events: none;
    }

    /* Top bar */
    #top-bar {
      padding: 20px 16px 32px;
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%);
      pointer-events: auto;
    }
    #driver-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: rgba(255,255,255,0.15);
      object-fit: cover; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 18px;
    }
    #driver-avatar img {
      width: 100%; height: 100%; border-radius: 50%; object-fit: cover;
    }
    .top-text { flex: 1; min-width: 0; }
    #host-name {
      font-size: 15px; font-weight: 700; color: #fff;
      text-shadow: 0 1px 4px rgba(0,0,0,0.9);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #ride-label {
      font-size: 11px; color: rgba(255,255,255,0.65); margin-top: 2px;
    }
    #live-badge {
      background: #e53e3e; color: #fff;
      font-size: 10px; font-weight: 800;
      padding: 3px 9px; border-radius: 4px;
      letter-spacing: 1.5px; flex-shrink: 0;
    }
    #viewer-count {
      font-size: 12px; color: rgba(255,255,255,0.8);
      display: flex; align-items: center; gap: 4px; flex-shrink: 0;
    }
    #viewer-count::before {
      content: ""; display: inline-block;
      width: 6px; height: 6px; border-radius: 50%; background: #00d4ff;
    }

    /* Bottom controls */
    #bottom-bar {
      padding: 20px 16px 28px;
      display: flex; align-items: center; justify-content: space-between;
      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
      pointer-events: auto;
    }
    #map-btn {
      display: flex; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.15); backdrop-filter: blur(6px);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 20px; padding: 8px 14px;
      color: #fff; text-decoration: none;
      font-size: 13px; font-weight: 600;
      transition: opacity .15s;
    }
    #map-btn:hover { opacity: .8; }
    #map-pin { font-size: 16px; }
    #powered-by {
      font-size: 11px; font-weight: 800;
      color: #00d4ff; letter-spacing: 2px;
    }

    /* Status / loading overlay */
    #status {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px; text-align: center; padding: 32px;
      background: #0d1117;
    }
    .spinner {
      width: 44px; height: 44px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #00d4ff;
      border-radius: 50%;
      animation: spin .75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status-text { font-size: 15px; color: rgba(255,255,255,0.75); line-height: 1.5; }
    #status-icon { font-size: 46px; }
    .logo { font-size: 11px; font-weight: 800; color: #00d4ff; letter-spacing: 2px; margin-top: 4px; }
    .sub  { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
  </style>
</head>
<body>
  <div id="root">
    <div id="video-container">
      <div id="remote-video"></div>
      <div id="overlay">
        <div id="top-bar">
          <div id="driver-avatar">👤</div>
          <div class="top-text">
            <div id="host-name">Connecting…</div>
            <div id="ride-label">Travony — Live ride</div>
          </div>
          <span id="live-badge">LIVE</span>
          <span id="viewer-count" id="viewer-count">0</span>
        </div>
        <div id="bottom-bar">
          <a id="map-btn" href="#" target="_blank" rel="noopener">
            <span id="map-pin">📍</span>
            <span id="map-label">Driver location</span>
          </a>
          <div id="powered-by">TRAVONY</div>
        </div>
      </div>
    </div>

    <div id="status">
      <div class="spinner" id="spinner"></div>
      <div id="status-text">Connecting to live stream…</div>
      <div class="logo">TRAVONY</div>
      <div class="sub">Share link — no sign-in required</div>
    </div>
  </div>

  <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
  <script>
    var SHARE_TOKEN = ${JSON.stringify(token)};
    var driverLat = null, driverLng = null;
    var tokenData = null;
    var agoraClient = null;
    var locationPollTimer = null;
    var viewerCountPollTimer = null;

    // ── UI helpers ────────────────────────────────────────────────────────────

    function showStatus(icon, text) {
      stopPolling();
      document.getElementById("video-container").style.display = "none";
      var s = document.getElementById("status");
      s.style.display = "flex";
      s.innerHTML =
        (icon ? '<div id="status-icon">' + icon + "</div>" : '<div class="spinner"></div>') +
        '<div id="status-text">' + text + "</div>" +
        '<div class="logo">TRAVONY</div>' +
        '<div class="sub">Share link — no sign-in required</div>';
    }

    function showVideo() {
      document.getElementById("status").style.display = "none";
      document.getElementById("video-container").style.display = "block";
    }

    function showEnded(reason) {
      stopPolling();
      showStatus("✅", reason || "The ride has ended — thanks for following along.");
    }

    // ── Driver info ───────────────────────────────────────────────────────────

    function applyDriverInfo(info) {
      // Name
      var nameEl = document.getElementById("host-name");
      if (nameEl && info.driverName) nameEl.textContent = info.driverName;

      // Avatar — use DOM API (never innerHTML) so a crafted URL can't inject script.
      if (info.driverPhoto) {
        var avatarEl = document.getElementById("driver-avatar");
        if (avatarEl) {
          var img = document.createElement("img");
          img.alt = "";
          img.src = info.driverPhoto; // safe: property assignment, not innerHTML
          avatarEl.textContent = "";  // clear the emoji fallback
          avatarEl.appendChild(img);
        }
      }

      // Map link
      if (info.driverLat && info.driverLng) {
        driverLat = info.driverLat;
        driverLng = info.driverLng;
        var mapBtn = document.getElementById("map-btn");
        if (mapBtn) {
          mapBtn.href = "https://maps.google.com/?q=" + driverLat + "," + driverLng;
          document.getElementById("map-label").textContent = "Open driver location";
        }
      }
    }

    // ── Polling ───────────────────────────────────────────────────────────────

    function stopPolling() {
      if (locationPollTimer)    { clearInterval(locationPollTimer);    locationPollTimer    = null; }
      if (viewerCountPollTimer) { clearInterval(viewerCountPollTimer); viewerCountPollTimer = null; }
    }

    function startLocationPolling() {
      locationPollTimer = setInterval(async function () {
        try {
          var r = await fetch("/api/stream-share/" + SHARE_TOKEN);
          if (r.status === 410 || r.status === 404) {
            showEnded("The ride has ended.");
            if (agoraClient) agoraClient.leave().catch(function(){});
            return;
          }
          if (r.ok) {
            var info = await r.json();
            if (!info.isLive) { showEnded("The live stream has ended."); return; }
            applyDriverInfo(info);
          }
        } catch (e) {}
      }, 10000);
    }

    function startViewerCountPolling(postId) {
      viewerCountPollTimer = setInterval(async function () {
        try {
          var r = await fetch("/api/tg-viewer-count?postId=" + encodeURIComponent(postId));
          if (r.ok) {
            var d = await r.json();
            var el = document.getElementById("viewer-count");
            if (el) el.textContent = d.count;
          }
        } catch (e) {}
      }, 12000);
    }

    // ── Main ──────────────────────────────────────────────────────────────────

    async function main() {
      if (!SHARE_TOKEN) { showStatus("🔗", "Invalid share link."); return; }

      // 1. Fetch stream metadata
      var info;
      try {
        var r1 = await fetch("/api/stream-share/" + SHARE_TOKEN);
        if (r1.status === 404) {
          showStatus("🔗", "This share link has expired or does not exist.");
          return;
        }
        if (r1.status === 410) { showEnded(); return; }
        if (!r1.ok) { showStatus("📡", "Could not load ride information."); return; }
        info = await r1.json();
      } catch (e) {
        showStatus("📡", "Could not connect. Please check your connection and try again.");
        return;
      }

      applyDriverInfo(info);

      // 2. Fetch Agora viewer token
      try {
        var r2 = await fetch("/api/stream-share/" + SHARE_TOKEN + "/viewer-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        if (!r2.ok) {
          var err = await r2.json().catch(function(){ return {}; });
          showStatus("📡", err.error || "Stream is not available right now.");
          return;
        }
        tokenData = await r2.json();
      } catch (e) {
        showStatus("📡", "Could not connect to stream. Please try again.");
        return;
      }

      // 3. Join Agora channel as audience
      agoraClient = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      agoraClient.setClientRole("audience");
      AgoraRTC.setLogLevel(4);

      agoraClient.on("user-published", async function(user, mediaType) {
        await agoraClient.subscribe(user, mediaType);
        if (mediaType === "video") {
          showVideo();
          user.videoTrack.play("remote-video");
          startLocationPolling();
          startViewerCountPolling(info.postId);
        }
        if (mediaType === "audio") {
          user.audioTrack && user.audioTrack.play();
        }
      });

      agoraClient.on("user-unpublished", function(_user, mediaType) {
        if (mediaType === "video") showEnded("The driver has stopped streaming.");
      });

      agoraClient.on("user-left", function() {
        showEnded("The driver has left the stream.");
      });

      try {
        await agoraClient.join(tokenData.appId, tokenData.channel, tokenData.rtcToken, tokenData.uid);
      } catch (e) {
        showStatus("📡", "Could not join stream. It may have already ended.");
      }
    }

    main();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
