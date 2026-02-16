import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Platform, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Colors, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";

interface HotspotData {
  lat: number;
  lng: number;
  intensity: number;
  supplyCount: number;
  demandCount: number;
  yieldEstimate?: number;
}

interface HeatmapOverlayProps {
  hotspots: HotspotData[];
  visible?: boolean;
  onHotspotPress?: (hotspot: HotspotData) => void;
}

const INTENSITY_COLORS = {
  low: "#4FC3F7",
  medium: "#FFA726",
  high: "#EF5350",
};

function getIntensityColor(intensity: number): string {
  if (intensity < 0.4) return INTENSITY_COLORS.low;
  if (intensity < 0.7) return INTENSITY_COLORS.medium;
  return INTENSITY_COLORS.high;
}

function getIntensitySize(intensity: number): number {
  return 40 + intensity * 40;
}

function HotspotMarker({
  hotspot,
  onPress,
}: {
  hotspot: HotspotData;
  onPress?: (hotspot: HotspotData) => void;
}) {
  const { theme } = useTheme();
  const pulseOpacity = useSharedValue(0.3);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const color = getIntensityColor(hotspot.intensity);
  const size = getIntensitySize(hotspot.intensity);

  const handlePress = () => {
    setShowInfo(!showInfo);
    onPress?.(hotspot);
  };

  return (
    <Pressable onPress={handlePress} style={styles.hotspotContainer}>
      <Animated.View
        style={[
          styles.hotspotCircle,
          animatedStyle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: color,
          },
        ]}
      />
      <View
        style={[
          styles.hotspotCenter,
          {
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: (size * 0.4) / 2,
            backgroundColor: color,
          },
        ]}
      />
      {showInfo ? (
        <View style={[styles.infoTooltip, { backgroundColor: theme.card }]}>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Supply
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {hotspot.supplyCount}
            </ThemedText>
          </View>
          <View style={styles.infoRow}>
            <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
              Demand
            </ThemedText>
            <ThemedText style={[styles.infoValue, { color: theme.text }]}>
              {hotspot.demandCount}
            </ThemedText>
          </View>
          {hotspot.yieldEstimate != null ? (
            <View style={styles.infoRow}>
              <ThemedText style={[styles.infoLabel, { color: theme.textSecondary }]}>
                Yield
              </ThemedText>
              <ThemedText style={[styles.infoValue, { color: Colors.travonyGreen }]}>
                ${hotspot.yieldEstimate.toFixed(0)}/hr
              </ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export function HeatmapLegend() {
  const { theme } = useTheme();

  return (
    <View style={[styles.legendContainer, { backgroundColor: theme.card }]}>
      <ThemedText style={[styles.legendTitle, { color: theme.textSecondary }]}>
        Demand Level
      </ThemedText>
      <View style={styles.legendScale}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: INTENSITY_COLORS.low }]} />
          <ThemedText style={[styles.legendLabel, { color: theme.textMuted }]}>
            Low
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: INTENSITY_COLORS.medium }]} />
          <ThemedText style={[styles.legendLabel, { color: theme.textMuted }]}>
            Medium
          </ThemedText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: INTENSITY_COLORS.high }]} />
          <ThemedText style={[styles.legendLabel, { color: theme.textMuted }]}>
            High
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

export default function HeatmapOverlay({
  hotspots,
  visible = true,
  onHotspotPress,
}: HeatmapOverlayProps) {
  const sortedHotspots = useMemo(
    () => [...hotspots].sort((a, b) => a.intensity - b.intensity),
    [hotspots]
  );

  if (!visible || hotspots.length === 0) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {sortedHotspots.map((hotspot, index) => (
        <HotspotMarker
          key={`hotspot-${index}-${hotspot.lat}-${hotspot.lng}`}
          hotspot={hotspot}
          onPress={onHotspotPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  hotspotContainer: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  hotspotCircle: {
    position: "absolute",
  },
  hotspotCenter: {
    opacity: 0.9,
  },
  infoTooltip: {
    position: "absolute",
    top: -80,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 12,
    minWidth: 120,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "400",
    marginRight: Spacing.sm,
  },
  infoValue: {
    fontSize: 12,
    fontWeight: "600",
  },
  legendContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
      default: {},
    }),
  },
  legendTitle: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  legendScale: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: "500",
  },
});
