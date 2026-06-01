import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { useTheme } from "@/hooks/useTheme";

type Theme = ReturnType<typeof useTheme>["theme"];

export interface HubCardData {
  id: string;
  name: string;
  type: string;
  distance?: number;
  demandScore: number;
  demandLevel?: string;
  stagedCount?: number;
  activeDrivers?: number;
  recentRides?: number;
  yieldEstimate?: number;
  description?: string;
  lat?: number;
  lng?: number;
  address?: string;
  isEvHub?: boolean;
  evPortsAvailable?: number;
  evPortsTotal?: number;
  availablePorts?: number;
  totalChargingPorts?: number;
}

const HUB_TYPE_LABELS: Record<string, string> = {
  station: "Station",
  park: "Park",
  coworking: "Coworking",
  coffee_shop: "Coffee",
  mall: "Mall",
  airport: "Airport",
  university: "University",
  hospital: "Hospital",
  custom: "Hub",
};

const HUB_TYPE_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  station: "train-outline",
  park: "leaf-outline",
  coworking: "business-outline",
  coffee_shop: "cafe-outline",
  mall: "cart-outline",
  airport: "airplane-outline",
  university: "school-outline",
  hospital: "medkit-outline",
  custom: "location-outline",
};

export function getDemandColor(score: number): string {
  if (score >= 7) return Colors.travonyGreen;
  if (score >= 4) return Colors.travonyGold;
  if (score >= 1) return "#4FC3F7";
  return "#9E9E9E";
}

export function getDemandLabel(score: number): string {
  if (score >= 8) return "Very High";
  if (score >= 6) return "High";
  if (score >= 4) return "Moderate";
  if (score >= 1) return "Low";
  return "Idle";
}

function getHubIcon(type: string): keyof typeof Ionicons.glyphMap {
  return HUB_TYPE_ICONS[type] || "location-outline";
}

function getHubTypeLabel(type: string): string {
  return HUB_TYPE_LABELS[type] || "Hub";
}

interface EvPortBarProps {
  available: number;
  total: number;
  trackColor: string;
}

