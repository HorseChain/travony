import { Router } from "express";
import { createHmac, randomBytes } from "crypto";
import { v4 as uuidv4 } from "uuid";
import { storage } from "./storage";

// Google sign-in via a plain server-side OAuth 2.0 web flow.
// The app opens /api/auth/google/start in a browser session; Google redirects
// back to /api/auth/google/callback on this server; we create (or find) the
// user, mint a session token and bounce back into the app deep link.

// Use the OAuth client secret as a stable HMAC key so the state signature
// survives server restarts and redeploys. Fall back to a random key only when
// the env var is missing (dev without credentials) — log a warning so the
// operator knows any cross-restart flows will break.
const STATE_SECRET_KEY: Buffer = process.env.GOOGLE_OAUTH_CLIENT_SECRET
  ? Buffer.from(process.env.GOOGLE_OAUTH_CLIENT_SECRET, "utf8")
  : (() => {
      console.warn(
        "[googleAuth] GOOGLE_OAUTH_CLIENT_SECRET not set — state secret is ephemeral and will break on restart",
      );
      return randomBytes(32);
    })();

const STATE_TTL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// Poll store — Android can't route a custom-scheme redirect back into the app
// without an EAS build that includes explicit intentFilters. As a fallback the
// client passes a poll_key before opening the browser; after OAuth completes
// the server parks the token here; the app polls /api/auth/google/poll until
// it gets the token (≤ 10 min TTL, single-use).
// ---------------------------------------------------------------------------
const pollStore = new Map<string, { token: string; expiresAt: Date }>();

// Sweep expired entries every 5 minutes so the map doesn't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of pollStore) {
    if (val.expiresAt.getTime() < now) pollStore.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function getBaseUrl(): string {
  // GOOGLE_CALLBACK_URL lets the operator pin the exact callback URL that is
  // registered in Google Cloud Console (Authorized redirect URIs).
  if (process.env.GOOGLE_CALLBACK_URL) {
    return process.env.GOOGLE_CALLBACK_URL.replace(/\/api\/auth\/google\/callback.*$/, "");
  }
  // Prefer REPLIT_DOMAINS (the user-facing production domains) over
  // REPLIT_DEV_DOMAIN (the internal preview/dev domain, which is also set
  // in production Cloud Run containers and must NOT be used for OAuth).
  const domain =
    process.env.REPLIT_DOMAINS?.split(",")[0] ||
    process.env.REPLIT_DEV_DOMAIN;
  return domain ? `https://${domain}` : "http://localhost:5000";
}

// Log the callback URL once at startup so it is visible in the deployment logs.
// The operator must add this exact URL to Google Cloud Console:
// APIs & Services → Credentials → OAuth 2.0 Client IDs → Authorized redirect URIs
setTimeout(() => {
  const callbackUrl = `${getBaseUrl()}/api/auth/google/callback`;
  console.log(`[googleAuth] OAuth callback URL: ${callbackUrl}`);
  console.log(`[googleAuth] Add this URL to Google Cloud Console → Authorized redirect URIs`);
}, 0);

function isConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  );
}

function signState(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET_KEY).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyState(state: string): any | null {
  const dot = state.lastIndexOf(".");
  if (dot < 0) return null;
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = createHmac("sha256", STATE_SECRET_KEY).update(body).digest("base64url");
  if (sig.length !== expected.length || sig !== expected) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.ts || Date.now() - payload.ts > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}

