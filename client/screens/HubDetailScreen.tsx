import React, { useState, useCallback, useRef, useEffect } from "react";
import { View, StyleSheet, FlatList, TextInput, Pressable, KeyboardAvoidingView, Platform, RefreshControl } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInUp, SlideInRight } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Haptics from "expo-haptics";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/hooks/useAuth";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";

type TabKey = "messages" | "activity" | "community";

interface HubMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: string;
  likesCount: number;
  hasLiked?: boolean;
}

interface HubMetrics {
  demandScore: number;
  activeCheckIns: number;
  peakHours: string[];
  recentRides: number;
}

interface YieldEstimate {
  estimatedYieldPerHour: number;
  confidence: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  tier: string;
  points: number;
  rank: number;
}

interface PrestigeInfo {
  tier: string;
  points: number;
  rank: number;
}

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
  diamond: "#B9F2FF",
};

const TIER_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  bronze: "shield-outline",
  silver: "shield-half-outline",
  gold: "shield",
  platinum: "diamond-outline",
  diamond: "diamond",
};

function getTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function HubDetailScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const flatListRef = useRef<FlatList>(null);

  const { hubId, hubName } = route.params as { hubId: string; hubName: string };
  const [activeTab, setActiveTab] = useState<TabKey>("messages");
  const [messageText, setMessageText] = useState("");

  const messagesQueryKey = [`/api/openclaw/hubs/${hubId}/messages`];
  const metricsQueryKey = [`/api/openclaw/hubs/${hubId}/metrics`];
  const yieldQueryKey = [`/api/openclaw/yield-estimate/${hubId}`];
  const leaderboardQueryKey = ["/api/openclaw/prestige/leaderboard?limit=10"];
  const prestigeQueryKey = ["/api/openclaw/prestige/me"];

  const {
    data: messages = [],
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useQuery<HubMessage[]>({
    queryKey: messagesQueryKey,
    enabled: activeTab === "messages",
    refetchInterval: 10000,
  });

  const {
    data: metrics,
    isLoading: metricsLoading,
    refetch: refetchMetrics,
  } = useQuery<HubMetrics>({
    queryKey: metricsQueryKey,
    enabled: activeTab === "activity",
  });

  const {
    data: yieldEstimate,
    refetch: refetchYield,
  } = useQuery<YieldEstimate>({
    queryKey: yieldQueryKey,
    enabled: activeTab === "activity",
  });

  const {
    data: leaderboard = [],
    isLoading: leaderboardLoading,
    refetch: refetchLeaderboard,
  } = useQuery<LeaderboardEntry[]>({
    queryKey: leaderboardQueryKey,
    enabled: activeTab === "community",
  });

  const {
    data: myPrestige,
    refetch: refetchPrestige,
  } = useQuery<PrestigeInfo>({
    queryKey: prestigeQueryKey,
    enabled: activeTab === "community",
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      return apiRequest(`/api/openclaw/hubs/${hubId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
    },
    onSuccess: () => {
      setMessageText("");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest(`/api/openclaw/messages/${messageId}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reactionType: "like" }),
      });
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const deleteMessageMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest(`/api/openclaw/messages/${messageId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: messagesQueryKey });
    },
  });

  const handleSendMessage = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    sendMessageMutation.mutate(trimmed);
  }, [messageText, sendMessageMutation]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === "messages") await refetchMessages();
    if (activeTab === "activity") {
      await Promise.all([refetchMetrics(), refetchYield()]);
    }
    if (activeTab === "community") {
      await Promise.all([refetchLeaderboard(), refetchPrestige()]);
    }
  }, [activeTab, refetchMessages, refetchMetrics, refetchYield, refetchLeaderboard, refetchPrestige]);

  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "messages", label: "Messages", icon: "chatbubble-outline" },
    { key: "activity", label: "Activity", icon: "pulse-outline" },
    { key: "community", label: "Community", icon: "people-outline" },
  ];

  const renderMessageItem = useCallback(({ item, index }: { item: HubMessage; index: number }) => {
    const isOwn = item.authorId === user?.id;
    return (
      <Animated.View entering={FadeInUp.delay(index * 50).duration(300)}>
        <View style={[styles.messageCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.messageHeader}>
            <View style={styles.messageAuthorRow}>
              <View style={[styles.avatarCircle, { backgroundColor: theme.primary + "20" }]}>
                <ThemedText style={[styles.avatarLetter, { color: theme.primary }]}>
                  {item.authorName.charAt(0).toUpperCase()}
                </ThemedText>
              </View>
              <View style={styles.messageAuthorInfo}>
                <ThemedText style={[styles.authorName, { color: theme.text }]}>
                  {item.authorName}
                </ThemedText>
                <ThemedText style={[styles.messageTime, { color: theme.textMuted }]}>
                  {getTimeAgo(item.createdAt)}
                </ThemedText>
              </View>
            </View>
            {isOwn ? (
              <Pressable
                onPress={() => deleteMessageMutation.mutate(item.id)}
                hitSlop={8}
              >
                <Ionicons name="trash-outline" size={16} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ThemedText style={[styles.messageContent, { color: theme.text }]}>
            {item.content}
          </ThemedText>

          <View style={styles.messageFooter}>
            <Pressable
              onPress={() => likeMutation.mutate(item.id)}
              style={[
                styles.likeButton,
                item.hasLiked ? { backgroundColor: theme.primary + "15" } : null,
              ]}
            >
              <Ionicons
                name={item.hasLiked ? "heart" : "heart-outline"}
                size={14}
                color={item.hasLiked ? theme.primary : theme.textMuted}
              />
              <ThemedText
                style={[
                  styles.likeCount,
                  { color: item.hasLiked ? theme.primary : theme.textMuted },
                ]}
              >
                {item.likesCount}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }, [user, theme, likeMutation, deleteMessageMutation]);

  const renderMessagesTab = () => {
    return (
      <View style={styles.messagesContainer}>
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.md,
            flexGrow: 1,
          }}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          refreshControl={
            <RefreshControl
              refreshing={messagesLoading}
              onRefresh={refetchMessages}
              tintColor={theme.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Ionicons name="chatbubbles-outline" size={40} color={theme.textMuted} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No messages yet. Start the conversation!
              </ThemedText>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={headerHeight + 60}
        >
          <View style={[styles.inputBar, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Write a message..."
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={500}
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              style={[
                styles.sendButton,
                {
                  backgroundColor: messageText.trim()
                    ? theme.primary
                    : theme.backgroundSecondary,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={messageText.trim() ? "#FFFFFF" : theme.textMuted}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  };

  const renderActivityTab = () => {
    const demandScore = metrics?.demandScore ?? 0;
    const clampedScore = Math.max(0, Math.min(1, demandScore));

    return (
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
        }}
        refreshControl={
          <RefreshControl refreshing={metricsLoading} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
      >
        <Animated.View entering={FadeInDown.duration(400)}>
          <View style={[styles.metricCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.metricTitle, { color: theme.textSecondary }]}>
              Current Demand
            </ThemedText>
            <View style={styles.demandBarContainer}>
              <View style={[styles.demandBarTrack, { backgroundColor: theme.backgroundSecondary }]}>
                <View
                  style={[
                    styles.demandBarFill,
                    {
                      width: `${clampedScore * 100}%` as any,
                      backgroundColor:
                        clampedScore >= 0.7
                          ? Colors.travonyGreen
                          : clampedScore >= 0.4
                          ? Colors.travonyGold
                          : theme.textMuted,
                    },
                  ]}
                />
              </View>
              <ThemedText style={[styles.demandPercent, { color: theme.text }]}>
                {Math.round(clampedScore * 100)}%
              </ThemedText>
            </View>
          </View>

          <View style={[styles.metricCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.metricRow}>
              <View style={styles.metricItem}>
                <Ionicons name="people-outline" size={22} color={theme.primary} />
                <ThemedText style={[styles.metricValue, { color: theme.text }]}>
                  {metrics?.activeCheckIns ?? 0}
                </ThemedText>
                <ThemedText style={[styles.metricLabel, { color: theme.textMuted }]}>
                  Active Check-ins
                </ThemedText>
              </View>
              <View style={[styles.metricDivider, { backgroundColor: theme.border }]} />
              <View style={styles.metricItem}>
                <Ionicons name="car-outline" size={22} color={theme.primary} />
                <ThemedText style={[styles.metricValue, { color: theme.text }]}>
                  {metrics?.recentRides ?? 0}
                </ThemedText>
                <ThemedText style={[styles.metricLabel, { color: theme.textMuted }]}>
                  Recent Rides
                </ThemedText>
              </View>
            </View>
          </View>

          {yieldEstimate ? (
            <Animated.View entering={SlideInRight.delay(200).duration(350)}>
              <View style={[styles.yieldCard, { backgroundColor: Colors.travonyGreen + "10" }]}>
                <Ionicons name="trending-up" size={24} color={Colors.travonyGreen} />
                <View style={styles.yieldInfo}>
                  <ThemedText style={[styles.yieldTitle, { color: Colors.travonyGreen }]}>
                    Yield Estimate
                  </ThemedText>
                  <ThemedText style={[styles.yieldValue, { color: theme.text }]}>
                    ${yieldEstimate.estimatedYieldPerHour.toFixed(0)}/hr
                  </ThemedText>
                  <ThemedText style={[styles.yieldConfidence, { color: theme.textMuted }]}>
                    {Math.round(yieldEstimate.confidence * 100)}% confidence
                  </ThemedText>
                </View>
              </View>
            </Animated.View>
          ) : null}

          {metrics?.peakHours && metrics.peakHours.length > 0 ? (
            <View style={[styles.metricCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.metricTitle, { color: theme.textSecondary }]}>
                Peak Hours
              </ThemedText>
              <View style={styles.peakHoursRow}>
                {metrics.peakHours.map((hour, idx) => (
                  <View
                    key={idx}
                    style={[styles.peakHourChip, { backgroundColor: Colors.travonyGold + "20" }]}
                  >
                    <Ionicons name="time-outline" size={12} color={Colors.travonyGold} />
                    <ThemedText style={[styles.peakHourText, { color: Colors.travonyGold }]}>
                      {hour}
                    </ThemedText>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </Animated.View>
      </KeyboardAwareScrollViewCompat>
    );
  };

  const renderCommunityTab = () => {
    return (
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: Spacing.lg,
          paddingTop: Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
          flexGrow: 1,
        }}
        data={leaderboard}
        keyExtractor={(item) => item.userId}
        refreshControl={
          <RefreshControl refreshing={leaderboardLoading} onRefresh={handleRefresh} tintColor={theme.primary} />
        }
        ListHeaderComponent={
          myPrestige ? (
            <Animated.View entering={FadeInDown.duration(350)}>
              <View style={[styles.myPrestigeCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.myPrestigeHeader}>
                  <Ionicons
                    name={TIER_ICONS[myPrestige.tier] || "shield-outline"}
                    size={28}
                    color={TIER_COLORS[myPrestige.tier] || theme.textMuted}
                  />
                  <View style={styles.myPrestigeInfo}>
                    <ThemedText style={[styles.myPrestigeLabel, { color: theme.textSecondary }]}>
                      Your Rank
                    </ThemedText>
                    <ThemedText style={[styles.myPrestigeRank, { color: theme.text }]}>
                      #{myPrestige.rank}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.myPrestigeDetails}>
                  <View style={[styles.tierBadge, { backgroundColor: (TIER_COLORS[myPrestige.tier] || theme.textMuted) + "20" }]}>
                    <ThemedText
                      style={[
                        styles.tierBadgeText,
                        { color: TIER_COLORS[myPrestige.tier] || theme.textMuted },
                      ]}
                    >
                      {myPrestige.tier.charAt(0).toUpperCase() + myPrestige.tier.slice(1)}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.pointsText, { color: theme.textSecondary }]}>
                    {myPrestige.points} pts
                  </ThemedText>
                </View>
              </View>
            </Animated.View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const tierColor = TIER_COLORS[item.tier] || theme.textMuted;
          const tierIcon = TIER_ICONS[item.tier] || "shield-outline";
          return (
            <Animated.View entering={FadeInUp.delay(index * 60).duration(300)}>
              <View style={[styles.leaderboardItem, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText style={[styles.rankNumber, { color: index < 3 ? Colors.travonyGold : theme.textMuted }]}>
                  {item.rank}
                </ThemedText>
                <View style={[styles.leaderAvatarCircle, { backgroundColor: tierColor + "20" }]}>
                  <Ionicons name={tierIcon} size={18} color={tierColor} />
                </View>
                <View style={styles.leaderInfo}>
                  <ThemedText style={[styles.leaderName, { color: theme.text }]}>
                    {item.userName}
                  </ThemedText>
                  <View style={styles.leaderMeta}>
                    <View style={[styles.miniTierBadge, { backgroundColor: tierColor + "15" }]}>
                      <ThemedText style={[styles.miniTierText, { color: tierColor }]}>
                        {item.tier.charAt(0).toUpperCase() + item.tier.slice(1)}
                      </ThemedText>
                    </View>
                  </View>
                </View>
                <ThemedText style={[styles.leaderPoints, { color: theme.textSecondary }]}>
                  {item.points} pts
                </ThemedText>
              </View>
            </Animated.View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyMessages}>
            <Ionicons name="trophy-outline" size={40} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No leaderboard data available yet.
            </ThemedText>
          </View>
        }
      />
    );
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.tabBar, { backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                styles.segmentTab,
                isActive
                  ? [styles.segmentTabActive, { backgroundColor: theme.primary }]
                  : { backgroundColor: "transparent" },
              ]}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={isActive ? "#FFFFFF" : theme.textMuted}
              />
              <ThemedText
                style={[
                  styles.segmentLabel,
                  { color: isActive ? "#FFFFFF" : theme.textMuted },
                ]}
              >
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {activeTab === "messages" ? renderMessagesTab() : null}
      {activeTab === "activity" ? renderActivityTab() : null}
      {activeTab === "community" ? renderCommunityTab() : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  segmentTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  segmentTabActive: {
    borderRadius: BorderRadius.sm,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  messagesContainer: {
    flex: 1,
  },
  messageCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  messageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  messageAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 14,
    fontWeight: "700",
  },
  messageAuthorInfo: {
    marginLeft: Spacing.sm,
  },
  authorName: {
    fontSize: 13,
    fontWeight: "600",
  },
  messageTime: {
    fontSize: 11,
    fontWeight: "400",
  },
  messageContent: {
    ...Typography.bodyMedium,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  likeButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  likeCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyMessages: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: Spacing["5xl"],
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  metricCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  metricTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  demandBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  demandBarTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  demandBarFill: {
    height: 8,
    borderRadius: 4,
  },
  demandPercent: {
    fontSize: 16,
    fontWeight: "700",
    minWidth: 44,
    textAlign: "right",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "700",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "400",
  },
  metricDivider: {
    width: 1,
    height: 40,
  },
  yieldCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    gap: Spacing.lg,
  },
  yieldInfo: {
    flex: 1,
  },
  yieldTitle: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  yieldValue: {
    fontSize: 24,
    fontWeight: "700",
    marginTop: 2,
  },
  yieldConfidence: {
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
  },
  peakHoursRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  peakHourChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  peakHourText: {
    fontSize: 12,
    fontWeight: "500",
  },
  myPrestigeCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  myPrestigeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  myPrestigeInfo: {
    flex: 1,
  },
  myPrestigeLabel: {
    fontSize: 12,
    fontWeight: "400",
  },
  myPrestigeRank: {
    fontSize: 24,
    fontWeight: "700",
  },
  myPrestigeDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  tierBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  pointsText: {
    fontSize: 13,
    fontWeight: "500",
  },
  leaderboardItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: "700",
    width: 28,
    textAlign: "center",
  },
  leaderAvatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  leaderInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  leaderName: {
    fontSize: 14,
    fontWeight: "600",
  },
  leaderMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  miniTierBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniTierText: {
    fontSize: 10,
    fontWeight: "600",
  },
  leaderPoints: {
    fontSize: 13,
    fontWeight: "600",
  },
});
