import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, getApiUrl } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

const VEHICLE_TYPES = ["economy", "comfort", "premium", "suv"];

const VEHICLE_LABELS: Record<string, string> = {
  economy: "Economy",
  comfort: "Comfort",
  premium: "Premium",
  suv: "SUV",
  motorcycle: "Motorcycle",
  cng_auto: "CNG Auto",
  auto_rickshaw: "Auto Rickshaw",
  tuk_tuk: "Tuk Tuk",
};

const VEHICLE_ICONS: Record<string, string> = {
  economy: "car-outline",
  comfort: "car-sport-outline",
  premium: "diamond-outline",
  suv: "bus-outline",
};

const CACHE_KEY_PRICING = "@ghost_cached_pricing";
const CACHE_KEY_CITY = "@ghost_cached_city";
const CACHE_KEY_LOCATION = "@ghost_last_location";

interface CachedPricing {
  baseFare: string;
  perKmRate: string;
  perMinRate: string;
  minimumFare: string;
  currency: string;
  vehicleType: string;
  cityName: string;
}

const DEFAULT_PRICING: Record<string, CachedPricing> = {
  economy: { baseFare: "3", perKmRate: "2", perMinRate: "0.4", minimumFare: "5", currency: "AED", vehicleType: "economy", cityName: "" },
  comfort: { baseFare: "5", perKmRate: "3", perMinRate: "0.6", minimumFare: "8", currency: "AED", vehicleType: "comfort", cityName: "" },
  premium: { baseFare: "8", perKmRate: "4.5", perMinRate: "0.8", minimumFare: "12", currency: "AED", vehicleType: "premium", cityName: "" },
  suv: { baseFare: "6", perKmRate: "3.5", perMinRate: "0.7", minimumFare: "10", currency: "AED", vehicleType: "suv", cityName: "" },
};

const AVG_SPEED_KMH: Record<string, number> = {
  economy: 30,
  comfort: 30,
  premium: 35,
  suv: 30,
};

interface GhostRide {
  id: number;
  status: string;
  estimatedFare: string;
  syncStatus: string;
  cityName: string;
  vehicleType: string;
  pickupAddress?: string;
  dropoffAddress?: string;
  pickupLat?: string;
  pickupLng?: string;
  dropoffLat?: string;
  dropoffLng?: string;
  driverName?: string;
  driverPhone?: string;
  createdAt: string;
}

interface FareEstimate {
  fare: number;
  currency: string;
  distance: number;
  duration: number;
  breakdown: {
    baseFare: number;
    distanceCharge: number;
    timeCharge: number;
    minimumFare?: number;
  };
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateLocalFare(
  pricing: CachedPricing,
  distanceKm: number,
  durationMin: number
): FareEstimate {
  const baseFare = parseFloat(pricing.baseFare);
  const distanceCharge = distanceKm * parseFloat(pricing.perKmRate);
  const timeCharge = durationMin * parseFloat(pricing.perMinRate);
  const minimumFare = parseFloat(pricing.minimumFare);
  const total = Math.max(minimumFare, baseFare + distanceCharge + timeCharge);

  return {
    fare: Math.round(total * 100) / 100,
    currency: pricing.currency || "AED",
    distance: Math.round(distanceKm * 10) / 10,
    duration: Math.round(durationMin),
    breakdown: {
      baseFare,
      distanceCharge: Math.round(distanceCharge * 100) / 100,
      timeCharge: Math.round(timeCharge * 100) / 100,
      minimumFare,
    },
  };
}

async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (results.length > 0) {
      return results[0].city || results[0].subregion || results[0].region || "Unknown";
    }
  } catch {}
  return "Unknown";
}

