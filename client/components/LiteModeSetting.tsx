import React from "react";
import { StyleSheet, View, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useLiteMode, LitePreference } from "@/hooks/useLiteMode";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

const OPTIONS: { key: LitePreference; label: string }[] = [
  { key: "auto", label: "Auto" },
  { key: "on", label: "On" },
  { key: "off", label: "Off" },
];

/**
 * Shared Lite mode control used in both rider and driver settings. Lets the user
 * pick Auto (turn on automatically on slow connections), always On, or Off.
 * The choice is remembered between sessions.
 */
export function LiteModeSetting() {
  const { theme } = useTheme();
  const { preference, setPreference, liteMode, slowConnection } = useLiteMode();

  let statusLine = "Lighter screens and less data use.";
  if (preference === "auto") {
    statusLine = slowConnection
      ? "Auto: slow connection detected, Lite mode is on."
      : "Auto: turns on automatically on slow connections.";
  } else if (preference === "on") {
    statusLine = "Always on. Maps are replaced with a text view to save data.";
  } else {
    statusLine = "Off. Full maps and live updates are used.";
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.backgroundElevated }]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: Colors.travonyGreen + "20" }]}>
          <Ionicons name="flash-outline" size={20} color={Colors.travonyGreen} />
        </View>
        <View style={styles.content}>
          <View style={styles.labelRow}>
            <ThemedText style={styles.label}>Lite Mode</ThemedText>
            {liteMode ? (
              <View style={[styles.badge, { backgroundColor: Colors.travonyGreen }]}>
                <ThemedText style={styles.badgeText}>ACTIVE</ThemedText>
              </View>
            ) : null}
          </View>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {statusLine}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.segment, { backgroundColor: theme.backgroundDefault }]}>
        {OPTIONS.map((opt) => {
          const selected = preference === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => setPreference(opt.key)}
              style={[
                styles.segmentItem,
                selected && { backgroundColor: Colors.travonyGreen },
              ]}
            >
              <ThemedText
                style={[
                  styles.segmentText,
                  { color: selected ? "#FFFFFF" : theme.textSecondary },
                ]}
              >
                {opt.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  content: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  label: {
    ...Typography.body,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.caption,
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 10,
  },
  subtitle: {
    ...Typography.small,
    marginTop: 1,
  },
  segment: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 3,
    marginTop: Spacing.md,
    gap: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.xs + 2,
    alignItems: "center",
    borderRadius: BorderRadius.sm,
  },
  segmentText: {
    ...Typography.small,
    fontWeight: "600",
  },
});
