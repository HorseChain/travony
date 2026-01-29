import { useState, useEffect } from "react";
import { View, StyleSheet, Pressable, Platform, Modal, TextInput, FlatList, Alert, KeyboardAvoidingView } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withRepeat, withSequence } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface PmgthSession {
  id: string;
  destinationAddress: string;
  destinationLat: string;
  destinationLng: string;
  timeWindowMinutes: number;
  maxDetourPercent: string;
  status: string;
  expiresAt: string;
  ridesCompleted: number;
  totalPremiumEarnings: string;
}

interface SavedAddress {
  address: string;
  lat: number;
  lng: number;
}

interface Props {
  isOnline: boolean;
  currentLocation: { lat: number; lng: number } | null;
}

const POPULAR_HOME_LOCATIONS = [
  { id: "1", address: "Dubai Marina, Dubai", lat: 25.0763, lng: 55.1405 },
  { id: "2", address: "JBR - Jumeirah Beach Residence", lat: 25.0787, lng: 55.1337 },
  { id: "3", address: "Downtown Dubai", lat: 25.1972, lng: 55.2744 },
  { id: "4", address: "Business Bay, Dubai", lat: 25.1871, lng: 55.2619 },
  { id: "5", address: "Jumeirah Lakes Towers (JLT)", lat: 25.0750, lng: 55.1450 },
  { id: "6", address: "Dubai Silicon Oasis", lat: 25.1174, lng: 55.3817 },
  { id: "7", address: "Al Barsha, Dubai", lat: 25.1181, lng: 55.2001 },
  { id: "8", address: "Mirdif, Dubai", lat: 25.2146, lng: 55.4234 },
  { id: "9", address: "International City, Dubai", lat: 25.1614, lng: 55.4119 },
  { id: "10", address: "Jumeirah Village Circle (JVC)", lat: 25.0623, lng: 55.2111 },
  { id: "11", address: "Arabian Ranches, Dubai", lat: 25.0500, lng: 55.2667 },
  { id: "12", address: "The Springs, Dubai", lat: 25.0586, lng: 55.1417 },
  { id: "13", address: "Al Nahda, Sharjah", lat: 25.3086, lng: 55.3700 },
  { id: "14", address: "Abu Dhabi City", lat: 24.4539, lng: 54.3773 },
  { id: "15", address: "Khalifa City, Abu Dhabi", lat: 24.4217, lng: 54.5692 },
];

