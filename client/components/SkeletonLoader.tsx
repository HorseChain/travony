import { View, StyleSheet } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, Easing } from "react-native-reanimated";
import { useEffect } from "react";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

function SkeletonBlock({ width = "100%", height = 16, borderRadius = 8, style }: SkeletonProps) {
  const { theme } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius, backgroundColor: theme.backgroundSecondary },
        animatedStyle,
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
        <SkeletonBlock width={120} height={20} />
        <SkeletonBlock width={100} height={14} style={{ marginTop: 8 }} />
      </View>
      <View style={skeletonStyles.mapSkeleton}>
        <SkeletonBlock width="100%" height={300} borderRadius={BorderRadius.lg} />
      </View>
      <View style={skeletonStyles.bottomSkeleton}>
        <SkeletonBlock width="100%" height={48} borderRadius={BorderRadius.md} />
        <SkeletonBlock width="60%" height={14} style={{ marginTop: 12 }} />
      </View>
    </View>
  );
}

export function DriverHomeSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={[skeletonStyles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={skeletonStyles.statusSkeleton}>
        <SkeletonBlock width="50%" height={18} />
        <SkeletonBlock width="70%" height={12} style={{ marginTop: 8 }} />
        <View style={skeletonStyles.yieldRow}>
          <SkeletonBlock width="40%" height={12} />
          <SkeletonBlock width={80} height={20} />
        </View>
      </View>
      <View style={skeletonStyles.mapSkeleton}>
        <SkeletonBlock width="100%" height={300} borderRadius={BorderRadius.lg} />
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
          <SkeletonBlock width="30%" height={80} borderRadius={BorderRadius.md} />
          <SkeletonBlock width="30%" height={80} borderRadius={BorderRadius.md} />
          <SkeletonBlock width="30%" height={80} borderRadius={BorderRadius.md} />
        </View>
      </View>
      <SkeletonBlock width="100%" height={120} borderRadius={BorderRadius.md} style={{ marginBottom: Spacing.lg }} />
      <SkeletonBlock width="40%" height={18} style={{ marginBottom: Spacing.md }} />
      <SkeletonBlock width="100%" height={48} borderRadius={BorderRadius.sm} style={{ marginBottom: Spacing.sm }} />
      <SkeletonBlock width="100%" height={48} borderRadius={BorderRadius.sm} style={{ marginBottom: Spacing.sm }} />
      <SkeletonBlock width="100%" height={48} borderRadius={BorderRadius.sm} />
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
  },
  yieldRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
});
