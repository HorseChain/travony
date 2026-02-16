import { db } from "./db";
import { communityPrestige, hubMessages, hubReactions, hubCheckIns, rides, drivers, users } from "@shared/schema";
import { eq, and, gte, desc, sql } from "drizzle-orm";

export async function getOrCreatePrestige(userId: string, driverId?: string) {
  const [existing] = await db.select().from(communityPrestige).where(eq(communityPrestige.userId, userId));
  if (existing) return existing;

  const [created] = await db.insert(communityPrestige).values({
    userId,
    driverId: driverId || null,
    tier: "bronze",
    totalContributions: 0,
    networkParticipationScore: "0.00",
    efficiencyRating: "0.00",
    lifetimeYield: "0.00",
    hubMessagesCount: 0,
    helpfulReactionsReceived: 0,
    monthlyActiveHubs: 0,
    isTopContributor: false,
  } as any).returning();

  return created;
}

export async function updatePrestigeMetrics(userId: string) {
  const prestige = await getOrCreatePrestige(userId);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const messagesResult = await db.select({ count: sql<number>`count(*)` })
    .from(hubMessages)
    .where(and(eq(hubMessages.authorId, userId), gte(hubMessages.createdAt, thirtyDaysAgo)));
  const messagesCount = Number(messagesResult[0]?.count || 0);

  const userMessages = await db.select({ id: hubMessages.id })
    .from(hubMessages)
    .where(eq(hubMessages.authorId, userId));
  const messageIds = userMessages.map(m => m.id);

  let reactionsReceived = 0;
  if (messageIds.length > 0) {
    const reactionsResult = await db.select({ count: sql<number>`count(*)` })
      .from(hubReactions)
      .where(sql`${hubReactions.messageId} IN (${sql.join(messageIds.map(id => sql`${id}`), sql`, `)})`);
    reactionsReceived = Number(reactionsResult[0]?.count || 0);
  }

  const checkInsResult = await db.select({ count: sql<number>`count(distinct ${hubCheckIns.hubId})` })
    .from(hubCheckIns)
    .where(and(eq(hubCheckIns.userId, userId), gte(hubCheckIns.checkedInAt, thirtyDaysAgo)));
  const monthlyActiveHubs = Number(checkInsResult[0]?.count || 0);

  const totalCheckInsResult = await db.select({ count: sql<number>`count(*)` })
    .from(hubCheckIns)
    .where(and(eq(hubCheckIns.userId, userId), gte(hubCheckIns.checkedInAt, thirtyDaysAgo)));
  const totalCheckIns = Number(totalCheckInsResult[0]?.count || 0);

  const participationScore = (messagesCount * 2) + (reactionsReceived * 1.5) + (totalCheckIns * 3) + (monthlyActiveHubs * 5);
  const roundedScore = Math.round(participationScore * 100) / 100;

  const tier = calculatePrestigeTier(roundedScore);
  const totalContributions = messagesCount + totalCheckIns;

  const [updated] = await db.update(communityPrestige).set({
    hubMessagesCount: messagesCount,
    helpfulReactionsReceived: reactionsReceived,
    monthlyActiveHubs,
    networkParticipationScore: roundedScore.toFixed(2),
    totalContributions,
    tier,
    isTopContributor: roundedScore >= 300,
    lastActivityAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(communityPrestige.userId, userId)).returning();

  return updated;
}

export function calculatePrestigeTier(score: number): "bronze" | "silver" | "gold" | "platinum" | "diamond" {
  if (score >= 500) return "diamond";
  if (score >= 300) return "platinum";
  if (score >= 150) return "gold";
  if (score >= 50) return "silver";
  return "bronze";
}

export async function getLeaderboard(limit: number = 10) {
  const leaders = await db.select({
    prestige: communityPrestige,
    userName: users.name,
    userAvatar: users.avatar,
  })
    .from(communityPrestige)
    .innerJoin(users, eq(users.id, communityPrestige.userId))
    .orderBy(desc(communityPrestige.networkParticipationScore))
    .limit(limit);

  return leaders.map((entry, index) => ({
    rank: index + 1,
    userId: entry.prestige.userId,
    userName: entry.userName,
    userAvatar: entry.userAvatar,
    tier: entry.prestige.tier,
    participationScore: parseFloat(entry.prestige.networkParticipationScore || "0"),
    totalContributions: entry.prestige.totalContributions || 0,
    hubMessagesCount: entry.prestige.hubMessagesCount || 0,
    helpfulReactionsReceived: entry.prestige.helpfulReactionsReceived || 0,
    monthlyActiveHubs: entry.prestige.monthlyActiveHubs || 0,
    isTopContributor: entry.prestige.isTopContributor || false,
  }));
}

export async function incrementContribution(userId: string, type: string) {
  const prestige = await getOrCreatePrestige(userId);

  const newTotal = (prestige.totalContributions || 0) + 1;
  const currentScore = parseFloat(prestige.networkParticipationScore || "0");

  let scoreIncrement = 1;
  switch (type) {
    case "message": scoreIncrement = 2; break;
    case "reaction": scoreIncrement = 1.5; break;
    case "check_in": scoreIncrement = 3; break;
    case "hub_visit": scoreIncrement = 5; break;
    default: scoreIncrement = 1; break;
  }

  const newScore = Math.round((currentScore + scoreIncrement) * 100) / 100;
  const tier = calculatePrestigeTier(newScore);

  const [updated] = await db.update(communityPrestige).set({
    totalContributions: newTotal,
    networkParticipationScore: newScore.toFixed(2),
    tier,
    isTopContributor: newScore >= 300,
    lastActivityAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(communityPrestige.userId, userId)).returning();

  return updated;
}
