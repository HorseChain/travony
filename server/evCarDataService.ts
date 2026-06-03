// EV car-data integration (Smartcar) with a safe simulated fallback.
//
// When SMARTCAR_CLIENT_ID / SMARTCAR_CLIENT_SECRET are present we talk to the
// real Smartcar REST API. When they are not, we run in "simulated" mode so the
// whole EV experience still works end-to-end and flips to live automatically
// the moment the keys are added (read dynamically for secret hot-reload).

import type { EvCarConnection } from "@shared/schema";

const SMARTCAR_AUTH_BASE = "https://auth.smartcar.com/oauth/token";
const SMARTCAR_CONNECT_BASE = "https://connect.smartcar.com/oauth/authorize";
const SMARTCAR_API_BASE = "https://api.smartcar.com/v2.0";
const SMARTCAR_SCOPES = ["read_battery", "read_charge", "read_vehicle_info"];

// ---- credentials (read dynamically so added secrets take effect on hot-reload) ----
function getClientId() { return process.env.SMARTCAR_CLIENT_ID; }
function getClientSecret() { return process.env.SMARTCAR_CLIENT_SECRET; }

export function hasSmartcarCredentials(): boolean {
  return Boolean(getClientId() && getClientSecret());
}

export function getRedirectUri(): string {
  if (process.env.SMARTCAR_REDIRECT_URI) return process.env.SMARTCAR_REDIRECT_URI;
  const domain =
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.REPLIT_DOMAINS?.split(",")[0] ||
    "localhost:5000";
  return `https://${domain}/api/ev/connect/callback`;
}

export interface CarSnapshot {
  batteryPercent: number;
  rangeKm: number;
  isCharging: boolean;
  chargingState: string; // CHARGING | FULLY_CHARGED | NOT_CHARGING
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresInSec: number;
  externalVehicleId?: string;
}

// ---------------------------------------------------------------------------
// OAuth: authorize URL
// ---------------------------------------------------------------------------
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId() || "",
    redirect_uri: getRedirectUri(),
    scope: SMARTCAR_SCOPES.join(" "),
    state,
    mode: process.env.SMARTCAR_MODE || "live",
  });
  return `${SMARTCAR_CONNECT_BASE}?${params.toString()}`;
}

function basicAuthHeader(): string {
  const raw = `${getClientId()}:${getClientSecret()}`;
  return "Basic " + Buffer.from(raw).toString("base64");
}

// ---------------------------------------------------------------------------
// OAuth: exchange auth code -> tokens, then fetch the first vehicle id
// ---------------------------------------------------------------------------
export async function exchangeCode(code: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(),
  });
  const res = await fetch(SMARTCAR_AUTH_BASE, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Smartcar token exchange failed (${res.status}): ${text}`);
  }
  const json: any = await res.json();
  const tokens: TokenSet = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSec: json.expires_in ?? 7200,
  };
  try {
    tokens.externalVehicleId = await fetchFirstVehicleId(tokens.accessToken);
  } catch {
    // non-fatal; snapshot will retry resolution
  }
  return tokens;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(SMARTCAR_AUTH_BASE, {
    method: "POST",
    headers: {
      Authorization: basicAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Smartcar token refresh failed (${res.status}): ${text}`);
  }
  const json: any = await res.json();
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresInSec: json.expires_in ?? 7200,
  };
}

