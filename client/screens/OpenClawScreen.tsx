import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import { useNavigation, useRoute } from "@react-navigation/native";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { HubCard } from "@/components/HubCard";
import type { HubCardData } from "@/components/HubCard";
import { useTheme } from "@/hooks/useTheme";
import { Typography, Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Hub = HubCardData;

interface SmartPrompt {
  type: string;
  title: string;
  message: string;
  priority: string;
  actionLabel?: string;
  hubId?: string;
  metadata?: any;
}

export default function OpenClawScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();

  const variant: "driver" | "rider" = route.params?.variant || "rider";
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [evStagingHub, setEvStagingHub] = useState<Hub | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
        }
      } catch (e) {}
      setLocationLoading(false);
    })();
  }, []);

  const hubsQueryKey = useMemo(() => {
    if (!location) return ["/api/openclaw/hubs"];
    return [`/api/openclaw/hubs?lat=${location.lat}&lng=${location.lng}`];
  }, [location]);

  const { data: hubsData, isLoading: hubsLoading, refetch: refetchHubs } = useQuery<Hub[]>({
    queryKey: hubsQueryKey,
    enabled: !locationLoading,
  });

  const { data: promptData } = useQuery<SmartPrompt>({
    queryKey: location
      ? [`/api/openclaw/smart-prompt?lat=${location.lat}&lng=${location.lng}`]
      : ["/api/openclaw/smart-prompt"],
    enabled: !!location,
  });

  const checkInMutation = useMutation({
    mutationFn: async ({ hubId, evStagingStatus }: { hubId: string; evStagingStatus?: string }) => {
      return apiRequest(`/api/openclaw/hubs/${hubId}/check-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evStagingStatus: evStagingStatus || null }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hubsQueryKey });
      setEvStagingHub(null);
    },
  });

  const handleCheckIn = useCallback((hub: Hub) => {
    if (variant === "driver" && hub.isEvHub) {
      setEvStagingHub(hub);
    } else {
      checkInMutation.mutate({ hubId: hub.id });
    }
  }, [variant, checkInMutation]);

  const sortedHubs = useMemo(() => {
    if (!hubsData) return [];
    // EV hubs always pinned to top
    const ev = hubsData.filter(h => h.isEvHub);
    const nonEv = hubsData.filter(h => !h.isEvHub);

    if (location) {
      // With location: sort each group by distance ascending
      const byDist = (a: Hub, b: Hub) => (a.distance ?? 9999) - (b.distance ?? 9999);
      return [...ev.sort(byDist), ...nonEv.sort(byDist)];
    } else {
      // No location: sort each group alphabetically by city (from address) then name
      const cityOf = (h: Hub) => {
        const parts = (h.address || "").split(",");
        return (parts[1] || parts[0] || h.name).trim().toLowerCase();
      };
      const byCity = (a: Hub, b: Hub) => {
        const cmp = cityOf(a).localeCompare(cityOf(b));
        return cmp !== 0 ? cmp : a.name.localeCompare(b.name);
      };
      return [...ev.sort(byCity), ...nonEv.sort(byCity)];
    }
  }, [hubsData, location]);

  const filteredHubs = useMemo(() => {
    if (!searchQuery.trim()) return sortedHubs;
    const q = searchQuery.toLowerCase().trim();
    return sortedHubs.filter(h =>
      h.name.toLowerCase().includes(q) ||
      (h.address || "").toLowerCase().includes(q) ||
      (h.type || "").toLowerCase().includes(q)
    );
  }, [sortedHubs, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refetchHubs(); } catch (e) {}
    setRefreshing(false);
  }, [refetchHubs]);

  const handleHubPress = useCallback((hub: Hub) => {
    try {
      navigation.navigate("HubDetail", { hubId: hub.id, hubName: hub.name || "Hub" });
    } catch (e) {}
  }, [navigation]);

  const evHubs = useMemo(() => sortedHubs.filter(h => h.isEvHub), [sortedHubs]);
  const totalEvPorts = useMemo(() => evHubs.reduce((s, h) => s + (h.evPortsTotal ?? h.totalChargingPorts ?? 0), 0), [evHubs]);
  const freeEvPorts = useMemo(() => evHubs.reduce((s, h) => s + (h.evPortsAvailable ?? h.availablePorts ?? 0), 0), [evHubs]);
  const activeEvPorts = totalEvPorts - freeEvPorts;

  const statsText = `${sortedHubs.length} UAE Hubs \u00B7 ${activeEvPorts} EV Ports Active`;

  const STICKY_BAR_HEIGHT = 44;

  const renderHeader = useCallback(() => {
    return (
      <View>
        {promptData ? (
          <View style={[styles.promptBanner, { backgroundColor: theme.backgroundDefault }]}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.travonyGold} />
            <View style={{ flex: 1, marginLeft: Spacing.sm }}>
              <ThemedText style={[styles.promptTitle, { color: theme.text }]}>
                {promptData.title || "Welcome"}
              </ThemedText>
              <ThemedText style={[styles.promptMsg, { color: theme.textSecondary }]} numberOfLines={2}>
                {promptData.message || ""}
              </ThemedText>
            </View>
          </View>
        ) : null}

        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault, borderColor: theme.border }]}>
          <Ionicons name="search-outline" size={16} color={theme.textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search hubs by name or city..."
            placeholderTextColor={theme.textMuted}
            style={[styles.searchInput, { color: theme.text }]}
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {location ? null : (
          <View style={[styles.locationBanner, { backgroundColor: Colors.travonyGold + "18", borderColor: Colors.travonyGold + "40" }]}>
            <Ionicons name="location-outline" size={16} color={Colors.travonyGold} />
            <ThemedText style={{ ...Typography.small, color: Colors.travonyGold, flex: 1 }}>
              Enable location to sort hubs by distance
            </ThemedText>
          </View>
        )}

        {filteredHubs.length > 0 ? (
          <View style={styles.sectionHeader}>
            <View style={[styles.demandDotSm, { backgroundColor: Colors.travonyGreen }]} />
            <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              {searchQuery.trim()
                ? `${filteredHubs.length} result${filteredHubs.length !== 1 ? "s" : ""}`
                : location ? "EV Hubs First \u00B7 Nearest" : "EV Hubs First \u00B7 City Order"}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  }, [promptData, searchQuery, location, filteredHubs.length, theme]);

  const renderItem = useCallback(
    ({ item }: { item: Hub }) => (
      <HubCard
        hub={item}
        variant={variant}
        onPress={() => handleHubPress(item)}
        onCheckIn={variant === "driver" ? () => handleCheckIn(item) : undefined}
        theme={theme}
      />
    ),
    [variant, theme, handleHubPress, handleCheckIn]
  );

  const renderEmpty = useCallback(() => {
    if (hubsLoading || locationLoading) return null;
    if (searchQuery.trim() && filteredHubs.length === 0 && sortedHubs.length > 0) {
      return (
        <View style={styles.emptyWrap}>
          <Ionicons name="search-outline" size={48} color={theme.textMuted} />
          <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Results</ThemedText>
          <ThemedText style={[styles.emptyMsg, { color: theme.textSecondary }]}>
            No hubs match "{searchQuery}". Try a different search.
          </ThemedText>
        </View>
      );
    }
    return (
      <View style={styles.emptyWrap}>
        <Ionicons name="globe-outline" size={48} color={theme.textMuted} />
        <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>No Hubs Found</ThemedText>
        <ThemedText style={[styles.emptyMsg, { color: theme.textSecondary }]}>
          Pull down to refresh the hub network.
        </ThemedText>
      </View>
    );
  }, [hubsLoading, locationLoading, searchQuery, filteredHubs.length, sortedHubs.length, theme]);

  if ((locationLoading || hubsLoading) && !hubsData) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.loadingWrap, { paddingTop: insets.top + Spacing["4xl"] + Spacing.md + Spacing.xs * 2 }]}>
          <ActivityIndicator size="large" color={theme.primary} />
          <ThemedText style={{ color: theme.textSecondary, marginTop: Spacing.md }}>
            Loading hub network...
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: (insets.top || 0) + 60 + STICKY_BAR_HEIGHT + Spacing.sm,
          paddingBottom: (insets.bottom || 0) + 80,
          paddingHorizontal: Spacing.lg,
        }}
        data={filteredHubs}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListHeaderComponent={renderHeader()}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={false}
      />

      {/* Truly sticky stats bar — positioned below the nav header */}
      <View
        style={[
          styles.stickyBar,
          {
            backgroundColor: theme.backgroundDefault,
            top: (insets.top || 0) + 56,
            left: Spacing.lg,
            right: Spacing.lg,
          },
        ]}
        pointerEvents="none"
      >
        <Ionicons name="flash" size={15} color={Colors.travonyGreen} />
        <ThemedText style={[styles.statsText, { color: theme.text }]}>{statsText}</ThemedText>
        <View style={[styles.evCountBadge, { backgroundColor: Colors.travonyGreen + "20" }]}>
          <ThemedText style={{ ...Typography.caption, color: Colors.travonyGreen, fontWeight: "700" }}>
            {evHubs.length} EV
          </ThemedText>
        </View>
      </View>

      <Modal
        visible={!!evStagingHub}
        transparent
        animationType="slide"
        onRequestClose={() => setEvStagingHub(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.backgroundRoot }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm }}>
              <Ionicons name="flash" size={22} color={Colors.travonyGreen} />
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>EV Charging Hub</ThemedText>
            </View>
            <ThemedText style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
              {evStagingHub?.name} — Select your EV staging status
            </ThemedText>

            {evStagingHub ? (
              (() => {
                const avail = evStagingHub.evPortsAvailable ?? evStagingHub.availablePorts ?? 0;
                const total = evStagingHub.evPortsTotal ?? evStagingHub.totalChargingPorts ?? 0;
                return total > 0 ? (
                  <View style={[styles.portsRow, { backgroundColor: Colors.travonyGreen + "15" }]}>
                    <Ionicons name="battery-charging-outline" size={16} color={Colors.travonyGreen} />
                    <ThemedText style={{ ...Typography.labelLight, color: Colors.travonyGreen }}>
                      {avail} of {total} ports available
                    </ThemedText>
                  </View>
                ) : null;
              })()
            ) : null}

            <View style={{ gap: Spacing.sm, marginTop: Spacing.md }}>
              {(
                [
                  { status: "charging" as const, label: "Charging", sub: "Need to charge before rides", icon: "battery-charging-outline" as keyof typeof Ionicons.glyphMap, color: theme.info },
                  { status: "ready" as const, label: "Ready", sub: "Charged and ready for pick-ups", icon: "checkmark-circle-outline" as keyof typeof Ionicons.glyphMap, color: Colors.travonyGreen },
                  { status: "departing" as const, label: "Departing", sub: "Heading out soon", icon: "navigate-outline" as keyof typeof Ionicons.glyphMap, color: Colors.travonyGold },
                ]
              ).map(({ status, label, sub, icon, color }) => (
                <Pressable
                  key={status}
                  style={[styles.stagingOption, { backgroundColor: color + "15", borderColor: color + "40" }]}
                  onPress={() => evStagingHub && checkInMutation.mutate({ hubId: evStagingHub.id, evStagingStatus: status })}
                >
                  <Ionicons name={icon} size={22} color={color} />
                  <View style={{ flex: 1 }}>
                    <ThemedText style={{ ...Typography.bodyBold, color: theme.text }}>{label}</ThemedText>
                    <ThemedText style={{ ...Typography.small, color: theme.textMuted }}>{sub}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={color} />
                </Pressable>
              ))}

              <Pressable
                style={[styles.stagingOption, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}
                onPress={() => evStagingHub && checkInMutation.mutate({ hubId: evStagingHub.id })}
              >
                <Ionicons name="log-in-outline" size={22} color={theme.textMuted} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={{ ...Typography.bodyBold, color: theme.text }}>Standard Check-In</ThemedText>
                  <ThemedText style={{ ...Typography.small, color: theme.textMuted }}>Check in without EV status</ThemedText>
                </View>
              </Pressable>
            </View>

            <Pressable
              style={{ marginTop: Spacing.lg, alignItems: "center" }}
              onPress={() => setEvStagingHub(null)}
            >
              <ThemedText style={{ ...Typography.bodyMedium, color: theme.textMuted }}>Cancel</ThemedText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  stickyBar: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    height: 44,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    zIndex: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  statsText: { flex: 1, ...Typography.labelBold },
  evCountBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, ...Typography.bodyMedium, padding: 0 },
  promptBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  promptTitle: { ...Typography.bodySmallBold },
  promptMsg: { ...Typography.labelLight, marginTop: 2 },
  locationBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.sm,
  },
  demandDotSm: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: {
    ...Typography.smallBold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyWrap: { alignItems: "center", paddingTop: Spacing["2xl"], gap: Spacing.sm },
  emptyTitle: { ...Typography.h3 },
  emptyMsg: { ...Typography.bodyMedium, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    padding: Spacing.xl,
    paddingBottom: Spacing["2xl"],
  },
  modalTitle: { ...Typography.h3Heavy },
  modalSubtitle: { ...Typography.labelLight, marginBottom: Spacing.md },
  portsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  stagingOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
});
