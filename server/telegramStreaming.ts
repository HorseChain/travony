import { Router } from "express";
import { db } from "./db";
import { ridePosts, users } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { endAgoraStream, getPeakViewerCount, getAgoraViewerCount } from "./agoraStreaming";

export const tgStreamRouter = Router();

export function getTravonyBaseUrl(): string {
  if (process.env.REPLIT_DOMAINS) {
    return `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return "https://travony.replit.app";
}

export interface LiveTelegramStream {
  postId: string;
  userId: string;
  driverName: string;
  startedAt: Date;
}

export async function getLiveTelegramStreams(): Promise<LiveTelegramStream[]> {
  const rows = await db
    .select({
      postId: ridePosts.id,
      userId: ridePosts.userId,
      driverName: users.name,
      startedAt: ridePosts.createdAt,
    })
    .from(ridePosts)
    .innerJoin(users, eq(ridePosts.userId, users.id))
    .where(
      and(
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
      ),
    );
  return rows.map((r) => ({
    postId: r.postId,
    userId: r.userId,
    driverName: r.driverName,
    startedAt: new Date(r.startedAt),
  }));
}

export async function getTelegramStreamPostId(userId: string): Promise<string | null> {
  const [post] = await db
    .select({ id: ridePosts.id })
    .from(ridePosts)
    .where(
      and(
        eq(ridePosts.userId, userId),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
      ),
    )
    .limit(1);
  return post?.id ?? null;
}

export async function startTelegramStream(
  userId: string,
  driverName: string,
): Promise<{ postId: string }> {
  const [post] = await db
    .insert(ridePosts)
    .values({
      userId,
      type: "stream",
      streamProvider: "agora",
      isLive: true,
      caption: `Telegram Live — ${driverName}`,
    })
    .returning({ id: ridePosts.id });
  return { postId: post.id };
}

export async function endTelegramStreamByUserId(
  userId: string,
): Promise<{ durationMinutes: number; peakViewers: number } | null> {
  const [post] = await db
    .select({ id: ridePosts.id, createdAt: ridePosts.createdAt })
    .from(ridePosts)
    .where(
      and(
        eq(ridePosts.userId, userId),
        eq(ridePosts.type, "stream"),
        eq(ridePosts.streamProvider, "agora"),
        eq(ridePosts.isLive, true),
        isNull(ridePosts.endedAt),
      ),
    )
    .limit(1);
  if (!post) return null;
  const peakViewers = getPeakViewerCount(post.id);
  await endAgoraStream(post.id, "host_stopped");
  const durationMinutes = Math.max(
    1,
    Math.round((Date.now() - new Date(post.createdAt).getTime()) / 60000),
  );
  return { durationMinutes, peakViewers };
}

tgStreamRouter.get("/api/tg-viewer-count", (req, res) => {
  const postId = String(req.query.postId || "");
  if (!postId) return res.status(400).json({ error: "postId required" });
  res.json({ count: getAgoraViewerCount(postId) });
});

tgStreamRouter.get("/tg-watch", (req, res) => {
  const postId = String(req.query.postId || "");
  const channelParam = String(req.query.channel || "");
  const driverName = String(req.query.name || "Travony Live");
  const safeName = driverName.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${safeName} &mdash; Travony Live</title>
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%; height: 100%; overflow: hidden;
      background: #0d1117; color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    }
    #root { display: flex; flex-direction: column; width: 100%; height: 100%; }
    #video-container { position: relative; width: 100%; height: 100%; background: #0d1117; display: none; }
    #remote-video { width: 100%; height: 100%; }
    #remote-video video { width: 100%; height: 100%; object-fit: cover; }
    #overlay {
      position: absolute; inset: 0; display: flex;
      flex-direction: column; justify-content: space-between;
      pointer-events: none;
    }
    #top-bar {
      padding: 20px 16px 40px;
      display: flex; align-items: center; gap: 8px;
      background: linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, transparent 100%);
    }
    #live-badge {
      background: #e53e3e; color: #fff;
      font-size: 11px; font-weight: 800;
      padding: 3px 9px; border-radius: 4px; letter-spacing: 1.5px;
      flex-shrink: 0;
    }
    #host-name {
      font-size: 15px; font-weight: 600; color: #fff;
      text-shadow: 0 1px 4px rgba(0,0,0,0.9);
      flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    #viewer-count {
      font-size: 12px; color: rgba(255,255,255,0.8);
      display: flex; align-items: center; gap: 4px; flex-shrink: 0;
    }
    #viewer-count::before { content: ""; display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #00d4ff; }
    #status {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 14px; text-align: center; padding: 32px;
    }
    .spinner {
      width: 44px; height: 44px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #00d4ff;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #status-text { font-size: 15px; color: rgba(255,255,255,0.75); line-height: 1.4; }
    #status-icon { font-size: 42px; }
    .logo { font-size: 12px; font-weight: 800; color: #00d4ff; letter-spacing: 2px; margin-top: 6px; }
  </style>
</head>
<body>
  <div id="root">
    <div id="video-container">
      <div id="remote-video"></div>
      <div id="overlay">
        <div id="top-bar">
          <span id="live-badge">LIVE</span>
          <span id="host-name">${safeName}</span>
          <span id="viewer-count" title="viewers">0</span>
        </div>
      </div>
    </div>
    <div id="status">
      <div class="spinner" id="spinner"></div>
      <div id="status-text">Connecting to live stream&hellip;</div>
      <div class="logo">TRAVONY</div>
    </div>
  </div>

  <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js"></script>
  <script>
    // postId takes precedence; channel param may be "stream:<postId>" (legacy compat)
    var POST_ID = ${JSON.stringify(postId)};
    var CHANNEL_PARAM = ${JSON.stringify(channelParam)};
    if (!POST_ID && CHANNEL_PARAM.startsWith("stream:")) {
      POST_ID = CHANNEL_PARAM.slice(7);
    }

    var viewerCountEl = document.getElementById("viewer-count");
    var countPollTimer = null;

    function updateViewerCount(n) {
      viewerCountEl.textContent = n;
    }

    function startCountPolling() {
      if (!POST_ID) return;
      countPollTimer = setInterval(async function() {
        try {
          var r = await fetch("/api/tg-viewer-count?postId=" + encodeURIComponent(POST_ID));
          if (r.ok) {
            var d = await r.json();
            updateViewerCount(d.count);
          }
        } catch (e) {}
      }, 10000);
    }

    function stopCountPolling() {
      if (countPollTimer) { clearInterval(countPollTimer); countPollTimer = null; }
    }

    function showStatus(icon, text) {
      var spinner = document.getElementById("spinner");
      if (spinner) spinner.style.display = "none";
      var s = document.getElementById("status");
      s.style.display = "flex";
      s.innerHTML =
        (icon ? '<div id="status-icon">' + icon + '</div>' : '<div class="spinner"></div>') +
        '<div id="status-text">' + text + '</div>' +
        '<div class="logo">TRAVONY</div>';
    }

    function showVideo() {
      document.getElementById("status").style.display = "none";
      document.getElementById("video-container").style.display = "block";
      startCountPolling();
    }

    function showEnded() {
      stopCountPolling();
      document.getElementById("video-container").style.display = "none";
      showStatus("&#10003;", "Stream has ended");
    }

    async function main() {
      if (!POST_ID) { showStatus("&#128225;", "No stream specified."); return; }

      var tokenData;
      try {
        var r = await fetch("/api/agora/web-viewer-token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ postId: POST_ID }),
        });
        if (!r.ok) {
          var err = await r.json().catch(function() { return {}; });
          showStatus("&#128225;", err.error || "Stream is not available right now.");
          return;
        }
        tokenData = await r.json();
      } catch (e) {
        showStatus("&#128225;", "Could not connect. Please try again.");
        return;
      }

      var client = AgoraRTC.createClient({ mode: "live", codec: "vp8" });
      client.setClientRole("audience");
      AgoraRTC.setLogLevel(4);

      client.on("user-published", async function(user, mediaType) {
        await client.subscribe(user, mediaType);
        if (mediaType === "video") {
          showVideo();
          user.videoTrack.play("remote-video");
        }
      });

      client.on("user-unpublished", function(_user, mediaType) {
        if (mediaType === "video") showEnded();
      });

      client.on("user-left", function() { showEnded(); });

      try {
        await client.join(tokenData.appId, tokenData.channel, tokenData.rtcToken, tokenData.uid);
      } catch (e) {
        showStatus("&#128225;", "Could not join stream. It may have ended.");
      }
    }

    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }

    main();
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});
