import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import * as Location from "expo-location";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import RideMap from "@/components/RideMap";
import BookingBottomSheet from "@/components/BookingBottomSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Shadows, Colors } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "Home">;

interface LocationData {
  address: string;
  lat: number;
  lng: number;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pickupLocation, setPickupLocation] = useState<LocationData | null>(null);
  const [dropoffLocation, setDropoffLocation] = useState<LocationData | null>(null);
  const [locationPermission, setLocationPermission] = useState<boolean>(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    console.log("HomeScreen: Mounting");
    const timer = setTimeout(() => {
      console.log("HomeScreen: Ready after delay");
      setIsReady(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (isReady) {
      requestLocationPermission();
    }
  }, [isReady]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        setLocationPermission(true);
        getCurrentLocation();
      } else {
        setLocationPermission(false);
      }
    } catch (error) {
      console.error("Error requesting location:", error);
    }
  };

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      setCurrentLocation({ lat: latitude, lng: longitude });
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const handleLocationChange = (pickup: LocationData | null, dropoff: LocationData | null) => {
    setPickupLocation(pickup);
    setDropoffLocation(dropoff);
  };

  const handleBookingComplete = (rideId: string) => {
    navigation.navigate("ActiveRide", { rideId });
  };

  if (!isReady) {
    return (
      <View style={[styles.container, styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={Colors.travonyGreen} />
        <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
          Loading...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <RideMap
        currentLocation={currentLocation}
        pickupLocation={pickupLocation}
        dropoffLocation={dropoffLocation}
        showUserLocation={locationPermission}
        interactive={true}
        height="100%"
      />

      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <View style={[styles.greetingCard, { backgroundColor: theme.card }]}>
          <ThemedText style={styles.greeting}>
            Hello, {user?.name?.split(" ")[0] || "Guest"}
          </ThemedText>
          <ThemedText style={[styles.subGreeting, { color: theme.textSecondary }]}>
            Where are you going today?
          </ThemedText>
        </View>
      </View>

      <View style={styles.bottomSheetContainer}>
        <BookingBottomSheet
          currentLocation={currentLocation}
          onLocationChange={handleLocationChange}
          onBookingComplete={handleBookingComplete}
          bottomInset={tabBarHeight}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: Spacing.md,
    fontSize: 16,
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  greetingCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    ...Shadows.card,
  },
  greeting: {
    fontSize: 20,
    fontWeight: "600",
  },
  subGreeting: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  bottomSheetContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
});
