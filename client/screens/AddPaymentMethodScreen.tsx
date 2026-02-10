import React from "react";
import { View, StyleSheet, Pressable, Linking, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

export default function AddPaymentMethodScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  const paymentOptions = [
    {
      id: "cash",
      title: "Cash",
      subtitle: "Pay your driver directly at the end of your ride. No setup needed.",
      icon: "cash-outline" as const,
      color: Colors.travonyGreen,
      status: "Always available",
    },
    {
      id: "usdt",
      title: "USDT (Crypto)",
      subtitle: "Pay with USDT stablecoin. Low fees (0.5%), fast transactions, powered by NOWPayments.",
      icon: "logo-usd" as const,
      color: "#26A17B",
      status: "Available",
    },
  ];

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.scrollContent,
          {
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing["3xl"],
          },
        ]}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.primary + "10" }]}>
          <Ionicons name="shield-checkmark-outline" size={24} color={theme.primary} />
          <View style={styles.infoCardText}>
            <ThemedText style={[styles.infoTitle, { color: theme.primary }]}>
              Secure Payments
            </ThemedText>
            <ThemedText style={[styles.infoSubtitle, { color: theme.textSecondary }]}>
              All crypto payments are processed securely through NOWPayments. Your payment details are never stored on our servers.
            </ThemedText>
          </View>
        </View>

        {paymentOptions.map((option) => (
          <Card key={option.id} style={styles.optionCard}>
            <View style={styles.optionRow}>
              <View style={[styles.optionIcon, { backgroundColor: option.color + "15" }]}>
                <Ionicons name={option.icon} size={28} color={option.color} />
              </View>
              <View style={styles.optionInfo}>
                <ThemedText style={styles.optionTitle}>{option.title}</ThemedText>
                <ThemedText style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                  {option.subtitle}
                </ThemedText>
                <View style={[styles.statusBadge, { backgroundColor: option.color + "15" }]}>
                  <View style={[styles.statusDot, { backgroundColor: option.color }]} />
                  <ThemedText style={[styles.statusText, { color: option.color }]}>
                    {option.status}
                  </ThemedText>
                </View>
              </View>
            </View>
          </Card>
        ))}

        <View style={styles.feeSection}>
          <ThemedText style={[styles.feeSectionTitle, { color: theme.textPrimary }]}>
            Fee Structure
          </ThemedText>
          <View style={[styles.feeRow, { borderBottomColor: theme.border }]}>
            <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>Cash</ThemedText>
            <ThemedText style={[styles.feeValue, { color: Colors.travonyGreen }]}>No fees</ThemedText>
          </View>
          <View style={styles.feeRow}>
            <ThemedText style={[styles.feeLabel, { color: theme.textSecondary }]}>USDT</ThemedText>
            <ThemedText style={[styles.feeValue, { color: theme.textPrimary }]}>0.5% processing fee</ThemedText>
          </View>
        </View>

        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back-outline" size={20} color={theme.primary} />
          <ThemedText style={[styles.backButtonText, { color: theme.primary }]}>
            Back to Wallet
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  infoCard: {
    flexDirection: "row",
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing["2xl"],
    gap: Spacing.md,
    alignItems: "flex-start",
  },
  infoCardText: {
    flex: 1,
  },
  infoTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  infoSubtitle: {
    ...Typography.small,
    lineHeight: 18,
  },
  optionCard: {
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  optionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  optionInfo: {
    flex: 1,
  },
  optionTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  optionSubtitle: {
    ...Typography.small,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Typography.small,
    fontWeight: "600",
  },
  feeSection: {
    marginTop: Spacing.lg,
    marginBottom: Spacing["2xl"],
  },
  feeSectionTitle: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    marginBottom: Spacing.md,
  },
  feeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  feeLabel: {
    ...Typography.body,
  },
  feeValue: {
    ...Typography.body,
    fontWeight: "600",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  backButtonText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
