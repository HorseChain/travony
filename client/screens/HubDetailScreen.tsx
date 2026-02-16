import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  View, StyleSheet, FlatList, TextInput, Pressable,
  KeyboardAvoidingView, Platform, RefreshControl, ScrollView,
  Dimensions, ActivityIndicator,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, {
  FadeInDown, FadeInUp, SlideInRight, FadeIn, FadeOut,
  useSharedValue, useAnimatedStyle, withRepeat, withTiming,
  withSequence, Easing,
} from "react-native-reanimated";
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

type TabKey = "activity" | "livefeed" | "insights";

type MessageCategory = "demand_insight" | "traffic_alert" | "event_signal" | "availability_update";

interface HubMessage {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  category: MessageCategory | null;
  aiScore: number | null;
  createdAt: string;
  likesCount: number;
  hasLiked?: boolean;
  isCurated?: boolean;
  reportCount?: number;
}

interface HubIntelligence {
  activityScore: number;
  vehiclesActive: number;
  networkMembers: number;
  predictedYield: { amount: number; window: string; confidence: number };
  demandTrend: Array<{ time: string; demand: number }>;
  vehicleTicker: Array<{ type: "arrival" | "departure"; vehicleType: string; timeAgo: string }>;
  aiRecommendation: { title: string; message: string; priority: "high" | "medium" | "low" };
  nextLikelyHub: { hubId: string; hubName: string; probability: number; distance: number } | null;
  migrationPatterns: Array<{ fromHub: string; toHub: string; frequency: number }>;
  seasonalBehavior: { currentTrend: string; peakDay: string; peakHour: string };
}

interface HubInsights {
  role: string;
  avgYieldPerHour?: number;
  bestActivationTimes?: string[];
  contributionScore?: number;
  weeklyEarningsTrend?: Array<{ day: string; earnings: number }>;
  totalRidesThisMonth?: number;
  avgRating?: number;
  avgWaitTime?: number;
  peakActivityWindows?: string[];
  hubReliabilityScore?: number;
  weeklyRidesTrend?: Array<{ day: string; rides: number }>;
  favoriteHub?: { name: string; visits: number } | null;
}

const CATEGORY_CONFIG: Record<MessageCategory, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  demand_insight: { label: "Demand", icon: "trending-up", color: Colors.travonyGreen },
  traffic_alert: { label: "Traffic", icon: "warning-outline", color: "#FF6B6B" },
  event_signal: { label: "Event", icon: "calendar-outline", color: "#7C4DFF" },
  availability_update: { label: "Available", icon: "checkmark-circle-outline", color: "#2196F3" },
};

const CATEGORIES: MessageCategory[] = ["demand_insight", "traffic_alert", "event_signal", "availability_update"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

function getTimeAgo(dateString: string): string {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  return `${Math.floor(diffHr / 24)}d`;
}

function PulseIndicator({ color, size = 8 }: { color: string; size?: number }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animStyle,
      ]}
    />
  );
}

