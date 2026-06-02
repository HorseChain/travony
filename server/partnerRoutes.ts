import { Router } from "express";
import type { Request, Response } from "express";
import { db } from "./db";
import { storage } from "./storage";
import {
  apiKeys, hubs, rides, drivers, evDemandSignals, users,
} from "@shared/schema";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { calculateOptimalPrice } from "./aiEngine";
import {
  requirePartner, getUsageSummary, getPlanTier, PLAN_TIERS, PARTNER_SCOPES,
} from "./partnerApi";
import { getUncachableStripeClient } from "./stripeClient";

/**
 * Partner data + billing surface. Every data route is api-key authenticated,
 * scope-checked, rate-limited, quota-checked and metered via `requirePartner`.
 * Billing routes are session-authenticated (the key owner manages their plan).
 *
 * This is a separate namespace from the first-party app routes, so partner
 * traffic stays isolated and cannot degrade the T Ride / T Driver experience.
 */

const router = Router();

// ---------------------------------------------------------------------------
// Public metadata (no auth) — lets the docs/portal render the live catalog.
// ---------------------------------------------------------------------------

router.get("/api/partner/meta", (_req: Request, res: Response) => {
  res.json({
    scopes: PARTNER_SCOPES,
    plans: Object.values(PLAN_TIERS),
    auth: { header: "X-API-Key", format: "tvny_live_xxxx" },
  });
});

// ---------------------------------------------------------------------------
// Usage (api-key) — a partner inspects their own consumption with their key.
// ---------------------------------------------------------------------------

router.get("/api/partner/usage", requirePartner(null), async (req: Request, res: Response) => {
  try {
    const key = req.apiKey!;
    const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, key.keyId)).limit(1);
    const summary = await getUsageSummary(key.keyId, row?.planTier ?? "free");
    res.json({ keyId: key.keyId, scopes: key.scopes, ...summary });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to load usage" });
  }
});

// ---------------------------------------------------------------------------
// Data: EV hub network (hubs:read)
// ---------------------------------------------------------------------------

