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
    const allowedHosts = new Set<string>();
    if (process.env.REPLIT_DEV_DOMAIN) allowedHosts.add(process.env.REPLIT_DEV_DOMAIN);
    (process.env.REPLIT_DOMAINS || "")
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean)
      .forEach((d) => allowedHosts.add(d));
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

  const state = signState({
    r: redirectUri,
    role,
    ts: Date.now(),
    n: randomBytes(8).toString("hex"),
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

googleAuthRouter.get("/api/auth/google/callback", async (req, res) => {
  const state = verifyState(String(req.query.state || ""));
  if (!state || !state.r || !isAllowedRedirect(state.r)) {
    return res.status(400).send("Sign-in session expired. Please go back to the app and try again.");
  }

  const bounce = (params: Record<string, string>) =>
    res.redirect(appendParams(state.r, params));

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
    return bounce({ gauth: "success", token, isNewUser: isNewUser ? "1" : "0" });
  } catch (error: any) {
    console.error("[googleAuth] callback error:", error?.message || error);
    return bounce({ gauth: "error", message: "Google sign-in failed. Please try again." });
  }
});
