import React from "react";
import { View, StyleSheet, ScrollView, FlatList, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { SkeletonLoader } from "@/components/SkeletonLoader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
  diamond: "#B9F2FF",
};

const TIER_ICONS: Record<string, string> = {
  bronze: "shield-outline",
  silver: "shield-half-outline",
  gold: "shield-checkmark-outline",
  platinum: "diamond-outline",
  diamond: "star-outline",
};

const TIERS = [
  { name: "Bronze", key: "bronze", requirement: "0 - 99 pts", description: "Starting tier for new contributors" },
  { name: "Silver", key: "silver", requirement: "100 - 299 pts", description: "Regular network participants" },
  { name: "Gold", key: "gold", requirement: "300 - 599 pts", description: "Active community members" },
  { name: "Platinum", key: "platinum", requirement: "600 - 999 pts", description: "Top-tier contributors" },
  { name: "Diamond", key: "diamond", requirement: "1000+ pts", description: "Elite network champions" },
];

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"];

interface LeaderboardEntry {
  id: string;
  userId: string;
  userName: string;
  tier: string;
  score: number;
  rank: number;
}

function TierCard({ tier, isActive, theme }: { tier: typeof TIERS[0]; isActive: boolean; theme: any }) {
  const color = TIER_COLORS[tier.key];
  const icon = TIER_ICONS[tier.key];
  return (
    <View style={[styles.tierCard, { backgroundColor: theme.backgroundDefault, borderColor: isActive ? color : "transparent", borderWidth: isActive ? 2 : 0 }]}>
      <View style={[styles.tierCardBadge, { backgroundColor: color + "20" }]}>
        <Ionicons name={icon as any} size={24} color={color} />
      </View>
      <ThemedText style={[styles.tierCardName, { color }]}>{tier.name}</ThemedText>
      <ThemedText style={[styles.tierCardReq, { color: theme.textSecondary }]}>{tier.requirement}</ThemedText>
      <ThemedText style={[styles.tierCardDesc, { color: theme.textMuted }]}>{tier.description}</ThemedText>
    </View>
  );
}

function LeaderboardItem({ item, currentUserId, theme }: { item: LeaderboardEntry; currentUserId?: string; theme: any }) {
  const isCurrentUser = item.userId === currentUserId;
  const tierColor = TIER_COLORS[item.tier] || TIER_COLORS.bronze;
  const tierIcon = TIER_ICONS[item.tier] || TIER_ICONS.bronze;
  const isTopThree = item.rank <= 3;

  return (
    <View style={[styles.leaderboardItem, { backgroundColor: isCurrentUser ? theme.primary + "10" : theme.backgroundDefault, borderColor: isCurrentUser ? theme.primary + "30" : "transparent", borderWidth: isCurrentUser ? 1 : 0 }]}>
      <View style={styles.rankContainer}>
        {isTopThree ? (
          <Ionicons name="medal-outline" size={22} color={MEDAL_COLORS[item.rank - 1]} />
        ) : (
          <ThemedText style={[styles.rankText, { color: theme.textSecondary }]}>#{item.rank}</ThemedText>
        )}
      </View>
      <View style={styles.leaderboardInfo}>
        <ThemedText style={[styles.leaderboardName, isCurrentUser && { color: theme.primary }]}>
          {item.userName}{isCurrentUser ? " (You)" : ""}
        </ThemedText>
        <View style={styles.leaderboardMeta}>
          <Ionicons name={tierIcon as any} size={14} color={tierColor} />
          <ThemedText style={[styles.leaderboardTier, { color: tierColor }]}>
            {item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.leaderboardScore, { color: theme.textSecondary }]}>{item.score} pts</ThemedText>
    </View>
  );
}

