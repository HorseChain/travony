import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, FlatList, RefreshControl, Dimensions } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInUp, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { HeatmapLegend } from "@/components/HeatmapOverlay";
import HubCard from "@/components/HubCard";
import SmartPromptBanner from "@/components/SmartPromptBanner";
import { useAuth } from "@/hooks/useAuth";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Hub {
  id: string;
  name: string;
  type: string;
  distance?: number;
  demandScore: number;
  activeDrivers?: number;
  recentRides?: number;
  yieldEstimate?: number;
  description?: string;
}

interface Hotspot {
  lat: number;
  lng: number;
  intensity: number;
  supplyCount: number;
  demandCount: number;
  yieldEstimate?: number;
}

interface SmartPrompt {
  type: string;
  title: string;
  message: string;
  priority: string;
  actionLabel?: string;
  hubId?: string;
  metadata?: any;
}

export default function OpenClawScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const variant: "driver" | "rider" = route.params?.variant || "rider";

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    } catch (error) {
      console.error("OpenClaw location error:", error);
    }
  };

  const hubsUrl = useMemo(() => {
    if (!location) return null;
    const url = new URL("/api/openclaw/hubs", getApiUrl());
    url.searchParams.set("lat", String(location.lat));
    url.searchParams.set("lng", String(location.lng));
    url.searchParams.set("radiusKm", "10");
    return url;
  }, [location]);

  const hotspotsUrl = useMemo(() => {
    if (!location) return null;
    const url = new URL("/api/openclaw/hotspots", getApiUrl());
    url.searchParams.set("lat", String(location.lat));
    url.searchParams.set("lng", String(location.lng));
    return url;
  }, [location]);

  const smartPromptUrl = useMemo(() => {
    if (!location) return null;
    const url = new URL("/api/openclaw/smart-prompt", getApiUrl());
    url.searchParams.set("lat", String(location.lat));
    url.searchParams.set("lng", String(location.lng));
    return url;
  }, [location]);

  const {
    data: hubsData,
    isLoading: hubsLoading,
    refetch: refetchHubs,
  } = useQuery<Hub[]>({
    queryKey: hubsUrl ? [hubsUrl.pathname + hubsUrl.search] : ["/api/openclaw/hubs"],
    enabled: !!location,
  });

  const {
    data: hotspotsData,
    refetch: refetchHotspots,
  } = useQuery<Hotspot[]>({
    queryKey: hotspotsUrl ? [hotspotsUrl.pathname + hotspotsUrl.search] : ["/api/openclaw/hotspots"],
    enabled: !!location,
  });

  const {
    data: smartPromptData,
    refetch: refetchPrompt,
  } = useQuery<SmartPrompt>({
    queryKey: smartPromptUrl ? [smartPromptUrl.pathname + smartPromptUrl.search] : ["/api/openclaw/smart-prompt"],
    enabled: !!location,
  });

  const checkInMutation = useMutation({
    mutationFn: async (hubId: string) => {
      return apiRequest(`/api/openclaw/hubs/${hubId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (hubsUrl) {
        queryClient.invalidateQueries({ queryKey: [hubsUrl.pathname + hubsUrl.search] });
      }
    },
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchHubs(),
      refetchHotspots(),
      refetchPrompt(),
    ]);
    setRefreshing(false);
  }, [refetchHubs, refetchHotspots, refetchPrompt]);

  const sortedHubs = useMemo(() => {
    if (!hubsData) return [];
    return [...hubsData].sort((a, b) => b.demandScore - a.demandScore);
  }, [hubsData]);

  const activeHubCount = useMemo(() => {
    return sortedHubs.filter((h) => h.demandScore > 0.2).length;
  }, [sortedHubs]);

  const totalVehicles = useMemo(() => {
    return sortedHubs.reduce((sum, h) => sum + (h.activeDrivers || 0), 0);
  }, [sortedHubs]);

  const handleHubPress = useCallback((hub: Hub) => {
    navigation.navigate("HubDetail", { hubId: hub.id, hubName: hub.name });
  }, [navigation]);

  const handleCheckIn = useCallback((hubId: string) => {
    checkInMutation.mutate(hubId);
  }, [checkInMutation]);

  const handlePromptAction = useCallback(() => {
    if (smartPromptData?.hubId) {
      navigation.navigate("HubDetail", {
        hubId: smartPromptData.hubId,
        hubName: "",
      });
    }
  }, [smartPromptData, navigation]);

  const renderListHeader = useCallback(() => {
    return (
      <Animated.View entering={FadeInDown.duration(400)}>
        {smartPromptData && !dismissedPrompt ? (
          <SmartPromptBanner
            prompt={smartPromptData}
            onAction={handlePromptAction}
            onDismiss={() => setDismissedPrompt(true)}
          />
        ) : null}

        <View style={styles.statsSection}>
          <HeatmapLegend />
          <View style={[styles.summaryRow, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.summaryItem}>
              <Ionicons name="radio-outline" size={18} color={Colors.travonyGreen} />
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {activeHubCount}
              </ThemedText>
              <ThemedText style={[styles.summaryLabel, { color: theme.textMuted }]}>
                Active Hubs
              </ThemedText>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: theme.border }]} />
            <View style={styles.summaryItem}>
              <Ionicons name="car-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.summaryValue, { color: theme.text }]}>
                {totalVehicles}
              </ThemedText>
              <ThemedText style={[styles.summaryLabel, { color: theme.textMuted }]}>
                Vehicles Nearby
              </ThemedText>
            </View>
          </View>
        </View>

        {sortedHubs.length > 0 ? (
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Nearby Hubs
          </ThemedText>
        ) : null}
      </Animated.View>
    );
  }, [smartPromptData, dismissedPrompt, activeHubCount, totalVehicles, theme, handlePromptAction, sortedHubs.length]);

  const renderHubItem = useCallback(({ item, index }: { item: Hub; index: number }) => {
    return (
      <Animated.View entering={FadeInUp.delay(index * 80).duration(350)}>
        <HubCard
          hub={item}
          variant={variant}
          onPress={() => handleHubPress(item)}
          onCheckIn={variant === "driver" ? () => handleCheckIn(item.id) : undefined}
        />
      </Animated.View>
    );
  }, [variant, handleHubPress, handleCheckIn]);

  const renderEmptyState = useCallback(() => {
    if (hubsLoading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundDefault }]}>
          <Ionicons name="location-outline" size={48} color={theme.textMuted} />
        </View>
        <ThemedText style={styles.emptyTitle}>No Hubs Found</ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          {location
            ? "No active hubs in your area right now. Pull down to refresh."
            : "Enable location access to discover nearby hubs."}
        </ThemedText>
        {!location ? (
          <Pressable
            onPress={requestLocation}
            style={[styles.enableLocationBtn, { backgroundColor: theme.primary }]}
          >
            <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
            <ThemedText style={styles.enableLocationText}>Enable Location</ThemedText>
          </Pressable>
        ) : null}
      </View>
    );
  }, [hubsLoading, location, theme]);

  if (!location && hubsLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.skeletonContainer, { paddingTop: headerHeight + Spacing.md }]}>
          <View style={styles.skeletonBanner}>
            <SkeletonBlock width="100%" height={80} borderRadius={BorderRadius.lg} />
          </View>
          <View style={styles.skeletonStats}>
            <SkeletonBlock width="100%" height={60} borderRadius={BorderRadius.md} />
          </View>
          {[1, 2, 3].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <SkeletonBlock width="100%" height={140} borderRadius={BorderRadius["2xl"]} />
            </View>
          ))}
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.md,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
          flexGrow: 1,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        data={sortedHubs}
        keyExtractor={(item) => item.id}
        renderItem={renderHubItem}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

function SkeletonBlock({ width, height, borderRadius }: { width: number | string; height: number; borderRadius: number }) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withSpring(0.6, { damping: 10, stiffness: 40 });
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: theme.backgroundSecondary },
        animatedStyle,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  skeletonBanner: {
    marginBottom: Spacing.md,
  },
  skeletonStats: {
    marginBottom: Spacing.lg,
  },
  skeletonCard: {
    marginBottom: Spacing.md,
  },
  statsSection: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "400",
  },
  summaryDivider: {
    width: 1,
    height: 36,
    marginHorizontal: Spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.md,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
    paddingTop: Spacing["5xl"],
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing["2xl"],
  },
  emptyTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
  },
  enableLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  enableLocationText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
