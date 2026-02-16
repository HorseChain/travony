import React, { useEffect } from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeInDown,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

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
      return "#4FC3F7";
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
  const translateY = useSharedValue(100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (prompt) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 120, mass: 0.8 });
      opacity.value = withTiming(1, { duration: 300 });

      const timer = setTimeout(() => {
        onDismiss?.();
      }, 10000);

      return () => clearTimeout(timer);
    } else {
      translateY.value = withTiming(100, { duration: 250 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [prompt]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!prompt) {
    return null;
  }

  const accentColor = getAccentColor(prompt.type);
  const iconName = getPromptIcon(prompt.type);

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: theme.card },
        animatedStyle,
      ]}
      entering={FadeInDown.springify().damping(18)}
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
            <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
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
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    fontWeight: "400",
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
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
