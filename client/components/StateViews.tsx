import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle, StyleProp } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";

/**
 * Designed empty/error states — every state gets an icon, a headline, one
 * supporting line, and (when there is a sensible next step) a single action.
 * Use these instead of raw error text or bare spinners.
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
  const { theme } = useTheme();
  const titleColor = onDark ? "#fff" : theme.text;
  const bodyColor = onDark ? "rgba(255,255,255,0.7)" : theme.textSecondary;

  return (
    <View style={[styles.container, style]}>
      <View style={[styles.iconCircle, { backgroundColor: tint + "18" }]}>
        <Ionicons name={icon} size={30} color={tint} />
      </View>
      <ThemedText style={[styles.title, { color: titleColor }]}>{title}</ThemedText>
      {body ? <ThemedText style={[styles.body, { color: bodyColor }]}>{body}</ThemedText> : null}
      {children}
      {actionLabel && onAction ? (
        <Button size="sm" onPress={onAction} style={styles.action}>
          {actionLabel}
        </Button>
      ) : null}
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
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  title: {
    ...Typography.h4,
    textAlign: "center",
  },
  body: {
    ...Typography.small,
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    marginTop: Spacing.md,
    minWidth: 140,
  },
});
