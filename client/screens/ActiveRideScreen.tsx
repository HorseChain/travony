import React, { useEffect, useState, useRef } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Linking,
  Alert,
  Share,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import RideMap from "@/components/RideMap";
import LiteTripView from "@/components/LiteTripView";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import { RideChat } from "@/components/RideChat";
import { useRideMessages } from "@/hooks/useRideMessages";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "ActiveRide">;
type RouteProps = RouteProp<HomeStackParamList, "ActiveRide">;

const statusMessages: Record<string, { title: string; subtitle: string; icon: string }> = {
  pending: { title: "Optimizing your route", subtitle: "Matching with the ideal vehicle", icon: "search" },
  accepted: { title: "Route optimized", subtitle: "Vehicle assigned and approaching", icon: "checkmark-circle-outline" },
  arriving: { title: "Vehicle arriving", subtitle: "Your vehicle will arrive shortly", icon: "navigate-outline" },
  started: { title: "Route in progress", subtitle: "Enjoy your journey", icon: "location-outline" },
  in_progress: { title: "Route in progress", subtitle: "Enjoy your journey", icon: "location-outline" },
  completed: { title: "Route completed", subtitle: "Thank you for travelling with Travony", icon: "checkmark-circle-outline" },
};

interface Ride {
  id: string;
  status: string;
  pickupLat: string | number;
  pickupLng: string | number;
  pickupAddress: string;
  dropoffLat: string | number;
  dropoffLng: string | number;
  dropoffAddress: string;
  estimatedFare: string;
  otp?: string;
  driverId?: string;
  driverPhone?: string;
  isEvRide?: boolean;
  isShared?: boolean;
}

interface PoolStatus {
  isShared: true;
  poolGroupId: string | null;
  poolStatus: "forming" | "matched" | "accepted" | "started" | "completed" | "cancelled" | "no_match";
  seatsFilled: number;
  maxSeats: number;
  coRiderCount: number;
  yourFare: number;
  soloFare: number;
  savings: number;
  currency: string;
  windowSecondsLeft: number;
}

interface TelemetryData {
  rideId: string;
  status: string;
  driverLocation: { lat: number; lng: number } | null;
  eta: number | null;
  isLiveLocation: boolean;
  routeCoordinates: Array<{ latitude: number; longitude: number }>;
  driverRouteCoordinates: Array<{ latitude: number; longitude: number }>;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  driver: {
    id: string;
    name: string;
    phone: string | null;
    rating: string;
    vehicleType: string;
    licensePlate: string;
    vehicleMake?: string;
    vehicleModel?: string;
    vehicleColor?: string;
    vehicleVerified?: boolean;
    isElectric?: boolean;
  } | null;
}

