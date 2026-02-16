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

export const openClawRouter = router;
export default router;
