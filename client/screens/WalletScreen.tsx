import React, { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, TextInput, Modal, Platform, Linking } from "react-native";
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

const HRS_COLOR = "#8B4513";
const HRS_COLOR_LIGHT = "#D2691E";

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  description: string | null;
  createdAt: string;
}

interface HrsBalanceData {
  linked: boolean;
  balance?: string;
  balanceFormatted?: string;
  walletAddress?: string;
  tokenInfo: {
    name: string;
    symbol: string;
    contractAddress: string;
    etherscanUrl: string;
  };
  message?: string;
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
  const [topupMethod, setTopupMethod] = useState<"usdt">("usdt");
  const [hrsModalVisible, setHrsModalVisible] = useState(false);
  const [ethAddress, setEthAddress] = useState("");
  const [isLinkingWallet, setIsLinkingWallet] = useState(false);

  const { data: walletData } = useQuery<{ balance: string }>({
    queryKey: [`/api/wallet/balance/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: transactions = [] } = useQuery<WalletTransaction[]>({
    queryKey: [`/api/wallet/transactions/${user?.id}`],
    enabled: !!user?.id,
  });

  const { data: hrsData, refetch: refetchHrs } = useQuery<HrsBalanceData>({
    queryKey: ["/api/wallet/hrs-balance"],
    enabled: !!user?.id,
  });

  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false);

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
        body: JSON.stringify({ amount, currency: "AED" }),
      });
      setTopupModalVisible(false);
      setTopupAmount("");
      if (response.invoiceUrl) {
        Alert.alert(
          "USDT Payment",
          `Your payment invoice has been created.\n\nAmount: AED ${amount}\n\nYou will be redirected to complete the USDT payment.`,
          [
            { text: "Cancel", style: "cancel" },
            { text: "Pay Now", onPress: () => { WebBrowser.openBrowserAsync(response.invoiceUrl); } }
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
    handleUsdtTopup();
  };

  const handleLinkEthWallet = async () => {
    if (!ethAddress.trim()) {
      Alert.alert("Error", "Please enter your Ethereum wallet address");
      return;
    }
    setIsLinkingWallet(true);
    try {
      const response = await apiRequest("/api/wallet/link-eth-wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ethWalletAddress: ethAddress.trim() }),
      });
      setHrsModalVisible(false);
      setEthAddress("");
      queryClient.invalidateQueries({ queryKey: ["/api/wallet/hrs-balance"] });
      Alert.alert(
        "Wallet Linked",
        `Your Ethereum wallet is linked.\n\nHRS Balance: ${response.hrsBalanceFormatted} HRS`,
      );
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to link wallet");
    } finally {
      setIsLinkingWallet(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const getTransactionIcon = (type: string): string => {
    switch (type) {
      case "wallet_topup": return "add-circle-outline";
      case "ride_payment": return "navigate-outline";
      case "refund": return "refresh-outline";
      default: return "cash-outline";
    }
  };

  const getTransactionColor = (type: string) => {
    switch (type) {
      case "wallet_topup":
      case "refund": return Colors.travonyGreen;
      case "ride_payment": return theme.error;
      default: return theme.textPrimary;
    }
  };

  const balance = walletData?.balance || "0.00";
  const hrsBalance = hrsData?.balanceFormatted || "0.00";
  const hrsLinked = hrsData?.linked === true;

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
      {/* Main AED Wallet */}
      <View style={[styles.balanceCard, { backgroundColor: theme.primary }]}>
        <ThemedText style={styles.balanceLabel}>Travony Wallet</ThemedText>
        <ThemedText style={styles.balanceAmount}>AED {balance}</ThemedText>
        <View style={styles.balanceActions}>
          <Pressable style={styles.balanceAction} onPress={() => setTopupModalVisible(true)}>
            <Ionicons name="add-outline" size={20} color={theme.textOnPrimary} />
            <ThemedText style={styles.balanceActionText}>Add Money</ThemedText>
          </Pressable>
        </View>
      </View>

      {/* HRS Token Card */}
      <Pressable
        style={[styles.hrsCard, { backgroundColor: HRS_COLOR }]}
        onPress={() => {
          if (hrsLinked && hrsData?.tokenInfo?.etherscanUrl) {
            WebBrowser.openBrowserAsync(hrsData.tokenInfo.etherscanUrl);
          } else {
            setHrsModalVisible(true);
          }
        }}
      >
        <View style={styles.hrsCardLeft}>
          <View style={styles.hrsIconRow}>
            <View style={styles.hrsIcon}>
              <ThemedText style={styles.hrsIconText}>HC</ThemedText>
            </View>
            <View style={styles.hrsTagBadge}>
              <ThemedText style={styles.hrsTagText}>ERC-20</ThemedText>
            </View>
          </View>
          <ThemedText style={styles.hrsLabel}>HorseChain Token</ThemedText>
          <ThemedText style={styles.hrsAmount}>{hrsBalance} HRS</ThemedText>
          {hrsLinked && hrsData?.walletAddress ? (
            <ThemedText style={styles.hrsAddress} numberOfLines={1}>
              {hrsData.walletAddress.slice(0, 8)}...{hrsData.walletAddress.slice(-6)}
            </ThemedText>
          ) : (
            <ThemedText style={styles.hrsLinkPrompt}>Tap to link Ethereum wallet</ThemedText>
          )}
        </View>
        <View style={styles.hrsCardRight}>
          <Ionicons
            name={hrsLinked ? "open-outline" : "link-outline"}
            size={24}
            color="rgba(255,255,255,0.8)"
          />
          {hrsLinked && (
            <Pressable
              style={styles.hrsUnlinkBtn}
              onPress={() => setHrsModalVisible(true)}
            >
              <ThemedText style={styles.hrsUnlinkText}>Change</ThemedText>
            </Pressable>
          )}
        </View>
      </Pressable>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <ThemedText style={styles.sectionTitle}>Payment Methods</ThemedText>
        </View>

        {/* Cash */}
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
              <ThemedText style={[styles.defaultText, { color: Colors.travonyGreen }]}>Available</ThemedText>
            </View>
          </View>
        </Card>

        {/* USDT */}
        <Card style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={[styles.cardIconContainer, { backgroundColor: theme.crypto + "20" }]}>
              <ThemedText style={{ ...Typography.smallHeavy, color: theme.crypto }}>USDT</ThemedText>
            </View>
            <View style={styles.paymentInfo}>
              <ThemedText style={styles.paymentTitle}>USDT (Crypto)</ThemedText>
              <ThemedText style={[styles.paymentSubtitle, { color: theme.textSecondary }]}>
                Pay with Tether on Polygon
              </ThemedText>
            </View>
            <View style={[styles.defaultBadge, { backgroundColor: theme.crypto + "20" }]}>
              <ThemedText style={[styles.defaultText, { color: theme.crypto }]}>Available</ThemedText>
            </View>
          </View>
        </Card>

        {/* HRS */}
        <Card style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={[styles.cardIconContainer, { backgroundColor: HRS_COLOR + "20" }]}>
              <ThemedText style={{ ...Typography.smallHeavy, color: HRS_COLOR_LIGHT }}>HRS</ThemedText>
            </View>
            <View style={styles.paymentInfo}>
              <ThemedText style={styles.paymentTitle}>HorseChain (HRS)</ThemedText>
              <ThemedText style={[styles.paymentSubtitle, { color: theme.textSecondary }]}>
                {hrsLinked ? `Balance: ${hrsBalance} HRS` : "Link your Ethereum wallet to use"}
              </ThemedText>
            </View>
            <Pressable
              style={[styles.defaultBadge, { backgroundColor: HRS_COLOR + "20" }]}
              onPress={() => setHrsModalVisible(true)}
            >
              <ThemedText style={[styles.defaultText, { color: HRS_COLOR_LIGHT }]}>
                {hrsLinked ? "Linked" : "Link"}
              </ThemedText>
            </Pressable>
          </View>
        </Card>

        {/* Card */}
        <Card style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <View style={[styles.cardIconContainer, { backgroundColor: theme.blockchain + "20" }]}>
              <Ionicons name="card-outline" size={24} color={theme.blockchain} />
            </View>
            <View style={styles.paymentInfo}>
              <ThemedText style={styles.paymentTitle}>Card</ThemedText>
              <ThemedText style={[styles.paymentSubtitle, { color: theme.textSecondary }]}>
                Debit or credit card
              </ThemedText>
            </View>
            <View style={[styles.defaultBadge, { backgroundColor: theme.blockchain + "20" }]}>
              <ThemedText style={[styles.defaultText, { color: theme.blockchain }]}>Available</ThemedText>
            </View>
          </View>
        </Card>

        <ThemedText style={[styles.paymentNote, { color: theme.textMuted }]}>
          HRS payments use the HorseChain ERC-20 token on Ethereum mainnet.
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
        <Card style={styles.promoCard} onPress={() => navigation.navigate("PromoCode")}>
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

      {/* USDT Top-up Modal */}
      <Modal visible={topupModalVisible} animationType="slide" transparent onRequestClose={() => setTopupModalVisible(false)}>
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
                    backgroundColor: topupMethod === "usdt" ? theme.crypto + "20" : theme.backgroundDefault,
                    borderColor: topupMethod === "usdt" ? theme.crypto : theme.border,
                  }
                ]}
                onPress={() => setTopupMethod("usdt")}
              >
                <ThemedText style={{ ...Typography.h4Heavy, color: topupMethod === "usdt" ? theme.crypto : theme.textSecondary }}>USDT</ThemedText>
                <ThemedText style={[styles.paymentMethodLabel, { color: topupMethod === "usdt" ? theme.crypto : theme.textPrimary }]}>Crypto</ThemedText>
              </Pressable>
            </View>
            <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>Enter amount (AED)</ThemedText>
            <TextInput
              style={[styles.amountInput, { backgroundColor: theme.backgroundDefault, color: theme.textPrimary, borderColor: theme.border }]}
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
                  style={[styles.quickAmountBtn, { backgroundColor: topupAmount === amt ? theme.primary : theme.backgroundDefault, borderColor: theme.border }]}
                  onPress={() => setTopupAmount(amt)}
                >
                  <ThemedText style={[styles.quickAmountText, { color: topupAmount === amt ? theme.textOnPrimary : theme.textPrimary }]}>
                    AED {amt}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable style={[styles.topupButton, { backgroundColor: theme.crypto }]} onPress={handleTopup} disabled={isCreatingInvoice}>
              {isCreatingInvoice ? (
                <ActivityIndicator color={theme.textOnPrimary} />
              ) : (
                <ThemedText style={styles.topupButtonText}>Pay with USDT</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* HRS Wallet Link Modal */}
      <Modal visible={hrsModalVisible} animationType="slide" transparent onRequestClose={() => setHrsModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Link HRS Wallet</ThemedText>
              <Pressable onPress={() => setHrsModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <View style={[styles.hrsInfoBox, { backgroundColor: HRS_COLOR + "15", borderColor: HRS_COLOR + "40" }]}>
              <ThemedText style={[styles.hrsInfoTitle, { color: HRS_COLOR_LIGHT }]}>HorseChain (HRS)</ThemedText>
              <ThemedText style={[styles.hrsInfoText, { color: theme.textSecondary }]}>
                ERC-20 token on Ethereum Mainnet. Enter your Ethereum wallet address (0x...) to view your balance and pay for rides with HRS.
              </ThemedText>
              <Pressable onPress={() => WebBrowser.openBrowserAsync("https://etherscan.io/token/0xe0bb2ba6abfe69eef1b0828e090a3abd5863c7ad")}>
                <ThemedText style={[styles.hrsInfoLink, { color: HRS_COLOR_LIGHT }]}>View on Etherscan</ThemedText>
              </Pressable>
            </View>

            {hrsLinked && hrsData?.walletAddress && (
              <View style={[styles.currentWalletRow, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
                <Ionicons name="checkmark-circle" size={16} color={Colors.travonyGreen} />
                <ThemedText style={[styles.currentWalletText, { color: theme.textSecondary }]} numberOfLines={1}>
                  {hrsData.walletAddress.slice(0, 12)}...{hrsData.walletAddress.slice(-8)}
                </ThemedText>
                <ThemedText style={[styles.currentWalletBalance, { color: HRS_COLOR_LIGHT }]}>
                  {hrsBalance} HRS
                </ThemedText>
              </View>
            )}

            <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
              {hrsLinked ? "Update Ethereum wallet address" : "Your Ethereum wallet address"}
            </ThemedText>
            <TextInput
              style={[styles.ethInput, { backgroundColor: theme.backgroundDefault, color: theme.textPrimary, borderColor: theme.border }]}
              placeholder="0x1234...abcd"
              placeholderTextColor={theme.textMuted}
              value={ethAddress}
              onChangeText={setEthAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Pressable
              style={[styles.topupButton, { backgroundColor: HRS_COLOR }]}
              onPress={handleLinkEthWallet}
              disabled={isLinkingWallet}
            >
              {isLinkingWallet ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.topupButtonText}>
                  {hrsLinked ? "Update Wallet" : "Link Wallet"}
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
  container: { flex: 1 },
  balanceCard: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    ...Shadows.card,
  },
  balanceLabel: { ...Typography.bodyMedium, color: "rgba(255,255,255,0.8)" },
  balanceAmount: { ...Typography.h1, color: Colors.light.textOnPrimary, marginTop: Spacing.xs },
  balanceActions: { flexDirection: "row", marginTop: Spacing.lg },
  balanceAction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  balanceActionText: { ...Typography.bodyBold, color: Colors.light.textOnPrimary, marginLeft: Spacing.sm },
  hrsCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing["2xl"],
    ...Shadows.card,
  },
  hrsCardLeft: { flex: 1 },
  hrsCardRight: { alignItems: "center", gap: Spacing.sm },
  hrsIconRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  hrsIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  hrsIconText: { ...Typography.smallHeavy, color: "#fff" },
  hrsTagBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.xs,
  },
  hrsTagText: { ...Typography.small, color: "rgba(255,255,255,0.9)", fontSize: 10 },
  hrsLabel: { ...Typography.bodyMedium, color: "rgba(255,255,255,0.8)" },
  hrsAmount: { ...Typography.h2, color: "#fff", marginTop: Spacing.xs },
  hrsAddress: { ...Typography.small, color: "rgba(255,255,255,0.7)", marginTop: Spacing.xs },
  hrsLinkPrompt: { ...Typography.small, color: "rgba(255,255,255,0.6)", marginTop: Spacing.xs },
  hrsUnlinkBtn: {
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  hrsUnlinkText: { ...Typography.small, color: "#fff" },
  section: { marginBottom: Spacing["2xl"] },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h4 },
  paymentCard: { marginBottom: Spacing.md, padding: Spacing.lg },
  paymentRow: { flexDirection: "row", alignItems: "center" },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  paymentInfo: { flex: 1 },
  paymentTitle: { ...Typography.h4, textTransform: "capitalize" },
  paymentSubtitle: { ...Typography.small, marginTop: Spacing.xs },
  defaultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  defaultText: { ...Typography.smallBold },
  transactionCard: { marginBottom: Spacing.sm, padding: Spacing.md },
  transactionRow: { flexDirection: "row", alignItems: "center" },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  transactionInfo: { flex: 1 },
  transactionTitle: { ...Typography.bodySmallMedium, textTransform: "capitalize" },
  transactionDate: { ...Typography.small, marginTop: 2 },
  transactionAmount: { ...Typography.bodyBold },
  promoCard: { padding: Spacing.lg },
  promoRow: { flexDirection: "row", alignItems: "center" },
  promoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  promoInfo: { flex: 1 },
  promoTitle: { ...Typography.h4 },
  promoSubtitle: { ...Typography.small, marginTop: Spacing.xs },
  paymentNote: { ...Typography.small, marginTop: Spacing.md, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingBottom: Spacing["3xl"],
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.xl },
  modalTitle: { ...Typography.h3 },
  paymentMethodSelector: { flexDirection: "row", marginBottom: Spacing.lg, gap: Spacing.md },
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
  paymentMethodLabel: { ...Typography.h4 },
  modalLabel: { ...Typography.small, marginBottom: Spacing.sm },
  amountInput: {
    ...Typography.h2,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  ethInput: {
    ...Typography.body,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    fontFamily: "monospace",
  },
  quickAmounts: { flexDirection: "row", justifyContent: "space-between", marginBottom: Spacing.xl },
  quickAmountBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  quickAmountText: { ...Typography.bodySmallMedium },
  topupButton: { paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, alignItems: "center" },
  topupButtonText: { ...Typography.button, color: Colors.light.textOnPrimary },
  hrsInfoBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  hrsInfoTitle: { ...Typography.h4Heavy },
  hrsInfoText: { ...Typography.small },
  hrsInfoLink: { ...Typography.smallBold, marginTop: Spacing.xs, textDecorationLine: "underline" },
  currentWalletRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  currentWalletText: { ...Typography.small, flex: 1 },
  currentWalletBalance: { ...Typography.smallBold },
});
