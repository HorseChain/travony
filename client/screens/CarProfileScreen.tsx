/**
 * CarProfileScreen — the public face of a talking car.
 *
 * Hero photo, persona name + AI-drafted (honesty-guarded) blurb, and the car's
 * REAL track record: rating, trips, time in the fleet. Every number comes from
 * the deterministic backend. "Talk to me" opens the car chat.
 */

import React, { useEffect, useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import * as Location from "expo-location";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

type NavigationProp = NativeStackNavigationProp<HomeStackParamList, "CarProfile">;
type RouteProps = RouteProp<HomeStackParamList, "CarProfile">;

interface CarProfile {
  vehicleId: string;
  personaName: string;
  blurb: string;
  make: string;
  model: string;
  color: string | null;
  year: number | null;
  photo: string | null;
  rating: string | null;
  ratingCount: number;
  totalTrips: number;
  fleetTenure: string;
  isOnline: boolean;
  isLive: boolean;
  distanceKm: number | null;
  etaMinutes: number | null;
}

interface HighlightReelClip {
  id: string;
  title: string | null;
  caption: string | null;
  durationSec: number;
  thumbnailData: string | null;
  cityName: string | null;
}

function StatBlock({ value, label }: { value: string; label: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.statBlock}>
      <ThemedText style={styles.statValue}>{value}</ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</ThemedText>
    </View>
  );
}

