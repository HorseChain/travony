import { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Platform, Pressable, Animated } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface Credit {
  id: string;
  creditType: string;
  amount: string;
  currency: string;
  reason: string | null;
  creditedAt: string;
  seen: boolean;
}

interface CreditsResponse {
  credits: Credit[];
  unseenCount: number;
}

const CREDIT_TYPE_LABELS: Record<string, string> = {
  eta_breach: "We were late",
  pickup_wait: "Your time matters",
  driver_cancel: "We respect your time",
  rider_cancel_late: "Your time matters",
  no_show: "Your time matters",
  ride_delay: "We were delayed",
  system_failure: "We made a mistake",
};

export function CreditToast() {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [currentCredit, setCurrentCredit] = useState<Credit | null>(null);
  const [visible, setVisible] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  const { data: creditsData } = useQuery<CreditsResponse>({
    queryKey: ["/api/credits/recent"],
    refetchInterval: 15000,
  });

  const markSeenMutation = useMutation({
    mutationFn: async (creditIds: string[]) => {
      return apiRequest("/api/credits/mark-seen", {
        method: "POST",
        body: JSON.stringify({ creditIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/credits/recent"] });
    },
  });

  useEffect(() => {
    if (creditsData?.credits) {
      const unseen = creditsData.credits.filter(c => !c.seen);
      if (unseen.length > 0 && !currentCredit) {
        const credit = unseen[0];
        setCurrentCredit(credit);
        setVisible(true);
        Animated.timing(toastOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}

        const timer = setTimeout(() => {
          Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
          markSeenMutation.mutate([credit.id]);
          setTimeout(() => {
            setVisible(false);
            setCurrentCredit(null);
          }, 350);
        }, 5000);

        return () => clearTimeout(timer);
      }
    }
  }, [creditsData?.credits]);

  const handleDismiss = () => {
    if (currentCredit) {
      Animated.timing(toastOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      markSeenMutation.mutate([currentCredit.id]);
      setTimeout(() => {
        setVisible(false);
        setCurrentCredit(null);
      }, 350);
    }
  };

  if (!visible || !currentCredit) return null;

  const label = CREDIT_TYPE_LABELS[currentCredit.creditType] || "Credit added";

  return (
    <Animated.View
      style={[styles.container, { backgroundColor: Colors.travonyGreen, opacity: toastOpacity }]}
    >
      <View style={styles.iconContainer}>
        <Ionicons name="wallet" size={20} color="#fff" />
      </View>
      <View style={styles.content}>
        <ThemedText style={styles.title}>{label}</ThemedText>
        <ThemedText style={styles.amount}>
          {currentCredit.currency} {currentCredit.amount} added to your wallet
        </ThemedText>
      </View>
      <Pressable onPress={handleDismiss} style={styles.dismissButton}>
        <Ionicons name="close" size={16} color="rgba(255,255,255,0.7)" />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 100,
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
    zIndex: 9999,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    flex: 1,
  },
  title: {
    ...Typography.bodyMedium,
    color: "#fff",
    fontWeight: "700",
  },
  amount: {
    ...Typography.small,
    color: "rgba(255,255,255,0.9)",
  },
  dismissButton: {
    padding: Spacing.xs,
  },
});
