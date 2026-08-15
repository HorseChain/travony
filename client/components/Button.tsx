import React, { ReactNode, useRef } from "react";
import {
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
  Animated,
  ActivityIndicator,
} from "react-native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Motion, Opacity } from "@/constants/theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  /** Shows a spinner and blocks presses. */
  loading?: boolean;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * The one app button. All variants share the same press spring
 * (Motion.spring / Motion.pressScale) and disabled/loading treatment so
 * every press in the app feels identical.
 */
export function Button({
  onPress,
  children,
  style,
  disabled = false,
  loading = false,
  variant = "primary",
  size = "md",
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const inactive = disabled || loading;

  const handlePressIn = () => {
    if (!inactive) {
      Animated.spring(scale, {
        toValue: Motion.pressScale,
        useNativeDriver: true,
        ...Motion.spring,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!inactive) {
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, ...Motion.spring }).start();
    }
  };

  const variantStyles: Record<ButtonVariant, { bg: string; text: string; borderColor?: string }> = {
    primary: { bg: theme.primary, text: theme.buttonText },
    secondary: { bg: theme.backgroundSecondary, text: theme.text },
    ghost: { bg: "transparent", text: theme.primary, borderColor: theme.border },
    danger: { bg: theme.error, text: theme.buttonText },
  };
  const v = variantStyles[variant];

  return (
    <AnimatedPressable
      onPress={inactive ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={inactive}
      style={[
        styles.button,
        size === "sm" ? styles.buttonSm : null,
        {
          backgroundColor: v.bg,
          borderWidth: v.borderColor ? StyleSheet.hairlineWidth : 0,
          borderColor: v.borderColor,
          opacity: disabled ? Opacity.disabled : 1,
          transform: [{ scale }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <ThemedText type="body" style={[styles.buttonText, { color: v.text }]}>
          {children}
        </ThemedText>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  buttonSm: {
    height: 40,
    paddingHorizontal: Spacing.lg,
  },
  buttonText: {
    fontWeight: "600",
  },
});