export default function CarProfileScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { vehicleId } = route.params;

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== "granted") return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch {
        // profile works without an ETA
      }
    })();
  }, []);

  const profileUrl = coords
    ? `/api/cars/${vehicleId}/profile?lat=${coords.lat}&lng=${coords.lng}`
    : `/api/cars/${vehicleId}/profile`;
  const { data: car, isLoading, isError } = useQuery<CarProfile>({
    queryKey: [profileUrl],
  });

  // Driver-approved highlight clips from this car's live streams.
  const { data: clipsData } = useQuery<{ clips: HighlightReelClip[] }>({
    queryKey: [`/api/cars/${vehicleId}/clips`],
  });
  const clips = clipsData?.clips || [];

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  if (isError || !car) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <Ionicons name="car-outline" size={40} color={theme.textMuted} />
        <ThemedText style={{ marginTop: Spacing.md, color: theme.textSecondary }}>
          This car isn't available right now.
        </ThemedText>
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: Spacing.lg }}>
          <ThemedText style={{ color: theme.primary }}>Go back</ThemedText>
        </Pressable>
      </View>
    );
  }

  const carDesc = [car.color, car.make, car.model].filter(Boolean).join(" ");

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 120 }} showsVerticalScrollIndicator={false}>
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {car.photo ? (
            <Image source={{ uri: car.photo }} style={StyleSheet.absoluteFill} contentFit="cover" />
          ) : (
            <LinearGradient colors={["#0D0020", "#1E0038", "#0A0015"]} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.5)", "rgba(0,0,0,0)", "rgba(0,0,0,0.85)"]}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.heroTop, { top: insets.top + Spacing.sm }]}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={8}>
              <Ionicons name="chevron-back" size={22} color="#fff" />
            </Pressable>
            {car.isLive ? (
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <ThemedText style={styles.liveText}>LIVE</ThemedText>
              </View>
            ) : null}
          </View>

          <View style={styles.heroBottom}>
            <View style={styles.nameRow}>
              <ThemedText style={styles.personaName}>{car.personaName}</ThemedText>
              {car.isOnline ? <View style={styles.onlineDot} /> : null}
            </View>
            <ThemedText style={styles.carDesc}>
              {carDesc}
              {car.year ? ` · ${car.year}` : ""}
            </ThemedText>
            {car.etaMinutes !== null ? (
              <View style={styles.etaChip}>
                <Ionicons name="time-outline" size={13} color="#fff" />
                <ThemedText style={styles.etaText}>
                  ~{car.etaMinutes} min away · {car.distanceKm} km
                </ThemedText>
              </View>
            ) : null}
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={[styles.statsRow, { backgroundColor: theme.backgroundElevated }]}>
          <StatBlock value={car.rating ? `${car.rating}★` : "New"} label={car.ratingCount > 0 ? `${car.ratingCount} ratings` : "No ratings yet"} />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatBlock value={String(car.totalTrips)} label="Trips" />
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <StatBlock value={car.fleetTenure} label="With Travony" />
        </View>

        {/* ── Blurb ── */}
        <View style={styles.section}>
          <ThemedText style={[styles.blurb, { color: theme.text }]}>&ldquo;{car.blurb}&rdquo;</ThemedText>
        </View>

        {/* ── Highlight reel — driver-approved clips from live streams ── */}
        {clips.length > 0 ? (
          <View style={styles.reelSection}>
            <ThemedText style={styles.reelTitle}>Highlights</ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.reelRow}>
              {clips.map((clip) => (
                <Pressable
                  key={clip.id}
                  style={styles.reelCard}
                  onPress={() => navigation.navigate("ClipPlayer", { clipId: clip.id, title: clip.title || undefined })}
                >
                  {clip.thumbnailData ? (
                    <Image source={{ uri: clip.thumbnailData }} style={styles.reelThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.reelThumb, { backgroundColor: theme.backgroundSecondary }]} />
                  )}
                  <View style={styles.reelPlay}>
                    <Ionicons name="play" size={14} color="#fff" />
                  </View>
                  <View style={styles.reelChip}>
                    <ThemedText style={styles.reelChipText}>{clip.durationSec}s</ThemedText>
                  </View>
                  {clip.title ? (
                    <ThemedText numberOfLines={1} style={[styles.reelCaption, { color: theme.textSecondary }]}>
                      {clip.title}
                    </ThemedText>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </ScrollView>

      {/* ── Talk to me ── */}
      <View style={[styles.ctaWrap, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Pressable
          onPress={() => navigation.navigate("CarChat", { vehicleId: car.vehicleId, personaName: car.personaName })}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: Colors.travonyGreen, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <Ionicons name="chatbubble-ellipses" size={20} color="#fff" />
          <ThemedText style={styles.ctaText}>Talk to me</ThemedText>
        </Pressable>
        {!car.isOnline ? (
          <ThemedText style={[styles.ctaHint, { color: theme.textMuted }]}>
            I'm parked right now — you can still chat, booking resumes when I'm back on the road.
          </ThemedText>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  hero: { height: 380, justifyContent: "flex-end" },
  heroTop: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.liveRed,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#fff" },
  liveText: { fontSize: 12, fontWeight: "800", color: "#fff", letterSpacing: 1 },
  heroBottom: { padding: Spacing.lg },
  nameRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  personaName: { fontSize: 30, fontWeight: "800", color: "#fff" },
  reelSection: { marginTop: Spacing.lg, paddingLeft: Spacing.lg },
  reelTitle: { fontSize: 17, fontWeight: "700", marginBottom: Spacing.md },
  reelRow: { gap: Spacing.md, paddingRight: Spacing.lg },
  reelCard: { width: 108 },
  reelThumb: { width: 108, height: 192, borderRadius: BorderRadius.md },
  reelPlay: {
    position: "absolute",
    top: 78,
    left: 38,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  reelChip: {
    position: "absolute",
    top: 158,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  reelChipText: { fontSize: 10, color: "#fff", fontWeight: "700" },
  reelCaption: { fontSize: 12, marginTop: 5 },
  onlineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.travonyGreen,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.5)",
  },
  carDesc: { fontSize: 15, color: "rgba(255,255,255,0.85)", marginTop: 2 },
  etaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginTop: Spacing.sm,
  },
  etaText: { fontSize: 13, color: "#fff", fontWeight: "600" },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: -Spacing.xl,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.lg,
    alignItems: "center",
  },
  statBlock: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "800" },
  statLabel: { fontSize: 12, marginTop: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, alignSelf: "stretch", marginVertical: 4 },
  section: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl },
  blurb: { fontSize: 17, lineHeight: 26, fontStyle: "italic" },
  ctaWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.xl,
    paddingVertical: 16,
  },
  ctaText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  ctaHint: { fontSize: 12, textAlign: "center", marginTop: Spacing.sm },
});
