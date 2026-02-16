import { Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import {
  hubs, hubMessages, hubReactions, hubCheckIns,
  communityPrestige, userFeedback, carpoolSuggestions,
  drivers, users,
} from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import {
  getHubsNearLocation,
  updateHubDemand,
  getHotspotsForMap,
  getDriverYieldEstimate,
  getHubRecommendationsForDriver,
  getHubRecommendationsForRider,
  generateSmartPrompt,
  suggestCarpoolMatches,
} from "./openClawService";
import {
  getOrCreatePrestige,
  updatePrestigeMetrics,
  getLeaderboard,
  incrementContribution,
} from "./communityPrestigeService";

const router = Router();

async function getSessionUser(req: any) {
  const token = req.headers.authorization?.split(" ")[1] || "";
  if (!token) return null;
  const session = await storage.getSession(token);
  if (!session) return null;
  if (new Date() > session.expiresAt) return null;
  return session;
}

const PROFANITY_LIST = ["spam", "scam", "xxx"];

function moderateContent(content: string): { passed: boolean; reason?: string } {
  if (!content || content.trim().length === 0) {
    return { passed: false, reason: "Message content cannot be empty" };
  }
  if (content.length > 500) {
    return { passed: false, reason: "Message must be 500 characters or less" };
  }
  const lower = content.toLowerCase();
  for (const word of PROFANITY_LIST) {
    if (lower.includes(word)) {
      return { passed: false, reason: "Message contains inappropriate content" };
    }
  }
  return { passed: true };
}

router.get("/api/openclaw/hubs", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);
    const radiusKm = parseFloat(req.query.radiusKm as string) || 10;

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const nearbyHubs = await getHubsNearLocation(lat, lng, radiusKm);
    res.json(nearbyHubs);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch hubs" });
  }
});

router.get("/api/openclaw/hubs/:hubId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }

    const demandData = await updateHubDemand(hubId);

    res.json({
      ...hub,
      currentDemandScore: demandData?.demandScore ?? parseFloat(hub.avgDemandScore || "0"),
      lastUpdated: demandData?.updatedAt ?? hub.updatedAt,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch hub details" });
  }
});

router.get("/api/openclaw/hotspots", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const cityId = req.query.cityId as string | undefined;
    const regionCode = req.query.regionCode as string | undefined;

    const hotspotData = await getHotspotsForMap(cityId, regionCode);
    res.json(hotspotData);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch hotspots" });
  }
});

router.get("/api/openclaw/hubs/:hubId/check-in", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }

    const [checkIn] = await db.insert(hubCheckIns).values({
      hubId,
      userId: session.userId,
      userRole: session.role,
      checkedInAt: new Date(),
    } as any).returning();

    await incrementContribution(session.userId, "check_in");

    res.json(checkIn);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to check in" });
  }
});

router.post("/api/openclaw/hubs/:hubId/check-out", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;

    const activeCheckIns = await db.select().from(hubCheckIns).where(
      and(
        eq(hubCheckIns.hubId, hubId),
        eq(hubCheckIns.userId, session.userId),
        sql`${hubCheckIns.checkedOutAt} IS NULL`,
      )
    ).orderBy(desc(hubCheckIns.checkedInAt)).limit(1);

    if (activeCheckIns.length === 0) {
      return res.status(404).json({ error: "No active check-in found" });
    }

    const [updated] = await db.update(hubCheckIns).set({
      checkedOutAt: new Date(),
    }).where(eq(hubCheckIns.id, activeCheckIns[0].id)).returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to check out" });
  }
});

router.get("/api/openclaw/hubs/:hubId/messages", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;
    const now = new Date();

    const messages = await db.select({
      message: hubMessages,
      authorName: users.name,
      authorAvatar: users.avatar,
    })
      .from(hubMessages)
      .innerJoin(users, eq(users.id, hubMessages.authorId))
      .where(
        and(
          eq(hubMessages.hubId, hubId),
          eq(hubMessages.status, "active"),
          gte(hubMessages.expiresAt, now),
        )
      )
      .orderBy(desc(hubMessages.createdAt));

    const result = messages.map(m => ({
      ...m.message,
      authorName: m.authorName,
      authorAvatar: m.authorAvatar,
    }));

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to fetch messages" });
  }
});

