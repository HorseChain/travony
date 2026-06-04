import { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface VehicleIdentity {
  id: string;
  publicHandle: string | null;
  nickname: string | null;
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

interface CarAgentData {
  name: string;
  nickname: string | null;
  publicHandle: string | null;
  message: string;
  suggestion: string;
  rankLine: string | null;
  currency: string;
  aiGenerated: boolean;
}

interface VehicleMilestone {
  key: string;
  type: string;
  title: string;
  description: string;
  date: string | null;
  icon: string;
  value?: string;
}

interface MilestonesData {
  milestones: VehicleMilestone[];
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
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const { data: driverMe } = useQuery<DriverMe>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user?.id && user?.role === "driver",
  });

  const vehicleId = driverMe?.vehicle?.id;

  const { data: wallet, isLoading } = useQuery<VehicleWalletData>({
    queryKey: ["/api/vehicles", vehicleId, "wallet"],
    enabled: !!vehicleId,
  });

  const {
    data: agent,
    isLoading: agentLoading,
    isFetching: agentFetching,
    refetch: refetchAgent,
  } = useQuery<CarAgentData>({
    queryKey: ["/api/vehicles", vehicleId, "agent"],
    enabled: !!vehicleId,
  });

  const { data: milestonesData, isLoading: milestonesLoading } = useQuery<MilestonesData>({
    queryKey: ["/api/vehicles", vehicleId, "milestones"],
    enabled: !!vehicleId,
  });

  const nicknameMutation = useMutation({
    mutationFn: async (nickname: string) =>
      apiRequest(`/api/vehicles/${vehicleId}/nickname`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname }),
      }),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicleId, "wallet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vehicles", vehicleId, "agent"] });
    },
  });

  const currency = agent?.currency || "AED";

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatMilestoneDate = (dateString: string | null) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const milestones = milestonesData?.milestones ?? [];

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
          {isNegative ? "-" : "+"}
          {currency} {Math.abs(amount).toFixed(2)}
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
  const displayName = identity.nickname?.trim() || `${identity.make} ${identity.model}`;

  const openEditor = () => {
    setNameDraft(identity.nickname || "");
    setEditing(true);
  };

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
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListHeaderComponent={
          <>
            {/* AI Car Agent — the car speaks to its owner */}
            <View style={[styles.agentCard, { backgroundColor: Colors.travonyGreen }]}>
              <View style={styles.agentHeader}>
                <View style={styles.agentAvatar}>
                  <Ionicons
                    name={identity.isElectric ? "flash" : "car-sport"}
                    size={22}
                    color="#fff"
                  />
                </View>
                <View style={styles.agentNameWrap}>
                  <Pressable style={styles.agentNameRow} onPress={openEditor} hitSlop={8}>
                    <ThemedText style={styles.agentName} numberOfLines={1}>
                      {displayName}
                    </ThemedText>
                    <Ionicons name="create-outline" size={16} color="rgba(255,255,255,0.9)" />
                  </Pressable>
                  <ThemedText style={styles.agentHandle}>
                    {identity.publicHandle || "—"}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => refetchAgent()}
                  hitSlop={8}
                  style={styles.refreshBtn}
                  disabled={agentFetching}
                >
                  {agentFetching ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="refresh" size={18} color="#fff" />
                  )}
                </Pressable>
              </View>

              {agentLoading ? (
                <View style={styles.agentLoading}>
                  <ActivityIndicator size="small" color="#fff" />
                </View>
              ) : (
                <>
                  <ThemedText style={styles.agentMessage}>
                    {agent?.message || "We're getting ready to go to work together."}
                  </ThemedText>

                  {agent?.suggestion ? (
                    <View style={styles.agentSuggestion}>
                      <Ionicons name="compass-outline" size={16} color="#fff" />
                      <ThemedText style={styles.agentSuggestionText}>
                        {agent.suggestion}
                      </ThemedText>
                    </View>
                  ) : null}

                  {agent?.rankLine ? (
                    <View style={styles.rankBadge}>
                      <Ionicons name="trophy-outline" size={14} color={Colors.travonyGreen} />
                      <ThemedText style={styles.rankText}>{agent.rankLine}</ThemedText>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            {/* Asset wallet balance */}
            <View style={[styles.balanceCard, { backgroundColor: theme.backgroundElevated }]}>
              <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                Our Wallet
              </ThemedText>
              <ThemedText style={styles.balanceAmount}>
                {currency} {balance.toFixed(2)}
              </ThemedText>
              <ThemedText style={[styles.balanceHint, { color: theme.textSecondary }]}>
                This car earns and holds its own funds
              </ThemedText>
            </View>

            {/* Stats: lifetime yield, trips, reputation */}
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: theme.backgroundElevated }]}>
                <Ionicons name="trending-up-outline" size={20} color={Colors.travonyGreen} />
                <ThemedText style={styles.statValue}>
                  {currency} {totalEarnings.toFixed(0)}
                </ThemedText>
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

            {/* Living profile timeline — the car's milestones, real data only */}
            <View style={styles.timelineHeaderRow}>
              <ThemedText style={styles.sectionTitle}>Our Journey</ThemedText>
              {milestones.length > 0 ? (
                <ThemedText style={[styles.timelineCount, { color: theme.textSecondary }]}>
                  {milestones.length} {milestones.length === 1 ? "milestone" : "milestones"}
                </ThemedText>
              ) : null}
            </View>

            {milestonesLoading ? (
              <View style={[styles.emptyState, { backgroundColor: theme.backgroundElevated }]}>
                <ActivityIndicator size="small" color={Colors.travonyGreen} />
              </View>
            ) : milestones.length === 0 ? (
              <View style={[styles.emptyState, { backgroundColor: theme.backgroundElevated, marginBottom: Spacing.xl }]}>
                <Ionicons name="time-outline" size={36} color={theme.textMuted} />
                <ThemedText style={[styles.emptySub, { color: theme.textSecondary, marginTop: Spacing.sm }]}>
                  Your car's story starts with its first trip. Milestones appear here as you drive together.
                </ThemedText>
              </View>
            ) : (
              <View style={[styles.timelineCard, { backgroundColor: theme.backgroundElevated }]}>
                {milestones.map((m, index) => (
                  <View key={m.key} style={styles.timelineRow}>
                    <View style={styles.timelineRail}>
                      <View style={[styles.timelineDot, { backgroundColor: Colors.travonyGreen + "20" }]}>
                        <Ionicons
                          name={(m.icon as keyof typeof Ionicons.glyphMap) || "ellipse-outline"}
                          size={16}
                          color={Colors.travonyGreen}
                        />
                      </View>
                      {index < milestones.length - 1 ? (
                        <View style={[styles.timelineLine, { backgroundColor: theme.border }]} />
                      ) : null}
                    </View>
                    <View style={styles.timelineBody}>
                      <View style={styles.timelineTitleRow}>
                        <ThemedText style={styles.timelineTitle} numberOfLines={1}>
                          {m.title}
                        </ThemedText>
                        {m.date ? (
                          <ThemedText style={[styles.timelineDate, { color: theme.textSecondary }]}>
                            {formatMilestoneDate(m.date)}
                          </ThemedText>
                        ) : null}
                      </View>
                      <ThemedText style={[styles.timelineDesc, { color: theme.textSecondary }]}>
                        {m.description}
                      </ThemedText>
                    </View>
                  </View>
                ))}
              </View>
            )}

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

      {/* Name your car */}
      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <View style={styles.modalBackdrop}>
          <KeyboardAwareScrollViewCompat
            contentContainerStyle={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={[styles.modalCard, { backgroundColor: theme.backgroundElevated }]}>
              <ThemedText style={styles.modalTitle}>Name your car</ThemedText>
              <ThemedText style={[styles.modalSub, { color: theme.textSecondary }]}>
                Give your car a name so it can speak to you as a partner.
              </ThemedText>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder={`${identity.make} ${identity.model}`}
                placeholderTextColor={theme.textMuted}
                maxLength={40}
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundDefault, color: theme.textPrimary },
                ]}
                autoFocus
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: theme.backgroundDefault }]}
                  onPress={() => setEditing(false)}
                >
                  <ThemedText style={styles.modalBtnText}>Cancel</ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: Colors.travonyGreen }]}
                  onPress={() => nicknameMutation.mutate(nameDraft.trim())}
                  disabled={nicknameMutation.isPending}
                >
                  {nicknameMutation.isPending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={[styles.modalBtnText, { color: "#fff" }]}>Save</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAwareScrollViewCompat>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center", padding: Spacing.xl },
  content: { paddingHorizontal: Spacing.lg },
  agentCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  agentHeader: { flexDirection: "row", alignItems: "center", marginBottom: Spacing.md },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  agentNameWrap: { flex: 1 },
  agentNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  agentName: { color: "#fff", fontSize: 18, fontWeight: "800", flexShrink: 1 },
  agentHandle: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  agentLoading: { paddingVertical: Spacing.lg, alignItems: "flex-start" },
  agentMessage: { color: "#fff", fontSize: 16, lineHeight: 23, fontWeight: "600" },
  agentSuggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: Spacing.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  agentSuggestionText: { color: "#fff", fontSize: 13, flex: 1, lineHeight: 18 },
  rankBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: "#fff",
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
  },
  rankText: { color: Colors.travonyGreen, fontSize: 12, fontWeight: "700" },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  balanceLabel: { fontSize: 14, fontWeight: "600" },
  balanceAmount: { fontSize: 34, fontWeight: "800", marginVertical: Spacing.xs },
  balanceHint: { fontSize: 12 },
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
  timelineHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  timelineCount: { fontSize: 12, fontWeight: "600", marginBottom: Spacing.md },
  timelineCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  timelineRow: { flexDirection: "row" },
  timelineRail: { width: 32, alignItems: "center" },
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineLine: { width: 2, flex: 1, marginVertical: 4, borderRadius: 1 },
  timelineBody: { flex: 1, paddingLeft: Spacing.md, paddingBottom: Spacing.lg },
  timelineTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  timelineTitle: { fontSize: 15, fontWeight: "700", flexShrink: 1 },
  timelineDate: { fontSize: 11, fontWeight: "600" },
  timelineDesc: { fontSize: 13, lineHeight: 18, marginTop: 2 },
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
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
  },
  modalScroll: { flexGrow: 1, justifyContent: "center", padding: Spacing.xl },
  modalCard: { borderRadius: BorderRadius.xl, padding: Spacing.xl },
  modalTitle: { fontSize: 18, fontWeight: "800" },
  modalSub: { fontSize: 13, marginTop: 4, marginBottom: Spacing.lg },
  input: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  modalActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.lg },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 15, fontWeight: "700" },
});
