import React, { ReactNode, useRef } from "react";
import {
  StyleSheet,
  Pressable,
  ViewStyle,
  StyleProp,
  Animated,
  ActivityIndicator,
  Platform,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

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
 *
 * Primary and danger get a subtle vertical gradient + tinted shadow so
 * they feel dimensional; secondary is a soft filled chip; ghost is a
 * hairline-outlined glass pill.
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
  const { theme, isDark } = useTheme();
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

  const variantStyles: Record<
    ButtonVariant,
    {
      bg: string;
      text: string;
      borderColor?: string;
      gradient?: [string, string];
      shadowColor?: string;
    }
  > = {
    primary: {
      bg: theme.primary,
      text: theme.buttonText,
      gradient: [theme.primaryLight, theme.primaryDark],
      shadowColor: theme.primary,
    },
    secondary: {
      bg: isDark ? theme.backgroundTertiary : theme.backgroundSecondary,
      text: theme.text,
    },
    ghost: {
      bg: "transparent",
      text: theme.primary,
      borderColor: theme.border,
    },
    danger: {
      bg: theme.error,
      text: theme.buttonText,
      gradient: isDark ? ["#F26461", "#D63230"] : ["#EF5350", "#C62828"],
      shadowColor: theme.error,
    },
  };
  const v = variantStyles[variant];

  const shadowStyle: ViewStyle | undefined =
    v.shadowColor && !inactive
      ? Platform.select({
          ios: {
            shadowColor: v.shadowColor,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.28,
            shadowRadius: 12,
          },
          android: { elevation: 4 },
          default: {},
        })
      : undefined;

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
          borderWidth: v.borderColor ? 1 : 0,
          borderColor: v.borderColor,
          opacity: disabled ? Opacity.disabled : 1,
          transform: [{ scale }],
        },
        shadowStyle,
        style,
      ]}
    >
      {v.gradient ? (
        <LinearGradient
          colors={v.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={[StyleSheet.absoluteFill, styles.gradientFill]}
          pointerEvents="none"
        />
      ) : null}
      {v.gradient ? (
        <View pointerEvents="none" style={styles.gloss} />
      ) : null}
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <ThemedText
          type="body"
          style={[
            styles.buttonText,
            size === "sm" ? styles.buttonTextSm : null,
            { color: v.text },
          ]}
        >
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
    overflow: "hidden",
  },
  buttonSm: {
    height: 40,
    paddingHorizontal: Spacing.lg,
  },
  gradientFill: {
    borderRadius: BorderRadius.full,
  },
  gloss: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: "50%",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderTopLeftRadius: BorderRadius.full,
    borderTopRightRadius: BorderRadius.full,
  },
  buttonText: {
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  buttonTextSm: {
    fontSize: 14,
  },
});