export function EvPortBar({ available, total, trackColor }: EvPortBarProps) {
  if (!total || total === 0) return null;
  const portColor = available === 0 ? "#FF6B6B" : available <= 2 ? Colors.travonyGold : Colors.travonyGreen;
  const occupiedPct = Math.min(100, Math.round(((total - available) / total) * 100));
  const freePct = 100 - occupiedPct;

  return (
    <View style={{ marginBottom: Spacing.sm }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="battery-charging-outline" size={12} color={portColor} />
          <ThemedText style={{ fontSize: 11, color: portColor, fontWeight: "600" }}>
            {available} / {total} ports free
          </ThemedText>
        </View>
        <ThemedText style={{ fontSize: 10, color: "#888" }}>
          {occupiedPct}% occupied
        </ThemedText>
      </View>
      <View style={[styles.portTrack, { backgroundColor: trackColor }]}>
        <View style={[styles.portFill, { flex: occupiedPct, backgroundColor: portColor + "60" }]} />
        <View style={[styles.portFill, { flex: freePct, backgroundColor: portColor }]} />
      </View>
    </View>
  );
}

interface HubCardProps {
  hub: HubCardData;
  variant: "driver" | "rider";
  onPress: () => void;
  onCheckIn?: () => void;
  theme: Theme;
}

export function HubCard({ hub, variant, onPress, onCheckIn, theme }: HubCardProps) {
  const score = typeof hub.demandScore === "number" ? hub.demandScore : parseFloat(String(hub.demandScore)) || 0;
  const demandColor = getDemandColor(score);
  const demandPct = Math.min(100, Math.round((score / 10) * 100));
  const typeLabel = hub.isEvHub ? "EV Hub" : getHubTypeLabel(hub.type);
  const typeIcon: keyof typeof Ionicons.glyphMap = hub.isEvHub ? "flash" : getHubIcon(hub.type);
  const iconBg = hub.isEvHub ? Colors.travonyGreen + "20" : theme.backgroundSecondary;
  const iconColor = hub.isEvHub ? Colors.travonyGreen : theme.primary;

  const evPortsAvail = hub.evPortsAvailable ?? hub.availablePorts ?? 0;
  const evPortsTotal = hub.evPortsTotal ?? hub.totalChargingPorts ?? 0;
  const staged = hub.stagedCount ?? hub.activeDrivers ?? 0;

  return (
    <Pressable onPress={onPress} style={[styles.hubCard, { backgroundColor: theme.backgroundDefault }]}>
      {hub.isEvHub ? (
        <View style={[styles.chargingBanner, { backgroundColor: Colors.travonyGreen + "15" }]}>
          <Ionicons name="flash" size={12} color={Colors.travonyGreen} />
          <ThemedText style={{ fontSize: 11, color: Colors.travonyGreen, fontWeight: "700" }}>
            Charging Available
          </ThemedText>
          {evPortsAvail > 0 ? (
            <ThemedText style={{ fontSize: 11, color: Colors.travonyGreen }}>
              {" "}\u00B7{" "}{evPortsAvail} ports free
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.hubCardHeader}>
        <View style={[styles.hubIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={typeIcon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1, marginLeft: Spacing.md }}>
          <ThemedText style={[styles.hubName, { color: theme.text }]} numberOfLines={1}>
            {hub.name}
          </ThemedText>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
            <View style={[styles.typeBadge, { backgroundColor: iconBg }]}>
              <ThemedText style={{ fontSize: 9, color: iconColor, fontWeight: "700" }}>
                {typeLabel.toUpperCase()}
              </ThemedText>
            </View>
            {hub.distance != null ? (
              <ThemedText style={[styles.hubDistance, { color: theme.textMuted }]}>
                {hub.distance < 1
                  ? `${Math.round(hub.distance * 1000)}m away`
                  : `${hub.distance.toFixed(1)}km away`}
              </ThemedText>
            ) : hub.address ? (
              <ThemedText style={[styles.hubDistance, { color: theme.textMuted }]} numberOfLines={1}>
                {hub.address.split(",")[0]}
              </ThemedText>
            ) : null}
          </View>
        </View>
        <View style={[styles.demandBadge, { backgroundColor: demandColor + "20" }]}>
          <View style={[styles.demandDot, { backgroundColor: demandColor }]} />
          <ThemedText style={[styles.demandBadgeText, { color: demandColor }]}>
            {getDemandLabel(score)}
          </ThemedText>
        </View>
      </View>

      {hub.isEvHub && evPortsTotal > 0 ? (
        <View style={{ marginTop: Spacing.sm }}>
          <EvPortBar available={evPortsAvail} total={evPortsTotal} trackColor={theme.backgroundSecondary} />
        </View>
      ) : null}

      {hub.description ? (
        <ThemedText style={[styles.hubDesc, { color: theme.textSecondary }]} numberOfLines={2}>
          {hub.description}
        </ThemedText>
      ) : null}

      <View style={[styles.hubDivider, { backgroundColor: theme.border }]} />

      <View style={styles.hubStats}>
        {variant === "driver" && hub.yieldEstimate != null && hub.yieldEstimate > 0 ? (
          <View style={styles.hubStat}>
            <ThemedText style={[styles.hubStatVal, { color: Colors.travonyGreen }]}>
              AED {hub.yieldEstimate.toFixed(0)}
            </ThemedText>
            <ThemedText style={[styles.hubStatLabel, { color: theme.textMuted }]}>Yield/hr</ThemedText>
          </View>
        ) : null}
        <View style={styles.hubStat}>
          <ThemedText style={[styles.hubStatVal, { color: theme.text }]}>
            {staged}
          </ThemedText>
          <ThemedText style={[styles.hubStatLabel, { color: theme.textMuted }]}>
            {variant === "driver" ? "Staged" : "Available"}
          </ThemedText>
        </View>
        {variant === "driver" ? (
          <View style={styles.hubStat}>
            <ThemedText style={[styles.hubStatVal, { color: theme.text }]}>
              {hub.recentRides ?? 0}
            </ThemedText>
            <ThemedText style={[styles.hubStatLabel, { color: theme.textMuted }]}>Rides</ThemedText>
          </View>
        ) : (
          <View style={styles.hubStat}>
            <ThemedText style={[styles.hubStatVal, { color: theme.text }]}>
              {staged > 0 ? "2-5" : "10+"}
            </ThemedText>
            <ThemedText style={[styles.hubStatLabel, { color: theme.textMuted }]}>Min ETA</ThemedText>
          </View>
        )}
        <View style={styles.hubStat}>
          <ThemedText style={[styles.hubStatVal, { color: demandColor }]}>
            {demandPct}%
          </ThemedText>
          <ThemedText style={[styles.hubStatLabel, { color: theme.textMuted }]}>Demand</ThemedText>
        </View>
      </View>

      <View style={styles.demandBarWrap}>
        <View style={[styles.demandBarTrack, { backgroundColor: theme.backgroundSecondary }]}>
          <View
            style={[
              styles.demandBarFill,
              { width: `${Math.max(2, demandPct)}%`, backgroundColor: demandColor },
            ]}
          />
        </View>
      </View>

      {onCheckIn ? (
        <Pressable
          onPress={onCheckIn}
          style={[styles.checkInBtn, { backgroundColor: hub.isEvHub ? Colors.travonyGreen : theme.primary }]}
        >
          <Ionicons name={hub.isEvHub ? "flash" : "log-in-outline"} size={16} color="#FFFFFF" />
          <ThemedText style={styles.checkInText}>
            {hub.isEvHub ? "EV Check-In" : "Check In"}
          </ThemedText>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chargingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: Spacing.sm,
    alignSelf: "flex-start",
  },
  hubCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius["2xl"],
    marginBottom: Spacing.md,
  },
  hubCardHeader: { flexDirection: "row", alignItems: "center" },
  hubIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  hubName: { fontSize: 15, fontWeight: "600" },
  hubDistance: { fontSize: 11 },
  typeBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hubDesc: { fontSize: 13, marginTop: Spacing.sm, lineHeight: 18 },
  hubDivider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.md },
  hubStats: { flexDirection: "row", justifyContent: "space-around", marginBottom: Spacing.md },
  hubStat: { alignItems: "center" },
  hubStatVal: { fontSize: 16, fontWeight: "700" },
  hubStatLabel: { fontSize: 10, marginTop: 2 },
  demandBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  demandDot: { width: 6, height: 6, borderRadius: 3 },
  demandBadgeText: { fontSize: 11, fontWeight: "700" },
  demandBarWrap: { marginBottom: Spacing.md },
  demandBarTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  demandBarFill: { height: 4, borderRadius: 2 },
  checkInBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: BorderRadius.sm,
    gap: 6,
  },
  checkInText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  portTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    flexDirection: "row",
  },
  portFill: { height: 6 },
});
