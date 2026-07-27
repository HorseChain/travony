/**
 * Hyper-Local Geo Stream Ads — admin CRUD for registered businesses.
 *
 * Businesses are registered by admins (or partners via partner API) and
 * auto-pinned as product cards in live streams when a driver passes within
 * their radius. One ad slot per stream; highest-priority match wins; manual
 * host pins always take precedence.
 *
 * Auth: x-admin-password header (same pattern as other admin endpoints).
 */

import { Router } from "express";
import { db } from "./db";
import { streamAdBusinesses } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const streamAdRouter = Router();

function requireAdminPassword(req: any, res: any, next: any) {
  const pw = req.headers["x-admin-password"];
  if (!pw || pw !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "Admin authentication required" });
  }
  next();
}

// ---------------------------------------------------------------------------
// GET /api/admin/stream-ads — list all ad businesses (newest first)
// ---------------------------------------------------------------------------
streamAdRouter.get("/api/admin/stream-ads", requireAdminPassword, async (_req, res) => {
  try {
    const ads = await db
      .select()
      .from(streamAdBusinesses)
      .orderBy(desc(streamAdBusinesses.priority), desc(streamAdBusinesses.createdAt));
    res.json({ ads });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Failed to list ads" });
  }
});

// ---------------------------------------------------------------------------
// POST /api/admin/stream-ads — create a new ad business
// ---------------------------------------------------------------------------
streamAdRouter.post("/api/admin/stream-ads", requireAdminPassword, async (req, res) => {
  try {
    const {
      name, logoUrl, description, offerText,
      lat, lng, radiusMetres,
      startsAt, endsAt, priority, isActive,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!offerText || typeof offerText !== "string" || !offerText.trim()) {
      return res.status(400).json({ error: "offerText is required" });
    }

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      return res.status(400).json({ error: "lat must be a number between -90 and 90" });
    }
    if (isNaN(lngNum) || lngNum < -180 || lngNum > 180) {
      return res.status(400).json({ error: "lng must be a number between -180 and 180" });
    }

    const radius = parseInt(radiusMetres) || 500;
    if (radius < 50 || radius > 50000) {
      return res.status(400).json({ error: "radiusMetres must be between 50 and 50 000" });
    }

    const [ad] = await db
      .insert(streamAdBusinesses)
      .values({
        name: name.trim(),
        logoUrl:     (logoUrl && typeof logoUrl === "string") ? logoUrl.trim() : null,
        description: (description && typeof description === "string") ? description.trim() : null,
        offerText:   offerText.trim(),
        lat:         String(latNum),
        lng:         String(lngNum),
        radiusMetres: radius,
        startsAt:    startsAt ? new Date(startsAt) : null,
        endsAt:      endsAt   ? new Date(endsAt)   : null,
        priority:    typeof priority === "number" ? Math.round(priority) : 0,
        isActive:    isActive !== false,
      })
      .returning();

    res.status(201).json({ ad });
  } catch (err: any) {
    console.error("[StreamAds] create error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to create ad" });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/admin/stream-ads/:id — update fields
// ---------------------------------------------------------------------------
streamAdRouter.patch("/api/admin/stream-ads/:id", requireAdminPassword, async (req, res) => {
  try {
    const { id } = req.params;
    const updates: Record<string, any> = {};

    const textFields = ["name", "logoUrl", "description", "offerText"] as const;
    for (const f of textFields) {
      if (req.body[f] !== undefined) {
        updates[f] = typeof req.body[f] === "string" ? req.body[f].trim() : null;
      }
    }

    if (req.body.lat !== undefined) {
      const v = parseFloat(req.body.lat);
      if (isNaN(v) || v < -90 || v > 90) {
        return res.status(400).json({ error: "lat must be between -90 and 90" });
      }
      updates.lat = String(v);
    }
    if (req.body.lng !== undefined) {
      const v = parseFloat(req.body.lng);
      if (isNaN(v) || v < -180 || v > 180) {
        return res.status(400).json({ error: "lng must be between -180 and 180" });
      }
      updates.lng = String(v);
    }
    if (req.body.radiusMetres !== undefined) {
      const v = parseInt(req.body.radiusMetres);
      if (isNaN(v) || v < 50 || v > 50000) {
        return res.status(400).json({ error: "radiusMetres must be between 50 and 50 000" });
      }
      updates.radiusMetres = v;
    }
    if (req.body.startsAt !== undefined) {
      updates.startsAt = req.body.startsAt ? new Date(req.body.startsAt) : null;
    }
    if (req.body.endsAt !== undefined) {
      updates.endsAt = req.body.endsAt ? new Date(req.body.endsAt) : null;
    }
    if (req.body.priority !== undefined) {
      updates.priority = Math.round(Number(req.body.priority) || 0);
    }
    if (req.body.isActive !== undefined) {
      updates.isActive = Boolean(req.body.isActive);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }
    updates.updatedAt = new Date();

    const [ad] = await db
      .update(streamAdBusinesses)
      .set(updates)
      .where(eq(streamAdBusinesses.id, id))
      .returning();

    if (!ad) return res.status(404).json({ error: "Ad business not found" });
    res.json({ ad });
  } catch (err: any) {
    console.error("[StreamAds] update error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to update ad" });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/stream-ads/:id — hard-delete
// ---------------------------------------------------------------------------
streamAdRouter.delete("/api/admin/stream-ads/:id", requireAdminPassword, async (req, res) => {
  try {
    const { id } = req.params;
    const [deleted] = await db
      .delete(streamAdBusinesses)
      .where(eq(streamAdBusinesses.id, id))
      .returning({ id: streamAdBusinesses.id });

    if (!deleted) return res.status(404).json({ error: "Ad business not found" });
    res.json({ deleted: true, id: deleted.id });
  } catch (err: any) {
    console.error("[StreamAds] delete error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Failed to delete ad" });
  }
});
