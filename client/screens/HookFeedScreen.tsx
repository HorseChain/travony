/**
 * HookFeedScreen — TikTok-style driver discovery feed.
 *
 * Full-screen vertical pager: each card is a driver profile with a live
 * Agora stream (or blurred vehicle photo) as the background, a right-side
 * action panel, a floating mini-map, and a scrolling data ticker.
 *
 * Two tabs — Nearby (public) and Following (auth) — sit below the wordmark
 * with an animated underline. Tab switch resets the list to index 0.
 */

import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
  useMemo,
  memo,
} from "react";
import {
  View,
  FlatList,
  Dimensions,
  StyleSheet,
  Pressable,
  StatusBar,
  Platform,
  Share,
  Text,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, useRoute, useIsFocused } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { BlurView } from "expo-blur";
import * as Location from "expo-location";

import { ThemedText } from "@/components/ThemedText";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import WebViewMap from "@/components/WebViewMap";
import { loadAgoraRtc, agoraNativeAvailable } from "@/lib/agoraNative";
import { useLiteMode } from "@/hooks/useLiteMode";
import type { StreamTokenBundle } from "@/hooks/useStreamChannel";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("screen");
const TAB_BAR_H = 80;
// Dubai fallback coords when location permission is denied
const DEFAULT_LAT = 25.2048;
const DEFAULT_LNG = 55.2708;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DiscoveryDriver {
  driverId: string;
  userId: string;
  name: string;
  avatar: string | null;
  rating: string | null;
  totalTrips: number | null;
  vehicle: {
    make: string;
    model: string;
    color: string | null;
    licensePlate: string;
    photo: string | null;
    type: string | null;
  } | null;
  vehicleId: string | null;
  personaName: string | null;
  distanceKm: number;
  etaMinutes: number;
  upfrontFare: number;
  currency: string;
  currencySymbol: string;
  isLive: boolean;
  postId: string | null;
  streamProvider: "agora" | null;
  approxLat: number | null;
  approxLng: number | null;
}

type FeedTab = "nearby" | "following";

interface RatingRow {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  riderName: string | null;
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(255,255,255,0.2)",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: "rgba(255,255,255,0.3)",
      }}
    >
      <Text style={{ fontWeight: "700", fontSize: size * 0.4, color: "#fff" }}>
        {(name || "?").charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// NearbyFollowingTabs — wordmark + animated tab strip + AI button
// ---------------------------------------------------------------------------

function TravonyTvPill() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const pulse = useSharedValue(1);

  // Live status only — never invents viewer counts. Polls only while this
  // screen is actually focused so backgrounded/logged-out sessions stay quiet.
  const isFocused = useIsFocused();
  const tvQuery = useQuery<{ live: boolean }>({
    queryKey: ["/api/tv/now"],
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: isFocused,
  });
  const isLive = tvQuery.data?.live === true;

  useEffect(() => {
    if (isLive) {
      pulse.value = withRepeat(
        withSequence(withTiming(0.35, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        true,
      );
    } else {
      pulse.value = withTiming(1, { duration: 200 });
    }
  }, [isLive]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Pressable
      onPress={() => navigation.navigate("TravonyTV")}
      style={tabStyles.tvPill}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Open Travony TV"
    >
      <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
      <Text style={tabStyles.tvPillEmoji}>📺</Text>
      <Text style={tabStyles.tvPillText}>Travony TV</Text>
      {isLive ? (
        <View style={tabStyles.tvLiveBadge}>
          <Animated.View style={[tabStyles.tvLiveDot, dotStyle]} />
          <Text style={tabStyles.tvLiveText}>LIVE</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function NearbyFollowingTabs({
  activeTab,
  onTabChange,
  insetTop,
  isAuthenticated,
}: {
  activeTab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  insetTop: number;
  isAuthenticated: boolean;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const underlineX = useSharedValue(activeTab === "nearby" ? 0 : 1);

  useEffect(() => {
    underlineX.value = withTiming(activeTab === "nearby" ? 0 : 1, { duration: 220 });
  }, [activeTab, underlineX]);

  // Each tab is 80 px wide; underline starts at left:20 within the first tab
  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value * 80 }],
  }));

  return (
    <View style={[tabStyles.container, { paddingTop: insetTop }]} pointerEvents="box-none">
      <View style={tabStyles.row} pointerEvents="box-none">
        <ThemedText style={tabStyles.wordmark}>travony</ThemedText>

        <View style={tabStyles.tabs}>
          <Pressable onPress={() => onTabChange("nearby")} style={tabStyles.tab} hitSlop={8}>
            <Text style={[tabStyles.tabText, activeTab === "nearby" && tabStyles.tabTextActive]}>
              Nearby
            </Text>
          </Pressable>
          <Pressable onPress={() => onTabChange("following")} style={tabStyles.tab} hitSlop={8}>
            <Text style={[tabStyles.tabText, activeTab === "following" && tabStyles.tabTextActive]}>
              Following
            </Text>
          </Pressable>
          <Animated.View style={[tabStyles.underline, underlineStyle]} />
        </View>

        <Pressable
          onPress={() => navigation.navigate("AssistantHome")}
          style={tabStyles.aiBtn}
          hitSlop={12}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <Ionicons name="chatbubble-ellipses-outline" size={21} color="#fff" />
        </Pressable>
      </View>

      {/* Travony TV entry point */}
      <View style={tabStyles.tvRow} pointerEvents="box-none">
        <TravonyTvPill />
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  tabs: {
    flexDirection: "row",
    position: "relative",
  },
  tab: {
    width: 80,
    alignItems: "center",
    paddingVertical: Spacing.xs,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
  },
  tabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  underline: {
    position: "absolute",
    bottom: -2,
    left: 20,
    width: 40,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: "#fff",
  },
  aiBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  tvRow: {
    flexDirection: "row",
    marginTop: Spacing.xs,
  },
  tvPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.full,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  tvPillEmoji: { fontSize: 13 },
  tvPillText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  tvLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E53935",
  },
  tvLiveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  tvLiveText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
});

// ---------------------------------------------------------------------------
// DataTicker — animated horizontal marquee
// ---------------------------------------------------------------------------

function DataTicker({ driver }: { driver: DiscoveryDriver }) {
  const parts: string[] = [];
  if (driver.vehicle?.make && driver.vehicle?.model)
    parts.push(`${driver.vehicle.make} ${driver.vehicle.model}`);
  if (driver.vehicle?.licensePlate) parts.push(driver.vehicle.licensePlate);
  parts.push(`${driver.etaMinutes} min away`);
  parts.push(`${driver.currencySymbol}${driver.upfrontFare}`);
  const text = parts.join("  ·  ");

  const x = useSharedValue(SCREEN_W);
  const [textW, setTextW] = useState(0);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  useEffect(() => {
    if (textW <= 0) return;
    const travel = SCREEN_W + textW + 32;
    x.value = SCREEN_W;
    x.value = withRepeat(withTiming(-(textW + 32), { duration: travel * 14 }), -1, false);
  }, [text, textW]);

  return (
    <View style={tickerStyles.outer}>
      <LinearGradient
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.52)"]}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View
        style={[tickerStyles.inner, animStyle]}
        onLayout={(e) => setTextW(e.nativeEvent.layout.width)}
      >
        <Text style={tickerStyles.text} numberOfLines={1}>
          {text}{"    ·    "}{text}
        </Text>
      </Animated.View>
    </View>
  );
}

