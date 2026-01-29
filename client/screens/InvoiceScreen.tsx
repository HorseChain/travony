import React from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Share,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "Invoice">;
type RouteProps = RouteProp<HomeStackParamList, "Invoice">;

interface Ride {
  id: string;
  status: string;
  pickupAddress: string;
  dropoffAddress: string;
  estimatedFare: string | null;
  actualFare: string | null;
  distance: string | null;
  duration: number | null;
  paymentMethod: string | null;
  createdAt: string;
  completedAt: string | null;
  blockchainHash: string | null;
  platformFee: string | null;
  driverEarnings: string | null;
  currency?: string;
  currencySymbol?: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: string;
  totalAmount: string;
  currency: string;
  paymentMethod: string;
  pickupAddress: string;
  dropoffAddress: string;
  distance: string;
  duration: number;
  blockchainHash: string | null;
  createdAt: string;
}

export default function InvoiceScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();

  const { rideId } = route.params;

  const { data: ride, isLoading: rideLoading } = useQuery<Ride>({
    queryKey: ["/api/rides", rideId],
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices/ride", rideId],
    enabled: !!rideId,
  });

  const invoice = invoices.find((inv) => inv.invoiceType === "customer");

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return "0 min";
    if (minutes < 60) return `${minutes} min`;
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  const getPaymentMethodLabel = (method: string | null) => {
    switch (method) {
      case "usdt":
        return "USDT (Crypto)";
      case "cash":
        return "Cash";
      case "wallet":
        return "Wallet";
      default:
        return "Cash";
    }
  };

  const handleShare = async () => {
    if (!ride || !invoice) return;
    
    const fare = ride.actualFare || ride.estimatedFare || "0";
    const currency = invoice?.currency || ride.currencySymbol || "AED";
    const message = `Travony Ride Receipt\n\nInvoice: ${invoice.invoiceNumber}\nDate: ${formatDate(ride.completedAt || ride.createdAt)}\n\nFrom: ${ride.pickupAddress}\nTo: ${ride.dropoffAddress}\n\nDistance: ${ride.distance || "0"} km\nDuration: ${formatDuration(ride.duration)}\n\nTotal: ${currency} ${fare}\nPayment: ${getPaymentMethodLabel(ride.paymentMethod)}\n\n${ride.blockchainHash ? `Blockchain Verified: ${ride.blockchainHash.slice(0, 20)}...` : ""}`;
    
    try {
      await Share.share({ message });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const handleDone = () => {
    navigation.popToTop();
  };

  if (rideLoading || invoicesLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading invoice...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!ride) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingContainer, { paddingTop: headerHeight }]}>
          <ThemedText>Ride not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const fare = ride.actualFare || ride.estimatedFare || "0";
  const platformFee = ride.platformFee || (parseFloat(fare) * 0.1).toFixed(2);
  const driverEarnings = ride.driverEarnings || (parseFloat(fare) * 0.9).toFixed(2);
  const currencySymbol = invoice?.currency || ride.currencySymbol || "AED";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
        }}
      >
        <View style={styles.header}>
          <View style={[styles.successIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
            <Ionicons name="checkmark-circle" size={64} color={Colors.travonyGreen} />
          </View>
          <ThemedText style={styles.title}>Payment Successful</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Thank you for riding with Travony
          </ThemedText>
        </View>

        <Card style={styles.invoiceCard}>
          <View style={styles.invoiceHeader}>
            <View>
              <ThemedText style={[styles.invoiceLabel, { color: theme.textMuted }]}>
                Invoice
              </ThemedText>
              <ThemedText style={styles.invoiceNumber}>
                {invoice?.invoiceNumber || `TRV-${rideId.slice(0, 8).toUpperCase()}`}
              </ThemedText>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <ThemedText style={[styles.invoiceLabel, { color: theme.textMuted }]}>
                Date
              </ThemedText>
              <ThemedText style={styles.invoiceDate}>
                {formatDate(ride.completedAt || ride.createdAt)}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.tripSection}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textMuted }]}>
              Trip Details
            </ThemedText>
            
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: Colors.travonyGreen }]} />
              <ThemedText style={styles.locationText} numberOfLines={2}>
                {ride.pickupAddress}
              </ThemedText>
            </View>
            
            <View style={styles.locationLine}>
              <View style={[styles.dashedLine, { borderColor: theme.border }]} />
            </View>
            
            <View style={styles.locationRow}>
              <View style={[styles.locationDot, { backgroundColor: theme.error }]} />
              <ThemedText style={styles.locationText} numberOfLines={2}>
                {ride.dropoffAddress}
              </ThemedText>
            </View>

            <View style={styles.tripStats}>
              <View style={styles.statItem}>
                <Ionicons name="navigate-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                  {ride.distance || "0"} km
                </ThemedText>
              </View>
              <View style={styles.statItem}>
                <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                <ThemedText style={[styles.statText, { color: theme.textSecondary }]}>
                  {formatDuration(ride.duration)}
                </ThemedText>
              </View>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <View style={styles.paymentSection}>
            <ThemedText style={[styles.sectionLabel, { color: theme.textMuted }]}>
              Payment Summary
            </ThemedText>
            
            <View style={styles.paymentRow}>
              <ThemedText style={styles.paymentLabel}>Ride Fare</ThemedText>
              <ThemedText style={styles.paymentValue}>{currencySymbol} {fare}</ThemedText>
            </View>

            <View style={styles.paymentRow}>
              <View style={styles.paymentLabelRow}>
                <ThemedText style={styles.paymentLabel}>Payment Method</ThemedText>
              </View>
              <View style={styles.paymentMethodBadge}>
                {ride.paymentMethod === "usdt" ? (
                  <ThemedText style={{ fontSize: 11, fontWeight: "700", color: "#26A17B" }}>
                    USDT
                  </ThemedText>
                ) : (
                  <Ionicons 
                    name={ride.paymentMethod === "wallet" ? "wallet-outline" : "cash-outline"} 
                    size={14} 
                    color={Colors.travonyGreen} 
                  />
                )}
                <ThemedText style={[styles.paymentMethodText, { color: theme.textSecondary }]}>
                  {getPaymentMethodLabel(ride.paymentMethod)}
                </ThemedText>
              </View>
            </View>

            <View style={[styles.totalRow, { borderTopColor: theme.border }]}>
              <ThemedText style={styles.totalLabel}>Total Paid</ThemedText>
              <ThemedText style={[styles.totalValue, { color: Colors.travonyGreen }]}>
                {currencySymbol} {fare}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.transparencySection, { backgroundColor: theme.backgroundDefault }]}>
            <ThemedText style={[styles.transparencyTitle, { color: theme.textSecondary }]}>
              Fare Breakdown (Transparency)
            </ThemedText>
            <View style={styles.transparencyRow}>
              <ThemedText style={[styles.transparencyLabel, { color: theme.textMuted }]}>
                Driver receives (90%)
              </ThemedText>
              <ThemedText style={[styles.transparencyValue, { color: Colors.travonyGreen }]}>
                {currencySymbol} {driverEarnings}
              </ThemedText>
            </View>
            <View style={styles.transparencyRow}>
              <ThemedText style={[styles.transparencyLabel, { color: theme.textMuted }]}>
                Platform fee (10%)
              </ThemedText>
              <ThemedText style={[styles.transparencyValue, { color: theme.textSecondary }]}>
                {currencySymbol} {platformFee}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.carbonSection, { backgroundColor: "#E3F2FD" }]}>
            <View style={styles.carbonHeader}>
              <Ionicons name="leaf-outline" size={18} color="#1976D2" />
              <ThemedText style={styles.carbonTitle}>
                Carbon Footprint
              </ThemedText>
            </View>
            <View style={styles.carbonStats}>
              <View style={styles.carbonItem}>
                <ThemedText style={styles.carbonValue}>
                  {((parseFloat(ride.distance || "0") * 0.12) / 2).toFixed(2)} kg
                </ThemedText>
                <ThemedText style={styles.carbonLabel}>CO2 saved</ThemedText>
              </View>
              <View style={styles.carbonDivider} />
              <View style={styles.carbonItem}>
                <ThemedText style={[styles.carbonValue, { color: "#2E7D32" }]}>
                  50%
                </ThemedText>
                <ThemedText style={styles.carbonLabel}>reduction</ThemedText>
              </View>
            </View>
            <ThemedText style={styles.carbonNote}>
              By ridesharing, you saved CO2 emissions compared to driving alone.
            </ThemedText>
          </View>

          {ride.blockchainHash ? (
            <View style={[styles.blockchainSection, { backgroundColor: "#E8F5E9" }]}>
              <View style={styles.blockchainHeader}>
                <Ionicons name="shield-checkmark" size={18} color="#2E7D32" />
                <ThemedText style={styles.blockchainTitle}>
                  Blockchain Verified
                </ThemedText>
              </View>
              <ThemedText style={styles.blockchainHash} numberOfLines={1}>
                {ride.blockchainHash}
              </ThemedText>
              <ThemedText style={styles.blockchainNetwork}>
                Polygon Amoy Testnet
              </ThemedText>
            </View>
          ) : null}
        </Card>

        <View style={styles.actions}>
          <Pressable
            style={[styles.shareButton, { borderColor: theme.border }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={theme.textPrimary} />
            <ThemedText style={styles.shareButtonText}>Share Receipt</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.doneButton, { backgroundColor: Colors.travonyGreen }]}
            onPress={handleDone}
          >
            <ThemedText style={styles.doneButtonText}>Done</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    ...Typography.body,
  },
  header: {
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h2,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    ...Typography.body,
  },
  invoiceCard: {
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  invoiceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  invoiceLabel: {
    ...Typography.small,
    marginBottom: 4,
  },
  invoiceNumber: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  invoiceDate: {
    ...Typography.body,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.lg,
  },
  tripSection: {
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.small,
    textTransform: "uppercase",
    marginBottom: Spacing.md,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: Spacing.md,
  },
  locationText: {
    ...Typography.body,
    flex: 1,
  },
  locationLine: {
    paddingLeft: 4,
    paddingVertical: 4,
  },
  dashedLine: {
    width: 2,
    height: 20,
    borderStyle: "dashed",
    borderWidth: 1,
  },
  tripStats: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    gap: Spacing.xl,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  statText: {
    ...Typography.small,
  },
  paymentSection: {
    marginBottom: Spacing.sm,
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  paymentLabelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  paymentLabel: {
    ...Typography.body,
  },
  paymentValue: {
    ...Typography.body,
    fontWeight: "500",
  },
  paymentMethodBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  paymentMethodText: {
    ...Typography.body,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Spacing.md,
    marginTop: Spacing.sm,
    borderTopWidth: 1,
  },
  totalLabel: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  totalValue: {
    ...Typography.h3,
    fontWeight: "700",
  },
  transparencySection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  transparencyTitle: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  transparencyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  transparencyLabel: {
    ...Typography.small,
  },
  transparencyValue: {
    ...Typography.small,
    fontWeight: "600",
  },
  blockchainSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  blockchainHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  blockchainTitle: {
    ...Typography.small,
    fontWeight: "600",
    color: "#2E7D32",
  },
  blockchainHash: {
    ...Typography.small,
    fontFamily: "monospace",
    color: "#1B5E20",
  },
  blockchainNetwork: {
    ...Typography.small,
    color: "#4CAF50",
    marginTop: 4,
  },
  carbonSection: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  carbonHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  carbonTitle: {
    ...Typography.small,
    fontWeight: "600",
    color: "#1976D2",
  },
  carbonStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  carbonItem: {
    alignItems: "center",
  },
  carbonValue: {
    ...Typography.h3,
    fontWeight: "700",
    color: "#1976D2",
  },
  carbonLabel: {
    ...Typography.caption,
    color: "#64B5F6",
  },
  carbonDivider: {
    width: 1,
    height: 30,
    backgroundColor: "#BBDEFB",
  },
  carbonNote: {
    ...Typography.caption,
    color: "#42A5F5",
    textAlign: "center",
  },
  actions: {
    gap: Spacing.md,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  shareButtonText: {
    ...Typography.button,
  },
  doneButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  doneButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
});