router.get("/api/partner/v1/hubs", requirePartner("hubs:read"), async (req: Request, res: Response) => {
  try {
    const evOnly = req.query.evOnly === "true";
    const conditions = [eq(hubs.status, "active")];
    if (evOnly) conditions.push(eq(hubs.isEvHub, true));

    const rows = await db.select().from(hubs).where(and(...conditions)).orderBy(desc(hubs.avgDemandScore));
    const data = rows.map((h) => ({
      id: h.id,
      name: h.name,
      type: h.type,
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lng),
      address: h.address,
      regionCode: h.regionCode,
      isEvHub: h.isEvHub || false,
      totalChargingPorts: h.totalChargingPorts || 0,
      availablePorts: h.availablePorts || 0,
      demandScore: parseFloat(h.avgDemandScore || "0"),
    }));
    res.json({ count: data.length, hubs: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to fetch hubs" });
  }
});

// ---------------------------------------------------------------------------
// Data: dynamic pricing quote (pricing:read)
// ---------------------------------------------------------------------------

router.get("/api/partner/v1/pricing", requirePartner("pricing:read"), async (req: Request, res: Response) => {
  try {
    const pickupLat = parseFloat(req.query.pickupLat as string);
    const pickupLng = parseFloat(req.query.pickupLng as string);
    const dropoffLat = parseFloat(req.query.dropoffLat as string);
    const dropoffLng = parseFloat(req.query.dropoffLng as string);
    const vehicleType = (req.query.vehicleType as string) || "economy";

    if ([pickupLat, pickupLng, dropoffLat, dropoffLng].some((n) => Number.isNaN(n))) {
      return res.status(400).json({
        error: "Missing coordinates",
        code: "MISSING_COORDINATES",
        message: "pickupLat, pickupLng, dropoffLat and dropoffLng are required.",
      });
    }

    const pricing = await calculateOptimalPrice(pickupLat, pickupLng, dropoffLat, dropoffLng, vehicleType);
    res.json({ pricing, transparency: pricing.priceExplanation });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to calculate price" });
  }
});

// ---------------------------------------------------------------------------
// Data: rides for the partner's own cars (rides:read)
// ---------------------------------------------------------------------------

router.get("/api/partner/v1/rides", requirePartner("rides:read"), async (req: Request, res: Response) => {
  try {
    const key = req.apiKey!;
    const limit = Math.min(parseInt((req.query.limit as string) || "50", 10) || 50, 200);
    const status = req.query.status as string | undefined;

    // Only rides served by drivers this partner onboarded.
    const fleetDrivers = await db
      .select({ id: drivers.id })
      .from(drivers)
      .where(eq(drivers.fleetOwnerId, key.ownerId));
    const driverIds = fleetDrivers.map((d) => d.id);
    if (driverIds.length === 0) return res.json({ count: 0, rides: [] });

    const conditions = [inArray(rides.driverId, driverIds)];
    if (status) conditions.push(eq(rides.status, status as any));

    const rows = await db
      .select()
      .from(rides)
      .where(and(...conditions))
      .orderBy(desc(rides.createdAt))
      .limit(limit);

    const data = rows.map((r) => ({
      id: r.id,
      driverId: r.driverId,
      status: r.status,
      pickupAddress: r.pickupAddress,
      dropoffAddress: r.dropoffAddress,
      fare: r.actualFare ?? r.estimatedFare,
      currency: r.currency,
      blockchainHash: r.blockchainHash ?? null,
      createdAt: r.createdAt,
    }));
    res.json({ count: data.length, rides: data });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to fetch rides" });
  }
});

// ---------------------------------------------------------------------------
// Data: EV demand signals (demand:read)
// ---------------------------------------------------------------------------

router.get("/api/partner/v1/ev-demand-signals", requirePartner("demand:read"), async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt((req.query.limit as string) || "100", 10) || 100, 500);
    const signals = await db
      .select()
      .from(evDemandSignals)
      .orderBy(desc(evDemandSignals.requestedAt))
      .limit(limit);

    const total = signals.length;
    const matched = signals.filter((s) => s.matchFound).length;
    res.json({
      count: total,
      matched,
      matchRate: total > 0 ? Math.round((matched / total) * 100) : 0,
      signals,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to fetch demand signals" });
  }
});

// ---------------------------------------------------------------------------
// Billing (session-authenticated) — owner manages their key's plan via Stripe.
// ---------------------------------------------------------------------------

type SessionUser = { userId: string; role: string };

async function getSessionUser(req: Request): Promise<SessionUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return { userId: session.userId, role: session.role };
}

async function getOwnedKey(keyId: string, ownerId: string) {
  const [row] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.ownerId, ownerId)))
    .limit(1);
  return row ?? null;
}

router.get("/api/partner/billing/plans", (_req: Request, res: Response) => {
  res.json({ plans: Object.values(PLAN_TIERS) });
});

// Start a Stripe Checkout subscription for a paid tier, tied to a specific key.
router.post("/api/partner/billing/checkout", async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { keyId, tier } = req.body || {};
    const plan = getPlanTier(tier);
    if (!keyId || !tier || !PLAN_TIERS[tier]) {
      return res.status(400).json({ error: "keyId and a valid tier are required" });
    }
    if (plan.priceUsd <= 0) {
      return res.status(400).json({ error: "The free plan does not require checkout. Downgrade instead." });
    }

    const key = await getOwnedKey(keyId, user.userId);
    if (!key) return res.status(404).json({ error: "API key not found" });

    const [owner] = await db.select().from(users).where(eq(users.id, user.userId)).limit(1);

    const stripe = await getUncachableStripeClient();
    const base = `${req.protocol}://${req.get("host")}`;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `Travony Partner API — ${plan.name}` },
            recurring: { interval: "month" },
            unit_amount: Math.round(plan.priceUsd * 100),
          },
          quantity: 1,
        },
      ],
      client_reference_id: keyId,
      customer_email: owner?.email || undefined,
      metadata: { keyId, tier: plan.id },
      subscription_data: { metadata: { keyId, tier: plan.id } },
      success_url: `${base}/developer?billing=success`,
      cancel_url: `${base}/developer?billing=cancelled`,
    });

    res.json({ checkoutUrl: session.url, sessionId: session.id });
  } catch (err: any) {
    console.error("Partner billing checkout error:", err?.message || err);
    res.status(500).json({ error: "Could not start checkout. Please try again later." });
  }
});

