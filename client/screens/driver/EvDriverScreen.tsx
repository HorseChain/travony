import React, { useState, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect } from "@react-navigation/native";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import RideMap from "@/components/RideMap";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface EvConnection {
  connected: boolean;
  liveDataAvailable: boolean;
  source: "live" | "simulated" | "stale" | "manual" | "none";
  status: "connected" | "expired" | "error" | "disconnected";
  batteryPercent: number | null;
  rangeKm: number | null;
  isCharging: boolean;
  chargingState: string | null;
  targetChargePercent: number;
  timeToReadyMinutes: number | null;
  updatedAt: string | null;
  provider: string | null;
  isSimulated: boolean;
  error?: string;
}

interface Charger {
  id: string;
  name: string;
  lat: number;
  lng: number;
  operator?: string | null;
  connectorTypes: string[];
  maxPowerKw?: number | null;
  isOperational: boolean;
  distanceKm: number;
}

interface ChargersResult {
  chargers: Charger[];
  source: "live" | "cache" | "simulated" | "unavailable";
  keyed: boolean;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} d ago`;
}

function sourceLabel(source: string): { text: string; color: string } {
  switch (source) {
    case "live":
      return { text: "Live from your car", color: Colors.travonyGreen };
    case "simulated":
      return { text: "Simulated (demo data)", color: "#F59E0B" };
    case "stale":
      return { text: "Last known reading", color: "#F59E0B" };
    case "manual":
      return { text: "Manually entered", color: "#2196F3" };
    case "cache":
      return { text: "Recently cached", color: Colors.travonyGreen };
    default:
      return { text: "No data", color: "#9CA3AF" };
  }
}

export default function EvDriverScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [showManual, setShowManual] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === "granted") {
            const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
          }
        } catch {}
      })();
    }, [])
  );

  const { data: conn, isLoading: connLoading } = useQuery<EvConnection>({
    queryKey: ["/api/ev/connection"],
  });

  const chargersKey = location
    ? [`/api/ev/chargers/nearby?lat=${location.lat}&lng=${location.lng}&radius=10&max=15`]
    : ["/api/ev/chargers/nearby:disabled"];
  const { data: chargers } = useQuery<ChargersResult>({
    queryKey: chargersKey,
    enabled: !!location,
  });

  const connectMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/ev/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    onSuccess: async (res: any) => {
      if (res?.mode === "live" && res?.authUrl) {
        try {
          await WebBrowser.openAuthSessionAsync(res.authUrl);
        } catch {}
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ev/connection"] });
    },
    onError: (e: any) => notify(e?.message || "Couldn't start the connection"),
  });

  const refreshMutation = useMutation({
    mutationFn: async () => apiRequest("/api/ev/refresh", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ev/connection"] }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => apiRequest("/api/ev/disconnect", { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/ev/connection"] }),
  });

  const manualMutation = useMutation({
    mutationFn: async (pct: number) =>
      apiRequest("/api/ev/manual-battery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batteryPercent: pct }),
      }),
    onSuccess: () => {
      setShowManual(false);
      setManualValue("");
      queryClient.invalidateQueries({ queryKey: ["/api/ev/connection"] });
    },
    onError: (e: any) => notify(e?.message || "Couldn't save battery level"),
  });

  const notify = (msg: string) => {
    if (Platform.OS === "web") window.alert(msg);
    else Alert.alert("EV", msg);
  };

  const submitManual = () => {
    const pct = Number(manualValue);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      notify("Enter a battery level between 0 and 100");
      return;
    }
    manualMutation.mutate(Math.round(pct));
  };

  const isConnected = conn?.status === "connected";
  const hasBattery = conn?.batteryPercent != null;
  const src = sourceLabel(conn?.source ?? "none");
  const battColor =
    (conn?.batteryPercent ?? 100) <= 20
      ? "#EF4444"
      : (conn?.batteryPercent ?? 100) <= 40
      ? "#F59E0B"
      : Colors.travonyGreen;

  const chargerMarkers = (chargers?.chargers ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    lat: c.lat,
    lng: c.lng,
    maxPowerKw: c.maxPowerKw,
    isOperational: c.isOperational,
  }));

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + Spacing["2xl"],
          gap: Spacing.md,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
      >
        {/* Connection / battery card */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          {connLoading ? (
            <View style={styles.centerWrap}>
              <ActivityIndicator color={Colors.travonyGreen} />
            </View>
          ) : (
            <>
              <View style={styles.rowBetween}>
                <View style={styles.row}>
                  <Ionicons name="battery-charging" size={20} color={Colors.travonyGreen} />
                  <ThemedText style={styles.cardTitle}>My EV</ThemedText>
                </View>
                <View style={[styles.sourcePill, { backgroundColor: src.color + "20" }]}>
                  <View style={[styles.sourceDot, { backgroundColor: src.color }]} />
                  <ThemedText style={[styles.sourcePillText, { color: src.color }]}>{src.text}</ThemedText>
                </View>
              </View>

              {hasBattery ? (
                <>
                  <View style={styles.batteryRow}>
                    <ThemedText style={[styles.batteryPct, { color: battColor }]}>
                      {conn?.batteryPercent}%
                    </ThemedText>
                    <View style={{ flex: 1, marginLeft: Spacing.md }}>
                      <View style={[styles.battTrack, { backgroundColor: theme.border }]}>
                        <View
                          style={{
                            width: `${conn?.batteryPercent ?? 0}%`,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: battColor,
                          }}
                        />
                      </View>
                      <View style={[styles.row, { marginTop: 6, gap: Spacing.md }]}>
                        {conn?.rangeKm != null ? (
                          <ThemedText style={[styles.metaText, { color: theme.textMuted }]}>
                            {Math.round(conn.rangeKm)} km range
                          </ThemedText>
                        ) : null}
                        {conn?.isCharging ? (
                          <View style={styles.row}>
                            <Ionicons name="flash" size={12} color="#2196F3" />
                            <ThemedText style={[styles.metaText, { color: "#2196F3" }]}>Charging</ThemedText>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>

                  {conn?.isCharging && conn?.timeToReadyMinutes != null ? (
                    <View style={[styles.readyBanner, { backgroundColor: "#2196F315" }]}>
                      <Ionicons name="time-outline" size={16} color="#2196F3" />
                      <ThemedText style={[styles.metaText, { color: "#2196F3" }]}>
                        {conn.timeToReadyMinutes === 0
                          ? `Charged to ${conn.targetChargePercent}% target`
                          : `~${conn.timeToReadyMinutes} min to ${conn.targetChargePercent}%`}
                      </ThemedText>
                    </View>
                  ) : null}

                  <ThemedText style={[styles.updatedText, { color: theme.textMuted }]}>
                    Updated {timeAgo(conn?.updatedAt ?? null)}
                  </ThemedText>
                </>
              ) : (
                <ThemedText style={[styles.bodyText, { color: theme.textSecondary }]}>
                  {conn?.status === "expired"
                    ? "Your car link expired. Reconnect to see live battery again."
                    : conn?.status === "error"
                    ? "We couldn't reach your car. Try refreshing, or enter your battery manually."
                    : "Connect your car to share live battery and range, or enter it manually."}
                </ThemedText>
              )}

              {/* Actions */}
              <View style={[styles.row, { flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.md }]}>
                {isConnected ? (
                  <>
                    <Pressable
                      style={[styles.btn, { backgroundColor: Colors.travonyGreen }]}
                      onPress={() => refreshMutation.mutate()}
                    >
                      {refreshMutation.isPending ? (
                        <ActivityIndicator size="small" color="#FFF" />
                      ) : (
                        <>
                          <Ionicons name="refresh" size={16} color="#FFF" />
                          <ThemedText style={styles.btnText}>Refresh</ThemedText>
                        </>
                      )}
                    </Pressable>
                    <Pressable
                      style={[styles.btnOutline, { borderColor: theme.border }]}
                      onPress={() => disconnectMutation.mutate()}
                    >
                      <ThemedText style={[styles.btnOutlineText, { color: theme.textSecondary }]}>
                        Disconnect
                      </ThemedText>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={[styles.btn, { backgroundColor: Colors.travonyGreen }]}
                    onPress={() => connectMutation.mutate()}
                  >
                    {connectMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <>
                        <Ionicons name="link" size={16} color="#FFF" />
                        <ThemedText style={styles.btnText}>
                          {conn?.liveDataAvailable ? "Connect my car" : "Connect (demo)"}
                        </ThemedText>
                      </>
                    )}
                  </Pressable>
                )}
                <Pressable
                  style={[styles.btnOutline, { borderColor: theme.border }]}
                  onPress={() => setShowManual((s) => !s)}
                >
                  <Ionicons name="create-outline" size={15} color={theme.textSecondary} />
                  <ThemedText style={[styles.btnOutlineText, { color: theme.textSecondary }]}>
                    Enter manually
                  </ThemedText>
                </Pressable>
              </View>

              {showManual ? (
                <View style={[styles.manualRow, { borderColor: theme.border }]}>
                  <TextInput
                    style={[styles.manualInput, { color: theme.textPrimary, borderColor: theme.border }]}
                    placeholder="Battery %"
                    placeholderTextColor={theme.textMuted}
                    keyboardType="number-pad"
                    value={manualValue}
                    onChangeText={setManualValue}
                    maxLength={3}
                  />
                  <Pressable
                    style={[styles.btn, { backgroundColor: Colors.travonyGreen }]}
                    onPress={submitManual}
                  >
                    {manualMutation.isPending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <ThemedText style={styles.btnText}>Save</ThemedText>
                    )}
                  </Pressable>
                </View>
              ) : null}

              {!conn?.liveDataAvailable ? (
                <View style={[styles.infoNote, { backgroundColor: theme.backgroundElevated }]}>
                  <Ionicons name="information-circle-outline" size={14} color={theme.textMuted} />
                  <ThemedText style={[styles.infoNoteText, { color: theme.textMuted }]}>
                    Live car data isn't set up yet, so this uses demo readings. Everything still works — once
                    your car account is linked, real battery data appears here automatically.
                  </ThemedText>
                </View>
              ) : null}
            </>
          )}
        </View>

        {/* Onboarding / how it works */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={styles.cardTitle}>How EV mode helps you</ThemedText>
          {[
            { icon: "battery-charging-outline", t: "Live battery & range", d: "Riders who need an EV get matched to you with confidence." },
            { icon: "time-outline", t: "Smart charging status", d: "Your hub status updates to charging, ready, or departing on its own." },
            { icon: "warning-outline", t: "Low-battery heads-up", d: "Get a gentle warning before accepting a trip you might not finish." },
            { icon: "location-outline", t: "Find chargers fast", d: "See public chargers near you, distinct from network hubs." },
          ].map((it, i) => (
            <View key={i} style={[styles.row, { alignItems: "flex-start", marginTop: i === 0 ? Spacing.sm : Spacing.md }]}>
              <Ionicons name={it.icon as keyof typeof Ionicons.glyphMap} size={18} color={Colors.travonyGreen} />
              <View style={{ flex: 1, marginLeft: Spacing.sm }}>
                <ThemedText style={styles.featTitle}>{it.t}</ThemedText>
                <ThemedText style={[styles.featDesc, { color: theme.textMuted }]}>{it.d}</ThemedText>
              </View>
            </View>
          ))}
        </View>

        {/* Nearby chargers */}
        <View style={[styles.card, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.rowBetween}>
            <ThemedText style={styles.cardTitle}>Nearby public chargers</ThemedText>
            {chargers ? (
              <ThemedText style={[styles.metaText, { color: theme.textMuted }]}>
                {chargers.source === "simulated"
                  ? "Demo list"
                  : chargers.source === "unavailable"
                  ? "Unavailable"
                  : "Live"}
              </ThemedText>
            ) : null}
          </View>

          {!location ? (
            <ThemedText style={[styles.bodyText, { color: theme.textSecondary }]}>
              Enable location to see chargers near you.
            </ThemedText>
          ) : (
            <>
              <View style={styles.mapWrap}>
                <RideMap
                  currentLocation={location}
                  showUserLocation
                  showRoute={false}
                  interactive
                  height={180}
                  chargerMarkers={chargerMarkers}
                />
              </View>
              <View style={{ marginTop: Spacing.sm, gap: Spacing.sm }}>
                {(chargers?.chargers ?? []).slice(0, 6).map((c) => (
                  <View key={c.id} style={[styles.chargerRow, { borderColor: theme.border }]}>
                    <View
                      style={[
                        styles.chargerIcon,
                        { backgroundColor: (c.isOperational ? "#0EA5A4" : "#9CA3AF") + "20" },
                      ]}
                    >
                      <Ionicons
                        name="battery-charging"
                        size={16}
                        color={c.isOperational ? "#0EA5A4" : "#9CA3AF"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={styles.chargerName} numberOfLines={1}>
                        {c.name}
                      </ThemedText>
                      <ThemedText style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
                        {c.distanceKm} km
                        {c.maxPowerKw ? ` · ${c.maxPowerKw} kW` : ""}
                        {c.connectorTypes?.length ? ` · ${c.connectorTypes[0]}` : ""}
                        {!c.isOperational ? " · offline" : ""}
                      </ThemedText>
                    </View>
                  </View>
                ))}
                {chargers && chargers.chargers.length === 0 ? (
                  <ThemedText style={[styles.bodyText, { color: theme.textSecondary }]}>
                    No chargers found nearby.
                  </ThemedText>
                ) : null}
              </View>
            </>
          )}
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  centerWrap: { paddingVertical: Spacing.lg, alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  bodyText: { fontSize: 13, lineHeight: 19, marginTop: Spacing.sm },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  sourceDot: { width: 6, height: 6, borderRadius: 3 },
  sourcePillText: { fontSize: 11, fontWeight: "600" },
  batteryRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing.md },
  batteryPct: { fontSize: 34, fontWeight: "800" },
  battTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  metaText: { fontSize: 12, fontWeight: "500" },
  readyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  updatedText: { fontSize: 11, marginTop: Spacing.sm },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    minWidth: 90,
  },
  btnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  btnOutline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  btnOutlineText: { fontSize: 13, fontWeight: "600" },
  manualRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: Spacing.md },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontSize: 15,
  },
  infoNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  infoNoteText: { fontSize: 11, lineHeight: 16, flex: 1 },
  featTitle: { fontSize: 14, fontWeight: "600" },
  featDesc: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  mapWrap: {
    height: 180,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    marginTop: Spacing.sm,
  },
  chargerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  chargerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  chargerName: { fontSize: 14, fontWeight: "600" },
});
