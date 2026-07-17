import { View, Text, StyleSheet } from "react-native";
import { Typography, Spacing, Colors } from "@/constants/theme";

export const mapsAvailable = false;
export const MapView: any = null;
export const Marker: any = { Animated: null };
export const Polyline: any = null;
export const PROVIDER_GOOGLE: any = null;
export const AnimatedRegion: any = null;

interface WebMapFallbackProps {
  message?: string;
  style?: any;
}

export function WebMapFallback({ message = "Maps available in mobile app", style }: WebMapFallbackProps) {
  return (
    <View style={[styles.fallbackContainer, style]}>
      <View style={styles.fallbackContent}>
        <View style={styles.mapIcon}>
          <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: Colors.light.backgroundRoot }} />
        </View>
        <Text style={styles.fallbackTitle}>Map View</Text>
        <Text style={styles.fallbackMessage}>
          {message}
        </Text>
        <Text style={styles.subtext}>Open in Expo Go to view the interactive map</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fallbackContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: Colors.successLight,
  },
  fallbackContent: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  mapIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.travonyGreen,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  fallbackTitle: {
    ...Typography.xlBold,
    color: Colors.light.text,
    marginBottom: Spacing.sm,
  },
  fallbackMessage: {
    ...Typography.bodyMedium,
    color: Colors.gray,
    textAlign: "center",
    maxWidth: 280,
  },
  subtext: {
    ...Typography.small,
    color: Colors.light.textMuted,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
