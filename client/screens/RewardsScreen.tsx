import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  TextInput,
  Share,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const COIN_COLOR = "#F5B301";
const DIAMOND_COLOR = "#20D5EC";

interface Mission {
  key: string;
  name: string;
  coins: number;
  target: number;
  icon: string;
  progress: number;
  claimable: boolean;
  claimed: boolean;
}

interface CoinPack {
  id: string;
  coins: number;
  priceAed: number;
}

interface RewardsData {
  coins: number;
  diamonds: number;
  diamondValueAed: number;
  minCashoutDiamonds: number;
  cashoutValueAed: number;
  checkIn: {
    checkedInToday: boolean;
    streakDay: number;
    nextCoins: number;
    schedule: number[];
  };
  missions: Mission[];
  referral: {
    code: string | null;
    invited: number;
    qualified: number;
    milestones: { qualified: number; coins: number }[];
    inviteeCoins: number;
    qualifiedCoins: number;
    canRedeem: boolean;
  };
  giftTotals: { diamondsReceived: number; coinsGifted: number };
  packs: CoinPack[];
}

function useRewardsInvalidate() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["/api/rewards/me"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rewards/history"] });
  };
}

export default function RewardsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const headerHeight = useHeaderHeight();
  const queryClient = useQueryClient();
  const invalidate = useRewardsInvalidate();

  const [packsVisible, setPacksVisible] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const rewardsQuery = useQuery<RewardsData>({ queryKey: ["/api/rewards/me"] });
  const data = rewardsQuery.data;

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 2600);
  };

  const checkInMutation = useMutation({
    mutationFn: () => apiRequest("/api/rewards/check-in", { method: "POST" }),
    onSuccess: (res: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flash(`+${res.coins} coins — day ${res.streakDay} streak`);
      invalidate();
    },
    onError: (err: any) => flash(err?.message || "Check-in failed"),
  });

  const claimMutation = useMutation({
    mutationFn: (key: string) =>
      apiRequest("/api/rewards/missions/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      }),
    onSuccess: (res: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flash(`+${res.coins} coins earned`);
      invalidate();
    },
    onError: (err: any) => flash(err?.message || "Claim failed"),
  });

  const purchaseMutation = useMutation({
    mutationFn: (packId: string) =>
      apiRequest("/api/rewards/coins/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      }),
    onSuccess: (res: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPacksVisible(false);
      flash(`+${res.coins} coins added`);
      invalidate();
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/wallet"),
      });
    },
    onError: (err: any) => flash(err?.message || "Purchase failed"),
  });

  const cashoutMutation = useMutation({
    mutationFn: () => apiRequest("/api/rewards/diamonds/cashout", { method: "POST" }),
    onSuccess: (res: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      flash(`AED ${res.aed.toFixed(2)} added to your wallet`);
      invalidate();
      queryClient.invalidateQueries({
        predicate: (q) => String(q.queryKey[0] ?? "").startsWith("/api/wallet"),
      });
    },
    onError: (err: any) => flash(err?.message || "Cash out failed"),
  });

  const redeemMutation = useMutation({
    mutationFn: (code: string) =>
      apiRequest("/api/rewards/referral/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
    onSuccess: (res: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setCodeInput("");
      flash(`+${res.coins} coins — welcome bonus`);
      invalidate();
    },
    onError: (err: any) => flash(err?.message || "Could not redeem code"),
  });

  const shareCode = async () => {
    if (!data?.referral.code) return;
    try {
      await Share.share({
        message: `Join me on Travony — use my invite code ${data.referral.code} in Rewards after you sign up and we both earn coins.`,
      });
    } catch {}
  };

  if (rewardsQuery.isLoading || !data) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  const streakCycleIndex = data.checkIn.checkedInToday
    ? (Math.max(data.checkIn.streakDay, 1) - 1) % 7
    : data.checkIn.streakDay % 7;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: tabBarInset + Spacing["3xl"],
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: tabBarInset }}
      >
        {/* Balances */}
        <View style={[styles.balanceCard, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.balanceRow}>
            <View style={styles.balanceSide}>
              <View style={styles.balanceLabelRow}>
                <Ionicons name="server" size={16} color={COIN_COLOR} />
                <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                  Coins
                </ThemedText>
              </View>
              <ThemedText style={styles.balanceValue}>{data.coins}</ThemedText>
              <Pressable
                style={[styles.smallButton, { backgroundColor: COIN_COLOR }]}
                onPress={() => setPacksVisible(true)}
              >
                <ThemedText style={styles.smallButtonText}>Get Coins</ThemedText>
              </Pressable>
            </View>
            <View style={[styles.balanceDivider, { backgroundColor: theme.border }]} />
            <View style={styles.balanceSide}>
              <View style={styles.balanceLabelRow}>
                <Ionicons name="diamond" size={16} color={DIAMOND_COLOR} />
                <ThemedText style={[styles.balanceLabel, { color: theme.textSecondary }]}>
                  Diamonds
                </ThemedText>
              </View>
              <ThemedText style={styles.balanceValue}>{data.diamonds}</ThemedText>
              {data.diamonds >= data.minCashoutDiamonds ? (
                <Pressable
                  style={[styles.smallButton, { backgroundColor: DIAMOND_COLOR }]}
                  onPress={() => cashoutMutation.mutate()}
                  disabled={cashoutMutation.isPending}
                >
                  <ThemedText style={styles.smallButtonText}>
                    Cash out AED {data.cashoutValueAed.toFixed(2)}
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText style={[styles.balanceHint, { color: theme.textMuted }]}>
                  {data.minCashoutDiamonds}+ to cash out
                </ThemedText>
              )}
            </View>
          </View>
          <ThemedText style={[styles.balanceFoot, { color: theme.textMuted }]}>
            Gifts you receive become diamonds. Diamonds convert to wallet money.
          </ThemedText>
        </View>

        {/* Daily check-in */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="flame" size={18} color="#FF6B35" />
              <ThemedText style={styles.cardTitle}>Daily check-in</ThemedText>
            </View>
            <ThemedText style={[styles.streakText, { color: theme.textSecondary }]}>
              {data.checkIn.streakDay > 0 ? `${data.checkIn.streakDay} day streak` : "Start a streak"}
            </ThemedText>
          </View>
          <View style={styles.scheduleRow}>
            {data.checkIn.schedule.map((coins, i) => {
              const done = data.checkIn.checkedInToday
                ? i <= streakCycleIndex
                : i < streakCycleIndex;
              const isNext = !data.checkIn.checkedInToday && i === streakCycleIndex;
              return (
                <View
                  key={i}
                  style={[
                    styles.dayPill,
                    {
                      backgroundColor: done
                        ? COIN_COLOR
                        : isNext
                          ? theme.backgroundRoot
                          : theme.backgroundRoot,
                      borderWidth: isNext ? 1.5 : 0,
                      borderColor: COIN_COLOR,
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.dayPillCoins,
                      { color: done ? "#1A1A1A" : theme.textSecondary },
                    ]}
                  >
                    {coins}
                  </ThemedText>
                  <ThemedText
                    style={[styles.dayPillLabel, { color: done ? "#1A1A1A" : theme.textMuted }]}
                  >
                    D{i + 1}
                  </ThemedText>
                </View>
              );
            })}
          </View>
          <Pressable
            style={[
              styles.wideButton,
              {
                backgroundColor: data.checkIn.checkedInToday ? theme.backgroundRoot : theme.primary,
              },
            ]}
            onPress={() => checkInMutation.mutate()}
            disabled={data.checkIn.checkedInToday || checkInMutation.isPending}
          >
            <ThemedText
              style={[
                styles.wideButtonText,
                { color: data.checkIn.checkedInToday ? theme.textMuted : "#FFFFFF" },
              ]}
            >
              {data.checkIn.checkedInToday
                ? "Checked in — come back tomorrow"
                : `Check in for ${data.checkIn.nextCoins} coins`}
            </ThemedText>
          </Pressable>
        </View>

        {/* Missions */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="navigate" size={18} color={theme.primary} />
            <ThemedText style={styles.cardTitle}>Today's missions</ThemedText>
          </View>
          {data.missions.map((m) => (
            <View key={m.key} style={styles.missionRow}>
              <View style={[styles.missionIcon, { backgroundColor: theme.backgroundRoot }]}>
                <Ionicons name={m.icon as any} size={18} color={theme.text} />
              </View>
              <View style={styles.missionBody}>
                <ThemedText style={styles.missionName}>{m.name}</ThemedText>
                <ThemedText style={[styles.missionMeta, { color: theme.textMuted }]}>
                  {m.progress}/{m.target} · {m.coins} coins
                </ThemedText>
              </View>
              {m.claimed ? (
                <Ionicons name="checkmark-circle" size={24} color={theme.success} />
              ) : m.claimable ? (
                <Pressable
                  style={[styles.claimButton, { backgroundColor: COIN_COLOR }]}
                  onPress={() => claimMutation.mutate(m.key)}
                  disabled={claimMutation.isPending}
                >
                  <ThemedText style={styles.claimButtonText}>Claim</ThemedText>
                </Pressable>
              ) : (
                <ThemedText style={[styles.missionMeta, { color: theme.textMuted }]}>
                  +{m.coins}
                </ThemedText>
              )}
            </View>
          ))}
        </View>

        {/* Invite friends */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="people" size={18} color="#20D5EC" />
            <ThemedText style={styles.cardTitle}>Invite friends</ThemedText>
          </View>
          <ThemedText style={[styles.inviteText, { color: theme.textSecondary }]}>
            Friends get {data.referral.inviteeCoins} coins when they join with your code. You get{" "}
            {data.referral.qualifiedCoins} coins after their first ride.
          </ThemedText>
          <View style={styles.codeRow}>
            <View style={[styles.codeBox, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={styles.codeText}>{data.referral.code || "—"}</ThemedText>
            </View>
            <Pressable
              style={[styles.shareButton, { backgroundColor: theme.primary }]}
              onPress={shareCode}
            >
              <Ionicons name="share-outline" size={18} color="#FFFFFF" />
              <ThemedText style={styles.shareButtonText}>Share</ThemedText>
            </Pressable>
          </View>
          <View style={styles.inviteStatsRow}>
            <ThemedText style={[styles.inviteStat, { color: theme.textSecondary }]}>
              {data.referral.invited} joined
            </ThemedText>
            <ThemedText style={[styles.inviteStat, { color: theme.textSecondary }]}>
              {data.referral.qualified} completed a ride
            </ThemedText>
          </View>
          <View style={styles.milestoneRow}>
            {data.referral.milestones.map((m) => (
              <View
                key={m.qualified}
                style={[
                  styles.milestonePill,
                  {
                    backgroundColor:
                      data.referral.qualified >= m.qualified ? COIN_COLOR : theme.backgroundRoot,
                  },
                ]}
              >
                <ThemedText
                  style={[
                    styles.milestoneText,
                    {
                      color:
                        data.referral.qualified >= m.qualified ? "#1A1A1A" : theme.textSecondary,
                    },
                  ]}
                >
                  {m.qualified} rides · +{m.coins}
                </ThemedText>
              </View>
            ))}
          </View>
          {data.referral.canRedeem ? (
            <View style={styles.redeemRow}>
              <TextInput
                style={[
                  styles.redeemInput,
                  { backgroundColor: theme.backgroundRoot, color: theme.text },
                ]}
                placeholder="Have a code? Enter it"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                value={codeInput}
                onChangeText={setCodeInput}
              />
              <Pressable
                style={[
                  styles.redeemButton,
                  { backgroundColor: codeInput.trim() ? theme.primary : theme.backgroundRoot },
                ]}
                onPress={() => codeInput.trim() && redeemMutation.mutate(codeInput.trim())}
                disabled={!codeInput.trim() || redeemMutation.isPending}
              >
                <ThemedText
                  style={[
                    styles.redeemButtonText,
                    { color: codeInput.trim() ? "#FFFFFF" : theme.textMuted },
                  ]}
                >
                  Redeem
                </ThemedText>
              </Pressable>
            </View>
          ) : null}
        </View>

        {/* Gifting summary */}
        <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="gift" size={18} color="#FE2C55" />
            <ThemedText style={styles.cardTitle}>Gifting</ThemedText>
          </View>
          <ThemedText style={[styles.inviteText, { color: theme.textSecondary }]}>
            Send gifts on ride posts in the Network tab, or thank your driver after a trip.
          </ThemedText>
          <View style={styles.inviteStatsRow}>
            <ThemedText style={[styles.inviteStat, { color: theme.textSecondary }]}>
              {data.giftTotals.coinsGifted} coins gifted
            </ThemedText>
            <ThemedText style={[styles.inviteStat, { color: theme.textSecondary }]}>
              {data.giftTotals.diamondsReceived} diamonds received
            </ThemedText>
          </View>
        </View>
      </ScrollView>

      {/* Coin packs sheet */}
      <Modal
        visible={packsVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPacksVisible(false)}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setPacksVisible(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.backgroundElevated,
                paddingBottom: insets.bottom + Spacing.xl,
              },
            ]}
          >
            <ThemedText style={styles.sheetTitle}>Get Coins</ThemedText>
            <ThemedText style={[styles.sheetSub, { color: theme.textSecondary }]}>
              Paid from your Travony wallet balance
            </ThemedText>
            <View style={styles.packGrid}>
              {data.packs.map((p) => (
                <Pressable
                  key={p.id}
                  style={[styles.packCard, { backgroundColor: theme.backgroundRoot }]}
                  onPress={() => purchaseMutation.mutate(p.id)}
                  disabled={purchaseMutation.isPending}
                >
                  <Ionicons name="server" size={20} color={COIN_COLOR} />
                  <ThemedText style={styles.packCoins}>{p.coins}</ThemedText>
                  <ThemedText style={[styles.packPrice, { color: theme.textSecondary }]}>
                    AED {p.priceAed}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {notice ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: theme.backgroundElevated, bottom: insets.bottom + Spacing.xl },
          ]}
        >
          <ThemedText style={styles.noticeText}>{notice}</ThemedText>
        </View>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  balanceCard: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  balanceRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  balanceSide: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.xs,
  },
  balanceDivider: {
    width: 1,
    marginHorizontal: Spacing.md,
  },
  balanceLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  balanceLabel: {
    ...Typography.small,
  },
  balanceValue: {
    ...Typography.h1,
  },
  balanceHint: {
    ...Typography.small,
    marginTop: Spacing.xs,
  },
  balanceFoot: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  smallButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xs,
  },
  smallButtonText: {
    ...Typography.bodySmallMedium,
    color: "#1A1A1A",
  },
  card: {
    borderRadius: BorderRadius.md,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    ...Typography.h4,
  },
  streakText: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  scheduleRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  dayPill: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
  },
  dayPillCoins: {
    ...Typography.bodySmallMedium,
  },
  dayPillLabel: {
    fontSize: 10,
  },
  wideButton: {
    height: 44,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  wideButtonText: {
    ...Typography.bodyMedium,
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  missionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  missionBody: {
    flex: 1,
  },
  missionName: {
    ...Typography.bodyMedium,
  },
  missionMeta: {
    ...Typography.small,
  },
  claimButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  claimButtonText: {
    ...Typography.bodySmallMedium,
    color: "#1A1A1A",
  },
  inviteText: {
    ...Typography.bodySmall,
    marginBottom: Spacing.md,
  },
  codeRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  codeBox: {
    flex: 1,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
    height: 44,
  },
  codeText: {
    ...Typography.h4,
    letterSpacing: 2,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
    height: 44,
  },
  shareButtonText: {
    ...Typography.bodyMedium,
    color: "#FFFFFF",
  },
  inviteStatsRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  inviteStat: {
    ...Typography.small,
  },
  milestoneRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  milestonePill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  milestoneText: {
    ...Typography.small,
  },
  redeemRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  redeemInput: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.md,
    ...Typography.body,
  },
  redeemButton: {
    height: 44,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  redeemButtonText: {
    ...Typography.bodyMedium,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  sheetTitle: {
    ...Typography.h3,
    textAlign: "center",
  },
  sheetSub: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  packGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  packCard: {
    width: "31.5%",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: 2,
  },
  packCoins: {
    ...Typography.h4,
  },
  packPrice: {
    ...Typography.small,
  },
  notice: {
    position: "absolute",
    left: Spacing.xl,
    right: Spacing.xl,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  noticeText: {
    ...Typography.bodySmallMedium,
  },
});
