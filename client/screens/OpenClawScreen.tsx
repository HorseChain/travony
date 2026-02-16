import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, Platform, FlatList, RefreshControl, Dimensions, ActivityIndicator } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInUp, FadeIn, useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence, withTiming, Easing } from "react-native-reanimated";
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
import { MapView as NativeMapView, Marker as NativeMarker, mapsAvailable, WebMapFallback } from "@/components/NativeMaps";

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
  lat?: number;
  lng?: number;
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

interface Recommendation {
  hubs?: Hub[];
  hotspots?: Hotspot[];
}

type ViewMode = "map" | "list";

const INTENSITY_COLORS = {
  low: "#4FC3F7",
  medium: "#FFA726",
  high: "#EF5350",
};

function getIntensityColor(intensity: number): string {
  if (intensity < 0.4) return INTENSITY_COLORS.low;
  if (intensity < 0.7) return INTENSITY_COLORS.medium;
  return INTENSITY_COLORS.high;
}

function getHubMarkerColor(demandScore: number): string {
  if (demandScore >= 0.6) return Colors.travonyGreen;
  if (demandScore >= 0.3) return Colors.travonyGold;
  return "#9E9E9E";
}

function PulsingHotspotMarker({ intensity }: { intensity: number }) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.6, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const color = getIntensityColor(intensity);
  const size = 24 + intensity * 16;

  return (
    <View style={{ alignItems: "center", justifyContent: "center", width: size * 2, height: size * 2 }}>
      <Animated.View
        style={[
          {
            position: "absolute",
            width: size * 1.8,
            height: size * 1.8,
            borderRadius: size,
            backgroundColor: color,
          },
          outerStyle,
        ]}
      />
      <View
        style={{
          width: size * 0.5,
          height: size * 0.5,
          borderRadius: size * 0.25,
          backgroundColor: color,
          opacity: 0.95,
        }}
      />
    </View>
  );
}

function HubMarkerPin({ hub }: { hub: Hub }) {
  const color = getHubMarkerColor(hub.demandScore);
  return (
    <View style={{ alignItems: "center" }}>
      <View style={[markerStyles.pin, { backgroundColor: color }]}>
        <Ionicons name="location" size={14} color="#FFFFFF" />
      </View>
      <View style={[markerStyles.pinTail, { borderTopColor: color }]} />
    </View>
  );
}

const markerStyles = StyleSheet.create({
  pin: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pinTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
});

function NotificationCard({
  icon,
  iconColor,
  text,
  onDismiss,
  theme,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  text: string;
  onDismiss: () => void;
  theme: any;
}) {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={[notifStyles.card, { backgroundColor: theme.card }]}>
      <View style={[notifStyles.iconWrap, { backgroundColor: iconColor + "1A" }]}>
        <Ionicons name={icon} size={16} color={iconColor} />
      </View>
      <ThemedText style={[notifStyles.text, { color: theme.text }]} numberOfLines={1}>
        {text}
      </ThemedText>
      <Pressable onPress={onDismiss} hitSlop={8} style={notifStyles.dismiss}>
        <Ionicons name="close" size={14} color={theme.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const notifStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
    minWidth: 160,
    maxWidth: 240,
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: "500",
  },
  dismiss: {
    marginLeft: Spacing.xs,
    padding: 2,
  },
});

