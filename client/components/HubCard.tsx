import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

interface HubCardProps {
  hub: {
    id: string;
    name: string;
    type: string;
    distance?: number;
    demandScore: number;
    activeDrivers?: number;
    recentRides?: number;
    yieldEstimate?: number;
    description?: string;
  };
  variant: "driver" | "rider";
  onPress?: () => void;
  onCheckIn?: () => void;
}

const HUB_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  station: "train-outline",
  park: "leaf-outline",
  coworking: "business-outline",
  coffee_shop: "cafe-outline",
  mall: "cart-outline",
  airport: "airplane-outline",
  university: "school-outline",
  hospital: "medkit-outline",
};

function getHubIcon(type: string): keyof typeof Ionicons.glyphMap {
  return HUB_TYPE_ICONS[type] || "location-outline";
}

function getDemandLabel(score: number): string {
  if (score >= 0.8) return "Very High";
  if (score >= 0.6) return "High";
  if (score >= 0.4) return "Moderate";
  if (score >= 0.2) return "Low";
  return "Very Low";
}

function DemandBar({ score }: { score: number }) {
  const { theme } = useTheme();
  const clampedScore = Math.max(0, Math.min(1, score));

  return (
    <View style={styles.demandBarContainer}>
      <View style={[styles.demandBarTrack, { backgroundColor: theme.backgroundSecondary }]}>
        <View
          style={[
            styles.demandBarFill,
            {
              width: `${clampedScore * 100}%` as any,
              backgroundColor:
                clampedScore >= 0.7
                  ? Colors.travonyGreen
                  : clampedScore >= 0.4
                  ? Colors.travonyGold
                  : theme.textMuted,
            },
          ]}
        />
      </View>
      <ThemedText style={[styles.demandLabel, { color: theme.textSecondary }]}>
        {getDemandLabel(score)}
      </ThemedText>
    </View>
  );
}

export default function HubCard({ hub, variant, onPress, onCheckIn }: HubCardProps) {
  const { theme } = useTheme();

  const cardBg = theme.backgroundDefault;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: cardBg }]}
    >
      <View style={styles.header}>
        <View style={[styles.iconContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Ionicons name={getHubIcon(hub.type)} size={20} color={theme.primary} />
        </View>
        <View style={styles.headerInfo}>
          <ThemedText style={[styles.hubName, { color: theme.text }]}>
            {hub.name}
          </ThemedText>
          {hub.distance != null ? (
            <ThemedText style={[styles.distance, { color: theme.textMuted }]}>
              {hub.distance < 1
                ? `${Math.round(hub.distance * 1000)}m away`
                : `${hub.distance.toFixed(1)}km away`}
            </ThemedText>
          ) : null}
        </View>
      </View>

      {hub.description ? (
        <ThemedText
          style={[styles.description, { color: theme.textSecondary }]}
          numberOfLines={2}
        >
          {hub.description}
        </ThemedText>
      ) : null}

      <View style={[styles.divider, { backgroundColor: theme.border }]} />

      {variant === "driver" ? (
        <View style={styles.statsContainer}>
          {hub.yieldEstimate != null ? (
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
                ${hub.yieldEstimate.toFixed(0)}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
                Est. Yield/hr
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {hub.activeDrivers ?? 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
              Vehicles
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {hub.recentRides ?? 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
              Recent Rides
            </ThemedText>
          </View>
        </View>
      ) : (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: theme.text }]}>
              {hub.activeDrivers ?? 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
              Available
            </ThemedText>
          </View>
          <View style={styles.statItem}>
            <View style={styles.pickupTimeRow}>
              <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.statValue, { color: theme.text, marginLeft: 4 }]}>
                {hub.activeDrivers && hub.activeDrivers > 0 ? "2-5" : "10+"}
              </ThemedText>
            </View>
            <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
              Est. Pickup (min)
            </ThemedText>
          </View>
        </View>
      )}

      <DemandBar score={hub.demandScore} />

      {onCheckIn ? (
        <Pressable
          onPress={onCheckIn}
          style={[styles.checkInButton, { backgroundColor: theme.primary }]}
        >
          <Ionicons name="log-in-outline" size={16} color="#FFFFFF" />
          <ThemedText style={styles.checkInText}>Check In</ThemedText>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.xl,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  hubName: {
    ...Typography.h4,
  },
  distance: {
    fontSize: 12,
    fontWeight: "400",
    marginTop: 2,
  },
  description: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: Spacing.sm,
    lineHeight: 18,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.md,
  },
  statsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: Spacing.md,
  },
  statItem: {
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "400",
    marginTop: 2,
  },
  pickupTimeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  demandBarContainer: {
    marginBottom: Spacing.md,
  },
  demandBarTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  demandBarFill: {
    height: 4,
    borderRadius: 2,
  },
  demandLabel: {
    fontSize: 10,
    fontWeight: "500",
    marginTop: 4,
    textAlign: "right",
  },
  checkInButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  checkInText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
