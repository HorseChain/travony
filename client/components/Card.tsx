import React, { useRef } from "react";
import {
  StyleSheet,
  Pressable,
  ViewStyle,
  Animated,
  Platform,
} from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Motion, Colors } from "@/constants/theme";

interface CardProps {
  elevation?: number;
  title?: string;
  description?: string;
  children?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

const getBackgroundColorForElevation = (
  elevation: number,
  theme: any,
): string => {
  switch (elevation) {
    case 1:
      return theme.backgroundDefault;
    case 2:
      return theme.backgroundSecondary;
    case 3:
      return theme.backgroundTertiary;
    default:
      return theme.backgroundRoot;
  }
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The one app card. Glassy edge treatment: a hairline highlight border
 * plus a soft ambient shadow so surfaces float rather than sit flat.
 * Pressable cards share the app-wide spring press.
 */
export function Card({
  elevation = 1,
  title,
  description,
  children,
  onPress,
  style,
}: CardProps) {
  const { theme, isDark } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;

  const cardBackgroundColor = getBackgroundColorForElevation(elevation, theme);

  const handlePressIn = () => {
    if (!onPress) return;
    Animated.spring(scale, {
      toValue: Motion.pressScale,
      useNativeDriver: true,
      ...Motion.spring,
    }).start();
  };

  const handlePressOut = () => {
    if (!onPress) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      ...Motion.spring,
    }).start();
  };

  const ambientShadow = Platform.select({
    ios: {
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.06,
      shadowRadius: 14,
    },
    android: { elevation: 2 },
    default: {},
  });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        ambientShadow,
        {
          backgroundColor: cardBackgroundColor,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: isDark
            ? "rgba(255,255,255,0.08)"
            : "rgba(0,0,0,0.05)",
          transform: [{ scale }],
        },
        style,
      ]}
    >
      {title ? (
        <ThemedText type="h4" style={styles.cardTitle}>
          {title}
        </ThemedText>
      ) : null}
      {description ? (
        <ThemedText
          type="small"
          style={[styles.cardDescription, { color: theme.textSecondary }]}
        >
          {description}
        </ThemedText>
      ) : null}
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
  },
  cardTitle: {
    marginBottom: Spacing.xs,
    letterSpacing: -0.2,
  },
  cardDescription: {
    lineHeight: 17,
  },
});
