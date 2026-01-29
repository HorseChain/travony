import { View, Text, StyleSheet } from "react-native";
import { Spacing } from "@/constants/theme";

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
          <Text style={styles.mapIconText}>📍</Text>
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
    backgroundColor: "#E8F5E9",
  },
  fallbackContent: {
    alignItems: "center",
    padding: Spacing.xl,
  },
  mapIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#00B14F",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  mapIconText: {
    fontSize: 36,
  },
  fallbackTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1A1A1A",
    marginBottom: Spacing.sm,
  },
  fallbackMessage: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    maxWidth: 280,
  },
  subtext: {
    fontSize: 12,
    color: "#999",
    textAlign: "center",
    marginTop: Spacing.sm,
  },
});