export default function ActiveRideScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();

  const { rideId } = route.params;
  const { user } = useAuth();
  const { liteMode } = useLiteMode();

  const [prevStatus, setPrevStatus] = useState<string | null>(null);
  const [sharePromptShown, setSharePromptShown] = useState(false);
  const [coffeePromptShown, setCoffeePromptShown] = useState(false);
  const [showShareBanner, setShowShareBanner] = useState(false);
  const [showCoffeeCard, setShowCoffeeCard] = useState(false);
  const shareBannerAnim = useRef(new Animated.Value(0)).current;
  const coffeeCardAnim = useRef(new Animated.Value(0)).current;

  const { data: ride, refetch } = useQuery<Ride>({
    queryKey: ["/api/rides", rideId],
    refetchInterval: litePollMs(5000, liteMode),
  });

  const { data: telemetry } = useQuery<TelemetryData>({
    queryKey: ["/api/rides", rideId, "telemetry"],
    refetchInterval: litePollMs(3000, liteMode),
    enabled: !!rideId && ride?.status !== "completed",
  });

  const { data: pool, refetch: refetchPool } = useQuery<PoolStatus>({
    queryKey: ["/api/rides", rideId, "pool"],
    refetchInterval: litePollMs(4000, liteMode),
    enabled: !!rideId && !!ride?.isShared && ride?.status === "pending",
  });

  const goSoloMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/rides/${rideId}/pool/go-solo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      refetch();
      refetchPool();
    },
    onError: (error: any) => Alert.alert("Error", error.message || "Could not switch to a solo ride"),
  });

  const extendPoolMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/rides/${rideId}/pool/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => refetchPool(),
    onError: (error: any) => Alert.alert("Error", error.message || "Could not keep waiting"),
  });

  useEffect(() => {
    if (ride?.status === "completed") {
      navigation.navigate("Rating", {
        rideId: ride.id,
        driverId: ride.driverId || "",
        driverName: telemetry?.driver?.name || "Driver",
      });
    }
  }, [ride?.status]);

  useEffect(() => {
    if (!ride) return;
    const status = ride.status;

    if (status !== prevStatus) {
      if (status === "accepted" && prevStatus === "pending" && !sharePromptShown) {
        setSharePromptShown(true);
        setShowShareBanner(true);
        Animated.spring(shareBannerAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
        setTimeout(() => {
          Animated.timing(shareBannerAnim, { toValue: 0, duration: 400, useNativeDriver: true }).start(() => {
            setShowShareBanner(false);
          });
        }, 8000);
      }

      if ((status === "in_progress" || status === "started") && !coffeePromptShown) {
        setCoffeePromptShown(true);
        setShowCoffeeCard(true);
        Animated.spring(coffeeCardAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
      }

      setPrevStatus(status);
    }
  }, [ride?.status, prevStatus, sharePromptShown, coffeePromptShown]);

  const driverPhone = telemetry?.driver?.phone || ride?.driverPhone;
  const [chatVisible, setChatVisible] = useState(false);
  const driverDisplayName = telemetry?.driver?.name || "your driver";
  const { unreadCount, markRead } = useRideMessages({
    rideId,
    myUserId: user?.id,
    active: !!rideId && ride?.status !== "completed",
    chatOpen: chatVisible,
    senderLabel: driverDisplayName,
  });

  const handleCallDriver = () => {
    if (driverPhone) {
      Linking.openURL(`tel:${driverPhone}`);
    } else {
      Alert.alert("Unable to call", "Driver phone number not available");
    }
  };

  const handleMessageDriver = () => {
    markRead();
    setChatVisible(true);
  };

  const handlePanic = () => {
    Alert.alert(
      "Emergency Alert",
      "Are you sure you want to send an emergency alert? This will notify local authorities.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Send Alert",
          style: "destructive",
          onPress: () => {
            Alert.alert("Alert Sent", "Emergency services have been notified. Stay safe.");
          },
        },
      ]
    );
  };

  const shareMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/rides/${rideId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: async (data: any) => {
      try {
        await Share.share({
          message: `Track my Travony journey in real-time: ${data.shareUrl}`,
          title: "Share My Journey",
        });
      } catch (error) {
        Alert.alert("Sharing failed", "Unable to share journey details");
      }
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to generate share link");
    },
  });

  const handleShareRide = () => {
    shareMutation.mutate();
    setShowShareBanner(false);
  };

  const handleDismissShareBanner = () => {
    Animated.timing(shareBannerAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowShareBanner(false);
    });
  };

  const handleDismissCoffeeCard = () => {
    Animated.timing(coffeeCardAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
      setShowCoffeeCard(false);
    });
  };

  const handleCancelRide = () => {
    Alert.alert(
      "Cancel Route",
      "Are you sure you want to cancel? Cancellation fees may apply.",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () => {
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const statusInfo = statusMessages[ride?.status || "pending"] || statusMessages.pending;

  const pickupLocation = telemetry ? {
    lat: telemetry.pickup.lat,
    lng: telemetry.pickup.lng,
    address: telemetry.pickup.address,
  } : ride ? {
    lat: Number(ride.pickupLat),
    lng: Number(ride.pickupLng),
    address: ride.pickupAddress,
  } : null;

  const dropoffLocation = telemetry ? {
    lat: telemetry.dropoff.lat,
    lng: telemetry.dropoff.lng,
    address: telemetry.dropoff.address,
  } : ride ? {
    lat: Number(ride.dropoffLat),
    lng: Number(ride.dropoffLng),
    address: ride.dropoffAddress,
  } : null;

  const driverLocation = telemetry?.driverLocation || null;
  const eta = telemetry?.eta || null;
  const routeCoordinates = telemetry?.routeCoordinates || [];
  const showDriverMarker = ride?.status !== "pending" && ride?.status !== "completed" && !!driverLocation;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {liteMode ? (
        <LiteTripView
          pickupAddress={pickupLocation?.address}
          dropoffAddress={dropoffLocation?.address}
          statusTitle={statusInfo.title}
          statusSubtitle={statusInfo.subtitle}
          eta={eta}
        />
      ) : (
        <RideMap
          pickupLocation={pickupLocation}
          dropoffLocation={dropoffLocation}
          driverLocation={driverLocation}
          routeCoordinates={routeCoordinates}
          showUserLocation={true}
          showRoute={true}
          showDriverMarker={showDriverMarker}
          eta={eta || undefined}
          rideStatus={ride?.status}
          interactive={true}
        />
      )}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.card }]}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>

        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusIcon, { backgroundColor: theme.primary + "20" }]}>
              <Ionicons name={statusInfo.icon as any} size={20} color={theme.primary} />
            </View>
            <View style={styles.statusTextContainer}>
              <ThemedText style={styles.statusTitle}>{statusInfo.title}</ThemedText>
              <ThemedText style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
                {statusInfo.subtitle}
              </ThemedText>
            </View>
          </View>
          {eta && ride?.status !== "completed" ? (
            <View style={[styles.etaBadge, { backgroundColor: theme.primary }]}>
              <Ionicons name="time-outline" size={14} color="#FFFFFF" />
              <ThemedText style={styles.etaBadgeText}>{eta} min</ThemedText>
            </View>
          ) : null}
          {ride?.status === "accepted" && ride?.estimatedFare ? (
            <View style={[styles.fareLockBadge, { borderColor: Colors.travonyGreen + "40" }]}>
              <Ionicons name="shield-checkmark-outline" size={12} color={Colors.travonyGreen} />
              <ThemedText style={[styles.fareLockBadgeText, { color: Colors.travonyGreen }]}>
                Your fare is locked at AED {ride.estimatedFare}
              </ThemedText>
            </View>
          ) : null}
          {ride?.status !== "completed" && ride?.status !== "pending" ? (
            <View style={styles.etaIntelligence}>
              <View style={styles.etaIntelDot} />
              <ThemedText style={[styles.etaIntelText, { color: theme.textMuted }]}>ETA Intelligence: Active</ThemedText>
            </View>
          ) : null}
        </Card>
      </View>

      {showShareBanner ? (
        <Animated.View
          style={[
            styles.shareBanner,
            {
              backgroundColor: theme.card,
              top: insets.top + 210,
              opacity: shareBannerAnim,
              transform: [{ translateY: shareBannerAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <View style={styles.shareBannerContent}>
            <Ionicons name="share-social-outline" size={18} color={theme.primary} />
            <ThemedText style={[styles.shareBannerText, { color: theme.text }]}>
              Want to share your journey? Your contact can follow along live.
            </ThemedText>
          </View>
          <View style={styles.shareBannerActions}>
            <Pressable
              style={[styles.shareBannerBtn, { backgroundColor: theme.primary }]}
              onPress={handleShareRide}
            >
              <ThemedText style={styles.shareBannerBtnText}>Share</ThemedText>
            </Pressable>
            <Pressable style={styles.shareBannerDismiss} onPress={handleDismissShareBanner}>
              <Ionicons name="close-outline" size={18} color={theme.textMuted} />
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {ride?.status !== "pending" && telemetry?.driver ? (
        <View style={[styles.driverCard, { backgroundColor: theme.card }]}>
          <View style={[styles.driverAvatar, { backgroundColor: theme.backgroundDefault }]}>
            <Ionicons name="person-outline" size={24} color={theme.primary} />
          </View>
          <View style={styles.driverInfo}>
            <View style={styles.driverNameRow}>
              <ThemedText style={styles.driverName}>{telemetry.driver.name}</ThemedText>
              {telemetry.driver.vehicleVerified ? (
                <View style={[styles.verifiedBadge, { backgroundColor: theme.primary + "20" }]}>
                  <Ionicons name="shield-checkmark" size={12} color={theme.primary} />
                  <ThemedText style={[styles.verifiedText, { color: theme.primary }]}>Verified</ThemedText>
                </View>
              ) : null}
            </View>
            <View style={styles.driverDetails}>
              <View style={styles.driverRating}>
                <Ionicons name="star-outline" size={14} color={theme.warning} />
                <ThemedText style={[styles.driverRatingText, { color: theme.textSecondary }]}>
                  {telemetry.driver.rating}
                </ThemedText>
              </View>
              {telemetry.driver.licensePlate ? (
                <View style={[styles.licensePlate, { backgroundColor: theme.backgroundDefault }]}>
                  <ThemedText style={styles.licensePlateText}>
                    {telemetry.driver.licensePlate}
                  </ThemedText>
                </View>
              ) : null}
            </View>
            {(telemetry.driver.vehicleMake || telemetry.driver.vehicleColor) ? (
              <View style={styles.vehicleDetails}>
                <Ionicons name="car-outline" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.vehicleText, { color: theme.textSecondary }]}>
                  {[telemetry.driver.vehicleColor, telemetry.driver.vehicleMake, telemetry.driver.vehicleModel].filter(Boolean).join(" ")}
                </ThemedText>
              </View>
            ) : null}
            {(telemetry.driver.isElectric || ride?.isEvRide) ? (
              <View style={[styles.evBadge, { backgroundColor: "#16a34a15" }]}>
                <Ionicons name="flash" size={13} color="#16a34a" />
                <ThemedText style={[styles.evBadgeText, { color: "#16a34a" }]}>
                  {telemetry.driver.isElectric ? "Electric Vehicle" : "EV Requested"}
                </ThemedText>
              </View>
            ) : null}
          </View>
          <View style={styles.driverActions}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={handleCallDriver}
            >
              <Ionicons name="call-outline" size={20} color={theme.primary} />
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={handleMessageDriver}
            >
              <Ionicons name="chatbubble-outline" size={20} color={theme.primary} />
              {unreadCount > 0 ? (
                <View style={styles.chatBadge}>
                  <ThemedText style={styles.chatBadgeText}>
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={[styles.sideButtons, { bottom: insets.bottom + 200 }]}>
        <Pressable
          style={[styles.shareButton, { backgroundColor: theme.primary }]}
          onPress={handleShareRide}
          disabled={shareMutation.isPending}
        >
          <Ionicons name="share-social-outline" size={22} color="#FFFFFF" />
        </Pressable>
        <Pressable
          style={styles.panicButton}
          onPress={handlePanic}
        >
          <Ionicons name="warning-outline" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      {user?.id && rideId ? (
        <RideChat
          rideId={rideId}
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          myUserId={user.id}
          otherPartyName={driverDisplayName}
        />
      ) : null}

      <View
        style={[
          styles.bottomSheet,
          { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.lg },
        ]}
      >
        <View style={styles.rideDetails}>
          <View style={styles.rideDetailRow}>
            <View style={styles.locationInfo}>
              <View style={[styles.locationDot, { backgroundColor: theme.primary }]} />
              <ThemedText style={styles.locationText} numberOfLines={1}>
                {pickupLocation?.address || "Loading..."}
              </ThemedText>
            </View>
          </View>
          <View style={styles.locationDivider}>
            <View style={[styles.verticalLine, { borderColor: theme.border }]} />
          </View>
          <View style={styles.rideDetailRow}>
            <View style={styles.locationInfo}>
              <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
              <ThemedText style={styles.locationText} numberOfLines={1}>
                {dropoffLocation?.address || "Loading..."}
              </ThemedText>
            </View>
          </View>
        </View>

        <View style={[styles.fareInfo, { borderTopColor: theme.border }]}>
          <View style={styles.fareItem}>
            <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>Fare</ThemedText>
            <ThemedText style={styles.fareValue}>AED {ride?.estimatedFare || "0.00"}</ThemedText>
          </View>
          {ride?.otp ? (
            <View style={styles.fareItem}>
              <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>OTP</ThemedText>
              <ThemedText style={[styles.otpValue, { color: theme.primary }]}>{ride.otp}</ThemedText>
            </View>
          ) : null}
        </View>

        {ride?.otp ? (
          <ThemedText style={[styles.otpHint, { color: theme.textMuted }]}>
            Show this 4-digit code to your driver to confirm boarding.
          </ThemedText>
        ) : null}

        {showCoffeeCard ? (
          <Animated.View
            style={[
              styles.coffeeCard,
              { backgroundColor: "#FFF7ED", borderColor: "#F59E0B30", opacity: coffeeCardAnim, transform: [{ translateY: coffeeCardAnim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] },
            ]}
          >
            <Ionicons name="cafe-outline" size={20} color="#92400E" />
            <ThemedText style={styles.coffeeCardText}>
              Want something delivered to your destination?
            </ThemedText>
            <Pressable
              style={styles.coffeeOrderBtn}
              onPress={() => {
                handleDismissCoffeeCard();
                navigation.navigate("Coffee");
              }}
            >
              <ThemedText style={styles.coffeeOrderBtnText}>Order</ThemedText>
            </Pressable>
            <Pressable onPress={handleDismissCoffeeCard} style={styles.coffeeDismiss}>
              <Ionicons name="close-outline" size={16} color="#92400E" />
            </Pressable>
          </Animated.View>
        ) : null}

        {ride?.status === "pending" && ride?.isShared && pool ? (
          <View style={[styles.poolBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {pool.poolStatus === "no_match" ? (
              <>
                <View style={styles.poolHeaderRow}>
                  <Ionicons name="people-outline" size={20} color={theme.warning} />
                  <ThemedText style={[styles.poolTitle, { color: theme.text }]}>No co-rider yet</ThemedText>
                </View>
                <ThemedText style={[styles.poolSubtitle, { color: theme.textSecondary }]}>
                  We couldn't find anyone going your way right now. Go solo at the full fare, or keep waiting for a share.
                </ThemedText>
                <View style={styles.poolActions}>
                  <Pressable
                    style={[styles.poolBtnOutline, { borderColor: theme.border }]}
                    onPress={() => extendPoolMutation.mutate()}
                    disabled={extendPoolMutation.isPending}
                  >
                    <ThemedText style={[styles.poolBtnOutlineText, { color: theme.text }]}>Keep waiting</ThemedText>
                  </Pressable>
                  <Pressable
                    style={[styles.poolBtnFilled, { backgroundColor: theme.primary }]}
                    onPress={() => goSoloMutation.mutate()}
                    disabled={goSoloMutation.isPending}
                  >
                    <ThemedText style={styles.poolBtnFilledText}>
                      Go solo · {pool.currency} {pool.soloFare.toFixed(2)}
                    </ThemedText>
                  </Pressable>
                </View>
              </>
            ) : pool.poolStatus === "matched" ? (
              <View style={styles.poolHeaderRow}>
                <Ionicons name="checkmark-circle" size={20} color={theme.success} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.poolTitle, { color: theme.text }]}>
                    Share matched — you save {pool.currency} {pool.savings.toFixed(2)}
                  </ThemedText>
                  <ThemedText style={[styles.poolSubtitle, { color: theme.textSecondary }]}>
                    {pool.coRiderCount === 1 ? "1 co-rider joined" : `${pool.coRiderCount} co-riders joined`} · finding a driver
                  </ThemedText>
                </View>
              </View>
            ) : (
              <View style={styles.poolHeaderRow}>
                <ActivityIndicator color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={[styles.poolTitle, { color: theme.text }]}>Finding someone to share with</ThemedText>
                  <ThemedText style={[styles.poolSubtitle, { color: theme.textSecondary }]}>
                    Holding your discounted fare{pool.windowSecondsLeft > 0 ? ` · ${pool.windowSecondsLeft}s` : ""}
                  </ThemedText>
                </View>
              </View>
            )}
          </View>
        ) : null}

        {ride?.status === "pending" ? (
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              { borderColor: theme.error, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleCancelRide}
          >
            <ThemedText style={[styles.cancelButtonText, { color: theme.error }]}>
              Cancel Route
            </ThemedText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
    ...Shadows.card,
  },
  statusCard: {
    padding: Spacing.lg,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.h4,
  },
  statusSubtitle: {
    ...Typography.bodyMedium,
    marginTop: Spacing.xs,
  },
  etaBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  etaBadgeText: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  fareLockBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    marginTop: Spacing.sm,
    gap: Spacing.xs,
    paddingVertical: 4,
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  fareLockBadgeText: {
    ...Typography.small,
    fontWeight: "500",
  },
  shareBanner: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.card,
  },
  shareBannerContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  shareBannerText: {
    ...Typography.small,
    flex: 1,
    lineHeight: 18,
  },
  shareBannerActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  shareBannerBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  shareBannerBtnText: {
    ...Typography.caption,
    color: "#fff",
    fontWeight: "700",
  },
  shareBannerDismiss: {
    padding: 4,
  },
  driverCard: {
    position: "absolute",
    top: 220,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.card,
  },
  driverAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  driverInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  driverName: {
    ...Typography.body,
    fontWeight: "600",
  },
  driverDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  driverRating: {
    flexDirection: "row",
    alignItems: "center",
  },
  driverRatingText: {
    ...Typography.small,
    marginLeft: Spacing.xs,
  },
  licensePlate: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  licensePlateText: {
    ...Typography.small,
    fontWeight: "600",
  },
  driverNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  verifiedText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  vehicleDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    gap: 4,
  },
  vehicleText: {
    ...Typography.small,
  },
  driverActions: {
    flexDirection: "row",
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: Spacing.sm,
  },
  chatBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  chatBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  sideButtons: {
    position: "absolute",
    left: Spacing.lg,
    gap: Spacing.md,
  },
  shareButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.fab,
  },
  panicButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E53935",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.fab,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    ...Shadows.bottomSheet,
  },
  rideDetails: {
    marginBottom: Spacing.lg,
  },
  rideDetailRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  locationText: {
    ...Typography.body,
    flex: 1,
  },
  locationDivider: {
    paddingLeft: Spacing.lg + 6,
    paddingVertical: Spacing.xs,
  },
  verticalLine: {
    width: 2,
    height: 20,
    marginLeft: 5,
    borderLeftWidth: 2,
    borderStyle: "dashed",
  },
  fareInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    marginBottom: Spacing.sm,
  },
  fareItem: {
    alignItems: "center",
  },
  fareLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  fareValue: {
    ...Typography.h3,
  },
  otpValue: {
    ...Typography.h3,
    fontWeight: "700",
    letterSpacing: 2,
  },
  otpHint: {
    ...Typography.caption,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  coffeeCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  coffeeCardText: {
    flex: 1,
    fontSize: 12,
    color: "#92400E",
    fontWeight: "500",
  },
  coffeeOrderBtn: {
    backgroundColor: "#92400E",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  coffeeOrderBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  coffeeDismiss: {
    padding: 4,
  },
  cancelButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    ...Typography.button,
  },
  poolBanner: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  poolHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  poolTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  poolSubtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  poolActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  poolBtnOutline: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  poolBtnOutlineText: {
    ...Typography.button,
  },
  poolBtnFilled: {
    flex: 1,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  poolBtnFilledText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  etaIntelligence: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 6,
  },
  etaIntelDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.travonyGreen,
  },
  etaIntelText: {
    fontSize: 10,
    fontWeight: "400",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  evBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    alignSelf: "flex-start",
  },
  evBadgeText: {
    ...Typography.small,
    fontWeight: "600",
    marginLeft: 4,
  },
});