const tickerStyles = StyleSheet.create({
  outer: { height: 36, overflow: "hidden", justifyContent: "center" },
  inner: { position: "absolute", flexDirection: "row", alignItems: "center" },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 0.2,
    paddingHorizontal: Spacing.sm,
  },
});

// ---------------------------------------------------------------------------
// MiniMapOverlay — 120×120 rounded WebViewMap
// ---------------------------------------------------------------------------

function MiniMapOverlay({
  lat,
  lng,
  bottom,
  onExpand,
}: {
  lat: number;
  lng: number;
  bottom: number;
  onExpand: () => void;
}) {
  return (
    <Pressable onPress={onExpand} style={[miniMapStyles.wrap, { bottom }]}>
      <WebViewMap
        driverLocation={{ lat, lng }}
        showDriverMarker
        interactive={false}
        height={120}
        isDark
      />
      <View style={miniMapStyles.expandIcon}>
        <Ionicons name="expand-outline" size={11} color="#fff" />
      </View>
    </Pressable>
  );
}

// Full-screen map modal on tap
function MapExpandModal({
  lat,
  lng,
  visible,
  onClose,
}: {
  lat: number;
  lng: number;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <WebViewMap driverLocation={{ lat, lng }} showDriverMarker interactive height="100%" isDark />
        <Pressable
          onPress={onClose}
          style={miniMapStyles.closeBtn}
          hitSlop={12}
        >
          <Ionicons name="close" size={20} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const miniMapStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: Spacing.md,
    width: 120,
    height: 120,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.22)",
  },
  expandIcon: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10,
    padding: 3,
  },
  closeBtn: {
    position: "absolute",
    top: 60,
    right: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
});

// ---------------------------------------------------------------------------
// AgoraCardBackground — native Agora viewer, active only for the focused card
// ---------------------------------------------------------------------------

