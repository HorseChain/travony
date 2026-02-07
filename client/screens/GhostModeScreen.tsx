import React, { useState, useEffect, useCallback } from "react";
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
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query-client";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

const VEHICLE_TYPES = [
  "economy",
  "comfort",
  "premium",
  "suv",
  "motorcycle",
  "cng_auto",
  "auto_rickshaw",
  "tuk_tuk",
];

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

interface GhostRide {
  id: number;
  status: string;
  estimatedFare: string;
  syncStatus: string;
  city: string;
  vehicleType: string;
  distance: string;
  duration: number;
  driverName?: string;
  driverPhone?: string;
  createdAt: string;
}

interface EstimateResult {
  estimatedFare: number;
  currency: string;
  breakdown?: {
    baseFare: number;
    distanceFare: number;
    timeFare: number;
  };
}

interface SyncResult {
  synced: number;
  failed: number;
  total: number;
}

export default function GhostModeScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [isOnline, setIsOnline] = useState(true);
  const [city, setCity] = useState("");
  const [selectedVehicle, setSelectedVehicle] = useState("economy");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [estimatedFare, setEstimatedFare] = useState<EstimateResult | null>(null);
  const [syncResults, setSyncResults] = useState<SyncResult | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);

  const { data: ghostRides, isLoading: ridesLoading } = useQuery<GhostRide[]>({
    queryKey: ["/api/ghost/rides"],
  });

  const estimateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ghost/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          vehicleType: selectedVehicle,
          distance: parseFloat(distance),
          duration: parseInt(duration, 10),
        }),
      });
    },
    onSuccess: (data: EstimateResult) => {
      setEstimatedFare(data);
    },
    onError: (error: Error) => {
      showAlert("Estimate Error", error.message || "Failed to get fare estimate.");
    },
  });

  const requestRideMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ghost/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          city,
          vehicleType: selectedVehicle,
          distance: parseFloat(distance),
          duration: parseInt(duration, 10),
          estimatedFare: estimatedFare?.estimatedFare,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ghost/rides"] });
      setEstimatedFare(null);
      setCity("");
      setDistance("");
      setDuration("");
      showAlert("Ghost Ride Requested", "Your ride request has been broadcast via Bluetooth mesh.");
    },
    onError: (error: Error) => {
      showAlert("Request Error", error.message || "Failed to request ghost ride.");
    },
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/ghost/sync", {
        method: "POST",
      });
    },
    onSuccess: (data: SyncResult) => {
      setSyncResults(data);
      queryClient.invalidateQueries({ queryKey: ["/api/ghost/rides"] });
    },
    onError: (error: Error) => {
      showAlert("Sync Error", error.message || "Failed to sync rides.");
    },
  });

  const showAlert = useCallback((title: string, message: string) => {
    if (Platform.OS === "web") {
      window.alert(`${title}\n\n${message}`);
    } else {
      Alert.alert(title, message);
    }
  }, []);

  const activeRide = ghostRides?.find(
    (r) => r.status === "waiting" || r.status === "accepted" || r.status === "in_progress"
  );

  const canEstimate = city.trim().length > 0 && parseFloat(distance) > 0 && parseInt(duration, 10) > 0;

  const handleRequestRide = () => {
    if (!estimatedFare) return;
    const confirmMsg = `Estimated fare: ${estimatedFare.currency || "$"}${estimatedFare.estimatedFare?.toFixed(2)}\n\nConfirm ghost ride request?`;
    if (Platform.OS === "web") {
      const confirmed = window.confirm(confirmMsg);
      if (confirmed) requestRideMutation.mutate();
    } else {
      Alert.alert("Confirm Ghost Ride", confirmMsg, [
        { text: "Cancel", style: "cancel" },
        { text: "Confirm", onPress: () => requestRideMutation.mutate() },
      ]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "waiting":
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
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
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
                ? "Connected to the internet"
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
          Ghost Mode enables ride-hailing even without internet. When you go offline, your device uses Bluetooth mesh networking to find nearby drivers.
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
              Fares pre-calculated from cached regional pricing
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

      {!isOnline ? (
        <Card style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Ionicons name="car-outline" size={22} color={theme.primary} />
            <ThemedText style={styles.sectionTitle}>Request Ghost Ride</ThemedText>
          </View>

          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            City
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={city}
            onChangeText={setCity}
            placeholder="Enter city name"
            placeholderTextColor={theme.textMuted}
          />

          <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
            Vehicle Type
          </ThemedText>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.vehicleScroll}
          >
            {VEHICLE_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.vehicleChip,
                  {
                    backgroundColor:
                      selectedVehicle === type
                        ? theme.primary
                        : theme.backgroundDefault,
                    borderColor:
                      selectedVehicle === type ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => setSelectedVehicle(type)}
              >
                <ThemedText
                  style={[
                    styles.vehicleChipText,
                    {
                      color:
                        selectedVehicle === type
                          ? Colors.light.buttonText
                          : theme.text,
                    },
                  ]}
                >
                  {VEHICLE_LABELS[type]}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.rowInputs}>
            <View style={styles.halfInput}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Distance (km)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={distance}
                onChangeText={setDistance}
                placeholder="0.0"
                placeholderTextColor={theme.textMuted}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={styles.halfInput}>
              <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
                Duration (min)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: theme.border,
                  },
                ]}
                value={duration}
                onChangeText={setDuration}
                placeholder="0"
                placeholderTextColor={theme.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>

          <Pressable
            style={[
              styles.estimateButton,
              {
                backgroundColor: theme.backgroundDefault,
                borderColor: theme.primary,
                opacity: canEstimate && !estimateMutation.isPending ? 1 : 0.5,
              },
            ]}
            onPress={() => estimateMutation.mutate()}
            disabled={!canEstimate || estimateMutation.isPending}
          >
            {estimateMutation.isPending ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <Ionicons name="calculator-outline" size={18} color={theme.primary} />
                <ThemedText style={[styles.estimateButtonText, { color: theme.primary }]}>
                  Get Fare Estimate
                </ThemedText>
              </>
            )}
          </Pressable>

          {estimatedFare ? (
            <View style={[styles.farePreview, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.fareLabel, { color: theme.textSecondary }]}>
                Estimated Fare
              </ThemedText>
              <ThemedText style={[styles.fareAmount, { color: theme.primary }]}>
                {estimatedFare.currency || "$"}
                {estimatedFare.estimatedFare?.toFixed(2)}
              </ThemedText>
              {estimatedFare.breakdown ? (
                <View style={styles.fareBreakdown}>
                  <View style={styles.fareBreakdownRow}>
                    <ThemedText style={[styles.fareBreakdownLabel, { color: theme.textMuted }]}>
                      Base fare
                    </ThemedText>
                    <ThemedText style={[styles.fareBreakdownValue, { color: theme.textSecondary }]}>
                      {estimatedFare.currency || "$"}{estimatedFare.breakdown.baseFare?.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.fareBreakdownRow}>
                    <ThemedText style={[styles.fareBreakdownLabel, { color: theme.textMuted }]}>
                      Distance
                    </ThemedText>
                    <ThemedText style={[styles.fareBreakdownValue, { color: theme.textSecondary }]}>
                      {estimatedFare.currency || "$"}{estimatedFare.breakdown.distanceFare?.toFixed(2)}
                    </ThemedText>
                  </View>
                  <View style={styles.fareBreakdownRow}>
                    <ThemedText style={[styles.fareBreakdownLabel, { color: theme.textMuted }]}>
                      Time
                    </ThemedText>
                    <ThemedText style={[styles.fareBreakdownValue, { color: theme.textSecondary }]}>
                      {estimatedFare.currency || "$"}{estimatedFare.breakdown.timeFare?.toFixed(2)}
                    </ThemedText>
                  </View>
                </View>
              ) : null}

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
          ) : null}
        </Card>
      ) : null}

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
                  {activeRide.status === "waiting"
                    ? "Waiting for Driver"
                    : activeRide.status === "accepted"
                    ? "Driver Accepted"
                    : "Ride in Progress"}
                </ThemedText>
              </View>
            </View>

            <View style={styles.activeRideDetails}>
              <View style={styles.detailRow}>
                <Ionicons name="location-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {activeRide.city}
                </ThemedText>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="speedometer-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  {activeRide.distance} km
                </ThemedText>
              </View>
              <View style={styles.detailRow}>
                <Ionicons name="cash-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  ${parseFloat(activeRide.estimatedFare).toFixed(2)}
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
            Sync your ghost rides with the server to update records and process payments.
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

          {syncResults ? (
            <View style={[styles.syncResults, { backgroundColor: theme.backgroundDefault }]}>
              <View style={styles.syncResultRow}>
                <Ionicons name="checkmark-circle" size={18} color={theme.success} />
                <ThemedText style={[styles.syncResultText, { color: theme.textSecondary }]}>
                  {syncResults.synced} rides synced
                </ThemedText>
              </View>
              {syncResults.failed > 0 ? (
                <View style={styles.syncResultRow}>
                  <Ionicons name="close-circle" size={18} color={theme.error} />
                  <ThemedText style={[styles.syncResultText, { color: theme.textSecondary }]}>
                    {syncResults.failed} rides failed
                  </ThemedText>
                </View>
              ) : null}
              <View style={styles.syncResultRow}>
                <Ionicons name="documents-outline" size={18} color={theme.textMuted} />
                <ThemedText style={[styles.syncResultText, { color: theme.textSecondary }]}>
                  {syncResults.total} total processed
                </ThemedText>
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Ionicons name="time-outline" size={22} color={theme.primary} />
          <ThemedText style={styles.sectionTitle}>Ghost Ride History</ThemedText>
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
                      {ride.city} - {VEHICLE_LABELS[ride.vehicleType] || ride.vehicleType}
                    </ThemedText>
                    <ThemedText style={styles.rideFare}>
                      ${parseFloat(ride.estimatedFare).toFixed(2)}
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

      <Card style={{ ...styles.infoCard, backgroundColor: theme.backgroundDefault }}>
        <View style={styles.infoHeader}>
          <Ionicons name="information-circle-outline" size={22} color={theme.primary} />
          <ThemedText style={[styles.infoTitle, { color: theme.primary }]}>
            About Ghost Mode
          </ThemedText>
        </View>
        <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
          When you lose internet, Ghost Mode uses Bluetooth to connect you with nearby
          drivers. Rides are synced automatically when you're back online.
        </ThemedText>
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
  inputLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
  },
  vehicleScroll: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  vehicleChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  vehicleChipText: {
    ...Typography.small,
    fontWeight: "500",
  },
  rowInputs: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  estimateButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  estimateButtonText: {
    ...Typography.button,
  },
  farePreview: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  fareLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  fareAmount: {
    fontSize: 32,
    fontWeight: "700",
  },
  fareBreakdown: {
    width: "100%",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
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
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
    width: "100%",
    gap: Spacing.sm,
  },
  requestButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
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
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  syncButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  syncResults: {
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  syncResultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  syncResultText: {
    ...Typography.bodyMedium,
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
  infoText: {
    ...Typography.bodyMedium,
    lineHeight: 20,
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
