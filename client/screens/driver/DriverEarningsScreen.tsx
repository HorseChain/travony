import { View, StyleSheet, FlatList, Pressable, Modal, TextInput, Alert, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Driver {
  id: string;
  userId: string;
  walletBalance: string;
}

interface WalletTransaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  description: string | null;
  createdAt: string;
  rideId?: string;
}

interface DriverPayout {
  id: string;
  amount: string;
  status: string;
  currency?: string;
  method?: string;
  txHash?: string;
  createdAt: string;
}

interface CryptoSettings {
  driverId: string;
  usdtWalletAddress: string | null;
  preferredCurrency: string;
  isVerified: boolean;
}

interface UsdtBalance {
  balance: number;
  currency: string;
}

interface WalletData {
  balance: string;
  totalEarnings: string;
  cryptoWalletAddress: string | null;
  transactions: WalletTransaction[];
  payouts: DriverPayout[];
}

export default function DriverEarningsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [withdrawModalVisible, setWithdrawModalVisible] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [cryptoModalVisible, setCryptoModalVisible] = useState(false);
  const [cryptoWithdrawAmount, setCryptoWithdrawAmount] = useState("");
  const [walletAddressModalVisible, setWalletAddressModalVisible] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");

  const { data: driverData } = useQuery<Driver>({
    queryKey: ["/api/drivers/by-user", user?.id],
    enabled: !!user?.id && user?.role === "driver",
  });

  const driverId = driverData?.id;

  const { data: walletData, isLoading } = useQuery<WalletData>({
    queryKey: ["/api/drivers", driverId, "wallet"],
    enabled: !!driverId,
  });

  const { data: cryptoSettings } = useQuery<CryptoSettings>({
    queryKey: ["/api/driver/crypto-settings"],
    enabled: !!driverId,
  });

  const { data: usdtBalanceData } = useQuery<UsdtBalance>({
    queryKey: ["/api/driver/usdt-balance"],
    enabled: !!driverId,
  });

  const usdtBalance = usdtBalanceData?.balance || 0;

  const withdrawMutation = useMutation({
    mutationFn: async (amount: string) => {
      return apiRequest(`/api/drivers/${driverId}/payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "wallet"] });
      setWithdrawModalVisible(false);
      setWithdrawAmount("");
      Alert.alert("Success", "Withdrawal request submitted! Funds will be transferred within 2-3 business days.");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to submit withdrawal request");
    },
  });

  const cryptoWithdrawMutation = useMutation({
    mutationFn: async (amount: number) => {
      return apiRequest(`/api/drivers/${driverId}/crypto-payout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "payouts"] });
      setCryptoModalVisible(false);
      setCryptoWithdrawAmount("");
      Alert.alert("Success", data.message || "USDT withdrawal completed! Check your wallet.");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to withdraw USDT");
    },
  });

  const updateWalletAddressMutation = useMutation({
    mutationFn: async (address: string) => {
      return apiRequest(`/api/drivers/${driverId}/crypto-wallet`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers", driverId, "wallet"] });
      setWalletAddressModalVisible(false);
      setWalletAddress("");
      Alert.alert("Success", "USDT wallet address saved!");
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to save wallet address");
    },
  });

  const handleWithdraw = () => {
    const amount = parseFloat(withdrawAmount);
    const balance = parseFloat(walletData?.balance || "0");
    
    if (!withdrawAmount || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (amount > balance) {
      Alert.alert("Error", "Insufficient balance");
      return;
    }
    if (amount < 50) {
      Alert.alert("Error", "Minimum withdrawal amount is AED 50");
      return;
    }
    
    withdrawMutation.mutate(withdrawAmount);
  };

  const handleCryptoWithdraw = () => {
    const amount = parseFloat(cryptoWithdrawAmount);
    const currentBalance = parseFloat(walletData?.balance || "0");
    
    if (!cryptoWithdrawAmount || amount <= 0) {
      Alert.alert("Error", "Please enter a valid amount");
      return;
    }
    if (amount < 10) {
      Alert.alert("Error", "Minimum withdrawal is 10 USDT");
      return;
    }
    if (amount > currentBalance) {
      Alert.alert("Error", "Insufficient balance");
      return;
    }
    
    cryptoWithdrawMutation.mutate(amount);
  };

  const handleSaveWalletAddress = () => {
    if (!walletAddress || walletAddress.length < 10) {
      Alert.alert("Error", "Please enter a valid wallet address");
      return;
    }
    updateWalletAddressMutation.mutate(walletAddress);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  };

  const getTransactionIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "ride_payment":
        return "navigate-outline";
      case "withdrawal":
        return "arrow-down-circle-outline";
      case "bonus":
        return "gift-outline";
      default:
        return "cash-outline";
    }
  };

  const balance = parseFloat(walletData?.balance || "0");
  const totalEarnings = parseFloat(walletData?.totalEarnings || "0");
  const transactions = walletData?.transactions || [];
  const todayTransactions = transactions.filter((tx) => {
    const txDate = new Date(tx.createdAt).toDateString();
    return txDate === new Date().toDateString();
  });
  const todayEarnings = todayTransactions.reduce((sum, tx) => {
    if (tx.type === "ride_payment") return sum + parseFloat(tx.amount);
    return sum;
  }, 0);
  const todayTrips = todayTransactions.filter((tx) => tx.type === "ride_payment").length;

  const renderTransactionItem = ({ item }: { item: WalletTransaction }) => (
    <View style={[styles.earningItem, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.earningDate}>
        <View style={[styles.txIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
          <Ionicons name={getTransactionIcon(item.type)} size={18} color={Colors.travonyGreen} />
        </View>
        <View>
          <ThemedText style={styles.dateText}>
            {item.description || item.type.replace(/_/g, " ")}
          </ThemedText>
          <ThemedText style={[styles.tripsText, { color: theme.textSecondary }]}>
            {formatDate(item.createdAt)}
          </ThemedText>
        </View>
      </View>
      <View style={styles.earningAmounts}>
        <ThemedText style={[styles.earningsAmount, { color: item.type === "withdrawal" ? theme.error : Colors.travonyGreen }]}>
          {item.type === "withdrawal" ? "-" : "+"}AED {item.amount}
        </ThemedText>
        <ThemedText style={[styles.statusText, { 
          color: item.status === "completed" ? Colors.travonyGreen : theme.warning 
        }]}>
          {item.status}
        </ThemedText>
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransactionItem}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        ListHeaderComponent={
          <>
            <View style={[styles.summaryCard, { backgroundColor: Colors.travonyGreen }]}>
              <View style={styles.balanceSection}>
                <ThemedText style={styles.balanceLabel}>Available Balance</ThemedText>
                <ThemedText style={styles.balanceAmount}>AED {balance.toFixed(2)}</ThemedText>
                <Pressable
                  style={styles.withdrawButton}
                  onPress={() => setWithdrawModalVisible(true)}
                  disabled={balance < 50}
                >
                  <Ionicons name="arrow-down-circle-outline" size={18} color="#fff" />
                  <ThemedText style={styles.withdrawButtonText}>Withdraw</ThemedText>
                </Pressable>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Ionicons name="navigate-outline" size={20} color="rgba(255,255,255,0.8)" />
                  <ThemedText style={styles.statValue}>{todayTrips}</ThemedText>
                  <ThemedText style={styles.statLabel}>Today Trips</ThemedText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="cash-outline" size={20} color="rgba(255,255,255,0.8)" />
                  <ThemedText style={styles.statValue}>AED {todayEarnings.toFixed(0)}</ThemedText>
                  <ThemedText style={styles.statLabel}>Today Earnings</ThemedText>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Ionicons name="trending-up-outline" size={20} color="rgba(255,255,255,0.8)" />
                  <ThemedText style={styles.statValue}>AED {totalEarnings.toFixed(0)}</ThemedText>
                  <ThemedText style={styles.statLabel}>Total</ThemedText>
                </View>
              </View>
            </View>

            {/* USDT Crypto Earnings Card */}
            <View style={[styles.cryptoCard, { backgroundColor: theme.backgroundElevated }]}>
              <View style={styles.cryptoHeader}>
                <View style={styles.cryptoTitleRow}>
                  <View style={[styles.cryptoIcon, { backgroundColor: "#26A17B20" }]}>
                    <ThemedText style={styles.cryptoIconText}>USDT</ThemedText>
                  </View>
                  <View>
                    <ThemedText style={styles.cryptoTitle}>Crypto Earnings</ThemedText>
                    <ThemedText style={[styles.cryptoSubtitle, { color: theme.textSecondary }]}>
                      From USDT ride payments
                    </ThemedText>
                  </View>
                </View>
                <ThemedText style={[styles.cryptoBalance, { color: "#26A17B" }]}>
                  {usdtBalance.toFixed(2)} USDT
                </ThemedText>
              </View>

              <View style={styles.cryptoActions}>
                {cryptoSettings?.usdtWalletAddress ? (
                  <>
                    <View style={styles.walletAddressRow}>
                      <Ionicons name="wallet-outline" size={16} color={theme.textMuted} />
                      <ThemedText style={[styles.walletAddressText, { color: theme.textSecondary }]} numberOfLines={1}>
                        {cryptoSettings.usdtWalletAddress.slice(0, 12)}...{cryptoSettings.usdtWalletAddress.slice(-6)}
                      </ThemedText>
                      <Pressable onPress={() => setWalletAddressModalVisible(true)}>
                        <Ionicons name="pencil-outline" size={16} color={theme.textSecondary} />
                      </Pressable>
                    </View>
                    <Pressable
                      style={[styles.cryptoWithdrawBtn, { backgroundColor: "#26A17B" }]}
                      onPress={() => setCryptoModalVisible(true)}
                      disabled={usdtBalance <= 0}
                    >
                      <Ionicons name="arrow-up-circle-outline" size={18} color="#fff" />
                      <ThemedText style={styles.cryptoWithdrawText}>Withdraw USDT</ThemedText>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={[styles.setupWalletBtn, { borderColor: "#26A17B" }]}
                    onPress={() => setWalletAddressModalVisible(true)}
                  >
                    <Ionicons name="wallet-outline" size={18} color="#26A17B" />
                    <ThemedText style={[styles.setupWalletText, { color: "#26A17B" }]}>
                      Set Up USDT Wallet
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            </View>

            <ThemedText style={styles.sectionTitle}>Transaction History</ThemedText>
            
            {transactions.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.backgroundElevated }]}>
                <Ionicons name="mail-open-outline" size={40} color={theme.textMuted} />
                <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                  No transactions yet
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: theme.textMuted }]}>
                  Complete rides to start earning
                </ThemedText>
              </View>
            ) : null}
          </>
        }
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
      />

      <Modal
        visible={withdrawModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWithdrawModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Withdraw Funds</ThemedText>
              <Pressable onPress={() => setWithdrawModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <View style={[styles.balanceInfo, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.availableLabel, { color: theme.textSecondary }]}>
                Available Balance
              </ThemedText>
              <ThemedText style={[styles.availableAmount, { color: Colors.travonyGreen }]}>
                AED {balance.toFixed(2)}
              </ThemedText>
            </View>

            <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
              Enter withdrawal amount (AED)
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
              value={withdrawAmount}
              onChangeText={setWithdrawAmount}
            />

            <ThemedText style={[styles.minNote, { color: theme.textMuted }]}>
              Minimum withdrawal: AED 50
            </ThemedText>

            <Pressable
              style={[styles.confirmButton, { backgroundColor: Colors.travonyGreen }]}
              onPress={handleWithdraw}
              disabled={withdrawMutation.isPending}
            >
              {withdrawMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.confirmButtonText}>Request Withdrawal</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* USDT Withdrawal Modal */}
      <Modal
        visible={cryptoModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCryptoModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Withdraw USDT</ThemedText>
              <Pressable onPress={() => setCryptoModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <View style={[styles.balanceInfo, { backgroundColor: "#26A17B10" }]}>
              <ThemedText style={[styles.availableLabel, { color: theme.textSecondary }]}>
                Available USDT Balance
              </ThemedText>
              <ThemedText style={[styles.availableAmount, { color: "#26A17B" }]}>
                {usdtBalance.toFixed(2)} USDT
              </ThemedText>
            </View>

            <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
              Enter withdrawal amount (USDT)
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
              value={cryptoWithdrawAmount}
              onChangeText={setCryptoWithdrawAmount}
            />

            <View style={styles.walletDestination}>
              <Ionicons name="wallet-outline" size={16} color={theme.textMuted} />
              <ThemedText style={[styles.walletDestText, { color: theme.textSecondary }]}>
                To: {cryptoSettings?.usdtWalletAddress?.slice(0, 16)}...
              </ThemedText>
            </View>

            <Pressable
              style={[styles.confirmButton, { backgroundColor: "#26A17B" }]}
              onPress={handleCryptoWithdraw}
              disabled={cryptoWithdrawMutation.isPending}
            >
              {cryptoWithdrawMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.confirmButtonText}>Withdraw USDT</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Wallet Address Setup Modal */}
      <Modal
        visible={walletAddressModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setWalletAddressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.backgroundElevated }]}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>USDT Wallet Address</ThemedText>
              <Pressable onPress={() => setWalletAddressModalVisible(false)}>
                <Ionicons name="close-outline" size={24} color={theme.textPrimary} />
              </Pressable>
            </View>

            <ThemedText style={[styles.modalLabel, { color: theme.textSecondary }]}>
              Enter your USDT wallet address (ERC-20/Polygon)
            </ThemedText>
            <TextInput
              style={[styles.amountInput, {
                backgroundColor: theme.backgroundDefault,
                color: theme.textPrimary,
                borderColor: theme.border,
                fontSize: 14,
              }]}
              placeholder="0x..."
              placeholderTextColor={theme.textMuted}
              value={walletAddress || cryptoSettings?.usdtWalletAddress || ""}
              onChangeText={setWalletAddress}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ThemedText style={[styles.minNote, { color: theme.textMuted }]}>
              Make sure this is a valid USDT wallet address on Polygon network
            </ThemedText>

            <Pressable
              style={[styles.confirmButton, { backgroundColor: "#26A17B" }]}
              onPress={handleSaveWalletAddress}
              disabled={updateWalletAddressMutation.isPending}
            >
              {updateWalletAddressMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.confirmButtonText}>Save Wallet Address</ThemedText>
              )}
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  balanceSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  balanceLabel: {
    ...Typography.body,
    color: "rgba(255,255,255,0.8)",
    marginBottom: Spacing.xs,
  },
  balanceAmount: {
    fontSize: 42,
    fontWeight: "700",
    color: "#fff",
    marginBottom: Spacing.md,
  },
  withdrawButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
  },
  withdrawButtonText: {
    ...Typography.body,
    color: "#fff",
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  statItem: {
    alignItems: "center",
    gap: Spacing.xs,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  statValue: {
    ...Typography.body,
    fontWeight: "700",
    color: "#fff",
  },
  statLabel: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.8)",
  },
  sectionTitle: {
    ...Typography.h3,
    marginBottom: Spacing.lg,
  },
  emptyState: {
    padding: Spacing["2xl"],
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.body,
    fontWeight: "500",
  },
  emptySubtext: {
    ...Typography.small,
  },
  earningItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  earningDate: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dateText: {
    ...Typography.body,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  tripsText: {
    ...Typography.small,
    marginTop: 2,
  },
  earningAmounts: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  earningsAmount: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  statusText: {
    ...Typography.small,
    textTransform: "capitalize",
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
  balanceInfo: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  availableLabel: {
    ...Typography.small,
  },
  availableAmount: {
    ...Typography.h2,
    fontWeight: "700",
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
    marginBottom: Spacing.sm,
  },
  minNote: {
    ...Typography.small,
    marginBottom: Spacing.xl,
  },
  confirmButton: {
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    alignItems: "center",
  },
  confirmButtonText: {
    ...Typography.button,
    color: "#fff",
  },
  cryptoCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  cryptoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  cryptoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  cryptoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  cryptoIconText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#26A17B",
  },
  cryptoTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  cryptoSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },
  cryptoBalance: {
    ...Typography.h3,
    fontWeight: "700",
  },
  cryptoActions: {
    gap: Spacing.md,
  },
  walletAddressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  walletAddressText: {
    ...Typography.small,
    flex: 1,
  },
  cryptoWithdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  cryptoWithdrawText: {
    ...Typography.body,
    color: "#fff",
    fontWeight: "600",
  },
  setupWalletBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  setupWalletText: {
    ...Typography.body,
    fontWeight: "600",
  },
  walletDestination: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  walletDestText: {
    ...Typography.small,
  },
});
