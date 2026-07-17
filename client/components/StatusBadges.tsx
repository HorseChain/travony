import React from "react";
import { View, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";

export interface StatusBadge {
  kind: string;
  label: string;
}

// These only render existing trust/reputation state supplied by the server —
// the app never invents badge types here.
const BADGE_META: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  verified: { icon: "checkmark-circle", color: Colors.travonyGreen },
  rating: { icon: "star", color: Colors.travonyGold },
  top_rated: { icon: "trophy", color: Colors.travonyGold },
  founding_driver: { icon: "flag", color: Colors.reactionLike },
  city_champion: { icon: "ribbon", color: Colors.cityChampion },
  prestige: { icon: "shield-checkmark", color: Colors.prestige },
  prayer_volunteer: { icon: "heart", color: Colors.reactionLove },
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
