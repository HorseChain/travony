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
  priceHrs: number;
  label: string;
}

type ModalStep = "closed" | "wallet" | "packs" | "payment" | "verifying" | "success";

interface IntentData {
  intentId: string;
  hrsAmount: number;
  coins: number;
  platformAddress: string;
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
  ethWalletAddress: string | null;
  platformHrsAddress: string | null;
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

  const [modalStep, setModalStep] = useState<ModalStep>("closed");
  const [ethAddress, setEthAddress] = useState("");
  const [intentData, setIntentData] = useState<IntentData | null>(null);
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

  const initiateMutation = useMutation({
    mutationFn: (packId: string) =>
      apiRequest("/api/rewards/coins/hrs-initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, ethAddress }),
      }),
    onSuccess: (res: any) => {
      setIntentData({
        intentId: res.intentId,
        hrsAmount: res.hrsAmount,
        coins: res.coins,
        platformAddress: res.platformAddress,
      });
      setModalStep("payment");
    },
    onError: (err: any) => flash(err?.message || "Could not create payment"),
  });

  const verifyMutation = useMutation({
    mutationFn: (intentId: string) =>
      apiRequest("/api/rewards/coins/hrs-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intentId }),
      }),
    onSuccess: (res: any) => {
      if (res.verified) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setModalStep("success");
        invalidate();
      } else {
        flash("Payment not found yet — wait a moment and try again");
      }
    },
    onError: (err: any) => flash(err?.message || "Verification failed"),
  });

  const saveWalletMutation = useMutation({
    mutationFn: (address: string) =>
      apiRequest("/api/rewards/wallet-address", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ethAddress: address }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/me"] });
      setModalStep("packs");
    },
    onError: (err: any) => flash(err?.message || "Could not save wallet address"),
  });

  const openPacks = () => {
    const addr = data?.ethWalletAddress || "";
    setEthAddress(addr);
    setModalStep(addr ? "packs" : "wallet");
  };

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
                onPress={() => openPacks()}
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

      {/* HRS coin top-up — multi-step modal */}
      <Modal
        visible={modalStep !== "closed"}
        transparent
        animationType="slide"
        onRequestClose={() => setModalStep("closed")}
      >
        <View style={styles.sheetOverlay}>
          <Pressable style={styles.sheetBackdrop} onPress={() => setModalStep("closed")} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: theme.backgroundElevated,
                paddingBottom: insets.bottom + Spacing.xl,
              },
            ]}
          >
            {/* Step: wallet address */}
            {modalStep === "wallet" ? (
              <>
                <ThemedText style={styles.sheetTitle}>Your wallet address</ThemedText>
                <ThemedText style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Enter your Ethereum wallet address. We use it to confirm your payment.
                </ThemedText>
                <TextInput
                  style={[
                    styles.walletInput,
                    { backgroundColor: theme.backgroundRoot, color: theme.text },
                  ]}
                  placeholder="0x..."
                  placeholderTextColor={theme.textMuted}
                  value={ethAddress}
                  onChangeText={setEthAddress}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Pressable
                  style={[
                    styles.wideSheetButton,
                    {
                      backgroundColor:
                        ethAddress.length > 10 ? theme.primary : theme.backgroundRoot,
                    },
                  ]}
                  onPress={() => {
                    if (ethAddress.trim().length > 10) {
                      saveWalletMutation.mutate(ethAddress.trim());
                    }
                  }}
                  disabled={saveWalletMutation.isPending || ethAddress.length <= 10}
                >
                  <ThemedText
                    style={[
                      styles.wideSheetButtonText,
                      { color: ethAddress.length > 10 ? "#FFFFFF" : theme.textMuted },
                    ]}
                  >
                    {saveWalletMutation.isPending ? "Saving..." : "Save & continue"}
                  </ThemedText>
                </Pressable>
              </>
            ) : null}

            {/* Step: pick a pack */}
            {modalStep === "packs" ? (
              <>
                <ThemedText style={styles.sheetTitle}>Choose a pack</ThemedText>
                <ThemedText style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  1 coin = 1 HRS · sent from your Ethereum wallet
                </ThemedText>
                <View style={styles.packGrid}>
                  {(data?.packs || []).map((p) => (
                    <Pressable
                      key={p.id}
                      style={[styles.packCard, { backgroundColor: theme.backgroundRoot }]}
                      onPress={() => initiateMutation.mutate(p.id)}
                      disabled={initiateMutation.isPending}
                    >
                      <Ionicons name="server" size={20} color={COIN_COLOR} />
                      <ThemedText style={styles.packCoins}>{p.coins}</ThemedText>
                      <ThemedText style={[styles.packLabel, { color: theme.textSecondary }]}>
                        {p.label}
                      </ThemedText>
                      <ThemedText style={[styles.packPrice, { color: theme.textMuted }]}>
                        {p.priceHrs} HRS
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
                {initiateMutation.isPending ? (
                  <ActivityIndicator color={theme.primary} style={{ marginTop: Spacing.md }} />
                ) : null}
              </>
            ) : null}

            {/* Step: send payment */}
            {modalStep === "payment" && intentData ? (
              <>
                <ThemedText style={styles.sheetTitle}>Send payment</ThemedText>
                <ThemedText style={[styles.sheetSub, { color: theme.textSecondary }]}>
                  Send exactly {intentData.hrsAmount} HRS to this address:
                </ThemedText>
                <View style={[styles.addressBox, { backgroundColor: theme.backgroundRoot }]}>
                  <ThemedText
                    style={[styles.addressText, { color: theme.text }]}
                    numberOfLines={2}
                    selectable
                  >
                    {intentData.platformAddress}
                  </ThemedText>
                  <Pressable
                    onPress={async () => {
                      try {
                        await Share.share({ message: intentData.platformAddress });
                      } catch {}
                    }}
                    style={[styles.copyBtn, { backgroundColor: theme.backgroundElevated }]}
                  >
                    <Ionicons name="copy-outline" size={18} color={theme.primary} />
                  </Pressable>
                </View>
                <View style={[styles.paymentDetail, { borderColor: theme.border }]}>
                  <View style={styles.paymentRow}>
                    <ThemedText style={[styles.paymentLabel, { color: theme.textMuted }]}>
                      Amount
                    </ThemedText>
                    <ThemedText style={[styles.paymentValue, { color: COIN_COLOR }]}>
                      {intentData.hrsAmount} HRS
                    </ThemedText>
                  </View>
                  <View style={[styles.paymentRow, { borderTopWidth: 1, borderColor: theme.border }]}>
                    <ThemedText style={[styles.paymentLabel, { color: theme.textMuted }]}>
                      You receive
                    </ThemedText>
                    <ThemedText style={[styles.paymentValue, { color: theme.text }]}>
                      {intentData.coins} coins
                    </ThemedText>
                  </View>
                  <View style={[styles.paymentRow, { borderTopWidth: 1, borderColor: theme.border }]}>
                    <ThemedText style={[styles.paymentLabel, { color: theme.textMuted }]}>
                      Your wallet
                    </ThemedText>
                    <ThemedText
                      style={[styles.paymentValue, { color: theme.textSecondary }]}
                      numberOfLines={1}
                    >
                      {ethAddress.slice(0, 8)}...{ethAddress.slice(-6)}
                    </ThemedText>
                  </View>
                </View>
                <Pressable
                  style={[styles.wideSheetButton, { backgroundColor: theme.primary }]}
                  onPress={() => {
                    if (intentData) verifyMutation.mutate(intentData.intentId);
                  }}
                  disabled={verifyMutation.isPending}
                >
                  <ThemedText style={[styles.wideSheetButtonText, { color: "#FFFFFF" }]}>
                    {verifyMutation.isPending ? "Checking..." : "I've sent the payment"}
                  </ThemedText>
                </Pressable>
                <Pressable onPress={() => setModalStep("packs")} style={styles.changePack}>
                  <ThemedText style={[styles.changePackText, { color: theme.textMuted }]}>
                    Change pack
                  </ThemedText>
                </Pressable>
              </>
            ) : null}

            {/* Step: success */}
            {modalStep === "success" ? (
              <>
                <View style={styles.successIcon}>
                  <Ionicons name="checkmark-circle" size={56} color={theme.success} />
                </View>
                <ThemedText style={[styles.sheetTitle, { textAlign: "center" }]}>
                  Coins added!
                </ThemedText>
                <ThemedText
                  style={[styles.sheetSub, { color: theme.textSecondary, textAlign: "center" }]}
                >
                  +{intentData?.coins ?? ""} coins have been added to your balance.
                </ThemedText>
                <Pressable
                  style={[
                    styles.wideSheetButton,
                    { backgroundColor: theme.primary, marginTop: Spacing.xl },
                  ]}
                  onPress={() => {
                    setModalStep("closed");
                    setIntentData(null);
                  }}
                >
                  <ThemedText style={[styles.wideSheetButtonText, { color: "#FFFFFF" }]}>
                    Done
                  </ThemedText>
                </Pressable>
              </>
            ) : null}
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
  walletInput: {
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  wideSheetButton: {
    height: 50,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  wideSheetButtonText: {
    ...Typography.bodyMedium,
  },
  addressBox: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  addressText: {
    flex: 1,
    ...Typography.small,
    letterSpacing: 0.3,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.xs,
    alignItems: "center",
    justifyContent: "center",
  },
  paymentDetail: {
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  paymentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  paymentLabel: {
    ...Typography.bodySmall,
  },
  paymentValue: {
    ...Typography.bodySmallMedium,
  },
  changePack: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
    marginTop: Spacing.xs,
  },
  changePackText: {
    ...Typography.small,
  },
  successIcon: {
    alignItems: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  packLabel: {
    ...Typography.small,
    marginTop: 2,
  },
});
