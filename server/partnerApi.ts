import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { apiKeys, apiUsageEvents, apiUsageCounters } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

/**
 * Partner API control plane — the single source of truth for:
 *   - the public scope catalog (what partners can ask for),
 *   - the plan tiers (quota + per-minute rate limit per tier),
 *   - the partner request guard (api-key auth -> scope -> rate limit -> quota -> metering).
 *
 * The docs (apiSpec.ts / developer portal) and the middleware both read from
 * the constants below so they can never drift apart.
 */

// ---------------------------------------------------------------------------
// Scope catalog
// ---------------------------------------------------------------------------

export interface ScopeDef {
  scope: string;
  description: string;
  audience: string;
}

/** Canonical, public partner scopes. Naming convention: `resource:action`. */
export const PARTNER_SCOPES: ScopeDef[] = [
  { scope: "fleet:read", description: "List and read the cars you onboarded (status, battery, stats, current ride)", audience: "Fleet operators, EV brands" },
  { scope: "fleet:write", description: "Onboard cars and their owners under your account", audience: "Fleet management systems" },
  { scope: "rides:read", description: "Read ride records and lifecycle status", audience: "Analytics platforms, insurers" },
  { scope: "rides:write", description: "Create rides and flip taxi mode on/off programmatically", audience: "Booking platforms, AV systems" },
  { scope: "hubs:read", description: "EV charging hub network — locations, port availability, EV staging", audience: "EV manufacturers, charging operators" },
  { scope: "pricing:read", description: "Dynamic fare quotes for a pickup/dropoff and vehicle type", audience: "Booking apps, aggregators" },
  { scope: "demand:read", description: "EV demand signals and hub demand heatmap data", audience: "City planners, fleet optimizers" },
];

const SCOPE_SET = new Set(PARTNER_SCOPES.map((s) => s.scope));

/** Legacy / alias scope names mapped onto canonical scopes so old keys keep working. */
const SCOPE_ALIASES: Record<string, string> = {
  "ev-hubs:read": "hubs:read",
};

/** Normalise a stored scope string to its canonical form. */
export function canonicalScope(scope: string): string {
  return SCOPE_ALIASES[scope] ?? scope;
}

/** Does a key's scope list satisfy the required scope (honouring aliases)? */
export function scopesSatisfy(granted: string[], required: string): boolean {
  const want = canonicalScope(required);
  return granted.some((g) => canonicalScope(g) === want);
}

export function isValidScope(scope: string): boolean {
  return SCOPE_SET.has(canonicalScope(scope));
}

// ---------------------------------------------------------------------------
// Plan tiers
// ---------------------------------------------------------------------------

export interface PlanTier {
  id: string;
  name: string;
  monthlyQuota: number;       // calls per calendar month
  rateLimitPerMin: number;    // requests per rolling 60s window
  priceUsd: number;           // monthly price (0 = free)
  description: string;
}

export const PLAN_TIERS: Record<string, PlanTier> = {
  free: {
    id: "free",
    name: "Free",
    monthlyQuota: 1_000,
    rateLimitPerMin: 30,
    priceUsd: 0,
    description: "Kick the tires. 1,000 calls/month, 30 req/min.",
  },
  starter: {
    id: "starter",
    name: "Starter",
    monthlyQuota: 50_000,
    rateLimitPerMin: 120,
    priceUsd: 49,
    description: "For production integrations. 50k calls/month, 120 req/min.",
  },
  growth: {
    id: "growth",
    name: "Growth",
    monthlyQuota: 500_000,
    rateLimitPerMin: 600,
    priceUsd: 199,
    description: "High-volume partners. 500k calls/month, 600 req/min.",
  },
};

export function getPlanTier(tierId: string | null | undefined): PlanTier {
  return PLAN_TIERS[tierId ?? "free"] ?? PLAN_TIERS.free;
}

export function currentPeriod(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ---------------------------------------------------------------------------
// In-memory per-key rate limiter (rolling 60s window)
// ---------------------------------------------------------------------------
// In-memory keeps it low-overhead and means a partner hammering the API never
// adds DB load — protecting the first-party T Ride / T Driver experience.

const rateWindows = new Map<string, number[]>();
const WINDOW_MS = 60_000;

function checkRateLimit(keyId: string, limitPerMin: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  const hits = (rateWindows.get(keyId) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limitPerMin) {
    const oldest = hits[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + WINDOW_MS - now) / 1000));
    rateWindows.set(keyId, hits);
    return { ok: false, retryAfterSec };
  }
  hits.push(now);
  rateWindows.set(keyId, hits);
  return { ok: true, retryAfterSec: 0 };
}

