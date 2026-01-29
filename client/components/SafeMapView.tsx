import React, { useState, useEffect, useRef } from "react";
import { View, StyleSheet, Platform, ActivityIndicator } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography } from "@/constants/theme";

let MapViewComponent: any = null;
let mapsAvailable = false;

try {
  if (Platform.OS !== "web") {
    const Maps = require("react-native-maps");
    MapViewComponent = Maps.default;
    mapsAvailable = true;
  }
} catch (e) {
  console.log("Maps not available:", e);
  mapsAvailable = false;
}

interface SafeMapViewProps {
  currentLocation?: { lat: number; lng: number } | null;
  style?: any;
}

export function SafeMapView({ currentLocation, style }: SafeMapViewProps) {
  const { theme } = useTheme();
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setIsReady(true);
      }
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  if (Platform.OS === "web" || !mapsAvailable || !MapViewComponent) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: theme.backgroundElevated }]}>
        <Ionicons name="map-outline" size={48} color={theme.primary} />
        <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
          Map available in Expo Go app
        </ThemedText>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: theme.backgroundElevated }]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
        <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
          Preparing map...
        </ThemedText>
      </View>
    );
  }

  if (hasError) {
    return (
      <View style={[styles.fallback, style, { backgroundColor: theme.backgroundElevated }]}>
        <Ionicons name="warning-outline" size={48} color={theme.error} />
        <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
          Map unavailable
        </ThemedText>
      </View>
    );
  }

  try {
    return (
      <MapViewComponent
        style={[styles.map, style]}
        initialRegion={{
          latitude: currentLocation?.lat || 25.2048,
          longitude: currentLocation?.lng || 55.2708,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation
        showsMyLocationButton
        onError={() => setHasError(true)}
      />
    );
  } catch (error) {
    console.error("Map render error:", error);
    return (
      <View style={[styles.fallback, style, { backgroundColor: theme.backgroundElevated }]}>
        <Ionicons name="warning-outline" size={48} color={theme.error} />
        <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
          Map unavailable
        </ThemedText>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  fallback: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  fallbackText: {
    ...Typography.body,
  },
});