function AgoraCardBackground({
  postId,
  isFocused,
}: {
  postId: string;
  isFocused: boolean;
}) {
  const nativeOk = agoraNativeAvailable();
  const { liteMode } = useLiteMode();
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [ended, setEnded] = useState(false);

  const tokenQuery = useQuery<StreamTokenBundle>({
    queryKey: ["/api/agora/token", postId],
    queryFn: () =>
      apiRequest("/api/agora/token", {
        method: "POST",
        body: JSON.stringify({ ridePostId: postId }),
        headers: { "Content-Type": "application/json" },
      }),
    enabled: isFocused && !!postId && nativeOk,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const tokens = tokenQuery.data ?? null;
  const rtc = useMemo(() => loadAgoraRtc(), []);

  useEffect(() => {
    if (!isFocused || !rtc || !tokens || ended) return;
    let engine: any = null;
    try {
      const { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } = rtc;
      engine = createAgoraRtcEngine();
      engine.initialize({
        appId: tokens.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      engine.registerEventHandler({
        onUserJoined: (_conn: any, uid: number) => setRemoteUid(uid),
        onUserOffline: () => setRemoteUid(null),
        onConnectionStateChanged: (_conn: any, state: number) => {
          if (state === 5) setEnded(true); // CONNECTION_STATE_FAILED
        },
      });
      engine.enableVideo();
      if (liteMode) engine.setRemoteDefaultVideoStreamType?.(1); // low-quality simulcast
      engine.joinChannelWithUserAccount(tokens.rtcToken, tokens.channel, tokens.uid, {
        clientRoleType: ClientRoleType.ClientRoleAudience,
        audienceLatencyLevel: 1,
        autoSubscribeVideo: true,
        autoSubscribeAudio: false, // muted while browsing the feed
        publishCameraTrack: false,
        publishMicrophoneTrack: false,
      });
    } catch (err) {
      console.log("[Discovery] Agora join failed:", err);
    }
    return () => {
      try {
        engine?.leaveChannel();
        engine?.unregisterEventHandler?.({});
        engine?.release();
      } catch {}
      setRemoteUid(null);
    };
  }, [isFocused, rtc, tokens?.rtcToken, ended]);

  const AgoraView = rtc?.RtcTextureView ?? rtc?.RtcSurfaceView;

  if (!nativeOk || !AgoraView || remoteUid === null) {
    return (
      <LinearGradient
        colors={["#18002A", "#3D0050", "#0D0018"]}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return <AgoraView style={StyleSheet.absoluteFill} canvas={{ uid: remoteUid, renderMode: 1 }} />;
}

// ---------------------------------------------------------------------------
// AccoladesSheet — driver stats bottom sheet (Modal)
// ---------------------------------------------------------------------------

function AccoladesSheet({
  driver,
  visible,
  onClose,
}: {
  driver: DiscoveryDriver;
  visible: boolean;
  onClose: () => void;
}) {
  const rating = driver.rating ? parseFloat(driver.rating) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <View style={sheetStyles.handle} />

        {/* Header */}
        <View style={sheetStyles.headerRow}>
          <Avatar uri={driver.avatar} name={driver.name} size={52} />
          <View style={{ flex: 1 }}>
            <Text style={sheetStyles.name}>{driver.name}</Text>
            {driver.vehicle ? (
              <Text style={sheetStyles.vehicleSub}>
                {driver.vehicle.color ? `${driver.vehicle.color} ` : ""}
                {driver.vehicle.make} {driver.vehicle.model}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Stats row */}
        <View style={sheetStyles.statsRow}>
          <View style={sheetStyles.statCell}>
            <Text style={sheetStyles.statVal}>{rating ? rating.toFixed(1) : "—"}</Text>
            <View style={sheetStyles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name={rating && s <= Math.round(rating) ? "star" : "star-outline"}
                  size={11}
                  color={rating && s <= Math.round(rating) ? "#FFD700" : "rgba(255,255,255,0.25)"}
                />
              ))}
            </View>
            <Text style={sheetStyles.statLbl}>Rating</Text>
          </View>
          <View style={[sheetStyles.statCell, sheetStyles.cellBorder]}>
            <Text style={sheetStyles.statVal}>{driver.totalTrips ?? "—"}</Text>
            <Text style={sheetStyles.statLbl}>Trips</Text>
          </View>
          <View style={sheetStyles.statCell}>
            <Text style={sheetStyles.statVal}>{driver.etaMinutes} min</Text>
            <Text style={sheetStyles.statLbl}>ETA</Text>
          </View>
        </View>

        {/* Details */}
        {driver.vehicle?.licensePlate ? (
          <View style={sheetStyles.detailRow}>
            <Ionicons name="id-card-outline" size={15} color="rgba(255,255,255,0.45)" />
            <Text style={sheetStyles.detailText}>{driver.vehicle.licensePlate}</Text>
          </View>
        ) : null}
        <View style={sheetStyles.detailRow}>
          <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.45)" />
          <Text style={sheetStyles.detailText}>{driver.distanceKm} km away</Text>
        </View>
        <View style={sheetStyles.fareRow}>
          <Ionicons name="cash-outline" size={15} color={Colors.travonyGreen} />
          <Text style={sheetStyles.fareText}>
            Est. fare: {driver.currencySymbol}{driver.upfrontFare} {driver.currency}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1A1A2E",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: 44,
    gap: Spacing.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignSelf: "center",
    marginBottom: Spacing.sm,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md },
  name: { fontSize: 20, fontWeight: "700", color: "#fff" },
  vehicleSub: { fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    overflow: "hidden",
  },
  statCell: { flex: 1, alignItems: "center", padding: Spacing.md, gap: 4 },
  cellBorder: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  statVal: { fontSize: 22, fontWeight: "800", color: "#fff" },
  stars: { flexDirection: "row", gap: 2 },
  statLbl: { fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: "500" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  detailText: { fontSize: 14, color: "rgba(255,255,255,0.6)" },
  fareRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginTop: 2 },
  fareText: { fontSize: 15, color: Colors.travonyGreen, fontWeight: "600" },
});

// ---------------------------------------------------------------------------
// ReviewsOverlay — semi-transparent panel showing last 10 ride ratings
// ---------------------------------------------------------------------------

function ReviewsOverlay({
  driver,
  visible,
  onClose,
  isAuthenticated,
}: {
  driver: DiscoveryDriver;
  visible: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
}) {
  const ratingsQuery = useQuery<{ ratings: RatingRow[] }>({
    queryKey: ["/api/drivers", driver.driverId, "ratings"],
    queryFn: () => apiRequest(`/api/drivers/${driver.driverId}/ratings`),
    enabled: visible && isAuthenticated && !!driver.driverId,
  });
  const ratings = ratingsQuery.data?.ratings ?? [];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={reviewStyles.backdrop} onPress={onClose} />
      <View style={reviewStyles.panel}>
        <View style={reviewStyles.header}>
          <Text style={reviewStyles.title}>Ride Reviews</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={20} color="rgba(255,255,255,0.55)" />
          </Pressable>
        </View>

        {!isAuthenticated ? (
          <View style={reviewStyles.center}>
            <Ionicons name="lock-closed-outline" size={36} color="rgba(255,255,255,0.25)" />
            <Text style={reviewStyles.hint}>Sign in to see ride reviews</Text>
          </View>
        ) : ratingsQuery.isLoading ? (
          <View style={reviewStyles.center}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : ratings.length === 0 ? (
          <View style={reviewStyles.center}>
            <Text style={reviewStyles.hint}>No reviews yet</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {ratings.slice(0, 10).map((r) => (
              <View key={r.id} style={reviewStyles.item}>
                <View style={reviewStyles.itemTop}>
                  <View style={reviewStyles.stars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name={s <= r.rating ? "star" : "star-outline"}
                        size={11}
                        color={s <= r.rating ? "#FFD700" : "rgba(255,255,255,0.2)"}
                      />
                    ))}
                  </View>
                  {r.riderName ? (
                    <Text style={reviewStyles.rider}>{r.riderName}</Text>
                  ) : null}
                </View>
                {r.comment ? (
                  <Text style={reviewStyles.comment}>{r.comment}</Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const reviewStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  panel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_H * 0.55,
    backgroundColor: "rgba(10,10,25,0.97)",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  title: { fontSize: 16, fontWeight: "700", color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: Spacing.md },
  hint: { fontSize: 14, color: "rgba(255,255,255,0.45)", textAlign: "center" },
  item: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
    gap: 4,
  },
  itemTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stars: { flexDirection: "row", gap: 2 },
  rider: { fontSize: 11, color: "rgba(255,255,255,0.35)" },
  comment: { fontSize: 13, color: "rgba(255,255,255,0.72)", lineHeight: 18 },
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// GoLiveButton — animated pulsing broadcast button for the action panel
// ---------------------------------------------------------------------------

function GoLiveButton({
  onPress,
  isWaiting,
  countdown,
}: {
  onPress?: () => void;
  isWaiting: boolean;
  countdown?: number;
}) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.55);
  const btnScale = useSharedValue(1);

  useEffect(() => {
    if (!isWaiting) {
      // Outer ring pulses outward and fades — classic live-broadcast halo
      pulseScale.value = withRepeat(
        withSequence(withTiming(2.2, { duration: 900 }), withTiming(1, { duration: 0 })),
        -1,
        false,
      );
      pulseOpacity.value = withRepeat(
        withSequence(withTiming(0, { duration: 900 }), withTiming(0.55, { duration: 0 })),
        -1,
        false,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 250 });
      pulseOpacity.value = withTiming(0, { duration: 250 });
    }
  }, [isWaiting]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const btnStyle = useAnimatedStyle(() => ({
    transform: [{ scale: btnScale.value }],
  }));

  const handlePressIn = () => {
    btnScale.value = withTiming(0.88, { duration: 100 });
  };
  const handlePressOut = () => {
    btnScale.value = withSequence(withTiming(1.08, { duration: 100 }), withTiming(1, { duration: 100 }));
  };

  return (
    <Pressable
      onPress={isWaiting ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={panelStyles.btn}
      hitSlop={8}
    >
      <View style={panelStyles.goLiveWrap}>
        {/* Pulsing halo ring — only when not waiting */}
        {!isWaiting && (
          <Animated.View style={[panelStyles.goLivePulse, ringStyle]} />
        )}
        {/* Core button */}
        <Animated.View
          style={[
            panelStyles.goLiveCircle,
            isWaiting && panelStyles.goLiveCircleWaiting,
            btnStyle,
          ]}
        >
          {isWaiting ? (
            <ActivityIndicator size="small" color="rgba(255,255,255,0.85)" />
          ) : (
            <Ionicons name="radio" size={19} color="#fff" />
          )}
        </Animated.View>
      </View>
      {isWaiting && countdown !== undefined ? (
        <Text style={panelStyles.goLiveCountdownLbl}>{countdown}s</Text>
      ) : (
        <Text style={[panelStyles.btnLbl, isWaiting && { color: "rgba(255,255,255,0.45)" }]}>
          {isWaiting ? "Waiting…" : "Go Live"}
        </Text>
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// DiscoveryActionPanel — right-side vertical action stack
// ---------------------------------------------------------------------------

function DiscoveryActionPanel({
  driver,
  bottom,
  onBook,
  onAccolades,
  onReviews,
  onShare,
  onDriverProfile,
  onTalk,
  onGoLive,
  goLiveState,
  goLiveCountdown,
}: {
  driver: DiscoveryDriver;
  bottom: number;
  onBook: () => void;
  onAccolades: () => void;
  onReviews: () => void;
  onShare: () => void;
  onDriverProfile: () => void;
  onTalk?: () => void;
  onGoLive?: () => void;
  goLiveState?: "idle" | "waiting" | "accepted" | "declined" | "expired" | "cancelled";
  goLiveCountdown?: number;
}) {
  const rating = driver.rating ? parseFloat(driver.rating) : null;
  const isWaiting = goLiveState === "waiting";

  return (
    <View style={[panelStyles.container, { bottom }]}>
      {/* Driver avatar — tap opens profile */}
      <Pressable onPress={onDriverProfile} style={panelStyles.avatarWrap} hitSlop={8}>
        <Avatar uri={driver.avatar} name={driver.name} size={52} />
        <View style={panelStyles.onlineDot} />
      </Pressable>

      {/* Book */}
      <Pressable onPress={onBook} style={panelStyles.btn} hitSlop={8}>
        <View style={panelStyles.bookCircle}>
          <Ionicons name="add" size={22} color="#fff" />
        </View>
        <Text style={panelStyles.btnLbl}>Book</Text>
      </Pressable>

      {/* Stars */}
      <Pressable onPress={onAccolades} style={panelStyles.btn} hitSlop={8}>
        <View style={panelStyles.ratingWrap}>
          <Ionicons name="star" size={18} color="#FFD700" />
          <Text style={panelStyles.ratingNum}>
            {rating ? rating.toFixed(1) : "—"}
          </Text>
        </View>
        <Text style={panelStyles.btnLbl}>Stars</Text>
      </Pressable>

      {/* Reviews */}
      <Pressable onPress={onReviews} style={panelStyles.btn} hitSlop={8}>
        <Ionicons name="chatbubble-outline" size={28} color="#fff" style={panelStyles.iconShadow} />
        <Text style={panelStyles.btnLbl}>Reviews</Text>
      </Pressable>

      {/* Talk — opens the car's public persona profile + chat */}
      {onTalk ? (
        <Pressable onPress={onTalk} style={panelStyles.btn} hitSlop={8}>
          <Ionicons name="sparkles" size={26} color="#fff" style={panelStyles.iconShadow} />
          <Text style={panelStyles.btnLbl}>Talk</Text>
        </Pressable>
      ) : null}

      {/* Go Live — animated broadcast request button */}
      {onGoLive !== undefined ? (
        <GoLiveButton
          onPress={onGoLive}
          isWaiting={isWaiting}
          countdown={isWaiting ? goLiveCountdown : undefined}
        />
      ) : null}

      {/* Share */}
      <Pressable onPress={onShare} style={panelStyles.btn} hitSlop={8}>
        <Ionicons name="share-outline" size={28} color="#fff" style={panelStyles.iconShadow} />
        <Text style={panelStyles.btnLbl}>Share</Text>
      </Pressable>
    </View>
  );
}

const panelStyles = StyleSheet.create({
  container: {
    position: "absolute",
    right: Spacing.md,
    alignItems: "center",
    gap: Spacing.xl,
  },
  avatarWrap: { position: "relative" },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: Colors.travonyGreen,
    borderWidth: 2,
    borderColor: "#000",
  },
  btn: { alignItems: "center", gap: 4, minHeight: 48, justifyContent: "center" },
  bookCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.travonyGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.4)",
    borderRadius: 12,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  ratingNum: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  btnLbl: {
    fontSize: 11,
    fontWeight: "500",
    color: "rgba(255,255,255,0.8)",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  iconShadow: {
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  } as any,
  // Go Live button
  goLiveWrap: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  goLivePulse: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.liveRed,
  },
  goLiveCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.liveRed,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.liveRed,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  goLiveCircleWaiting: {
    backgroundColor: "rgba(210,30,30,0.45)",
    shadowOpacity: 0,
    elevation: 0,
  },
  goLiveCountdownLbl: {
    fontSize: 11,
    fontWeight: "700",
    color: "rgba(255,255,255,0.55)",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});

// ---------------------------------------------------------------------------
// EmptyCard — shown when there are no drivers for the active tab
// ---------------------------------------------------------------------------

function EmptyCard({
  tab,
  bottomInset,
}: {
  tab: FeedTab;
  bottomInset: number;
}) {
  return (
    <View style={{ width: SCREEN_W, height: SCREEN_H }}>
      <LinearGradient colors={["#0D1A0D", "#003D1C", "#001A0B"]} style={StyleSheet.absoluteFill} />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: Spacing["2xl"],
          paddingBottom: bottomInset + 60,
        }}
      >
        <Ionicons
          name={tab === "nearby" ? "location-outline" : "people-outline"}
          size={64}
          color="rgba(255,255,255,0.2)"
        />
        <Text
          style={{
            fontSize: 22,
            fontWeight: "700",
            color: "rgba(255,255,255,0.65)",
            textAlign: "center",
            marginTop: Spacing.xl,
          }}
        >
          {tab === "nearby" ? "No drivers nearby" : "No followed drivers online"}
        </Text>
        <Text
          style={{
            fontSize: 14,
            color: "rgba(255,255,255,0.38)",
            textAlign: "center",
            marginTop: Spacing.md,
            lineHeight: 22,
          }}
        >
          {tab === "nearby"
            ? "Online approved drivers in your area will appear here."
            : "Drivers you follow will appear here when they go online."}
        </Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// DriverDiscoveryCard — one full-screen swipeable card
// ---------------------------------------------------------------------------

const DriverDiscoveryCard = memo(function DriverDiscoveryCard({
  driver,
  isFocused,
  cardBottomInset,
  isAuthenticated,
  onAccolades,
  onReviews,
  onBook,
  onShare,
  onDriverProfile,
  onTalk,
  onGoLive,
  goLiveState,
  goLiveCountdown,
}: {
  driver: DiscoveryDriver;
  isFocused: boolean;
  cardBottomInset: number;
  isAuthenticated: boolean;
  onAccolades: (d: DiscoveryDriver) => void;
  onReviews: (d: DiscoveryDriver) => void;
  onBook: (d: DiscoveryDriver) => void;
  onShare: (d: DiscoveryDriver) => void;
  onDriverProfile: (d: DiscoveryDriver) => void;
  onTalk?: (d: DiscoveryDriver) => void;
  onGoLive?: (d: DiscoveryDriver) => void;
  goLiveState?: "idle" | "waiting" | "accepted" | "declined" | "expired" | "cancelled";
  goLiveCountdown?: number;
}) {
  const [mapExpanded, setMapExpanded] = useState(false);

  const isAgora = driver.isLive && driver.streamProvider === "agora" && !!driver.postId;
  const vehiclePhoto = driver.vehicle?.photo ?? null;

  // Layout:  bottom of screen ← tab bar ← ticker ← mini-map ← action panel
  const tickerBottom = cardBottomInset;                             // sits just above the tab bar
  const miniMapBottom = tickerBottom + 36 + Spacing.sm;            // above the ticker
  const actionPanelBottom = miniMapBottom + 120 + Spacing.lg;      // above the mini-map

  return (
    <View style={{ width: SCREEN_W, height: SCREEN_H }}>
      {/* ── Background ── */}
      {isAgora && driver.postId ? (
        <AgoraCardBackground postId={driver.postId} isFocused={isFocused} />
      ) : vehiclePhoto ? (
        <>
          <Image
            source={{ uri: vehiclePhoto }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          {/* Light scrim so text is always readable over bright/dark photos */}
          <LinearGradient
            colors={["rgba(0,0,0,0.25)", "rgba(0,0,0,0)", "rgba(0,0,0,0.35)"]}
            style={StyleSheet.absoluteFill}
          />
        </>
      ) : (
        <LinearGradient
          colors={["#0D0020", "#1E0038", "#0A0015"]}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* ── Top gradient scrim — keeps wordmark + tabs readable ── */}
      <LinearGradient
        colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0)"]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 130 }}
        pointerEvents="none"
      />

      {/* ── LIVE badge ── */}
      {driver.isLive ? (
        <Animated.View entering={FadeIn.delay(200)} style={cardStyles.liveBadge}>
          <View style={cardStyles.liveDot} />
          <Text style={cardStyles.liveText}>LIVE</Text>
          {driver.streamProvider === "agora" && (
            <Text style={cardStyles.liveSub}> · In-app</Text>
          )}
        </Animated.View>
      ) : null}

      {/* ── Bottom gradient + driver info ── */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.92)"]}
        style={[cardStyles.bottomGrad, { paddingBottom: tickerBottom + 36 + Spacing.md }]}
        pointerEvents="none"
      >
        <Animated.View entering={FadeInDown.delay(100)} style={{ paddingRight: 80 }}>
          <View style={cardStyles.nameRow}>
            <ThemedText style={cardStyles.driverName}>{driver.name}</ThemedText>
            {driver.rating ? (
              <View style={cardStyles.ratingPill}>
                <Ionicons name="star" size={10} color="#FFD700" />
                <Text style={cardStyles.ratingPillTxt}>
                  {parseFloat(driver.rating).toFixed(1)}
                </Text>
              </View>
            ) : null}
          </View>
          {driver.vehicle ? (
            <Text style={cardStyles.vehicleLine}>
              {driver.vehicle.make} {driver.vehicle.model}
              {driver.vehicle.color ? `  ·  ${driver.vehicle.color}` : ""}
            </Text>
          ) : null}
          <View style={cardStyles.etaRow}>
            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.55)" />
            <Text style={cardStyles.etaTxt}>
              {driver.etaMinutes} min away  ·  {driver.distanceKm} km
            </Text>
          </View>
        </Animated.View>
      </LinearGradient>

      {/* ── Data ticker ── */}
      <View style={[cardStyles.ticker, { bottom: tickerBottom }]} pointerEvents="none">
        <DataTicker driver={driver} />
      </View>

      {/* ── Mini-map (only mounted for focused card to save WebView overhead) ── */}
      {driver.approxLat !== null && driver.approxLng !== null && isFocused ? (
        <MiniMapOverlay
          lat={driver.approxLat}
          lng={driver.approxLng}
          bottom={miniMapBottom}
          onExpand={() => setMapExpanded(true)}
        />
      ) : driver.approxLat !== null && driver.approxLng !== null ? (
        // Placeholder outline keeps layout stable while card is off-screen
        <View style={[miniMapStyles.wrap, { bottom: miniMapBottom, backgroundColor: "rgba(0,0,0,0.3)" }]} />
      ) : null}

      {/* ── Right-side action panel ── */}
      <DiscoveryActionPanel
        driver={driver}
        bottom={actionPanelBottom}
        onBook={() => onBook(driver)}
        onAccolades={() => onAccolades(driver)}
        onReviews={() => onReviews(driver)}
        onShare={() => onShare(driver)}
        onDriverProfile={() => onDriverProfile(driver)}
        onTalk={onTalk && driver.vehicleId ? () => onTalk(driver) : undefined}
        onGoLive={onGoLive ? () => onGoLive(driver) : undefined}
        goLiveState={goLiveState}
        goLiveCountdown={goLiveCountdown}
      />

      {/* ── Map expand modal ── */}
      {driver.approxLat !== null && driver.approxLng !== null && mapExpanded ? (
        <MapExpandModal
          lat={driver.approxLat}
          lng={driver.approxLng}
          visible={mapExpanded}
          onClose={() => setMapExpanded(false)}
        />
      ) : null}
    </View>
  );
});

const cardStyles = StyleSheet.create({
  liveBadge: {
    position: "absolute",
    top: 92,
    left: Spacing.lg,
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
  liveSub: { fontSize: 11, color: "rgba(255,255,255,0.8)", fontWeight: "500" },
  bottomGrad: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 120,
    paddingHorizontal: Spacing.lg,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: 3,
  },
  driverName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.3,
  },
  ratingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingPillTxt: { fontSize: 11, fontWeight: "700", color: "#fff" },
  vehicleLine: {
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
    marginBottom: 4,
  },
  etaRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  etaTxt: { fontSize: 12, color: "rgba(255,255,255,0.55)" },
  ticker: { position: "absolute", left: 0, right: 0 },
});

// ---------------------------------------------------------------------------
// HookFeedScreen — main export
// ---------------------------------------------------------------------------

export default function HookFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuth();
  const { openLoginSheet } = useAuthGate();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const nativeOk = agoraNativeAvailable();

  // Forward booking params (from external links / deep navigation) to AssistantHome
  useEffect(() => {
    const params = route.params as any;
    if (params?.selectedLocation || params?.selectedPickup) {
      navigation.navigate("AssistantHome", params as any);
    }
  }, [route.params, navigation]);

  // Keep tab bar visible on this screen (it's the Home entry point)
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "flex" } });
    }, [navigation]),
  );

  // ── Location ──────────────────────────────────────────────────────────────
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setCoords({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      } catch {
        setCoords({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
      }
    })();
  }, []);

  // ── Tab ───────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<FeedTab>("nearby");
  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleTabChange = useCallback(
    (tab: FeedTab) => {
      if (tab === "following" && !isAuthenticated) {
        openLoginSheet();
        return;
      }
      setActiveTab(tab);
      setCurrentIndex(0);
      // Immediate scroll — no animation to avoid flash on data-swapped list
      flatListRef.current?.scrollToIndex({ index: 0, animated: false });
    },
    [isAuthenticated, openLoginSheet],
  );

  // ── Queries ───────────────────────────────────────────────────────────────
  const nearbyQuery = useQuery<{ drivers: DiscoveryDriver[] }>({
    queryKey: ["/api/discovery/nearby", coords?.lat, coords?.lng],
    queryFn: () =>
      apiRequest(`/api/discovery/nearby?lat=${coords!.lat}&lng=${coords!.lng}&limit=20`),
    enabled: !!coords,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const followingQuery = useQuery<{ drivers: DiscoveryDriver[] }>({
    queryKey: ["/api/discovery/following", coords?.lat, coords?.lng],
    queryFn: () => {
      const qs = coords ? `?lat=${coords.lat}&lng=${coords.lng}` : "";
      return apiRequest(`/api/discovery/following${qs}`);
    },
    enabled: isAuthenticated && activeTab === "following",
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const drivers: DiscoveryDriver[] =
    activeTab === "nearby"
      ? (nearbyQuery.data?.drivers ?? [])
      : (followingQuery.data?.drivers ?? []);

  // ── Pre-fetch Agora token for next live card (n+1 optimisation) ───────────
  useEffect(() => {
    const next = drivers[currentIndex + 1];
    if (next?.isLive && next?.postId && next?.streamProvider === "agora" && nativeOk) {
      qc.prefetchQuery({
        queryKey: ["/api/agora/token", next.postId],
        queryFn: () =>
          apiRequest("/api/agora/token", {
            method: "POST",
            body: JSON.stringify({ ridePostId: next.postId }),
            headers: { "Content-Type": "application/json" },
          }),
        staleTime: 30 * 60 * 1000,
      });
    }
  }, [currentIndex, drivers, qc, nativeOk]);

  // ── Go Live Request state ─────────────────────────────────────────────────
  const [goLiveReqId, setGoLiveReqId] = useState<string | null>(null);
  const [goLiveDriverUserId, setGoLiveDriverUserId] = useState<string | null>(null);
  const [goLiveStatus, setGoLiveStatus] = useState<
    "idle" | "waiting" | "accepted" | "declined" | "expired" | "cancelled"
  >("idle");
  const [goLiveCountdown, setGoLiveCountdown] = useState(30);
  const [goLiveToast, setGoLiveToast] = useState<string | null>(null);
  const goLiveCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetGoLiveState = useCallback(() => {
    setGoLiveStatus("idle");
    setGoLiveReqId(null);
    setGoLiveDriverUserId(null);
    setGoLiveCountdown(30);
    if (goLiveCountdownRef.current) clearInterval(goLiveCountdownRef.current);
  }, []);

  const sendGoLiveMutation = useMutation({
    mutationFn: async ({ driverUserId }: { driverUserId: string }) =>
      apiRequest("/api/go-live-requests", {
        method: "POST",
        body: JSON.stringify({ driverUserId }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (data: any) => {
      setGoLiveReqId(data.request.id);
      setGoLiveStatus("waiting");
      setGoLiveCountdown(30);
    },
    onError: () => resetGoLiveState(),
  });

  const cancelGoLiveMutation = useMutation({
    mutationFn: async (reqId: string) =>
      apiRequest(`/api/go-live-requests/${reqId}/cancel`, { method: "PATCH" }),
    onSettled: () => resetGoLiveState(),
  });

  // Poll for request status while waiting
  const { data: goLiveStatusData } = useQuery<{ request: { status: string; postId: string | null } }>({
    queryKey: ["/api/go-live-requests", goLiveReqId],
    queryFn: () => apiRequest(`/api/go-live-requests/${goLiveReqId}`),
    enabled: !!goLiveReqId && goLiveStatus === "waiting",
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!goLiveStatusData?.request) return;
    const { status, postId } = goLiveStatusData.request;
    if (status === "accepted" && postId) {
      setGoLiveStatus("accepted");
      resetGoLiveState();
      // Open the live stream in the Social tab's AgoraStreamViewer
      const parent = navigation.getParent<any>();
      parent?.navigate("SocialTab", { screen: "AgoraStreamViewer", params: { postId } });
    } else if (status === "declined") {
      setGoLiveToast("Driver declined the request");
      resetGoLiveState();
      setTimeout(() => setGoLiveToast(null), 3000);
    } else if (status === "expired" || status === "cancelled") {
      resetGoLiveState();
    }
  }, [goLiveStatusData]);

  // 30-second client-side countdown while waiting
  useEffect(() => {
    if (goLiveStatus !== "waiting") {
      if (goLiveCountdownRef.current) clearInterval(goLiveCountdownRef.current);
      return;
    }
    setGoLiveCountdown(30);
    if (goLiveCountdownRef.current) clearInterval(goLiveCountdownRef.current);
    const capturedReqId = goLiveReqId;
    goLiveCountdownRef.current = setInterval(() => {
      setGoLiveCountdown((s) => {
        if (s <= 1) {
          clearInterval(goLiveCountdownRef.current!);
          if (capturedReqId) cancelGoLiveMutation.mutate(capturedReqId);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => { if (goLiveCountdownRef.current) clearInterval(goLiveCountdownRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goLiveStatus]);

  const handleGoLive = useCallback(
    (driver: DiscoveryDriver) => {
      if (!isAuthenticated) { openLoginSheet(); return; }
      if (goLiveStatus === "waiting") return;
      setGoLiveDriverUserId(driver.userId);
      sendGoLiveMutation.mutate({ driverUserId: driver.userId });
    },
    [isAuthenticated, openLoginSheet, goLiveStatus, sendGoLiveMutation],
  );

  // ── Overlay state ─────────────────────────────────────────────────────────
  const [accoladesDriver, setAccoladesDriver] = useState<DiscoveryDriver | null>(null);
  const [reviewsDriver, setReviewsDriver] = useState<DiscoveryDriver | null>(null);

  const handleBook = useCallback(
    (driver: DiscoveryDriver) => {
      if (!isAuthenticated) { openLoginSheet(); return; }
      // Navigate to the AI assistant; booking flow handles destination selection
      navigation.navigate("AssistantHome");
    },
    [isAuthenticated, openLoginSheet, navigation],
  );

  const handleShare = useCallback(async (driver: DiscoveryDriver) => {
    const live = driver.isLive ? " They're streaming live!" : "";
    await Share.share({
      message: `Check out ${driver.name} on Travony — ${driver.etaMinutes} min away.${live}`,
      title: `Driver on Travony: ${driver.name}`,
    });
  }, []);

  const handleDriverProfile = useCallback(
    (_driver: DiscoveryDriver) => {
      const parent = navigation.getParent<any>();
      parent?.navigate("SocialTab");
    },
    [navigation],
  );

  // Talk — the car's public persona profile (works for guests; chat itself
  // gates on auth when the rider sends a message).
  const handleTalk = useCallback(
    (driver: DiscoveryDriver) => {
      if (!driver.vehicleId) return;
      navigation.navigate("CarProfile", { vehicleId: driver.vehicleId });
    },
    [navigation],
  );

  // ── Layout helpers ────────────────────────────────────────────────────────
  const cardBottomInset = insets.bottom + TAB_BAR_H;

  const isLoading =
    (activeTab === "nearby" && nearbyQuery.isLoading) ||
    (activeTab === "following" && followingQuery.isLoading);

  // ── FlatList render helpers ───────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item, index }: { item: DiscoveryDriver; index: number }) => {
      const isThisDriver = goLiveDriverUserId === item.userId;
      return (
        <DriverDiscoveryCard
          driver={item}
          isFocused={index === currentIndex}
          cardBottomInset={cardBottomInset}
          isAuthenticated={isAuthenticated}
          onAccolades={setAccoladesDriver}
          onReviews={setReviewsDriver}
          onBook={handleBook}
          onShare={handleShare}
          onDriverProfile={handleDriverProfile}
          onTalk={handleTalk}
          onGoLive={handleGoLive}
          goLiveState={isThisDriver ? goLiveStatus : "idle"}
          goLiveCountdown={isThisDriver ? goLiveCountdown : undefined}
        />
      );
    },
    [currentIndex, cardBottomInset, isAuthenticated, handleBook, handleShare, handleDriverProfile,
     handleTalk, handleGoLive, goLiveDriverUserId, goLiveStatus, goLiveCountdown],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: SCREEN_H, offset: SCREEN_H * index, index }),
    [],
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Feed or empty state */}
      {drivers.length === 0 && !isLoading ? (
        <EmptyCard tab={activeTab} bottomInset={cardBottomInset} />
      ) : (
        <FlatList
          ref={flatListRef}
          data={drivers}
          keyExtractor={(item) => `${activeTab}-${item.userId}`}
          renderItem={renderItem}
          pagingEnabled
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          getItemLayout={getItemLayout}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_H);
            setCurrentIndex(idx);
          }}
          windowSize={5}
          maxToRenderPerBatch={2}
          updateCellsBatchingPeriod={50}
          initialNumToRender={2}
          removeClippedSubviews={Platform.OS === "android"}
        />
      )}

      {/* Top chrome: wordmark + tabs (absolute overlay) */}
      <NearbyFollowingTabs
        activeTab={activeTab}
        onTabChange={handleTabChange}
        insetTop={insets.top}
        isAuthenticated={isAuthenticated}
      />

      {/* Persistent booking entry — booking is always one obvious tap away */}
      <Pressable
        onPress={() => {
          if (!isAuthenticated) { openLoginSheet(); return; }
          navigation.navigate("AssistantHome");
        }}
        style={{
          position: "absolute",
          bottom: cardBottomInset + 12,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          backgroundColor: "rgba(20,20,20,0.85)",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.18)",
          borderRadius: 24,
          paddingHorizontal: 20,
          paddingVertical: 10,
        }}
        hitSlop={8}
      >
        <Ionicons name="navigate" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontSize: 14, fontWeight: "700" }}>Book a ride</Text>
      </Pressable>

      {/* Loading spinner while initial fetch is in-flight */}
      {isLoading ? (
        <View
          style={{
            position: "absolute",
            bottom: cardBottomInset + 60,
            alignSelf: "center",
          }}
        >
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}

      {/* Accolades bottom sheet */}
      {accoladesDriver ? (
        <AccoladesSheet
          driver={accoladesDriver}
          visible
          onClose={() => setAccoladesDriver(null)}
        />
      ) : null}

      {/* Reviews overlay */}
      {reviewsDriver ? (
        <ReviewsOverlay
          driver={reviewsDriver}
          visible
          onClose={() => setReviewsDriver(null)}
          isAuthenticated={isAuthenticated}
        />
      ) : null}

      {/* Go Live toast — declined / error */}
      {goLiveToast ? (
        <Animated.View
          entering={FadeInDown.duration(260)}
          style={{
            position: "absolute",
            bottom: cardBottomInset + 20,
            alignSelf: "center",
            backgroundColor: "rgba(20,20,20,0.92)",
            borderRadius: 24,
            paddingHorizontal: 20,
            paddingVertical: 10,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.1)",
          }}
        >
          <Ionicons name="close-circle" size={16} color="rgba(255,80,80,0.9)" />
          <Text style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{goLiveToast}</Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