// Periodically evict idle windows so the map can't grow unbounded.
setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [k, hits] of rateWindows.entries()) {
    const live = hits.filter((t) => t > cutoff);
    if (live.length === 0) rateWindows.delete(k);
    else rateWindows.set(k, live);
  }
}, 5 * 60_000).unref?.();

// ---------------------------------------------------------------------------
// Usage metering (fire-and-forget — never blocks or fails a request)
// ---------------------------------------------------------------------------

async function getPeriodCount(keyId: string, period: string): Promise<number> {
  const [row] = await db
    .select({ callCount: apiUsageCounters.callCount })
    .from(apiUsageCounters)
    .where(and(eq(apiUsageCounters.keyId, keyId), eq(apiUsageCounters.period, period)))
    .limit(1);
  return row?.callCount ?? 0;
}

function recordUsage(keyId: string, ownerId: string, endpoint: string, method: string, statusCode: number) {
  const period = currentPeriod();
  // Audit event
  db.insert(apiUsageEvents)
    .values({ keyId, ownerId, endpoint, method, statusCode })
    .catch((e) => console.error("partner usage event write failed:", e?.message || e));
  // Aggregate counter (atomic upsert/increment)
  db.insert(apiUsageCounters)
    .values({ keyId, period, callCount: 1, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [apiUsageCounters.keyId, apiUsageCounters.period],
      set: { callCount: sql`${apiUsageCounters.callCount} + 1`, updatedAt: new Date() },
    })
    .catch((e) => console.error("partner usage counter write failed:", e?.message || e));
}

export interface UsageSummary {
  plan: PlanTier;
  period: string;
  callsThisPeriod: number;
  monthlyQuota: number;
  remaining: number;
  rateLimitPerMin: number;
}

export async function getUsageSummary(keyId: string, planTier: string): Promise<UsageSummary> {
  const plan = getPlanTier(planTier);
  const period = currentPeriod();
  const calls = await getPeriodCount(keyId, period);
  return {
    plan,
    period,
    callsThisPeriod: calls,
    monthlyQuota: plan.monthlyQuota,
    remaining: Math.max(0, plan.monthlyQuota - calls),
    rateLimitPerMin: plan.rateLimitPerMin,
  };
}

// ---------------------------------------------------------------------------
// Partner request guard
// ---------------------------------------------------------------------------
// Order: api-key present -> scope -> rate limit -> monthly quota -> meter.
// `apiKeyMiddleware` must run first (it populates req.apiKey from X-API-Key).

// Pass a scope string to require it; pass null to accept any valid key (used by
// the self-inspection usage endpoint, which every partner must be able to call).
export function requirePartner(scope: string | null) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const key = req.apiKey;
    if (!key) {
      return res.status(401).json({
        error: "API key required",
        code: "API_KEY_REQUIRED",
        message: "Pass your partner key in the 'X-API-Key' header. Get one at /developer.",
      });
    }

    if (scope && !scopesSatisfy(key.scopes, scope)) {
      return res.status(403).json({
        error: "Forbidden",
        code: "INSUFFICIENT_SCOPE",
        message: `This call needs the '${scope}' scope on your API key.`,
      });
    }

    const plan = getPlanTier(key.planTier);

    // Per-minute rate limit (in-memory, isolated from first-party traffic).
    const rl = checkRateLimit(key.keyId, plan.rateLimitPerMin);
    if (!rl.ok) {
      res.setHeader("Retry-After", String(rl.retryAfterSec));
      res.setHeader("X-RateLimit-Limit", String(plan.rateLimitPerMin));
      return res.status(429).json({
        error: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        message: `You may make up to ${plan.rateLimitPerMin} requests per minute on the ${plan.name} plan. Retry in ${rl.retryAfterSec}s.`,
        retryAfterSec: rl.retryAfterSec,
      });
    }

    // Monthly quota (read counter; failure must not block — degrade open).
    try {
      const used = await getPeriodCount(key.keyId, currentPeriod());
      res.setHeader("X-Quota-Limit", String(plan.monthlyQuota));
      res.setHeader("X-Quota-Remaining", String(Math.max(0, plan.monthlyQuota - used)));
      if (used >= plan.monthlyQuota) {
        return res.status(429).json({
          error: "Monthly quota exceeded",
          code: "QUOTA_EXCEEDED",
          message: `You have used your ${plan.monthlyQuota.toLocaleString()} calls for this month on the ${plan.name} plan. Upgrade at /developer to raise your quota.`,
          plan: plan.id,
        });
      }
    } catch (e) {
      console.error("partner quota check failed (allowing request):", (e as Error)?.message);
    }

    // Meter the call once the response is sent.
    const endpoint = (req.baseUrl || "") + (req.route?.path || req.path);
    res.on("finish", () => {
      recordUsage(key.keyId, key.ownerId, endpoint, req.method, res.statusCode);
    });

    next();
  };
}
