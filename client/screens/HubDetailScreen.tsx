import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  Platform,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { useAuth } from "@/hooks/useAuth";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";

type TabKey = "activity" | "livefeed" | "insights" | "ev";
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
  totalRidesThisMonth?: number;
  avgRating?: number;
  avgWaitTime?: number;
  peakActivityWindows?: string[];
  hubReliabilityScore?: number;
  favoriteHub?: { name: string; visits: number } | null;
}

interface HubEvStatus {
  hubId: string;
  isEvHub: boolean;
  totalChargingPorts: number;
  availablePorts: number;
  occupancyRate: number;
  evDriversPresent: number;
  evStagingBreakdown: { charging: number; ready: number; departing: number };
  nearestReadyMinutes: number | null;
  estimatedReadyTimes: { userId: string; minutesRemaining: number }[];
}

const CATEGORY_CONFIG: Record<MessageCategory, { label: string; icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  demand_insight: { label: "Demand", icon: "trending-up", color: Colors.travonyGreen },
  traffic_alert: { label: "Traffic", icon: "warning-outline", color: Colors.light.error },
  event_signal: { label: "Event", icon: "calendar-outline", color: Colors.eventPurple },
  availability_update: { label: "Available", icon: "checkmark-circle-outline", color: Colors.light.info },
};

const CATEGORIES: MessageCategory[] = ["demand_insight", "traffic_alert", "event_signal", "availability_update"];

