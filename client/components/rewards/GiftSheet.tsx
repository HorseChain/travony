import React, { useState } from "react";
import { View, StyleSheet, Modal, Pressable, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

const COIN_COLOR = "#F5B301";

interface GiftItem {
  key: string;
  name: string;
  coins: number;
  icon: string;
}

interface RewardsMe {
  coins: number;
  catalog: GiftItem[];
}

interface GiftSheetProps {
  visible: boolean;
  onClose: () => void;
  // Exactly one of postId / rideId.
  postId?: string;
  rideId?: string;
  recipientName?: string | null;
}

// Bottom sheet with the Travony gift catalog. Coins are debited server-side;
// the recipient earns diamonds. Used on feed ride posts and to thank your
// driver after a completed trip.
export default function GiftSheet({
  visible,
  onClose,
  postId,
  rideId,
  recipientName,
}: GiftSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const rewardsQuery = useQuery<RewardsMe>({
    queryKey: ["/api/rewards/me"],
    enabled: visible,
  });
  const coins = rewardsQuery.data?.coins ?? 0;
  const catalog = rewardsQuery.data?.catalog ?? [];
  const selectedGift = catalog.find((g) => g.key === selected) || null;

  const sendMutation = useMutation({
    mutationFn: (giftKey: string) =>
      apiRequest("/api/rewards/gifts/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ giftKey, postId, rideId }),
      }),
    onSuccess: (_res: any, giftKey) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/rewards/me"] });
      const gift = catalog.find((g) => g.key === giftKey);
      setFeedback(`${gift?.name || "Gift"} sent`);
      setTimeout(() => {
        setFeedback(null);
        setSelected(null);
        onClose();
      }, 1200);
    },
    onError: (err: any) => {
      setFeedback(err?.message || "Gift failed");
      setTimeout(() => setFeedback(null), 2200);
    },
  });

  const canAfford = selectedGift ? coins >= selectedGift.coins : false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.backgroundElevated,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={styles.header}>
            <ThemedText style={styles.title}>
              {recipientName ? `Send a gift to ${recipientName}` : "Send a gift"}
            </ThemedText>
            <View style={styles.coinsBadge}>
              <Ionicons name="server" size={14} color={COIN_COLOR} />
              <ThemedText style={[styles.coinsText, { color: theme.textSecondary }]}>
                {coins}
              </ThemedText>
            </View>
          </View>

          <ScrollView style={styles.gridScroll} contentContainerStyle={styles.grid}>
            {catalog.map((g) => {
              const isSelected = selected === g.key;
              return (
                <Pressable
                  key={g.key}
                  style={[
                    styles.giftCard,
                    {
                      backgroundColor: theme.backgroundRoot,
                      borderWidth: isSelected ? 1.5 : 0,
                      borderColor: COIN_COLOR,
                    },
                  ]}
                  onPress={() => setSelected(isSelected ? null : g.key)}
                >
                  <Ionicons name={g.icon as any} size={26} color={isSelected ? COIN_COLOR : theme.text} />
                  <ThemedText style={styles.giftName} numberOfLines={1}>
                    {g.name}
                  </ThemedText>
                  <View style={styles.giftPriceRow}>
                    <Ionicons name="server" size={11} color={COIN_COLOR} />
                    <ThemedText style={[styles.giftPrice, { color: theme.textSecondary }]}>
                      {g.coins}
                    </ThemedText>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          {feedback ? (
            <View style={[styles.feedback, { backgroundColor: theme.backgroundRoot }]}>
              <ThemedText style={styles.feedbackText}>{feedback}</ThemedText>
            </View>
          ) : (
            <Pressable
              style={[
                styles.sendButton,
                {
                  backgroundColor:
                    selectedGift && canAfford ? theme.primary : theme.backgroundRoot,
                },
              ]}
              disabled={!selectedGift || !canAfford || sendMutation.isPending}
              onPress={() => selectedGift && sendMutation.mutate(selectedGift.key)}
            >
              <ThemedText
                style={[
                  styles.sendButtonText,
                  { color: selectedGift && canAfford ? "#FFFFFF" : theme.textMuted },
                ]}
              >
                {!selectedGift
                  ? "Pick a gift"
                  : canAfford
                    ? `Send ${selectedGift.name} · ${selectedGift.coins} coins`
                    : "Not enough coins — get more in Rewards"}
              </ThemedText>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    padding: Spacing.xl,
    maxHeight: "70%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h4,
    flex: 1,
    marginRight: Spacing.md,
  },
  coinsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  coinsText: {
    ...Typography.bodySmallMedium,
  },
  gridScroll: {
    flexGrow: 0,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  giftCard: {
    width: "23%",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    gap: 4,
  },
  giftName: {
    fontSize: 11,
    fontWeight: "500",
  },
  giftPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  giftPrice: {
    fontSize: 11,
  },
  sendButton: {
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  sendButtonText: {
    ...Typography.bodyMedium,
  },
  feedback: {
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginTop: Spacing.sm,
  },
  feedbackText: {
    ...Typography.bodyMedium,
  },
});
