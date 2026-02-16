import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
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

const screenWidth = Dimensions.get("window").width;

function StatCard({ icon, label, value, delay, theme }: { icon: string; label: string; value: string | number; delay: number; theme: any }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400)}
      style={[styles.statCard, { backgroundColor: theme.backgroundDefault }]}
    >
      <View style={[styles.statIconContainer, { backgroundColor: theme.primary + "15" }]}>
        <Ionicons name={icon as any} size={20} color={theme.primary} />
      </View>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </Animated.View>
  );
}

export default function NetworkAnalyticsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const { data: prestigeData, isLoading } = useQuery<any>({
    queryKey: ["/api/openclaw/prestige"],
  });

  const tier = prestigeData?.tier || "bronze";
  const tierColor = TIER_COLORS[tier] || TIER_COLORS.bronze;
  const tierIcon = TIER_ICONS[tier] || TIER_ICONS.bronze;
  const score = prestigeData?.score || 0;
  const nextTierScore = prestigeData?.nextTierScore || 100;
  const progress = nextTierScore > 0 ? Math.min(score / nextTierScore, 1) : 0;

  const hubsVisited = prestigeData?.hubsVisited || 0;
  const contributionScore = prestigeData?.contributionScore || score;
  const routesNearHubs = prestigeData?.routesNearHubs || 0;

  const recentActivity = prestigeData?.recentActivity || [
    { id: "1", hubName: "Downtown Transit Hub", time: "2h ago", duration: "45 min" },
    { id: "2", hubName: "Airport Terminal A", time: "5h ago", duration: "1h 20min" },
    { id: "3", hubName: "University Campus Hub", time: "1d ago", duration: "30 min" },
    { id: "4", hubName: "Central Business District", time: "2d ago", duration: "55 min" },
  ];

  const weeklyData = prestigeData?.weeklyTrends || [
    { day: "Mon", visits: 3 },
    { day: "Tue", visits: 5 },
    { day: "Wed", visits: 2 },
    { day: "Thu", visits: 7 },
    { day: "Fri", visits: 4 },
    { day: "Sat", visits: 6 },
    { day: "Sun", visits: 1 },
  ];

  const maxVisits = Math.max(...weeklyData.map((d: any) => d.visits), 1);

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: headerHeight + Spacing.lg }]}>
        <SkeletonLoader />
      </ThemedView>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.statsRow}>
        <StatCard icon="location-outline" label="Active Hubs Visited" value={hubsVisited} delay={0} theme={theme} />
        <StatCard icon="trending-up-outline" label="Network Contribution Score" value={contributionScore} delay={100} theme={theme} />
        <StatCard icon="navigate-outline" label="Routes Near Hubs" value={routesNearHubs} delay={200} theme={theme} />
      </View>

      <Animated.View
        entering={FadeInDown.delay(300).duration(400)}
        style={[styles.prestigeCard, { backgroundColor: theme.backgroundDefault }]}
      >
        <View style={styles.prestigeHeader}>
          <View style={[styles.tierBadge, { backgroundColor: tierColor + "20" }]}>
            <Ionicons name={tierIcon as any} size={28} color={tierColor} />
          </View>
          <View style={styles.prestigeInfo}>
            <ThemedText style={styles.prestigeTitle}>Prestige Tier</ThemedText>
            <ThemedText style={[styles.tierName, { color: tierColor }]}>
              {tier.charAt(0).toUpperCase() + tier.slice(1)}
            </ThemedText>
          </View>
          <ThemedText style={[styles.scoreText, { color: theme.textSecondary }]}>
            {score} pts
          </ThemedText>
        </View>
        <View style={styles.progressContainer}>
          <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSecondary }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: tierColor }]} />
          </View>
          <ThemedText style={[styles.progressLabel, { color: theme.textMuted }]}>
            {Math.round(progress * 100)}% to next tier ({nextTierScore} pts)
          </ThemedText>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(400).duration(400)}>
        <ThemedText style={styles.sectionTitle}>Recent Hub Activity</ThemedText>
        {recentActivity.map((activity: any, index: number) => (
          <View
            key={activity.id || index}
            style={[styles.activityItem, { backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border }]}
          >
            <View style={[styles.activityDot, { backgroundColor: theme.primary }]} />
            <View style={styles.activityContent}>
              <ThemedText style={styles.activityHub}>{activity.hubName}</ThemedText>
              <ThemedText style={[styles.activityMeta, { color: theme.textMuted }]}>
                {activity.time} - {activity.duration}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward-outline" size={16} color={theme.textMuted} />
          </View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(500).duration(400)}>
        <ThemedText style={styles.sectionTitle}>Weekly Trends</ThemedText>
        <View style={[styles.chartContainer, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.barsRow}>
            {weeklyData.map((item: any, index: number) => {
              const barHeight = (item.visits / maxVisits) * 120;
              return (
                <View key={index} style={styles.barColumn}>
                  <ThemedText style={[styles.barValue, { color: theme.textSecondary }]}>
                    {item.visits}
                  </ThemedText>
                  <View style={styles.barWrapper}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: Math.max(barHeight, 4),
                          backgroundColor: theme.primary,
                          opacity: 0.6 + (item.visits / maxVisits) * 0.4,
                        },
                      ]}
                    />
                  </View>
                  <ThemedText style={[styles.barLabel, { color: theme.textMuted }]}>
                    {item.day}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </View>
      </Animated.View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  statValue: {
    ...Typography.h3,
    marginBottom: 2,
  },
  statLabel: {
    ...Typography.caption,
    textAlign: "center",
  },
  prestigeCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  prestigeHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  tierBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  prestigeInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  prestigeTitle: {
    ...Typography.small,
    opacity: 0.7,
  },
  tierName: {
    ...Typography.h3,
    textTransform: "capitalize",
  },
  scoreText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
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
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityHub: {
    ...Typography.bodyMedium,
    fontWeight: "500",
  },
  activityMeta: {
    ...Typography.caption,
    marginTop: 2,
  },
  chartContainer: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  barsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    height: 160,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    height: 120,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  bar: {
    width: 24,
    borderRadius: 4,
  },
  barValue: {
    ...Typography.caption,
    marginBottom: 4,
  },
  barLabel: {
    ...Typography.caption,
    marginTop: Spacing.xs,
  },
});
