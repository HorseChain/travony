import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  FlatList,
  Pressable,
  Platform,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { MapView, Marker, PROVIDER_GOOGLE, mapsAvailable, WebMapFallback } from "@/components/NativeMaps";

type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Shadows } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "SelectLocation">;
type RouteProps = RouteProp<HomeStackParamList, "SelectLocation">;

interface LocationResult {
  id: string;
  address: string;
  lat: number;
  lng: number;
  icon?: string;
}

const POPULAR_LOCATIONS: LocationResult[] = [
  // Dubai - Major Landmarks
  { id: "1", address: "Dubai Mall, Downtown Dubai", lat: 25.1972, lng: 55.2744, icon: "shopping-bag" },
  { id: "2", address: "Dubai International Airport - Terminal 1", lat: 25.2528, lng: 55.3644, icon: "navigation" },
  { id: "3", address: "Dubai International Airport - Terminal 3", lat: 25.2546, lng: 55.3657, icon: "navigation" },
  { id: "4", address: "Mall of the Emirates, Al Barsha", lat: 25.1181, lng: 55.2001, icon: "shopping-bag" },
  { id: "5", address: "Burj Khalifa, Downtown Dubai", lat: 25.1972, lng: 55.2745, icon: "home" },
  { id: "6", address: "Dubai Marina Mall", lat: 25.0763, lng: 55.1405, icon: "shopping-bag" },
  { id: "7", address: "Palm Jumeirah, Atlantis The Palm", lat: 25.1304, lng: 55.1171, icon: "home" },
  { id: "8", address: "JBR - Jumeirah Beach Residence", lat: 25.0787, lng: 55.1337, icon: "sun" },
  { id: "9", address: "DIFC - Dubai International Financial Centre", lat: 25.2117, lng: 55.2788, icon: "briefcase" },
  { id: "10", address: "Dubai Healthcare City", lat: 25.2304, lng: 55.3183, icon: "activity" },
  { id: "11", address: "Business Bay Metro Station", lat: 25.1871, lng: 55.2619, icon: "navigation" },
  { id: "12", address: "Ibn Battuta Mall", lat: 25.0469, lng: 55.1179, icon: "shopping-bag" },
  { id: "13", address: "City Centre Deira", lat: 25.2519, lng: 55.3311, icon: "shopping-bag" },
  { id: "14", address: "Dubai Festival City Mall", lat: 25.2219, lng: 55.3520, icon: "shopping-bag" },
  { id: "15", address: "Al Mamzar Beach Park", lat: 25.2889, lng: 55.3491, icon: "sun" },
  // Dubai - More Areas
  { id: "16", address: "Dubai World Trade Centre", lat: 25.2285, lng: 55.2872, icon: "briefcase" },
  { id: "17", address: "Al Maktoum International Airport (DWC)", lat: 24.8966, lng: 55.1614, icon: "navigation" },
  { id: "18", address: "Dubai Silicon Oasis", lat: 25.1174, lng: 55.3817, icon: "briefcase" },
  { id: "19", address: "International City, Dubai", lat: 25.1614, lng: 55.4119, icon: "home" },
  { id: "20", address: "Dragon Mart, Dubai", lat: 25.1714, lng: 55.4179, icon: "shopping-bag" },
  { id: "21", address: "Global Village, Dubai", lat: 25.0704, lng: 55.3069, icon: "sun" },
  { id: "22", address: "Dubai Sports City", lat: 25.0394, lng: 55.2253, icon: "sun" },
  { id: "23", address: "Motor City, Dubai", lat: 25.0483, lng: 55.2411, icon: "home" },
  { id: "24", address: "Jumeirah Village Circle (JVC)", lat: 25.0623, lng: 55.2111, icon: "home" },
  { id: "25", address: "Dubai Investment Park", lat: 24.9844, lng: 55.1533, icon: "briefcase" },
  { id: "26", address: "Al Quoz Industrial Area", lat: 25.1344, lng: 55.2233, icon: "briefcase" },
  { id: "27", address: "Mirdif City Centre", lat: 25.2146, lng: 55.4234, icon: "shopping-bag" },
  { id: "28", address: "Al Rashidiya, Dubai", lat: 25.2335, lng: 55.3869, icon: "home" },
  { id: "29", address: "Deira City Centre Metro", lat: 25.2520, lng: 55.3305, icon: "navigation" },
  { id: "30", address: "Bur Dubai, Meena Bazaar", lat: 25.2631, lng: 55.2946, icon: "shopping-bag" },
  // Abu Dhabi
  { id: "31", address: "Abu Dhabi International Airport", lat: 24.4330, lng: 54.6511, icon: "navigation" },
  { id: "32", address: "Yas Mall, Abu Dhabi", lat: 24.4889, lng: 54.6078, icon: "shopping-bag" },
  { id: "33", address: "Ferrari World, Yas Island", lat: 24.4837, lng: 54.6072, icon: "sun" },
  { id: "34", address: "Sheikh Zayed Grand Mosque, Abu Dhabi", lat: 24.4128, lng: 54.4749, icon: "home" },
  { id: "35", address: "Abu Dhabi Mall", lat: 24.4963, lng: 54.3831, icon: "shopping-bag" },
  { id: "36", address: "Marina Mall, Abu Dhabi", lat: 24.4756, lng: 54.3221, icon: "shopping-bag" },
  { id: "37", address: "Corniche, Abu Dhabi", lat: 24.4693, lng: 54.3336, icon: "sun" },
  { id: "38", address: "Saadiyat Island, Abu Dhabi", lat: 24.5371, lng: 54.4341, icon: "sun" },
  { id: "39", address: "Khalifa City, Abu Dhabi", lat: 24.4217, lng: 54.5692, icon: "home" },
  { id: "40", address: "Al Reem Island, Abu Dhabi", lat: 24.4992, lng: 54.4035, icon: "home" },
  { id: "41", address: "Mushrif Mall, Abu Dhabi", lat: 24.4522, lng: 54.4064, icon: "shopping-bag" },
  { id: "42", address: "Al Wahda Mall, Abu Dhabi", lat: 24.4679, lng: 54.3716, icon: "shopping-bag" },
  { id: "43", address: "Louvre Abu Dhabi, Saadiyat", lat: 24.5337, lng: 54.3983, icon: "sun" },
  // Sharjah
  { id: "44", address: "Sharjah International Airport", lat: 25.3285, lng: 55.5172, icon: "navigation" },
  { id: "45", address: "Sahara Centre, Sharjah", lat: 25.2969, lng: 55.3900, icon: "shopping-bag" },
  { id: "46", address: "City Centre Sharjah", lat: 25.3238, lng: 55.3906, icon: "shopping-bag" },
  { id: "47", address: "Al Majaz Waterfront, Sharjah", lat: 25.3358, lng: 55.3870, icon: "sun" },
  { id: "48", address: "Sharjah Corniche", lat: 25.3556, lng: 55.3906, icon: "sun" },
  { id: "49", address: "Al Nahda, Sharjah", lat: 25.3086, lng: 55.3700, icon: "home" },
  { id: "50", address: "University City, Sharjah", lat: 25.3066, lng: 55.4717, icon: "briefcase" },
  { id: "51", address: "Muwaileh, Sharjah", lat: 25.3000, lng: 55.4500, icon: "home" },
  // Ajman
  { id: "52", address: "Ajman City Centre", lat: 25.4111, lng: 55.4347, icon: "shopping-bag" },
  { id: "53", address: "Ajman Corniche", lat: 25.4167, lng: 55.4333, icon: "sun" },
  { id: "54", address: "Al Nuaimia, Ajman", lat: 25.3903, lng: 55.4444, icon: "home" },
  // Ras Al Khaimah
  { id: "55", address: "Ras Al Khaimah International Airport", lat: 25.6133, lng: 55.9389, icon: "navigation" },
  { id: "56", address: "Al Hamra Mall, RAK", lat: 25.6847, lng: 55.7847, icon: "shopping-bag" },
  { id: "57", address: "RAK Mall", lat: 25.7892, lng: 55.9431, icon: "shopping-bag" },
  { id: "58", address: "Jebel Jais, RAK", lat: 25.9556, lng: 56.1333, icon: "sun" },
  // Fujairah
  { id: "59", address: "Fujairah International Airport", lat: 25.1122, lng: 56.3241, icon: "navigation" },
  { id: "60", address: "Fujairah City Centre", lat: 25.1332, lng: 56.3340, icon: "shopping-bag" },
  { id: "61", address: "Fujairah Corniche", lat: 25.1167, lng: 56.3333, icon: "sun" },
  // Umm Al Quwain
  { id: "62", address: "UAQ Mall, Umm Al Quwain", lat: 25.5647, lng: 55.5547, icon: "shopping-bag" },
  { id: "63", address: "Dreamland Aqua Park, UAQ", lat: 25.5800, lng: 55.5536, icon: "sun" },
  // Al Ain (Abu Dhabi Emirate)
  { id: "64", address: "Al Ain International Airport", lat: 24.2617, lng: 55.6092, icon: "navigation" },
  { id: "65", address: "Al Ain Mall", lat: 24.2213, lng: 55.7711, icon: "shopping-bag" },
  { id: "66", address: "Al Ain Zoo", lat: 24.1697, lng: 55.7431, icon: "sun" },
  { id: "67", address: "Jebel Hafeet, Al Ain", lat: 24.0631, lng: 55.7764, icon: "sun" },
  { id: "68", address: "Bawadi Mall, Al Ain", lat: 24.1933, lng: 55.7000, icon: "shopping-bag" },
  // More Dubai neighborhoods
  { id: "69", address: "Discovery Gardens, Dubai", lat: 25.0397, lng: 55.1361, icon: "home" },
  { id: "70", address: "Dubai Hills Mall", lat: 25.1125, lng: 55.2456, icon: "shopping-bag" },
  { id: "71", address: "The Walk at JBR", lat: 25.0785, lng: 55.1339, icon: "sun" },
  { id: "72", address: "La Mer Beach, Dubai", lat: 25.2259, lng: 55.2639, icon: "sun" },
  { id: "73", address: "Kite Beach, Dubai", lat: 25.1447, lng: 55.1875, icon: "sun" },
  { id: "74", address: "City Walk, Dubai", lat: 25.2069, lng: 55.2631, icon: "shopping-bag" },
  { id: "75", address: "Bluewaters Island, Dubai", lat: 25.0792, lng: 55.1189, icon: "sun" },
  { id: "76", address: "Ain Dubai (Dubai Eye)", lat: 25.0794, lng: 55.1189, icon: "sun" },
  { id: "77", address: "Arabian Ranches, Dubai", lat: 25.0500, lng: 55.2667, icon: "home" },
  { id: "78", address: "Damac Hills, Dubai", lat: 25.0367, lng: 55.2450, icon: "home" },
  { id: "79", address: "Emirates Hills, Dubai", lat: 25.0692, lng: 55.1639, icon: "home" },
  { id: "80", address: "The Springs, Dubai", lat: 25.0586, lng: 55.1417, icon: "home" },
];

