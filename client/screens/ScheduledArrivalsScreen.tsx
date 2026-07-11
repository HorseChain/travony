import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Colors } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

type Category = "mall" | "university" | "airport" | "hotel" | "other";

const CATEGORY_CONFIG: Record<Category, { label: string; icon: string; buffer: number; bufferHint: string }> = {
  mall: { label: "Mall", icon: "bag-handle-outline", buffer: 10, bufferHint: "parking & walking in" },
  university: { label: "University", icon: "school-outline", buffer: 15, bufferHint: "getting to class" },
  airport: { label: "Airport", icon: "airplane-outline", buffer: 90, bufferHint: "check-in & security" },
  hotel: { label: "Hotel", icon: "bed-outline", buffer: 10, bufferHint: "check-in" },
  other: { label: "Other", icon: "location-outline", buffer: 10, bufferHint: "a little extra time" },
};

const HUB_TYPE_TO_CATEGORY: Record<string, Category> = {
  mall: "mall",
  airport: "airport",
  university: "university",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface BrowseHub {
  id: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  address?: string;
}

interface ArrivalItem {
  id: string;
  label: string;
  category: Category;
  destAddress: string;
  pickupAddress: string;
  mode: "once" | "weekly";
  daysOfWeek?: string | null;
  arriveTimeLocal?: string | null;
  arriveAtUtc?: string | null;
  bufferMinutes: number;
  status: string;
  lastRideId?: string | null;
  next: {
    arriveBy: string;
    pickupAt: string;
    dispatchAt: string;
    etaMin: number;
    distanceKm: number;
    occurrenceKey: string;
    skipped: boolean;
  } | null;
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (sameDay) return `today at ${time}`;
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${time}`;
}

function parseTimeInput(text: string): { hh: number; mm: number } | null {
  const m = text.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

export default function ScheduledArrivalsScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [creating, setCreating] = useState(false);

  // Form state
  const [selectedHub, setSelectedHub] = useState<BrowseHub | null>(null);
  const [category, setCategory] = useState<Category>("mall");
  const [bufferText, setBufferText] = useState(String(CATEGORY_CONFIG.mall.buffer));
  const [mode, setMode] = useState<"once" | "weekly">("once");
  const [dayOffset, setDayOffset] = useState<0 | 1>(0); // today / tomorrow
  const [weekDays, setWeekDays] = useState<number[]>([]);
  const [timeText, setTimeText] = useState("");
  const [pickup, setPickup] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [hubSearch, setHubSearch] = useState("");

  const { data: arrivals, isLoading } = useQuery<ArrivalItem[]>({
    queryKey: ["/api/scheduled-arrivals"],
    refetchInterval: 30000,
  });

  const { data: browseData } = useQuery<{ cities: { cityName: string; hubs: BrowseHub[] }[] }>({
    queryKey: ["/api/openclaw/hubs/browse"],
    enabled: creating,
  });

  const allHubs: (BrowseHub & { cityName: string })[] = useMemo(() => {
    if (!browseData?.cities) return [];
    return browseData.cities.flatMap((c) => c.hubs.map((h) => ({ ...h, cityName: c.cityName })));
  }, [browseData]);

  const filteredHubs = useMemo(() => {
    const q = hubSearch.trim().toLowerCase();
    if (!q) return allHubs;
    return allHubs.filter(
      (h) => h.name.toLowerCase().includes(q) || h.cityName.toLowerCase().includes(q),
    );
  }, [allHubs, hubSearch]);

  const resetForm = useCallback(() => {
    setSelectedHub(null);
    setCategory("mall");
    setBufferText(String(CATEGORY_CONFIG.mall.buffer));
    setMode("once");
    setDayOffset(0);
    setWeekDays([]);
    setTimeText("");
    setPickup(null);
    setHubSearch("");
  }, []);

  const useCurrentLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Location needed", "Allow location access so we know where to pick you up.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let address = "Current location";
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        });
        const r = results[0];
        if (r) {
          address = [r.name || r.street, r.city].filter(Boolean).join(", ") || address;
        }
      } catch {}
      setPickup({ address, lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      Alert.alert("Location error", "We couldn't get your location. Please try again.");
    } finally {
      setLocating(false);
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHub) throw new Error("Pick a destination first");
      if (!pickup) throw new Error("Set your pickup location first");
      const time = parseTimeInput(timeText);
      if (!time) throw new Error("Enter the arrival time as HH:MM (for example 18:30)");

      const body: Record<string, any> = {
        label: selectedHub.name,
        category,
        hubId: selectedHub.id,
        destAddress: selectedHub.address || selectedHub.name,
        destLat: selectedHub.lat,
        destLng: selectedHub.lng,
        pickupAddress: pickup.address,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        mode,
        bufferMinutes: parseInt(bufferText, 10) || CATEGORY_CONFIG[category].buffer,
        tzOffsetMinutes: -new Date().getTimezoneOffset(),
      };
      if (mode === "once") {
        const d = new Date();
        d.setDate(d.getDate() + dayOffset);
        d.setHours(time.hh, time.mm, 0, 0);
        if (d.getTime() < Date.now() + 5 * 60 * 1000) {
          throw new Error("That time has already passed — pick a later time or tomorrow");
        }
        body.arriveAtUtc = d.toISOString();
      } else {
        if (weekDays.length === 0) throw new Error("Pick at least one day of the week");
        body.daysOfWeek = weekDays.join(",");
        body.arriveTimeLocal = `${String(time.hh).padStart(2, "0")}:${String(time.mm).padStart(2, "0")}`;
      }
      return apiRequest("/api/scheduled-arrivals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scheduled-arrivals"] });
      setCreating(false);
      resetForm();
    },
    onError: (error: any) => {
      Alert.alert("Couldn't schedule", error?.message || "Please check the details and try again.");
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" | "skip" }) =>
      apiRequest(`/api/scheduled-arrivals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scheduled-arrivals"] }),
    onError: (error: any) => Alert.alert("Couldn't update", error?.message || "Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/scheduled-arrivals/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/scheduled-arrivals"] }),
  });

  const confirmDelete = useCallback(
    (item: ArrivalItem) => {
      Alert.alert("Remove this trip?", `"${item.label}" will no longer be scheduled automatically.`, [
        { text: "Keep it", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteMutation.mutate(item.id) },
      ]);
    },
    [deleteMutation],
  );

  const selectHub = useCallback((hub: BrowseHub) => {
    setSelectedHub(hub);
    const cat = HUB_TYPE_TO_CATEGORY[hub.type] || "other";
    setCategory(cat);
    setBufferText(String(CATEGORY_CONFIG[cat].buffer));
  }, []);

  const selectCategory = useCallback((cat: Category) => {
    setCategory(cat);
    setBufferText(String(CATEGORY_CONFIG[cat].buffer));
  }, []);

  const chipStyle = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? Colors.travonyGreen : theme.backgroundElevated,
      borderColor: active ? Colors.travonyGreen : theme.border,
    },
  ];
  const chipText = (active: boolean) => [
    styles.chipText,
    { color: active ? "#fff" : theme.text },
  ];

  const renderForm = () => (
    <View style={[styles.formCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border }]}>
      <ThemedText style={styles.sectionLabel}>Where do you need to be?</ThemedText>
      {selectedHub ? (
        <Pressable
          style={[styles.selectedHubRow, { borderColor: Colors.travonyGreen }]}
          onPress={() => setSelectedHub(null)}
        >
          <Ionicons name={CATEGORY_CONFIG[category].icon as any} size={18} color={Colors.travonyGreen} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.hubName}>{selectedHub.name}</ThemedText>
            {selectedHub.address ? (
              <ThemedText style={[styles.hubMeta, { color: theme.textMuted }]} numberOfLines={1}>
                {selectedHub.address}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText style={[styles.changeLink, { color: Colors.travonyGreen }]}>Change</ThemedText>
        </Pressable>
      ) : (
        <View>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
            placeholder="Search malls, airports, universities..."
            placeholderTextColor={theme.textMuted}
            value={hubSearch}
            onChangeText={setHubSearch}
          />
          <View style={styles.hubList}>
            {filteredHubs.slice(0, 8).map((hub) => (
              <Pressable
                key={hub.id}
                style={[styles.hubRow, { borderColor: theme.border }]}
                onPress={() => selectHub(hub)}
              >
                <Ionicons
                  name={(CATEGORY_CONFIG[HUB_TYPE_TO_CATEGORY[hub.type] || "other"].icon) as any}
                  size={16}
                  color={theme.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.hubName}>{hub.name}</ThemedText>
                  <ThemedText style={[styles.hubMeta, { color: theme.textMuted }]}>{hub.cityName}</ThemedText>
                </View>
              </Pressable>
            ))}
            {filteredHubs.length === 0 ? (
              <ThemedText style={[styles.hubMeta, { color: theme.textMuted, paddingVertical: Spacing.md }]}>
                {browseData ? "No places match your search." : "Loading places..."}
              </ThemedText>
            ) : null}
          </View>
        </View>
      )}

      <ThemedText style={styles.sectionLabel}>Type of place</ThemedText>
      <View style={styles.chipRow}>
        {(Object.keys(CATEGORY_CONFIG) as Category[]).map((cat) => (
          <Pressable key={cat} style={chipStyle(category === cat)} onPress={() => selectCategory(cat)}>
            <ThemedText style={chipText(category === cat)}>{CATEGORY_CONFIG[cat].label}</ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText style={styles.sectionLabel}>Pickup from</ThemedText>
      <Pressable
        style={[styles.pickupRow, { borderColor: pickup ? Colors.travonyGreen : theme.border }]}
        onPress={useCurrentLocation}
        disabled={locating}
      >
        {locating ? (
          <ActivityIndicator size="small" color={Colors.travonyGreen} />
        ) : (
          <Ionicons name="navigate-outline" size={18} color={pickup ? Colors.travonyGreen : theme.textMuted} />
        )}
        <ThemedText style={[styles.pickupText, { color: pickup ? theme.text : theme.textMuted }]} numberOfLines={1}>
          {pickup ? pickup.address : "Use my current location"}
        </ThemedText>
      </Pressable>

      <ThemedText style={styles.sectionLabel}>When?</ThemedText>
      <View style={styles.chipRow}>
        <Pressable style={chipStyle(mode === "once")} onPress={() => setMode("once")}>
          <ThemedText style={chipText(mode === "once")}>One time</ThemedText>
        </Pressable>
        <Pressable style={chipStyle(mode === "weekly")} onPress={() => setMode("weekly")}>
          <ThemedText style={chipText(mode === "weekly")}>Every week</ThemedText>
        </Pressable>
      </View>

      {mode === "once" ? (
        <View style={styles.chipRow}>
          <Pressable style={chipStyle(dayOffset === 0)} onPress={() => setDayOffset(0)}>
            <ThemedText style={chipText(dayOffset === 0)}>Today</ThemedText>
          </Pressable>
          <Pressable style={chipStyle(dayOffset === 1)} onPress={() => setDayOffset(1)}>
            <ThemedText style={chipText(dayOffset === 1)}>Tomorrow</ThemedText>
          </Pressable>
        </View>
      ) : (
        <View style={styles.chipRow}>
          {DAY_LABELS.map((label, idx) => {
            const active = weekDays.includes(idx);
            return (
              <Pressable
                key={label}
                style={chipStyle(active)}
                onPress={() =>
                  setWeekDays((prev) => (active ? prev.filter((d) => d !== idx) : [...prev, idx].sort()))
                }
              >
                <ThemedText style={chipText(active)}>{label}</ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}

      <View style={styles.timeRow}>
        <View style={{ flex: 1 }}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textMuted }]}>Arrive by (24h time)</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
            placeholder="18:30"
            placeholderTextColor={theme.textMuted}
            value={timeText}
            onChangeText={setTimeText}
            keyboardType={Platform.OS === "web" ? undefined : "numbers-and-punctuation"}
            maxLength={5}
          />
        </View>
        <View style={{ width: 110 }}>
          <ThemedText style={[styles.fieldLabel, { color: theme.textMuted }]}>Extra minutes</ThemedText>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
            value={bufferText}
            onChangeText={setBufferText}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
      </View>
      <ThemedText style={[styles.bufferHint, { color: theme.textMuted }]}>
        Extra minutes cover {CATEGORY_CONFIG[category].bufferHint}. We book your ride so you arrive with this
        time to spare.
      </ThemedText>

      <View style={styles.formActions}>
        <Pressable
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => {
            setCreating(false);
            resetForm();
          }}
        >
          <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, { opacity: createMutation.isPending ? 0.6 : 1 }]}
          onPress={() => createMutation.mutate()}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Schedule it</ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );

  const renderItem = (item: ArrivalItem) => {
    const cfg = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.other;
    const paused = item.status === "paused";
    const done = item.status === "done";
    return (
      <View
        key={item.id}
        style={[styles.itemCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border, opacity: paused || done ? 0.6 : 1 }]}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.itemIcon, { backgroundColor: `${Colors.travonyGreen}20` }]}>
            <Ionicons name={cfg.icon as any} size={18} color={Colors.travonyGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.itemTitle}>{item.label}</ThemedText>
            <ThemedText style={[styles.hubMeta, { color: theme.textMuted }]} numberOfLines={1}>
              {item.mode === "weekly"
                ? `Every ${String(item.daysOfWeek || "")
                    .split(",")
                    .map((d) => DAY_LABELS[parseInt(d, 10)] || "")
                    .filter(Boolean)
                    .join(", ")} at ${item.arriveTimeLocal}`
                : done
                  ? "Completed"
                  : "One-time trip"}
            </ThemedText>
          </View>
          <Pressable hitSlop={8} onPress={() => confirmDelete(item)}>
            <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
          </Pressable>
        </View>

        {item.next && !paused && !done ? (
          <View style={[styles.nextBlock, { borderColor: theme.border }]}>
            <ThemedText style={styles.nextLine}>
              Arrive by <ThemedText style={styles.nextStrong}>{formatLocal(item.next.arriveBy)}</ThemedText>
            </ThemedText>
            {item.next.skipped ? (
              <ThemedText style={[styles.hubMeta, { color: theme.textMuted }]}>
                Skipped — next one will be scheduled automatically.
              </ThemedText>
            ) : (
              <ThemedText style={[styles.hubMeta, { color: theme.textMuted }]}>
                Pickup around {new Date(item.next.pickupAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ride locks in at{" "}
                {new Date(item.next.dispatchAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {item.next.etaMin} min trip
              </ThemedText>
            )}
          </View>
        ) : null}

        {done ? null : (
          <View style={styles.itemActions}>
            {item.next && !item.next.skipped && !paused ? (
              <Pressable
                style={[styles.smallButton, { borderColor: theme.border }]}
                onPress={() => actionMutation.mutate({ id: item.id, action: "skip" })}
              >
                <ThemedText style={[styles.smallButtonText, { color: theme.text }]}>Skip next</ThemedText>
              </Pressable>
            ) : null}
            {item.mode === "weekly" ? (
              <Pressable
                style={[styles.smallButton, { borderColor: theme.border }]}
                onPress={() => actionMutation.mutate({ id: item.id, action: paused ? "resume" : "pause" })}
              >
                <ThemedText style={[styles.smallButtonText, { color: theme.text }]}>
                  {paused ? "Resume" : "Pause"}
                </ThemedText>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        <View style={[styles.heroCard, { backgroundColor: `${Colors.travonyGreen}15`, borderColor: `${Colors.travonyGreen}40` }]}>
          <Ionicons name="alarm-outline" size={22} color={Colors.travonyGreen} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.heroTitle}>Rides that book themselves</ThemedText>
            <ThemedText style={[styles.heroText, { color: theme.textMuted }]}>
              Tell us where you need to be and when. We work out the pickup time from live travel time, and a
              driver is dispatched automatically — you never open the app.
            </ThemedText>
          </View>
        </View>

        {creating ? (
          renderForm()
        ) : (
          <Pressable style={styles.primaryButton} onPress={() => setCreating(true)}>
            <Ionicons name="add" size={18} color="#fff" />
            <ThemedText style={styles.primaryButtonText}>Schedule an arrival</ThemedText>
          </Pressable>
        )}

        <View style={{ marginTop: Spacing.lg }}>
          {isLoading ? (
            <ActivityIndicator color={Colors.travonyGreen} style={{ marginTop: Spacing.xl }} />
          ) : arrivals && arrivals.length > 0 ? (
            arrivals.map(renderItem)
          ) : !creating ? (
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              Nothing scheduled yet. Perfect for flights, classes, hotel check-ins or mall meetups.
            </ThemedText>
          ) : null}
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroCard: {
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    alignItems: "flex-start",
  },
  heroTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  heroText: { fontSize: 12, lineHeight: 17 },
  formCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", marginTop: Spacing.md, marginBottom: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    fontSize: 14,
  },
  hubList: { marginTop: Spacing.sm },
  hubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedHubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
  },
  hubName: { fontSize: 14, fontWeight: "600" },
  hubMeta: { fontSize: 12 },
  changeLink: { fontSize: 12, fontWeight: "700" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 12, fontWeight: "600" },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
  },
  pickupText: { fontSize: 14, flex: 1 },
  timeRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.md },
  fieldLabel: { fontSize: 11, fontWeight: "600", marginBottom: 4 },
  bufferHint: { fontSize: 11, marginTop: Spacing.sm, lineHeight: 15 },
  formActions: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.travonyGreen,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  itemCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { fontSize: 15, fontWeight: "700" },
  nextBlock: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  nextLine: { fontSize: 13 },
  nextStrong: { fontSize: 13, fontWeight: "700" },
  itemActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  smallButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
  },
  smallButtonText: { fontSize: 12, fontWeight: "600" },
  emptyText: { fontSize: 13, textAlign: "center", marginTop: Spacing.xl, lineHeight: 18 },
});
