import React, { Component, forwardRef, useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { Spacing } from "@/constants/theme";

let RNMapView: any = null;
let RNMarker: any = null;
let RNMarkerAnimated: any = null;
let RNPolyline: any = null;
let RN_PROVIDER_GOOGLE: any = null;
let RNAnimatedRegion: any = null;
let mapsLoadError: string | null = null;

try {
  const Maps = require("react-native-maps");
  RNMapView = Maps.default;
  RNMarker = Maps.Marker;
  RNMarkerAnimated = Maps.Marker?.Animated;
  RNPolyline = Maps.Polyline;
  RN_PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
  RNAnimatedRegion = Maps.AnimatedRegion;
} catch (error: any) {
  mapsLoadError = error?.message || "Maps not available";
  console.warn("react-native-maps load error:", error);
}

export const mapsAvailable = RNMapView !== null;

interface MapErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class MapErrorBoundary extends Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  MapErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: error?.message || "Map error" };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error("MapView error boundary caught:", error?.message);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

const MapFallbackView = ({ style, message }: { style?: any; message?: string }) => (
  <View style={[styles.fallbackContainer, style]}>
    <View style={styles.fallbackContent}>
      <View style={styles.mapIcon}>
        <Text style={styles.mapIconText}>📍</Text>
      </View>
      <Text style={styles.fallbackTitle}>Map View</Text>
      <Text style={styles.fallbackMessage}>
        {message || "Initializing map..."}
      </Text>
    </View>
  </View>
);

const SafeMapView = forwardRef((props: any, ref: any) => {
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!RNMapView) {
        setLoadError(mapsLoadError || "Google Maps not available");
      }
      setIsReady(true);
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.fallbackContainer, props.style]}>
        <ActivityIndicator size="large" color="#00B14F" />
        <Text style={styles.loadingText}>Loading map...</Text>
      </View>
    );
  }

  if (!RNMapView || loadError) {
    return <MapFallbackView style={props.style} message={loadError || "Map not available"} />;
  }

  const safeProps = {
    ...props,
    onMapReady: () => {
      try {
        props.onMapReady?.();
      } catch (e) {
        console.warn("onMapReady error:", e);
      }
    },
    onRegionChangeComplete: (region: any) => {
      try {
        props.onRegionChangeComplete?.(region);
      } catch (e) {
        console.warn("onRegionChangeComplete error:", e);
      }
    },
  };

  return (
    <MapErrorBoundary fallback={<MapFallbackView style={props.style} message="Map temporarily unavailable" />}>
      <RNMapView ref={ref} {...safeProps} />
    </MapErrorBoundary>
  );
});

const SafeMarker = (props: any) => {
  if (!RNMarker) return null;
  
  return (
    <MapErrorBoundary fallback={null}>
      <RNMarker {...props} />
    </MapErrorBoundary>
  );
};

const SafeMarkerAnimated = (props: any) => {
  if (!RNMarkerAnimated) return null;
  
  return (
    <MapErrorBoundary fallback={null}>
      <RNMarkerAnimated {...props} />
    </MapErrorBoundary>
  );
};

const SafePolyline = (props: any) => {
  if (!RNPolyline) return null;
  
  return (
    <MapErrorBoundary fallback={null}>
      <RNPolyline {...props} />
    </MapErrorBoundary>
  );
};

const MarkerWithAnimated = Object.assign(SafeMarker, { Animated: SafeMarkerAnimated });

export const MapView = SafeMapView;
export const Marker = MarkerWithAnimated;
export const Polyline = SafePolyline;
export const PROVIDER_GOOGLE = RN_PROVIDER_GOOGLE;
export const AnimatedRegion = RNAnimatedRegion;

interface WebMapFallbackProps {
  message?: string;
  style?: any;
}

export function WebMapFallback({ message, style }: WebMapFallbackProps) {
  return <MapFallbackView style={style} message={message} />;
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
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 14,
    color: "#666",
  },
});
