import { View, StyleSheet, Animated } from "react-native";
import { useEffect, useRef } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Motion } from "@/constants/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
  /** Stagger index — later blocks start their shimmer slightly delayed. */
  delay?: number;
}

/**
 * Breathing skeleton block. Every block shares one pulse rhythm
 * (Motion.duration.pulse) with a small per-block delay so the whole
 * screen shimmers like a wave instead of blinking in unison.
 */
function SkeletonBlock({
  width = "100%",
  height = 16,
  borderRadius = BorderRadius.xs,
  style,
  delay = 0,
}: SkeletonProps) {
  const { theme, isDark } = useTheme();
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: Motion.duration.pulse,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: Motion.duration.pulse,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: isDark
            ? theme.backgroundTertiary
            : theme.backgroundSecondary,
          opacity,
        },
        style,
      ]}
    />
  );
}

export function HomeScreenSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[skeletonStyles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={skeletonStyles.headerSkeleton}>
        <View style={skeletonStyles.headerRow}>
          <View>
            <SkeletonBlock width={132} height={22} borderRadius={BorderRadius.full} />
            <SkeletonBlock width={96} height={13} borderRadius={BorderRadius.full} style={{ marginTop: Spacing.sm }} delay={120} />
          </View>
          <SkeletonBlock width={40} height={40} borderRadius={BorderRadius.full} delay={200} />
        </View>
      </View>
      <View style={skeletonStyles.mapSkeleton}>
        <SkeletonBlock width="100%" height={300} borderRadius={BorderRadius.lg} delay={240} />
      </View>
      <View style={skeletonStyles.bottomSkeleton}>
        <SkeletonBlock width="100%" height={52} borderRadius={BorderRadius.full} delay={320} />
        <SkeletonBlock width="55%" height={13} borderRadius={BorderRadius.full} style={{ marginTop: Spacing.md, alignSelf: "center" }} delay={400} />
      </View>
    </View>
  );
}

export function DriverHomeSkeleton() {
  const { theme, isDark } = useTheme();
  return (
    <View style={[skeletonStyles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          skeletonStyles.statusSkeleton,
          {
            backgroundColor: theme.backgroundDefault,
            borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)",
          },
        ]}
      >
        <SkeletonBlock width="50%" height={18} borderRadius={BorderRadius.full} />
        <SkeletonBlock width="70%" height={12} borderRadius={BorderRadius.full} style={{ marginTop: Spacing.sm }} delay={120} />
        <View style={skeletonStyles.yieldRow}>
          <SkeletonBlock width="40%" height={12} borderRadius={BorderRadius.full} delay={200} />
          <SkeletonBlock width={84} height={24} borderRadius={BorderRadius.full} delay={280} />
        </View>
      </View>
      <View style={skeletonStyles.mapSkeleton}>
        <SkeletonBlock width="100%" height={300} borderRadius={BorderRadius.lg} delay={340} />
      </View>
    </View>
  );
}

export function SkeletonLoader() {
  const { theme } = useTheme();
  return (
    <View style={[skeletonStyles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={skeletonStyles.headerSkeleton}>
        <View style={{ flexDirection: "row", gap: Spacing.sm }}>
          <SkeletonBlock width="30%" height={84} borderRadius={BorderRadius.md} />
          <SkeletonBlock width="30%" height={84} borderRadius={BorderRadius.md} delay={100} />
          <SkeletonBlock width="30%" height={84} borderRadius={BorderRadius.md} delay={200} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={124} borderRadius={BorderRadius.md} style={{ marginBottom: Spacing.lg }} delay={280} />
      <SkeletonBlock width="40%" height={18} borderRadius={BorderRadius.full} style={{ marginBottom: Spacing.md }} delay={340} />
      <SkeletonBlock width="100%" height={52} borderRadius={BorderRadius.sm} style={{ marginBottom: Spacing.sm }} delay={400} />
      <SkeletonBlock width="100%" height={52} borderRadius={BorderRadius.sm} style={{ marginBottom: Spacing.sm }} delay={460} />
      <SkeletonBlock width="100%" height={52} borderRadius={BorderRadius.sm} delay={520} />
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  headerSkeleton: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  mapSkeleton: {
    flex: 1,
    marginBottom: Spacing.lg,
  },
  bottomSkeleton: {
    padding: Spacing.lg,
  },
  statusSkeleton: {
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  yieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
});
