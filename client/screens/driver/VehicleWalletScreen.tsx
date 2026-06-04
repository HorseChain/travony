import { View, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface VehicleIdentity {
  id: string;
  publicHandle: string | null;
  make: string;
  model: string;
  year: number | null;
  color: string | null;
  plateNumber: string;
  type: string | null;
  isElectric: boolean | null;
}

interface VehicleWalletTransaction {
  id: string;
  type: string;
  amount: string;
  status: string;
  description: string | null;
  createdAt: string;
}

interface VehicleWalletData {
  identity: VehicleIdentity;
  balance: string;
  totalEarnings: string;
  totalTrips: number;
  reputationScore: string;
  ratingCount: number;
  transactions: VehicleWalletTransaction[];
}

interface DriverMe {
  id: string;
  vehicle: { id: string } | null;
}

export default function VehicleWalletScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const { data: driverMe } = useQuery<DriverMe>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user?.id && user?.role === "driver",
  });

  const vehicleId = driverMe?.vehicle?.id;

  const { data: wallet, isLoading } = useQuery<VehicleWalletData>({
    queryKey: ["/api/vehicles", vehicleId, "wallet"],
    enabled: !!vehicleId,
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getTransactionIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case "ride_payment":
        return "navigate-outline";
      case "withdrawal":
        return "arrow-down-circle-outline";
      case "platform_fee":
        return "remove-circle-outline";
      default:
        return "cash-outline";
    }
  };

  const renderTransaction = ({ item }: { item: VehicleWalletTransaction }) => {
    const amount = parseFloat(item.amount || "0");
    const isNegative = amount < 0;
    return (
      <View style={[styles.txItem, { backgroundColor: theme.backgroundElevated }]}>
        <View style={styles.txLeft}>
          <View style={[styles.txIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
            <Ionicons name={getTransactionIcon(item.type)} size={18} color={Colors.travonyGreen} />
          </View>
          <View style={styles.txInfo}>
            <ThemedText style={styles.txTitle} numberOfLines={1}>
              {item.description || item.type.replace(/_/g, " ")}
            </ThemedText>
            <ThemedText style={[styles.txDate, { color: theme.textSecondary }]}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>
        </View>
        <ThemedText
          style={[styles.txAmount, { color: isNegative ? theme.error : Colors.travonyGreen }]}
        >
          {isNegative ? "-" : "+"}AED {Math.abs(amount).toFixed(2)}
        </ThemedText>
      </View>
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
      </ThemedView>
    );
  }

  if (!vehicleId || !wallet) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <Ionicons name="car-outline" size={48} color={theme.textMuted} />
        <ThemedText style={[styles.emptyTitle, { marginTop: Spacing.md }]}>No Vehicle Yet</ThemedText>
        <ThemedText style={[styles.emptySub, { color: theme.textSecondary }]}>
          Add and activate a vehicle to see its asset wallet.
        </ThemedText>
      </ThemedView>
    );
  }

  const { identity } = wallet;
  const balance = parseFloat(wallet.balance || "0");
  const totalEarnings = parseFloat(wallet.totalEarnings || "0");
  const reputation = parseFloat(wallet.reputationScore || "5");

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={wallet.transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderTransaction}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + Spacing["3xl"] },
        ]}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListHeaderComponent={
          <>
            {/* Vehicle identity card */}
            <View style={[styles.identityCard, { backgroundColor: theme.backgroundElevated }]}>
              <View style={styles.identityRow}>
                <View style={[styles.vehicleIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
                  <Ionicons
                    name={identity.isElectric ? "flash-outline" : "car-sport-outline"}
                    size={24}
                    color={Colors.travonyGreen}
                  />
                </View>
                <View style={styles.identityInfo}>
                  <ThemedText style={styles.vehicleName}>
                    {identity.make} {identity.model}
                  </ThemedText>
                  <ThemedText style={[styles.vehiclePlate, { color: theme.textSecondary }]}>
                    {identity.plateNumber}
                    {identity.color ? ` · ${identity.color}` : ""}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.handleBadge, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="finger-print-outline" size={14} color={Colors.travonyGreen} />
                <ThemedText style={[styles.handleText, { color: Colors.travonyGreen }]}>
                  {identity.publicHandle || "—"}
                </ThemedText>
              </View>
            </View>

            {/* Asset wallet balance */}
            <View style={[styles.balanceCard, { backgroundColor: Colors.travonyGreen }]}>
              <ThemedText style={styles.balanceLabel}>Asset Wallet</ThemedText>
              <ThemedText style={styles.balanceAmount}>AED {balance.toFixed(2)}</ThemedText>
              <ThemedText style={styles.balanceHint}>
                This vehicle earns and holds its own funds
              </ThemedText>
            </View>

            {/* Stats: lifetime yield, trips, reputation */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundElevated }]}>
                <Ionicons name="trending-up-outline" size={20} color={Colors.travonyGreen} />
                <ThemedText style={styles.statValue}>AED {totalEarnings.toFixed(0)}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Lifetime Yield
                </ThemedText>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundElevated }]}>
                <Ionicons name="navigate-outline" size={20} color={Colors.travonyGreen} />
                <ThemedText style={styles.statValue}>{wallet.totalTrips}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Total Trips
                </ThemedText>
              </View>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundElevated }]}>
                <Ionicons name="star" size={20} color="#F5A623" />
                <ThemedText style={styles.statValue}>{reputation.toFixed(2)}</ThemedText>
                <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                  Reputation
                </ThemedText>
              </View>
            </View>

            <ThemedText style={styles.sectionTitle}>Wallet Activity</ThemedText>

            {wallet.transactions.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.backgroundElevated }]}>
                <Ionicons name="receipt-outline" size={36} color={theme.textMuted} />
                <ThemedText style={[styles.emptySub, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
                  No activity yet. Completed trips will appear here.
                </ThemedText>
              </View>
            ) : null}
          </>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  content: { paddingHorizontal: Spacing.lg },
  identityCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  identityRow: { flexDirection: "row", alignItems: "center" },
  vehicleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  identityInfo: { flex: 1 },
  vehicleName: { fontSize: 17, fontWeight: "700" },
  vehiclePlate: { fontSize: 13, marginTop: 2 },
  handleBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  handleText: { fontSize: 13, fontWeight: "700", letterSpacing: 1 },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  balanceLabel: { color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" },
  balanceAmount: { color: "#fff", fontSize: 34, fontWeight: "800", marginVertical: Spacing.xs },
  balanceHint: { color: "rgba(255,255,255,0.8)", fontSize: 12 },
  statsRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: "center",
    gap: 4,
  },
  statValue: { fontSize: 16, fontWeight: "700" },
  statLabel: { fontSize: 11, textAlign: "center" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.md },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  txLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  txIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  txInfo: { flex: 1, paddingRight: Spacing.sm },
  txTitle: { fontSize: 14, fontWeight: "600" },
  txDate: { fontSize: 12, marginTop: 2 },
  txAmount: { fontSize: 15, fontWeight: "700" },
  emptyState: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center", marginTop: 4 },
});