function MiniBarChart({ data, maxValue, color, height = 40 }: {
  data: number[];
  maxValue: number;
  color: string;
  height?: number;
}) {
  const barWidth = Math.max(3, (SCREEN_WIDTH - 120) / Math.max(data.length, 1) - 2);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: 2 }}>
      {data.map((v, i) => (
        <View
          key={i}
          style={{
            width: barWidth,
            height: Math.max(2, (v / Math.max(maxValue, 1)) * height),
            backgroundColor: color,
            borderRadius: 2,
            opacity: 0.4 + (v / Math.max(maxValue, 1)) * 0.6,
          }}
        />
      ))}
    </View>
  );
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
  const isDriver = user?.role === "driver";
  const [activeTab, setActiveTab] = useState<TabKey>("activity");
  const [messageText, setMessageText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory>("demand_insight");
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const intelligenceKey = [`/api/openclaw/hubs/${hubId}/intelligence`];
  const messagesKey = [`/api/openclaw/hubs/${hubId}/messages`];
  const insightsKey = [`/api/openclaw/hubs/${hubId}/insights`];

  const { data: intel, isLoading: intelLoading, refetch: refetchIntel } = useQuery<HubIntelligence>({
    queryKey: intelligenceKey,
    refetchInterval: 30000,
  });

  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<HubMessage[]>({
    queryKey: messagesKey,
    enabled: activeTab === "livefeed",
    refetchInterval: 10000,
  });

  const { data: insights, isLoading: insightsLoading, refetch: refetchInsights } = useQuery<HubInsights>({
    queryKey: insightsKey,
    enabled: activeTab === "insights",
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (params: { content: string; category: MessageCategory }) => {
      return apiRequest(`/api/openclaw/hubs/${hubId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
    },
    onSuccess: () => {
      setMessageText("");
      setShowCategoryPicker(false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      queryClient.invalidateQueries({ queryKey: messagesKey });
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
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });

  const reportMutation = useMutation({
    mutationFn: async (messageId: string) => {
      return apiRequest(`/api/openclaw/messages/${messageId}/report`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });

  const handleSendMessage = useCallback(() => {
    const trimmed = messageText.trim();
    if (!trimmed) return;
    sendMessageMutation.mutate({ content: trimmed, category: selectedCategory });
  }, [messageText, selectedCategory, sendMessageMutation]);

  const handleRefresh = useCallback(async () => {
    if (activeTab === "activity") await refetchIntel();
    if (activeTab === "livefeed") await refetchMessages();
    if (activeTab === "insights") await refetchInsights();
  }, [activeTab, refetchIntel, refetchMessages, refetchInsights]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedMessages(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const tabs: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "activity", label: "Activity", icon: "pulse-outline" },
    { key: "livefeed", label: "Live Feed", icon: "chatbubbles-outline" },
    { key: "insights", label: "Insights", icon: "analytics-outline" },
  ];

  const activityScoreColor = useMemo(() => {
    const score = intel?.activityScore ?? 0;
    if (score >= 70) return Colors.travonyGreen;
    if (score >= 40) return Colors.travonyGold;
    return theme.textMuted;
  }, [intel?.activityScore, theme.textMuted]);

  const renderIntelligenceHeader = () => {
    const score = intel?.activityScore ?? 0;
    const vehicles = intel?.vehiclesActive ?? 0;
    const members = intel?.networkMembers ?? 0;
    const yieldAmt = intel?.predictedYield?.amount ?? 0;
    const yieldWindow = intel?.predictedYield?.window ?? "--";
    const confidence = intel?.predictedYield?.confidence ?? 0;

    return (
      <Animated.View entering={FadeInDown.duration(400)}>
        <View style={[s.headerCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={s.headerTop}>
            <View style={s.scoreContainer}>
              <View style={[s.scoreCircle, { borderColor: activityScoreColor }]}>
                <ThemedText style={[s.scoreValue, { color: activityScoreColor }]}>
                  {score}
                </ThemedText>
              </View>
              <ThemedText style={[s.scoreLabel, { color: theme.textMuted }]}>
                Activity
              </ThemedText>
            </View>

            <View style={s.headerStats}>
              <View style={s.headerStatItem}>
                <Ionicons name="car-outline" size={16} color={theme.primary} />
                <ThemedText style={[s.headerStatValue, { color: theme.text }]}>{vehicles}</ThemedText>
                <ThemedText style={[s.headerStatLabel, { color: theme.textMuted }]}>Vehicles</ThemedText>
              </View>
              <View style={[s.headerDivider, { backgroundColor: theme.border }]} />
              <View style={s.headerStatItem}>
                <Ionicons name="people-outline" size={16} color={theme.primary} />
                <ThemedText style={[s.headerStatValue, { color: theme.text }]}>{members}</ThemedText>
                <ThemedText style={[s.headerStatLabel, { color: theme.textMuted }]}>Nearby</ThemedText>
              </View>
              <View style={[s.headerDivider, { backgroundColor: theme.border }]} />
              <View style={s.headerStatItem}>
                <Ionicons name="wallet-outline" size={16} color={Colors.travonyGreen} />
                <ThemedText style={[s.headerStatValue, { color: theme.text }]}>${yieldAmt}</ThemedText>
                <ThemedText style={[s.headerStatLabel, { color: theme.textMuted }]}>/hr</ThemedText>
              </View>
            </View>
          </View>

          <View style={s.headerBottom}>
            <View style={s.yieldWindowRow}>
              <PulseIndicator color={activityScoreColor} />
              <ThemedText style={[s.yieldWindowText, { color: theme.textSecondary }]}>
                {yieldWindow}
              </ThemedText>
            </View>
            <View style={[s.confidenceBadge, { backgroundColor: activityScoreColor + "15" }]}>
              <ThemedText style={[s.confidenceText, { color: activityScoreColor }]}>
                {Math.round(confidence * 100)}% AI Confidence
              </ThemedText>
            </View>
          </View>
        </View>
      </Animated.View>
    );
  };

  const renderActivityTab = () => {
    const trend = intel?.demandTrend ?? [];
    const trendValues = trend.map(t => t.demand);
    const maxDemand = Math.max(...trendValues, 1);
    const ticker = intel?.vehicleTicker ?? [];
    const rec = intel?.aiRecommendation;
    const nextHub = intel?.nextLikelyHub;
    const migration = intel?.migrationPatterns ?? [];
    const seasonal = intel?.seasonalBehavior;

    return (
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={intelLoading} onRefresh={handleRefresh} tintColor={theme.primary} />}
      >
        {rec ? (
          <Animated.View entering={FadeInDown.delay(100).duration(350)}>
            <View style={[s.aiRecCard, {
              backgroundColor: rec.priority === "high" ? Colors.travonyGreen + "10" : rec.priority === "medium" ? Colors.travonyGold + "10" : theme.backgroundDefault,
            }]}>
              <View style={s.aiRecHeader}>
                <Ionicons
                  name="sparkles"
                  size={18}
                  color={rec.priority === "high" ? Colors.travonyGreen : rec.priority === "medium" ? Colors.travonyGold : theme.primary}
                />
                <ThemedText style={[s.aiRecTitle, { color: theme.text }]}>{rec.title}</ThemedText>
                <View style={[s.priorityBadge, {
                  backgroundColor: rec.priority === "high" ? Colors.travonyGreen + "20" : rec.priority === "medium" ? Colors.travonyGold + "20" : theme.backgroundSecondary,
                }]}>
                  <ThemedText style={[s.priorityText, {
                    color: rec.priority === "high" ? Colors.travonyGreen : rec.priority === "medium" ? Colors.travonyGold : theme.textMuted,
                  }]}>
                    {rec.priority}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={[s.aiRecMessage, { color: theme.textSecondary }]}>{rec.message}</ThemedText>
            </View>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(200).duration(350)}>
          <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
              Demand Trend (30min)
            </ThemedText>
            {trend.length > 0 ? (
              <View style={s.trendContainer}>
                <MiniBarChart data={trendValues} maxValue={maxDemand} color={theme.primary} height={48} />
                <View style={s.trendLabels}>
                  <ThemedText style={[s.trendLabel, { color: theme.textMuted }]}>
                    {trend[0]?.time ?? ""}
                  </ThemedText>
                  <ThemedText style={[s.trendLabel, { color: theme.textMuted }]}>
                    {trend[trend.length - 1]?.time ?? ""}
                  </ThemedText>
                </View>
              </View>
            ) : (
              <ThemedText style={[s.emptyHint, { color: theme.textMuted }]}>No trend data available</ThemedText>
            )}
          </View>
        </Animated.View>

        {ticker.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(300).duration(350)}>
            <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
                Vehicle Activity
              </ThemedText>
              {ticker.slice(0, 5).map((t, i) => (
                <View key={i} style={s.tickerRow}>
                  <View style={[s.tickerDot, {
                    backgroundColor: t.type === "arrival" ? Colors.travonyGreen : "#FF6B6B",
                  }]} />
                  <Ionicons
                    name={t.type === "arrival" ? "arrow-down-circle-outline" : "arrow-up-circle-outline"}
                    size={16}
                    color={t.type === "arrival" ? Colors.travonyGreen : "#FF6B6B"}
                  />
                  <ThemedText style={[s.tickerText, { color: theme.text }]}>
                    {t.vehicleType} {t.type === "arrival" ? "arrived" : "departed"}
                  </ThemedText>
                  <ThemedText style={[s.tickerTime, { color: theme.textMuted }]}>{t.timeAgo}</ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {nextHub ? (
          <Animated.View entering={SlideInRight.delay(400).duration(350)}>
            <View style={[s.sectionCard, { backgroundColor: theme.primary + "08" }]}>
              <View style={s.nextHubRow}>
                <Ionicons name="navigate-outline" size={20} color={theme.primary} />
                <View style={s.nextHubInfo}>
                  <ThemedText style={[s.nextHubTitle, { color: theme.text }]}>
                    Next Likely Hub
                  </ThemedText>
                  <ThemedText style={[s.nextHubName, { color: theme.primary }]}>
                    {nextHub.hubName}
                  </ThemedText>
                  <ThemedText style={[s.nextHubMeta, { color: theme.textMuted }]}>
                    {nextHub.distance.toFixed(1)}km away  |  {Math.round(nextHub.probability * 100)}% probability
                  </ThemedText>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}

        {migration.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(500).duration(350)}>
            <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
                Migration Patterns
              </ThemedText>
              {migration.slice(0, 3).map((m, i) => (
                <View key={i} style={s.migrationRow}>
                  <ThemedText style={[s.migrationHub, { color: theme.text }]} numberOfLines={1}>
                    {m.fromHub}
                  </ThemedText>
                  <Ionicons name="arrow-forward" size={14} color={theme.textMuted} />
                  <ThemedText style={[s.migrationHub, { color: theme.text }]} numberOfLines={1}>
                    {m.toHub}
                  </ThemedText>
                  <ThemedText style={[s.migrationFreq, { color: theme.primary }]}>
                    {m.frequency}x
                  </ThemedText>
                </View>
              ))}
            </View>
          </Animated.View>
        ) : null}

        {seasonal ? (
          <Animated.View entering={FadeInDown.delay(600).duration(350)}>
            <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
                Seasonal Behavior
              </ThemedText>
              <View style={s.seasonalGrid}>
                <View style={s.seasonalItem}>
                  <Ionicons name="trending-up" size={16} color={theme.primary} />
                  <ThemedText style={[s.seasonalValue, { color: theme.text }]}>{seasonal.currentTrend}</ThemedText>
                  <ThemedText style={[s.seasonalLabel, { color: theme.textMuted }]}>Trend</ThemedText>
                </View>
                <View style={s.seasonalItem}>
                  <Ionicons name="calendar-outline" size={16} color={Colors.travonyGold} />
                  <ThemedText style={[s.seasonalValue, { color: theme.text }]}>{seasonal.peakDay}</ThemedText>
                  <ThemedText style={[s.seasonalLabel, { color: theme.textMuted }]}>Peak Day</ThemedText>
                </View>
                <View style={s.seasonalItem}>
                  <Ionicons name="time-outline" size={16} color="#2196F3" />
                  <ThemedText style={[s.seasonalValue, { color: theme.text }]}>{seasonal.peakHour}</ThemedText>
                  <ThemedText style={[s.seasonalLabel, { color: theme.textMuted }]}>Peak Hour</ThemedText>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    );
  };

  const renderMessageItem = useCallback(({ item, index }: { item: HubMessage; index: number }) => {
    const isOwn = item.authorId === user?.id;
    const isExpanded = expandedMessages.has(item.id);
    const isLongContent = item.content.length > 120;
    const catConfig = item.category ? CATEGORY_CONFIG[item.category] : null;
    const isHighlighted = (item.aiScore ?? 0) >= 0.7;

    return (
      <Animated.View entering={FadeInUp.delay(Math.min(index * 40, 300)).duration(300)}>
        <View style={[s.feedCard, { backgroundColor: theme.backgroundDefault },
          isHighlighted ? { borderLeftWidth: 2, borderLeftColor: Colors.travonyGold } : null,
        ]}>
          <View style={s.feedCardHeader}>
            <View style={[s.avatar, { backgroundColor: theme.primary + "15" }]}>
              <ThemedText style={[s.avatarLetter, { color: theme.primary }]}>
                {item.authorName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
            <View style={s.feedAuthorInfo}>
              <View style={s.feedAuthorRow}>
                <ThemedText style={[s.feedAuthorName, { color: theme.text }]}>
                  {item.authorName}
                </ThemedText>
                {isHighlighted ? (
                  <View style={[s.aiHighlightBadge, { backgroundColor: Colors.travonyGold + "15" }]}>
                    <Ionicons name="sparkles" size={10} color={Colors.travonyGold} />
                    <ThemedText style={[s.aiHighlightText, { color: Colors.travonyGold }]}>AI Pick</ThemedText>
                  </View>
                ) : null}
              </View>
              <View style={s.feedMetaRow}>
                <ThemedText style={[s.feedTime, { color: theme.textMuted }]}>
                  {getTimeAgo(item.createdAt)}
                </ThemedText>
                {catConfig ? (
                  <View style={[s.categoryBadge, { backgroundColor: catConfig.color + "12" }]}>
                    <Ionicons name={catConfig.icon} size={10} color={catConfig.color} />
                    <ThemedText style={[s.categoryText, { color: catConfig.color }]}>{catConfig.label}</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
            {!isOwn ? (
              <Pressable
                onPress={() => reportMutation.mutate(item.id)}
                hitSlop={12}
                style={s.reportButton}
              >
                <Ionicons name="flag-outline" size={14} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <ThemedText
            style={[s.feedContent, { color: theme.text }]}
            numberOfLines={isLongContent && !isExpanded ? 2 : undefined}
          >
            {item.content}
          </ThemedText>
          {isLongContent ? (
            <Pressable onPress={() => toggleExpand(item.id)}>
              <ThemedText style={[s.expandText, { color: theme.primary }]}>
                {isExpanded ? "Show less" : "Read more"}
              </ThemedText>
            </Pressable>
          ) : null}

          <View style={s.feedActions}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                likeMutation.mutate(item.id);
              }}
              style={[s.reactionButton, item.hasLiked ? { backgroundColor: theme.primary + "10" } : null]}
            >
              <Ionicons
                name={item.hasLiked ? "heart" : "heart-outline"}
                size={14}
                color={item.hasLiked ? theme.primary : theme.textMuted}
              />
              <ThemedText style={[s.reactionCount, { color: item.hasLiked ? theme.primary : theme.textMuted }]}>
                {item.likesCount}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Animated.View>
    );
  }, [user, theme, expandedMessages, likeMutation, reportMutation, toggleExpand]);

  const renderLiveFeedTab = () => {
    return (
      <View style={{ flex: 1 }}>
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
          refreshControl={<RefreshControl refreshing={messagesLoading} onRefresh={refetchMessages} tintColor={theme.primary} />}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={36} color={theme.textMuted} />
              <ThemedText style={[s.emptyTitle, { color: theme.textSecondary }]}>
                No signals yet
              </ThemedText>
              <ThemedText style={[s.emptyHint, { color: theme.textMuted }]}>
                Share local insights with the community
              </ThemedText>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={headerHeight + 60}
        >
          {showCategoryPicker ? (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.categoryPickerRow}
                style={[s.categoryPicker, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}
              >
                {CATEGORIES.map(cat => {
                  const cfg = CATEGORY_CONFIG[cat];
                  const isSelected = selectedCategory === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => {
                        setSelectedCategory(cat);
                        Haptics.selectionAsync();
                      }}
                      style={[s.categoryChip, {
                        backgroundColor: isSelected ? cfg.color + "20" : theme.backgroundSecondary,
                        borderColor: isSelected ? cfg.color + "40" : "transparent",
                        borderWidth: 1,
                      }]}
                    >
                      <Ionicons name={cfg.icon} size={14} color={isSelected ? cfg.color : theme.textMuted} />
                      <ThemedText style={[s.categoryChipText, { color: isSelected ? cfg.color : theme.textMuted }]}>
                        {cfg.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </Animated.View>
          ) : null}

          <View style={[s.inputBar, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border }]}>
            <Pressable
              onPress={() => {
                setShowCategoryPicker(!showCategoryPicker);
                Haptics.selectionAsync();
              }}
              style={[s.categoryToggle, { backgroundColor: CATEGORY_CONFIG[selectedCategory].color + "15" }]}
            >
              <Ionicons
                name={CATEGORY_CONFIG[selectedCategory].icon}
                size={16}
                color={CATEGORY_CONFIG[selectedCategory].color}
              />
            </Pressable>
            <TextInput
              style={[s.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Share an insight..."
              placeholderTextColor={theme.textMuted}
              multiline
              maxLength={500}
              onFocus={() => setShowCategoryPicker(false)}
            />
            <Pressable
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              style={[s.sendButton, {
                backgroundColor: messageText.trim() ? theme.primary : theme.backgroundSecondary,
              }]}
            >
              <Ionicons name="send" size={16} color={messageText.trim() ? "#FFFFFF" : theme.textMuted} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    );
  };

  const renderInsightsTab = () => {
    if (insightsLoading) {
      return (
        <View style={s.loadingContainer}>
          <ActivityIndicator color={theme.primary} />
        </View>
      );
    }

    if (!insights) {
      return (
        <View style={s.emptyState}>
          <Ionicons name="analytics-outline" size={36} color={theme.textMuted} />
          <ThemedText style={[s.emptyTitle, { color: theme.textSecondary }]}>
            No insights available
          </ThemedText>
        </View>
      );
    }

    if (insights.role === "driver") {
      const weeklyData = insights.weeklyEarningsTrend ?? [];
      const maxEarning = Math.max(...weeklyData.map(d => d.earnings), 1);

      return (
        <KeyboardAwareScrollViewCompat
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing["3xl"] }}
          refreshControl={<RefreshControl refreshing={insightsLoading} onRefresh={refetchInsights} tintColor={theme.primary} />}
        >
          <Animated.View entering={FadeInDown.duration(350)}>
            <View style={s.insightGrid}>
              <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="cash-outline" size={20} color={Colors.travonyGreen} />
                <ThemedText style={[s.insightValue, { color: theme.text }]}>
                  ${insights.avgYieldPerHour?.toFixed(0) ?? "0"}
                </ThemedText>
                <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Avg Yield/hr</ThemedText>
              </View>
              <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="star-outline" size={20} color={Colors.travonyGold} />
                <ThemedText style={[s.insightValue, { color: theme.text }]}>
                  {insights.contributionScore ?? 0}
                </ThemedText>
                <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Contribution</ThemedText>
              </View>
              <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="car-outline" size={20} color={theme.primary} />
                <ThemedText style={[s.insightValue, { color: theme.text }]}>
                  {insights.totalRidesThisMonth ?? 0}
                </ThemedText>
                <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Rides/Month</ThemedText>
              </View>
              <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="thumbs-up-outline" size={20} color="#2196F3" />
                <ThemedText style={[s.insightValue, { color: theme.text }]}>
                  {insights.avgRating?.toFixed(1) ?? "0.0"}
                </ThemedText>
                <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Rating</ThemedText>
              </View>
            </View>
          </Animated.View>

          {insights.bestActivationTimes && insights.bestActivationTimes.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(150).duration(350)}>
              <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
                  Best Activation Times
                </ThemedText>
                <View style={s.timeSlotsRow}>
                  {insights.bestActivationTimes.map((t, i) => (
                    <View key={i} style={[s.timeSlotChip, { backgroundColor: Colors.travonyGreen + "12" }]}>
                      <Ionicons name="time-outline" size={12} color={Colors.travonyGreen} />
                      <ThemedText style={[s.timeSlotText, { color: Colors.travonyGreen }]}>{t}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          ) : null}

          {weeklyData.length > 0 ? (
            <Animated.View entering={FadeInDown.delay(300).duration(350)}>
              <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
                <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
                  Weekly Earnings
                </ThemedText>
                <View style={s.weeklyChart}>
                  {weeklyData.map((d, i) => (
                    <View key={i} style={s.weeklyBarCol}>
                      <View style={[s.weeklyBar, {
                        height: Math.max(4, (d.earnings / maxEarning) * 60),
                        backgroundColor: Colors.travonyGreen,
                        opacity: 0.4 + (d.earnings / maxEarning) * 0.6,
                      }]} />
                      <ThemedText style={[s.weeklyDayLabel, { color: theme.textMuted }]}>{d.day}</ThemedText>
                    </View>
                  ))}
                </View>
              </View>
            </Animated.View>
          ) : null}
        </KeyboardAwareScrollViewCompat>
      );
    }

    const weeklyRides = insights.weeklyRidesTrend ?? [];
    const maxRides = Math.max(...weeklyRides.map(d => d.rides), 1);

    return (
      <KeyboardAwareScrollViewCompat
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: insets.bottom + Spacing["3xl"] }}
        refreshControl={<RefreshControl refreshing={insightsLoading} onRefresh={refetchInsights} tintColor={theme.primary} />}
      >
        <Animated.View entering={FadeInDown.duration(350)}>
          <View style={s.insightGrid}>
            <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
              <Ionicons name="time-outline" size={20} color={theme.primary} />
              <ThemedText style={[s.insightValue, { color: theme.text }]}>
                {insights.avgWaitTime?.toFixed(0) ?? "0"}m
              </ThemedText>
              <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Avg Wait</ThemedText>
            </View>
            <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color={Colors.travonyGreen} />
              <ThemedText style={[s.insightValue, { color: theme.text }]}>
                {insights.hubReliabilityScore ?? 0}%
              </ThemedText>
              <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Reliable</ThemedText>
            </View>
            <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
              <Ionicons name="car-outline" size={20} color={Colors.travonyGold} />
              <ThemedText style={[s.insightValue, { color: theme.text }]}>
                {insights.totalRidesThisMonth ?? 0}
              </ThemedText>
              <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Rides/Month</ThemedText>
            </View>
            <View style={[s.insightCardSmall, { backgroundColor: theme.backgroundDefault }]}>
              <Ionicons name="location-outline" size={20} color="#7C4DFF" />
              <ThemedText style={[s.insightValue, { color: theme.text }]} numberOfLines={1}>
                {insights.favoriteHub?.name ?? "--"}
              </ThemedText>
              <ThemedText style={[s.insightLabel, { color: theme.textMuted }]}>Favorite</ThemedText>
            </View>
          </View>
        </Animated.View>

        {insights.peakActivityWindows && insights.peakActivityWindows.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(150).duration(350)}>
            <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
                Peak Activity Windows
              </ThemedText>
              <View style={s.timeSlotsRow}>
                {insights.peakActivityWindows.map((t, i) => (
                  <View key={i} style={[s.timeSlotChip, { backgroundColor: theme.primary + "12" }]}>
                    <Ionicons name="time-outline" size={12} color={theme.primary} />
                    <ThemedText style={[s.timeSlotText, { color: theme.primary }]}>{t}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}

        {weeklyRides.length > 0 ? (
          <Animated.View entering={FadeInDown.delay(300).duration(350)}>
            <View style={[s.sectionCard, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[s.sectionTitle, { color: theme.textSecondary }]}>
                Weekly Activity
              </ThemedText>
              <View style={s.weeklyChart}>
                {weeklyRides.map((d, i) => (
                  <View key={i} style={s.weeklyBarCol}>
                    <View style={[s.weeklyBar, {
                      height: Math.max(4, (d.rides / maxRides) * 60),
                      backgroundColor: theme.primary,
                      opacity: 0.4 + (d.rides / maxRides) * 0.6,
                    }]} />
                    <ThemedText style={[s.weeklyDayLabel, { color: theme.textMuted }]}>{d.day}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        ) : null}
      </KeyboardAwareScrollViewCompat>
    );
  };

  const renderBottomActionBar = () => {
    return (
      <View style={[s.bottomBar, { backgroundColor: theme.backgroundDefault, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.sm }]}>
        {isDriver ? (
          <View style={s.bottomBarContent}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={[s.primaryAction, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="navigate" size={18} color="#FFFFFF" />
              <ThemedText style={s.primaryActionText}>Navigate Here</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[s.secondaryAction, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Ionicons name="checkmark-circle-outline" size={18} color={theme.text} />
            </Pressable>
          </View>
        ) : (
          <View style={s.bottomBarContent}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              }}
              style={[s.primaryAction, { backgroundColor: theme.primary }]}
            >
              <Ionicons name="car" size={18} color="#FFFFFF" />
              <ThemedText style={s.primaryActionText}>Book from Hub</ThemedText>
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[s.secondaryAction, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Ionicons name="bookmark-outline" size={18} color={theme.text} />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={s.container}>
      {renderIntelligenceHeader()}

      <View style={[s.tabBar, { backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border }]}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                setActiveTab(tab.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[s.segmentTab, isActive ? [s.segmentTabActive, { backgroundColor: theme.primary }] : { backgroundColor: "transparent" }]}
            >
              <Ionicons name={tab.icon} size={15} color={isActive ? "#FFFFFF" : theme.textMuted} />
              <ThemedText style={[s.segmentLabel, { color: isActive ? "#FFFFFF" : theme.textMuted }]}>
                {tab.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <View style={{ flex: 1 }}>
        {activeTab === "activity" ? renderActivityTab() : null}
        {activeTab === "livefeed" ? renderLiveFeedTab() : null}
        {activeTab === "insights" ? renderInsightsTab() : null}
      </View>

      {activeTab !== "livefeed" ? renderBottomActionBar() : null}
    </ThemedView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  headerCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  scoreContainer: { alignItems: "center", gap: 4 },
  scoreCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreValue: { fontSize: 18, fontWeight: "700" },
  scoreLabel: { fontSize: 10, fontWeight: "500" },
  headerStats: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },
  headerStatItem: { alignItems: "center", gap: 2 },
  headerStatValue: { fontSize: 16, fontWeight: "700" },
  headerStatLabel: { fontSize: 10, fontWeight: "400" },
  headerDivider: { width: 1, height: 28, opacity: 0.5 },
  headerBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(128,128,128,0.15)",
  },
  yieldWindowRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  yieldWindowText: { fontSize: 11, fontWeight: "500" },
  confidenceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.xs,
  },
  confidenceText: { fontSize: 10, fontWeight: "600" },
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
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  segmentTabActive: { borderRadius: BorderRadius.sm },
  segmentLabel: { fontSize: 12, fontWeight: "600" },
  sectionCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 13, fontWeight: "600", marginBottom: Spacing.md },
  aiRecCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  aiRecHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  aiRecTitle: { fontSize: 14, fontWeight: "600", flex: 1 },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityText: { fontSize: 10, fontWeight: "600", textTransform: "capitalize" },
  aiRecMessage: { fontSize: 13, fontWeight: "400", lineHeight: 18 },
  trendContainer: { gap: Spacing.sm },
  trendLabels: { flexDirection: "row", justifyContent: "space-between" },
  trendLabel: { fontSize: 10, fontWeight: "400" },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 6,
  },
  tickerDot: { width: 6, height: 6, borderRadius: 3 },
  tickerText: { fontSize: 12, fontWeight: "500", flex: 1 },
  tickerTime: { fontSize: 11, fontWeight: "400" },
  nextHubRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  nextHubInfo: { flex: 1 },
  nextHubTitle: { fontSize: 11, fontWeight: "500", marginBottom: 2 },
  nextHubName: { fontSize: 15, fontWeight: "700" },
  nextHubMeta: { fontSize: 11, fontWeight: "400", marginTop: 2 },
  migrationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 5,
  },
  migrationHub: { fontSize: 12, fontWeight: "500", flex: 1 },
  migrationFreq: { fontSize: 13, fontWeight: "700" },
  seasonalGrid: { flexDirection: "row", justifyContent: "space-between" },
  seasonalItem: { alignItems: "center", gap: 4, flex: 1 },
  seasonalValue: { fontSize: 13, fontWeight: "600" },
  seasonalLabel: { fontSize: 10, fontWeight: "400" },
  feedCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  feedCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.sm },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 14, fontWeight: "700" },
  feedAuthorInfo: { flex: 1, marginLeft: Spacing.sm },
  feedAuthorRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  feedAuthorName: { fontSize: 13, fontWeight: "600" },
  aiHighlightBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 2,
  },
  aiHighlightText: { fontSize: 9, fontWeight: "600" },
  feedMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 1 },
  feedTime: { fontSize: 11, fontWeight: "400" },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    gap: 3,
  },
  categoryText: { fontSize: 10, fontWeight: "600" },
  reportButton: { padding: 4 },
  feedContent: { fontSize: 13, fontWeight: "400", lineHeight: 19 },
  expandText: { fontSize: 12, fontWeight: "500", marginTop: 4 },
  feedActions: { flexDirection: "row", marginTop: Spacing.sm, gap: Spacing.md },
  reactionButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  reactionCount: { fontSize: 12, fontWeight: "500" },
  categoryPicker: { borderTopWidth: StyleSheet.hairlineWidth },
  categoryPickerRow: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    gap: 5,
  },
  categoryChipText: { fontSize: 12, fontWeight: "600" },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  categoryToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    fontSize: 14,
    maxHeight: 80,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["5xl"],
    gap: Spacing.sm,
  },
  emptyTitle: { fontSize: 15, fontWeight: "600" },
  emptyHint: { fontSize: 13, fontWeight: "400", textAlign: "center" },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: Spacing["5xl"] },
  insightGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  insightCardSmall: {
    width: (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm) / 2 - 1,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    gap: 4,
  },
  insightValue: { fontSize: 18, fontWeight: "700" },
  insightLabel: { fontSize: 10, fontWeight: "500" },
  timeSlotsRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  timeSlotChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.xs,
    gap: 4,
  },
  timeSlotText: { fontSize: 12, fontWeight: "600" },
  weeklyChart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    height: 80,
  },
  weeklyBarCol: { alignItems: "center", flex: 1, gap: 4 },
  weeklyBar: { width: 20, borderRadius: 4 },
  weeklyDayLabel: { fontSize: 10, fontWeight: "500" },
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  bottomBarContent: { flexDirection: "row", gap: Spacing.sm },
  primaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  primaryActionText: { fontSize: 14, fontWeight: "600", color: "#FFFFFF" },
  secondaryAction: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
