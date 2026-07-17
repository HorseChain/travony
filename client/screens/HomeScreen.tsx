import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { ThemedText } from "@/components/ThemedText";
import RideMap from "@/components/RideMap";
import LiteTripView from "@/components/LiteTripView";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import BookingBottomSheet, { getPopularLocationsForRegion } from "@/components/BookingBottomSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Typography, Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
import { HomeScreenSkeleton } from "@/components/SkeletonLoader";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "MapHome">;
type RouteProps = RouteProp<HomeStackParamList, "MapHome">;

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

interface ActiveRide {
  id: string;
  status: string;
  driverId?: string;
}

interface TelemetryData {
  eta: number | null;
  driver: { name: string } | null;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function getDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const EV_HUB_DISMISSED_KEY = "ev_hub_dismissed_session_ts";
const SESSION_START_TS = Date.now().toString();

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { liteMode } = useLiteMode();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isReady, setIsReady] = useState(false);
  const [evModeActive, setEvModeActive] = useState(false);
  const [evHubDismissed, setEvHubDismissed] = useState(false);
  const [activeRide, setActiveRide] = useState<ActiveRide | null>(null);
  const [bookingSheetDropoff, setBookingSheetDropoff] = useState<LocationData | null>(null);
  const [bookingSheetPickup, setBookingSheetPickup] = useState<LocationData | null>(null);
  const [bookingSheetTab, setBookingSheetTab] = useState<"location" | "rides" | "confirm">("location");

  const activePillAnim = useRef(new Animated.Value(0)).current;

  const { data: evHubsResponse } = useQuery<{ hubs: { id: string; name: string; lat: string; lng: string; availablePorts: number; totalChargingPorts: number }[] }>({
    queryKey: ["/api/openclaw/hubs/ev-hubs"],
    enabled: true,
  });
  const evHubsData = evHubsResponse?.hubs;
  const evHubsWithPorts = evHubsData?.filter((h) => (h.availablePorts ?? 0) > 0) ?? [];

  const nearbyEvHub = currentLocation && evHubsWithPorts.length > 0
    ? evHubsWithPorts.find((h) =>
        getDistanceKm(currentLocation.lat, currentLocation.lng, parseFloat(h.lat), parseFloat(h.lng)) <= 5
      )
    : null;

  const { data: evAvailData } = useQuery<{ evDriversAvailable: number; available: boolean }>({
    queryKey: ["/api/ai/ev-availability", currentLocation?.lat, currentLocation?.lng],
    enabled: evModeActive && currentLocation !== null,
  });
  const availableEvDriverCount = evAvailData?.evDriversAvailable ?? 0;

  const { data: ridesData, refetch: refetchActiveRides } = useQuery<{ rides?: ActiveRide[] } | ActiveRide[]>({
    queryKey: ["/api/rides?status=active"],
    enabled: !!user?.id,
    staleTime: 10000,
  });

  const { data: telemetryData } = useQuery<TelemetryData>({
    queryKey: ["/api/rides", activeRide?.id, "telemetry"],
    enabled: !!activeRide?.id,
    refetchInterval: litePollMs(10000, liteMode),
  });

  const { data: savedAddresses } = useQuery<{ id: string; label: string; address: string; lat: string; lng: string }[]>({
    queryKey: [`/api/saved-addresses/${user?.id}`],
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const suggestNow = new Date();
  const suggestKey = `/api/rides/destination-suggestions?hour=${suggestNow.getHours()}&dow=${suggestNow.getDay()}&tzOffset=${-suggestNow.getTimezoneOffset()}`;
  const { data: suggestionData } = useQuery<{
    suggestions: { address: string; lat: number; lng: number; label: string; icon: string; reason: string; score: number }[];
    source: string;
  }>({
    queryKey: [suggestKey],
    enabled: !!user?.id,
    staleTime: 60000,
  });

  const { data: scheduledArrivals } = useQuery<
    { id: string; label: string; status: string; next: { arriveBy: string; dispatchAt: string; skipped: boolean } | null }[]
  >({
    queryKey: ["/api/scheduled-arrivals"],
    enabled: !!user?.id,
    refetchInterval: litePollMs(60000, liteMode),
    staleTime: 30000,
  });

  const nextArrival = (scheduledArrivals || [])
    .filter((a) => a.status === "active" && a.next && !a.next.skipped)
    .sort((a, b) => new Date(a.next!.arriveBy).getTime() - new Date(b.next!.arriveBy).getTime())[0];

  const { data: prayerSubs } = useQuery<
    { id: string; mosqueName: string; status: string; next: { prayerLabel: string; prayerTime: string; pickupAt: string; skipped: boolean; dispatched: boolean } | null }[]
  >({
    queryKey: ["/api/prayer-rides"],
    enabled: !!user?.id,
    refetchInterval: litePollMs(60000, liteMode),
    staleTime: 30000,
  });

  const prayerSub = (prayerSubs || []).find((s) => s.status === "active" && s.next && !s.next.skipped);

  const skipPrayerMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequest(`/api/prayer-rides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "skip" }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/prayer-rides"] }),
  });

  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        refetchActiveRides();
      }
    }, [user?.id, refetchActiveRides])
  );

  useEffect(() => {
    if (!user?.id) return;
    const ridesArr = Array.isArray(ridesData) ? ridesData : (ridesData as any)?.rides;
    if (ridesArr && ridesArr.length > 0) {
      const found = ridesArr.find((r: ActiveRide) =>
        ["pending", "accepted", "arriving", "in_progress"].includes(r.status)
      );
      setActiveRide(found || null);
    } else {
      setActiveRide(null);
    }
  }, [ridesData, user?.id]);

  useEffect(() => {
    AsyncStorage.getItem(EV_HUB_DISMISSED_KEY).then((val) => {
      setEvHubDismissed(val === SESSION_START_TS);
    });
  }, []);

  useEffect(() => {
    if (activeRide) {
      Animated.spring(activePillAnim, { toValue: 1, useNativeDriver: true, tension: 100, friction: 8 }).start();
    } else {
      Animated.spring(activePillAnim, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [activeRide]);

  useEffect(() => {
    const selectedLocation = route.params?.selectedLocation;
    const selectedPickup = route.params?.selectedPickup;
    if (selectedLocation && selectedLocation.type === "dropoff") {
      setBookingSheetDropoff({
        address: selectedLocation.address,
        lat: selectedLocation.lat,
        lng: selectedLocation.lng,
      });
      if (selectedPickup) {
        setBookingSheetPickup({
          address: selectedPickup.address,
          lat: selectedPickup.lat,
          lng: selectedPickup.lng,
        });
      }
      setBookingSheetTab("rides");
    }
  }, [route.params?.selectedLocation, route.params?.selectedPickup]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady) {
      requestLocationPermission();
    }
  }, [isReady]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);
        getCurrentLocation();
      } else {
        setLocationPermission(false);
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

  const handleLocationChange = (pickup: LocationData | null, dropoff: LocationData | null) => {
    setPickupLocation(pickup);
    setDropoffLocation(dropoff);
  };

  const handleBookingComplete = (rideId: string) => {
    navigation.navigate("ActiveRide", { rideId });
  };

  const handleDismissEvHub = () => {
    setEvHubDismissed(true);
    AsyncStorage.setItem(EV_HUB_DISMISSED_KEY, SESSION_START_TS);
  };

  const handleChipPress = (location: LocationData) => {
    setBookingSheetDropoff(location);
    if (currentLocation && !bookingSheetPickup) {
      setBookingSheetPickup({
        address: "Current Location",
        lat: currentLocation.lat,
        lng: currentLocation.lng,
      });
    }
    if (location.lat !== 0 && location.lng !== 0) {
      setBookingSheetTab("rides");
    } else {
      setBookingSheetTab("location");
    }
  };

  // Smart destination suggestions ranked server-side by the rider's own history
  // (frequency + recency + time-of-day/day match) merged with saved Home/Work.
  // Falls back cleanly to saved places, then popular locations, so the row is
  // never empty for a signed-in rider.
  const destinationChips: Array<{ label: string; location: LocationData; icon: string; reason?: string }> = (() => {
    const suggestions = suggestionData?.suggestions;
    if (suggestions && suggestions.length > 0) {
      return suggestions
        .filter((s) => s.lat !== 0 || s.lng !== 0)
        .map((s) => ({
          label: s.label,
          icon: s.icon || "location-outline",
          reason: s.reason,
          location: { address: s.address, lat: s.lat, lng: s.lng },
        }));
    }

    // Fallback 1: saved Home/Work (shown immediately while suggestions load or
    // when the rider has no ride history yet).
    const chips: Array<{ label: string; location: LocationData; icon: string; reason?: string }> = [];
    if (savedAddresses) {
      const homeAddr = savedAddresses.find((a) => a.label?.toLowerCase() === "home");
      const workAddr = savedAddresses.find((a) => a.label?.toLowerCase() === "work");
      if (homeAddr && homeAddr.address && parseFloat(homeAddr.lat) !== 0) {
        chips.push({
          label: "Home",
          icon: "home-outline",
          reason: "Saved place",
          location: { address: homeAddr.address, lat: parseFloat(homeAddr.lat), lng: parseFloat(homeAddr.lng) },
        });
      }
      if (workAddr && workAddr.address && parseFloat(workAddr.lat) !== 0) {
        chips.push({
          label: "Work",
          icon: "briefcase-outline",
          reason: "Saved place",
          location: { address: workAddr.address, lat: parseFloat(workAddr.lat), lng: parseFloat(workAddr.lng) },
        });
      }
    }

    // Fallback 2: popular destinations for the rider's region.
    if (chips.length === 0) {
      const popular = getPopularLocationsForRegion(currentLocation?.lat, currentLocation?.lng);
      for (const p of popular.slice(0, 5)) {
        chips.push({
          label: p.address.length > 20 ? p.address.slice(0, 19) + "…" : p.address,
          icon: (p.icon as string) || "location-outline",
          reason: "Popular nearby",
          location: { address: p.address, lat: p.lat, lng: p.lng },
        });
      }
    }
    return chips;
  })();

  const getActiveRidePillText = () => {
    if (!activeRide) return "";
    const driverName = telemetryData?.driver?.name;
    const eta = telemetryData?.eta;
    if (activeRide.status === "pending") return "Searching for driver…";
    if (driverName && eta) return `${driverName} is on the way — ${eta} min`;
    if (driverName) return `${driverName} is on the way`;
    return "Driver is on the way";
  };

  if (!isReady) {
    return <HomeScreenSkeleton />;
  }

  const showEvHubCard = !evHubDismissed && nearbyEvHub !== null && nearbyEvHub !== undefined && !activeRide;
  const showDestinationChips = !activeRide && !!user && destinationChips.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {liteMode ? (
        <LiteTripView
          pickupAddress={pickupLocation?.address}
          dropoffAddress={dropoffLocation?.address}
          statusTitle={activeRide ? "Trip in progress" : "Ready when you are"}
          statusSubtitle={
            activeRide
              ? "Open your trip for live status."
              : "Set your destination below to book a ride."
          }
        />
      ) : (
      <RideMap
        currentLocation={currentLocation}
        pickupLocation={pickupLocation}
        dropoffLocation={dropoffLocation}
        showUserLocation={locationPermission}
        interactive={true}
        height="100%"
        evHubMarkers={
          evModeActive && evHubsData
            ? evHubsData.map((h) => ({
                id: h.id,
                name: h.name,
                lat: parseFloat(h.lat),
                lng: parseFloat(h.lng),
                availablePorts: h.availablePorts ?? 0,
                totalChargingPorts: h.totalChargingPorts ?? 0,
              }))
            : undefined
        }
      />
      )}

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={[styles.greetingCard, { backgroundColor: theme.card }]}>
          <View style={styles.greetingRow}>
            <View>
              <ThemedText style={styles.greeting}>
                {getGreeting()}, {user?.name?.split(" ")[0] || "Guest"}
              </ThemedText>
              <ThemedText style={[styles.greetingSubtitle, { color: theme.textMuted }]}>
                Where are you heading?
              </ThemedText>
            </View>
            <View style={styles.networkStatus}>
              <View style={styles.networkDot} />
              <ThemedText style={styles.networkText}>Optimal</ThemedText>
            </View>
          </View>
        </View>
      </View>

      {activeRide ? (
        <Animated.View
          style={[
            styles.activeRidePill,
            {
              backgroundColor: theme.primary,
              top: insets.top + Spacing["5xl"] + Spacing["4xl"] + Spacing.md,
              opacity: activePillAnim,
              transform: [{ translateY: activePillAnim.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }],
            },
          ]}
        >
          <Pressable
            style={styles.activeRidePillInner}
            onPress={() => navigation.navigate("ActiveRide", { rideId: activeRide.id })}
          >
            <View style={styles.activeRideDot} />
            <ThemedText style={styles.activeRidePillText} numberOfLines={1}>
              {getActiveRidePillText()}
            </ThemedText>
            <Ionicons name="chevron-forward" size={14} color={Colors.light.textOnPrimary} />
          </Pressable>
        </Animated.View>
      ) : null}

      <View style={[styles.overlayArea, { top: insets.top + (activeRide ? 152 : 112) }]}>
        {showDestinationChips ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
            style={styles.chipsScroll}
          >
            {destinationChips.map((chip, idx) => (
              <Pressable
                key={idx}
                style={({ pressed }) => [
                  styles.chip,
                  { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => handleChipPress(chip.location)}
              >
                <Ionicons name={chip.icon as any} size={14} color={theme.primary} />
                <View style={styles.chipTextColumn}>
                  <ThemedText style={[styles.chipText, { color: theme.text }]} numberOfLines={1}>
                    {chip.label}
                  </ThemedText>
                  {chip.reason ? (
                    <ThemedText style={[styles.chipReason, { color: theme.textMuted }]} numberOfLines={1}>
                      {chip.reason}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {showEvHubCard ? (
          <View style={[styles.evHubCard, { backgroundColor: theme.card, borderColor: Colors.travonyGreen + "40" }]}>
            <Ionicons name={"flash" as any} size={16} color={Colors.travonyGreen} />
            <Pressable
              style={styles.evHubCardContent}
              onPress={() =>
                navigation.navigate("HubDetail", {
                  hubId: nearbyEvHub!.id,
                  hubName: nearbyEvHub!.name,
                })
              }
            >
              <ThemedText style={[styles.evHubCardText, { color: theme.text }]}>
                EV charging available — {nearbyEvHub!.name}
              </ThemedText>
            </Pressable>
            <Pressable onPress={handleDismissEvHub} style={styles.evHubDismiss}>
              <Ionicons name="close-outline" size={16} color={theme.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {nextArrival ? (
          <Pressable
            style={[styles.arrivalCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
            onPress={() => navigation.navigate("ScheduledArrivals")}
          >
            <Ionicons name="alarm-outline" size={18} color={Colors.travonyGreen} />
            <View style={styles.arrivalCardText}>
              <ThemedText style={styles.arrivalCardTitle} numberOfLines={1}>
                {nextArrival.label} — arrive by{" "}
                {new Date(nextArrival.next!.arriveBy).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </ThemedText>
              <ThemedText style={[styles.arrivalCardSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                Ride locks in at{" "}
                {new Date(nextArrival.next!.dispatchAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
                — no need to book
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>
        ) : null}

        {prayerSub ? (
          <View
            style={[styles.arrivalCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
          >
            <Ionicons name="moon-outline" size={18} color={Colors.travonyGreen} />
            <Pressable style={styles.arrivalCardText} onPress={() => navigation.navigate("PrayerRides")}>
              <ThemedText style={styles.arrivalCardTitle} numberOfLines={1}>
                {prayerSub.next!.prayerLabel} at{" "}
                {new Date(prayerSub.next!.prayerTime).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
                — {prayerSub.mosqueName}
              </ThemedText>
              <ThemedText style={[styles.arrivalCardSubtitle, { color: theme.textMuted }]} numberOfLines={1}>
                {prayerSub.next!.dispatched
                  ? "Ride booked — pickup around " +
                    new Date(prayerSub.next!.pickupAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
                  : "Pickup around " +
                    new Date(prayerSub.next!.pickupAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) +
                    " — books itself"}
              </ThemedText>
            </Pressable>
            {prayerSub.next!.dispatched ? null : (
              <Pressable
                style={[styles.prayerSkipButton, { borderColor: theme.border }]}
                onPress={() => skipPrayerMutation.mutate(prayerSub.id)}
                disabled={skipPrayerMutation.isPending}
              >
                <ThemedText style={[styles.prayerSkipText, { color: theme.text }]}>Skip</ThemedText>
              </Pressable>
            )}
          </View>
        ) : null}

        <View style={styles.quickActionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.networkHubsButton,
              {
                backgroundColor: theme.backgroundElevated,
                borderColor: theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => navigation.navigate("OpenClaw", { variant: "rider" })}
          >
            <Ionicons name="grid-outline" size={20} color={Colors.travonyGreen} />
            <View style={styles.networkHubsText}>
              <ThemedText style={styles.networkHubsTitle}>Network Hubs</ThemedText>
              <ThemedText style={[styles.networkHubsSubtitle, { color: theme.textMuted }]}>
                Discover nearby hubs
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Pressable>

          {evModeActive && (availableEvDriverCount > 0 || evHubsWithPorts.length > 0) ? (
            <View style={[styles.evAvailableBadge, { backgroundColor: Colors.travonyGreen }]}>
              <Ionicons name={"flash" as keyof typeof Ionicons.glyphMap} size={14} color={Colors.light.textOnPrimary} />
              <ThemedText style={styles.evAvailableBadgeText}>
                {availableEvDriverCount > 0
                  ? `${availableEvDriverCount} EV nearby`
                  : `${evHubsWithPorts.length} EV hubs`}
              </ThemedText>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.coffeeButton,
              {
                backgroundColor: theme.backgroundElevated,
                borderColor: theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => navigation.navigate("ScheduledArrivals")}
          >
            <Ionicons name="alarm-outline" size={18} color={Colors.travonyGreen} />
            <ThemedText style={[styles.coffeeButtonText, { color: theme.text }]}>On Time</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.coffeeButton,
              {
                backgroundColor: theme.backgroundElevated,
                borderColor: theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => navigation.navigate("PrayerRides")}
          >
            <Ionicons name="moon-outline" size={18} color={Colors.travonyGreen} />
            <ThemedText style={[styles.coffeeButtonText, { color: theme.text }]}>Prayer</ThemedText>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.coffeeButton,
              {
                backgroundColor: Colors.coffee,
                borderColor: Colors.coffeeDark,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={() => navigation.navigate("Coffee")}
          >
            <Ionicons name="cafe" size={18} color={Colors.light.textOnPrimary} />
            <ThemedText style={styles.coffeeButtonText}>Coffee</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.bottomSheetContainer}>
        <BookingBottomSheet
          currentLocation={currentLocation}
          onLocationChange={handleLocationChange}
          onBookingComplete={handleBookingComplete}
          bottomInset={tabBarHeight}
          onEvModeChange={setEvModeActive}
          initialDropoff={bookingSheetDropoff}
          initialPickup={bookingSheetPickup}
          initialTab={bookingSheetTab}
          onInitialConsumed={() => { setBookingSheetDropoff(null); setBookingSheetPickup(null); setBookingSheetTab("location"); }}
        />
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
  greetingCard: {
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.card,
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  greeting: {
    ...Typography.bodyLargeBold,
  },
  greetingSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },
  networkStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.travonyGreen,
  },
  networkText: {
    ...Typography.caption,
    color: Colors.travonyGreen,
    letterSpacing: 0.5,
  },
  activeRidePill: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.full,
    ...Shadows.fab,
  },
  activeRidePillInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  activeRideDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.backgroundRoot,
    opacity: 0.9,
  },
  activeRidePillText: {
    flex: 1,
    color: Colors.light.textOnPrimary,
    ...Typography.labelBold,
  },
  overlayArea: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  chipsScroll: {
    flexGrow: 0,
  },
  chipsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingBottom: 2,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 7,
    ...Shadows.card,
  },
  chipTextColumn: {
    maxWidth: 150,
  },
  chipText: {
    ...Typography.smallBold,
    maxWidth: 150,
  },
  chipReason: {
    ...Typography.micro,
    marginTop: 1,
    maxWidth: 150,
  },
  evHubCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.card,
  },
  evHubCardContent: {
    flex: 1,
  },
  evHubCardText: {
    ...Typography.smallMedium,
  },
  evHubDismiss: {
    padding: 4,
  },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  arrivalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    marginBottom: Spacing.sm,
  },
  arrivalCardText: { flex: 1 },
  arrivalCardTitle: { ...Typography.labelHeavy },
  arrivalCardSubtitle: { ...Typography.caption, marginTop: 1 },
  prayerSkipButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  prayerSkipText: { ...Typography.smallBold },
  quickActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  networkHubsButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.md,
  },
  coffeeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
    height: 48,
  },
  coffeeButtonText: {
    color: Colors.light.textOnPrimary,
    ...Typography.labelBold,
  },
  evAvailableBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  evAvailableBadgeText: {
    color: Colors.light.textOnPrimary,
    ...Typography.smallHeavy,
  },
  networkHubsText: {
    flex: 1,
  },
  networkHubsTitle: {
    ...Typography.bodyBold,
    letterSpacing: 0.3,
  },
  networkHubsSubtitle: {
    ...Typography.caption,
    marginTop: 2,
  },
});
