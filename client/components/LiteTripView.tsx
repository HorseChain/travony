import React from "react";
import { StyleSheet, View } from "react-native";
import type { DimensionValue } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface LiteTripViewProps {
  pickupAddress?: string | null;
  dropoffAddress?: string | null;
  statusTitle?: string;
  statusSubtitle?: string;
  eta?: number | null;
  distance?: number | null;
  height?: DimensionValue;
  style?: any;
}

/**
 * Lightweight, data-free replacement for the live map used in Lite mode. Shows
 * the pickup, drop-off and trip status as plain text so booking and driving keep
 * working on slow connections without streaming any map tiles.
 */
export default function LiteTripView({
  pickupAddress,
  dropoffAddress,
  statusTitle,
  statusSubtitle,
  eta,
  distance,
  height = "100%",
  style,
}: LiteTripViewProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[styles.container, { height, backgroundColor: theme.backgroundDefault }, style]}
    >
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.liteRow}>
          <Ionicons name="flash-outline" size={14} color={Colors.travonyGreen} />
          <ThemedText style={[styles.liteTag, { color: Colors.travonyGreen }]}>
            Lite mode · map off to save data
          </ThemedText>
        </View>

        {statusTitle ? (
          <ThemedText style={styles.statusTitle}>{statusTitle}</ThemedText>
        ) : null}
        {statusSubtitle ? (
          <ThemedText style={[styles.statusSubtitle, { color: theme.textSecondary }]}>
            {statusSubtitle}
          </ThemedText>
        ) : null}

        <View style={styles.routeBlock}>
          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: Colors.travonyGreen }]} />
            <View style={styles.routeTextWrap}>
              <ThemedText style={[styles.routeLabel, { color: theme.textMuted }]}>
                Pickup
              </ThemedText>
              <ThemedText style={styles.routeText} numberOfLines={2}>
                {pickupAddress || "Not set"}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.connector, { backgroundColor: theme.border }]} />

          <View style={styles.routeRow}>
            <View style={[styles.dot, { backgroundColor: theme.error }]} />
            <View style={styles.routeTextWrap}>
              <ThemedText style={[styles.routeLabel, { color: theme.textMuted }]}>
                Drop-off
              </ThemedText>
              <ThemedText style={styles.routeText} numberOfLines={2}>
                {dropoffAddress || "Not set"}
              </ThemedText>
            </View>
          </View>
        </View>

        {eta || distance ? (
          <View style={[styles.metaRow, { borderTopColor: theme.border }]}>
            {eta ? (
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={15} color={theme.textSecondary} />
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {eta} min
                </ThemedText>
              </View>
            ) : null}
            {distance ? (
              <View style={styles.metaItem}>
                <Ionicons name="navigate-outline" size={15} color={theme.textSecondary} />
                <ThemedText style={[styles.metaText, { color: theme.textSecondary }]}>
                  {distance.toFixed(1)} km
                </ThemedText>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.lg,
  },
  card: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  liteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  liteTag: {
    ...Typography.small,
    fontWeight: "600",
  },
  statusTitle: {
    ...Typography.h4,
    marginBottom: 2,
  },
  statusSubtitle: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  routeBlock: {
    marginTop: Spacing.xs,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.md,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 3,
  },
  routeTextWrap: {
    flex: 1,
  },
  routeLabel: {
    ...Typography.caption,
    marginBottom: 1,
  },
  routeText: {
    ...Typography.body,
    fontWeight: "500",
  },
  connector: {
    width: 2,
    height: 18,
    marginLeft: 5,
    marginVertical: 2,
  },
  metaRow: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginTop: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  metaText: {
    ...Typography.small,
    fontWeight: "600",
  },
});
