import React from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

export interface StatusBadge {
  kind: string;
  label: string;
}

// These only render existing trust/reputation state supplied by the server —
// the app never invents badge types here.
const BADGE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  verified: { icon: "checkmark-circle", color: "#00B14F" },
  rating: { icon: "star", color: "#F5A623" },
  top_rated: { icon: "trophy", color: "#F5A623" },
  founding_driver: { icon: "flag", color: "#4285F4" },
  city_champion: { icon: "ribbon", color: "#8E44AD" },
  prestige: { icon: "shield-checkmark", color: "#00A3A3" },
  prayer_volunteer: { icon: "heart", color: "#E0518F" },
};

export function StatusBadges({
  badges,
  size = "sm",
}: {
  badges?: StatusBadge[] | null;
  size?: "sm" | "md";
}) {
  const { theme } = useTheme();
  if (!badges || badges.length === 0) return null;
  const iconSize = size === "md" ? 14 : 12;
  const fontSize = size === "md" ? 12 : 11;

  return (
    <View style={styles.row}>
      {badges.map((b, i) => {
        const meta = BADGE_META[b.kind] || { icon: "pricetag" as const, color: theme.primary };
        return (
          <View
            key={`${b.kind}-${i}`}
            style={[styles.chip, { backgroundColor: theme.backgroundSecondary }]}
          >
            <Ionicons name={meta.icon} size={iconSize} color={meta.color} />
            <ThemedText style={[styles.chipText, { fontSize }]}>{b.label}</ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  chipText: {
    fontWeight: "600",
  },
});