// Only allow the app's own deep links (Expo Go, dev client, production scheme)
// and https pages on this server's own domains — never an arbitrary URL.
function isAllowedRedirect(uri: string): boolean {
  if (/^(exp|exps|travony|travony-rider|travony-driver):\/\//i.test(uri)) return true;
  try {
    const parsed = new URL(uri);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    // SECURITY: only first-party hosts may receive the token-bearing redirect.
    // A broad *.replit.app / *.replit.dev wildcard would let ANY Replit-hosted
    // attacker site receive the victim's session token (open redirect).
    // Expo dev tunnel (*.expo.riker.replit.dev) is allowed in development only.
    if (
      process.env.NODE_ENV === "development" &&
      parsed.hostname.endsWith(".expo.riker.replit.dev")
    ) {
      return true;
    }
    const allowedHosts = new Set<string>(["travony.replit.app"]);
    if (process.env.REPLIT_DEV_DOMAIN) allowedHosts.add(process.env.REPLIT_DEV_DOMAIN);
    (process.env.REPLIT_DOMAINS || "")
      .split(",")
      .map((d: string) => d.trim())
      .filter(Boolean)
      .forEach((d: string) => allowedHosts.add(d));
    allowedHosts.add("localhost");
    allowedHosts.add("127.0.0.1");
    return allowedHosts.has(parsed.hostname);
  } catch {
    return false;
  }
}

function appendParams(uri: string, params: Record<string, string>): string {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return uri.includes("?") ? `${uri}&${qs}` : `${uri}?${qs}`;
}

// Minimal HTML escape for attribute/text values embedded in server-rendered HTML.
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Bounce back to the app. For custom-scheme URIs (travony://, exp://) we serve
// an HTML intermediate page.
//
// PRIMARY path (iOS + Android with new EAS build that includes intentFilters):
//   window.location.replace fires an Android Intent → OS routes to the app →
//   openAuthSessionAsync returns { type: 'success' }.
//
// FALLBACK path (Android without intentFilters — existing APKs):
//   window.location.replace fails silently (Chrome can't route the scheme).
//   The page shows a clear "You're signed in — close this tab" message.
//   The app polls /api/auth/google/poll?key=<pollKey> and logs in that way.
function bounceToApp(res: any, targetUrl: string, pollKey?: string) {
  const isCustomScheme = /^(exp|exps|travony|travony-rider|travony-driver):\/\//i.test(targetUrl);
  if (!isCustomScheme) {
    return res.redirect(targetUrl);
  }
  const safeUrl = escHtml(targetUrl);
  // SECURITY: JSON.stringify does not escape "<" — a URL containing "</script>"
  // would break out of the inline script block (XSS on the token-bearing page).
  const jsonUrl = JSON.stringify(targetUrl)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
  const appName = /^travony-driver:/i.test(targetUrl) ? "T Driver" : "T Ride";
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Signed in to Travony</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;
         min-height:100dvh;background:#0d1b0d;font-family:system-ui,sans-serif;
         color:#fff;gap:24px;padding:32px;text-align:center;}
    .check{font-size:56px;line-height:1;}
    .title{font-size:22px;font-weight:700;}
    .sub{font-size:15px;color:#8aad8a;line-height:1.6;}
    .btn{display:block;padding:18px 40px;background:#00B14F;color:#fff;
         font-size:18px;font-weight:700;border-radius:16px;text-decoration:none;
         box-shadow:0 4px 20px rgba(0,177,79,0.4);letter-spacing:0.3px;}
    .btn:active{opacity:0.85;}
    .note{font-size:13px;color:#4a7a4a;line-height:1.5;}
  </style>
  <script>
    var deepUrl = ${jsonUrl};
    var isAndroid = /Android/i.test(navigator.userAgent);

    if (!isAndroid) {
      // iOS / desktop: auto-redirect works cleanly — do it right away
      try { window.location.replace(deepUrl); } catch(e) {}
      setTimeout(function(){ window.location.href = deepUrl; }, 300);
    }
    // On Android we do NOT auto-redirect because the system banner ("Open in T Ride?")
    // confuses users — they dismiss it, close the tab, and never get logged in.
    // Instead we show our own prominent "Open T Ride" button immediately.
    // Tapping our button fires the Chrome intent directly, and openAuthSessionAsync
    // captures it as a 'success' URL — no banner confusion.

    function showDone() {
      var l = document.getElementById('loading');
      var d = document.getElementById('done');
      if (l) l.style.display = 'none';
      if (d) { d.style.display = 'flex'; d.style.flexDirection = 'column'; }
    }

    if (isAndroid) {
      // Show the button immediately — don't make Android users wait
      document.addEventListener('DOMContentLoaded', showDone);
    } else {
      // Non-Android: show button after 0.8 s (give auto-redirect a chance)
      setTimeout(showDone, 800);
    }
  </script>
</head>
<body>
  <div id="loading">
    <div class="check">✓</div>
    <div class="title">Signed in!</div>
    <div class="sub">Opening Travony…</div>
  </div>
  <div id="done" style="display:none;">
    <div class="check">✓</div>
    <div class="title">You're signed in!</div>
    <div class="sub">Tap the button to return to the app.</div>
    <a class="btn" href="${safeUrl}" id="openBtn">Open ${appName}</a>
    <div class="note">Don't close this tab — tap the button above first.</div>
  </div>
</body>
</html>`);
}

async function createSessionToken(userId: string, role: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await storage.createSession(token, userId, role, expiresAt);
  return token;
}

export const googleAuthRouter = Router();

googleAuthRouter.get("/api/auth/google/status", (_req, res) => {
  res.json({ configured: isConfigured() });
});

// ─── DEV-ONLY: inject a token into the poll store ────────────────────────────
// Used by automated tests to simulate a successful OAuth completion without
// needing real Google credentials.
// Blocked in production: the Replit start script sets NODE_ENV=development
// for the dev server; the production deploy runs without NODE_ENV set at all,
// so we gate on !== "development" (not === "production") to stay safe.
googleAuthRouter.post("/api/auth/google/_test/inject-poll", (req, res) => {
  if (process.env.NODE_ENV !== "development") {
    return res.status(404).json({ message: "Not found" });
  }
  const { key, token, ttlMs } = req.body as { key?: string; token?: string; ttlMs?: number };
  if (!key || !token) return res.status(400).json({ message: "key and token required" });
  const expiresAt = new Date(Date.now() + (ttlMs ?? 10 * 60 * 1000));
  pollStore.set(key, { token, expiresAt });
  res.json({ ok: true, key, expiresAt });
});

googleAuthRouter.get("/api/auth/google/start", (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      message: "Google sign-in is not set up yet. Please use your phone number instead.",
    });
  }

  const redirectUri = String(req.query.redirect_uri || "");
  if (!redirectUri || !isAllowedRedirect(redirectUri)) {
    return res.status(400).json({ message: "Invalid redirect URI" });
  }
  const role = req.query.role === "driver" ? "driver" : "customer";

  // poll_key is a client-generated random string; embedded in the signed state
  // so the callback can park the token for /poll to pick up (Android fallback).
  const pollKey = String(req.query.poll_key || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 64) || undefined;

  const state = signState({
    r: redirectUri,
    role,
    ts: Date.now(),
    n: randomBytes(8).toString("hex"),
    ...(pollKey ? { pk: pollKey } : {}),
  });

  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", process.env.GOOGLE_OAUTH_CLIENT_ID!);
  authUrl.searchParams.set("redirect_uri", `${getBaseUrl()}/api/auth/google/callback`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  res.redirect(authUrl.toString());
});

// Poll endpoint — client calls this after openAuthSessionAsync returns 'cancel'
// on Android (where custom-scheme routing needs a native rebuild). Single-use:
// the token is deleted from the store on the first successful poll.
googleAuthRouter.get("/api/auth/google/poll", (req, res) => {
  const key = String(req.query.key || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
  if (!key) return res.status(400).json({ ready: false, error: "missing key" });

  const entry = pollStore.get(key);
  if (!entry) return res.json({ ready: false });

  if (Date.now() > entry.expiresAt.getTime()) {
    pollStore.delete(key);
    return res.json({ ready: false, expired: true });
  }

  // Near-single-use: keep the entry alive for a short grace window (60s) after
  // the first read so a transient client network failure during /me validation
  // doesn't permanently consume the token. It expires on its own after that.
  const grace = Date.now() + 60 * 1000;
  if (entry.expiresAt.getTime() > grace) {
    entry.expiresAt = new Date(grace);
  }
  return res.json({ ready: true, token: entry.token });
});

googleAuthRouter.get("/api/auth/google/callback", async (req, res) => {
  const state = verifyState(String(req.query.state || ""));
  if (!state || !state.r || !isAllowedRedirect(state.r)) {
    return res.status(400).send("Sign-in session expired. Please go back to the app and try again.");
  }

  const bounce = (params: Record<string, string>) =>
    bounceToApp(res, appendParams(state.r, params), state.pk);

  if (req.query.error) {
    return bounce({ gauth: "error", message: "Google sign-in was cancelled." });
  }

  const code = String(req.query.code || "");
  if (!code) {
    return bounce({ gauth: "error", message: "Google did not return a sign-in code." });
  }

  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
        client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
        redirect_uri: `${getBaseUrl()}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenResp.ok) {
      const detail = await tokenResp.text();
      console.error("[googleAuth] token exchange failed:", tokenResp.status, detail.slice(0, 300));
      return bounce({ gauth: "error", message: "Could not complete Google sign-in. Please try again." });
    }
    const tokenData = (await tokenResp.json()) as { access_token?: string };
    if (!tokenData.access_token) {
      return bounce({ gauth: "error", message: "Could not complete Google sign-in. Please try again." });
    }

    const infoResp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (!infoResp.ok) {
      return bounce({ gauth: "error", message: "Could not read your Google profile. Please try again." });
    }
    const info = (await infoResp.json()) as {
      email?: string;
      email_verified?: boolean;
      name?: string;
      picture?: string;
    };
    if (!info.email) {
      return bounce({ gauth: "error", message: "Your Google account has no email address." });
    }
    if (info.email_verified === false) {
      return bounce({ gauth: "error", message: "Your Google email address is not verified." });
    }

    const email = info.email.toLowerCase();
    let user = await storage.getUserByEmail(email);
    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await storage.createUser({
        id: uuidv4(),
        email,
        name: info.name?.trim() || email.split("@")[0],
        avatar: info.picture || undefined,
        role: state.role === "driver" ? "driver" : "customer",
      } as any);
    }

    const token = await createSessionToken(user.id, user.role);

    // Park the token for the poll-based fallback (Android without intentFilters).
    if (state.pk) {
      pollStore.set(state.pk, {
        token,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });
      console.log(`[googleAuth] token parked for poll key ${state.pk.slice(0, 8)}…`);
    }

    return bounce({ gauth: "success", token, isNewUser: isNewUser ? "1" : "0" });
  } catch (error: any) {
    console.error("[googleAuth] callback error:", error?.message || error);
    return bounce({ gauth: "error", message: "Google sign-in failed. Please try again." });
  }
});
