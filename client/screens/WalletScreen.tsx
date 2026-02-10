import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Modal, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as WebBrowser from "expo-web-browser";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import type { WalletStackParamList } from "@/navigation/WalletStackNavigator";

type NavigationProp = NativeStackNavigationProp<WalletStackParamList, "Wallet">;

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  description: string | null;
  createdAt: string;
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const queryClient = useQueryClient();

  const [topupModalVisible, setTopupModalVisible] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupMethod, setTopupMethod] = useState<"card" | "usdt">("usdt");

  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: [`/api/wallet/balance/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: transactions = [] } = useQuery<WalletTransaction[]>({
    queryKey: [`/api/wallet/transactions/${user?.id}`],
    enabled: !!user?.id,
  });

  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

  const handleCardTopup = async () => {
    if (!topupAmount || parseFloat(topupAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    
    const amount = parseFloat(topupAmount);
    setIsCreatingInvoice(true);
    
    try {
      const response = await apiRequest("/api/payments/nowpayments/wallet-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          currency: "AED",
          payVia: "card",
        }),
      });
      
      setTopupModalVisible(false);
      setTopupAmount("");
      
      if (response.invoiceUrl) {
        Alert.alert(
          "Card Payment",
          `Your payment of AED ${amount} is ready.\n\nYou will be redirected to complete the card payment securely.`,
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Pay Now", 
              onPress: () => {
                WebBrowser.openBrowserAsync(response.invoiceUrl);
              }
            }
          ]
        );
      }
    } catch (error: any) {
      if (error.message?.includes("not configured")) {
        Alert.alert("Payments Not Available", "Payment processing is being set up. Please use cash for now.");
      } else {
        Alert.alert("Error", error.message || "Failed to create payment");
      }
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleUsdtTopup = async () => {
    if (!topupAmount || parseFloat(topupAmount) <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    
    const amount = parseFloat(topupAmount);
    setIsCreatingInvoice(true);
    
    try {
      const response = await apiRequest("/api/payments/nowpayments/wallet-topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amount,
          currency: "AED",
        }),
      });
      
      setTopupModalVisible(false);
      setTopupAmount("");
      
      if (response.invoiceUrl) {
        Alert.alert(
          "USDT Payment",
          `Your payment invoice has been created.\n\nAmount: AED ${amount}\n\nYou will be redirected to complete the USDT payment.`,
          [
            { text: "Cancel", style: "cancel" },
            { 
              text: "Pay Now", 
              onPress: () => {
                WebBrowser.openBrowserAsync(response.invoiceUrl);
              }
            }
          ]
        );
      }
    } catch (error: any) {
      if (error.message?.includes("not configured")) {
        Alert.alert("USDT Not Available", "USDT crypto payments are being set up. Please use cash for now.");
      } else {
        Alert.alert("Error", error.message || "Failed to create payment invoice");
      }
    } finally {
      setIsCreatingInvoice(false);
    }
  };

  const handleTopup = () => {
    if (topupMethod === "card") {
      handleCardTopup();
    } else {
      handleUsdtTopup();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getTransactionIcon = (type: string): string => {
    switch (type) {
      case "wallet_topup":
        return "add-circle-outline";
      case "ride_payment":
        return "navigate-outline";
      case "refund":
        return "refresh-outline";
      default:
        return "cash-outline";
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "wallet_topup":
      case "refund":
        return Colors.travonyGreen;
      case "ride_payment":
        return theme.error;
      default:
        return theme.textPrimary;
    }
  };

  const balance = walletData?.balance || "0.00";

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
      <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
        <ThemedText style={styles.balanceLabel}>Travony Wallet</ThemedText>
        <ThemedText style={styles.balanceAmount}>AED {balance}</ThemedText>
        <View style={styles.balanceActions}>
          <Pressable 
            style={styles.balanceAction}
            onPress={() => setTopupModalVisible(true)}
          >
            <Ionicons name="add-outline" size={20} color="#FFFFFF" />
            <ThemedText style={styles.balanceActionText}>Add Money</ThemedText>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Payment Methods</ThemedText>
        </View>

        {/* Cash Payment */}
        <Card style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={[styles.cardIconContainer, { backgroundColor: Colors.travonyGreen + "20" }]}>
              <Ionicons name="cash-outline" size={24} color={Colors.travonyGreen} />
            </View>
            <View style={styles.paymentInfo}>
              <ThemedText style={styles.paymentTitle}>Cash</ThemedText>
              <ThemedText style={[styles.paymentSubtitle, { color: theme.textSecondary }]}>
                Pay driver directly at ride end
              </ThemedText>
            </View>
            <View style={[styles.defaultBadge, { backgroundColor: Colors.travonyGreen + "20" }]}>
              <ThemedText style={[styles.defaultText, { color: Colors.travonyGreen }]}>
                Available
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* USDT Crypto Payment */}
        <Card style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={[styles.cardIconContainer, { backgroundColor: "#26A17B20" }]}>
              <ThemedText style={{ fontSize: 12, fontWeight: "700", color: "#26A17B" }}>USDT</ThemedText>
            </View>
            <View style={styles.paymentInfo}>
              <ThemedText style={styles.paymentTitle}>USDT (Crypto)</ThemedText>
              <ThemedText style={[styles.paymentSubtitle, { color: theme.textSecondary }]}>
                Pay with cryptocurrency
              </ThemedText>
            </View>
            <View style={[styles.defaultBadge, { backgroundColor: "#26A17B20" }]}>
              <ThemedText style={[styles.defaultText, { color: "#26A17B" }]}>
                Available
              </ThemedText>
            </View>
          </View>
        </Card>

        {/* Card Payment */}
        <Card style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={[styles.cardIconContainer, { backgroundColor: "#4F46E520" }]}>
              <Ionicons name="card-outline" size={24} color="#4F46E5" />
            </View>
            <View style={styles.paymentInfo}>
              <ThemedText style={styles.paymentTitle}>Card</ThemedText>
              <ThemedText style={[styles.paymentSubtitle, { color: theme.textSecondary }]}>
                Debit or credit card
              </ThemedText>
            </View>
            <View style={[styles.defaultBadge, { backgroundColor: "#4F46E520" }]}>
              <ThemedText style={[styles.defaultText, { color: "#4F46E5" }]}>
                Available
              </ThemedText>
            </View>
          </View>
        </Card>

        <ThemedText style={[styles.paymentNote, { color: theme.textMuted }]}>
          All payment methods are powered by NOWPayments for secure transactions.
        </ThemedText>
      </View>

      {transactions.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Recent Transactions</ThemedText>
          </View>

          {transactions.slice(0, 10).map((tx) => (
            <Card key={tx.id} style={styles.transactionCard}>
              <View style={styles.transactionRow}>
                <View style={[styles.transactionIcon, { backgroundColor: getTransactionColor(tx.type) + "20" }]}>
                  <Ionicons name={getTransactionIcon(tx.type) as any} size={20} color={getTransactionColor(tx.type)} />
                </View>
                <View style={styles.transactionInfo}>
                  <ThemedText style={styles.transactionTitle}>
                    {tx.description || tx.type.replace(/_/g, " ")}
                  </ThemedText>
                  <ThemedText style={[styles.transactionDate, { color: theme.textSecondary }]}>
                    {formatDate(tx.createdAt)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.transactionAmount, { color: getTransactionColor(tx.type) }]}>
                  {tx.type === "ride_payment" ? "-" : "+"}AED {tx.amount}
                </ThemedText>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Promo Codes</ThemedText>
        </View>

        <Card
          style={styles.promoCard}
          onPress={() => navigation.navigate("PromoCode")}
        >
          <View style={styles.promoRow}>
            <View style={[styles.promoIconContainer, { backgroundColor: theme.warning + "20" }]}>
              <Ionicons name="pricetag-outline" size={24} color={theme.warning} />
            </View>
            <View style={styles.promoInfo}>
              <ThemedText style={styles.promoTitle}>Have a promo code?</ThemedText>
              <ThemedText style={[styles.promoSubtitle, { color: theme.textSecondary }]}>
                Enter your code to get discounts
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
          </View>
        </Card>
      </View>

      <Modal
        visible={topupModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setTopupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Add Money</ThemedText>
              <Pressable onPress={() => setTopupModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.paymentMethodSelector}>
              <Pressable
                style={[
                  styles.paymentMethodOption,
                  { 
                    backgroundColor: topupMethod === "usdt" ? "#26A17B20" : theme.backgroundDefault,
                    borderColor: topupMethod === "usdt" ? "#26A17B" : theme.border,
                  }
                ]}
                onPress={() => setTopupMethod("usdt")}
              >
                <ThemedText style={{ fontSize: 14, fontWeight: "700", color: topupMethod === "usdt" ? "#26A17B" : theme.textSecondary }}>USDT</ThemedText>
                <ThemedText style={[styles.paymentMethodLabel, { color: topupMethod === "usdt" ? "#26A17B" : theme.textPrimary }]}>
                  Crypto
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.paymentMethodOption,
                  { 
                    backgroundColor: topupMethod === "card" ? "#4F46E520" : theme.backgroundDefault,
                    borderColor: topupMethod === "card" ? "#4F46E5" : theme.border,
                  }
                ]}
                onPress={() => setTopupMethod("card")}
              >
                <Ionicons name="card-outline" size={24} color={topupMethod === "card" ? "#4F46E5" : theme.textSecondary} />
                <ThemedText style={[styles.paymentMethodLabel, { color: topupMethod === "card" ? "#4F46E5" : theme.textPrimary }]}>
                  Card
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
              Enter amount (AED)
            </ThemedText>
            <TextInput
              style={[styles.amountInput, { 
                backgroundColor: theme.backgroundDefault,
                color: theme.textPrimary,
                borderColor: theme.border,
              }]}
              placeholder="0.00"
              placeholderTextColor={theme.textMuted}
              keyboardType="decimal-pad"
              value={topupAmount}
              onChangeText={setTopupAmount}
            />

            <View style={styles.quickAmounts}>
              {["50", "100", "200", "500"].map((amt) => (
                <Pressable
                  key={amt}
                  style={[styles.quickAmountBtn, { 
                    backgroundColor: topupAmount === amt ? theme.primary : theme.backgroundDefault,
                    borderColor: theme.border,
                  }]}
                  onPress={() => setTopupAmount(amt)}
                >
                  <ThemedText style={[
                    styles.quickAmountText,
                    { color: topupAmount === amt ? "#fff" : theme.textPrimary }
                  ]}>
                    AED {amt}
                  </ThemedText>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.topupButton, { backgroundColor: topupMethod === "card" ? Colors.travonyGreen : "#26A17B" }]}
              onPress={handleTopup}
              disabled={isCreatingInvoice}
            >
              {isCreatingInvoice ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.topupButtonText}>
                  {topupMethod === "card" ? "Pay with Card" : "Pay with USDT"}
                </ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  balanceCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing["2xl"],
    ...Shadows.card,
  },
  balanceLabel: {
    ...Typography.bodyMedium,
    color: "rgba(255, 255, 255, 0.8)",
  },
  balanceAmount: {
    ...Typography.h1,
    color: "#FFFFFF",
    marginTop: Spacing.xs,
  },
  balanceActions: {
    flexDirection: "row",
    marginTop: Spacing.lg,
  },
  balanceAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  balanceActionText: {
    ...Typography.bodyMedium,
    color: "#FFFFFF",
    marginLeft: Spacing.sm,
    fontWeight: "600",
  },
  section: {
    marginBottom: Spacing["2xl"],
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  emptyCard: {
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyText: {
    ...Typography.body,
    marginBottom: Spacing.lg,
    textAlign: "center",
  },
  addButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  addButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  paymentCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  paymentRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  paymentInfo: {
    flex: 1,
  },
  paymentTitle: {
    ...Typography.body,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  paymentSubtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  defaultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  defaultText: {
    ...Typography.small,
    fontWeight: "600",
  },
  transactionCard: {
    marginBottom: Spacing.sm,
    padding: Spacing.md,
  },
  transactionRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    ...Typography.body,
    fontWeight: "500",
    textTransform: "capitalize",
  },
  transactionDate: {
    ...Typography.small,
    marginTop: 2,
  },
  transactionAmount: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  promoCard: {
    padding: Spacing.lg,
  },
  promoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  promoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  promoInfo: {
    flex: 1,
  },
  promoTitle: {
    ...Typography.body,
    fontWeight: "600",
  },
  promoSubtitle: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  modalTitle: {
    ...Typography.h3,
  },
  cryptoInfo: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  cryptoInfoText: {
    ...Typography.small,
  },
  modalLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  amountInput: {
    ...Typography.h2,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  quickAmounts: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.xl,
  },
  quickAmountBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  quickAmountText: {
    ...Typography.body,
    fontWeight: "500",
  },
  topupButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  topupButtonText: {
    ...Typography.button,
    color: "#fff",
  },
  paymentNote: {
    ...Typography.small,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  paymentMethodSelector: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  paymentMethodOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    gap: Spacing.sm,
  },
  paymentMethodLabel: {
    ...Typography.body,
    fontWeight: "600",
  },
});
