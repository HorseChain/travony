// Twitch Helix access via the Replit Twitch connector (see integration
// snippet — @replit/connectors-sdk proxy pattern). Never cache the connectors
// client: tokens expire and the SDK refreshes them per call.
import { ReplitConnectors } from "@replit/connectors-sdk";
import { resolveBaseUrl, buildHeaders } from "@replit/connectors-sdk/identity.js";

function getConnectors() {
  return new ReplitConnectors();
}

// Twitch Helix requires a Client-Id header alongside the OAuth token the
// proxy injects. The client id is a stable public identifier, so cache it;
// identity headers are rebuilt on every fetch (tokens are NOT cached).
let cachedClientId: string | null = null;

async function getClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;
  const base = resolveBaseUrl();
  const headers = await buildHeaders();
  const response = await fetch(
    `${base}/api/v2/connection?connector_names=twitch&include_secrets=true`,
    { headers },
  );
  if (!response.ok) {
    throw new Error(`Twitch connection lookup failed (${response.status})`);
  }
  const body: any = await response.json();
  const item = (body.items || body || [])[0];
  const clientId = item?.settings?.oauth?.credentials?.client_id;
  if (!clientId) throw new Error("Twitch connection has no client id");
  cachedClientId = String(clientId);
  return cachedClientId;
}

async function helix(path: string): Promise<Response> {
  const clientId = await getClientId();
  return getConnectors().proxy("twitch", path, {
    method: "GET",
    headers: { "Client-Id": clientId },
  });
}

export interface TwitchChannelInfo {
  login: string;
  displayName: string;
}

// Validates a channel login against Twitch. Returns null when the channel
// does not exist (or the login is malformed).
export async function verifyTwitchChannel(login: string): Promise<TwitchChannelInfo | null> {
  const clean = String(login || "").trim().toLowerCase().replace(/^@/, "");
  if (!/^[a-z0-9_]{3,25}$/.test(clean)) return null;
  const response = await helix(`/helix/users?login=${encodeURIComponent(clean)}`);
  if (!response.ok) {
    throw new Error(`Twitch users lookup failed (${response.status})`);
  }
  const body: any = await response.json();
  const user = body?.data?.[0];
  if (!user) return null;
  return { login: user.login, displayName: user.display_name || user.login };
}

// Batched live-status lookup with a short cache so feed/live endpoints do not
// hammer Twitch. Key: sorted channel list; Twitch allows up to 100 logins.
const liveCache = new Map<string, { at: number; live: Set<string> }>();
const LIVE_CACHE_MS = 45 * 1000;

export async function getLiveChannels(logins: string[]): Promise<Set<string>> {
  const clean = Array.from(
    new Set(logins.map((l) => String(l || "").trim().toLowerCase()).filter(Boolean)),
  ).sort();
  if (clean.length === 0) return new Set();

  const key = clean.join(",");
  const hit = liveCache.get(key);
  if (hit && Date.now() - hit.at < LIVE_CACHE_MS) return hit.live;

  const live = new Set<string>();
  for (let i = 0; i < clean.length; i += 100) {
    const batch = clean.slice(i, i + 100);
    const qs = batch.map((l) => `user_login=${encodeURIComponent(l)}`).join("&");
    const response = await helix(`/helix/streams?${qs}`);
    if (!response.ok) {
      throw new Error(`Twitch streams lookup failed (${response.status})`);
    }
    const body: any = await response.json();
    for (const s of body?.data || []) {
      if (s?.user_login) live.add(String(s.user_login).toLowerCase());
    }
  }

  liveCache.set(key, { at: Date.now(), live });
  // Keep the cache from growing unbounded across many distinct key sets.
  if (liveCache.size > 200) {
    const oldest = Array.from(liveCache.entries()).sort((a, b) => a[1].at - b[1].at)[0];
    if (oldest) liveCache.delete(oldest[0]);
  }
  return live;
}
