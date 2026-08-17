// ---------------------------------------------------------------------------
// Notification inbox + preferences routes, and the public Autopilot feed.
// ---------------------------------------------------------------------------

import { Router } from "express";
import { db } from "./db";
import { desc, gte, sql as dsql } from "drizzle-orm";
import { autopilotActions, autopilotPlayStats } from "@shared/schema";
import { storage } from "./storage";
import {
  listNotifications,
  markRead,
  getPrefs,
  upsertPrefs,
} from "./notificationService";
import {
  autopilotStatus,
  setAutopilotPaused,
} from "./autopilot";

export const notificationRouter = Router();

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

function requireAdminToken(req: any, res: any, next: any) {
  const token = req.headers["x-admin-token"];
  if (!token || token !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  next();
}

// --- user inbox --------------------------------------------------------------

notificationRouter.get("/api/notifications", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Not authenticated" });
    const limit = Math.min(parseInt(String(req.query.limit || "50"), 10) || 50, 100);
    const result = await listNotifications(session.userId, limit);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

notificationRouter.post("/api/notifications/read", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Not authenticated" });
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.filter((x: unknown) => typeof x === "string").slice(0, 200)
      : undefined;
    const updated = await markRead(session.userId, ids);
    res.json({ updated });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

notificationRouter.get("/api/notifications/prefs", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Not authenticated" });
    res.json(await getPrefs(session.userId));
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

notificationRouter.patch("/api/notifications/prefs", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ message: "Not authenticated" });
    const row = await upsertPrefs(session.userId, req.body ?? {});
    res.json(row);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// --- public Autopilot feed (sanitized — no user identifiers) ------------------

notificationRouter.get("/api/autopilot/feed", async (_req, res) => {
  try {
    const actions = await db
      .select({
        play: autopilotActions.play,
        publicSummary: autopilotActions.publicSummary,
        outcome: autopilotActions.outcome,
        createdAt: autopilotActions.createdAt,
      })
      .from(autopilotActions)
      .orderBy(desc(autopilotActions.createdAt))
      .limit(50);

    const stats = await db.select().from(autopilotPlayStats);
    const [today] = await db
      .select({ count: dsql<number>`count(*)::int` })
      .from(autopilotActions)
      .where(gte(autopilotActions.createdAt, new Date(Date.now() - 24 * 3_600_000)));

    res.json({
      actionsLast24h: today.count,
      plays: stats.map((s) => ({
        play: s.play,
        attempts: s.attempts,
        hits: s.hits,
        misses: s.misses,
        hitRate: s.hits + s.misses > 0 ? Math.round((s.hits / (s.hits + s.misses)) * 100) : null,
      })),
      feed: actions,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// --- admin control -------------------------------------------------------------

notificationRouter.get("/api/autopilot/status", requireAdminToken, (_req, res) => {
  res.json(autopilotStatus());
});

notificationRouter.post("/api/autopilot/pause", requireAdminToken, (_req, res) => {
  setAutopilotPaused(true);
  res.json({ paused: true });
});

notificationRouter.post("/api/autopilot/resume", requireAdminToken, (_req, res) => {
  setAutopilotPaused(false);
  res.json({ paused: false });
});
