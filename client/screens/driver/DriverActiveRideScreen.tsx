import { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Alert, Linking, Platform, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import type { DriverHomeStackParamList } from "@/navigation/driver/DriverHomeStackNavigator";
import { MapView, Marker, mapsAvailable, WebMapFallback } from "@/components/NativeMaps";

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
  customer?: {
    name: string;
    phone?: string;
    avatar?: string;
  };
}

type RideStatus = "accepted" | "arriving" | "started" | "in_progress" | "completed";

export default function DriverActiveRideScreen() {
  const insets = useSafeAreaInsets();
  const { theme, isDark } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();
  const mapRef = useRef<any>(null);

  const { rideId } = route.params || {};
  
  // Ensure rideId is a valid string
  const validRideId = typeof rideId === 'string' ? rideId : '';

  const { data: ride, isLoading, error } = useQuery<Ride>({
    queryKey: ["/api/rides", validRideId],
    refetchInterval: 5000,
    enabled: !!validRideId,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: RideStatus) => {
      const updates: any = { status };
      if (status === "started") {
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides", validRideId] });
      if (data.status === "completed") {
        Alert.alert("Ride Completed", "Great job! The ride has been completed.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      }
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update ride status");
    },
  });

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
          title: "Waiting for Customer",
          subtitle: "Customer has been notified",
          action: "Start Ride",
          nextStatus: "in_progress" as RideStatus,
        };
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
    const destination = ride.status === "in_progress" 
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
          { 
            text: "Cash Collected", 
            onPress: () => updateStatusMutation.mutate("completed"),
          }
        ]
      );
    } else {
      updateStatusMutation.mutate(statusInfo.nextStatus);
    }
  };

  const handleCancelRide = () => {
    Alert.alert(
      "Cancel Ride",
      "Are you sure you want to cancel this ride?",
      [
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
      ]
    );
  };

  const renderMap = () => {
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
        {ride && (
          <>
            <Marker
              coordinate={{
                latitude: Number(ride.pickupLat),
                longitude: Number(ride.pickupLng),
              }}
              title="Pickup"
              pinColor={Colors.travonyGreen}
            />
            <Marker
              coordinate={{
                latitude: Number(ride.dropoffLat),
                longitude: Number(ride.dropoffLng),
              }}
              title="Drop-off"
              pinColor={theme.error}
            />
          </>
        )}
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

  // Calculate button section height
  const buttonSectionHeight = (statusInfo.nextStatus ? 56 : 0) + 
    (ride?.status !== "in_progress" && ride?.status !== "completed" ? 48 + Spacing.sm : 0) + 
    Math.max(insets.bottom, Spacing.lg) + Spacing.lg;

  return (
    <ThemedView style={styles.container}>
      {/* Map takes remaining space above bottom panel */}
      <View style={[styles.mapContainer, { marginBottom: 0 }]}>
        {renderMap()}
        
        {/* Back button overlay on map */}
        <View style={[styles.header, { top: insets.top + Spacing.md }]}>
          <Pressable
            style={[styles.backButton, { backgroundColor: theme.backgroundRoot }]}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="arrow-back-outline" size={24} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Bottom panel - contains all ride info and buttons */}
      <ScrollView 
        style={[styles.bottomPanel, { backgroundColor: theme.backgroundRoot }]}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, Spacing.lg) }}
      >
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <View style={[styles.statusIndicator, { backgroundColor: Colors.travonyGreen }]} />
          <View style={styles.statusInfo}>
            <ThemedText style={styles.statusTitle}>{statusInfo.title}</ThemedText>
            <ThemedText style={[styles.statusSubtitle, { color: theme.textSecondary }]} numberOfLines={1}>
              {statusInfo.subtitle}
            </ThemedText>
          </View>
        </View>

        {/* Customer Info */}
        {ride ? (
          <View style={[styles.customerInfo, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.customerAvatar}>
              <Ionicons name="person-outline" size={20} color={theme.textMuted} />
            </View>
            <View style={styles.customerDetails}>
              <ThemedText style={styles.customerName}>
                {ride.customer?.name || "Customer"}
              </ThemedText>
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
                style={[styles.actionButton, { borderColor: theme.border }]}
                onPress={handleNavigate}
              >
                <Ionicons name="navigate-outline" size={18} color={Colors.travonyGreen} />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Action Buttons */}
        <View style={styles.buttonSection}>
          {statusInfo.nextStatus ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: Colors.travonyGreen }]}
              onPress={handleStatusUpdate}
              disabled={updateStatusMutation.isPending}
            >
              <ThemedText style={styles.primaryButtonText}>
                {updateStatusMutation.isPending ? "Updating..." : statusInfo.action}
              </ThemedText>
            </Pressable>
          ) : null}

          {ride?.status !== "in_progress" && ride?.status !== "completed" ? (
            <Pressable
              style={[styles.cancelButton, { borderColor: theme.error }]}
              onPress={handleCancelRide}
            >
              <ThemedText style={[styles.cancelButtonText, { color: theme.error }]}>
                Cancel Ride
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
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
      android: {
        elevation: 4,
      },
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
      android: {
        elevation: 8,
      },
    }),
  },
  buttonSection: {
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    ...Typography.h4,
    marginBottom: 2,
  },
  statusSubtitle: {
    ...Typography.body,
  },
  customerInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
    padding: Spacing.lg,
    backgroundColor: "rgba(0,0,0,0.03)",
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
  customerDetails: {
    flex: 1,
  },
  customerName: {
    ...Typography.h4,
    marginBottom: 2,
  },
  fareAmount: {
    ...Typography.body,
    fontWeight: "600",
  },
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
  actions: {
    gap: Spacing.md,
  },
  primaryButton: {
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    ...Typography.button,
    color: "#fff",
  },
  cancelButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButtonText: {
    ...Typography.button,
  },
  paymentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
});
