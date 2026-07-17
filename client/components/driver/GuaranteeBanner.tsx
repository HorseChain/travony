import { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Platform, Pressable, Animated } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
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
  const pulseScale = useRef(new Animated.Value(1)).current;
  const payoutOpacity = useRef(new Animated.Value(0)).current;

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
        
        Animated.sequence([
          Animated.spring(pulseScale, { toValue: 1.1, useNativeDriver: true }),
          Animated.spring(pulseScale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        
        const timer = setTimeout(() => setShowPayoutToast(false), 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [guaranteeStatus?.recentPayout]);

  useEffect(() => {
    Animated.timing(payoutOpacity, { toValue: showPayoutToast ? 1 : 0, duration: 300, useNativeDriver: true }).start();
  }, [showPayoutToast]);

  if (!isOnline) return null;

  if (showPayoutToast && guaranteeStatus?.recentPayout) {
    return (
      <Animated.View
        style={[
          styles.payoutToast,
          { backgroundColor: Colors.travonyGreen, opacity: payoutOpacity },
        ]}
      >
        <Animated.View style={{ transform: [{ scale: pulseScale }] }}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.light.textOnPrimary} />
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
        <Ionicons name="shield-checkmark" size={16} color={Colors.light.textOnPrimary} />
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
    ...Typography.bodyBold,
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
        shadowColor: Colors.black,
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
    ...Typography.bodyHeavy,
    color: Colors.light.textOnPrimary,
  },
  payoutAmount: {
    ...Typography.small,
    color: "rgba(255,255,255,0.9)",
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});
