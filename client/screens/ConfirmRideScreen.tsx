import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Shadows, Colors } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "ConfirmRide">;
type RouteProps = RouteProp<HomeStackParamList, "ConfirmRide">;

interface VehicleType {
  id: string;
  name: string;
  type: string;
  baseFare: number;
  perKmRate: number;
  perMinuteRate: number;
  icon: string;
}

const vehicleTypes: VehicleType[] = [
  { id: "1", name: "Economy", type: "economy", baseFare: 5, perKmRate: 1.5, perMinuteRate: 0.2, icon: "navigation" },
  { id: "2", name: "Comfort", type: "comfort", baseFare: 8, perKmRate: 2, perMinuteRate: 0.3, icon: "car-outline" },
  { id: "3", name: "Premium", type: "premium", baseFare: 15, perKmRate: 3, perMinuteRate: 0.5, icon: "award" },
  { id: "4", name: "XL", type: "xl", baseFare: 12, perKmRate: 2.5, perMinuteRate: 0.4, icon: "users" },
];

const paymentMethods = [
  { id: "cash", name: "Cash", icon: "dollar-sign" },
  { id: "usdt", name: "USDT", icon: "dollar-sign" },
];

export default function ConfirmRideScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const queryClient = useQueryClient();

  const { pickup, dropoff } = route.params;
  const [selectedVehicle, setSelectedVehicle] = useState(vehicleTypes[0]);
  const [selectedPayment, setSelectedPayment] = useState(paymentMethods[0]);
  const [promoCode, setPromoCode] = useState("");
  const [showTransparency, setShowTransparency] = useState(false);

  const distance = useMemo(() => {
    const R = 6371;
    const dLat = ((dropoff.lat - pickup.lat) * Math.PI) / 180;
    const dLng = ((dropoff.lng - pickup.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((pickup.lat * Math.PI) / 180) *
        Math.cos((dropoff.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(R * c, 1);
  }, [pickup, dropoff]);

  const estimatedDuration = Math.round(distance * 3);

  const { data: aiPricing, isLoading: pricingLoading } = useQuery({
    queryKey: ["/api/ai/price", pickup.lat, pickup.lng, dropoff.lat, dropoff.lng, selectedVehicle.type, distance],
    queryFn: async () => {
      const response = await apiRequest(
        `/api/ai/price?pickupLat=${pickup.lat}&pickupLng=${pickup.lng}&dropoffLat=${dropoff.lat}&dropoffLng=${dropoff.lng}&vehicleType=${selectedVehicle.type}&distance=${distance}&duration=${estimatedDuration}`,
        { method: "GET" }
      );
      return response;
    },
    staleTime: 30000,
  });

  const calculateFare = (vehicle: VehicleType) => {
    if (aiPricing && vehicle.type === selectedVehicle.type) {
      const price = Number(aiPricing.finalPrice);
      return !isNaN(price) ? price.toFixed(2) : "0.00";
    }
    const fare = vehicle.baseFare + distance * vehicle.perKmRate + estimatedDuration * vehicle.perMinuteRate;
    return fare.toFixed(2);
  };

  const platformFee = aiPricing ? aiPricing.platformFee : parseFloat(calculateFare(selectedVehicle)) * 0.1;
  const driverEarnings = aiPricing ? aiPricing.driverEarnings : parseFloat(calculateFare(selectedVehicle)) * 0.9;

  const bookRideMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/rides", {
        method: "POST",
        body: JSON.stringify({
          customerId: user?.id,
          pickupAddress: pickup.address,
          pickupLat: pickup.lat.toString(),
          pickupLng: pickup.lng.toString(),
          dropoffAddress: dropoff.address,
          dropoffLat: dropoff.lat.toString(),
          dropoffLng: dropoff.lng.toString(),
          serviceTypeId: selectedVehicle.id,
          estimatedFare: calculateFare(selectedVehicle),
          distance: Number(distance.toFixed(2)),
          duration: estimatedDuration,
          paymentMethod: selectedPayment.id,
          surgeMultiplier: aiPricing?.surgeMultiplier?.toString() || "1.00",
          platformFee: platformFee.toFixed(2),
          driverEarnings: driverEarnings.toFixed(2),
          priceBreakdown: JSON.stringify(aiPricing || {}),
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/rides"] });
      navigation.navigate("ActiveRide", { rideId: data.id });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to book ride");
    },
  });

  const handleBookRide = () => {
    if (!user?.id) {
      Alert.alert("Sign In Required", "Please sign in to book a ride");
      return;
    }
    bookRideMutation.mutate();
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: Math.max(insets.bottom, 20) + 100,
        paddingHorizontal: Spacing.lg,
      }}
    >
      <Card style={styles.routeCard}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.primary }]} />
          <View style={styles.locationInfo}>
            <ThemedText style={[styles.locationLabel, { color: theme.textMuted }]}>Pickup</ThemedText>
            <ThemedText style={styles.locationAddress} numberOfLines={2}>
              {pickup.address}
            </ThemedText>
          </View>
        </View>
        <View style={styles.locationDivider}>
          <View style={[styles.verticalLine, { borderColor: theme.border }]} />
        </View>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
          <View style={styles.locationInfo}>
            <ThemedText style={[styles.locationLabel, { color: theme.textMuted }]}>Drop-off</ThemedText>
            <ThemedText style={styles.locationAddress} numberOfLines={2}>
              {dropoff.address}
            </ThemedText>
          </View>
        </View>
        <View style={[styles.tripInfo, { borderTopColor: theme.border }]}>
          <View style={styles.tripInfoItem}>
            <Ionicons name="map-outline" size={16} color={theme.textMuted} />
            <ThemedText style={[styles.tripInfoText, { color: theme.textSecondary }]}>
              {distance.toFixed(1)} km
            </ThemedText>
          </View>
          <View style={styles.tripInfoItem}>
            <Ionicons name="time-outline" size={16} color={theme.textMuted} />
            <ThemedText style={[styles.tripInfoText, { color: theme.textSecondary }]}>
              ~{estimatedDuration} min
            </ThemedText>
          </View>
        </View>
      </Card>

      <ThemedText style={styles.sectionTitle}>Select Vehicle</ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.vehicleList}
      >
        {vehicleTypes.map((vehicle) => (
          <Pressable
            key={vehicle.id}
            style={({ pressed }) => [
              styles.vehicleCard,
              {
                backgroundColor: theme.card,
                borderColor: selectedVehicle.id === vehicle.id ? theme.primary : theme.border,
                borderWidth: selectedVehicle.id === vehicle.id ? 2 : 1,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => setSelectedVehicle(vehicle)}
          >
            <View style={[styles.vehicleIcon, { backgroundColor: theme.backgroundDefault }]}>
              <Ionicons name={vehicle.icon as any} size={24} color={theme.primary} />
            </View>
            <ThemedText style={styles.vehicleName}>{vehicle.name}</ThemedText>
            <ThemedText style={[styles.vehiclePrice, { color: theme.primary }]}>
              AED {calculateFare(vehicle)}
            </ThemedText>
          </Pressable>
        ))}
      </ScrollView>

      <ThemedText style={styles.sectionTitle}>Payment Method</ThemedText>
      <View style={styles.paymentList}>
        {paymentMethods.map((payment) => (
          <Pressable
            key={payment.id}
            style={({ pressed }) => [
              styles.paymentCard,
              {
                backgroundColor: theme.card,
                borderColor: selectedPayment.id === payment.id ? theme.primary : theme.border,
                borderWidth: selectedPayment.id === payment.id ? 2 : 1,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => setSelectedPayment(payment)}
          >
            <Ionicons name={payment.icon as any} size={20} color={theme.primary} />
            <ThemedText style={styles.paymentName}>{payment.name}</ThemedText>
          </Pressable>
        ))}
      </View>

      <Card style={styles.fareCard}>
        {pricingLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.primary} />
            <ThemedText style={[styles.loadingText, { color: theme.textMuted }]}>
              Calculating smart price...
            </ThemedText>
          </View>
        ) : (
          <>
            {aiPricing?.surgeMultiplier > 1 ? (
              <View style={[styles.surgeBar, { backgroundColor: theme.warning + "20" }]}>
                <Ionicons name="trending-up-outline" size={14} color={theme.warning} />
                <ThemedText style={[styles.surgeText, { color: theme.warning }]}>
                  {aiPricing.surgeMultiplier.toFixed(1)}x demand - Max 1.5x cap applied
                </ThemedText>
              </View>
            ) : null}
            <View style={styles.fareRow}>
              <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>Base Fare</ThemedText>
              <ThemedText style={styles.fareValue}>AED {aiPricing?.baseFare?.toFixed(2) || selectedVehicle.baseFare.toFixed(2)}</ThemedText>
            </View>
            <View style={styles.fareRow}>
              <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>Distance ({distance.toFixed(1)} km)</ThemedText>
              <ThemedText style={styles.fareValue}>AED {aiPricing?.distanceCharge?.toFixed(2) || (distance * selectedVehicle.perKmRate).toFixed(2)}</ThemedText>
            </View>
            <View style={styles.fareRow}>
              <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>Time (~{estimatedDuration} min)</ThemedText>
              <ThemedText style={styles.fareValue}>AED {aiPricing?.timeCharge?.toFixed(2) || (estimatedDuration * selectedVehicle.perMinuteRate).toFixed(2)}</ThemedText>
            </View>
            {aiPricing?.surgeMultiplier > 1 ? (
              <View style={styles.fareRow}>
                <ThemedText style={[styles.fareLabel, { color: theme.warning }]}>Demand Adjustment</ThemedText>
                <ThemedText style={[styles.fareValue, { color: theme.warning }]}>
                  +AED {aiPricing.surgeCharge?.toFixed(2) || "0.00"}
                </ThemedText>
              </View>
            ) : null}
            <View style={[styles.fareTotalRow, { borderTopColor: theme.border }]}>
              <ThemedText style={styles.fareTotalLabel}>Total</ThemedText>
              <ThemedText style={[styles.fareTotalValue, { color: theme.primary }]}>
                AED {calculateFare(selectedVehicle)}
              </ThemedText>
            </View>
            <Pressable
              style={styles.transparencyToggle}
              onPress={() => setShowTransparency(!showTransparency)}
            >
              <Ionicons name="information-circle-outline" size={14} color={theme.primary} />
              <ThemedText style={[styles.transparencyToggleText, { color: theme.primary }]}>
                {showTransparency ? "Hide" : "Show"} price transparency
              </ThemedText>
              <Ionicons name={showTransparency ? "chevron-up" : "chevron-down"} size={14} color={theme.primary} />
            </Pressable>
            {showTransparency ? (
              <View style={[styles.transparencySection, { borderTopColor: theme.border }]}>
                <View style={styles.transparencyRow}>
                  <View style={styles.transparencyItem}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={theme.primary} />
                    <View>
                      <ThemedText style={[styles.transparencyLabel, { color: theme.textMuted }]}>Platform Fee (10%)</ThemedText>
                      <ThemedText style={styles.transparencyValue}>AED {Number(platformFee).toFixed(2)}</ThemedText>
                    </View>
                  </View>
                  <View style={styles.transparencyItem}>
                    <Ionicons name="person-outline" size={16} color={theme.success} />
                    <View>
                      <ThemedText style={[styles.transparencyLabel, { color: theme.textMuted }]}>Driver Earnings (90%)</ThemedText>
                      <ThemedText style={[styles.transparencyValue, { color: theme.success }]}>AED {Number(driverEarnings).toFixed(2)}</ThemedText>
                    </View>
                  </View>
                </View>
                <View style={[styles.blockchainBadge, { backgroundColor: theme.primary + "15" }]}>
                  <Ionicons name="lock-closed-outline" size={12} color={theme.primary} />
                  <ThemedText style={[styles.blockchainText, { color: theme.primary }]}>
                    Verified on Polygon blockchain
                  </ThemedText>
                </View>
              </View>
            ) : null}
          </>
        )}
      </Card>

      <Pressable
        style={({ pressed }) => [
          styles.bookButton,
          {
            backgroundColor: theme.primary,
            opacity: bookRideMutation.isPending ? 0.7 : pressed ? 0.9 : 1,
          },
        ]}
        onPress={handleBookRide}
        disabled={bookRideMutation.isPending}
      >
        {bookRideMutation.isPending ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <ThemedText style={styles.bookButtonText}>Book Ride</ThemedText>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  routeCard: {
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: Spacing.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  locationAddress: {
    ...Typography.body,
  },
  locationDivider: {
    paddingLeft: 5,
    paddingVertical: Spacing.xs,
  },
  verticalLine: {
    width: 2,
    height: 24,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  tripInfo: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
  },
  tripInfoItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing["2xl"],
  },
  tripInfoText: {
    ...Typography.bodyMedium,
    marginLeft: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  vehicleList: {
    paddingBottom: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  vehicleCard: {
    width: 120,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginRight: Spacing.md,
    ...Shadows.card,
  },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  vehicleName: {
    ...Typography.bodyMedium,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  vehiclePrice: {
    ...Typography.body,
    fontWeight: "700",
  },
  paymentList: {
    flexDirection: "row",
    marginBottom: Spacing["2xl"],
  },
  paymentCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginRight: Spacing.sm,
  },
  paymentName: {
    ...Typography.bodyMedium,
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
  fareCard: {
    padding: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  fareLabel: {
    ...Typography.bodyMedium,
  },
  fareValue: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  fareTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  fareTotalLabel: {
    ...Typography.h4,
  },
  fareTotalValue: {
    ...Typography.h3,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  loadingText: {
    ...Typography.body,
    marginLeft: Spacing.sm,
  },
  surgeBar: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.md,
  },
  surgeText: {
    ...Typography.small,
    fontWeight: "600",
    marginLeft: Spacing.xs,
  },
  transparencyToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
  },
  transparencyToggleText: {
    ...Typography.small,
    fontWeight: "500",
    marginHorizontal: Spacing.xs,
  },
  transparencySection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  transparencyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  transparencyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  transparencyLabel: {
    ...Typography.small,
  },
  transparencyValue: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  blockchainBadge: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  blockchainText: {
    ...Typography.small,
    fontWeight: "500",
    marginLeft: Spacing.xs,
  },
  bookButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  bookButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
});
