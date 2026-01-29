import React, { useState } from "react";
import { View, StyleSheet, TextInput, Pressable, FlatList, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface AppliedCoupon {
  id: string;
  code: string;
  discountType: string;
  discountValue: string;
  expiresAt: string | null;
}

export default function PromoCodeScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();

  const [promoCode, setPromoCode] = useState("");
  const [appliedCoupons, setAppliedCoupons] = useState<AppliedCoupon[]>([]);

  const applyCodeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/coupons/validate?code=${promoCode}`, {
        method: "GET",
      });
    },
    onSuccess: (data) => {
      if (data && data.code) {
        if (appliedCoupons.find(c => c.code === data.code)) {
          Alert.alert("Already Applied", "This promo code is already applied.");
          return;
        }
        setAppliedCoupons([...appliedCoupons, data]);
        setPromoCode("");
        Alert.alert("Success", "Promo code applied successfully!");
      }
    },
    onError: (error: any) => {
      Alert.alert("Invalid Code", error.message || "This promo code is invalid or expired.");
    },
  });

  const handleApplyCode = () => {
    if (!promoCode.trim()) {
      Alert.alert("Error", "Please enter a promo code");
      return;
    }
    applyCodeMutation.mutate();
  };

  const handleRemoveCoupon = (couponId: string) => {
    setAppliedCoupons(appliedCoupons.filter(c => c.id !== couponId));
  };

  const formatExpiry = (dateString: string | null) => {
    if (!dateString) return "No expiry";
    const date = new Date(dateString);
    return `Expires ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  const formatDiscount = (type: string, value: string) => {
    if (type === "percentage") {
      return `${value}% off`;
    }
    return `AED ${value} off`;
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: headerHeight + Spacing.lg }]}>
        <View style={styles.inputSection}>
          <View
            style={[
              styles.inputContainer,
              { backgroundColor: theme.backgroundDefault, borderColor: theme.border },
            ]}
          >
            <Ionicons name="pricetag-outline" size={20} color={theme.textMuted} />
            <TextInput
              style={[styles.input, { color: theme.text }]}
              placeholder="Enter promo code"
              placeholderTextColor={theme.textMuted}
              value={promoCode}
              onChangeText={setPromoCode}
              autoCapitalize="characters"
            />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.applyButton,
              {
                backgroundColor: theme.primary,
                opacity: applyCodeMutation.isPending ? 0.7 : pressed ? 0.9 : 1,
              },
            ]}
            onPress={handleApplyCode}
            disabled={applyCodeMutation.isPending}
          >
            {applyCodeMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <ThemedText style={styles.applyButtonText}>Apply</ThemedText>
            )}
          </Pressable>
        </View>

        {appliedCoupons.length > 0 && (
          <View style={styles.appliedSection}>
            <ThemedText style={styles.sectionTitle}>Applied Codes</ThemedText>
            <FlatList
              data={appliedCoupons}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Card style={styles.couponCard}>
                  <View style={styles.couponRow}>
                    <View style={[styles.couponIcon, { backgroundColor: theme.success + "20" }]}>
                      <Ionicons name="checkmark-circle-outline" size={20} color={theme.success} />
                    </View>
                    <View style={styles.couponInfo}>
                      <ThemedText style={styles.couponCode}>{item.code}</ThemedText>
                      <View style={styles.couponDetails}>
                        <ThemedText style={[styles.couponDiscount, { color: theme.primary }]}>
                          {formatDiscount(item.discountType, item.discountValue)}
                        </ThemedText>
                        <ThemedText style={[styles.couponExpiry, { color: theme.textMuted }]}>
                          {formatExpiry(item.expiresAt)}
                        </ThemedText>
                      </View>
                    </View>
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => handleRemoveCoupon(item.id)}
                    >
                      <Ionicons name="close-outline" size={20} color={theme.error} />
                    </Pressable>
                  </View>
                </Card>
              )}
              scrollEnabled={false}
            />
          </View>
        )}

        <View style={styles.infoSection}>
          <View style={[styles.infoIcon, { backgroundColor: theme.primary + "20" }]}>
            <Ionicons name="information-circle-outline" size={24} color={theme.primary} />
          </View>
          <ThemedText style={styles.infoTitle}>How to use promo codes</ThemedText>
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Enter your promo code above to apply discounts to your next ride.
            Promo codes are automatically applied at checkout.
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  inputSection: {
    flexDirection: "row",
    marginBottom: Spacing["2xl"],
  },
  inputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    marginRight: Spacing.md,
  },
  input: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.body,
  },
  applyButton: {
    paddingHorizontal: Spacing["2xl"],
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  applyButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  appliedSection: {
    marginBottom: Spacing["2xl"],
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  couponCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  couponRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  couponIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  couponInfo: {
    flex: 1,
  },
  couponCode: {
    ...Typography.body,
    fontWeight: "700",
  },
  couponDetails: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  couponDiscount: {
    ...Typography.small,
    fontWeight: "600",
    marginRight: Spacing.md,
  },
  couponExpiry: {
    ...Typography.small,
  },
  removeButton: {
    padding: Spacing.sm,
  },
  infoSection: {
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  infoIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  infoTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  infoText: {
    ...Typography.body,
    textAlign: "center",
  },
});
