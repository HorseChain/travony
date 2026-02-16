import React, { useRef, useEffect, useCallback, useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  interpolate,
  Easing,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { DimensionValue } from "react-native";
import { MapView, Marker, Polyline, PROVIDER_GOOGLE, AnimatedRegion, mapsAvailable, WebMapFallback } from "@/components/NativeMaps";

const isWeb = Platform.OS === ("web" as typeof Platform.OS);
const isNative = !isWeb;

interface Location {
  lat: number;
  lng: number;
  address?: string;
  heading?: number;
}

interface RideMapProps {
  pickupLocation?: Location | null;
  dropoffLocation?: Location | null;
  driverLocation?: Location | null;
  currentLocation?: Location | null;
  routeCoordinates?: Array<{ latitude: number; longitude: number }>;
  showUserLocation?: boolean;
  showRoute?: boolean;
  showDriverMarker?: boolean;
  onMapReady?: () => void;
  onRegionChange?: (region: any) => void;
  onMarkerPress?: (type: "pickup" | "dropoff" | "driver") => void;
  eta?: number;
  distance?: number;
  rideStatus?: string;
  interactive?: boolean;
  height?: DimensionValue;
  driverHeading?: number;
  vehicleType?: "car" | "motorcycle" | "auto" | "suv";
}

const TRAVONY_GREEN = Colors.travonyGreen;
const TRAVONY_DARK_GREEN = "#008B3D";
const ERROR_RED = Colors.light.error;
const ROUTE_BLUE = "#4285F4";

const lightMapStyle = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ lightness: 5 }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#aadaff" }] },
  { featureType: "landscape", elementType: "geometry", stylers: [{ color: "#f5f5f5" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e0e0e0" }] },
  { featureType: "road.arterial", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
  { featureType: "road.local", elementType: "geometry.fill", stylers: [{ color: "#ffffff" }] },
];

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#1d1d1d" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2a2a2a" }] },
  { featureType: "road", elementType: "geometry.stroke", stylers: [{ color: "#1d1d1d" }] },
  { featureType: "road.highway", elementType: "geometry.fill", stylers: [{ color: "#3a3a3a" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0e1626" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

function PickupMarker({ isActive }: { isActive?: boolean }) {
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 2]) }],
    opacity: interpolate(pulseAnim.value, [0, 0.5, 1], [0.6, 0.3, 0]),
  }));

  return (
    <View style={styles.markerContainer}>
      {isActive ? (
        <Animated.View style={[styles.pickupPulse, pulseStyle]} />
      ) : null}
      <View style={styles.pickupMarker}>
        <View style={styles.pickupDot} />
      </View>
    </View>
  );
}

function DropoffMarker() {
  return (
    <View style={styles.markerContainer}>
      <View style={styles.dropoffMarker}>
        <View style={styles.dropoffSquare} />
      </View>
      <View style={styles.dropoffPin} />
    </View>
  );
}

function DriverMarker({ heading = 0, vehicleType = "car" }: { heading?: number; vehicleType?: string }) {
  const rotation = useSharedValue(heading);
  const pulseAnim = useSharedValue(0);

  useEffect(() => {
    rotation.value = withTiming(heading, { duration: 500 });
  }, [heading]);

  useEffect(() => {
    pulseAnim.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const markerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulseAnim.value, [0, 1], [1, 1.8]) }],
    opacity: interpolate(pulseAnim.value, [0, 0.5, 1], [0.4, 0.2, 0]),
  }));

  const getVehicleIcon = () => {
    switch (vehicleType) {
      case "motorcycle":
        return "bicycle";
      case "auto":
        return "car-sport";
      case "suv":
        return "car";
      default:
        return "car";
    }
  };

  return (
    <View style={styles.driverMarkerContainer}>
      <Animated.View style={[styles.driverPulseRing, pulseStyle]} />
      <Animated.View style={[styles.driverVehicle, markerStyle]}>
        <View style={styles.driverIconBg}>
          <Ionicons name={getVehicleIcon()} size={20} color="#FFFFFF" />
        </View>
        <View style={styles.driverArrow} />
      </Animated.View>
    </View>
  );
}