function getTimeAgo(dateString: string): string {
  try {
    const diffMs = Date.now() - new Date(dateString).getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "now";
    if (diffMin < 60) return `${diffMin}m`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h`;
    return `${Math.floor(diffHr / 24)}d`;
  } catch {
    return "";
  }
}

export default function HubDetailScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const hubId = route.params?.hubId || "";
  const hubName = route.params?.hubName || "Hub";
  const isDriver = user?.role === "driver";
  const [activeTab, setActiveTab] = useState<TabKey>("activity");
  const [messageText, setMessageText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<MessageCategory>("demand_insight");
  const [refreshing, setRefreshing] = useState(false);
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  const hubDetailKey = [`/api/openclaw/hubs/${hubId}`];
  const intelligenceKey = [`/api/openclaw/hubs/${hubId}/intelligence`];
  const messagesKey = [`/api/openclaw/hubs/${hubId}/messages`];
  const insightsKey = [`/api/openclaw/hubs/${hubId}/insights`];

  const { data: hubDetail } = useQuery<{
    id: string; name: string; isEvHub: boolean;
    totalChargingPorts: number; availablePorts: number;
    avgDemandScore: string; address: string; type: string;
    lat: string; lng: string;
  }>({
    queryKey: hubDetailKey,
    enabled: !!hubId,
  });

  const { data: intel, isLoading: intelLoading, refetch: refetchIntel } = useQuery<HubIntelligence>({
    queryKey: intelligenceKey,
    enabled: !!hubId,
  });

  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useQuery<HubMessage[]>({
    queryKey: messagesKey,
    enabled: activeTab === "livefeed" && !!hubId,
  });

  const { data: insights, isLoading: insightsLoading } = useQuery<HubInsights>({
    queryKey: insightsKey,
    enabled: activeTab === "insights" && !!hubId,
  });

  const evStatusKey = [`/api/openclaw/hubs/${hubId}/ev-status`];
  const { data: evStatus, isLoading: evStatusLoading } = useQuery<HubEvStatus>({
    queryKey: evStatusKey,
    enabled: activeTab === "ev" && !!hubId,
    refetchInterval: 30000,
  });

  const hubLat = hubDetail?.lat ? parseFloat(hubDetail.lat) : null;
  const hubLng = hubDetail?.lng ? parseFloat(hubDetail.lng) : null;
  const chargersEnabled = activeTab === "ev" && hubLat != null && hubLng != null;
  const { data: hubChargers } = useQuery<{
    chargers: Array<{
      id: string; name: string; lat: number; lng: number;
      operator?: string | null; connectorTypes: string[];
      maxPowerKw?: number | null; isOperational: boolean; distanceKm: number;
    }>;
    source: "live" | "cache" | "simulated" | "unavailable";
    keyed: boolean;
  }>({
    queryKey: [`/api/ev/chargers/nearby?lat=${hubLat}&lng=${hubLng}&radius=5&max=8`],
    enabled: chargersEnabled,
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
      queryClient.invalidateQueries({ queryKey: messagesKey });
    },
  });

  const checkInMutation = useMutation({
    mutationFn: async (evStagingStatus?: "charging" | "ready" | "departing") => {
      return apiRequest(`/api/openclaw/hubs/${hubId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evStagingStatus: evStagingStatus || null }),
      });
    },
    onSuccess: () => {
      setShowCheckInModal(false);
      queryClient.invalidateQueries({ queryKey: evStatusKey });
      queryClient.invalidateQueries({ queryKey: intelligenceKey });
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchIntel();
      if (activeTab === "livefeed") await refetchMessages();
    } catch (e) {}
    setRefreshing(false);
  }, [activeTab, refetchIntel, refetchMessages]);

  const renderActivityTab = () => {
    if (intelLoading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    if (!intel) {
      return (
        <View style={styles.centerWrap}>
          <Ionicons name="analytics-outline" size={40} color={theme.textMuted} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No activity data available
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Hub Intelligence</ThemedText>
          <View style={styles.intelGrid}>
            <View style={styles.intelItem}>
              <ThemedText style={[styles.intelValue, { color: Colors.travonyGreen }]}>
                {Math.round(intel.activityScore * 100)}%
              </ThemedText>
              <ThemedText style={[styles.intelLabel, { color: theme.textMuted }]}>Activity</ThemedText>
            </View>
            <View style={styles.intelItem}>
              <ThemedText style={[styles.intelValue, { color: theme.text }]}>
                {intel.vehiclesActive}
              </ThemedText>
              <ThemedText style={[styles.intelLabel, { color: theme.textMuted }]}>Vehicles</ThemedText>
            </View>
            <View style={styles.intelItem}>
              <ThemedText style={[styles.intelValue, { color: theme.text }]}>
                {intel.networkMembers}
              </ThemedText>
              <ThemedText style={[styles.intelLabel, { color: theme.textMuted }]}>Members</ThemedText>
            </View>
          </View>
        </View>

        {intel.predictedYield ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Predicted Yield</ThemedText>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
              <ThemedText style={[styles.yieldAmount, { color: Colors.travonyGreen }]}>
                ${intel.predictedYield.amount?.toFixed(0) || "0"}
              </ThemedText>
              <ThemedText style={[{ ...Typography.labelLight }, { color: theme.textSecondary }]}>
                / {intel.predictedYield.window || "hour"}
              </ThemedText>
            </View>
            <ThemedText style={[{ ...Typography.small, marginTop: 4 }, { color: theme.textMuted }]}>
              {Math.round((intel.predictedYield.confidence || 0) * 100)}% confidence
            </ThemedText>
          </View>
        ) : null}

        {intel.aiRecommendation ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Ionicons name="sparkles-outline" size={16} color={Colors.travonyGold} />
              <ThemedText style={[styles.cardTitle, { color: theme.text }]}>
                {intel.aiRecommendation.title || "AI Recommendation"}
              </ThemedText>
            </View>
            <ThemedText style={[{ ...Typography.labelLight, marginTop: Spacing.sm, lineHeight: 18 }, { color: theme.textSecondary }]}>
              {intel.aiRecommendation.message || ""}
            </ThemedText>
          </View>
        ) : null}

        {intel.vehicleTicker && intel.vehicleTicker.length > 0 ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Vehicle Activity</ThemedText>
            {intel.vehicleTicker.slice(0, 5).map((item, i) => (
              <View key={i} style={styles.tickerRow}>
                <Ionicons
                  name={item.type === "arrival" ? "arrow-down-circle-outline" : "arrow-up-circle-outline"}
                  size={16}
                  color={item.type === "arrival" ? Colors.travonyGreen : theme.error}
                />
                <ThemedText style={[{ ...Typography.labelLight, flex: 1, marginLeft: Spacing.sm }, { color: theme.text }]}>
                  {item.vehicleType} {item.type === "arrival" ? "arrived" : "departed"}
                </ThemedText>
                <ThemedText style={[{ ...Typography.caption }, { color: theme.textMuted }]}>{item.timeAgo}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}

        {intel.demandTrend && intel.demandTrend.length > 0 ? (() => {
          const totalRidesLast2h = intel.demandTrend
            .slice(-4) // last 4 buckets = 2 hours (30min each)
            .reduce((sum, b) => sum + (b.demand || 0), 0);
          const maxDemand = Math.max(...intel.demandTrend.map(b => b.demand), 1);
          const demandLevel = totalRidesLast2h >= 10 ? "High" : totalRidesLast2h >= 4 ? "Medium" : "Low";
          const demandBadgeColor = demandLevel === "High" ? Colors.travonyGreen : demandLevel === "Medium" ? Colors.travonyGold : (theme.textMuted as string);

          return (
            <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <Ionicons name="trending-up" size={16} color={demandBadgeColor} />
                <ThemedText style={[styles.cardTitle, { color: theme.text, marginBottom: 0, flex: 1 }]}>Demand Trend</ThemedText>
                {/* Explicit demand-level badge (Low/Medium/High) */}
                <View style={[styles.demandBadge, { backgroundColor: demandBadgeColor + "20", borderColor: demandBadgeColor + "40" }]}>
                  <ThemedText style={{ ...Typography.smallHeavy, color: demandBadgeColor }}>
                    {demandLevel}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={{ ...Typography.small, color: theme.textMuted, marginBottom: Spacing.md }}>
                {totalRidesLast2h} rides in last 2 hours
              </ThemedText>
              <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height: 48 }}>
                {intel.demandTrend.map((bucket, i) => {
                  const barHeight = maxDemand > 0 ? Math.max(4, Math.round((bucket.demand / maxDemand) * 48)) : 4;
                  const isRecent = i >= intel.demandTrend.length - 4;
                  return (
                    <View key={i} style={{ flex: 1, justifyContent: "flex-end", alignItems: "center" }}>
                      <View style={{
                        width: "100%",
                        height: barHeight,
                        borderRadius: 3,
                        backgroundColor: isRecent ? demandBadgeColor : (demandBadgeColor + "50"),
                      }} />
                    </View>
                  );
                })}
              </View>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                <ThemedText style={{ ...Typography.micro, color: theme.textMuted }}>
                  {intel.demandTrend[0]?.time || ""}
                </ThemedText>
                <ThemedText style={{ ...Typography.micro, color: theme.textMuted }}>
                  {intel.demandTrend[intel.demandTrend.length - 1]?.time || "Now"}
                </ThemedText>
              </View>
            </View>
          );
        })() : null}

        {intel.seasonalBehavior ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Seasonal Patterns</ThemedText>
            <ThemedText style={[{ ...Typography.labelLight, color: theme.textSecondary }]}>
              {intel.seasonalBehavior.currentTrend || "Normal"}
            </ThemedText>
            <View style={{ flexDirection: "row", gap: Spacing.lg, marginTop: Spacing.sm }}>
              <View>
                <ThemedText style={[{ ...Typography.caption }, { color: theme.textMuted }]}>Peak Day</ThemedText>
                <ThemedText style={[{ ...Typography.labelBold }, { color: theme.text }]}>
                  {intel.seasonalBehavior.peakDay || "-"}
                </ThemedText>
              </View>
              <View>
                <ThemedText style={[{ ...Typography.caption }, { color: theme.textMuted }]}>Peak Hour</ThemedText>
                <ThemedText style={[{ ...Typography.labelBold }, { color: theme.text }]}>
                  {intel.seasonalBehavior.peakHour || "-"}
                </ThemedText>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const renderLiveFeedTab = () => {
    if (messagesLoading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    return (
      <View>
        <View style={[styles.composeBox, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <View style={{ flexDirection: "row", gap: Spacing.xs, marginBottom: Spacing.sm, flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => {
              const cfg = CATEGORY_CONFIG[cat];
              const selected = selectedCategory === cat;
              return (
                <Pressable
                  key={cat}
                  onPress={() => setSelectedCategory(cat)}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor: selected ? cfg.color + "20" : theme.backgroundSecondary,
                      borderColor: selected ? cfg.color : "transparent",
                    },
                  ]}
                >
                  <Ionicons name={cfg.icon} size={12} color={selected ? cfg.color : theme.textMuted} />
                  <ThemedText style={{ ...Typography.caption, color: selected ? cfg.color : theme.textMuted }}>
                    {cfg.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: Spacing.sm }}>
            <TextInput
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Share an update..."
              placeholderTextColor={theme.textMuted}
              style={[styles.msgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            />
            <Pressable
              onPress={() => {
                if (messageText.trim()) {
                  sendMessageMutation.mutate({ content: messageText.trim(), category: selectedCategory });
                }
              }}
              style={[styles.sendBtn, { backgroundColor: theme.primary, opacity: messageText.trim() ? 1 : 0.5 }]}
            >
              <Ionicons name="send" size={16} color={Colors.light.textOnPrimary} />
            </Pressable>
          </View>
        </View>

        {messages.length === 0 ? (
          <View style={styles.centerWrap}>
            <Ionicons name="chatbubbles-outline" size={40} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              No messages yet. Be the first to share!
            </ThemedText>
          </View>
        ) : (
          messages.map((msg) => {
            const cat = msg.category ? CATEGORY_CONFIG[msg.category] : null;
            return (
              <View key={msg.id} style={[styles.msgCard, { backgroundColor: theme.backgroundDefault }]}>
                <View style={styles.msgHeader}>
                  <View style={[styles.msgAvatar, { backgroundColor: theme.primary + "20" }]}>
                    <ThemedText style={{ ...Typography.smallHeavy, color: theme.primary }}>
                      {(msg.authorName || "?")[0].toUpperCase()}
                    </ThemedText>
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={[{ ...Typography.labelBold }, { color: theme.text }]}>
                      {msg.authorName || "Anonymous"}
                    </ThemedText>
                    <ThemedText style={[{ ...Typography.caption }, { color: theme.textMuted }]}>
                      {getTimeAgo(msg.createdAt)}
                    </ThemedText>
                  </View>
                  {cat ? (
                    <View style={[styles.msgCatBadge, { backgroundColor: cat.color + "15" }]}>
                      <Ionicons name={cat.icon} size={10} color={cat.color} />
                      <ThemedText style={{ ...Typography.micro, color: cat.color }}>{cat.label}</ThemedText>
                    </View>
                  ) : null}
                </View>
                <ThemedText style={[{ ...Typography.bodyMedium, lineHeight: 20, marginTop: Spacing.sm }, { color: theme.text }]}>
                  {msg.content}
                </ThemedText>
                <View style={styles.msgFooter}>
                  <Pressable
                    onPress={() => likeMutation.mutate(msg.id)}
                    style={styles.likeBtn}
                  >
                    <Ionicons
                      name={msg.hasLiked ? "heart" : "heart-outline"}
                      size={14}
                      color={msg.hasLiked ? theme.error : theme.textMuted}
                    />
                    <ThemedText style={[{ ...Typography.small }, { color: theme.textMuted }]}>
                      {msg.likesCount || 0}
                    </ThemedText>
                  </Pressable>
                  {msg.aiScore != null && msg.aiScore > 0.7 ? (
                    <View style={styles.aiScoreBadge}>
                      <Ionicons name="sparkles" size={10} color={Colors.travonyGold} />
                      <ThemedText style={{ ...Typography.micro, color: Colors.travonyGold }}>AI Curated</ThemedText>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    );
  };

  const renderInsightsTab = () => {
    if (insightsLoading) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      );
    }

    if (!insights) {
      return (
        <View style={styles.centerWrap}>
          <Ionicons name="bar-chart-outline" size={40} color={theme.textMuted} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Personal insights will appear as you use this hub
          </ThemedText>
        </View>
      );
    }

    return (
      <View>
        <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Your Hub Stats</ThemedText>
          <View style={styles.intelGrid}>
            {insights.avgYieldPerHour != null ? (
              <View style={styles.intelItem}>
                <ThemedText style={[styles.intelValue, { color: Colors.travonyGreen }]}>
                  ${insights.avgYieldPerHour.toFixed(0)}
                </ThemedText>
                <ThemedText style={[styles.intelLabel, { color: theme.textMuted }]}>Avg Yield/hr</ThemedText>
              </View>
            ) : null}
            {insights.totalRidesThisMonth != null ? (
              <View style={styles.intelItem}>
                <ThemedText style={[styles.intelValue, { color: theme.text }]}>
                  {insights.totalRidesThisMonth}
                </ThemedText>
                <ThemedText style={[styles.intelLabel, { color: theme.textMuted }]}>Rides/Month</ThemedText>
              </View>
            ) : null}
            {insights.avgRating != null ? (
              <View style={styles.intelItem}>
                <ThemedText style={[styles.intelValue, { color: Colors.travonyGold }]}>
                  {insights.avgRating.toFixed(1)}
                </ThemedText>
                <ThemedText style={[styles.intelLabel, { color: theme.textMuted }]}>Rating</ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        {insights.contributionScore != null ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Contribution</ThemedText>
            <ThemedText style={[styles.yieldAmount, { color: theme.primary }]}>
              {Math.round(insights.contributionScore * 100)}%
            </ThemedText>
            <ThemedText style={[{ ...Typography.small }, { color: theme.textMuted }]}>Community contribution score</ThemedText>
          </View>
        ) : null}

        {insights.bestActivationTimes && insights.bestActivationTimes.length > 0 ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Best Times</ThemedText>
            {insights.bestActivationTimes.map((time, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.xs }}>
                <Ionicons name="time-outline" size={14} color={theme.primary} />
                <ThemedText style={[{ ...Typography.labelLight }, { color: theme.text }]}>{time}</ThemedText>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderEvTab = () => {
    if (evStatusLoading && !hubDetail) {
      return (
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={Colors.travonyGreen} />
        </View>
      );
    }

    const isEvHub = evStatus?.isEvHub ?? hubDetail?.isEvHub ?? false;

    if (!isEvHub) {
      return (
        <View style={styles.centerWrap}>
          <Ionicons name="flash-off-outline" size={40} color={theme.textMuted} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            This hub does not have EV charging infrastructure
          </ThemedText>
        </View>
      );
    }

    // EV data sourced from /hubs/:id (canonical), enriched by /hubs/:id/ev-status (live staging)
    const portsFree = evStatus?.availablePorts ?? hubDetail?.availablePorts ?? 0;
    const portsTotal = evStatus?.totalChargingPorts ?? hubDetail?.totalChargingPorts ?? 0;
    const portsInUse = portsTotal - portsFree;
    const portColor = portsFree === 0 ? theme.error : portsFree <= 2 ? Colors.travonyGold : Colors.travonyGreen;
    const occupancyPct = portsTotal > 0 ? Math.round((portsInUse / portsTotal) * 100) : 0;

    return (
      <View>
        <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md }}>
            <Ionicons name="flash" size={18} color={Colors.travonyGreen} />
            <ThemedText style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>EV Charging Hub</ThemedText>
          </View>

          {/* Side-by-side: Available vs Charging In Use */}
          <View style={{ flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md }}>
            <View style={[styles.portSideCard, { backgroundColor: Colors.travonyGreen + "15", borderColor: Colors.travonyGreen + "40", flex: 1 }]}>
              <Ionicons name="checkmark-circle-outline" size={22} color={Colors.travonyGreen} />
              <ThemedText style={{ ...Typography.h1, fontWeight: "800", color: Colors.travonyGreen, marginTop: 4 }}>
                {portsFree}
              </ThemedText>
              <ThemedText style={{ ...Typography.smallBold, color: Colors.travonyGreen, marginTop: 2 }}>Available</ThemedText>
            </View>
            <View style={[styles.portSideCard, { backgroundColor: theme.info + "15", borderColor: theme.info + "40", flex: 1 }]}>
              <Ionicons name="battery-charging-outline" size={22} color={theme.info} />
              <ThemedText style={{ ...Typography.h1, fontWeight: "800", color: theme.info, marginTop: 4 }}>
                {portsInUse}
              </ThemedText>
            </View>
          </View>

          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <ThemedText style={{ ...Typography.smallBold, color: theme.textMuted }}>{portsTotal} total ports</ThemedText>
          </View>
          <View style={[styles.portBar]}>
            {/* Use flex-based fill to avoid string percentage types */}
            <View style={{ flex: occupancyPct, backgroundColor: portColor, height: 6, borderRadius: 3 }} />
            <View style={{ flex: 100 - occupancyPct }} />
          </View>
        </View>

        {evStatus ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>EV Driver Staging</ThemedText>
            <ThemedText style={[{ ...Typography.small, color: theme.textMuted, marginBottom: Spacing.md }]}>
              {evStatus.evDriversPresent} EV driver{evStatus.evDriversPresent !== 1 ? "s" : ""} present in last 2 hours
            </ThemedText>

            <View style={styles.stagingGrid}>
              <View style={[styles.stagingItem, { backgroundColor: theme.info + "20" }]}>
                <Ionicons name="battery-charging-outline" size={20} color={theme.info} />
                <ThemedText style={[styles.stagingCount, { color: theme.info }]}>
                  {evStatus.evStagingBreakdown.charging}
                </ThemedText>
                <ThemedText style={[styles.stagingLabel, { color: theme.textMuted }]}>Charging</ThemedText>
              </View>
              <View style={[styles.stagingItem, { backgroundColor: Colors.travonyGreen + "20" }]}>
                <Ionicons name="checkmark-circle-outline" size={20} color={Colors.travonyGreen} />
                <ThemedText style={[styles.stagingCount, { color: Colors.travonyGreen }]}>
                  {evStatus.evStagingBreakdown.ready}
                </ThemedText>
                <ThemedText style={[styles.stagingLabel, { color: theme.textMuted }]}>Ready</ThemedText>
              </View>
              <View style={[styles.stagingItem, { backgroundColor: Colors.travonyGold + "20" }]}>
                <Ionicons name="navigate-outline" size={20} color={Colors.travonyGold} />
                <ThemedText style={[styles.stagingCount, { color: Colors.travonyGold }]}>
                  {evStatus.evStagingBreakdown.departing}
                </ThemedText>
                <ThemedText style={[styles.stagingLabel, { color: theme.textMuted }]}>Departing</ThemedText>
              </View>
            </View>
          </View>
        ) : null}

        {evStatus && evStatus.evStagingBreakdown.charging > 0 ? (
          <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.cardTitle, { color: theme.text }]}>Estimated Ready Times</ThemedText>
            <ThemedText style={[{ ...Typography.smallBold, color: theme.textMuted, marginBottom: Spacing.md }]}>
              Based on each driver's real battery level and charging speed
            </ThemedText>
            {evStatus.nearestReadyMinutes !== null ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <Ionicons name="time-outline" size={18} color={theme.info} />
                <ThemedText style={{ ...Typography.bodyBold, color: theme.info }}>
                  {evStatus.nearestReadyMinutes === 0
                    ? "Ready now"
                    : `Next EV ready in ~${evStatus.nearestReadyMinutes} min`}
                </ThemedText>
              </View>
            ) : null}
            <View style={{ marginTop: Spacing.sm, gap: 6 }}>
              {evStatus.estimatedReadyTimes.map((e, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons name="battery-charging-outline" size={14} color={theme.info} />
                  <ThemedText style={{ ...Typography.small, color: theme.textMuted }}>
                    {`EV ${i + 1}: ${e.minutesRemaining === 0 ? "Ready now" : `~${e.minutesRemaining} min remaining`}`}
                  </ThemedText>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Ionicons name="battery-charging" size={18} color={Colors.evCharger} />
              <ThemedText style={[styles.cardTitle, { color: theme.text, marginBottom: 0 }]}>Nearby Public Chargers</ThemedText>
            </View>
            {hubChargers ? (
              <ThemedText style={{ ...Typography.captionBold, color: theme.textMuted }}>
                {hubChargers.source === "simulated"
                  ? "Estimated"
                  : hubChargers.source === "unavailable"
                  ? "Unavailable"
                  : "Live"}
              </ThemedText>
            ) : null}
          </View>
          {hubChargers && hubChargers.chargers.length > 0 ? (
            <View style={{ gap: Spacing.sm }}>
              {hubChargers.chargers.slice(0, 5).map((c) => (
                <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                  <View style={{
                    width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center",
                    backgroundColor: (c.isOperational ? Colors.evCharger : theme.textMuted) + "20",
                  }}>
                    <Ionicons name="battery-charging" size={15} color={c.isOperational ? Colors.evCharger : theme.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ ...Typography.labelBold, color: theme.text }} numberOfLines={1}>
                      {c.name}
                    </ThemedText>
                    <ThemedText style={{ ...Typography.caption, color: theme.textMuted }} numberOfLines={1}>
                      {c.distanceKm} km
                      {c.maxPowerKw ? ` · ${c.maxPowerKw} kW` : ""}
                      {c.connectorTypes?.length ? ` · ${c.connectorTypes[0]}` : ""}
                      {!c.isOperational ? " · offline" : ""}
                    </ThemedText>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <ThemedText style={{ ...Typography.small, color: theme.textMuted }}>
              {hubChargers ? "No public chargers found nearby." : "Loading nearby chargers..."}
            </ThemedText>
          )}
        </View>

        {isDriver ? (
          <Pressable
            onPress={() => setShowCheckInModal(true)}
            style={[styles.checkInBtn, { backgroundColor: Colors.travonyGreen }]}
          >
            <Ionicons name="flash" size={18} color={Colors.light.textOnPrimary} />
            <ThemedText style={styles.checkInBtnText}>EV Check-In at This Hub</ThemedText>
          </Pressable>
        ) : null}

        <View style={[styles.intelCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <Ionicons name="information-circle-outline" size={16} color={theme.textMuted} />
            <ThemedText style={[{ ...Typography.small, color: theme.textMuted, flex: 1, lineHeight: 18 }]}>
              EV drivers checking in at this hub automatically update port availability. Charging sessions are tracked and released on checkout.
            </ThemedText>
          </View>
        </View>
      </View>
    );
  };

  const TABS: { key: TabKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "activity", label: "Activity", icon: "pulse-outline" },
    { key: "livefeed", label: "Live Feed", icon: "chatbubbles-outline" },
    { key: "insights", label: "Insights", icon: "bar-chart-outline" },
    { key: "ev", label: "EV", icon: "flash-outline" },
  ];

  const renderContent = () => {
    try {
      if (activeTab === "activity") return renderActivityTab();
      if (activeTab === "livefeed") return renderLiveFeedTab();
      if (activeTab === "insights") return renderInsightsTab();
      if (activeTab === "ev") return renderEvTab();
    } catch (e) {
      return (
        <View style={styles.centerWrap}>
          <Ionicons name="alert-circle-outline" size={40} color={theme.textMuted} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Something went wrong
          </ThemedText>
        </View>
      );
    }
    return null;
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={[{ key: "content" }]}
        keyExtractor={(item) => item.key}
        renderItem={() => (
          <View>
            <View style={styles.tabBar}>
              {TABS.map((tab) => (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  style={[
                    styles.tabItem,
                    activeTab === tab.key
                      ? { borderBottomColor: theme.primary, borderBottomWidth: 2 }
                      : { borderBottomColor: "transparent", borderBottomWidth: 2 },
                  ]}
                >
                  <Ionicons
                    name={tab.icon}
                    size={16}
                    color={activeTab === tab.key ? theme.primary : theme.textMuted}
                  />
                  <ThemedText
                    style={[
                      styles.tabLabel,
                      { color: activeTab === tab.key ? theme.primary : theme.textMuted },
                    ]}
                  >
                    {tab.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            {isDriver && activeTab !== "livefeed" ? (
              <Pressable
                onPress={() => setShowCheckInModal(true)}
                style={[styles.floatingCheckIn, { backgroundColor: Colors.travonyGreen }]}
              >
                <Ionicons name="flash" size={16} color={Colors.light.textOnPrimary} />
                <ThemedText style={styles.checkInBtnText}>Check In Here</ThemedText>
              </Pressable>
            ) : null}
            {renderContent()}
          </View>
        )}
        contentContainerStyle={{
          paddingTop: (insets.top || 0) + 60,
          paddingBottom: (insets.bottom || 0) + 40,
          paddingHorizontal: Spacing.lg,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      />

      <Modal
        visible={showCheckInModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCheckInModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundRoot }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}>
              <Ionicons name="flash" size={22} color={Colors.travonyGreen} />
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>Check In at {hubName}</ThemedText>
            </View>
            <ThemedText style={[{ ...Typography.labelLight, marginBottom: Spacing.lg }, { color: theme.textSecondary }]}>
              Select your EV status to let the system know your staging intent.
            </ThemedText>
            <View style={{ gap: Spacing.sm }}>
              {(
                [
                  { status: "charging" as const, label: "Charging", sub: "Need to charge before rides", icon: "battery-charging-outline" as keyof typeof Ionicons.glyphMap, color: theme.info },
                  { status: "ready" as const, label: "Ready", sub: "Charged and ready for pick-ups", icon: "checkmark-circle-outline" as keyof typeof Ionicons.glyphMap, color: Colors.travonyGreen },
                  { status: "departing" as const, label: "Departing", sub: "Heading out soon", icon: "navigate-outline" as keyof typeof Ionicons.glyphMap, color: Colors.travonyGold },
                ]
              ).map(({ status, label, sub, icon, color }) => (
                <Pressable
                  key={status}
                  style={[styles.stagingOption, { backgroundColor: color + "15", borderColor: color + "40" }]}
                  onPress={() => checkInMutation.mutate(status)}
                >
                  <Ionicons name={icon} size={22} color={color} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ ...Typography.bodyBold, color: theme.text }}>{label}</ThemedText>
                    <ThemedText style={{ ...Typography.small, color: theme.textMuted }}>{sub}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={color} />
                </Pressable>
              ))}
              <Pressable
                style={[styles.stagingOption, { backgroundColor: theme.backgroundElevated || theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={() => checkInMutation.mutate(undefined)}
              >
                <Ionicons name="log-in-outline" size={22} color={theme.textMuted} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ ...Typography.bodyBold, color: theme.text }}>Standard Check-In</ThemedText>
                  <ThemedText style={{ ...Typography.small, color: theme.textMuted }}>Check in without EV status</ThemedText>
                </View>
              </Pressable>
            </View>
            <Pressable style={{ marginTop: Spacing.lg, alignItems: "center" }} onPress={() => setShowCheckInModal(false)}>
              <ThemedText style={{ ...Typography.bodyMedium, color: theme.textMuted }}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerWrap: { alignItems: "center", paddingVertical: Spacing["2xl"], gap: Spacing.md },
  emptyText: { ...Typography.bodyMedium, textAlign: "center" },
  yieldAmount: { ...Typography.xxlHeavy },
  tabBar: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: Spacing.md,
  },
  tabLabel: { ...Typography.labelBold },
  intelCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  cardTitle: { ...Typography.bodySmallBold, marginBottom: Spacing.sm },
  intelGrid: { flexDirection: "row", justifyContent: "space-around" },
  intelItem: { alignItems: "center", gap: 4 },
  intelValue: { ...Typography.h2Heavy },
  intelLabel: { ...Typography.captionBold },
  tickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  composeBox: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  catPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  msgInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    borderRadius: BorderRadius.sm,
    ...Typography.bodyMedium,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  msgCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
  },
  msgHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  msgAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  msgCatBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  msgFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  aiScoreBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  portSideCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  demandBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
  },
  portBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceGray,
    overflow: "hidden",
    flexDirection: "row",
  },
  portBarFill: {
    height: 6,
    borderRadius: 3,
  },
  stagingGrid: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  stagingItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  stagingCount: {
    ...Typography.xlHeavy,
  },
  stagingLabel: {
    ...Typography.caption,
  },
  checkInBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  checkInBtnText: {
    color: Colors.light.textOnPrimary,
    ...Typography.bodySmallHeavy,
  },
  floatingCheckIn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: BorderRadius["2xl"] || 24,
    borderTopRightRadius: BorderRadius["2xl"] || 24,
    padding: Spacing.xl,
    paddingBottom: Spacing["2xl"] || 40,
  },
  modalTitle: {
    ...Typography.h3Heavy,
    flex: 1,
  },
  stagingOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
