import React, { ReactNode, useEffect } from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius, Motion } from "@/constants/theme";

/**
 * Designed empty/error states — every state gets an icon, a headline, one
 * supporting line, and (when there is a sensible next step) a single action.
 * Use these instead of raw error text or bare spinners.
 *
 * The icon medallion springs in first, then the text and action cascade up —
 * even a "nothing here" moment should feel deliberate.
 */

interface StateViewProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body?: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Render on a dark/video surface (live screens). */
  onDark?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

function StateView({
  icon = "sparkles-outline",
  title,
  body,
  actionLabel,
  onAction,
  onDark = false,
  style,
  children,
  tint,
}: StateViewProps & { tint: string }) {
  const { theme, isDark } = useTheme();
  const titleColor = onDark ? "#fff" : theme.text;
  const bodyColor = onDark ? "rgba(255,255,255,0.7)" : theme.textSecondary;

  const iconScale = useSharedValue(0.5);
  const iconOpacity = useSharedValue(0);
  const textShift = useSharedValue(12);
  const textOpacity = useSharedValue(0);

  useEffect(() => {
    iconScale.value = withSpring(1, { damping: 12, stiffness: 160 });
    iconOpacity.value = withTiming(1, { duration: Motion.duration.base });
    textShift.value = withDelay(
      100,
      withSpring(0, { damping: 16, stiffness: 180 }),
    );
    textOpacity.value = withDelay(
      100,
      withTiming(1, { duration: Motion.duration.slow }),
    );
  }, [iconScale, iconOpacity, textShift, textOpacity]);

  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconOpacity.value,
    transform: [{ scale: iconScale.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textShift.value }],
  }));

  return (
    <View style={[styles.container, style]}>
      <Animated.View style={iconStyle}>
        <View
          style={[
            styles.iconHalo,
            { backgroundColor: tint + (isDark ? "10" : "0C") },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: tint + "1A" }]}>
            <Ionicons name={icon} size={28} color={tint} />
          </View>
        </View>
      </Animated.View>
      <Animated.View style={[styles.textBlock, textStyle]}>
        <ThemedText style={[styles.title, { color: titleColor }]}>
          {title}
        </ThemedText>
        {body ? (
          <ThemedText style={[styles.body, { color: bodyColor }]}>
            {body}
          </ThemedText>
        ) : null}
        {children}
        {actionLabel && onAction ? (
          <Button size="sm" onPress={onAction} style={styles.action}>
            {actionLabel}
          </Button>
        ) : null}
      </Animated.View>
    </View>
  );
}

export function EmptyState(props: StateViewProps) {
  const { theme } = useTheme();
  return <StateView {...props} tint={theme.primary} />;
}

export function ErrorState({
  icon = "cloud-offline-outline",
  title = "Something went wrong",
  actionLabel = "Try again",
  ...rest
}: Partial<StateViewProps> & { onAction?: () => void }) {
  const { theme } = useTheme();
  return (
    <StateView
      icon={icon}
      title={title}
      actionLabel={rest.onAction ? actionLabel : undefined}
      {...rest}
      tint={theme.error}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["2xl"],
  },
  iconHalo: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  textBlock: {
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    ...Typography.h4,
    textAlign: "center",
    letterSpacing: -0.2,
  },
  body: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  action: {
    marginTop: Spacing.md,
    minWidth: 148,
  },
});
