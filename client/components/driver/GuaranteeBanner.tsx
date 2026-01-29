import { useState, useEffect } from "react";
import { View, StyleSheet, Platform, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withSequence, FadeIn, FadeOut } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface GuaranteeStatus {
  active: boolean;
  guarantee: {
    id: string;
    status: string;
    amount: string;
    currency: string;
    expiresAt: string;
    minutesRemaining: number;
  } | null;
  eligibleForNew: boolean;
  recentPayout: {
    amount: string;
    currency: string;
    paidAt: string;
  } | null;
}

interface Props {
  isOnline: boolean;
}

export function GuaranteeBanner({ isOnline }: Props) {
  const { theme } = useTheme();
  const [showPayoutToast, setShowPayoutToast] = useState(false);
  const [lastSeenPayoutId, setLastSeenPayoutId] = useState<string | null>(null);
  const pulseScale = useSharedValue(1);

  const { data: guaranteeStatus } = useQuery<GuaranteeStatus>({
    queryKey: ["/api/guarantee/status"],
    enabled: isOnline,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (guaranteeStatus?.recentPayout) {
      const payoutTime = new Date(guaranteeStatus.recentPayout.paidAt).getTime();
      const payoutId = `${payoutTime}`;
      
      if (payoutId !== lastSeenPayoutId) {
        setLastSeenPayoutId(payoutId);
        setShowPayoutToast(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        pulseScale.value = withSequence(
          withSpring(1.1),
          withSpring(1)
        );
        
        const timer = setTimeout(() => setShowPayoutToast(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [guaranteeStatus?.recentPayout]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  if (!isOnline) return null;

  if (showPayoutToast && guaranteeStatus?.recentPayout) {
    return (
      <Animated.View
        entering={FadeIn.duration(300)}
        exiting={FadeOut.duration(300)}
        style={[
          styles.payoutToast,
          { backgroundColor: Colors.travonyGreen },
        ]}
      >
        <Animated.View style={pulseStyle}>
          <Ionicons name="checkmark-circle" size={20} color="#fff" />
        </Animated.View>
        <View style={styles.payoutContent}>
          <ThemedText style={styles.payoutTitle}>Guarantee paid</ThemedText>
          <ThemedText style={styles.payoutAmount}>
            {guaranteeStatus.recentPayout.currency} {guaranteeStatus.recentPayout.amount} added
          </ThemedText>
        </View>
        <Pressable 
          onPress={() => setShowPayoutToast(false)}
          style={styles.dismissButton}
        >
          <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>
      </Animated.View>
    );
  }

  if (!guaranteeStatus?.active || !guaranteeStatus.guarantee) return null;

  return (
    <View style={[styles.banner, { backgroundColor: Colors.travonyGreen + "15" }]}>
      <View style={[styles.iconContainer, { backgroundColor: Colors.travonyGreen }]}>
        <Ionicons name="shield-checkmark" size={16} color="#fff" />
      </View>
      <View style={styles.textContainer}>
        <ThemedText style={[styles.guaranteeText, { color: Colors.travonyGreen }]}>
          Your first ride is guaranteed
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  iconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  textContainer: {
    flex: 1,
  },
  guaranteeText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  payoutToast: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    marginTop: Spacing.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  payoutContent: {
    flex: 1,
  },
  payoutTitle: {
    ...Typography.bodyMedium,
    color: "#fff",
    fontWeight: "700",
  },
  payoutAmount: {
    ...Typography.small,
    color: "rgba(255,255,255,0.9)",
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});
