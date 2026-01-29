import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Linking, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRoute } from "@react-navigation/native";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import type { BookingsStackParamList } from "@/navigation/BookingsStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type RouteProps = RouteProp<BookingsStackParamList, "RideDetails">;

interface Ride {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: string | null;
  actualFare: string | null;
  distance: string | null;
  duration: string | null;
  surgeMultiplier: string | null;
  createdAt: string;
  blockchainHash: string | null;
  blockchainTxHash: string | null;
  platformFee: string | null;
  driverEarnings: string | null;
}

const statusColors: Record<string, string> = {
  completed: "#43A047",
  cancelled: "#E53935",
  pending: "#FB8C00",
  accepted: "#00B14F",
  in_progress: "#00B14F",
};

export default function RideDetailsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const route = useRoute<RouteProps>();

  const { rideId } = route.params;

  const { data: ride } = useQuery<Ride>({
    queryKey: ["/api/rides", rideId],
  });

  interface Invoice {
    id: string;
    invoiceType: string;
    invoiceNumber: string;
  }
  
  const { data: invoices, isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices/ride", rideId],
    enabled: ride?.status === "completed",
  });

  const customerInvoice = invoices?.find(inv => inv.invoiceType === "customer");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const handleGetReceipt = async () => {
    if (ride?.status !== "completed") {
      Alert.alert("Not Available", "Receipt is only available for completed rides.");
      return;
    }

    if (customerInvoice) {
      const invoiceUrl = new URL(`/api/invoices/${customerInvoice.id}/html`, getApiUrl()).toString();
      try {
        await WebBrowser.openBrowserAsync(invoiceUrl);
      } catch (error) {
        Linking.openURL(invoiceUrl);
      }
    } else {
      Alert.alert("Receipt", "Your receipt is being generated. Please check back soon.");
    }
  };

  const handleReportIssue = () => {
    Alert.alert("Report Issue", "Please contact support for any issues.");
  };

  if (!ride) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={styles.loadingContainer}>
          <ThemedText>Loading...</ThemedText>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing["3xl"],
        paddingHorizontal: Spacing.lg,
      }}
    >
      <View style={styles.statusHeader}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: (statusColors[ride.status] || theme.primary) + "20" },
          ]}
        >
          <ThemedText
            style={[
              styles.statusText,
              { color: statusColors[ride.status] || theme.primary },
            ]}
          >
            {ride.status.replace("_", " ").toUpperCase()}
          </ThemedText>
        </View>
        <ThemedText style={[styles.dateText, { color: theme.textSecondary }]}>
          {formatDate(ride.createdAt)}
        </ThemedText>
      </View>

      <Card style={styles.routeCard}>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.primary }]} />
          <View style={styles.locationInfo}>
            <ThemedText style={[styles.locationLabel, { color: theme.textMuted }]}>
              Pickup
            </ThemedText>
            <ThemedText style={styles.locationAddress}>{ride.pickupAddress}</ThemedText>
          </View>
        </View>
        <View style={styles.locationDivider}>
          <View style={[styles.verticalLine, { borderColor: theme.border }]} />
        </View>
        <View style={styles.locationRow}>
          <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
          <View style={styles.locationInfo}>
            <ThemedText style={[styles.locationLabel, { color: theme.textMuted }]}>
              Drop-off
            </ThemedText>
            <ThemedText style={styles.locationAddress}>{ride.dropoffAddress}</ThemedText>
          </View>
        </View>
      </Card>

      <Card style={styles.detailsCard}>
        <ThemedText style={styles.cardTitle}>Trip Details</ThemedText>
        <View style={styles.detailRow}>
          <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
            Distance
          </ThemedText>
          <ThemedText style={styles.detailValue}>{ride.distance || "0"} km</ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
            Duration
          </ThemedText>
          <ThemedText style={styles.detailValue}>{ride.duration || "0"} min</ThemedText>
        </View>
        {ride.surgeMultiplier && parseFloat(ride.surgeMultiplier) > 1 && (
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: theme.warning }]}>
              Surge Pricing
            </ThemedText>
            <ThemedText style={[styles.detailValue, { color: theme.warning }]}>
              x{ride.surgeMultiplier}
            </ThemedText>
          </View>
        )}
      </Card>

      <Card style={styles.detailsCard}>
        <ThemedText style={styles.cardTitle}>Payment</ThemedText>
        <View style={styles.detailRow}>
          <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
            Estimated Fare
          </ThemedText>
          <ThemedText style={styles.detailValue}>
            AED {ride.estimatedFare || "0.00"}
          </ThemedText>
        </View>
        {ride.actualFare && (
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
              Actual Fare
            </ThemedText>
            <ThemedText style={styles.detailValue}>AED {ride.actualFare}</ThemedText>
          </View>
        )}
        <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
          <ThemedText style={styles.totalLabel}>Total Paid</ThemedText>
          <ThemedText style={[styles.totalValue, { color: theme.primary }]}>
            AED {ride.actualFare || ride.estimatedFare || "0.00"}
          </ThemedText>
        </View>
      </Card>

      {ride.status === "completed" && ride.blockchainHash && (
        <Card style={styles.detailsCard}>
          <View style={styles.blockchainHeader}>
            <View style={[styles.blockchainIcon, { backgroundColor: "#8247E5" + "20" }]}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#8247E5" />
            </View>
            <ThemedText style={styles.cardTitle}>Blockchain Verified</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
              Network
            </ThemedText>
            <ThemedText style={styles.detailValue}>Polygon Amoy</ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
              Platform Fee (10%)
            </ThemedText>
            <ThemedText style={styles.detailValue}>
              AED {ride.platformFee || "0.00"}
            </ThemedText>
          </View>
          
          <View style={styles.detailRow}>
            <ThemedText style={[styles.detailLabel, { color: theme.textSecondary }]}>
              Driver Earnings (90%)
            </ThemedText>
            <ThemedText style={[styles.detailValue, { color: theme.primary }]}>
              AED {ride.driverEarnings || "0.00"}
            </ThemedText>
          </View>
          
          <View style={styles.hashContainer}>
            <ThemedText style={[styles.hashLabel, { color: theme.textSecondary }]}>
              Ride Hash
            </ThemedText>
            <ThemedText style={[styles.hashValue, { color: theme.textMuted }]} numberOfLines={1}>
              {ride.blockchainHash}
            </ThemedText>
          </View>
          
          {ride.blockchainTxHash && (
            <View style={styles.hashContainer}>
              <ThemedText style={[styles.hashLabel, { color: theme.textSecondary }]}>
                Transaction
              </ThemedText>
              <ThemedText style={[styles.hashValue, { color: theme.textMuted }]} numberOfLines={1}>
                {ride.blockchainTxHash}
              </ThemedText>
            </View>
          )}
          
          <Pressable
            style={({ pressed }) => [
              styles.verifyButton,
              { backgroundColor: "#8247E5", opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              const url = ride.blockchainTxHash
                ? `https://amoy.polygonscan.com/tx/${ride.blockchainTxHash}`
                : `https://amoy.polygonscan.com/address/0xA8C20314004FEA3bE339f73cE4E192eCAaA062Ec`;
              Linking.openURL(url);
            }}
          >
            <Ionicons name="open-outline" size={16} color="#FFFFFF" />
            <ThemedText style={styles.verifyButtonText}>
              Verify on PolygonScan
            </ThemedText>
          </Pressable>
        </Card>
      )}

      <View style={styles.actionsContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleGetReceipt}
        >
          <Ionicons name="document-text-outline" size={20} color={theme.primary} />
          <ThemedText style={[styles.actionText, { color: theme.primary }]}>
            Get Receipt
          </ThemedText>
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={handleReportIssue}
        >
          <Ionicons name="alert-circle-outline" size={20} color={theme.error} />
          <ThemedText style={[styles.actionText, { color: theme.error }]}>
            Report Issue
          </ThemedText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  statusBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "700",
  },
  dateText: {
    ...Typography.small,
  },
  routeCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
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
  detailsCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    ...Typography.h4,
    marginBottom: Spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  detailLabel: {
    ...Typography.body,
  },
  detailValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  totalLabel: {
    ...Typography.h4,
  },
  totalValue: {
    ...Typography.h3,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.xs,
  },
  actionText: {
    ...Typography.body,
    marginLeft: Spacing.sm,
    fontWeight: "500",
  },
  blockchainHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  blockchainIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  hashContainer: {
    marginTop: Spacing.md,
  },
  hashLabel: {
    ...Typography.small,
    marginBottom: Spacing.xs,
  },
  hashValue: {
    ...Typography.small,
    fontFamily: "monospace",
  },
  verifyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  verifyButtonText: {
    ...Typography.body,
    color: "#FFFFFF",
    fontWeight: "600",
    marginLeft: Spacing.sm,
  },
});