export default function RideMap({
  pickupLocation,
  dropoffLocation,
  driverLocation,
  currentLocation,
  routeCoordinates,
  showUserLocation = true,
  showRoute = true,
  showDriverMarker = false,
  onMapReady,
  onRegionChange,
  onMarkerPress,
  eta,
  distance,
  rideStatus,
  interactive = true,
  height = "100%",
  driverHeading = 0,
  vehicleType = "car",
}: RideMapProps) {
  const { theme, isDark } = useTheme();
  const mapRef = useRef<any>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [isMapMounted, setIsMapMounted] = useState(false);
  const driverMarkerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const lastFitRef = useRef<string>("");

  useEffect(() => {
    mountedRef.current = true;
    const timer = setTimeout(() => {
      if (mountedRef.current) {
        setIsMapMounted(true);
      }
    }, 300);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
    };
  }, []);

  const driverAnimatedCoord = useRef(
    (() => {
      if (!AnimatedRegion || !isNative) return null;
      try {
        return new AnimatedRegion({
          latitude: driverLocation?.lat || 25.2048,
          longitude: driverLocation?.lng || 55.2708,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      } catch (e) {
        console.warn("AnimatedRegion creation failed:", e);
        return null;
      }
    })()
  ).current;

  useEffect(() => {
    if (driverLocation && driverAnimatedCoord && isNative) {
      try {
        driverAnimatedCoord.timing({
          latitude: driverLocation.lat,
          longitude: driverLocation.lng,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      } catch (e) {
        console.log("Animated coord error:", e);
      }
    }
  }, [driverLocation]);

  const fitToMarkers = useCallback(() => {
    if (!mapRef.current || !isMapReady) return;

    const coordinates: Array<{ latitude: number; longitude: number }> = [];

    if (pickupLocation) {
      coordinates.push({ latitude: pickupLocation.lat, longitude: pickupLocation.lng });
    }
    if (dropoffLocation) {
      coordinates.push({ latitude: dropoffLocation.lat, longitude: dropoffLocation.lng });
    }
    if (driverLocation && showDriverMarker) {
      coordinates.push({ latitude: driverLocation.lat, longitude: driverLocation.lng });
    }

    const fitKey = coordinates.map(c => `${c.latitude.toFixed(4)},${c.longitude.toFixed(4)}`).join("|");
    if (fitKey === lastFitRef.current) return;
    lastFitRef.current = fitKey;

    try {
      if (coordinates.length >= 2) {
        mapRef.current.fitToCoordinates(coordinates, {
          edgePadding: { top: 120, right: 60, bottom: 250, left: 60 },
          animated: true,
        });
      } else if (coordinates.length === 1) {
        mapRef.current.animateToRegion({
          ...coordinates[0],
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }, 500);
      }
    } catch (e) {
      console.log("Fit to markers error:", e);
    }
  }, [pickupLocation, dropoffLocation, driverLocation, showDriverMarker, isMapReady]);

  useEffect(() => {
    if (isMapReady) {
      const timer = setTimeout(fitToMarkers, 600);
      return () => clearTimeout(timer);
    }
  }, [pickupLocation, dropoffLocation, isMapReady, fitToMarkers]);

  const centerOnDriver = useCallback(() => {
    if (!mapRef.current || !driverLocation) return;
    try {
      mapRef.current.animateToRegion({
        latitude: driverLocation.lat,
        longitude: driverLocation.lng,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }, 400);
    } catch (e) {
      console.log("Center on driver error:", e);
    }
  }, [driverLocation]);

  const centerOnUser = useCallback(() => {
    if (!mapRef.current) return;
    const loc = currentLocation || pickupLocation;
    if (!loc) return;
    try {
      mapRef.current.animateToRegion({
        latitude: loc.lat,
        longitude: loc.lng,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      }, 400);
    } catch (e) {
      console.log("Center on user error:", e);
    }
  }, [currentLocation, pickupLocation]);

  const handleMapReady = useCallback(() => {
    setIsMapReady(true);
    onMapReady?.();
  }, [onMapReady]);

  const routeGradient = useMemo(() => {
    if (!routeCoordinates || routeCoordinates.length < 2) return null;
    return routeCoordinates;
  }, [routeCoordinates]);

  const fallbackRoute = useMemo(() => {
    if (!pickupLocation || !dropoffLocation) return null;
    return [
      { latitude: pickupLocation.lat, longitude: pickupLocation.lng },
      { latitude: dropoffLocation.lat, longitude: dropoffLocation.lng },
    ];
  }, [pickupLocation, dropoffLocation]);

  if (isWeb || !mapsAvailable || !MapView || !isMapMounted) {
    return (
      <View style={[styles.container, { height, backgroundColor: theme.backgroundDefault }]}>
        <View style={styles.webFallback}>
          <View style={styles.webFallbackIcon}>
            <Ionicons name={isWeb ? "map-outline" : "location-outline"} size={64} color={theme.primary} />
          </View>
          <ThemedText style={[styles.webFallbackTitle, { color: theme.text }]}>
            {isWeb ? "Live Map View" : "Loading Map..."}
          </ThemedText>
          <ThemedText style={[styles.webFallbackText, { color: theme.textSecondary }]}>
            {isWeb 
              ? "Open in Expo Go on your phone to see the interactive map with real-time tracking"
              : "Preparing your ride map..."
            }
          </ThemedText>
          {pickupLocation ? (
            <View style={[styles.locationPreview, { backgroundColor: theme.card }]}>
              <View style={styles.locationRow}>
                <View style={[styles.locationDotGreen]} />
                <ThemedText style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>
                  {pickupLocation.address || `${pickupLocation.lat.toFixed(4)}, ${pickupLocation.lng.toFixed(4)}`}
                </ThemedText>
              </View>
              {dropoffLocation ? (
                <>
                  <View style={[styles.locationConnector]}>
                    <View style={[styles.locationLine, { backgroundColor: theme.border }]} />
                  </View>
                  <View style={styles.locationRow}>
                    <View style={[styles.locationDotRed]} />
                    <ThemedText style={[styles.locationText, { color: theme.text }]} numberOfLines={1}>
                      {dropoffLocation.address || `${dropoffLocation.lat.toFixed(4)}, ${dropoffLocation.lng.toFixed(4)}`}
                    </ThemedText>
                  </View>
                </>
              ) : null}
            </View>
          ) : null}
          {eta ? (
            <View style={[styles.etaBadgeWeb, { backgroundColor: TRAVONY_GREEN }]}>
              <Ionicons name="time-outline" size={16} color="#FFFFFF" />
              <ThemedText style={styles.etaBadgeText}>{eta} min</ThemedText>
              {distance ? (
                <>
                  <View style={styles.etaDivider} />
                  <Ionicons name="navigate-outline" size={16} color="#FFFFFF" />
                  <ThemedText style={styles.etaBadgeText}>{distance.toFixed(1)} km</ThemedText>
                </>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    );
  }

  const initialRegion = {
    latitude: currentLocation?.lat || pickupLocation?.lat || 25.2048,
    longitude: currentLocation?.lng || pickupLocation?.lng || 55.2708,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        customMapStyle={isDark ? darkMapStyle : lightMapStyle}
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        showsBuildings={false}
        showsTraffic={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        pitchEnabled={false}
        rotateEnabled={false}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        initialRegion={initialRegion}
        onMapReady={handleMapReady}
        onRegionChangeComplete={onRegionChange}
        mapPadding={{ top: 0, right: 0, bottom: 0, left: 0 }}
        loadingEnabled={true}
        loadingIndicatorColor={TRAVONY_GREEN}
        loadingBackgroundColor={isDark ? "#1d1d1d" : "#f5f5f5"}
        moveOnMarkerPress={false}
      >
        {showRoute && routeGradient && routeGradient.length > 1 && Polyline ? (
          <>
            <Polyline
              coordinates={routeGradient}
              strokeWidth={6}
              strokeColor={isDark ? "#4a4a4a" : "#e0e0e0"}
              lineCap="round"
              lineJoin="round"
            />
            <Polyline
              coordinates={routeGradient}
              strokeWidth={4}
              strokeColor={ROUTE_BLUE}
              lineCap="round"
              lineJoin="round"
            />
          </>
        ) : showRoute && fallbackRoute && Polyline ? (
          <>
            <Polyline
              coordinates={fallbackRoute}
              strokeWidth={5}
              strokeColor={isDark ? "#4a4a4a" : "#e0e0e0"}
              lineDashPattern={[12, 8]}
              lineCap="round"
            />
            <Polyline
              coordinates={fallbackRoute}
              strokeWidth={3}
              strokeColor={TRAVONY_GREEN}
              lineDashPattern={[12, 8]}
              lineCap="round"
            />
          </>
        ) : null}

        {pickupLocation && Marker ? (
          <Marker
            coordinate={{ latitude: pickupLocation.lat, longitude: pickupLocation.lng }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => onMarkerPress?.("pickup")}
          >
            <PickupMarker isActive={rideStatus === "searching" || rideStatus === "accepted"} />
          </Marker>
        ) : null}

        {dropoffLocation && Marker ? (
          <Marker
            coordinate={{ latitude: dropoffLocation.lat, longitude: dropoffLocation.lng }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            onPress={() => onMarkerPress?.("dropoff")}
          >
            <DropoffMarker />
          </Marker>
        ) : null}

        {showDriverMarker && driverLocation ? (
          isNative && driverAnimatedCoord && Marker?.Animated ? (
            <Marker.Animated
              ref={driverMarkerRef}
              coordinate={driverAnimatedCoord}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              tracksViewChanges={true}
              onPress={() => onMarkerPress?.("driver")}
            >
              <DriverMarker heading={driverHeading || driverLocation.heading || 0} vehicleType={vehicleType} />
            </Marker.Animated>
          ) : Marker ? (
            <Marker
              coordinate={{ latitude: driverLocation.lat, longitude: driverLocation.lng }}
              anchor={{ x: 0.5, y: 0.5 }}
              flat
              tracksViewChanges={false}
              onPress={() => onMarkerPress?.("driver")}
            >
              <DriverMarker heading={driverHeading || driverLocation.heading || 0} vehicleType={vehicleType} />
            </Marker>
          ) : null
        ) : null}
      </MapView>

      {!isMapReady ? (
        <View style={[styles.loadingOverlay, { backgroundColor: isDark ? "#1d1d1d" : "#f5f5f5" }]}>
          <ActivityIndicator size="large" color={TRAVONY_GREEN} />
          <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
            Loading map...
          </ThemedText>
        </View>
      ) : null}

      <View style={styles.controlsContainer}>
        {showDriverMarker && driverLocation ? (
          <Pressable
            style={[styles.controlButton, { backgroundColor: theme.card }]}
            onPress={centerOnDriver}
            android_ripple={{ color: TRAVONY_GREEN + "30" }}
          >
            <Ionicons name="car" size={20} color={TRAVONY_GREEN} />
          </Pressable>
        ) : null}
        <Pressable
          style={[styles.controlButton, { backgroundColor: theme.card }]}
          onPress={centerOnUser}
          android_ripple={{ color: theme.primary + "30" }}
        >
          <Ionicons name="locate" size={20} color={theme.text} />
        </Pressable>
        <Pressable
          style={[styles.controlButton, { backgroundColor: theme.card }]}
          onPress={() => { lastFitRef.current = ""; fitToMarkers(); }}
          android_ripple={{ color: theme.primary + "30" }}
        >
          <Ionicons name="scan-outline" size={20} color={theme.text} />
        </Pressable>
      </View>

      {eta && rideStatus !== "completed" ? (
        <View style={[styles.etaContainer, { backgroundColor: theme.card }]}>
          <View style={styles.etaContent}>
            <View style={[styles.etaIndicator, { backgroundColor: TRAVONY_GREEN }]} />
            <View style={styles.etaInfo}>
              <ThemedText style={[styles.etaLabel, { color: theme.textMuted }]}>
                {rideStatus === "arriving" ? "Driver arriving" : rideStatus === "in_progress" ? "Arriving" : "ETA"}
              </ThemedText>
              <View style={styles.etaValueRow}>
                <ThemedText style={[styles.etaValue, { color: theme.text }]}>
                  {eta}
                </ThemedText>
                <ThemedText style={[styles.etaUnit, { color: theme.textSecondary }]}>
                  min
                </ThemedText>
                {distance ? (
                  <>
                    <View style={[styles.etaSeparator, { backgroundColor: theme.border }]} />
                    <ThemedText style={[styles.etaDistance, { color: theme.textSecondary }]}>
                      {distance.toFixed(1)} km
                    </ThemedText>
                  </>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "hidden",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 48,
    height: 48,
  },
  pickupMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: TRAVONY_GREEN,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
      default: {},
    }),
  },
  pickupDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: TRAVONY_GREEN,
  },
  pickupPulse: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: TRAVONY_GREEN,
  },
  dropoffMarker: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#1a1a1a",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  dropoffSquare: {
    width: 10,
    height: 10,
    backgroundColor: "#FFFFFF",
  },
  dropoffPin: {
    width: 4,
    height: 10,
    backgroundColor: "#1a1a1a",
    marginTop: -2,
  },
  driverMarkerContainer: {
    width: 56,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  driverPulseRing: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: TRAVONY_GREEN,
  },
  driverVehicle: {
    alignItems: "center",
  },
  driverIconBg: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TRAVONY_DARK_GREEN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
      },
      android: { elevation: 8 },
      default: {},
    }),
  },
  driverArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: TRAVONY_DARK_GREEN,
    marginTop: -4,
    transform: [{ rotate: "180deg" }],
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  webFallbackIcon: {
    marginBottom: Spacing.lg,
  },
  webFallbackTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  webFallbackText: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 300,
  },
  locationPreview: {
    width: "100%",
    maxWidth: 340,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.lg,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationDotGreen: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: TRAVONY_GREEN,
    marginRight: Spacing.md,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    ...Platform.select({
      ios: {
        shadowColor: TRAVONY_GREEN,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 3 },
      default: {},
    }),
  },
  locationDotRed: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: "#1a1a1a",
    marginRight: Spacing.md,
  },
  locationConnector: {
    marginLeft: 6,
    paddingVertical: 4,
  },
  locationLine: {
    width: 2,
    height: 24,
    borderRadius: 1,
  },
  locationText: {
    ...Typography.body,
    flex: 1,
  },
  etaBadgeWeb: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  etaBadgeText: {
    ...Typography.bodyMedium,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  etaDivider: {
    width: 1,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: Spacing.xs,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  controlsContainer: {
    position: "absolute",
    right: Spacing.md,
    bottom: Spacing.xl + 60,
    gap: Spacing.sm,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  etaContainer: {
    position: "absolute",
    left: Spacing.md,
    top: Spacing.lg,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.12,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
      default: {},
    }),
  },
  etaContent: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  etaIndicator: {
    width: 5,
  },
  etaInfo: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  etaLabel: {
    ...Typography.small,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  etaValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  etaValue: {
    fontSize: 24,
    fontWeight: "700",
    lineHeight: 28,
  },
  etaUnit: {
    fontSize: 14,
    fontWeight: "500",
    marginLeft: 3,
  },
  etaSeparator: {
    width: 1,
    height: 16,
    marginHorizontal: Spacing.sm,
    alignSelf: "center",
  },
  etaDistance: {
    fontSize: 14,
    fontWeight: "500",
  },
});
