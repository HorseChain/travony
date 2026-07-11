import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, Platform, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  interpolateColor,
  runOnJS,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import RideMap from "@/components/RideMap";
import LiteTripView from "@/components/LiteTripView";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { DriverHomeStackParamList } from "@/navigation/driver/DriverHomeStackNavigator";
import { DriverHomeSkeleton } from "@/components/SkeletonLoader";
import * as Haptics from "expo-haptics";

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
  isEvRide?: boolean;
  isSafeDriver?: boolean;
  isNamedFare?: boolean;
  riderProposedFare?: string | null;
  offerExpiresAt?: string | null;
  isShared?: boolean;
  poolGroupId?: string;
  riderCount?: number;
  maxSeats?: number;
  combinedFare?: number;
  combinedDriverEarnings?: number;
  currency?: string;
  stops?: Array<{ rideId: string; pickupAddress: string; dropoffAddress: string; fare: number; riderName?: string }>;
}

interface Hub {
  id: string;
  name: string;
  lat: string | number;
  lng: string | number;
  demandScore?: number;
  isEvHub?: boolean;
  availablePorts?: number;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const COUNTDOWN_SECONDS = 15;
const RING_SIZE = 80;
const RING_BORDER = 6;

function CountdownRing({ seconds, total, onGreenBg = false }: { seconds: number; total: number; onGreenBg?: boolean }) {
  const progress = seconds / total; // 1→0 as time runs out
  const ringColor = onGreenBg
    ? seconds <= 5 ? "#FFB3B3" : "rgba(255,255,255,0.9)"
    : seconds <= 5 ? "#E53935" : seconds <= 10 ? "#FF8C00" : Colors.travonyGreen;
  const trackColor = onGreenBg ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.12)";
  // Two-half technique: rotate left half and right half independently
  const halfProgress = Math.min(progress * 2, 1); // 0→1 for first half
  const secondHalfProgress = Math.max(progress * 2 - 1, 0); // 0→1 for second half
  const firstHalfAngle = halfProgress * 180;
  const secondHalfAngle = secondHalfProgress * 180;
  const clipInner = RING_SIZE / 2 - RING_BORDER;
  return (
    <View style={{ width: RING_SIZE, height: RING_SIZE }}>
      {/* Track circle */}
      <View
        style={{
          position: "absolute",
          width: RING_SIZE,
          height: RING_SIZE,
          borderRadius: RING_SIZE / 2,
          borderWidth: RING_BORDER,
          borderColor: trackColor,
        }}
      />
      {/* Left half clip */}
      <View style={{ position: "absolute", width: RING_SIZE / 2, height: RING_SIZE, left: 0, overflow: "hidden" }}>
        <View
          style={{
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
            borderWidth: RING_BORDER,
            borderColor: ringColor,
            transform: [{ rotate: `${secondHalfAngle - 180}deg` }],
            opacity: progress > 0.5 ? 1 : 0,
          }}
        />
      </View>
      {/* Right half clip */}
      <View style={{ position: "absolute", width: RING_SIZE / 2, height: RING_SIZE, right: 0, overflow: "hidden" }}>
        <View
          style={{
            position: "absolute",
            left: -(RING_SIZE / 2),
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_SIZE / 2,
            borderWidth: RING_BORDER,
            borderColor: ringColor,
            transform: [{ rotate: `${firstHalfAngle}deg` }],
          }}
        />
      </View>
      {/* Inner mask to make it look like a ring (matches parent bg) */}
      {onGreenBg ? (
        <View
          style={{
            position: "absolute",
            width: clipInner * 2,
            height: clipInner * 2,
            borderRadius: clipInner,
            backgroundColor: Colors.travonyGreen,
            top: RING_BORDER,
            left: RING_BORDER,
          }}
        />
      ) : null}
    </View>
  );
}