export default function CommunityPrestigeScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const { data: prestigeData, isLoading: prestigeLoading } = useQuery<any>({
    queryKey: ["/api/openclaw/prestige"],
  });

  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery<any>({
    queryKey: ["/api/openclaw/prestige/leaderboard?limit=20"],
  });

  const tier = prestigeData?.tier || "bronze";
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.bronze;
  const tierIcon = TIER_ICONS[tier] || TIER_ICONS.bronze;
  const score = prestigeData?.score || 0;
  const nextTierScore = prestigeData?.nextTierScore || 100;
  const progress = nextTierScore > 0 ? Math.min(score / nextTierScore, 1) : 0;
  const contributions = prestigeData?.contributions || 0;
  const efficiency = prestigeData?.efficiency || 0;
  const participationScore = prestigeData?.participationScore || score;

  const leaderboard: LeaderboardEntry[] = leaderboardData?.leaderboard || leaderboardData || [];

  const isLoading = prestigeLoading || leaderboardLoading;

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <SkeletonLoader />
      </ThemedView>
    );
  }

  return (
    <FlatList
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={leaderboard}
      keyExtractor={(item) => item.id || String(item.rank)}
      renderItem={({ item }) => (
        <LeaderboardItem item={item} currentUserId={user?.id} theme={theme} />
      )}
      ListHeaderComponent={
        <>
          <Animated.View
            entering={FadeInDown.delay(0).duration(400)}
            style={[styles.prestigeCard, { backgroundColor: theme.backgroundDefault }]}
          >
            <View style={styles.prestigeHeader}>
              <View style={[styles.tierBadgeLarge, { backgroundColor: tierColor + "20" }]}>
                <Ionicons name={tierIcon as any} size={36} color={tierColor} />
              </View>
              <View style={styles.prestigeHeaderInfo}>
                <ThemedText style={[styles.tierLabel, { color: theme.textMuted }]}>Your Prestige Tier</ThemedText>
                <ThemedText style={[styles.tierNameLarge, { color: tierColor }]}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <ThemedText style={[styles.statItemValue, { color: theme.primary }]}>{participationScore}</ThemedText>
                <ThemedText style={[styles.statItemLabel, { color: theme.textSecondary }]}>Participation</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <ThemedText style={[styles.statItemValue, { color: theme.primary }]}>{contributions}</ThemedText>
                <ThemedText style={[styles.statItemLabel, { color: theme.textSecondary }]}>Contributions</ThemedText>
              </View>
              <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
              <View style={styles.statItem}>
                <ThemedText style={[styles.statItemValue, { color: theme.primary }]}>{efficiency}%</ThemedText>
                <ThemedText style={[styles.statItemLabel, { color: theme.textSecondary }]}>Efficiency</ThemedText>
              </View>
            </View>

            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: tierColor }]} />
              </View>
              <ThemedText style={[styles.progressLabel, { color: theme.textMuted }]}>
                {score}/{nextTierScore} pts to next tier
              </ThemedText>
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(400)}>
            <ThemedText style={styles.sectionTitle}>Prestige Tiers</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tiersScroll}
            >
              {TIERS.map((t) => (
                <TierCard key={t.key} tier={t} isActive={t.key === tier} theme={theme} />
              ))}
            </ScrollView>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <ThemedText style={styles.sectionTitle}>Leaderboard</ThemedText>
          </Animated.View>
        </>
      }
      ListEmptyComponent={
        <View style={styles.emptyContainer}>
          <Ionicons name="trophy-outline" size={48} color={theme.textMuted} />
          <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
            No leaderboard data available yet
          </ThemedText>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  prestigeCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.xl,
    marginBottom: Spacing["2xl"],
  },
  prestigeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  tierBadgeLarge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  prestigeHeaderInfo: {
    marginLeft: Spacing.lg,
  },
  tierLabel: {
    ...Typography.small,
  },
  tierNameLarge: {
    ...Typography.h2,
    textTransform: "capitalize",
  },
  statsGrid: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statItemValue: {
    ...Typography.h3,
  },
  statItemLabel: {
    ...Typography.caption,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
  },
  progressContainer: {
    gap: Spacing.xs,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 4,
  },
  progressLabel: {
    ...Typography.caption,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  tiersScroll: {
    gap: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  tierCard: {
    width: 140,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  tierCardBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  tierCardName: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  tierCardReq: {
    ...Typography.caption,
    marginTop: 2,
  },
  tierCardDesc: {
    ...Typography.caption,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  rankContainer: {
    width: 36,
    alignItems: "center",
  },
  rankText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  leaderboardInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  leaderboardName: {
    ...Typography.bodyMedium,
    fontWeight: "500",
  },
  leaderboardMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  leaderboardTier: {
    ...Typography.caption,
    textTransform: "capitalize",
  },
  leaderboardScore: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.bodyMedium,
    textAlign: "center",
  },
});
