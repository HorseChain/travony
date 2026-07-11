import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
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

const PRAYER_OPTIONS: { key: string; label: string }[] = [
  { key: "fajr", label: "Fajr" },
  { key: "dhuhr", label: "Dhuhr" },
  { key: "asr", label: "Asr" },
  { key: "maghrib", label: "Maghrib" },
  { key: "isha", label: "Isha" },
  { key: "jumuah", label: "Jumu'ah" },
];

interface Mosque {
  id: string;
  name: string;
  address?: string | null;
  lat: string;
  lng: string;
  regionCode?: string | null;
}

interface Subscription {
  id: string;
  mosqueName: string;
  mosqueAddress?: string | null;
  pickupAddress: string;
  prayers: string;
  bufferMinutes: number;
  status: string;
  next: {
    prayer: string;
    prayerLabel: string;
    prayerTime: string;
    pickupAt: string;
    dispatchAt: string;
    etaMin: number;
    skipped: boolean;
    dispatched: boolean;
    rideId: string | null;
  } | null;
}

function formatLocal(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `today at ${time}`;
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  if (d.toDateString() === tomorrow.toDateString()) return `tomorrow at ${time}`;
  return `${d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} at ${time}`;
}

export default function PrayerRidesScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [editing, setEditing] = useState(false);
  const [selectedMosque, setSelectedMosque] = useState<Mosque | null>(null);
  const [selectedPrayers, setSelectedPrayers] = useState<string[]>([]);
  const [bufferText, setBufferText] = useState("10");
  const [pickup, setPickup] = useState<{ address: string; lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [mosqueSearch, setMosqueSearch] = useState("");

  const { data: subscriptions, isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/prayer-rides"],
    refetchInterval: 30000,
  });

  const { data: mosques } = useQuery<Mosque[]>({
    queryKey: ["/api/prayer-rides/mosques"],
    enabled: editing,
  });

  const filteredMosques = (mosques || []).filter((m) => {
    const q = mosqueSearch.trim().toLowerCase();
    if (!q) return true;
    return m.name.toLowerCase().includes(q) || (m.address || "").toLowerCase().includes(q);
  });

  const subscription = (subscriptions || [])[0] || null;

  const resetForm = useCallback(() => {
    setSelectedMosque(null);
    setSelectedPrayers([]);
    setBufferText("10");
    setPickup(null);
    setMosqueSearch("");
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

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedMosque) throw new Error("Choose your mosque first");
      if (!pickup) throw new Error("Set your pickup location first");
      if (selectedPrayers.length === 0) throw new Error("Pick at least one prayer");
      return apiRequest("/api/prayer-rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hubId: selectedMosque.id,
          pickupAddress: pickup.address,
          pickupLat: pickup.lat,
          pickupLng: pickup.lng,
          prayers: selectedPrayers,
          bufferMinutes: parseInt(bufferText, 10) || 10,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/prayer-rides"] });
      setEditing(false);
      resetForm();
    },
    onError: (error: any) => {
      Alert.alert("Couldn't save", error?.message || "Please check the details and try again.");
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "pause" | "resume" | "skip" }) =>
      apiRequest(`/api/prayer-rides/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/prayer-rides"] }),
    onError: (error: any) => Alert.alert("Couldn't update", error?.message || "Please try again."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/prayer-rides/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/prayer-rides"] }),
  });

  const confirmDelete = useCallback(
    (sub: Subscription) => {
      Alert.alert(
        "Turn off Prayer Rides?",
        `Rides to ${sub.mosqueName} will no longer be booked automatically.`,
        [
          { text: "Keep it", style: "cancel" },
          { text: "Turn off", style: "destructive", onPress: () => deleteMutation.mutate(sub.id) },
        ],
      );
    },
    [deleteMutation],
  );

  const startEditing = useCallback(() => {
    if (subscription) {
      setSelectedPrayers(subscription.prayers.split(",").filter(Boolean));
      setBufferText(String(subscription.bufferMinutes));
    }
    setEditing(true);
  }, [subscription]);

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
      <ThemedText style={styles.sectionLabel}>Your mosque</ThemedText>
      {selectedMosque ? (
        <Pressable
          style={[styles.selectedRow, { borderColor: Colors.travonyGreen }]}
          onPress={() => setSelectedMosque(null)}
        >
          <Ionicons name="moon-outline" size={18} color={Colors.travonyGreen} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.rowTitle}>{selectedMosque.name}</ThemedText>
            {selectedMosque.address ? (
              <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                {selectedMosque.address}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText style={[styles.changeLink, { color: Colors.travonyGreen }]}>Change</ThemedText>
        </Pressable>
      ) : (
        <View>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
            placeholder="Search mosques..."
            placeholderTextColor={theme.textMuted}
            value={mosqueSearch}
            onChangeText={setMosqueSearch}
          />
          <View style={styles.list}>
            {filteredMosques.slice(0, 8).map((m) => (
              <Pressable
                key={m.id}
                style={[styles.listRow, { borderColor: theme.border }]}
                onPress={() => setSelectedMosque(m)}
              >
                <Ionicons name="moon-outline" size={16} color={theme.textMuted} />
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.rowTitle}>{m.name}</ThemedText>
                  {m.address ? (
                    <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]} numberOfLines={1}>
                      {m.address}
                    </ThemedText>
                  ) : null}
                </View>
              </Pressable>
            ))}
            {filteredMosques.length === 0 ? (
              <ThemedText style={[styles.rowMeta, { color: theme.textMuted, paddingVertical: Spacing.md }]}>
                {mosques ? "No mosques match your search." : "Loading mosques..."}
              </ThemedText>
            ) : null}
          </View>
        </View>
      )}

      <ThemedText style={styles.sectionLabel}>Which prayers?</ThemedText>
      <View style={styles.chipRow}>
        {PRAYER_OPTIONS.map((p) => {
          const active = selectedPrayers.includes(p.key);
          return (
            <Pressable
              key={p.key}
              style={chipStyle(active)}
              onPress={() =>
                setSelectedPrayers((prev) =>
                  active ? prev.filter((x) => x !== p.key) : [...prev, p.key],
                )
              }
            >
              <ThemedText style={chipText(active)}>{p.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText style={[styles.hint, { color: theme.textMuted }]}>
        Jumu'ah is the Friday congregation — we book it on Fridays only.
      </ThemedText>

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

      <ThemedText style={styles.sectionLabel}>Arrive early (minutes)</ThemedText>
      <TextInput
        style={[styles.input, { width: 110, color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}
        value={bufferText}
        onChangeText={setBufferText}
        keyboardType="number-pad"
        maxLength={2}
      />
      <ThemedText style={[styles.hint, { color: theme.textMuted }]}>
        Extra time before the prayer for wudu and finding your row. We book your ride so you arrive with
        these minutes to spare.
      </ThemedText>

      <View style={styles.formActions}>
        <Pressable
          style={[styles.secondaryButton, { borderColor: theme.border }]}
          onPress={() => {
            setEditing(false);
            resetForm();
          }}
        >
          <ThemedText style={{ color: theme.text }}>Cancel</ThemedText>
        </Pressable>
        <Pressable
          style={[styles.primaryButton, { opacity: saveMutation.isPending ? 0.6 : 1 }]}
          onPress={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Save</ThemedText>
          )}
        </Pressable>
      </View>
    </View>
  );

  const renderSubscription = (sub: Subscription) => {
    const paused = sub.status === "paused";
    const prayerList = sub.prayers
      .split(",")
      .map((p) => PRAYER_OPTIONS.find((o) => o.key === p)?.label || p)
      .join(", ");
    return (
      <View
        key={sub.id}
        style={[styles.itemCard, { backgroundColor: theme.backgroundElevated, borderColor: theme.border, opacity: paused ? 0.6 : 1 }]}
      >
        <View style={styles.itemHeader}>
          <View style={[styles.itemIcon, { backgroundColor: `${Colors.travonyGreen}20` }]}>
            <Ionicons name="moon-outline" size={18} color={Colors.travonyGreen} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.itemTitle}>{sub.mosqueName}</ThemedText>
            <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]} numberOfLines={1}>
              {prayerList} · arrive {sub.bufferMinutes} min early
            </ThemedText>
          </View>
          <Pressable hitSlop={8} onPress={() => confirmDelete(sub)}>
            <Ionicons name="trash-outline" size={18} color={theme.textMuted} />
          </Pressable>
        </View>

        {sub.next && !paused ? (
          <View style={[styles.nextBlock, { borderColor: theme.border }]}>
            <ThemedText style={styles.nextLine}>
              {sub.next.prayerLabel} <ThemedText style={styles.nextStrong}>{formatLocal(sub.next.prayerTime)}</ThemedText>
            </ThemedText>
            {sub.next.skipped ? (
              <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]}>
                Skipped — the next prayer will be booked automatically.
              </ThemedText>
            ) : sub.next.dispatched ? (
              <ThemedText style={[styles.rowMeta, { color: Colors.travonyGreen }]}>
                Ride booked — pickup around{" "}
                {new Date(sub.next.pickupAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </ThemedText>
            ) : (
              <ThemedText style={[styles.rowMeta, { color: theme.textMuted }]}>
                Pickup around {new Date(sub.next.pickupAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ride locks in at{" "}
                {new Date(sub.next.dispatchAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · {sub.next.etaMin} min trip
              </ThemedText>
            )}
          </View>
        ) : null}

        <View style={styles.itemActions}>
          {sub.next && !sub.next.skipped && !sub.next.dispatched && !paused ? (
            <Pressable
              style={[styles.smallButton, { borderColor: theme.border }]}
              onPress={() => actionMutation.mutate({ id: sub.id, action: "skip" })}
            >
              <ThemedText style={[styles.smallButtonText, { color: theme.text }]}>Skip next</ThemedText>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.smallButton, { borderColor: theme.border }]}
            onPress={() => actionMutation.mutate({ id: sub.id, action: paused ? "resume" : "pause" })}
          >
            <ThemedText style={[styles.smallButtonText, { color: theme.text }]}>
              {paused ? "Resume" : "Pause"}
            </ThemedText>
          </Pressable>
          <Pressable style={[styles.smallButton, { borderColor: theme.border }]} onPress={startEditing}>
            <ThemedText style={[styles.smallButtonText, { color: theme.text }]}>Edit</ThemedText>
          </Pressable>
        </View>
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
          <Ionicons name="moon-outline" size={22} color={Colors.travonyGreen} />
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.heroTitle}>Never miss a prayer</ThemedText>
            <ThemedText style={[styles.heroText, { color: theme.textMuted }]}>
              Choose your mosque and prayers once. We follow the daily prayer times and book your ride
              automatically so you arrive with time for wudu — no app opening needed.
            </ThemedText>
          </View>
        </View>

        {editing ? (
          renderForm()
        ) : subscription ? null : (
          <Pressable style={styles.primaryButton} onPress={startEditing}>
            <Ionicons name="add" size={18} color="#fff" />
            <ThemedText style={styles.primaryButtonText}>Set up Prayer Rides</ThemedText>
          </Pressable>
        )}

        <View style={{ marginTop: Spacing.lg }}>
          {isLoading ? (
            <ActivityIndicator color={Colors.travonyGreen} style={{ marginTop: Spacing.xl }} />
          ) : subscription && !editing ? (
            renderSubscription(subscription)
          ) : !editing ? (
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              Set it up once — your rides to the mosque book themselves every day.
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
  list: { marginTop: Spacing.sm, gap: Spacing.xs },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  rowTitle: { fontSize: 14, fontWeight: "600" },
  rowMeta: { fontSize: 12 },
  changeLink: { fontSize: 12, fontWeight: "600" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 11, lineHeight: 15, marginTop: Spacing.sm },
  pickupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  pickupText: { flex: 1, fontSize: 14 },
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
    gap: Spacing.xs,
    backgroundColor: Colors.travonyGreen,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  itemCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  itemHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
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
    gap: 2,
  },
  nextLine: { fontSize: 13 },
  nextStrong: { fontSize: 13, fontWeight: "700", color: Colors.travonyGreen },
  itemActions: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.md },
  smallButton: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  smallButtonText: { fontSize: 12, fontWeight: "600" },
  emptyText: { fontSize: 13, textAlign: "center", marginTop: Spacing.xl, lineHeight: 18 },
});