router.post("/api/openclaw/hubs/:hubId/messages", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;
    const { content } = req.body;

    const moderation = moderateContent(content);
    if (!moderation.passed) {
      return res.status(400).json({ error: moderation.reason });
    }

    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const [message] = await db.insert(hubMessages).values({
      hubId,
      authorId: session.userId,
      content: content.trim(),
      status: "active",
      expiresAt,
    } as any).returning();

    await incrementContribution(session.userId, "message");

    res.json(message);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to post message" });
  }
});

router.post("/api/openclaw/messages/:messageId/react", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { messageId } = req.params;
    const { reactionType } = req.body;

    const [message] = await db.select().from(hubMessages).where(eq(hubMessages.id, messageId));
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const existing = await db.select().from(hubReactions).where(
      and(
        eq(hubReactions.messageId, messageId),
        eq(hubReactions.userId, session.userId),
      )
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: "Already reacted to this message" });
    }

    const [reaction] = await db.insert(hubReactions).values({
      messageId,
      userId: session.userId,
      reactionType: reactionType || "like",
    } as any).returning();

    await db.update(hubMessages).set({
      likesCount: (message.likesCount || 0) + 1,
    }).where(eq(hubMessages.id, messageId));

    await incrementContribution(session.userId, "reaction");

    res.json(reaction);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to react" });
  }
});

router.delete("/api/openclaw/messages/:messageId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { messageId } = req.params;

    const [message] = await db.select().from(hubMessages).where(eq(hubMessages.id, messageId));
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (message.authorId !== session.userId) {
      return res.status(403).json({ error: "Can only delete your own messages" });
    }

    await db.update(hubMessages).set({ status: "moderated" }).where(eq(hubMessages.id, messageId));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to delete message" });
  }
});

router.get("/api/openclaw/recommendations/driver", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.userId));
    if (!driver) {
      return res.status(404).json({ error: "Driver profile not found" });
    }

    const recommendations = await getHubRecommendationsForDriver(driver.id, lat, lng);
    res.json(recommendations);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get driver recommendations" });
  }
});

router.get("/api/openclaw/recommendations/rider", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const recommendations = await getHubRecommendationsForRider(session.userId, lat, lng);
    res.json(recommendations);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get rider recommendations" });
  }
});

router.get("/api/openclaw/smart-prompt", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const lat = parseFloat(req.query.lat as string);
    const lng = parseFloat(req.query.lng as string);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const prompt = await generateSmartPrompt(session.userId, session.role, lat, lng);
    res.json(prompt);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to generate smart prompt" });
  }
});

router.get("/api/openclaw/yield-estimate/:hubId", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;
    const vehicleType = (req.query.vehicleType as string) || "economy";

    const estimate = await getDriverYieldEstimate(hubId, vehicleType);
    res.json(estimate);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get yield estimate" });
  }
});

router.post("/api/openclaw/carpool/suggest", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId, pickupLat, pickupLng, dropoffLat, dropoffLng } = req.body;

    if (!hubId || pickupLat == null || pickupLng == null || dropoffLat == null || dropoffLng == null) {
      return res.status(400).json({ error: "hubId, pickupLat, pickupLng, dropoffLat, dropoffLng are required" });
    }

    const suggestions = await suggestCarpoolMatches(
      hubId,
      session.userId,
      parseFloat(pickupLat),
      parseFloat(pickupLng),
      parseFloat(dropoffLat),
      parseFloat(dropoffLng),
    );

    res.json(suggestions);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get carpool suggestions" });
  }
});

router.get("/api/openclaw/prestige", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const prestige = await updatePrestigeMetrics(session.userId);
    res.json(prestige);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get prestige data" });
  }
});

router.get("/api/openclaw/prestige/leaderboard", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const limit = parseInt(req.query.limit as string) || 10;
    const leaderboard = await getLeaderboard(Math.min(limit, 100));
    res.json(leaderboard);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get leaderboard" });
  }
});

router.post("/api/openclaw/feedback", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { feedbackType, category, content, rating, screenName } = req.body;

    if (!feedbackType || !content) {
      return res.status(400).json({ error: "feedbackType and content are required" });
    }

    const validTypes = ["rating", "suggestion", "issue", "compliment"];
    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ error: "Invalid feedback type" });
    }

    const [feedback] = await db.insert(userFeedback).values({
      userId: session.userId,
      feedbackType,
      category: category || null,
      content: content.trim(),
      rating: rating != null ? parseInt(rating) : null,
      screenName: screenName || null,
    } as any).returning();

    res.json(feedback);
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to submit feedback" });
  }
});

export const openClawRouter = router;
export default router;
