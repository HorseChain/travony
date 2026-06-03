import { useState, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, Linking, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { RideChat } from "@/components/RideChat";
import { useRideMessages } from "@/hooks/useRideMessages";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { DriverHomeStackParamList } from "@/navigation/driver/DriverHomeStackNavigator";
import { MapView, Marker, mapsAvailable } from "@/components/NativeMaps";
import WebViewMap from "@/components/WebViewMap";

type NavigationProp = NativeStackNavigationProp<DriverHomeStackParamList>;
type RouteProps = RouteProp<DriverHomeStackParamList, "DriverActiveRide">;

interface Ride {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  pickupLat: string | number;
  pickupLng: string | number;
  dropoffLat: string | number;
  dropoffLng: string | number;
  estimatedFare: string;
  actualFare?: string;
  paymentMethod?: string;
  otp?: string;
  customer?: {
    name: string;
    phone?: string;
    avatar?: string;
  };
}

type RideStatus = "accepted" | "arriving" | "started" | "in_progress" | "completed";

const STATUS_STEPS: { key: string; label: string }[] = [
  { key: "accepted", label: "Accepted" },
  { key: "arriving", label: "Arrived" },
  { key: "started", label: "Ride Started" },
  { key: "completed", label: "Completed" },
];

function getStepIndex(status: string): number {
  switch (status) {
    case "accepted": return 0;
    case "arriving": return 1;
    case "started": return 2;
    case "in_progress": return 2;
    case "completed": return 3;
    default: return 0;
  }
}

function StatusProgressStrip({ status }: { status: string }) {
  const { theme } = useTheme();
  const currentStep = getStepIndex(status);
  return (
    <View style={progressStyles.container}>
      {STATUS_STEPS.map((step, index) => {
        const done = index <= currentStep;
        const isActive = index === currentStep;
        return (
          <View key={step.key} style={progressStyles.stepWrapper}>
            <View
              style={[
                progressStyles.dot,
                {
                  backgroundColor: done ? Colors.travonyGreen : theme.border,
                  borderColor: isActive ? Colors.travonyGreen : "transparent",
                  borderWidth: isActive ? 2 : 0,
                },
              ]}
            />
            <ThemedText
              style={[
                progressStyles.label,
                { color: done ? Colors.travonyGreen : theme.textMuted },
              ]}
            >
              {step.label}
            </ThemedText>
            {index < STATUS_STEPS.length - 1 ? (
              <View
                style={[
                  progressStyles.line,
                  { backgroundColor: index < currentStep ? Colors.travonyGreen : theme.border },
                ]}
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const progressStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xs,
  },
  stepWrapper: {
    alignItems: "center",
    flex: 1,
    position: "relative",
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginBottom: 4,
  },
  label: {
    ...Typography.small,
    textAlign: "center",
    fontSize: 10,
  },
  line: {
    position: "absolute",
    top: 6,
    left: "55%",
    right: "-55%",
    height: 2,
    zIndex: -1,
  },
});

export default function DriverActiveRideScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();
  const mapRef = useRef<any>(null);

  const { rideId } = route.params || {};
  const validRideId = typeof rideId === "string" ? rideId : "";
  const { user } = useAuth();

  const [chatVisible, setChatVisible] = useState(false);
  const [showEarningsFlash, setShowEarningsFlash] = useState(false);
  const [postRideFare, setPostRideFare] = useState("");
  const [todayTotal, setTodayTotal] = useState("");
  const [rideTruthScore, setRideTruthScore] = useState<number | null>(null);
  const earningsOpacity = useSharedValue(0);
  const earningsTranslate = useSharedValue(20);

  const { data: ride, isLoading } = useQuery<Ride>({
    queryKey: ["/api/rides", validRideId],
    refetchInterval: 5000,
    enabled: !!validRideId,
  });

  const { unreadCount, markRead } = useRideMessages({
    rideId: validRideId,
    myUserId: user?.id,
    active: !!validRideId && ride?.status !== "completed",
    chatOpen: chatVisible,
    senderLabel: "your rider",
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: RideStatus) => {
      const updates: any = { status };
      if (status === "started" || status === "in_progress") {
        updates.startedAt = new Date().toISOString();
      } else if (status === "completed") {
        updates.completedAt = new Date().toISOString();
      }
      return apiRequest(`/api/rides/${validRideId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides", validRideId] });
      if (data.status === "completed") {
        const fare = data.actualFare || data.estimatedFare || "0.00";
        setPostRideFare(fare);
        try {
          const earnings = await apiRequest("/api/drivers/earnings");
          setTodayTotal(earnings?.totalEarnings ?? "0.00");
        } catch {}
        try {
          const score = await apiRequest(`/api/truth/rides/${validRideId}/score`);
          if (score?.score?.totalScore != null) {
            setRideTruthScore(Math.round(score.score.totalScore));
          }
        } catch {}
        setShowEarningsFlash(true);
        earningsOpacity.value = withTiming(1, { duration: 400 });
        earningsTranslate.value = withSpring(0);
        setTimeout(() => {
          earningsOpacity.value = withTiming(0, { duration: 400 });
          setTimeout(() => {
            setShowEarningsFlash(false);
            navigation.goBack();
          }, 450);
        }, 2500);
      }
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update ride status");
    },
  });

  const earningsFlashStyle = useAnimatedStyle(() => ({
    opacity: earningsOpacity.value,
    transform: [{ translateY: earningsTranslate.value }],
  }));

  const getStatusInfo = () => {
    if (!ride) return { title: "Loading...", subtitle: "", action: "", nextStatus: null as RideStatus | null };
    switch (ride.status) {
      case "accepted":
        return {
          title: "Navigate to Pickup",
          subtitle: ride.pickupAddress,
          action: "Arrived at Pickup",
          nextStatus: "arriving" as RideStatus,
        };
      case "arriving":
        return {
          title: "Waiting for Rider",
          subtitle: "Rider has been notified you're here",
          action: "Start Ride",
          nextStatus: "started" as RideStatus,
        };
      case "started":
      case "in_progress":
        return {
          title: "Trip in Progress",
          subtitle: ride.dropoffAddress,
          action: "Complete Ride",
          nextStatus: "completed" as RideStatus,
        };
      default:
        return {
          title: "Ride Status",
          subtitle: ride.status,
          action: "",
          nextStatus: null as RideStatus | null,
        };
    }
  };

  const statusInfo = getStatusInfo();

  const handleCallCustomer = () => {
    if (ride?.customer?.phone) {
      Linking.openURL(`tel:${ride.customer.phone}`);
    } else {
      Alert.alert("Unable to Call", "Customer phone number not available");
    }
  };

  const handleNavigate = () => {
    if (!ride) return;
    const isEnRoute = ride.status === "started" || ride.status === "in_progress";
    const destination = isEnRoute
      ? { lat: ride.dropoffLat, lng: ride.dropoffLng }
      : { lat: ride.pickupLat, lng: ride.pickupLng };
    const url = Platform.select({
      ios: `maps:?daddr=${destination.lat},${destination.lng}`,
      android: `google.navigation:q=${destination.lat},${destination.lng}`,
      default: `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}`,
    });
    Linking.openURL(url);
  };

  const handleStatusUpdate = () => {
    if (!statusInfo.nextStatus) return;
    if (statusInfo.nextStatus === "completed" && ride?.paymentMethod === "cash") {
      const fare = ride.actualFare || ride.estimatedFare || "0.00";
      Alert.alert(
        "Collect Cash Payment",
        `Please collect AED ${fare} from the customer before completing the ride.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Cash Collected", onPress: () => updateStatusMutation.mutate("completed") },
        ]
      );
    } else {
      updateStatusMutation.mutate(statusInfo.nextStatus);
    }
  };

  const handleCancelRide = () => {
    Alert.alert("Cancel Ride", "Are you sure you want to cancel this ride?", [
      { text: "No", style: "cancel" },
      {
        text: "Yes, Cancel",
        style: "destructive",
        onPress: async () => {
          try {
            await apiRequest(`/api/rides/${validRideId}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "cancelled", cancelledAt: new Date().toISOString() }),
              headers: { "Content-Type": "application/json" },
            });
            navigation.goBack();
          } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to cancel ride");
          }
        },
      },
    ]);
  };

  const renderMap = () => {
    if (Platform.OS === "android") {
      return (
        <View style={styles.map}>
          <WebViewMap
            isDark={isDark}
            pickupLocation={ride ? { lat: Number(ride.pickupLat), lng: Number(ride.pickupLng) } : null}
            dropoffLocation={ride ? { lat: Number(ride.dropoffLat), lng: Number(ride.dropoffLng) } : null}
          />
        </View>
      );
    }
    if (Platform.OS === "web" || !mapsAvailable || !MapView) {
      return (
        <View style={[styles.mapPlaceholder, { backgroundColor: theme.backgroundElevated }]}>
          <Ionicons name="navigate-outline" size={48} color={theme.primary} />
          <ThemedText style={[styles.mapPlaceholderText, { color: theme.textSecondary }]}>
            {Platform.OS === "web" ? "Map view available in Expo Go" : "Navigate to pickup location"}
          </ThemedText>
        </View>
      );
    }
    return (
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={{
          latitude: Number(ride?.pickupLat) || 25.2048,
          longitude: Number(ride?.pickupLng) || 55.2708,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        }}
        showsUserLocation
      >
        {ride ? (
          <>
            <Marker
              coordinate={{ latitude: Number(ride.pickupLat), longitude: Number(ride.pickupLng) }}
              title="Pickup"
              pinColor={Colors.travonyGreen}
            />
            <Marker
              coordinate={{ latitude: Number(ride.dropoffLat), longitude: Number(ride.dropoffLng) }}
              title="Drop-off"
              pinColor={theme.error}
            />
          </>
        ) : null}
      </MapView>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.centered]}>
        <ThemedText>Loading ride details...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.mapContainer}>{renderMap()}</View>

      <View style={[styles.header, { top: insets.top + Spacing.md }]}>
        <Pressable
          style={[styles.backButton, { backgroundColor: theme.backgroundRoot }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
        </Pressable>
      </View>

      <ScrollView
        style={[styles.bottomPanel, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
      >
        <StatusProgressStrip status={ride?.status ?? "accepted"} />

        <View style={styles.statusHeader}>
          <View style={[styles.statusIndicator, { backgroundColor: Colors.travonyGreen }]} />
          <View style={styles.statusInfo}>
            <ThemedText style={styles.statusTitle}>{statusInfo.title}</ThemedText>
            <ThemedText style={[styles.statusSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {statusInfo.subtitle}
            </ThemedText>
          </View>
        </View>

        {ride?.status === "arriving" ? (
          <View style={[styles.otpBanner, { backgroundColor: Colors.travonyGreen + "12" }]}>
            <Ionicons name="shield-checkmark-outline" size={18} color={Colors.travonyGreen} />
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.otpBannerText, { color: Colors.travonyGreen }]}>
                Rider will show you a 4-digit code. Match it to start the trip.
              </ThemedText>
              {ride.otp ? (
                <View style={styles.otpCodeRow}>
                  <ThemedText style={[styles.otpCodeLabel, { color: Colors.travonyGreen }]}>
                    Expected code:
                  </ThemedText>
                  <ThemedText style={[styles.otpCode, { color: Colors.travonyGreen }]}>
                    {ride.otp}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {ride ? (
          <View style={[styles.customerInfo, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.customerAvatar}>
              <Ionicons name="person-outline" size={20} color={theme.textMuted} />
            </View>
            <View style={styles.customerDetails}>
              <ThemedText style={styles.customerName} numberOfLines={1}>{ride.customer?.name || "Customer"}</ThemedText>
              <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
                <ThemedText style={[styles.fareAmount, { color: Colors.travonyGreen }]}>
                  AED {ride.estimatedFare || "0.00"}
                </ThemedText>
                {ride.paymentMethod === "cash" ? (
                  <View style={[styles.paymentBadge, { backgroundColor: "#F59E0B20" }]}>
                    <Ionicons name="cash-outline" size={12} color="#F59E0B" />
                    <ThemedText style={{ fontSize: 11, fontWeight: "600", color: "#F59E0B" }}>Cash</ThemedText>
                  </View>
                ) : ride.paymentMethod === "card" ? (
                  <View style={[styles.paymentBadge, { backgroundColor: "#4F46E520" }]}>
                    <Ionicons name="card-outline" size={12} color="#4F46E5" />
                    <ThemedText style={{ fontSize: 11, fontWeight: "600", color: "#4F46E5" }}>Card</ThemedText>
                  </View>
                ) : ride.paymentMethod === "usdt" ? (
                  <View style={[styles.paymentBadge, { backgroundColor: "#26A17B20" }]}>
                    <ThemedText style={{ fontSize: 11, fontWeight: "600", color: "#26A17B" }}>USDT</ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.customerActions}>
              <Pressable
                style={[styles.actionButton, { borderColor: theme.border }]}
                onPress={handleCallCustomer}
              >
                <Ionicons name="call-outline" size={18} color={Colors.travonyGreen} />
              </Pressable>
              <Pressable
                style={[styles.chatButton, { backgroundColor: Colors.travonyGreen }]}
                onPress={() => {
                  markRead();
                  setChatVisible(true);
                }}
              >
                <Ionicons name="chatbubble-ellipses" size={18} color="#fff" />
                <ThemedText style={styles.chatButtonLabel}>Chat</ThemedText>
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

        <View style={styles.buttonSection}>
          <Pressable
            style={[styles.navigateButton, { backgroundColor: Colors.travonyGreen }]}
            onPress={handleNavigate}
          >
            <Ionicons name="navigate" size={22} color="#fff" />
            <ThemedText style={styles.navigateButtonText}>
              Navigate to {(ride?.status === "started" || ride?.status === "in_progress") ? "Drop-off" : "Pickup"}
            </ThemedText>
          </Pressable>

          {statusInfo.nextStatus ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.backgroundElevated, borderColor: theme.border, borderWidth: 1 }]}
              onPress={handleStatusUpdate}
              disabled={updateStatusMutation.isPending}
            >
              <ThemedText style={[styles.primaryButtonText, { color: theme.textPrimary }]}>
                {updateStatusMutation.isPending ? "Updating..." : statusInfo.action}
              </ThemedText>
            </Pressable>
          ) : null}

          {ride?.status !== "started" && ride?.status !== "in_progress" && ride?.status !== "completed" ? (
            <Pressable
              style={[styles.cancelButton, { borderColor: theme.error }]}
              onPress={handleCancelRide}
            >
              <ThemedText style={[styles.cancelButtonText, { color: theme.error }]}>Cancel Ride</ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      {user?.id && validRideId ? (
        <RideChat
          rideId={validRideId}
          visible={chatVisible}
          onClose={() => setChatVisible(false)}
          myUserId={user.id}
          otherPartyName={ride?.customer?.name || "your rider"}
        />
      ) : null}

      {showEarningsFlash ? (
        <Animated.View style={[styles.earningsFlash, earningsFlashStyle]}>
          <View style={[styles.earningsFlashCard, { backgroundColor: Colors.travonyGreen }]}>
            <ThemedText style={styles.earningsFlashFare}>AED {postRideFare} earned</ThemedText>
            {todayTotal ? (
              <ThemedText style={styles.earningsFlashTotal}>Today: AED {todayTotal}</ThemedText>
            ) : null}
            {rideTruthScore !== null ? (
              <ThemedText style={styles.earningsFlashScore}>
                Ride score: {rideTruthScore}/100
              </ThemedText>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { justifyContent: "center", alignItems: "center" },
  mapContainer: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  mapPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  mapPlaceholderText: { ...Typography.body },
  header: {
    position: "absolute",
    left: Spacing.lg,
    zIndex: 10,
  },
  backButton: {
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
      android: { elevation: 4 },
    }),
  },
  bottomPanel: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusInfo: { flex: 1 },
  statusTitle: { ...Typography.h4, marginBottom: 2 },
  statusSubtitle: { ...Typography.body },
  otpBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  otpBannerText: {
    ...Typography.body,
    fontWeight: "600",
    marginBottom: 4,
  },
  otpCodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 4,
  },
  otpCodeLabel: {
    ...Typography.bodyMedium,
    fontWeight: "500",
  },
  otpCode: {
    ...Typography.h3,
    fontWeight: "800",
    letterSpacing: 4,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.05)",
    justifyContent: "center",
    alignItems: "center",
  },
  customerDetails: { flex: 1 },
  customerName: { ...Typography.h4, marginBottom: 2 },
  fareAmount: { ...Typography.body, fontWeight: "600" },
  customerActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  chatButton: {
    height: 44,
    borderRadius: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
  },
  chatButtonLabel: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
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
  buttonSection: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  navigateButton: {
    height: 60,
    borderRadius: 30,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: Colors.travonyGreen,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 6 },
    }),
  },
  navigateButtonText: {
    ...Typography.button,
    color: "#fff",
    fontSize: 17,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    ...Typography.button,
  },
  cancelButton: {
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: { ...Typography.button },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  earningsFlash: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 200,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  earningsFlashCard: {
    borderRadius: BorderRadius["2xl"],
    paddingHorizontal: Spacing.xl * 2,
    paddingVertical: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: Colors.travonyGreen,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
      },
      android: { elevation: 12 },
    }),
  },
  earningsFlashFare: {
    ...Typography.h2,
    color: "#fff",
    fontWeight: "800",
  },
  earningsFlashTotal: {
    ...Typography.body,
    color: "rgba(255,255,255,0.85)",
    fontWeight: "600",
  },
  earningsFlashScore: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.7)",
    marginTop: 2,
  },
});
