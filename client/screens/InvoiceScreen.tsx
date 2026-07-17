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
  pickupLat?: string;
  pickupLng?: string;
  dropoffLat?: string;
  dropoffLng?: string;
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
    const message = `Travony Route Receipt\n\nInvoice: ${invoice.invoiceNumber}\nDate: ${formatDate(ride.completedAt || ride.createdAt)}\n\nFrom: ${ride.pickupAddress}\nTo: ${ride.dropoffAddress}\n\nDistance: ${ride.distance || "0"} km\nDuration: ${formatDuration(ride.duration)}\n\nTotal: ${currency} ${fare}\nPayment: ${getPaymentMethodLabel(ride.paymentMethod)}\n\n${ride.blockchainHash ? `Blockchain Verified: ${ride.blockchainHash.slice(0, 20)}...` : ""}`;
    
    try {
      await Share.share({ message });
    } catch (error) {
      console.log("Share error:", error);
    }
  };

  const handleDone = () => {
    navigation.popToTop();
  };

  const handleBookAgain = () => {
    if (!ride) return;
    navigation.navigate("Home", {
      selectedLocation: {
        type: "dropoff",
        address: ride.dropoffAddress,
        lat: parseFloat(ride.dropoffLat || "0"),
        lng: parseFloat(ride.dropoffLng || "0"),
      },
      selectedPickup: {
        address: ride.pickupAddress,
        lat: parseFloat(ride.pickupLat || "0"),
        lng: parseFloat(ride.pickupLng || "0"),
      },
    });
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
          <ThemedText>Route not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const fare = ride.actualFare || ride.estimatedFare || "0";
  const platformFee = ride.platformFee || (parseFloat(fare) * 0.1).toFixed(2);
  const driverEarnings = ride.driverEarnings || (parseFloat(fare) * 0.9).toFixed(2);
  const currencySymbol = invoice?.currency || ride.currencySymbol || "AED";
  const blockchainShort = ride.blockchainHash ? ride.blockchainHash.slice(0, 8) : null;

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
              <ThemedText style={styles.paymentLabel}>Route Fare</ThemedText>
              <ThemedText style={styles.paymentValue}>{currencySymbol} {fare}</ThemedText>
            </View>

            <View style={styles.paymentRow}>
              <View style={styles.paymentLabelRow}>
                <ThemedText style={styles.paymentLabel}>Payment Method</ThemedText>
              </View>
              <View style={styles.paymentMethodBadge}>
                {ride.paymentMethod === "usdt" ? (
                  <ThemedText style={{ ...Typography.smallHeavy, color: theme.crypto }}>
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
            <View style={[styles.verifiedRow, { borderTopColor: theme.border + "60" }]}>
              <Ionicons name="link-outline" size={13} color={theme.textMuted} />
              <ThemedText style={[styles.verifiedText, { color: theme.textMuted }]}>
                {blockchainShort
                  ? `Verified by Travony Network · ${blockchainShort}`
                  : "Verified by Travony Network"}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.carbonSection, { backgroundColor: theme.evGreen + "15", borderColor: theme.evGreen + "30", borderWidth: 1 }]}>
            <View style={styles.carbonHeader}>
              <Ionicons name="leaf-outline" size={18} color={theme.evGreen} />
              <ThemedText style={[styles.carbonTitle, { color: theme.evGreen }]}>
                Carbon Footprint
              </ThemedText>
            </View>
            <View style={styles.carbonStats}>
              <View style={styles.carbonItem}>
                <ThemedText style={[styles.carbonValue, { color: theme.evGreen }]}>
                  {((parseFloat(ride.distance || "0") * 0.12) / 2).toFixed(2)} kg
                </ThemedText>
                <ThemedText style={[styles.carbonLabel, { color: theme.textSecondary }]}>CO2 saved</ThemedText>
              </View>
              <View style={[styles.carbonDivider, { backgroundColor: theme.border }]} />
              <View style={styles.carbonItem}>
                <ThemedText style={[styles.carbonValue, { color: theme.evGreen }]}>
                  50%
                </ThemedText>
                <ThemedText style={[styles.carbonLabel, { color: theme.textSecondary }]}>reduction</ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.carbonNote, { color: theme.textMuted }]}>
              By using shared mobility, you saved CO2 emissions compared to driving alone.
            </ThemedText>
          </View>

          {ride.blockchainHash ? (
            <View style={[styles.blockchainSection, { backgroundColor: theme.blockchain + "15", borderColor: theme.blockchain + "30", borderWidth: 1 }]}>
              <View style={styles.blockchainHeader}>
                <Ionicons name="shield-checkmark" size={18} color={theme.blockchain} />
                <ThemedText style={[styles.blockchainTitle, { color: theme.blockchain }]}>
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
            style={[styles.bookAgainButton, { backgroundColor: theme.primary }]}
            onPress={handleBookAgain}
          >
            <Ionicons name="repeat-outline" size={18} color={theme.textOnPrimary} />
            <ThemedText style={styles.bookAgainButtonText}>Book this trip again</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.shareButton, { borderColor: theme.border }]}
            onPress={handleShare}
          >
            <Ionicons name="share-outline" size={20} color={theme.textPrimary} />
            <ThemedText style={styles.shareButtonText}>Share Receipt</ThemedText>
          </Pressable>

          <Pressable
            style={[styles.doneButton, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}
            onPress={handleDone}
          >
            <ThemedText style={[styles.doneButtonText, { color: theme.textSecondary }]}>Done</ThemedText>
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
    ...Typography.bodyBold,
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
    ...Typography.bodySmallMedium,
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
    ...Typography.bodyBold,
  },
  totalValue: {
    ...Typography.h3Heavy,
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
    ...Typography.smallBold,
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
  },
  verifiedText: {
    ...Typography.caption,
    fontStyle: "italic",
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
    ...Typography.smallBold,
    color: Colors.light.blockchain,
  },
  blockchainHash: {
    ...Typography.small,
    fontFamily: "monospace",
    color: Colors.light.blockchain,
  },
  blockchainNetwork: {
    ...Typography.small,
    color: Colors.light.blockchain,
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
    ...Typography.smallBold,
    color: Colors.light.evGreen,
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
    ...Typography.h3Heavy,
    color: Colors.light.evGreen,
  },
  carbonLabel: {
    ...Typography.caption,
    color: Colors.light.evGreen,
  },
  carbonDivider: {
    width: 1,
    height: 30,
    backgroundColor: Colors.light.evGreen + "40",
  },
  carbonNote: {
    ...Typography.caption,
    color: Colors.light.evGreen,
    textAlign: "center",
  },
  actions: {
    gap: Spacing.md,
  },
  bookAgainButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  bookAgainButtonText: {
    ...Typography.button,
    color: Colors.light.textOnPrimary,
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
    borderWidth: 1,
  },
  doneButtonText: {
    ...Typography.button,
  },
});
