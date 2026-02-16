import React, { useState, useEffect, useCallback } from "react";
import { View, StyleSheet, Pressable, Alert, Switch, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import RideMap from "@/components/RideMap";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { DriverHomeStackParamList } from "@/navigation/driver/DriverHomeStackNavigator";
import { GoingHomeButton } from "@/components/driver/GoingHomeButton";
import { DriverHomeSkeleton } from "@/components/SkeletonLoader";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut, SlideInUp, ZoomIn } from "react-native-reanimated";

type NavigationProp = NativeStackNavigationProp<DriverHomeStackParamList>;

interface RideRequest {
  id: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: string;
  distance: string;
  duration?: string;
  customerName: string;
  customerRating?: number;
  customerTotalRides?: number;
  pickupLat?: string;
  pickupLng?: string;
  dropoffLat?: string;
  dropoffLng?: string;
  farePerKm?: string;
  isPmgthRide?: boolean;
  pmgthPremiumAmount?: number;
  pmgthPremiumPercent?: number;
  pmgthDirectionScore?: number;
}

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<RideRequest | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [showActivationMoment, setShowActivationMoment] = useState(false);

  useEffect(() => {
    console.log("DriverHomeScreen: Mounting");
    const timer = setTimeout(() => {
      console.log("DriverHomeScreen: Ready after delay");
      setIsReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const { data: driverData } = useQuery<{ id: string; is_online: boolean }>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  // Sync online status from server on load
  useEffect(() => {
    if (driverData?.is_online !== undefined && driverData.is_online !== isOnline) {
      setIsOnline(driverData.is_online);
    }
  }, [driverData?.is_online]);

  const { data: pendingRides, error: pendingRidesError, isLoading: pendingRidesLoading } = useQuery<RideRequest[]>({
    queryKey: ["/api/drivers/pending-rides"],
    enabled: isOnline,
    refetchInterval: 5000,
  });

  // Debug logging for pending rides
  useEffect(() => {
    console.log("[DRIVER-DEBUG] isOnline:", isOnline, "pendingRides:", pendingRides?.length, "error:", pendingRidesError?.message, "loading:", pendingRidesLoading);
  }, [isOnline, pendingRides, pendingRidesError, pendingRidesLoading]);

  interface DemandZone {
    zoneLat: string;
    zoneLng: string;
    totalRequests: number;
    avgFare: string;
    demandLevel: "low" | "medium" | "high" | "surge";
  }

  const { data: earningsData } = useQuery<{ monthlyYield: string }>({
    queryKey: ["/api/drivers/monthly-yield"],
    enabled: isOnline && !!user,
    refetchInterval: 30000,
  });

  const { data: heatmapData } = useQuery<{ zones: DemandZone[]; timestamp: string }>({
    queryKey: ["/api/drivers/heatmap"],
    enabled: showHeatmap && isOnline && !!currentLocation,
    refetchInterval: 60000,
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async (online: boolean) => {
      return apiRequest("/api/drivers/status", {
        method: "PATCH",
        body: JSON.stringify({ isOnline: online }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/me"] });
    },
  });

  useEffect(() => {
    requestLocationPermission();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isOnline) {
        queryClient.invalidateQueries({ queryKey: ["/api/drivers/pending-rides"] });
      }
    }, [isOnline])
  );

  useEffect(() => {
    console.log("Driver pending rides:", pendingRides?.length, "isOnline:", isOnline, "incomingRequest:", incomingRequest?.id);
    if (pendingRides && pendingRides.length > 0 && !incomingRequest) {
      console.log("Setting incoming request:", pendingRides[0]);
      setIncomingRequest(pendingRides[0]);
    }
  }, [pendingRides, isOnline]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        getCurrentLocation();
      }
    } catch (error) {
      console.error("Error requesting location:", error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      setCurrentLocation({ lat: latitude, lng: longitude });
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const handleToggleOnline = (value: boolean) => {
    setIsOnline(value);
    toggleOnlineMutation.mutate(value);
    if (value) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowActivationMoment(true);
      setTimeout(() => setShowActivationMoment(false), 2500);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIncomingRequest(null);
    }
  };

  const handleAcceptRide = async () => {
    console.log("Accept ride pressed, incomingRequest:", incomingRequest?.id);
    if (!incomingRequest) {
      console.log("No incoming request to accept");
      return;
    }
    try {
      console.log("Sending PATCH to accept ride:", incomingRequest.id);
      await apiRequest(`/api/rides/${incomingRequest.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
        headers: { "Content-Type": "application/json" },
      });
      console.log("Ride accepted, navigating to active ride");
      navigation.navigate("DriverActiveRide", { rideId: incomingRequest.id });
      setIncomingRequest(null);
    } catch (error: any) {
      console.error("Error accepting ride:", error);
      if (Platform.OS === "web") {
        window.alert(error.message || "Failed to accept route");
      } else {
        Alert.alert("Error", error.message || "Failed to accept route");
      }
    }
  };

  const handleDeclineRide = () => {
    setIncomingRequest(null);
  };

  if (!isReady) {
    return <DriverHomeSkeleton />;
  }

  return (
    <ThemedView style={styles.container}>
      <RideMap
        currentLocation={currentLocation}
        showUserLocation={true}
        interactive={true}
        height="100%"
      />

      <View style={[styles.statusBar, { top: insets.top + Spacing.md }]}>
        <View style={[styles.statusCard, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.statusContent}>
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.statusLabel}>
                {isOnline ? "Vehicle Active" : "Vehicle Inactive"}
              </ThemedText>
              <ThemedText style={[styles.networkEfficiency, { color: isOnline ? Colors.travonyGreen : theme.textMuted }]}>
                {isOnline ? "Network Efficiency: 94%" : "Activate to join the network"}
              </ThemedText>
            </View>
            <Switch
              value={isOnline}
              onValueChange={handleToggleOnline}
              trackColor={{ false: theme.border, true: Colors.travonyGreen }}
              thumbColor={isOnline ? "#fff" : "#f4f3f4"}
            />
          </View>
          {isOnline && earningsData ? (
            <View style={styles.monthlyYieldRow}>
              <ThemedText style={[styles.yieldLabel, { color: theme.textSecondary }]}>Monthly Yield</ThemedText>
              <ThemedText style={[styles.yieldValue, { color: Colors.travonyGreen }]}>
                AED {earningsData.monthlyYield || "0.00"}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.networkHubsButton,
          {
            top: insets.top + Spacing.md + 100,
            backgroundColor: theme.backgroundElevated,
            borderColor: theme.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => navigation.navigate("OpenClaw", { variant: "driver" })}
      >
        <Ionicons name="grid-outline" size={20} color={Colors.travonyGreen} />
        <View style={styles.networkHubsTextContainer}>
          <ThemedText style={styles.networkHubsTitle}>Network Hubs</ThemedText>
          <ThemedText style={[styles.networkHubsSubtitle, { color: theme.textMuted }]}>
            Demand hubs & yield estimates
          </ThemedText>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </Pressable>

      {isOnline && !incomingRequest && (
        <View style={[styles.bottomControls, { bottom: tabBarHeight + Spacing.lg }]}>
          <View style={styles.goingHomeContainer}>
            <GoingHomeButton isOnline={isOnline} currentLocation={currentLocation} />
          </View>
          <View style={[styles.searchingCard, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.searchingDot} />
            <ThemedText style={styles.searchingText}>Scanning for route requests...</ThemedText>
          </View>
        </View>
      )}

      {incomingRequest ? (
        <View style={[styles.requestCard, { bottom: tabBarHeight + Spacing.lg, backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.requestHeader}>
            <View style={styles.requestTitleRow}>
              <ThemedText style={styles.requestTitle}>New Route Request</ThemedText>
              {incomingRequest.isPmgthRide ? (
                <View style={[styles.pmgthBadge, { backgroundColor: Colors.travonyGreen + "20" }]}>
                  <Ionicons name="home" size={12} color={Colors.travonyGreen} />
                  <ThemedText style={[styles.pmgthBadgeText, { color: Colors.travonyGreen }]}>
                    On Your Way
                  </ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.fareContainer}>
              <View style={[styles.fareBadge, { backgroundColor: Colors.travonyGreen }]}>
                <ThemedText style={styles.fareText}>AED {incomingRequest.estimatedFare}</ThemedText>
              </View>
              {incomingRequest.isPmgthRide && incomingRequest.pmgthPremiumAmount ? (
                <View style={[styles.premiumBadge, { backgroundColor: Colors.travonyGold }]}>
                  <ThemedText style={styles.premiumText}>+AED {incomingRequest.pmgthPremiumAmount.toFixed(2)}</ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          {incomingRequest.isPmgthRide ? (
            <View style={[styles.pmgthInfo, { backgroundColor: Colors.travonyGreen + "10" }]}>
              <Ionicons name="flash" size={14} color={Colors.travonyGreen} />
              <ThemedText style={[styles.pmgthInfoText, { color: Colors.travonyGreen }]}>
                Direction match! Earn +{incomingRequest.pmgthPremiumPercent?.toFixed(0)}% premium instantly
              </ThemedText>
            </View>
          ) : null}

          <View style={styles.locationInfo}>
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: Colors.travonyGreen }]} />
              <View style={styles.locationTextContainer}>
                <ThemedText style={[styles.locationLabel, { color: theme.textSecondary }]}>Pickup</ThemedText>
                <ThemedText style={styles.locationAddress} numberOfLines={1}>
                  {incomingRequest.pickupAddress}
                </ThemedText>
              </View>
            </View>
            <View style={styles.locationLine} />
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
              <View style={styles.locationTextContainer}>
                <ThemedText style={[styles.locationLabel, { color: theme.textSecondary }]}>Drop-off</ThemedText>
                <ThemedText style={styles.locationAddress} numberOfLines={1}>
                  {incomingRequest.dropoffAddress}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.rideStats}>
            <View style={styles.statItem}>
              <Ionicons name="navigate-outline" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {incomingRequest.distance} km
              </ThemedText>
            </View>
            {incomingRequest.duration ? (
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                  ~{incomingRequest.duration} min
                </ThemedText>
              </View>
            ) : null}
            {incomingRequest.farePerKm ? (
              <View style={styles.statItem}>
                <Ionicons name="cash-outline" size={16} color={Colors.travonyGreen} />
                <ThemedText style={[styles.statText, { color: Colors.travonyGreen }]}>
                  AED {incomingRequest.farePerKm}/km
                </ThemedText>
              </View>
            ) : null}
          </View>

          {incomingRequest.customerRating ? (
            <View style={[styles.customerInfo, { backgroundColor: theme.backgroundElevated }]}>
              <Ionicons name="person-outline" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.customerName, { color: theme.textSecondary }]}>
                {incomingRequest.customerName}
              </ThemedText>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={12} color="#FFB800" />
                <ThemedText style={[styles.ratingText, { color: theme.textPrimary }]}>
                  {incomingRequest.customerRating.toFixed(1)}
                </ThemedText>
              </View>
              {incomingRequest.customerTotalRides ? (
                <ThemedText style={[styles.ridesCount, { color: theme.textMuted }]}>
                  ({incomingRequest.customerTotalRides} rides)
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          <View style={styles.requestActions}>
            <Pressable
              style={[styles.declineButton, { borderColor: theme.border }]}
              onPress={handleDeclineRide}
            >
              <Ionicons name="close-outline" size={24} color={theme.error} />
            </Pressable>
            <Pressable
              style={[styles.acceptButton, { backgroundColor: Colors.travonyGreen }]}
              onPress={handleAcceptRide}
            >
              <ThemedText style={styles.acceptButtonText}>Accept Route</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}

      {showActivationMoment ? (
        <Animated.View 
          entering={FadeIn.duration(300)} 
          exiting={FadeOut.duration(300)} 
          style={styles.activationOverlay}
        >
          <Animated.View entering={ZoomIn.delay(200).duration(400)} style={styles.activationContent}>
            <View style={styles.activationIcon}>
              <Ionicons name="radio-outline" size={48} color={Colors.travonyGreen} />
            </View>
            <ThemedText style={styles.activationTitle}>Vehicle Activated</ThemedText>
            <ThemedText style={styles.activationSubtitle}>Autonomous Yield: Enabled</ThemedText>
          </Animated.View>
        </Animated.View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  mapPlaceholderText: {
    ...Typography.body,
  },
  statusBar: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
  },
  statusCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  statusContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statusLabel: {
    ...Typography.h4,
    marginBottom: Spacing.xs,
  },
  statusSubtitle: {
    ...Typography.small,
  },
  bottomControls: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.md,
  },
  goingHomeContainer: {
    alignItems: "center",
  },
  searchingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  searchingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.travonyGreen,
  },
  searchingText: {
    ...Typography.body,
  },
  requestCard: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    zIndex: 100,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      },
    }),
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  requestTitle: {
    ...Typography.h3,
  },
  requestTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  pmgthBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  pmgthBadgeText: {
    ...Typography.small,
    fontWeight: "600",
  },
  fareContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  premiumBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  premiumText: {
    ...Typography.small,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  pmgthInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  pmgthInfoText: {
    ...Typography.small,
    fontWeight: "500",
  },
  fareBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  fareText: {
    ...Typography.h4,
    color: "#fff",
  },
  locationInfo: {
    marginBottom: Spacing.lg,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
  },
  locationLine: {
    width: 2,
    height: 24,
    backgroundColor: "#E0E0E0",
    marginLeft: 5,
    marginVertical: Spacing.xs,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    ...Typography.caption,
    marginBottom: 2,
  },
  locationAddress: {
    ...Typography.body,
  },
  rideStats: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  statText: {
    ...Typography.body,
  },
  requestActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  declineButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  acceptButtonText: {
    ...Typography.button,
    color: "#fff",
  },
  heatmapToggle: {
    position: "absolute",
    right: Spacing.lg,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  heatmapLegend: {
    position: "absolute",
    right: Spacing.lg,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  heatmapTitle: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  legendItems: {
    gap: 4,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    ...Typography.caption,
  },
  heatmapSubtext: {
    ...Typography.caption,
    marginTop: Spacing.xs,
    fontSize: 10,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  customerName: {
    ...Typography.body,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    ...Typography.body,
    fontWeight: "600",
  },
  ridesCount: {
    ...Typography.caption,
  },
  networkEfficiency: {
    ...Typography.small,
    letterSpacing: 0.5,
  },
  monthlyYieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(128, 128, 128, 0.15)",
  },
  yieldLabel: {
    ...Typography.small,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  yieldValue: {
    fontSize: 18,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  activationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
  },
  activationContent: {
    alignItems: "center",
    gap: Spacing.lg,
  },
  activationIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 177, 79, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  activationTitle: {
    fontSize: 24,
    fontWeight: "300",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  activationSubtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  networkHubsButton: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  networkHubsTextContainer: {
    flex: 1,
  },
  networkHubsTitle: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  networkHubsSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
  },
});