// Downgrade / cancel — drop the key to free and cancel any Stripe subscription.
router.post("/api/partner/billing/cancel", async (req: Request, res: Response) => {
  try {
    const user = await getSessionUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { keyId } = req.body || {};
    if (!keyId) return res.status(400).json({ error: "keyId is required" });

    const key = await getOwnedKey(keyId, user.userId);
    if (!key) return res.status(404).json({ error: "API key not found" });

    if (key.stripeSubscriptionId) {
      try {
        const stripe = await getUncachableStripeClient();
        await stripe.subscriptions.cancel(key.stripeSubscriptionId);
      } catch (e: any) {
        console.error("Stripe subscription cancel failed:", e?.message || e);
      }
    }

    await db.update(apiKeys)
      .set({ planTier: "free", stripeSubscriptionId: null })
      .where(eq(apiKeys.id, keyId));

    res.json({ success: true, planTier: "free", message: "Plan downgraded to Free." });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to cancel plan" });
  }
});

// Stripe webhook — keeps a key's tier in sync with its subscription lifecycle.
// Signature verification is MANDATORY: an unsigned/unverified payload must never
// be trusted, otherwise anyone could change a key's plan tier by POSTing raw JSON.
router.post("/api/partner/billing/webhook", async (req: Request, res: Response) => {
  let event: any;
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const sig = req.headers["stripe-signature"] as string | undefined;
    const rawBody = (req as any).rawBody;
    if (!secret) {
      console.error("Stripe webhook rejected: STRIPE_WEBHOOK_SECRET is not configured");
      return res.status(503).json({ error: "Webhook not configured" });
    }
    if (!sig || !rawBody) {
      return res.status(400).json({ error: "Missing signature" });
    }
    const stripe = await getUncachableStripeClient();
    event = stripe.webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err?.message || err);
    return res.status(400).json({ error: "Invalid signature" });
  }

  try {
    const type = event?.type;
    const obj = event?.data?.object || {};

    if (type === "checkout.session.completed") {
      const keyId = obj.client_reference_id || obj.metadata?.keyId;
      const tier = obj.metadata?.tier;
      if (keyId && tier && PLAN_TIERS[tier]) {
        await db.update(apiKeys)
          .set({
            planTier: tier,
            stripeCustomerId: typeof obj.customer === "string" ? obj.customer : null,
            stripeSubscriptionId: typeof obj.subscription === "string" ? obj.subscription : null,
          })
          .where(eq(apiKeys.id, keyId));
      }
    } else if (type === "customer.subscription.updated") {
      const keyId = obj.metadata?.keyId;
      const tier = obj.metadata?.tier;
      if (keyId) {
        const active = obj.status === "active" || obj.status === "trialing";
        const nextTier = active && tier && PLAN_TIERS[tier] ? tier : "free";
        await db.update(apiKeys)
          .set({ planTier: nextTier, stripeSubscriptionId: obj.id })
          .where(eq(apiKeys.id, keyId));
      }
    } else if (type === "customer.subscription.deleted") {
      const keyId = obj.metadata?.keyId;
      if (keyId) {
        await db.update(apiKeys)
          .set({ planTier: "free", stripeSubscriptionId: null })
          .where(eq(apiKeys.id, keyId));
      }
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error("Stripe webhook handling error:", err?.message || err);
    res.status(500).json({ error: "Webhook handling failed" });
  }
});

export { router as partnerRouter };