export default function GhostModeScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = 0;
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [isOnline, setIsOnline] = useState(true);
  const [detectedCity, setDetectedCity] = useState("");
  const [pickupAddress, setPickupAddress] = useState("Detecting your location...");
  const [pickupCoords, setPickupCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffCoords, setDropoffCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState("economy");
  const [fareEstimate, setFareEstimate] = useState<FareEstimate | null>(null);
  const [cachedPricing, setCachedPricing] = useState<Record<string, CachedPricing>>(DEFAULT_PRICING);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      if (online) {
        fetchAndCachePricing();
      }
    });
    return () => unsubscribe();
  }, [detectedCity]);

  useEffect(() => {
    loadCachedData();
    detectLocation();
  }, []);

  const loadCachedData = async () => {
    try {
      const [pricingStr, cityStr, locationStr] = await Promise.all([
        AsyncStorage.getItem(CACHE_KEY_PRICING),
        AsyncStorage.getItem(CACHE_KEY_CITY),
        AsyncStorage.getItem(CACHE_KEY_LOCATION),
      ]);

      if (pricingStr) {
        const parsed = JSON.parse(pricingStr);
        setCachedPricing({ ...DEFAULT_PRICING, ...parsed });
      }
      if (cityStr) {
        setDetectedCity(cityStr);
      }
      if (locationStr) {
        const loc = JSON.parse(locationStr);
        setPickupCoords(loc);
        setPickupAddress(loc.address || "Last known location");
      }
    } catch {}
  };

  const detectLocation = async () => {
    setIsLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status);
      if (status !== "granted") {
        setPickupAddress("Location permission required");
        setIsLoadingLocation(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setPickupCoords(coords);

      const city = await reverseGeocode(coords.lat, coords.lng);
      setDetectedCity(city);

      const addressResults = await Location.reverseGeocodeAsync({
        latitude: coords.lat,
        longitude: coords.lng,
      });

      let address = "Current Location";
      if (addressResults.length > 0) {
        const a = addressResults[0];
        const parts = [a.street, a.district, a.city].filter(Boolean);
        address = parts.join(", ") || "Current Location";
      }
      setPickupAddress(address);

      await AsyncStorage.setItem(CACHE_KEY_CITY, city);
      await AsyncStorage.setItem(
        CACHE_KEY_LOCATION,
        JSON.stringify({ ...coords, address })
      );

      fetchAndCachePricing(city);
    } catch {
      setPickupAddress("Could not detect location");
    }
    setIsLoadingLocation(false);
  };

  const fetchAndCachePricing = async (city?: string) => {
    const cityName = city || detectedCity;
    if (!cityName || cityName === "Unknown") return;

    try {
      const url = new URL(`/api/ghost/pricing/${encodeURIComponent(cityName)}`, getApiUrl());
      const response = await fetch(url.toString(), { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const pricingMap: Record<string, CachedPricing> = { ...DEFAULT_PRICING };
          for (const p of data) {
            pricingMap[p.vehicleType] = p;
          }
          setCachedPricing(pricingMap);
          await AsyncStorage.setItem(CACHE_KEY_PRICING, JSON.stringify(pricingMap));
        }
      }
    } catch {}
  };

  const geocodeDropoff = async (address: string) => {
    if (!address.trim()) {
      setDropoffCoords(null);
      setFareEstimate(null);
      return;
    }

    setIsGeocoding(true);
    try {
      const results = await Location.geocodeAsync(address);
      if (results.length > 0) {
        const coords = { lat: results[0].latitude, lng: results[0].longitude };
        setDropoffCoords(coords);
        calculateFare(coords);
      } else {
        setDropoffCoords(null);
        setFareEstimate(null);
      }
    } catch {
      setDropoffCoords(null);
      setFareEstimate(null);
    }
    setIsGeocoding(false);
  };

  const calculateFare = (dropoff?: { lat: number; lng: number }) => {
    const drop = dropoff || dropoffCoords;
    if (!pickupCoords || !drop) return;

    const distanceKm = haversineDistance(
      pickupCoords.lat,
      pickupCoords.lng,
      drop.lat,
      drop.lng
    );

    const roadDistance = distanceKm * 1.3;
    const avgSpeed = AVG_SPEED_KMH[selectedVehicle] || 30;
    const durationMin = (roadDistance / avgSpeed) * 60;

    const pricing = cachedPricing[selectedVehicle] || DEFAULT_PRICING[selectedVehicle];
    const estimate = calculateLocalFare(pricing, roadDistance, durationMin);
    setFareEstimate(estimate);
  };

  useEffect(() => {
    if (pickupCoords && dropoffCoords) {
      calculateFare();
    }
  }, [selectedVehicle]);

  const { data: ghostRides, isLoading: ridesLoading } = useQuery<GhostRide[]>({
    queryKey: ["/api/ghost/rides"],
    enabled: isOnline,
  });

  const requestRideMutation = useMutation({
    mutationFn: async () => {
      if (!fareEstimate || !pickupCoords || !dropoffCoords) throw new Error("Missing ride details");

      return apiRequest("/api/ghost/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          localId: `ghost_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          pickupLat: pickupCoords.lat,
          pickupLng: pickupCoords.lng,
          pickupAddress,
          dropoffLat: dropoffCoords.lat,
          dropoffLng: dropoffCoords.lng,
          dropoffAddress,
          vehicleType: selectedVehicle,
          cityName: detectedCity,
          estimatedFare: fareEstimate.fare.toString(),
          currency: fareEstimate.currency,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ghost/rides"] });
      setFareEstimate(null);
      setDropoffAddress("");
      setDropoffCoords(null);
      showAlert("Ghost Route Requested", "Your request has been broadcast via Bluetooth mesh. A nearby vehicle will be assigned.");
    },
    onError: (error: Error) => {
      showAlert("Request Error", error.message || "Failed to request ghost route.");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ghost/sync", { method: "POST" });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/ghost/rides"] });
      const syncedCount = data?.rides?.filter((r: any) => r.success).length || 0;
      showAlert("Sync Complete", `${syncedCount} route(s) synced successfully.`);
    },
    onError: (error: Error) => {
      showAlert("Sync Error", error.message || "Failed to sync routes.");
    },
  });

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);

  const handleRequestRide = () => {
    if (!fareEstimate) return;
    const confirmMsg = `Estimated fare: ${fareEstimate.currency} ${fareEstimate.fare.toFixed(2)}\nDistance: ${fareEstimate.distance} km\nDuration: ~${fareEstimate.duration} min\n\nConfirm ghost route request?`;
    if (Platform.OS === "web") {
      if (window.confirm(confirmMsg)) requestRideMutation.mutate();
    } else {
      Alert.alert("Confirm Ghost Route", confirmMsg, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => requestRideMutation.mutate() },
      ]);
    }
  };

  const activeRide = ghostRides?.find(
    (r) => r.status === "waiting" || r.status === "accepted" || r.status === "in_progress" || r.status === "broadcasting"
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
      case "broadcasting":
        return theme.warning;
      case "accepted":
        return theme.primary;
      case "in_progress":
        return Colors.travonyGreen;
      case "completed":
        return theme.success;
      case "cancelled":
        return theme.error;
      default:
        return theme.textMuted;
    }
  };

  const getSyncIcon = (syncStatus: string): { name: string; color: string } => {
    switch (syncStatus) {
      case "synced":
        return { name: "checkmark-circle", color: theme.success };
      case "pending":
        return { name: "time-outline", color: theme.warning };
      case "failed":
        return { name: "close-circle", color: theme.error };
      default:
        return { name: "help-circle-outline", color: theme.textMuted };
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "broadcasting": return "Broadcasting";
      case "waiting": return "Waiting for Driver";
      case "accepted": return "Driver Accepted";
      case "in_progress": return "Ride in Progress";
      case "completed": return "Completed";
      case "cancelled": return "Cancelled";
      default: return status;
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <Card style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isOnline ? theme.success : Colors.travonyGreen },
            ]}
          />
          <View style={styles.statusTextContainer}>
            <ThemedText style={styles.statusTitle}>
              {isOnline ? "Online" : "Ghost Mode Active"}
            </ThemedText>
            <ThemedText style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
              {isOnline
                ? "Connected - pricing data cached for offline use"
                : "Using Bluetooth mesh networking"}
            </ThemedText>
          </View>
          <Ionicons
            name={isOnline ? "wifi-outline" : "bluetooth-outline"}
            size={28}
            color={isOnline ? theme.success : Colors.travonyGreen}
          />
        </View>
      </Card>

      <Card style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle-outline" size={22} color={theme.primary} />
          <ThemedText style={styles.infoTitle}>How Ghost Mode Works</ThemedText>
        </View>
        <ThemedText style={[styles.infoDescription, { color: theme.textSecondary }]}>
          Ghost Mode enables mobility access even without internet. When you go offline, your device uses Bluetooth mesh networking to find nearby vehicles.
        </ThemedText>
        <View style={styles.infoFeatures}>
          <View style={styles.infoFeatureRow}>
            <Ionicons name="bluetooth-outline" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoFeatureText, { color: theme.textSecondary }]}>
              Connects via Bluetooth Low Energy to nearby drivers
            </ThemedText>
          </View>
          <View style={styles.infoFeatureRow}>
            <Ionicons name="calculator-outline" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoFeatureText, { color: theme.textSecondary }]}>
              Fares calculated locally from cached regional pricing
            </ThemedText>
          </View>
          <View style={styles.infoFeatureRow}>
            <Ionicons name="cloud-upload-outline" size={16} color={theme.primary} />
            <ThemedText style={[styles.infoFeatureText, { color: theme.textSecondary }]}>
              Rides auto-sync for payment when you're back online
            </ThemedText>
          </View>
        </View>
      </Card>

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="car-outline" size={22} color={theme.primary} />
          <ThemedText style={styles.sectionTitle}>Request Ghost Ride</ThemedText>
        </View>

        <View style={styles.locationSection}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: Colors.travonyGreen }]} />
            <View style={styles.locationContent}>
              <ThemedText style={[styles.locationLabel, { color: theme.textMuted }]}>
                Pickup
              </ThemedText>
              <View style={styles.locationValueRow}>
                {isLoadingLocation ? (
                  <View style={styles.detectingRow}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <ThemedText style={[styles.locationValue, { color: theme.textSecondary }]}>
                      Detecting your location...
                    </ThemedText>
                  </View>
                ) : (
                  <ThemedText style={styles.locationValue} numberOfLines={2}>
                    {pickupAddress}
                  </ThemedText>
                )}
              </View>
            </View>
            <Pressable onPress={detectLocation} style={styles.refreshButton}>
              <Ionicons name="locate-outline" size={20} color={theme.primary} />
            </Pressable>
          </View>

          {detectedCity ? (
            <View style={[styles.cityBadge, { backgroundColor: theme.primary + "15" }]}>
              <Ionicons name="location-outline" size={14} color={theme.primary} />
              <ThemedText style={[styles.cityBadgeText, { color: theme.primary }]}>
                {detectedCity}
              </ThemedText>
            </View>
          ) : null}

          <View style={[styles.locationDivider, { borderColor: theme.border }]} />

          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
            <View style={styles.locationContent}>
              <ThemedText style={[styles.locationLabel, { color: theme.textMuted }]}>
                Dropoff
              </ThemedText>
              <TextInput
                style={[
                  styles.dropoffInput,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={dropoffAddress}
                onChangeText={setDropoffAddress}
                onEndEditing={() => geocodeDropoff(dropoffAddress)}
                onSubmitEditing={() => geocodeDropoff(dropoffAddress)}
                placeholder="Enter destination"
                placeholderTextColor={theme.textMuted}
                returnKeyType="search"
              />
            </View>
            {isGeocoding ? (
              <ActivityIndicator size="small" color={theme.primary} style={{ marginLeft: Spacing.sm }} />
            ) : null}
          </View>
        </View>

        <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
          Vehicle Type
        </ThemedText>
        <View style={styles.vehicleGrid}>
          {VEHICLE_TYPES.map((type) => (
            <Pressable
              key={type}
              style={[
                styles.vehicleCard,
                {
                  backgroundColor:
                    selectedVehicle === type
                      ? theme.primary + "15"
                      : theme.backgroundDefault,
                  borderColor:
                    selectedVehicle === type ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setSelectedVehicle(type)}
            >
              <Ionicons
                name={(VEHICLE_ICONS[type] || "car-outline") as any}
                size={22}
                color={selectedVehicle === type ? theme.primary : theme.textMuted}
              />
              <ThemedText
                style={[
                  styles.vehicleCardText,
                  {
                    color:
                      selectedVehicle === type
                        ? theme.primary
                        : theme.text,
                  },
                ]}
              >
                {VEHICLE_LABELS[type]}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        {fareEstimate ? (
          <View style={[styles.farePreview, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.fareHeader}>
              <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>
                Estimated Fare
              </ThemedText>
              <View style={[styles.offlineBadge, { backgroundColor: Colors.travonyGreen + "20" }]}>
                <Ionicons name="flash-outline" size={12} color={Colors.travonyGreen} />
                <ThemedText style={[styles.offlineBadgeText, { color: Colors.travonyGreen }]}>
                  Offline Calculated
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.fareAmount, { color: theme.primary }]}>
              {fareEstimate.currency} {fareEstimate.fare.toFixed(2)}
            </ThemedText>

            <View style={styles.fareStatsRow}>
              <View style={styles.fareStat}>
                <Ionicons name="navigate-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.fareStatText, { color: theme.textSecondary }]}>
                  {fareEstimate.distance} km
                </ThemedText>
              </View>
              <View style={styles.fareStat}>
                <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.fareStatText, { color: theme.textSecondary }]}>
                  ~{fareEstimate.duration} min
                </ThemedText>
              </View>
            </View>

            <View style={[styles.fareBreakdown, { borderTopColor: theme.border }]}>
              <View style={styles.fareBreakdownRow}>
                <ThemedText style={[styles.fareBreakdownLabel, { color: theme.textMuted }]}>
                  Base fare
                </ThemedText>
                <ThemedText style={[styles.fareBreakdownValue, { color: theme.textSecondary }]}>
                  {fareEstimate.currency} {fareEstimate.breakdown.baseFare.toFixed(2)}
                </ThemedText>
              </View>
              <View style={styles.fareBreakdownRow}>
                <ThemedText style={[styles.fareBreakdownLabel, { color: theme.textMuted }]}>
                  Distance ({fareEstimate.distance} km)
                </ThemedText>
                <ThemedText style={[styles.fareBreakdownValue, { color: theme.textSecondary }]}>
                  {fareEstimate.currency} {fareEstimate.breakdown.distanceCharge.toFixed(2)}
                </ThemedText>
              </View>
              <View style={styles.fareBreakdownRow}>
                <ThemedText style={[styles.fareBreakdownLabel, { color: theme.textMuted }]}>
                  Time (~{fareEstimate.duration} min)
                </ThemedText>
                <ThemedText style={[styles.fareBreakdownValue, { color: theme.textSecondary }]}>
                  {fareEstimate.currency} {fareEstimate.breakdown.timeCharge.toFixed(2)}
                </ThemedText>
              </View>
            </View>

            <Pressable
              style={[
                styles.requestButton,
                {
                  backgroundColor: Colors.travonyGreen,
                  opacity: requestRideMutation.isPending ? 0.7 : 1,
                },
              ]}
              onPress={handleRequestRide}
              disabled={requestRideMutation.isPending}
            >
              {requestRideMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={20} color="#FFFFFF" />
                  <ThemedText style={styles.requestButtonText}>
                    Request Ghost Ride
                  </ThemedText>
                </>
              )}
            </Pressable>
          </View>
        ) : dropoffAddress.trim().length > 0 && !isGeocoding && !dropoffCoords ? (
          <View style={[styles.noResultsHint, { backgroundColor: theme.backgroundDefault }]}>
            <Ionicons name="search-outline" size={20} color={theme.textMuted} />
            <ThemedText style={[styles.noResultsText, { color: theme.textMuted }]}>
              Could not find that location. Try a more specific address.
            </ThemedText>
          </View>
        ) : !dropoffAddress.trim() ? (
          <View style={[styles.hintCard, { backgroundColor: theme.backgroundDefault }]}>
            <Ionicons name="arrow-up-outline" size={18} color={theme.textMuted} />
            <ThemedText style={[styles.hintText, { color: theme.textMuted }]}>
              Enter your destination above to get an instant fare estimate
            </ThemedText>
          </View>
        ) : null}
      </Card>

      {activeRide ? (
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="navigate-outline" size={22} color={theme.primary} />
            <ThemedText style={styles.sectionTitle}>Active Ghost Ride</ThemedText>
          </View>

          <View style={styles.activeRideContent}>
            <View style={styles.activeRideStatusRow}>
              <View
                style={[
                  styles.activeStatusBadge,
                  { backgroundColor: getStatusColor(activeRide.status) + "20" },
                ]}
              >
                <View
                  style={[
                    styles.activeStatusDot,
                    { backgroundColor: getStatusColor(activeRide.status) },
                  ]}
                />
                <ThemedText
                  style={[
                    styles.activeStatusText,
                    { color: getStatusColor(activeRide.status) },
                  ]}
                >
                  {getStatusLabel(activeRide.status)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.activeRideDetails}>
              {activeRide.pickupAddress ? (
                <View style={styles.detailRow}>
                  <Ionicons name="location-outline" size={16} color={Colors.travonyGreen} />
                  <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                    {activeRide.pickupAddress}
                  </ThemedText>
                </View>
              ) : null}
              {activeRide.dropoffAddress ? (
                <View style={styles.detailRow}>
                  <Ionicons name="flag-outline" size={16} color={theme.error} />
                  <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                    {activeRide.dropoffAddress}
                  </ThemedText>
                </View>
              ) : null}
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {parseFloat(activeRide.estimatedFare).toFixed(2)}
                </ThemedText>
              </View>
            </View>

            {(activeRide.status === "accepted" || activeRide.status === "in_progress") &&
            activeRide.driverName ? (
              <View
                style={[
                  styles.driverInfo,
                  { backgroundColor: theme.backgroundDefault },
                ]}
              >
                <View style={[styles.driverAvatar, { backgroundColor: theme.primary + "20" }]}>
                  <Ionicons name="person-outline" size={20} color={theme.primary} />
                </View>
                <View style={styles.driverDetails}>
                  <ThemedText style={styles.driverName}>
                    {activeRide.driverName}
                  </ThemedText>
                  {activeRide.driverPhone ? (
                    <ThemedText style={[styles.driverPhone, { color: theme.textSecondary }]}>
                      {activeRide.driverPhone}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ) : null}
          </View>
        </Card>
      ) : null}

      {isOnline ? (
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="sync-outline" size={22} color={theme.primary} />
            <ThemedText style={styles.sectionTitle}>Sync Status</ThemedText>
          </View>

          <ThemedText style={[styles.syncDescription, { color: theme.textSecondary }]}>
            Sync your ghost rides with the server to process payments and update records.
          </ThemedText>

          <Pressable
            style={[
              styles.syncButton,
              {
                backgroundColor: theme.primary,
                opacity: syncMutation.isPending ? 0.7 : 1,
              },
            ]}
            onPress={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
          >
            {syncMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                <ThemedText style={styles.syncButtonText}>Sync Now</ThemedText>
              </>
            )}
          </Pressable>
        </Card>
      ) : null}

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={22} color={theme.primary} />
          <ThemedText style={styles.sectionTitle}>Ghost Route History</ThemedText>
        </View>

        {ridesLoading ? (
          <ActivityIndicator
            size="large"
            color={theme.primary}
            style={styles.loader}
          />
        ) : ghostRides && ghostRides.length > 0 ? (
          ghostRides.map((ride) => {
            const syncIcon = getSyncIcon(ride.syncStatus);
            return (
              <View
                key={ride.id}
                style={[
                  styles.rideItem,
                  { borderBottomColor: theme.border },
                ]}
              >
                <View style={styles.rideItemLeft}>
                  <View style={styles.rideItemHeader}>
                    <View
                      style={[
                        styles.rideStatusBadge,
                        { backgroundColor: getStatusColor(ride.status) + "20" },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.rideStatusText,
                          { color: getStatusColor(ride.status) },
                        ]}
                      >
                        {ride.status}
                      </ThemedText>
                    </View>
                    <ThemedText style={[styles.rideDate, { color: theme.textMuted }]}>
                      {formatDate(ride.createdAt)}
                    </ThemedText>
                  </View>
                  <View style={styles.rideItemDetails}>
                    <ThemedText style={[styles.rideCity, { color: theme.textSecondary }]}>
                      {ride.cityName || "Ghost Route"} - {VEHICLE_LABELS[ride.vehicleType] || ride.vehicleType}
                    </ThemedText>
                    <ThemedText style={styles.rideFare}>
                      {parseFloat(ride.estimatedFare).toFixed(2)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.syncIconContainer}>
                  <Ionicons
                    name={syncIcon.name as any}
                    size={22}
                    color={syncIcon.color}
                  />
                </View>
              </View>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="car-outline" size={40} color={theme.textMuted} />
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              No ghost rides yet
            </ThemedText>
          </View>
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusCard: {
    marginBottom: Spacing.lg,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: Spacing.md,
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.h3,
  },
  statusSubtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  sectionCard: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
    marginLeft: Spacing.sm,
  },
  locationSection: {
    marginBottom: Spacing.lg,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingVertical: Spacing.sm,
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
    marginRight: Spacing.md,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    ...Typography.caption,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  locationValueRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationValue: {
    ...Typography.bodyMedium,
  },
  detectingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  refreshButton: {
    padding: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  cityBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.lg,
    marginLeft: 28,
    marginTop: 4,
    gap: 4,
  },
  cityBadgeText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  locationDivider: {
    borderLeftWidth: 2,
    borderStyle: "dashed" as any,
    height: 20,
    marginLeft: 5,
    marginVertical: 2,
  },
  dropoffInput: {
    height: 44,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  inputLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
    fontWeight: "600",
  },
  vehicleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  vehicleCard: {
    flex: 1,
    minWidth: "22%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    gap: 6,
  },
  vehicleCardText: {
    ...Typography.caption,
    fontWeight: "600",
  },
  farePreview: {
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
  },
  fareHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  fareLabel: {
    ...Typography.small,
  },
  offlineBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.lg,
    gap: 4,
  },
  offlineBadgeText: {
    ...Typography.caption,
    fontWeight: "600",
    fontSize: 10,
  },
  fareAmount: {
    fontSize: 32,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  fareStatsRow: {
    flexDirection: "row",
    gap: Spacing.xl,
    marginBottom: Spacing.md,
  },
  fareStat: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fareStatText: {
    ...Typography.bodyMedium,
  },
  fareBreakdown: {
    borderTopWidth: 1,
    paddingTop: Spacing.md,
    marginBottom: Spacing.md,
  },
  fareBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xs,
  },
  fareBreakdownLabel: {
    ...Typography.small,
  },
  fareBreakdownValue: {
    ...Typography.small,
    fontWeight: "500",
  },
  requestButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  requestButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  hintCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  hintText: {
    ...Typography.bodyMedium,
    flex: 1,
  },
  noResultsHint: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  noResultsText: {
    ...Typography.bodyMedium,
    flex: 1,
  },
  activeRideContent: {
    gap: Spacing.md,
  },
  activeRideStatusRow: {
    flexDirection: "row",
  },
  activeStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  activeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeStatusText: {
    ...Typography.small,
    fontWeight: "600",
  },
  activeRideDetails: {
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  detailText: {
    ...Typography.bodyMedium,
    flex: 1,
  },
  driverInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: Spacing.md,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    ...Typography.h4,
  },
  driverPhone: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  syncDescription: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.lg,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 50,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  syncButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  rideItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  rideItemLeft: {
    flex: 1,
  },
  rideItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  rideStatusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  rideStatusText: {
    ...Typography.caption,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  rideDate: {
    ...Typography.caption,
  },
  rideItemDetails: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rideCity: {
    ...Typography.bodyMedium,
    flex: 1,
  },
  rideFare: {
    ...Typography.h4,
  },
  syncIconContainer: {
    marginLeft: Spacing.md,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["3xl"],
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.bodyMedium,
  },
  infoCard: {
    marginBottom: Spacing.lg,
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  infoTitle: {
    ...Typography.h4,
  },
  infoDescription: {
    ...Typography.bodyMedium,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  infoFeatures: {
    gap: Spacing.sm,
  },
  infoFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  infoFeatureText: {
    ...Typography.bodyMedium,
    flex: 1,
    lineHeight: 20,
  },
  loader: {
    paddingVertical: Spacing["3xl"],
  },
});