function DiscoverHotspotCard({ hotspot, index, theme }: { hotspot: Hotspot; index: number; theme: any }) {
  const color = getIntensityColor(hotspot.intensity);
  return (
    <Animated.View entering={FadeInUp.delay(index * 60).duration(300)} style={[discoverStyles.hotspotCard, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[discoverStyles.intensityDot, { backgroundColor: color }]} />
      <View style={discoverStyles.hotspotInfo}>
        <ThemedText style={[discoverStyles.hotspotLocation, { color: theme.text }]}>
          {hotspot.lat.toFixed(3)}, {hotspot.lng.toFixed(3)}
        </ThemedText>
        <View style={discoverStyles.hotspotMeta}>
          <ThemedText style={[discoverStyles.hotspotIntensity, { color }]}>
            {(hotspot.intensity * 100).toFixed(0)}% intensity
          </ThemedText>
          {hotspot.yieldEstimate != null ? (
            <ThemedText style={[discoverStyles.hotspotYield, { color: Colors.travonyGreen }]}>
              ${hotspot.yieldEstimate.toFixed(0)}/hr
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );
}

const discoverStyles = StyleSheet.create({
  hotspotCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  intensityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  hotspotInfo: {
    flex: 1,
  },
  hotspotLocation: {
    fontSize: 13,
    fontWeight: "600",
  },
  hotspotMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginTop: 2,
  },
  hotspotIntensity: {
    fontSize: 11,
    fontWeight: "500",
  },
  hotspotYield: {
    fontSize: 11,
    fontWeight: "600",
  },
});

export default function OpenClawScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const variant: "driver" | "rider" = route.params?.variant || "rider";

  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedPrompt, setDismissedPrompt] = useState(false);
  const [dismissedNotifs, setDismissedNotifs] = useState<Set<string>>(new Set());
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    requestLocation();
  }, []);

  useEffect(() => {
    if (viewMode === "map") {
      const timer = setTimeout(() => setMapReady(true), 500);
      return () => clearTimeout(timer);
    } else {
      setMapReady(false);
    }
  }, [viewMode]);

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

  const recommendationsUrl = useMemo(() => {
    const url = new URL(`/api/openclaw/recommendations/${variant}`, getApiUrl());
    if (location) {
      url.searchParams.set("lat", String(location.lat));
      url.searchParams.set("lng", String(location.lng));
    }
    return url;
  }, [location, variant]);

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

  const {
    data: recommendationsData,
  } = useQuery<Recommendation>({
    queryKey: [recommendationsUrl.pathname + recommendationsUrl.search],
    enabled: true,
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

  const highYieldHotspot = useMemo(() => {
    return hotspotsData?.find((h) => h.intensity > 0.7) || null;
  }, [hotspotsData]);

  const surgeHub = useMemo(() => {
    return sortedHubs.find((h) => h.demandScore > 0.8) || null;
  }, [sortedHubs]);

  const topHotspots = useMemo(() => {
    if (!hotspotsData) return [];
    return [...hotspotsData].sort((a, b) => b.intensity - a.intensity).slice(0, 3);
  }, [hotspotsData]);

  const notifications = useMemo(() => {
    const notifs: { id: string; icon: keyof typeof Ionicons.glyphMap; iconColor: string; text: string }[] = [];
    if (totalVehicles > 0) {
      notifs.push({
        id: "vehicles",
        icon: "car-outline",
        iconColor: "#4FC3F7",
        text: `${totalVehicles} vehicles nearby`,
      });
    }
    if (highYieldHotspot) {
      notifs.push({
        id: "highyield",
        icon: "trending-up",
        iconColor: Colors.travonyGreen,
        text: "High-yield cluster detected",
      });
    }
    if (surgeHub) {
      const pct = Math.round(surgeHub.demandScore * 100);
      notifs.push({
        id: "surge",
        icon: "flash-outline",
        iconColor: Colors.travonyGold,
        text: `Surge: ${pct}% demand increase`,
      });
    }
    return notifs.filter((n) => !dismissedNotifs.has(n.id));
  }, [totalVehicles, highYieldHotspot, surgeHub, dismissedNotifs]);

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

  const dismissNotif = useCallback((id: string) => {
    setDismissedNotifs((prev) => new Set([...prev, id]));
  }, []);

  const hubsWithCoords = useMemo(() => {
    return sortedHubs.filter((h) => h.lat != null && h.lng != null);
  }, [sortedHubs]);

  const mapRegion = useMemo(() => {
    if (location) {
      return {
        latitude: location.lat,
        longitude: location.lng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }
    return {
      latitude: 25.2048,
      longitude: 55.2708,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    };
  }, [location]);

  const renderSegmentedControl = () => (
    <View style={[styles.segmentedControl, { backgroundColor: theme.backgroundDefault }]}>
      <Pressable
        onPress={() => setViewMode("map")}
        style={[
          styles.segmentButton,
          viewMode === "map" ? { backgroundColor: theme.primary } : null,
        ]}
      >
        <Ionicons
          name="map-outline"
          size={16}
          color={viewMode === "map" ? "#FFFFFF" : theme.textSecondary}
        />
        <ThemedText
          style={[
            styles.segmentText,
            { color: viewMode === "map" ? "#FFFFFF" : theme.textSecondary },
          ]}
        >
          Map
        </ThemedText>
      </Pressable>
      <Pressable
        onPress={() => setViewMode("list")}
        style={[
          styles.segmentButton,
          viewMode === "list" ? { backgroundColor: theme.primary } : null,
        ]}
      >
        <Ionicons
          name="list-outline"
          size={16}
          color={viewMode === "list" ? "#FFFFFF" : theme.textSecondary}
        />
        <ThemedText
          style={[
            styles.segmentText,
            { color: viewMode === "list" ? "#FFFFFF" : theme.textSecondary },
          ]}
        >
          List
        </ThemedText>
      </Pressable>
    </View>
  );

  const renderMapView = () => {
    if (!mapsAvailable || !NativeMapView) {
      return (
        <WebMapFallback
          message="Map available in Expo Go app"
          style={styles.mapFallback}
        />
      );
    }

    if (!mapReady) {
      return (
        <View style={[styles.mapFallback, { backgroundColor: theme.backgroundElevated }]}>
          <ActivityIndicator size="large" color={Colors.travonyGreen} />
          <ThemedText style={[styles.mapFallbackText, { color: theme.textSecondary }]}>
            Preparing map...
          </ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.mapContainer}>
        <NativeMapView
          style={styles.map}
          initialRegion={mapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {hubsWithCoords.map((hub) => (
            NativeMarker ? (
              <NativeMarker
                key={`hub-${hub.id}`}
                coordinate={{ latitude: hub.lat!, longitude: hub.lng! }}
                onPress={() => handleHubPress(hub)}
                tracksViewChanges={false}
              >
                <HubMarkerPin hub={hub} />
              </NativeMarker>
            ) : null
          ))}
          {NativeMarker && hotspotsData?.map((hotspot, index) => (
            <NativeMarker
              key={`hotspot-${index}-${hotspot.lat}-${hotspot.lng}`}
              coordinate={{ latitude: hotspot.lat, longitude: hotspot.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              tracksViewChanges={false}
            >
              <PulsingHotspotMarker intensity={hotspot.intensity} />
            </NativeMarker>
          )) || null}
        </NativeMapView>
        <View style={[styles.mapLegendOverlay, { bottom: insets.bottom + Spacing.lg }]}>
          <HeatmapLegend />
        </View>
      </View>
    );
  };

  const renderNotifications = () => {
    if (notifications.length === 0) return null;
    return (
      <View style={styles.notificationsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.notificationsScroll}
        >
          {notifications.map((notif) => (
            <NotificationCard
              key={notif.id}
              icon={notif.icon}
              iconColor={notif.iconColor}
              text={notif.text}
              onDismiss={() => dismissNotif(notif.id)}
              theme={theme}
            />
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderDiscoverSection = () => {
    const recHubs = recommendationsData?.hubs;
    const predictedHotspots = topHotspots.length > 0 ? topHotspots : recommendationsData?.hotspots?.slice(0, 3);

    if (!recHubs?.length && !predictedHotspots?.length) return null;

    return (
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.discoverSection}>
        {recHubs && recHubs.length > 0 ? (
          <>
            <View style={styles.discoverHeader}>
              <Ionicons name="sparkles-outline" size={16} color={Colors.travonyGold} />
              <ThemedText style={[styles.discoverTitle, { color: theme.text }]}>
                AI Recommended
              </ThemedText>
            </View>
            {recHubs.slice(0, 3).map((hub, index) => (
              <Animated.View key={hub.id} entering={FadeInUp.delay(index * 80).duration(350)}>
                <HubCard
                  hub={hub}
                  variant={variant}
                  onPress={() => handleHubPress(hub)}
                  onCheckIn={variant === "driver" ? () => handleCheckIn(hub.id) : undefined}
                />
              </Animated.View>
            ))}
          </>
        ) : null}

        {predictedHotspots && predictedHotspots.length > 0 ? (
          <>
            <View style={[styles.discoverHeader, { marginTop: recHubs?.length ? Spacing.lg : 0 }]}>
              <Ionicons name="analytics-outline" size={16} color={theme.primary} />
              <ThemedText style={[styles.discoverTitle, { color: theme.text }]}>
                Predicted Hotspots
              </ThemedText>
            </View>
            {predictedHotspots.map((hotspot, index) => (
              <DiscoverHotspotCard
                key={`predicted-${index}`}
                hotspot={hotspot}
                index={index}
                theme={theme}
              />
            ))}
          </>
        ) : null}
      </Animated.View>
    );
  };

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

        {renderNotifications()}

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

        {renderDiscoverSection()}

        {sortedHubs.length > 0 ? (
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Nearby Hubs
          </ThemedText>
        ) : null}
      </Animated.View>
    );
  }, [smartPromptData, dismissedPrompt, activeHubCount, totalVehicles, theme, handlePromptAction, sortedHubs.length, notifications, recommendationsData, topHotspots]);

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
      <View style={{ paddingTop: headerHeight + Spacing.sm, paddingHorizontal: Spacing.lg }}>
        {renderSegmentedControl()}
      </View>

      {viewMode === "map" ? (
        renderMapView()
      ) : (
        <FlatList
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: Spacing.md,
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
      )}
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

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    padding: 3,
    marginBottom: Spacing.sm,
  },
  segmentButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    gap: 6,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: "600",
  },
  mapContainer: {
    flex: 1,
    position: "relative",
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  mapFallbackText: {
    ...Typography.body,
  },
  mapLegendOverlay: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
  },
  notificationsSection: {
    marginBottom: Spacing.md,
  },
  notificationsScroll: {
    paddingRight: Spacing.md,
  },
  discoverSection: {
    marginBottom: Spacing.lg,
  },
  discoverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  discoverTitle: {
    fontSize: 15,
    fontWeight: "600",
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
