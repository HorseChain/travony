// Open Charge Map proxy: nearby public chargers for the driver map.
//
// Works keyless (OCM allows anonymous use, rate-limited). If
// OPENCHARGEMAP_API_KEY is set we send it for higher limits. Results are cached
// in-memory per rounded location/radius for a few minutes to stay well under
// rate limits and keep the map snappy.

const OCM_BASE = "https://api.openchargemap.io/v3/poi";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getApiKey() {
  return process.env.OPENCHARGEMAP_API_KEY || process.env.OPEN_CHARGE_MAP_API_KEY;
}

export interface PublicCharger {
  id: string;
  name: string;
  lat: number;
  lng: number;
  operator?: string;
  numberOfPoints?: number;
  connectorTypes: string[];
  maxPowerKw?: number;
  isOperational: boolean;
  distanceKm?: number;
  address?: string;
}

interface CacheEntry {
  at: number;
  data: PublicCharger[];
}

const cache = new Map<string, CacheEntry>();

function cacheKey(lat: number, lng: number, radiusKm: number, max: number): string {
  // round to ~1km grid so nearby requests share cache
  return `${lat.toFixed(2)}:${lng.toFixed(2)}:${radiusKm}:${max}`;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function mapPoi(poi: any, originLat: number, originLng: number): PublicCharger | null {
  const ai = poi?.AddressInfo;
  if (!ai || ai.Latitude == null || ai.Longitude == null) return null;
  const conns: any[] = poi?.Connections || [];
  const connectorTypes = Array.from(
    new Set(
      conns
        .map((c) => c?.ConnectionType?.Title)
        .filter((t: unknown): t is string => typeof t === "string"),
    ),
  );
  const maxPowerKw = conns.reduce(
    (m, c) => (typeof c?.PowerKW === "number" && c.PowerKW > m ? c.PowerKW : m),
    0,
  );
  const statusTitle: string | undefined = poi?.StatusType?.Title;
  const isOperational =
    poi?.StatusType?.IsOperational !== false &&
    statusTitle !== "Not Operational" &&
    statusTitle !== "Temporarily Unavailable";

  return {
    id: String(poi.ID),
    name: ai.Title || "Public Charger",
    lat: ai.Latitude,
    lng: ai.Longitude,
    operator: poi?.OperatorInfo?.Title || undefined,
    numberOfPoints: poi?.NumberOfPoints ?? undefined,
    connectorTypes,
    maxPowerKw: maxPowerKw > 0 ? maxPowerKw : undefined,
    isOperational,
    address: [ai.AddressLine1, ai.Town].filter(Boolean).join(", ") || undefined,
    distanceKm: Math.round(haversineKm(originLat, originLng, ai.Latitude, ai.Longitude) * 10) / 10,
  };
}

export interface ChargersResult {
  chargers: PublicCharger[];
  source: "live" | "cache" | "simulated" | "unavailable";
  keyed: boolean;
}

// Deterministic plausible chargers around a location, used when no OCM key is
// configured (OCM now blocks keyless requests). Flips to live data the moment
// OPENCHARGEMAP_API_KEY is added.
const SIM_OPERATORS = [
  { name: "DEWA EV Green Charger", connectors: ["Type 2 (Socket Only)", "CCS (Type 2)"], power: 60 },
  { name: "Tesla Supercharger", connectors: ["Tesla (Model S/X)", "CCS (Type 2)"], power: 150 },
  { name: "ADNOC E2GO", connectors: ["CCS (Type 2)", "CHAdeMO"], power: 120 },
  { name: "Mall Public Charger", connectors: ["Type 2 (Socket Only)"], power: 22 },
  { name: "Fast Charge Hub", connectors: ["CCS (Type 2)"], power: 50 },
  { name: "Community AC Charger", connectors: ["Type 2 (Socket Only)"], power: 11 },
];

function buildSimulatedChargers(
  lat: number,
  lng: number,
  radiusKm: number,
  maxResults: number,
): PublicCharger[] {
  const seed = Math.floor(Math.abs(lat * 1000) + Math.abs(lng * 1000));
  const count = Math.min(maxResults, 6);
  const out: PublicCharger[] = [];
  for (let i = 0; i < count; i++) {
    const op = SIM_OPERATORS[(seed + i) % SIM_OPERATORS.length];
    // spread within radius using a pseudo-random angle/distance
    const angle = ((seed + i * 47) % 360) * (Math.PI / 180);
    const dist = (((seed * (i + 1)) % 100) / 100) * radiusKm * 0.8 + 0.4;
    const dLat = (dist / 111) * Math.cos(angle);
    const dLng = (dist / (111 * Math.cos((lat * Math.PI) / 180))) * Math.sin(angle);
    const cLat = lat + dLat;
    const cLng = lng + dLng;
    out.push({
      id: `sim-${seed}-${i}`,
      name: op.name,
      lat: cLat,
      lng: cLng,
      operator: op.name,
      numberOfPoints: 2 + ((seed + i) % 6),
      connectorTypes: op.connectors,
      maxPowerKw: op.power,
      isOperational: (seed + i) % 7 !== 0,
      distanceKm: Math.round(haversineKm(lat, lng, cLat, cLng) * 10) / 10,
    });
  }
  return out.sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
}

export async function getNearbyChargers(
  lat: number,
  lng: number,
  radiusKm = 8,
  maxResults = 25,
): Promise<ChargersResult> {
  const apiKeyPresent = Boolean(getApiKey());

  // No key -> simulated fallback (OCM blocks keyless requests).
  if (!apiKeyPresent) {
    return { chargers: buildSimulatedChargers(lat, lng, radiusKm, maxResults), source: "simulated", keyed: false };
  }

  const key = cacheKey(lat, lng, radiusKm, maxResults);
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { chargers: cached.data, source: "cache", keyed: true };
  }

  const params = new URLSearchParams({
    output: "json",
    latitude: String(lat),
    longitude: String(lng),
    distance: String(radiusKm),
    distanceunit: "KM",
    maxresults: String(maxResults),
    compact: "true",
    verbose: "false",
  });
  const apiKey = getApiKey();
  if (apiKey) params.set("key", apiKey);

  try {
    const res = await fetch(`${OCM_BASE}?${params.toString()}`, {
      headers: { "User-Agent": "Travony/EV (mobility network)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`OCM responded ${res.status}`);
    const json: any = await res.json();
    const list: any[] = Array.isArray(json) ? json : [];
    const chargers = list
      .map((poi) => mapPoi(poi, lat, lng))
      .filter((c): c is PublicCharger => c !== null)
      .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9));
    cache.set(key, { at: Date.now(), data: chargers });
    return { chargers, source: "live", keyed: Boolean(apiKey) };
  } catch (err) {
    console.error("OpenChargeMap fetch failed:", (err as Error).message);
    // graceful degradation: serve stale cache if we have it, else empty
    if (cached) return { chargers: cached.data, source: "cache", keyed: Boolean(apiKey) };
    return { chargers: [], source: "unavailable", keyed: Boolean(apiKey) };
  }
}
