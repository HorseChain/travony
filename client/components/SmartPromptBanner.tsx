import React, { useEffect, useRef } from "react";
import { View, StyleSheet, Pressable, Animated } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Typography, Colors, Spacing, BorderRadius } from "@/constants/theme";

interface SmartPromptBannerProps {
  prompt: {
    type: string;
    title: string;
    message: string;
    priority: string;
    actionLabel?: string;
    hubId?: string;
    metadata?: any;
  } | null;
  onAction?: () => void;
  onDismiss?: () => void;
}

const PROMPT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  high_yield_opportunity: "trending-up",
  vehicle_available: "car-outline",
  low_supply: "alert-circle-outline",
  demand_surge: "flash-outline",
};

function getPromptIcon(type: string): keyof typeof Ionicons.glyphMap {
  return PROMPT_ICONS[type] || "information-circle-outline";
}

function getAccentColor(type: string): string {
  switch (type) {
    case "high_yield_opportunity":
      return Colors.travonyGreen;
    case "vehicle_available":
      return Colors.heatmapLow;
    case "low_supply":
      return Colors.dark.warning;
    case "demand_surge":
      return Colors.dark.error;
    default:
      return Colors.travonyGreen;
  }
}

export default function SmartPromptBanner({
  prompt,
  onAction,
  onDismiss,
}: SmartPromptBannerProps) {
  const { theme } = useTheme();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    try {
      if (prompt) {
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

        const timer = setTimeout(() => {
          onDismiss?.();
        }, 10000);

        return () => clearTimeout(timer);
      } else {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
      }
    } catch (e) {}
  }, [prompt]);

  if (!prompt) {
    return null;
  }

  const accentColor = getAccentColor(prompt.type);
  const iconName = getPromptIcon(prompt.type);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.card, opacity },
      ]}
    >
      <View style={[styles.accentStripe, { backgroundColor: accentColor }]} />

      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={[styles.iconCircle, { backgroundColor: accentColor + "1A" }]}>
            <Ionicons name={iconName} size={20} color={accentColor} />
          </View>
          <View style={styles.textContent}>
            <ThemedText style={[styles.title, { color: theme.text }]}>
              {prompt.title}
            </ThemedText>
            <ThemedText
              style={[styles.message, { color: theme.textSecondary }]}
              numberOfLines={2}
            >
              {prompt.message}
            </ThemedText>
          </View>
          <Pressable onPress={onDismiss} style={styles.dismissButton} hitSlop={8}>
            <Ionicons name="close" size={18} color={theme.textMuted} />
          </Pressable>
        </View>

        {prompt.actionLabel ? (
          <Pressable
            onPress={onAction}
            style={[styles.actionButton, { backgroundColor: accentColor }]}
          >
            <ThemedText style={styles.actionText}>{prompt.actionLabel}</ThemedText>
            <Ionicons name="arrow-forward" size={14} color={Colors.light.textOnPrimary} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  accentStripe: {
    height: 3,
    width: "100%",
  },
  content: {
    padding: Spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  textContent: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  title: {
    ...Typography.bodySmallBold,
    marginBottom: 2,
  },
  message: {
    ...Typography.labelLight,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    marginTop: Spacing.md,
    gap: 6,
  },
  actionText: {
    color: Colors.light.textOnPrimary,
    ...Typography.bodyBold,
  },
});