async function fetchFirstVehicleId(accessToken: string): Promise<string | undefined> {
  const res = await fetch(`${SMARTCAR_API_BASE}/vehicles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return undefined;
  const json: any = await res.json();
  return json?.vehicles?.[0];
}

async function smartcarGet(path: string, accessToken: string): Promise<any> {
  const res = await fetch(`${SMARTCAR_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "sc-unit-system": "metric",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err: any = new Error(`Smartcar GET ${path} failed (${res.status}): ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Fetch live battery + charge for a known vehicle id.
export async function fetchLiveSnapshot(
  accessToken: string,
  externalVehicleId: string,
): Promise<CarSnapshot> {
  let vehicleId = externalVehicleId;
  if (!vehicleId) {
    vehicleId = (await fetchFirstVehicleId(accessToken)) || "";
    if (!vehicleId) throw new Error("No Smartcar vehicle linked to this account");
  }
  const [battery, charge] = await Promise.all([
    smartcarGet(`/vehicles/${vehicleId}/battery`, accessToken),
    smartcarGet(`/vehicles/${vehicleId}/charge`, accessToken).catch(() => null),
  ]);
  const batteryPercent = Math.round((battery?.percentRemaining ?? 0) * 100);
  const rangeKm = Math.round((battery?.range ?? 0) * 10) / 10;
  const state: string = charge?.state || (charge?.isPluggedIn ? "CHARGING" : "NOT_CHARGING");
  const isCharging = state === "CHARGING";
  return { batteryPercent, rangeKm, isCharging, chargingState: state };
}

// ---------------------------------------------------------------------------
// Simulated mode: deterministic-but-evolving snapshot. Battery rises while
// charging based on elapsed time since the last snapshot, so the UI changes
// over time without any external service.
// ---------------------------------------------------------------------------
function seedFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function buildInitialSimulatedSnapshot(driverId: string): CarSnapshot {
  const seed = seedFromString(driverId);
  const batteryPercent = 30 + (seed % 25); // 30-54%
  const ratedRange = 350 + (seed % 120); // 350-469 km nominal
  const rangeKm = Math.round((ratedRange * batteryPercent) / 100);
  return { batteryPercent, rangeKm, isCharging: true, chargingState: "CHARGING" };
}

// Evolve a simulated snapshot forward in time.
export function evolveSimulatedSnapshot(
  conn: EvCarConnection,
  ratedRangeKm: number,
): CarSnapshot {
  const target = conn.targetChargePercent ?? 80;
  const prevPct = conn.batteryPercent ?? 40;
  const lastAt = conn.snapshotAt ? new Date(conn.snapshotAt).getTime() : Date.now();
  const minutesElapsed = Math.max(0, (Date.now() - lastAt) / 60000);

  let pct = prevPct;
  let isCharging = conn.isCharging ?? true;
  let state = conn.chargingState || "CHARGING";

  if (isCharging) {
    // ~1.2%/min simulated DC charging
    pct = Math.min(100, prevPct + minutesElapsed * 1.2);
    if (pct >= target) {
      // reached target -> stop, mark ready
      pct = Math.max(pct, target);
      isCharging = false;
      state = pct >= 100 ? "FULLY_CHARGED" : "NOT_CHARGING";
    }
  } else {
    // idle drains very slowly
    pct = Math.max(5, prevPct - minutesElapsed * 0.05);
    state = pct >= 100 ? "FULLY_CHARGED" : "NOT_CHARGING";
  }

  pct = Math.round(pct);
  const range = ratedRangeKm > 0 ? Math.round((ratedRangeKm * pct) / 100) : Math.round(3.5 * pct);
  return { batteryPercent: pct, rangeKm: range, isCharging, chargingState: state };
}

// ---------------------------------------------------------------------------
// Derived helpers (used by staging + time-to-ready, live or simulated)
// ---------------------------------------------------------------------------

// Minutes until the car reaches its target charge.
export function computeTimeToReadyMinutes(
  batteryPercent: number,
  targetPercent: number,
  capacityKwh: number | null | undefined,
  isCharging: boolean,
): number {
  if (batteryPercent >= targetPercent) return 0;
  const deltaPct = targetPercent - batteryPercent;
  if (capacityKwh && capacityKwh > 0) {
    const energyNeededKwh = (capacityKwh * deltaPct) / 100;
    const assumedChargePowerKw = 50; // moderate public DC charger
    const minutes = (energyNeededKwh / assumedChargePowerKw) * 60;
    return Math.max(1, Math.round(minutes));
  }
  // No capacity known: assume ~0.6 min per percent (0->100 ~= 60 min)
  return Math.max(1, Math.round(deltaPct * 0.6));
}

// Auto staging derivation from a snapshot. Only ever returns charging/ready;
// "departing" stays a manual driver choice.
export function deriveStaging(
  snapshot: CarSnapshot,
  targetPercent: number,
): "charging" | "ready" {
  if (snapshot.isCharging && snapshot.batteryPercent < targetPercent) return "charging";
  return "ready";
}
