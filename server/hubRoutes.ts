import { Router } from "express";
import { storage } from "./storage";
import { db } from "./db";
import {
  hubs, hubMessages, hubReactions, hubCheckIns,
  communityPrestige, userFeedback, carpoolSuggestions,
  drivers, users, hotspots, rides,
} from "@shared/schema";
import { eq, and, gte, desc, sql, count } from "drizzle-orm";
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
  calculatePrestigeTier,
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

    const userReactions = await db.select({ messageId: hubReactions.messageId })
      .from(hubReactions)
      .where(eq(hubReactions.userId, session.userId));
    const likedMessageIds = new Set(userReactions.map(r => r.messageId));

    const nowMs = now.getTime();
    const scored = messages.map(m => {
      const ageMinutes = (nowMs - new Date(m.message.createdAt).getTime()) / 60000;
      const recencyScore = Math.max(0, 1 - (ageMinutes / 240));
      const engagementScore = Math.min(1, (m.message.likesCount || 0) / 10);
      const aiScoreVal = parseFloat(m.message.aiScore || "0");
      const compositeScore = (recencyScore * 0.4) + (engagementScore * 0.3) + (aiScoreVal * 0.3);
      return {
        ...m.message,
        authorName: m.authorName,
        authorAvatar: m.authorAvatar,
        hasLiked: likedMessageIds.has(m.message.id),
        _compositeScore: compositeScore,
      };
    });

    scored.sort((a, b) => b._compositeScore - a._compositeScore);

    const result = scored.map(({ _compositeScore, ...rest }) => rest);

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
    const { content, category } = req.body;

    const moderation = moderateContent(content);
    if (!moderation.passed) {
      return res.status(400).json({ error: moderation.reason });
    }

    const validCategories = ["demand_insight", "traffic_alert", "event_signal", "availability_update"];
    const validatedCategory = category && validCategories.includes(category) ? category : null;

    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }

    const trimmedContent = content.trim();
    let aiScore = 0.30;
    if (trimmedContent.length > 50) aiScore += 0.15;
    if (trimmedContent.length > 100) aiScore += 0.10;
    if (validatedCategory) aiScore += 0.20;
    if (/\d/.test(trimmedContent)) aiScore += 0.10;
    if (/\b(demand|traffic|surge|wait|available|busy|quiet|peak)\b/i.test(trimmedContent)) aiScore += 0.15;
    aiScore = Math.min(0.99, Math.round(aiScore * 100) / 100);

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);

    const [message] = await db.insert(hubMessages).values({
      hubId,
      authorId: session.userId,
      content: trimmedContent,
      category: validatedCategory,
      aiScore: aiScore.toFixed(2),
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
    const score = parseFloat(prestige.networkParticipationScore || "0");
    const tier = prestige.tier || "bronze";

    const nextTierScoreMap: Record<string, number> = {
      bronze: 50,
      silver: 150,
      gold: 300,
      platinum: 500,
      diamond: 1000,
    };
    const nextTierScore = nextTierScoreMap[tier] || 50;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const userRides = await db.select().from(rides).where(
      and(eq(rides.customerId, session.userId), gte(rides.createdAt, thirtyDaysAgo))
    );

    let routesNearHubs = 0;
    const activeHubs = await db.select().from(hubs).where(eq(hubs.status, "active"));
    for (const ride of userRides) {
      const rLat = parseFloat(ride.pickupLat);
      const rLng = parseFloat(ride.pickupLng);
      for (const hub of activeHubs) {
        const hLat = parseFloat(hub.lat);
        const hLng = parseFloat(hub.lng);
        const dist = Math.sqrt(Math.pow(rLat - hLat, 2) + Math.pow(rLng - hLng, 2)) * 111;
        if (dist <= 1) {
          routesNearHubs++;
          break;
        }
      }
    }

    const recentCheckIns = await db.select({
      checkIn: hubCheckIns,
      hubName: hubs.name,
    })
      .from(hubCheckIns)
      .innerJoin(hubs, eq(hubs.id, hubCheckIns.hubId))
      .where(and(eq(hubCheckIns.userId, session.userId), gte(hubCheckIns.checkedInAt, thirtyDaysAgo)))
      .orderBy(desc(hubCheckIns.checkedInAt))
      .limit(10);

    const now = Date.now();
    const recentActivity = recentCheckIns.map((c, i) => {
      const checkedIn = new Date(c.checkIn.checkedInAt).getTime();
      const checkedOut = c.checkIn.checkedOutAt ? new Date(c.checkIn.checkedOutAt).getTime() : checkedIn + 30 * 60 * 1000;
      const diffMs = now - checkedIn;
      const diffMin = Math.floor(diffMs / 60000);
      let time: string;
      if (diffMin < 60) time = `${diffMin}m ago`;
      else if (diffMin < 1440) time = `${Math.floor(diffMin / 60)}h ago`;
      else time = `${Math.floor(diffMin / 1440)}d ago`;

      const durationMs = checkedOut - checkedIn;
      const durationMin = Math.floor(durationMs / 60000);
      const duration = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}min` : `${durationMin} min`;

      return { id: c.checkIn.id || String(i), hubName: c.hubName, time, duration };
    });

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyTrends: Array<{ day: string; visits: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const visits = recentCheckIns.filter(c => {
        const t = new Date(c.checkIn.checkedInAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      weeklyTrends.push({ day: dayNames[d.getDay()], visits });
    }

    res.json({
      score,
      nextTierScore,
      tier,
      contributions: prestige.totalContributions || 0,
      efficiency: Math.round(parseFloat(prestige.efficiencyRating || "0") * 100),
      participationScore: score,
      hubsVisited: prestige.monthlyActiveHubs || 0,
      contributionScore: score,
      routesNearHubs,
      recentActivity,
      weeklyTrends,
    });
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

router.get("/api/openclaw/analytics/driver", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.userId));
    if (!driver) return res.status(404).json({ error: "Driver profile not found" });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekRides = await db.select().from(rides).where(
      and(eq(rides.driverId, driver.id), gte(rides.createdAt, sevenDaysAgo), eq(rides.status, "completed"))
    );

    const activeHotspots = await db.select().from(hotspots).where(eq(hotspots.isActive, true)).orderBy(desc(hotspots.demandScore)).limit(5);
    const hotspotEarnings = activeHotspots.map(h => ({
      lat: parseFloat(h.lat),
      lng: parseFloat(h.lng),
      earnings: parseFloat(h.avgYieldEstimate || "0"),
      demandScore: parseFloat(h.demandScore),
      rides: h.demandCount || 0,
    }));

    const now = Date.now();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyEarnings: Array<{ day: string; earnings: number; rides: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayRides = weekRides.filter(r => {
        const t = new Date(r.completedAt || r.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      });
      const dayEarnings = dayRides.reduce((sum, r) => sum + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
      weeklyEarnings.push({ day: dayNames[d.getDay()], earnings: Math.round(dayEarnings * 100) / 100, rides: dayRides.length });
    }

    const totalEarnings = weekRides.reduce((sum, r) => sum + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
    const totalHours = weekRides.reduce((sum, r) => sum + (r.duration || 0), 0) / 60;
    const averageYieldPerHour = totalHours > 0 ? Math.round((totalEarnings / totalHours) * 100) / 100 : 0;

    const hubRideCounts: Record<string, { hubId: string; hubName: string; earnings: number; rides: number }> = {};
    const allHubs = await db.select().from(hubs).where(eq(hubs.status, "active"));
    for (const ride of weekRides) {
      const rLat = parseFloat(ride.pickupLat);
      const rLng = parseFloat(ride.pickupLng);
      for (const hub of allHubs) {
        const hLat = parseFloat(hub.lat);
        const hLng = parseFloat(hub.lng);
        const dist = Math.sqrt(Math.pow(rLat - hLat, 2) + Math.pow(rLng - hLng, 2)) * 111;
        if (dist <= 1) {
          if (!hubRideCounts[hub.id]) hubRideCounts[hub.id] = { hubId: hub.id, hubName: hub.name, earnings: 0, rides: 0 };
          hubRideCounts[hub.id].earnings += parseFloat(ride.driverEarnings || ride.actualFare || ride.estimatedFare || "0");
          hubRideCounts[hub.id].rides++;
          break;
        }
      }
    }
    const topHub = Object.values(hubRideCounts).sort((a, b) => b.earnings - a.earnings)[0] || null;

    res.json({
      hotspotEarnings,
      weeklyEarnings,
      averageYieldPerHour,
      totalRidesThisWeek: weekRides.length,
      topHub,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get driver analytics" });
  }
});

router.get("/api/openclaw/analytics/rider", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const monthRides = await db.select().from(rides).where(
      and(eq(rides.customerId, session.userId), gte(rides.createdAt, thirtyDaysAgo))
    );

    const checkIns = await db.select({
      hubId: hubCheckIns.hubId,
      hubName: hubs.name,
    })
      .from(hubCheckIns)
      .innerJoin(hubs, eq(hubs.id, hubCheckIns.hubId))
      .where(and(eq(hubCheckIns.userId, session.userId), gte(hubCheckIns.checkedInAt, thirtyDaysAgo)));

    const uniqueHubIds = new Set(checkIns.map(c => c.hubId));
    const hubsUsed = uniqueHubIds.size;

    const completedRides = monthRides.filter(r => r.status === "completed" && r.acceptedAt && r.startedAt);
    let avgPickupTime = 0;
    if (completedRides.length > 0) {
      const totalPickupMs = completedRides.reduce((sum, r) => {
        const accepted = new Date(r.acceptedAt!).getTime();
        const started = new Date(r.startedAt!).getTime();
        return sum + (started - accepted);
      }, 0);
      avgPickupTime = Math.round(totalPickupMs / completedRides.length / 60000 * 10) / 10;
    }

    const hubVisitCounts: Record<string, { hubId: string; hubName: string; visits: number }> = {};
    for (const c of checkIns) {
      if (!hubVisitCounts[c.hubId]) hubVisitCounts[c.hubId] = { hubId: c.hubId, hubName: c.hubName, visits: 0 };
      hubVisitCounts[c.hubId].visits++;
    }
    const favoritHub = Object.values(hubVisitCounts).sort((a, b) => b.visits - a.visits)[0] || null;

    const now = Date.now();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyActivity: Array<{ day: string; rides: number }> = [];
    const weekRides = monthRides.filter(r => new Date(r.createdAt).getTime() >= sevenDaysAgo.getTime());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 60 * 60 * 1000);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const dayRides = weekRides.filter(r => {
        const t = new Date(r.createdAt).getTime();
        return t >= dayStart.getTime() && t < dayEnd.getTime();
      }).length;
      weeklyActivity.push({ day: dayNames[d.getDay()], rides: dayRides });
    }

    res.json({
      totalRides: monthRides.length,
      hubsUsed,
      avgPickupTime,
      favoritHub,
      weeklyActivity,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get rider analytics" });
  }
});

router.get("/api/openclaw/analytics/network", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const activeHubsResult = await db.select({ count: sql<number>`count(*)` })
      .from(hubs).where(eq(hubs.status, "active"));
    const totalActiveHubs = Number(activeHubsResult[0]?.count || 0);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const checkInsTodayResult = await db.select({ count: sql<number>`count(*)` })
      .from(hubCheckIns).where(gte(hubCheckIns.checkedInAt, todayStart));
    const totalCheckInsToday = Number(checkInsTodayResult[0]?.count || 0);

    const messagesTodayResult = await db.select({ count: sql<number>`count(*)` })
      .from(hubMessages).where(gte(hubMessages.createdAt, todayStart));
    const totalMessagesToday = Number(messagesTodayResult[0]?.count || 0);

    const leaderboard = await getLeaderboard(5);
    const topContributors = leaderboard.map(entry => ({
      userId: entry.userId,
      userName: entry.userName,
      score: entry.participationScore,
      tier: entry.tier,
    }));

    let networkHealth: string;
    if (totalCheckInsToday >= 20 && totalMessagesToday >= 10) networkHealth = "healthy";
    else if (totalCheckInsToday >= 5 || totalMessagesToday >= 3) networkHealth = "growing";
    else networkHealth = "quiet";

    res.json({
      totalActiveHubs,
      totalCheckInsToday,
      totalMessagesToday,
      topContributors,
      networkHealth,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get network analytics" });
  }
});

router.post("/api/openclaw/messages/:messageId/report", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { messageId } = req.params;

    const [message] = await db.select().from(hubMessages).where(eq(hubMessages.id, messageId));
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const newReportCount = (message.reportCount || 0) + 1;
    const updateData: any = { reportCount: newReportCount };
    if (newReportCount >= 3) {
      updateData.status = "moderated";
    }

    const [updated] = await db.update(hubMessages).set(updateData).where(eq(hubMessages.id, messageId)).returning();

    res.json({ success: true, reportCount: newReportCount, moderated: newReportCount >= 3 });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to report message" });
  }
});

router.get("/api/openclaw/hubs/:hubId/intelligence", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }

    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    const radiusKm = (hub.radiusMeters || 300) / 1000;

    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const recentRides = await db.select().from(rides).where(gte(rides.createdAt, threeHoursAgo));
    const onlineDrivers = await db.select().from(drivers).where(eq(drivers.isOnline, true));

    function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    const nearbyRides = recentRides.filter(r => {
      const rLat = parseFloat(r.pickupLat);
      const rLng = parseFloat(r.pickupLng);
      return haversineDist(hubLat, hubLng, rLat, rLng) <= radiusKm * 3;
    });

    const nearbyDrivers = onlineDrivers.filter(d => {
      const dLat = parseFloat(d.currentLat || "0");
      const dLng = parseFloat(d.currentLng || "0");
      return haversineDist(hubLat, hubLng, dLat, dLng) <= radiusKm * 3;
    });

    const recentCheckIns = await db.select().from(hubCheckIns).where(
      and(eq(hubCheckIns.hubId, hubId), gte(hubCheckIns.checkedInAt, twentyFourHoursAgo))
    );
    const uniqueMembers = new Set(recentCheckIns.map(c => c.userId));

    const activityScore = Math.min(100, Math.round(
      (nearbyRides.length * 5) + (nearbyDrivers.length * 10) + (recentCheckIns.length * 3)
    ));

    const yieldData = await getDriverYieldEstimate(hubId, "economy");
    const predictedYield = {
      amount: yieldData.estimatedYieldPerHour,
      window: "next 1 hour",
      confidence: yieldData.confidence,
    };

    const now = Date.now();
    const demandTrend: Array<{ time: string; demand: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const bucketStart = now - (i + 1) * 30 * 60 * 1000;
      const bucketEnd = now - i * 30 * 60 * 1000;
      const bucketRides = nearbyRides.filter(r => {
        const t = new Date(r.createdAt).getTime();
        return t >= bucketStart && t < bucketEnd;
      });
      const d = new Date(bucketEnd);
      const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      demandTrend.push({ time, demand: bucketRides.length });
    }

    const vehicleTicker: Array<{ type: string; vehicleType: string; timeAgo: string }> = [];
    const sortedRides = [...nearbyRides].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
    for (const ride of sortedRides) {
      const ageMs = now - new Date(ride.createdAt).getTime();
      const ageMin = Math.floor(ageMs / 60000);
      const timeAgo = ageMin < 60 ? `${ageMin}m ago` : `${Math.floor(ageMin / 60)}h ago`;

      if (ride.status === "completed") {
        const dropLat = parseFloat(ride.dropoffLat);
        const dropLng = parseFloat(ride.dropoffLng);
        const isArrival = haversineDist(hubLat, hubLng, dropLat, dropLng) <= radiusKm * 3;
        vehicleTicker.push({
          type: isArrival ? "arrival" : "departure",
          vehicleType: "economy",
          timeAgo,
        });
      } else {
        vehicleTicker.push({ type: "departure", vehicleType: "economy", timeAgo });
      }
    }

    let aiRecommendation: { title: string; message: string; priority: string };
    if (activityScore >= 70) {
      aiRecommendation = {
        title: "High Activity Zone",
        message: `${hub.name} is experiencing high demand. Great time for drivers to activate here.`,
        priority: "high",
      };
    } else if (activityScore >= 30) {
      aiRecommendation = {
        title: "Moderate Activity",
        message: `Steady activity at ${hub.name}. Consider positioning here for upcoming demand.`,
        priority: "medium",
      };
    } else {
      aiRecommendation = {
        title: "Low Activity Period",
        message: `${hub.name} is quiet right now. Check back during peak hours for better yields.`,
        priority: "low",
      };
    }

    const allActiveHubs = await db.select().from(hubs).where(eq(hubs.status, "active"));
    let nextLikelyHub: { hubId: string; hubName: string; probability: number; distance: number } | null = null;
    const otherHubs = allActiveHubs
      .filter(h => h.id !== hubId)
      .map(h => ({
        ...h,
        dist: haversineDist(hubLat, hubLng, parseFloat(h.lat), parseFloat(h.lng)),
        demand: parseFloat(h.avgDemandScore || "0"),
      }))
      .filter(h => h.dist <= 10)
      .sort((a, b) => b.demand - a.demand);

    if (otherHubs.length > 0) {
      const top = otherHubs[0];
      nextLikelyHub = {
        hubId: top.id,
        hubName: top.name,
        probability: Math.min(0.95, Math.round(top.demand / 10 * 100) / 100),
        distance: Math.round(top.dist * 100) / 100,
      };
    }

    const monthRides = await db.select().from(rides).where(
      and(gte(rides.createdAt, thirtyDaysAgo), eq(rides.status, "completed"))
    );
    const migrationMap: Record<string, { fromHub: string; toHub: string; frequency: number }> = {};
    for (const ride of monthRides) {
      const pickLat = parseFloat(ride.pickupLat);
      const pickLng = parseFloat(ride.pickupLng);
      const dropLat = parseFloat(ride.dropoffLat);
      const dropLng = parseFloat(ride.dropoffLng);

      let fromHub: typeof allActiveHubs[0] | null = null;
      let toHub: typeof allActiveHubs[0] | null = null;

      for (const h of allActiveHubs) {
        const hLat = parseFloat(h.lat);
        const hLng = parseFloat(h.lng);
        if (haversineDist(pickLat, pickLng, hLat, hLng) <= 1) fromHub = h;
        if (haversineDist(dropLat, dropLng, hLat, hLng) <= 1) toHub = h;
      }

      if (fromHub && toHub && fromHub.id !== toHub.id) {
        const key = `${fromHub.id}->${toHub.id}`;
        if (!migrationMap[key]) {
          migrationMap[key] = { fromHub: fromHub.name, toHub: toHub.name, frequency: 0 };
        }
        migrationMap[key].frequency++;
      }
    }
    const migrationPatterns = Object.values(migrationMap).sort((a, b) => b.frequency - a.frequency).slice(0, 5);

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const dayCounts: Record<number, number> = {};
    const hourCounts: Record<number, number> = {};
    for (const ride of monthRides) {
      const rLat = parseFloat(ride.pickupLat);
      const rLng = parseFloat(ride.pickupLng);
      if (haversineDist(hubLat, hubLng, rLat, rLng) <= 2) {
        const d = new Date(ride.createdAt);
        dayCounts[d.getDay()] = (dayCounts[d.getDay()] || 0) + 1;
        hourCounts[d.getHours()] = (hourCounts[d.getHours()] || 0) + 1;
      }
    }

    let peakDay = "Mon";
    let peakDayCount = 0;
    for (const [day, cnt] of Object.entries(dayCounts)) {
      if (cnt > peakDayCount) {
        peakDayCount = cnt;
        peakDay = dayNames[parseInt(day)];
      }
    }

    let peakHour = "09:00";
    let peakHourCount = 0;
    for (const [hour, cnt] of Object.entries(hourCounts)) {
      if (cnt > peakHourCount) {
        peakHourCount = cnt;
        peakHour = `${String(parseInt(hour)).padStart(2, "0")}:00`;
      }
    }

    const totalNearbyMonth = Object.values(dayCounts).reduce((a, b) => a + b, 0);
    let currentTrend = "steady";
    if (nearbyRides.length > totalNearbyMonth / 30 * 1.5) currentTrend = "rising";
    else if (nearbyRides.length < totalNearbyMonth / 30 * 0.5) currentTrend = "declining";

    res.json({
      activityScore,
      vehiclesActive: nearbyDrivers.length,
      networkMembers: uniqueMembers.size,
      predictedYield,
      demandTrend,
      vehicleTicker,
      aiRecommendation,
      nextLikelyHub,
      migrationPatterns,
      seasonalBehavior: { currentTrend, peakDay, peakHour },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get hub intelligence" });
  }
});

router.get("/api/openclaw/hubs/:hubId/insights", async (req, res) => {
  try {
    const session = await getSessionUser(req);
    if (!session) return res.status(401).json({ error: "Unauthorized" });

    const { hubId } = req.params;
    const [hub] = await db.select().from(hubs).where(eq(hubs.id, hubId));
    if (!hub) {
      return res.status(404).json({ error: "Hub not found" });
    }

    const hubLat = parseFloat(hub.lat);
    const hubLng = parseFloat(hub.lng);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const now = Date.now();
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    function haversineDist(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    if (session.role === "driver") {
      const [driver] = await db.select().from(drivers).where(eq(drivers.userId, session.userId));
      if (!driver) return res.status(404).json({ error: "Driver profile not found" });

      const monthRides = await db.select().from(rides).where(
        and(eq(rides.driverId, driver.id), gte(rides.createdAt, thirtyDaysAgo), eq(rides.status, "completed"))
      );

      const nearbyRides = monthRides.filter(r => {
        const rLat = parseFloat(r.pickupLat);
        const rLng = parseFloat(r.pickupLng);
        return haversineDist(hubLat, hubLng, rLat, rLng) <= 2;
      });

      const totalEarnings = nearbyRides.reduce((sum, r) => sum + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
      const totalHours = nearbyRides.reduce((sum, r) => sum + (r.duration || 0), 0) / 60;
      const avgYieldPerHour = totalHours > 0 ? Math.round(totalEarnings / totalHours * 100) / 100 : 0;

      const hourCounts: Record<number, number> = {};
      for (const ride of nearbyRides) {
        const h = new Date(ride.createdAt).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
      const sortedHours = Object.entries(hourCounts).sort((a, b) => parseInt(b[1] as any) - parseInt(a[1] as any));
      const bestActivationTimes = sortedHours.slice(0, 3).map(([h]) => {
        const hour = parseInt(h);
        return `${String(hour).padStart(2, "0")}:00-${String((hour + 2) % 24).padStart(2, "0")}:00`;
      });

      const prestige = await getOrCreatePrestige(session.userId);
      const contributionScore = parseFloat(prestige.networkParticipationScore || "0");

      const weekRides = monthRides.filter(r => new Date(r.createdAt).getTime() >= sevenDaysAgo.getTime());
      const weeklyEarningsTrend: Array<{ day: string; earnings: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dayRides = weekRides.filter(r => {
          const t = new Date(r.completedAt || r.createdAt).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        });
        const dayEarnings = dayRides.reduce((sum, r) => sum + parseFloat(r.driverEarnings || r.actualFare || r.estimatedFare || "0"), 0);
        weeklyEarningsTrend.push({ day: dayNames[d.getDay()], earnings: Math.round(dayEarnings * 100) / 100 });
      }

      res.json({
        role: "driver",
        avgYieldPerHour,
        bestActivationTimes: bestActivationTimes.length > 0 ? bestActivationTimes : ["08:00-10:00", "17:00-19:00"],
        contributionScore,
        weeklyEarningsTrend,
        totalRidesThisMonth: monthRides.length,
        avgRating: parseFloat(driver.rating || "5.00"),
      });
    } else {
      const monthRides = await db.select().from(rides).where(
        and(eq(rides.customerId, session.userId), gte(rides.createdAt, thirtyDaysAgo))
      );

      const completedRides = monthRides.filter(r => r.status === "completed" && r.acceptedAt && r.startedAt);
      let avgWaitTime = 0;
      if (completedRides.length > 0) {
        const totalWaitMs = completedRides.reduce((sum, r) => {
          const accepted = new Date(r.acceptedAt!).getTime();
          const started = new Date(r.startedAt!).getTime();
          return sum + (started - accepted);
        }, 0);
        avgWaitTime = Math.round(totalWaitMs / completedRides.length / 60000 * 10) / 10;
      }

      const hourCounts: Record<number, number> = {};
      for (const ride of monthRides) {
        const h = new Date(ride.createdAt).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }
      const sortedHours = Object.entries(hourCounts).sort((a, b) => parseInt(b[1] as any) - parseInt(a[1] as any));
      const peakActivityWindows = sortedHours.slice(0, 3).map(([h]) => {
        const hour = parseInt(h);
        return `${String(hour).padStart(2, "0")}:00-${String((hour + 2) % 24).padStart(2, "0")}:00`;
      });

      const completionRate = monthRides.length > 0
        ? Math.round((completedRides.length / monthRides.length) * 100)
        : 50;
      const hubReliabilityScore = Math.min(100, completionRate);

      const weekRides = monthRides.filter(r => new Date(r.createdAt).getTime() >= sevenDaysAgo.getTime());
      const weeklyRidesTrend: Array<{ day: string; rides: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * 24 * 60 * 60 * 1000);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const dayRideCount = weekRides.filter(r => {
          const t = new Date(r.createdAt).getTime();
          return t >= dayStart.getTime() && t < dayEnd.getTime();
        }).length;
        weeklyRidesTrend.push({ day: dayNames[d.getDay()], rides: dayRideCount });
      }

      const checkIns = await db.select({
        hubId: hubCheckIns.hubId,
        hubName: hubs.name,
      })
        .from(hubCheckIns)
        .innerJoin(hubs, eq(hubs.id, hubCheckIns.hubId))
        .where(and(eq(hubCheckIns.userId, session.userId), gte(hubCheckIns.checkedInAt, thirtyDaysAgo)));

      const hubVisitCounts: Record<string, { name: string; visits: number }> = {};
      for (const c of checkIns) {
        if (!hubVisitCounts[c.hubId]) hubVisitCounts[c.hubId] = { name: c.hubName, visits: 0 };
        hubVisitCounts[c.hubId].visits++;
      }
      const sortedHubVisits = Object.values(hubVisitCounts).sort((a, b) => b.visits - a.visits);
      const favoriteHub = sortedHubVisits.length > 0 ? sortedHubVisits[0] : null;

      res.json({
        role: "rider",
        avgWaitTime,
        peakActivityWindows: peakActivityWindows.length > 0 ? peakActivityWindows : ["08:00-10:00", "17:00-19:00"],
        hubReliabilityScore,
        weeklyRidesTrend,
        totalRidesThisMonth: monthRides.length,
        favoriteHub,
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message || "Failed to get hub insights" });
  }
});

export const openClawRouter = router;
export default router;