function AnimatedToggle({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const { theme } = useTheme();
  const animProgress = useSharedValue(value ? 1 : 0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    animProgress.value = withSpring(value ? 1 : 0, { damping: 18, stiffness: 180 });
    if (value) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1);
    }
  }, [value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      animProgress.value,
      [0, 1],
      ["#9E9E9E", Colors.travonyGreen]
    ),
    width: 76 + animProgress.value * 8,
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: animProgress.value * 28 }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)}>
      <Animated.View style={[styles.toggleTrack, trackStyle]}>
        <Animated.View style={[styles.toggleThumb, thumbStyle]}>
          {value ? (
            <Animated.View style={[styles.toggleDot, pulseStyle]} />
          ) : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const EV_HOLD_MS = 1100;

function EvHoldControl({
  isOnline,
  busy,
  onActivate,
  onDeactivate,
}: {
  isOnline: boolean;
  busy: boolean;
  onActivate: () => void;
  onDeactivate: () => void;
}) {
  const { theme } = useTheme();
  const progress = useSharedValue(0);
  const [holding, setHolding] = useState(false);
  const livePulse = useSharedValue(1);

  useEffect(() => {
    if (isOnline) {
      livePulse.value = withRepeat(
        withSequence(withTiming(0.4, { duration: 850 }), withTiming(1, { duration: 850 })),
        -1,
        false
      );
    } else {
      livePulse.value = withTiming(1);
    }
  }, [isOnline]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  const dotStyle = useAnimatedStyle(() => ({ opacity: livePulse.value }));

  const beginHold = useCallback(() => {
    setHolding(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const cancelHold = useCallback(() => {
    setHolding(false);
  }, []);

  const completeHold = useCallback(() => {
    setHolding(false);
    onActivate();
  }, [onActivate]);

  const holdGesture = Gesture.LongPress()
    .minDuration(EV_HOLD_MS)
    .maxDistance(80)
    .onBegin(() => {
      progress.value = withTiming(1, { duration: EV_HOLD_MS });
      runOnJS(beginHold)();
    })
    .onStart(() => {
      progress.value = withTiming(0, { duration: 250 });
      runOnJS(completeHold)();
    })
    .onFinalize((_e, success) => {
      if (!success) {
        progress.value = withTiming(0, { duration: 220 });
        runOnJS(cancelHold)();
      }
    });

  if (isOnline) {
    return (
      <Pressable
        onPress={() => {
          if (!busy) onDeactivate();
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="You are live as an EV driver. Tap to go offline."
        style={({ pressed }) => [
          styles.evHoldBar,
          { backgroundColor: Colors.travonyGreen, opacity: pressed ? 0.9 : 1 },
        ]}
      >
        <Animated.View style={[styles.evLiveDot, dotStyle]} />
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.evHoldTitle}>Live as EV · Ready</ThemedText>
          <ThemedText style={styles.evHoldSub}>Tap to go offline</ThemedText>
        </View>
        <Ionicons name="flash" size={20} color="#fff" />
      </Pressable>
    );
  }

  return (
    <GestureDetector gesture={holdGesture}>
      <View
        accessibilityRole="button"
        accessibilityLabel="Hold to go live as an EV driver"
        style={[styles.evHoldBar, { backgroundColor: theme.backgroundElevated, borderColor: theme.border, borderWidth: 1 }]}
      >
        <Animated.View style={[styles.evHoldFill, fillStyle]} />
        <Ionicons name="flash" size={20} color={Colors.travonyGreen} />
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.evHoldTitle, { color: theme.textPrimary }]}>
            {holding ? "Keep holding…" : "Hold to go live as EV"}
          </ThemedText>
          <ThemedText style={[styles.evHoldSub, { color: theme.textMuted }]}>
            {holding ? "Activating EV-ready mode" : "Online + EV-ready in one hold"}
          </ThemedText>
        </View>
      </View>
    </GestureDetector>
  );
}

export default function DriverHomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { liteMode } = useLiteMode();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [isOnline, setIsOnline] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [incomingRequest, setIncomingRequest] = useState<RideRequest | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [showActivationMoment, setShowActivationMoment] = useState(false);
  const [hubCooldowns, setHubCooldowns] = useState<Record<string, number>>({});
  const [proactiveHub, setProactiveHub] = useState<(Hub & { distanceKm: number }) | null>(null);
  const [lowBatteryWarning, setLowBatteryWarning] = useState<{
    message: string;
    batteryPercent: number | null;
    rangeKm: number | null;
  } | null>(null);
  const [checkingRange, setCheckingRange] = useState(false);
  const [countdownSeconds, setCountdownSeconds] = useState(COUNTDOWN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const checkedInHubsThisSession = useRef<Set<string>>(new Set());
  const dismissedHubProximityIds = useRef<Set<string>>(new Set());
  const [proximityHub, setProximityHub] = useState<Hub | null>(null);
  const [checkInSuccess, setCheckInSuccess] = useState(false);
  // Name Your Fare: counter-offer modal state + rides already countered so
  // the same request isn't re-surfaced after the driver sends a counter.
  const [counterModalRide, setCounterModalRide] = useState<RideRequest | null>(null);
  const [counterAmount, setCounterAmount] = useState(0);
  const counteredRideIds = useRef<Set<string>>(new Set());
  const [checkInPrestige, setCheckInPrestige] = useState<number | null>(null);

  const hubSlideIn = useSharedValue(-100);
  const hubOpacity = useSharedValue(0);
  const hubSwipeX = useSharedValue(0);

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  const { data: driverData } = useQuery<{
    id: string;
    is_online: boolean;
    isOnline?: boolean;
    status?: string;
    evReady?: boolean;
    vehicle?: { isElectric?: boolean } | null;
    prayerPauseEnabled?: boolean;
  }>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  const isEvDriver = driverData?.vehicle?.isElectric === true;
  const [evReady, setEvReady] = useState(false);

  useEffect(() => {
    if (driverData?.is_online !== undefined && driverData.is_online !== isOnline) {
      setIsOnline(driverData.is_online);
    }
  }, [driverData?.is_online]);

  useEffect(() => {
    if (typeof driverData?.evReady === "boolean") {
      setEvReady(driverData.evReady);
    }
  }, [driverData?.evReady]);

  const { data: pendingRides } = useQuery<RideRequest[]>({
    queryKey: ["/api/drivers/pending-rides"],
    enabled: isOnline,
    refetchInterval: litePollMs(5000, liteMode),
  });

  const { data: prayerPauseStatus } = useQuery<{
    enabled: boolean;
    active: boolean;
    prayerLabel: string | null;
    until: string | null;
  }>({
    queryKey: ["/api/drivers/prayer-pause/status"],
    enabled: isOnline && driverData?.prayerPauseEnabled === true,
    refetchInterval: litePollMs(60000, liteMode),
  });

  const prayerPauseActive = prayerPauseStatus?.active === true;

  const { data: earningsData } = useQuery<{ totalEarnings: string; totalTrips: number }>({
    queryKey: ["/api/drivers/earnings"],
    enabled: !!user,
    refetchInterval: isOnline ? litePollMs(30000, liteMode) : undefined,
  });

  const { data: hubsData } = useQuery<Hub[]>({
    queryKey: ["/api/openclaw/hubs"],
    enabled: isOnline && !!currentLocation,
    refetchInterval: litePollMs(60000, liteMode),
  });

  const { data: evHubsData } = useQuery<{ hubs: Hub[] }, Error, Hub[]>({
    queryKey: ["/api/openclaw/hubs/ev-hubs"],
    enabled: isOnline && !!currentLocation,
    refetchInterval: litePollMs(60000, liteMode),
    select: (d) => (Array.isArray(d?.hubs) ? d.hubs : []),
  });

  const toggleOnlineMutation = useMutation({
    mutationFn: async ({ online, evReady: ready }: { online: boolean; evReady?: boolean }) => {
      const body: { isOnline: boolean; evReady?: boolean; lat?: number; lng?: number } = { isOnline: online };
      if (typeof ready === "boolean") body.evReady = ready;
      if (currentLocation) {
        body.lat = currentLocation.lat;
        body.lng = currentLocation.lng;
      }
      return apiRequest("/api/drivers/status", {
        method: "PATCH",
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/me"] });
    },
  });

  const declineRideMutation = useMutation({
    mutationFn: async (rideId: string) => {
      return apiRequest(`/api/rides/${rideId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "cancelled" }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/pending-rides"] });
    },
    onError: () => {},
  });

  const checkInMutation = useMutation({
    mutationFn: async (hubId: string) => {
      return apiRequest(`/api/openclaw/hubs/${hubId}/check-in`, {
        method: "POST",
        body: JSON.stringify({ evStatus: "non_ev" }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: async () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (proximityHub) {
        checkedInHubsThisSession.current.add(proximityHub.id);
      }
      try {
        const prestige = await apiRequest("/api/openclaw/prestige");
        setCheckInPrestige(prestige?.score ?? null);
      } catch {}
      setCheckInSuccess(true);
      setTimeout(() => {
        setProximityHub(null);
        setCheckInSuccess(false);
      }, 3000);
    },
    onError: () => {
      setProximityHub(null);
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
    if (pendingRides && pendingRides.length > 0 && !incomingRequest) {
      // Skip named-fare rides the driver already countered — they're waiting
      // on the rider now; a win is detected via the my-bids poll below.
      const next = pendingRides.find((r) => !counteredRideIds.current.has(r.id));
      if (next) setIncomingRequest(next);
    }
  }, [pendingRides, isOnline]);

  // Name Your Fare: after countering, poll my-bids — when the rider accepts
  // this driver's counter, jump straight into the active ride.
  const { data: myBidsData } = useQuery<{ bids: Array<{ rideId: string; status: string; won: boolean; rideStatus: string }> }>({
    queryKey: ["/api/drivers/my-bids"],
    refetchInterval: 4000,
    enabled: isOnline && counteredRideIds.current.size > 0,
  });

  const navigatedWonRideRef = useRef<string | null>(null);
  useEffect(() => {
    const won = myBidsData?.bids?.find((b) => b.won && counteredRideIds.current.has(b.rideId));
    if (won && navigatedWonRideRef.current !== won.rideId) {
      navigatedWonRideRef.current = won.rideId;
      counteredRideIds.current.delete(won.rideId);
      setIncomingRequest(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      navigation.navigate("DriverActiveRide", { rideId: won.rideId });
    }
  }, [myBidsData]);

  const counterBidMutation = useMutation({
    mutationFn: async ({ rideId, amount }: { rideId: string; amount: number }) =>
      apiRequest(`/api/rides/${rideId}/bids`, {
        method: "POST",
        body: JSON.stringify({ amount: amount.toFixed(2) }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (_data, vars) => {
      counteredRideIds.current.add(vars.rideId);
      setCounterModalRide(null);
      setIncomingRequest(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    onError: (error: any) => {
      const msg = error?.message || "Could not send counter-offer";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Counter-offer failed", msg);
    },
  });

  const declinedRideId = useRef<string | null>(null);

  useEffect(() => {
    if (incomingRequest) {
      setCountdownSeconds(COUNTDOWN_SECONDS);
      if (countdownRef.current) clearInterval(countdownRef.current);
      const rideId = incomingRequest.id;
      countdownRef.current = setInterval(() => {
        setCountdownSeconds((s) => {
          if (s <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            if (declinedRideId.current !== rideId) {
              declinedRideId.current = rideId;
              declineRideMutation.mutate(rideId);
            }
            setIncomingRequest(null);
            return 0;
          }
          if (s === 11) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          if (s === 6) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          return s - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [incomingRequest?.id]);

  useEffect(() => {
    if (!isOnline || !currentLocation || !hubsData) return;
    const now = Date.now();
    const allHubs: Hub[] = [
      ...(hubsData || []),
      ...(evHubsData || []),
    ];
    const uniqueHubs = Array.from(new Map(allHubs.map((h) => [h.id, h])).values());

    for (const hub of uniqueHubs) {
      const dist = distanceKm(
        currentLocation.lat,
        currentLocation.lng,
        Number(hub.lat),
        Number(hub.lng)
      );
      if (dist > 8) continue;
      const demandOk = (hub.demandScore ?? 0) > 0.6;
      const evOk = hub.isEvHub && (hub.availablePorts ?? 0) > 0;
      if (!demandOk && !evOk) continue;
      const lastShown = hubCooldowns[hub.id] ?? 0;
      if (now - lastShown < 30 * 60 * 1000) continue;
      setProactiveHub({ ...hub, distanceKm: Math.round(dist * 10) / 10 });
      hubSlideIn.value = withSpring(0, { damping: 18 });
      hubOpacity.value = withTiming(1, { duration: 300 });
      break;
    }
  }, [isOnline, currentLocation, hubsData, evHubsData]);

  useEffect(() => {
    if (!isOnline || !currentLocation || !hubsData) return;
    for (const hub of hubsData) {
      const dist = distanceKm(
        currentLocation.lat,
        currentLocation.lng,
        Number(hub.lat),
        Number(hub.lng)
      );
      if (
        dist < 0.3 &&
        !checkedInHubsThisSession.current.has(hub.id) &&
        !dismissedHubProximityIds.current.has(hub.id)
      ) {
        setProximityHub(hub);
        break;
      }
    }
  }, [currentLocation, hubsData, isOnline]);

  const hubCardStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: hubSlideIn.value }, { translateX: hubSwipeX.value }],
    opacity: hubOpacity.value,
  }));

  const dismissHub = useCallback((hubId: string) => {
    setHubCooldowns((prev) => ({ ...prev, [hubId]: Date.now() }));
    hubSlideIn.value = withSpring(-100);
    hubOpacity.value = withTiming(0);
    setTimeout(() => setProactiveHub(null), 400);
  }, [hubSlideIn, hubOpacity]);

  const hubSwipeGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .onUpdate((e) => {
      hubSwipeX.value = e.translationX;
      const absX = Math.abs(e.translationX);
      hubOpacity.value = Math.max(0, 1 - absX / 160);
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 80 || Math.abs(e.velocityX) > 500) {
        const direction = e.translationX > 0 ? 400 : -400;
        hubSwipeX.value = withTiming(direction, { duration: 200 });
        hubOpacity.value = withTiming(0, { duration: 200 });
        if (proactiveHub) {
          runOnJS(dismissHub)(proactiveHub.id);
        }
      } else {
        hubSwipeX.value = withSpring(0);
        hubOpacity.value = withSpring(1);
      }
    });

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
      setCurrentLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const handleToggleOnline = (value: boolean) => {
    setIsOnline(value);
    toggleOnlineMutation.mutate({ online: value });
    if (value) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setShowActivationMoment(true);
      setTimeout(() => setShowActivationMoment(false), 1000);
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIncomingRequest(null);
    }
  };

  const showBlockerMessage = (title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const ensureLocationReady = async (): Promise<boolean> => {
    try {
      let perm = await Location.getForegroundPermissionsAsync();
      if (!perm.granted && perm.canAskAgain) {
        perm = await Location.requestForegroundPermissionsAsync();
      }
      if (!perm.granted) {
        showBlockerMessage(
          "Location needed",
          "Travony needs your location to take you live and match you with nearby rides. Enable location access in Settings to start earning."
        );
        return false;
      }
      if (!currentLocation) {
        await getCurrentLocation();
      }
      return true;
    } catch {
      showBlockerMessage(
        "Couldn't get location",
        "We couldn't access your location. Please try again."
      );
      return false;
    }
  };

  const activateEvMode = async () => {
    if (toggleOnlineMutation.isPending) return;

    if (driverData?.status && driverData.status !== "approved") {
      showBlockerMessage(
        "Account not ready",
        "Your driver account is still pending approval. Finish your setup to go live as an EV driver."
      );
      return;
    }

    const locationOk = await ensureLocationReady();
    if (!locationOk) return;

    setIsOnline(true);
    setEvReady(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setShowActivationMoment(true);
    setTimeout(() => setShowActivationMoment(false), 1400);

    toggleOnlineMutation.mutate(
      { online: true, evReady: true },
      {
        onError: () => {
          setIsOnline(false);
          setEvReady(false);
          setShowActivationMoment(false);
          showBlockerMessage(
            "Couldn't go live",
            "Something went wrong taking you live. Please check your connection and try again."
          );
        },
      }
    );
  };

  const deactivateEvMode = () => {
    if (toggleOnlineMutation.isPending) return;
    setIsOnline(false);
    setEvReady(false);
    setIncomingRequest(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleOnlineMutation.mutate({ online: false, evReady: false });
  };

  const acceptRideNow = async (rideId: string) => {
    try {
      const req = incomingRequest;
      if (req?.isShared && req.poolGroupId) {
        const result: any = await apiRequest(`/api/rides/shared/${req.poolGroupId}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });
        const firstRideId = result?.rideIds?.[0] || rideId;
        navigation.navigate("DriverActiveRide", { rideId: firstRideId });
        setIncomingRequest(null);
        return;
      }
      await apiRequest(`/api/rides/${rideId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "accepted" }),
        headers: { "Content-Type": "application/json" },
      });
      navigation.navigate("DriverActiveRide", { rideId });
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

  const handleAcceptRide = async () => {
    if (!incomingRequest) return;
    const req = incomingRequest;

    // Safe Driver job: the driver will operate the RIDER'S car, so make the
    // conditions explicit before the accept goes through.
    if (req.isSafeDriver) {
      const ackTitle = "Safe Driver Job";
      const ackMessage =
        "You'll drive the RIDER'S car with the rider on board.\n\n" +
        "By accepting you confirm:\n" +
        "• You hold a valid UAE driving licence\n" +
        "• You'll inspect the car with the rider before starting\n" +
        "• You'll drive carefully and follow all traffic rules";
      const confirmed = await new Promise<boolean>((resolve) => {
        if (Platform.OS === "web") {
          resolve(window.confirm(`${ackTitle}\n\n${ackMessage}`));
        } else {
          Alert.alert(ackTitle, ackMessage, [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "I Agree — Accept", onPress: () => resolve(true) },
          ]);
        }
      });
      if (!confirmed) return;
      await acceptRideNow(req.id);
      return;
    }

    // Soft low-battery awareness for EV drivers. Never blocks the accept.
    if (req.pickupLat && req.pickupLng && req.dropoffLat && req.dropoffLng) {
      try {
        setCheckingRange(true);
        const result: any = await apiRequest("/api/ev/range-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickupLat: Number(req.pickupLat),
            pickupLng: Number(req.pickupLng),
            dropoffLat: Number(req.dropoffLat),
            dropoffLng: Number(req.dropoffLng),
            driverLat: currentLocation?.lat,
            driverLng: currentLocation?.lng,
          }),
        });
        if (result?.warn) {
          setLowBatteryWarning({
            message: result.message || "Your battery may be low for this trip.",
            batteryPercent: result.batteryPercent ?? null,
            rangeKm: result.rangeKm ?? null,
          });
          return;
        }
      } catch (e) {
        // Range check is best-effort; never block accepting on its failure.
      } finally {
        setCheckingRange(false);
      }
    }

    await acceptRideNow(req.id);
  };

  const handleDeclineRide = () => {
    if (incomingRequest && declinedRideId.current !== incomingRequest.id) {
      declinedRideId.current = incomingRequest.id;
      declineRideMutation.mutate(incomingRequest.id);
    }
    setIncomingRequest(null);
  };

  const todayEarnings = earningsData?.totalEarnings ?? "0.00";
  const todayTrips = earningsData?.totalTrips ?? 0;

  if (!isReady) {
    return <DriverHomeSkeleton />;
  }

  return (
    <ThemedView style={styles.container}>
      {liteMode ? (
        <LiteTripView
          statusTitle={isOnline ? "You're online" : "You're offline"}
          statusSubtitle={
            isOnline
              ? "Waiting for ride requests. Map is off to save data."
              : "Go online below to start receiving requests."
          }
          pickupAddress={isOnline ? "Ready for requests" : "Not accepting rides"}
          dropoffAddress={
            isOnline
              ? `AED ${todayEarnings} today · ${todayTrips} trip${todayTrips !== 1 ? "s" : ""}`
              : "AED 0 · Start earning"
          }
        />
      ) : (
        <RideMap
          currentLocation={currentLocation}
          showUserLocation={true}
          interactive={true}
          height="100%"
        />
      )}

      <View style={[styles.statusBar, { top: insets.top + Spacing.md }]}>
        <View style={[styles.statusCard, { backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.statusContent}>
            <View style={{ flex: 1 }}>
              <View style={styles.earningsRow}>
                <Ionicons
                  name="wallet-outline"
                  size={14}
                  color={isOnline ? Colors.travonyGreen : theme.textMuted}
                />
                <ThemedText style={[styles.earningsText, { color: isOnline ? Colors.travonyGreen : theme.textMuted }]}>
                  {isOnline
                    ? `AED ${todayEarnings} today · ${todayTrips} trip${todayTrips !== 1 ? "s" : ""}`
                    : "AED 0 · Start earning"}
                </ThemedText>
              </View>
              <ThemedText style={[styles.statusLabel, { color: theme.textPrimary }]}>
                {isOnline ? (isEvDriver && evReady ? "Online · EV Ready" : "Online") : "Offline"}
              </ThemedText>
            </View>
            {isEvDriver ? null : (
              <AnimatedToggle value={isOnline} onValueChange={handleToggleOnline} />
            )}
          </View>
          {isEvDriver ? (
            <EvHoldControl
              isOnline={isOnline}
              busy={toggleOnlineMutation.isPending}
              onActivate={activateEvMode}
              onDeactivate={deactivateEvMode}
            />
          ) : null}
        </View>

        {showActivationMoment ? (
          <View style={[styles.liveBanner, { backgroundColor: Colors.travonyGreen }]}>
            <ThemedText style={styles.liveBannerText}>You're Live</ThemedText>
          </View>
        ) : null}

        {prayerPauseActive ? (
          <View style={[styles.prayerPauseBanner, { backgroundColor: theme.backgroundElevated, borderColor: Colors.travonyGreen + "60" }]}>
            <Ionicons name="moon-outline" size={16} color={Colors.travonyGreen} />
            <ThemedText style={[styles.prayerPauseBannerText, { color: theme.textPrimary }]} numberOfLines={2}>
              Prayer-Pause on{prayerPauseStatus?.prayerLabel ? ` — ${prayerPauseStatus.prayerLabel} soon` : ""}. Long trips hidden, mosque rides shown first.
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={[styles.quickActionsRow, { top: insets.top + Spacing.md + 106 }]}>
        {proactiveHub ? (
          <GestureDetector gesture={hubSwipeGesture}>
            <Animated.View style={[styles.hubCard, { backgroundColor: theme.backgroundRoot }, hubCardStyle]}>
              <View style={styles.hubCardContent}>
                {proactiveHub.isEvHub ? (
                  <Ionicons name="flash" size={18} color="#2196F3" />
                ) : (
                  <Ionicons name="location" size={18} color={Colors.travonyGreen} />
                )}
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.hubCardTitle} numberOfLines={1}>
                    {proactiveHub.name}
                  </ThemedText>
                  <ThemedText style={[styles.hubCardSub, { color: theme.textMuted }]}>
                    {proactiveHub.isEvHub && (proactiveHub.availablePorts ?? 0) > 0
                      ? `${proactiveHub.availablePorts} charging ports open`
                      : `${proactiveHub.distanceKm} km away · Good demand now`}
                  </ThemedText>
                </View>
                <Pressable
                  style={[styles.hubHeadButton, { backgroundColor: Colors.travonyGreen }]}
                  onPress={() => navigation.navigate("HubDetail", { hubId: proactiveHub.id.toString(), hubName: proactiveHub.name })}
                >
                  <ThemedText style={styles.hubHeadButtonText}>Head There</ThemedText>
                </Pressable>
                <Pressable onPress={() => dismissHub(proactiveHub.id)} style={styles.hubDismiss}>
                  <Ionicons name="close" size={16} color={theme.textMuted} />
                </Pressable>
              </View>
            </Animated.View>
          </GestureDetector>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                styles.networkHubsButton,
                {
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
                  Demand hubs & yield
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.coffeeButton,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => navigation.navigate("EvDriver")}
            >
              <Ionicons name="battery-charging" size={22} color={Colors.travonyGreen} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.coffeeButton,
                {
                  backgroundColor: theme.backgroundElevated,
                  borderColor: theme.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              onPress={() => navigation.navigate("DriverCoffeeOrders")}
            >
              <Ionicons name="cafe" size={22} color="#8B4513" />
            </Pressable>
          </>
        )}
      </View>

      {isOnline && !incomingRequest ? (
        <View style={[styles.bottomControls, { bottom: tabBarHeight + Spacing.lg }]}>
          <View style={[styles.searchingCard, { backgroundColor: theme.backgroundRoot }]}>
            <View style={styles.searchingDot} />
            <ThemedText style={styles.searchingText}>Scanning for route requests...</ThemedText>
          </View>
        </View>
      ) : null}

      {incomingRequest ? (
        <View style={[styles.requestCard, { bottom: tabBarHeight + Spacing.lg, backgroundColor: theme.backgroundRoot }]}>
          <View style={styles.requestHeader}>
            <View style={styles.requestTitleRow}>
              <ThemedText style={styles.requestTitle}>New Route Request</ThemedText>
              <View style={styles.badgeRow}>
                {incomingRequest.isPmgthRide ? (
                  <View style={[styles.pmgthBadge, { backgroundColor: Colors.travonyGreen + "20" }]}>
                    <Ionicons name="home" size={12} color={Colors.travonyGreen} />
                    <ThemedText style={[styles.pmgthBadgeText, { color: Colors.travonyGreen }]}>
                      {incomingRequest.pmgthDirectionScore != null
                        ? `${Math.round(incomingRequest.pmgthDirectionScore * 100)}% aligned with your route`
                        : "Going Your Way"}
                    </ThemedText>
                  </View>
                ) : null}
                {incomingRequest.isEvRide ? (
                  <View style={[styles.evBadge, { backgroundColor: "#2196F320" }]}>
                    <Ionicons name="flash" size={12} color="#2196F3" />
                    <ThemedText style={[styles.evBadgeText, { color: "#2196F3" }]}>EV Requested</ThemedText>
                  </View>
                ) : null}
                {incomingRequest.isSafeDriver ? (
                  <View style={[styles.evBadge, { backgroundColor: "#7C3AED20" }]}>
                    <Ionicons name="shield-checkmark" size={12} color="#7C3AED" />
                    <ThemedText style={[styles.evBadgeText, { color: "#7C3AED" }]}>
                      Safe Driver · You drive THEIR car
                    </ThemedText>
                  </View>
                ) : null}
                {incomingRequest.isShared ? (
                  <View style={[styles.evBadge, { backgroundColor: Colors.travonyGreen + "20" }]}>
                    <Ionicons name="people" size={12} color={Colors.travonyGreen} />
                    <ThemedText style={[styles.evBadgeText, { color: Colors.travonyGreen }]}>
                      Shared · {incomingRequest.riderCount || 2} riders
                    </ThemedText>
                  </View>
                ) : null}
                {incomingRequest.isNamedFare ? (
                  <View style={[styles.evBadge, { backgroundColor: "#F59E0B20" }]}>
                    <Ionicons name="pricetag" size={12} color="#F59E0B" />
                    <ThemedText style={[styles.evBadgeText, { color: "#F59E0B" }]}>
                      Rider offers {incomingRequest.currency || "AED"} {Number(incomingRequest.riderProposedFare || incomingRequest.estimatedFare).toFixed(2)}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.fareContainer}>
              <View style={[styles.fareBadge, { backgroundColor: Colors.travonyGreen }]}>
                <ThemedText style={styles.fareText}>AED {incomingRequest.estimatedFare}</ThemedText>
              </View>
              {incomingRequest.isPmgthRide && incomingRequest.pmgthPremiumAmount ? (
                <View style={[styles.premiumBadge, { backgroundColor: Colors.travonyGold }]}>
                  <ThemedText style={styles.premiumText}>+AED {Number(incomingRequest.pmgthPremiumAmount).toFixed(2)}</ThemedText>
                </View>
              ) : null}
              {incomingRequest.isShared && incomingRequest.combinedDriverEarnings != null ? (
                <View style={[styles.premiumBadge, { backgroundColor: Colors.travonyGreen }]}>
                  <ThemedText style={styles.premiumText}>
                    You earn {incomingRequest.currency || "AED"} {Number(incomingRequest.combinedDriverEarnings).toFixed(2)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>

          {incomingRequest.customerName ? (
            <View style={[styles.customerInfo, { backgroundColor: theme.backgroundElevated }]}>
              <Ionicons name="person-outline" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.customerName, { color: theme.textSecondary }]}>
                {incomingRequest.customerName}
              </ThemedText>
              {incomingRequest.customerRating ? (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={12} color="#FFB800" />
                  <ThemedText style={[styles.ratingText, { color: theme.textPrimary }]}>
                    {Number(incomingRequest.customerRating).toFixed(1)}
                  </ThemedText>
                </View>
              ) : null}
              {incomingRequest.customerTotalRides ? (
                <ThemedText style={[styles.ridesCount, { color: theme.textMuted }]}>
                  {incomingRequest.customerTotalRides} trips
                </ThemedText>
              ) : null}
            </View>
          ) : null}

          {incomingRequest.isShared && incomingRequest.stops && incomingRequest.stops.length > 0 ? (
            <View style={styles.locationInfo}>
              {incomingRequest.stops.map((stop, idx) => (
                <View key={stop.rideId}>
                  {idx > 0 ? <View style={styles.locationLine} /> : null}
                  <View style={styles.locationRow}>
                    <View style={[styles.locationDot, { backgroundColor: Colors.travonyGreen }]} />
                    <View style={styles.locationTextContainer}>
                      <ThemedText style={[styles.locationLabel, { color: theme.textSecondary }]}>
                        {stop.riderName || `Rider ${idx + 1}`} · {incomingRequest.currency || "AED"} {Number(stop.fare).toFixed(2)}
                      </ThemedText>
                      <ThemedText style={styles.locationAddress} numberOfLines={1}>
                        {stop.pickupAddress}
                      </ThemedText>
                      <ThemedText style={[styles.locationAddress, { color: theme.textMuted }]} numberOfLines={1}>
                        to {stop.dropoffAddress}
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
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
          )}

          <View style={styles.rideStats}>
            {(() => {
              if (
                currentLocation &&
                incomingRequest.pickupLat &&
                incomingRequest.pickupLng
              ) {
                const dKm = distanceKm(
                  currentLocation.lat,
                  currentLocation.lng,
                  parseFloat(String(incomingRequest.pickupLat)),
                  parseFloat(String(incomingRequest.pickupLng))
                );
                const minToPickup = Math.max(1, Math.round((dKm / 30) * 60));
                return (
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                    <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                      {minToPickup} min to pickup
                    </ThemedText>
                  </View>
                );
              }
              return null;
            })()}
            <View style={styles.statItem}>
              <Ionicons name="navigate-outline" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                {incomingRequest.distance} km trip
              </ThemedText>
            </View>
            {incomingRequest.farePerKm ? (
              <View style={styles.statItem}>
                <Ionicons name="cash-outline" size={16} color={Colors.travonyGreen} />
                <ThemedText style={[styles.statText, { color: Colors.travonyGreen }]}>
                  AED {incomingRequest.farePerKm}/km
                </ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.requestActions}>
            <Pressable
              style={[styles.acceptButtonWrapped, { backgroundColor: Colors.travonyGreen, opacity: checkingRange ? 0.7 : 1 }]}
              onPress={handleAcceptRide}
              disabled={checkingRange}
            >
              <View style={styles.acceptButtonRingWrap}>
                <CountdownRing seconds={countdownSeconds} total={COUNTDOWN_SECONDS} onGreenBg />
                <View style={styles.countdownOverlayNumber}>
                  <ThemedText style={[styles.countdownText, { color: countdownSeconds <= 5 ? "#ffdddd" : "rgba(255,255,255,0.9)" }]}>
                    {countdownSeconds}
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.acceptButtonText}>
                {checkingRange ? "Checking..." : "Accept Route"}
              </ThemedText>
            </Pressable>
            {incomingRequest.isNamedFare && !incomingRequest.isShared ? (
              <Pressable
                style={[styles.declineButton, { borderColor: "#F59E0B" }]}
                onPress={() => {
                  const base = Number(incomingRequest.riderProposedFare || incomingRequest.estimatedFare || 0);
                  setCounterAmount(Math.round(base * 1.1 * 100) / 100);
                  setCounterModalRide(incomingRequest);
                  if (countdownRef.current) clearInterval(countdownRef.current);
                }}
              >
                <ThemedText style={[styles.declineButtonText, { color: "#F59E0B" }]}>Counter</ThemedText>
              </Pressable>
            ) : null}
            <Pressable
              style={[styles.declineButton, { borderColor: theme.border }]}
              onPress={handleDeclineRide}
            >
              <ThemedText style={[styles.declineButtonText, { color: theme.error }]}>Decline</ThemedText>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Modal
        visible={!!counterModalRide}
        transparent
        animationType="fade"
        onRequestClose={() => setCounterModalRide(null)}
      >
        <View style={styles.warnOverlay}>
          <View style={[styles.warnCard, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.warnIcon, { backgroundColor: "#F59E0B20" }]}>
              <Ionicons name="pricetag" size={26} color="#F59E0B" />
            </View>
            <ThemedText style={styles.warnTitle}>Send a counter-offer</ThemedText>
            <ThemedText style={[styles.warnMessage, { color: theme.textSecondary }]}>
              Rider offered {counterModalRide?.currency || "AED"}{" "}
              {Number(counterModalRide?.riderProposedFare || counterModalRide?.estimatedFare || 0).toFixed(2)}. Propose your price — they can accept it or wait for others.
            </ThemedText>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.lg, marginVertical: Spacing.md }}>
              <Pressable
                onPress={() => {
                  const base = Number(counterModalRide?.riderProposedFare || counterModalRide?.estimatedFare || 0);
                  const step = Math.max(1, Math.round(base * 0.05));
                  setCounterAmount((a) => Math.round(Math.max(a - step, base) * 100) / 100);
                }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.backgroundElevated }}
              >
                <Ionicons name="remove" size={22} color={theme.text} />
              </Pressable>
              <ThemedText style={{ fontSize: 24, fontWeight: "700", minWidth: 120, textAlign: "center" }}>
                {counterModalRide?.currency || "AED"} {counterAmount.toFixed(2)}
              </ThemedText>
              <Pressable
                onPress={() => {
                  const base = Number(counterModalRide?.riderProposedFare || counterModalRide?.estimatedFare || 0);
                  const step = Math.max(1, Math.round(base * 0.05));
                  setCounterAmount((a) => Math.round((a + step) * 100) / 100);
                }}
                style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: theme.backgroundElevated }}
              >
                <Ionicons name="add" size={22} color={theme.text} />
              </Pressable>
            </View>
            <Pressable
              style={[styles.warnPrimaryBtn, { backgroundColor: "#F59E0B", opacity: counterBidMutation.isPending ? 0.7 : 1 }]}
              onPress={() => {
                if (counterModalRide && !counterBidMutation.isPending) {
                  counterBidMutation.mutate({ rideId: counterModalRide.id, amount: counterAmount });
                }
              }}
              disabled={counterBidMutation.isPending}
            >
              <ThemedText style={styles.warnPrimaryText}>
                {counterBidMutation.isPending ? "Sending..." : "Send counter-offer"}
              </ThemedText>
            </Pressable>
            <Pressable style={styles.warnSecondaryBtn} onPress={() => setCounterModalRide(null)}>
              <ThemedText style={[styles.warnSecondaryText, { color: theme.textSecondary }]}>
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>

      {proximityHub && !checkedInHubsThisSession.current.has(proximityHub.id) ? (
        <View style={[styles.proximitySheet, { bottom: tabBarHeight + Spacing.lg, backgroundColor: theme.backgroundRoot }]}>
          {checkInSuccess ? (
            <View style={styles.checkInSuccessContent}>
              <Ionicons name="checkmark-circle" size={28} color={Colors.travonyGreen} />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.checkInSuccessTitle, { color: Colors.travonyGreen }]}>
                  Checked in — you're earning prestige
                </ThemedText>
                {checkInPrestige !== null ? (
                  <ThemedText style={[styles.checkInSubtitle, { color: theme.textSecondary }]}>
                    Prestige score: {checkInPrestige}
                  </ThemedText>
                ) : null}
              </View>
            </View>
          ) : (
            <>
              <View style={styles.proximitySheetContent}>
                <Ionicons name="location" size={22} color={Colors.travonyGreen} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.proximityHubTitle}>{proximityHub.name} is nearby</ThemedText>
                  <ThemedText style={[styles.proximityHubSub, { color: theme.textSecondary }]}>
                    Check in to join the community and unlock demand insights
                  </ThemedText>
                </View>
              </View>
              <View style={styles.proximityActions}>
                <Pressable
                  style={[styles.checkInButton, { backgroundColor: Colors.travonyGreen }]}
                  onPress={() => checkInMutation.mutate(proximityHub.id)}
                  disabled={checkInMutation.isPending}
                >
                  <ThemedText style={styles.checkInButtonText}>
                    {checkInMutation.isPending ? "Checking in..." : "Check In"}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => {
                  if (proximityHub) {
                    dismissedHubProximityIds.current.add(proximityHub.id);
                  }
                  setProximityHub(null);
                }}>
                  <ThemedText style={[styles.dismissLink, { color: theme.textMuted }]}>Dismiss</ThemedText>
                </Pressable>
              </View>
            </>
          )}
        </View>
      ) : null}

      <Modal
        visible={!!lowBatteryWarning}
        transparent
        animationType="fade"
        onRequestClose={() => setLowBatteryWarning(null)}
      >
        <View style={styles.warnOverlay}>
          <View style={[styles.warnCard, { backgroundColor: theme.backgroundRoot }]}>
            <View style={[styles.warnIcon, { backgroundColor: "#F59E0B20" }]}>
              <Ionicons name="battery-half" size={26} color="#F59E0B" />
            </View>
            <ThemedText style={styles.warnTitle}>Low battery for this trip</ThemedText>
            <ThemedText style={[styles.warnMessage, { color: theme.textSecondary }]}>
              {lowBatteryWarning?.message}
            </ThemedText>
            {lowBatteryWarning?.batteryPercent != null || lowBatteryWarning?.rangeKm != null ? (
              <View style={styles.warnStats}>
                {lowBatteryWarning?.batteryPercent != null ? (
                  <ThemedText style={[styles.warnStat, { color: theme.textMuted }]}>
                    Battery {lowBatteryWarning.batteryPercent}%
                  </ThemedText>
                ) : null}
                {lowBatteryWarning?.rangeKm != null ? (
                  <ThemedText style={[styles.warnStat, { color: theme.textMuted }]}>
                    ~{Math.round(lowBatteryWarning.rangeKm)} km range
                  </ThemedText>
                ) : null}
              </View>
            ) : null}
            <Pressable
              style={[styles.warnPrimaryBtn, { backgroundColor: Colors.travonyGreen }]}
              onPress={() => {
                const id = incomingRequest?.id;
                setLowBatteryWarning(null);
                if (id) acceptRideNow(id);
              }}
            >
              <ThemedText style={styles.warnPrimaryText}>Accept anyway</ThemedText>
            </Pressable>
            <Pressable style={styles.warnSecondaryBtn} onPress={() => setLowBatteryWarning(null)}>
              <ThemedText style={[styles.warnSecondaryText, { color: theme.textSecondary }]}>
                Not now
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  warnOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  warnCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  warnIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  warnTitle: { fontSize: 18, fontWeight: "700", textAlign: "center" },
  warnMessage: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  warnStats: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.md,
  },
  warnStat: { fontSize: 13, fontWeight: "600" },
  warnPrimaryBtn: {
    alignSelf: "stretch",
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  warnPrimaryText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  warnSecondaryBtn: {
    alignSelf: "stretch",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  warnSecondaryText: { fontSize: 14, fontWeight: "600" },
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
      android: { elevation: 4 },
    }),
  },
  statusContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  earningsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  earningsText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  statusLabel: {
    ...Typography.h4,
  },
  liveBanner: {
    marginTop: Spacing.xs,
    alignSelf: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  prayerPauseBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  prayerPauseBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
  },
  liveBannerText: {
    ...Typography.bodyMedium,
    color: "#fff",
    fontWeight: "700",
  },
  toggleTrack: {
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    paddingHorizontal: 4,
    minWidth: 76,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.travonyGreen,
  },
  evHoldBar: {
    marginTop: Spacing.md,
    minHeight: 56,
    borderRadius: BorderRadius.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    overflow: "hidden",
  },
  evHoldFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(16, 185, 129, 0.18)",
  },
  evHoldTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    color: "#fff",
  },
  evHoldSub: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.85)",
  },
  evLiveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  networkEfficiency: {
    ...Typography.caption,
  },
  quickActionsRow: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    gap: Spacing.md,
  },
  hubCard: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  hubCardContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  hubCardTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  hubCardSub: {
    ...Typography.caption,
  },
  hubHeadButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  hubHeadButtonText: {
    ...Typography.caption,
    fontWeight: "700",
    color: "#fff",
  },
  hubDismiss: {
    padding: 4,
  },
  networkHubsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  networkHubsTextContainer: {
    flex: 1,
  },
  networkHubsTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  networkHubsSubtitle: {
    ...Typography.caption,
  },
  coffeeButton: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  bottomControls: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.md,
  },
  searchingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 3 },
    }),
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
      android: { elevation: 8 },
      web: { boxShadow: "0 4px 12px rgba(0,0,0,0.15)" },
    }),
  },
  requestHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  requestTitle: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  requestTitleRow: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    flexWrap: "wrap",
  },
  pmgthBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  pmgthBadgeText: {
    ...Typography.small,
    fontWeight: "600",
  },
  evBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  evBadgeText: {
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
  fareBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  fareText: {
    ...Typography.h4,
    color: "#fff",
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  customerName: {
    ...Typography.body,
    flex: 1,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ratingText: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  ridesCount: {
    ...Typography.caption,
  },
  locationInfo: {
    marginBottom: Spacing.md,
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
    height: 20,
    backgroundColor: "#E0E0E0",
    marginLeft: 5,
    marginVertical: 2,
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
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statText: {
    ...Typography.body,
  },
  requestActions: {
    gap: Spacing.md,
  },
  acceptButtonWrapped: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 32,
    paddingRight: Spacing.xl,
    overflow: "hidden",
  },
  acceptButtonRingWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  countdownOverlayNumber: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  countdownText: {
    ...Typography.h3,
    fontWeight: "700",
  },
  acceptButtonText: {
    ...Typography.button,
    color: "#fff",
    flex: 1,
    textAlign: "center",
  },
  declineButton: {
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  declineButtonText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  proximitySheet: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    zIndex: 99,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
    }),
  },
  proximitySheetContent: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  proximityHubTitle: {
    ...Typography.h4,
    marginBottom: 2,
  },
  proximityHubSub: {
    ...Typography.body,
  },
  proximityActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  checkInButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  checkInButtonText: {
    ...Typography.button,
    color: "#fff",
  },
  dismissLink: {
    ...Typography.body,
    fontWeight: "500",
  },
  checkInSuccessContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  checkInSuccessTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  checkInSubtitle: {
    ...Typography.caption,
  },
});