export default function SelectLocationScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const mapRef = useRef<any>(null);

  const { type } = route.params;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<LocationResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [locationPermission, requestPermission] = Location.useForegroundPermissions();
  const [region, setRegion] = useState<Region>({
    latitude: 25.2048,
    longitude: 55.2708,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    if (locationPermission?.granted) {
      getCurrentLocation();
    } else if (locationPermission && !locationPermission.granted && locationPermission.canAskAgain) {
      requestPermission();
    }
  }, [locationPermission]);

  const filteredLocations = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_LOCATIONS;
    const query = searchQuery.toLowerCase();
    return POPULAR_LOCATIONS.filter((loc) =>
      loc.address.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  const getCurrentLocation = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = location.coords;
      setRegion({
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const handleRegionChange = async (newRegion: Region) => {
    setRegion(newRegion);
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: newRegion.latitude,
        longitude: newRegion.longitude,
      });
      if (address) {
        const parts = [];
        if (address.name && !address.name.match(/^\d/)) parts.push(address.name);
        if (address.street) parts.push(address.street);
        if (address.district) parts.push(address.district);
        if (address.city) parts.push(address.city);
        
        const addressStr = parts.length > 0 ? parts.slice(0, 3).join(", ") : "Selected Location";
        setSelectedLocation({
          id: "selected",
          address: addressStr,
          lat: newRegion.latitude,
          lng: newRegion.longitude,
        });
      }
    } catch (error) {
      setSelectedLocation({
        id: "selected",
        address: `${newRegion.latitude.toFixed(4)}, ${newRegion.longitude.toFixed(4)}`,
        lat: newRegion.latitude,
        lng: newRegion.longitude,
      });
    }
  };

  const handleSelectPopularLocation = (location: LocationResult) => {
    Keyboard.dismiss();
    setShowResults(false);
    setSearchQuery(location.address);
    setSelectedLocation(location);
    
    const newRegion = {
      latitude: location.lat,
      longitude: location.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    setRegion(newRegion);
    mapRef.current?.animateToRegion(newRegion, 500);
  };

  const handleConfirmLocation = () => {
    if (selectedLocation) {
      navigation.navigate("Home", {
        selectedLocation: {
          type,
          address: selectedLocation.address,
          lat: selectedLocation.lat,
          lng: selectedLocation.lng,
        },
      });
    }
  };

  const handleUseCurrentLocation = async () => {
    if (!locationPermission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        return;
      }
    }
    
    setIsSearching(true);
    setShowResults(false);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;
      
      const newRegion = {
        latitude,
        longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      };
      
      mapRef.current?.animateToRegion(newRegion, 500);
      setRegion(newRegion);

      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (address) {
        const parts = [];
        if (address.name && !address.name.match(/^\d/)) parts.push(address.name);
        if (address.street) parts.push(address.street);
        if (address.district) parts.push(address.district);
        if (address.city) parts.push(address.city);
        
        const addressStr = parts.length > 0 ? parts.slice(0, 3).join(", ") : "Current Location";
        const loc = {
          id: "current",
          address: addressStr,
          lat: latitude,
          lng: longitude,
        };
        setSelectedLocation(loc);
        setSearchQuery(addressStr);
      } else {
        setSelectedLocation({
          id: "current",
          address: "Current Location",
          lat: latitude,
          lng: longitude,
        });
      }
    } catch (error) {
      console.error("Error getting current location:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const renderLocationItem = ({ item }: { item: LocationResult }) => (
    <Pressable
      style={({ pressed }) => [
        styles.locationItem,
        { 
          backgroundColor: pressed ? theme.backgroundPressed : theme.card,
          borderBottomColor: theme.border,
        },
      ]}
      onPress={() => handleSelectPopularLocation(item)}
    >
      <View style={[styles.locationIcon, { backgroundColor: theme.primary + "20" }]}>
        <Ionicons 
          name={(item.icon as any) || "map-pin"} 
          size={18} 
          color={theme.primary} 
        />
      </View>
      <View style={styles.locationInfo}>
        <ThemedText style={styles.locationAddress} numberOfLines={2}>
          {item.address}
        </ThemedText>
      </View>
      <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
    </Pressable>
  );

  const renderMap = () => {
    if (Platform.OS === "web" || !mapsAvailable || !MapView) {
      return (
        <View style={[styles.map, styles.webMapFallback, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.webMapContent}>
            <Ionicons name="location-outline" size={48} color={theme.primary} />
            <ThemedText style={[styles.webMapText, { color: theme.textSecondary }]}>
              {Platform.OS === "web" ? "Map view available in Expo Go" : "Select a location from the list"}
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
          showsUserLocation
          showsMyLocationButton={false}
          initialRegion={region}
          onRegionChangeComplete={handleRegionChange}
          onTouchStart={() => setShowResults(false)}
        />
        <View style={[styles.markerFixed]}>
          <View style={[styles.markerPin, { backgroundColor: type === "pickup" ? theme.primary : theme.error }]}>
            <Ionicons name="location-outline" size={20} color="#FFFFFF" />
          </View>
          <View style={[styles.markerShadow, { backgroundColor: "rgba(0,0,0,0.2)" }]} />
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      {renderMap()}

      <View style={[styles.searchContainer, { top: headerHeight + Spacing.md }]}>
        <View style={[styles.searchInput, { backgroundColor: theme.card }]}>
          <Ionicons name="search-outline" size={20} color={theme.textMuted} />
          <TextInput
            style={[styles.searchText, { color: theme.text }]}
            placeholder={type === "pickup" ? "Search pickup location" : "Search drop-off location"}
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowResults(true);
            }}
            onFocus={() => setShowResults(true)}
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => { setSearchQuery(""); setShowResults(true); }}>
              <Ionicons name="close-outline" size={20} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={[styles.currentLocationButton, { backgroundColor: theme.card }]}
          onPress={handleUseCurrentLocation}
          disabled={isSearching}
        >
          {isSearching ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="navigate-outline" size={20} color={theme.primary} />
          )}
          <ThemedText style={[styles.currentLocationText, { color: theme.primary }]}>
            {isSearching ? "Getting location..." : "Use current location"}
          </ThemedText>
        </Pressable>

        {showResults ? (
          <View style={[styles.resultsContainer, { backgroundColor: theme.card }]}>
            <ThemedText style={[styles.resultsHeader, { color: theme.textSecondary }]}>
              {searchQuery ? "Search Results" : "Popular Locations"}
            </ThemedText>
            <FlatList
              data={filteredLocations}
              keyExtractor={(item) => item.id}
              renderItem={renderLocationItem}
              style={styles.resultsList}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={styles.emptyResults}>
                  <ThemedText style={{ color: theme.textMuted }}>
                    No locations found. Try moving the map.
                  </ThemedText>
                </View>
              }
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        {selectedLocation ? (
          <Card style={styles.selectedCard}>
            <View style={styles.selectedRow}>
              <View style={[styles.locationDot, { backgroundColor: type === "pickup" ? theme.primary : theme.error }]} />
              <View style={styles.selectedInfo}>
                <ThemedText style={styles.selectedAddress} numberOfLines={2}>
                  {selectedLocation.address}
                </ThemedText>
              </View>
            </View>
          </Card>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.confirmButton,
            {
              backgroundColor: theme.primary,
              opacity: !selectedLocation ? 0.5 : pressed ? 0.9 : 1,
            },
          ]}
          onPress={handleConfirmLocation}
          disabled={!selectedLocation}
        >
          <ThemedText style={styles.confirmButtonText}>
            Confirm {type === "pickup" ? "Pickup" : "Drop-off"} Location
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerFixed: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -20,
    marginTop: -40,
    alignItems: "center",
  },
  markerPin: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.fab,
  },
  markerShadow: {
    width: 20,
    height: 6,
    borderRadius: 10,
    marginTop: 4,
  },
  searchContainer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    zIndex: 10,
  },
  searchInput: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    height: 52,
    borderRadius: BorderRadius.sm,
    ...Shadows.card,
  },
  searchText: {
    flex: 1,
    marginLeft: Spacing.md,
    ...Typography.body,
  },
  currentLocationButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    ...Shadows.card,
  },
  currentLocationText: {
    ...Typography.body,
    marginLeft: Spacing.md,
    fontWeight: "500",
  },
  resultsContainer: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.sm,
    maxHeight: 300,
    ...Shadows.card,
  },
  resultsHeader: {
    ...Typography.caption,
    fontWeight: "600",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  resultsList: {
    maxHeight: 260,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  locationInfo: {
    flex: 1,
  },
  locationAddress: {
    ...Typography.body,
  },
  emptyResults: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  bottomContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
  },
  selectedCard: {
    marginBottom: Spacing.md,
    padding: Spacing.lg,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: Spacing.md,
  },
  selectedInfo: {
    flex: 1,
  },
  selectedAddress: {
    ...Typography.body,
  },
  confirmButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  webMapFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  webMapContent: {
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing["3xl"],
  },
  webMapText: {
    ...Typography.h4,
    marginTop: Spacing.lg,
    textAlign: "center",
  },
});