export function GoingHomeButton({ isOnline, currentLocation }: Props) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const pulseAnim = useSharedValue(1);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [pendingActivation, setPendingActivation] = useState(false);

  const { data: sessionData, refetch: refetchSession } = useQuery<{
    active: boolean;
    session: PmgthSession | null;
    stats?: {
      ridesCompleted: number;
      totalPremiumEarnings: string;
      minutesRemaining: number;
    };
  }>({
    queryKey: ["/api/pmgth/session"],
    enabled: isOnline,
    refetchInterval: 30000,
  });

  const { data: homeAddress, refetch: refetchHome } = useQuery<{ homeAddress: SavedAddress | null }>({
    queryKey: ["/api/pmgth/home-address"],
  });

  useEffect(() => {
    if (sessionData?.active) {
      pulseAnim.value = withRepeat(
        withSequence(withSpring(1.08), withSpring(1)),
        -1,
        true
      );
    } else {
      pulseAnim.value = 1;
    }
  }, [sessionData?.active]);

  useEffect(() => {
    if (pendingActivation && homeAddress?.homeAddress) {
      setPendingActivation(false);
      activateWithHome(homeAddress.homeAddress);
    }
  }, [pendingActivation, homeAddress?.homeAddress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseAnim.value }],
  }));

  const activateWithHome = (home: SavedAddress) => {
    apiRequest("/api/pmgth/activate", {
      method: "POST",
      body: JSON.stringify({
        destinationAddress: home.address,
        destinationLat: home.lat,
        destinationLng: home.lng,
        timeWindowMinutes: 60,
        maxDetourPercent: 15,
      }),
      headers: { "Content-Type": "application/json" },
    })
      .then(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        refetchSession();
        queryClient.invalidateQueries({ queryKey: ["/api/pmgth/session"] });
      })
      .catch(() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      });
  };

  const saveHomeMutation = useMutation({
    mutationFn: async (home: { address: string; lat: number; lng: number }) => {
      return apiRequest("/api/pmgth/home-address", {
        method: "POST",
        body: JSON.stringify(home),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: async (_, variables) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowModal(false);
      setSearchQuery("");
      await refetchHome();
      queryClient.invalidateQueries({ queryKey: ["/api/pmgth/home-address"] });
      activateWithHome(variables);
    },
    onError: (error: any) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (Platform.OS === "web") {
        alert(error.message || "Failed to save home address");
      } else {
        Alert.alert("Error", error.message || "Failed to save home address");
      }
    },
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const home = homeAddress?.homeAddress;
      if (!home) {
        throw new Error("Set home address first");
      }
      return apiRequest("/api/pmgth/activate", {
        method: "POST",
        body: JSON.stringify({
          destinationAddress: home.address,
          destinationLat: home.lat,
          destinationLng: home.lng,
          timeWindowMinutes: 60,
          maxDetourPercent: 15,
        }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refetchSession();
      queryClient.invalidateQueries({ queryKey: ["/api/pmgth/session"] });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/pmgth/deactivate", {
        method: "POST",
        body: JSON.stringify({ reason: "cancelled" }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      refetchSession();
      queryClient.invalidateQueries({ queryKey: ["/api/pmgth/session"] });
    },
  });

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (sessionData?.active) {
      deactivateMutation.mutate();
    } else {
      if (!hasHome) {
        setShowModal(true);
        return;
      }
      activateMutation.mutate();
    }
  };

  const handleSelectLocation = (location: { address: string; lat: number; lng: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveHomeMutation.mutate(location);
  };

  const handleUseCurrentLocation = async () => {
    setIsGettingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (Platform.OS === "web") {
          alert("Please enable location services to use current location");
        } else {
          Alert.alert("Permission Required", "Please enable location services");
        }
        return;
      }

      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = location.coords;

      const [address] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressStr = address 
        ? [address.street, address.district, address.city].filter(Boolean).slice(0, 2).join(", ") || "My Home"
        : "My Home";

      saveHomeMutation.mutate({
        address: addressStr,
        lat: latitude,
        lng: longitude,
      });
    } catch (error) {
      console.error("Error getting location:", error);
      if (Platform.OS === "web") {
        alert("Failed to get current location");
      } else {
        Alert.alert("Error", "Failed to get current location");
      }
    } finally {
      setIsGettingLocation(false);
    }
  };

  const filteredLocations = searchQuery
    ? POPULAR_HOME_LOCATIONS.filter((loc) =>
        loc.address.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : POPULAR_HOME_LOCATIONS;

  if (!isOnline) return null;

  const isActive = sessionData?.active;
  const stats = sessionData?.stats;
  const hasHome = !!homeAddress?.homeAddress;
  const isPending = activateMutation.isPending || deactivateMutation.isPending || saveHomeMutation.isPending;

  return (
    <>
      <Animated.View style={animatedStyle}>
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: isActive ? Colors.travonyGreen : theme.backgroundRoot,
              opacity: isPending ? 0.7 : 1,
            },
          ]}
          onPress={handlePress}
          disabled={isPending}
        >
          <View style={[styles.iconCircle, { backgroundColor: isActive ? "#fff" : Colors.travonyGreen }]}>
            <Ionicons 
              name="home" 
              size={20} 
              color={isActive ? Colors.travonyGreen : "#fff"} 
            />
          </View>

          {isActive && stats ? (
            <View style={styles.activeInfo}>
              <ThemedText style={styles.activeEarnings}>
                +${parseFloat(stats.totalPremiumEarnings).toFixed(0)}
              </ThemedText>
              <ThemedText style={styles.activeTime}>
                {stats.minutesRemaining}m
              </ThemedText>
            </View>
          ) : (
            <ThemedText style={[styles.label, { color: hasHome ? Colors.travonyGreen : theme.textMuted }]}>
              {hasHome ? "Home" : "Set home"}
            </ThemedText>
          )}
        </Pressable>
      </Animated.View>

      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <KeyboardAvoidingView 
          style={[styles.modalContainer, { backgroundColor: theme.backgroundRoot }]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalHeader}>
            <ThemedText style={styles.modalTitle}>Set Your Home</ThemedText>
            <Pressable onPress={() => setShowModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={theme.text} />
            </Pressable>
          </View>

          <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
            Select your home location to get rides going your way
          </ThemedText>

          <Pressable
            style={[styles.currentLocationBtn, { backgroundColor: Colors.travonyGreen + "15" }]}
            onPress={handleUseCurrentLocation}
            disabled={isGettingLocation || saveHomeMutation.isPending}
          >
            <Ionicons name="locate" size={20} color={Colors.travonyGreen} />
            <ThemedText style={[styles.currentLocationText, { color: Colors.travonyGreen }]}>
              {isGettingLocation ? "Getting location..." : "Use my current location as home"}
            </ThemedText>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: theme.border }]}>
            <ThemedText style={[styles.dividerText, { color: theme.textMuted, backgroundColor: theme.backgroundRoot }]}>
              or select from list
            </ThemedText>
          </View>

          <View style={[styles.searchContainer, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
            <Ionicons name="search" size={18} color={theme.textMuted} />
            <TextInput
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Search area..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={theme.textMuted} />
              </Pressable>
            ) : null}
          </View>

          <FlatList
            data={filteredLocations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.locationItem,
                  { 
                    backgroundColor: pressed ? theme.backgroundPressed : "transparent",
                    borderBottomColor: theme.border,
                  },
                ]}
                onPress={() => handleSelectLocation(item)}
                disabled={saveHomeMutation.isPending}
              >
                <View style={[styles.locationIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
                  <Ionicons name="home-outline" size={18} color={Colors.travonyGreen} />
                </View>
                <ThemedText style={styles.locationText}>{item.address}</ThemedText>
                <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
              </Pressable>
            )}
            style={styles.locationList}
            contentContainerStyle={styles.locationListContent}
            keyboardShouldPersistTaps="handled"
          />

          {saveHomeMutation.isPending ? (
            <View style={[styles.savingOverlay, { backgroundColor: theme.backgroundRoot + "E0" }]}>
              <Ionicons name="home" size={32} color={Colors.travonyGreen} />
              <ThemedText style={styles.savingText}>Setting home & activating...</ThemedText>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...Typography.bodyMedium,
  },
  activeInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  activeEarnings: {
    ...Typography.bodyMedium,
    color: "#fff",
    fontWeight: "700",
  },
  activeTime: {
    ...Typography.caption,
    color: "rgba(255,255,255,0.8)",
  },
  modalContainer: {
    flex: 1,
    paddingTop: Spacing.xl,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  modalTitle: {
    ...Typography.h3,
    fontWeight: "700",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  modalSubtitle: {
    ...Typography.body,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  currentLocationBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  currentLocationText: {
    ...Typography.body,
    fontWeight: "600",
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  dividerText: {
    ...Typography.caption,
    position: "absolute",
    paddingHorizontal: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    padding: 0,
  },
  locationList: {
    flex: 1,
  },
  locationListContent: {
    paddingHorizontal: Spacing.lg,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  locationText: {
    flex: 1,
    ...Typography.body,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  savingText: {
    ...Typography.body,
    fontWeight: "600",
  },
});
