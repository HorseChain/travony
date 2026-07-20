import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { useKeepAwake } from "expo-keep-awake";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { loadAgoraRtc, agoraNativeAvailable } from "@/lib/agoraNative";
import { useStreamChannel, StreamTokenBundle, StreamEvent } from "@/hooks/useStreamChannel";
import {
  ViewerCountChip,
  LiveBadge,
  GiftAnimationLayer,
  useGiftAnimations,
} from "@/components/stream/StreamOverlays";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";

interface CatalogProduct {
  key: string;
  title: string;
  priceLabel: string;
  imageUrl: string | null;
}

type Phase = "preview" | "starting" | "live";

export default function GoLiveScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const rideId: string = route.params?.rideId;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const nativeOk = agoraNativeAvailable();
  const rtc = useRef(loadAgoraRtc()).current;

  const [engine, setEngine] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>("preview");
  const [frontCamera, setFrontCamera] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [shopOpen, setShopOpen] = useState(false);
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);

  useKeepAwake();

  // Hide tab bar while this full-screen live view is active.
  useFocusEffect(
    useCallback(() => {
      const parent = (navigation as any).getParent?.();
      parent?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  // ---------------------------------------------------------------------------
  // Fetch the Agora App ID from the server before anything else.
  // The App ID is not a secret — security comes from RTC tokens.
  // We need it to initialize the engine BEFORE the user taps "Go Live".
  // ---------------------------------------------------------------------------
  const appIdQuery = useQuery<{ appId: string }>({
    queryKey: ["/api/agora/app-id"],
    staleTime: Infinity,
    retry: 3,
  });
  const agoraAppId = appIdQuery.data?.appId ?? "";

  // ---------------------------------------------------------------------------
  // Engine lifecycle — created once we have the real App ID + permissions.
  // Camera preview starts immediately so the user sees themselves before
  // tapping "Go Live". The RtcTextureView native surface is already mounted
  // by the time joinChannel is called — no black-screen race.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rtc || !agoraAppId) return;
    if (!cameraPermission?.granted || !micPermission?.granted) return;
    if (!nativeOk) return;

    let localEngine: any = null;
    try {
      const { createAgoraRtcEngine, ChannelProfileType } = rtc;
      localEngine = createAgoraRtcEngine();
      localEngine.initialize({
        appId: agoraAppId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      localEngine.registerEventHandler({
        onJoinChannelSuccess: () => setPublishing(true),
        onError: (err: number, msg: string) =>
          console.log("[GoLive] RTC error", err, msg),
      });
      localEngine.enableVideo();
      // LiveBroadcasting default role is Audience — camera is disabled for
      // Audience. Must switch to Broadcaster BEFORE startPreview() or the
      // camera surface stays black. This is a pre-join call; the role is
      // confirmed again via clientRoleType when joinChannel is called.
      const { ClientRoleType } = rtc;
      localEngine.setClientRole?.(ClientRoleType?.ClientRoleBroadcaster ?? 1);
      localEngine.enableDualStreamMode?.(true);
      localEngine.setVideoEncoderConfiguration?.({
        dimensions: { width: 1280, height: 720 },
        frameRate: 24,
        bitrate: 0,
      });
      // Do NOT call startPreview() here — RtcTextureView is not mounted yet.
      // A second effect calls it after engine state is set and the view renders.
      setEngine(localEngine);
    } catch (err) {
      console.log("[GoLive] RTC init failed:", (err as any)?.message ?? err);
    }

    return () => {
      try {
        localEngine?.stopPreview?.();
        localEngine?.leaveChannel?.();
        localEngine?.release?.();
      } catch {}
      setEngine(null);
      setPublishing(false);
    };
  }, [rtc, agoraAppId, cameraPermission?.granted, micPermission?.granted, nativeOk]);

  // ---------------------------------------------------------------------------
  // Start preview AFTER engine is set — RtcTextureView is now mounted and
  // the native surface exists. A 150 ms delay lets the view fully attach
  // before Agora starts pushing frames into it (Agora SDK v4.x requirement).
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!engine) return;
    const t = setTimeout(() => {
      try { engine.startPreview(); } catch {}
    }, 150);
    return () => clearTimeout(t);
  }, [engine]);

  // ---------------------------------------------------------------------------
  // Go Live flow
  // ---------------------------------------------------------------------------
  const startMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/agora/streams/${rideId}/start`, { method: "POST" }),
    onSuccess: (data) => {
      setPost(data.post);
      setPhase("starting");
      queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
    },
    onError: () => setPhase("preview"),
  });

  const stopMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/agora/streams/${post.id}/stop`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
      navigation.goBack();
    },
  });

  // Token — only fetched after the post is created server-side.
  const tokenQuery = useQuery<StreamTokenBundle>({
    queryKey: ["/api/agora/token", post?.id],
    queryFn: () =>
      apiRequest("/api/agora/token", {
        method: "POST",
        body: JSON.stringify({ ridePostId: post.id }),
        headers: { "Content-Type": "application/json" },
      }),
    enabled: !!post?.id,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const tokens = tokenQuery.data ?? null;

  // Join the channel once the publisher token arrives.
  // Engine is already initialized with real appId + camera already running.
  useEffect(() => {
    if (!engine || !tokens || tokens.role !== "publisher") return;
    if (phase !== "starting") return;
    try {
      const { ClientRoleType } = rtc ?? {};
      engine.joinChannelWithUserAccount(
        tokens.rtcToken,
        tokens.channel,
        tokens.uid,
        {
          clientRoleType: ClientRoleType?.ClientRoleBroadcaster ?? 1,
          publishCameraTrack: true,
          publishMicrophoneTrack: true,
        }
      );
      setPhase("live");
    } catch (err) {
      console.log("[GoLive] joinChannel failed:", (err as any)?.message ?? err);
      setPhase("preview");
    }
  }, [engine, tokens, phase, rtc]);

  const catalogQuery = useQuery<{ products: CatalogProduct[] }>({
    queryKey: ["/api/agora/products/catalog"],
    enabled: !!post?.id,
  });

  const { subscribe } = useStreamChannel(post?.id ?? null, tokens);
  const { current: currentGift, onGiftEvent } = useGiftAnimations();

  useEffect(() => {
    return subscribe((event: StreamEvent) => {
      if (event.type === "gift.sent") onGiftEvent(event);
      if (event.type === "viewer.count") setViewerCount(Number(event.data?.count) || 0);
    });
  }, [subscribe, onGiftEvent]);

  const featureMutation = useMutation({
    mutationFn: async (productKey: string) =>
      apiRequest(`/api/agora/streams/${post.id}/product`, {
        method: "POST",
        body: JSON.stringify({ productKey }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: (_d, productKey) => {
      setFeaturedKey(productKey);
      setShopOpen(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/agora/streams/${post.id}/product/clear`, { method: "POST" }),
    onSuccess: () => setFeaturedKey(null),
  });

  // ---------------------------------------------------------------------------
  // Permission gate
  // ---------------------------------------------------------------------------
  if (!cameraPermission || !micPermission) return <View style={styles.root} />;

  const permDeniedForever =
    (cameraPermission.status === "denied" && !cameraPermission.canAskAgain) ||
    (micPermission.status === "denied" && !micPermission.canAskAgain);

  if (!cameraPermission.granted || !micPermission.granted) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="videocam-outline" size={44} color="rgba(255,255,255,0.6)" />
        <ThemedText style={styles.permTitle}>Camera and microphone needed</ThemedText>
        <ThemedText style={styles.permBody}>
          Going live shares your ride's camera and sound with Travony viewers.
        </ThemedText>
        {permDeniedForever ? (
          Platform.OS !== "web" ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={async () => { try { await Linking.openSettings(); } catch {} }}
            >
              <ThemedText style={styles.primaryButtonText}>Open Settings</ThemedText>
            </Pressable>
          ) : null
        ) : (
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={async () => {
              if (!cameraPermission.granted) await requestCameraPermission();
              if (!micPermission.granted) await requestMicPermission();
            }}
          >
            <ThemedText style={styles.primaryButtonText}>Allow access</ThemedText>
          </Pressable>
        )}
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: Spacing.md }}>
          <ThemedText style={styles.permBody}>Not now</ThemedText>
        </Pressable>
      </View>
    );
  }

  if (!nativeOk) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="construct-outline" size={44} color="rgba(255,255,255,0.6)" />
        <ThemedText style={styles.permTitle}>Needs the new app build</ThemedText>
        <ThemedText style={styles.permBody}>
          Live streaming ships with the next T Ride / T Driver update.
        </ThemedText>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.primary }]}
          onPress={() => navigation.goBack()}
        >
          <ThemedText style={styles.primaryButtonText}>Back</ThemedText>
        </Pressable>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Camera view — TextureView avoids SurfaceView z-index black on Android.
  // ---------------------------------------------------------------------------
  const AgoraLocalView = rtc?.RtcTextureView ?? rtc?.RtcSurfaceView;
  const products = catalogQuery.data?.products ?? [];
  const BOTTOM_OFFSET = insets.bottom + Spacing["2xl"];
  const SHOP_BOTTOM = BOTTOM_OFFSET + 48 + Spacing.lg;

  return (
    <View style={styles.root}>
      {/* Camera — already capturing because engine started in useEffect */}
      {AgoraLocalView && engine ? (
        <AgoraLocalView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: 0, renderMode: 1, mirrorMode: frontCamera ? 0 : 2 }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#101014" }]}>
          <ActivityIndicator color="#fff" />
          <ThemedText style={styles.permBody}>
            {!agoraAppId ? "Connecting to Travony…" : "Starting your camera…"}
          </ThemedText>
        </View>
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + Spacing.md, zIndex: 10, elevation: 10 }]}>
        <View style={styles.topLeft}>
          {phase === "live" ? <LiveBadge /> : null}
          {phase === "live" ? <ViewerCountChip count={viewerCount} /> : null}
        </View>
        <View style={styles.topRight}>
          <Pressable
            style={styles.roundButton}
            onPress={() => {
              setFrontCamera((f) => !f);
              try { engine?.switchCamera?.(); } catch {}
            }}
          >
            <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable style={styles.roundButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Gift overlay */}
      <View
        style={[styles.giftLayer, { top: insets.top + 90, zIndex: 10, elevation: 10 }]}
        pointerEvents="none"
      >
        <GiftAnimationLayer gift={currentGift} />
      </View>

      {/* Pre-live panel */}
      {phase === "preview" ? (
        <View style={[styles.preLiveOverlay, { bottom: BOTTOM_OFFSET, zIndex: 10, elevation: 10 }]}>
          <View style={styles.liveIconCircle}>
            <Ionicons name="radio-outline" size={28} color={Colors.liveRed} />
          </View>
          <ThemedText style={styles.preLiveTitle}>Ready to go live?</ThemedText>
          <ThemedText style={styles.preLiveBody}>
            Your camera is on. Tap below to start broadcasting to Travony viewers.
          </ThemedText>
          <Pressable
            style={styles.goLiveButton}
            onPress={() => {
              setPhase("starting");
              startMutation.mutate();
            }}
            disabled={startMutation.isPending || !engine}
          >
            {startMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Go Live</ThemedText>
            )}
          </Pressable>
          {startMutation.isError ? (
            <ThemedText style={[styles.preLiveBody, { color: Colors.liveRed }]}>
              {(startMutation.error as any)?.message || "Could not start the stream"}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {/* Starting spinner */}
      {phase === "starting" ? (
        <View
          style={[styles.center, StyleSheet.absoluteFill, { zIndex: 10, elevation: 10 }]}
          pointerEvents="none"
        >
          <View style={styles.startingBadge}>
            <ActivityIndicator color="#fff" size="small" />
            <ThemedText style={[styles.preLiveBody, { color: "#fff", marginTop: 0 }]}>
              Going live…
            </ThemedText>
          </View>
        </View>
      ) : null}

      {/* Live controls */}
      {phase === "live" ? (
        <>
          {shopOpen ? (
            <View
              style={[
                styles.shopSheet,
                { bottom: SHOP_BOTTOM, backgroundColor: theme.backgroundElevated, zIndex: 11, elevation: 11 },
              ]}
            >
              <ThemedText style={styles.shopTitle}>Feature a product</ThemedText>
              <ScrollView style={{ maxHeight: 220 }}>
                {products.map((p) => (
                  <Pressable
                    key={p.key}
                    style={({ pressed }) => [styles.shopRow, { opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => featureMutation.mutate(p.key)}
                    disabled={featureMutation.isPending}
                  >
                    <View style={[styles.shopThumb, { backgroundColor: theme.backgroundSecondary }]}>
                      <Ionicons name="bag-handle-outline" size={18} color={theme.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <ThemedText style={Typography.bodyBold}>{p.title}</ThemedText>
                      <ThemedText style={[Typography.small, { color: theme.textSecondary }]}>
                        {p.priceLabel}
                      </ThemedText>
                    </View>
                    {featuredKey === p.key ? (
                      <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
                    ) : null}
                  </Pressable>
                ))}
              </ScrollView>
              {featuredKey ? (
                <Pressable
                  style={[styles.clearRow, { borderTopColor: theme.border }]}
                  onPress={() => clearMutation.mutate()}
                >
                  <ThemedText style={[Typography.smallBold, { color: Colors.liveRed }]}>
                    Remove featured product
                  </ThemedText>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.bottomBar, { bottom: BOTTOM_OFFSET, zIndex: 10, elevation: 10 }]}>
            <Pressable
              style={[styles.roundButton, shopOpen ? { backgroundColor: "rgba(255,255,255,0.3)" } : null]}
              onPress={() => setShopOpen((s) => !s)}
            >
              <Ionicons name="bag-handle-outline" size={20} color="#fff" />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.stopButton, { opacity: pressed || stopMutation.isPending ? 0.85 : 1 }]}
              onPress={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
            >
              {stopMutation.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <ThemedText style={styles.primaryButtonText}>End stream</ThemedText>
              )}
            </Pressable>
            <View style={styles.roundButton} pointerEvents="none">
              <Ionicons
                name={publishing ? "wifi-outline" : "hourglass-outline"}
                size={20}
                color="#fff"
              />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", gap: Spacing.md, padding: Spacing.xl },
  permTitle: { ...Typography.h3, color: "#fff", textAlign: "center" },
  permBody: { ...Typography.small, color: "rgba(255,255,255,0.7)", textAlign: "center" },
  primaryButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    height: 46, borderRadius: BorderRadius.full, paddingHorizontal: Spacing.xl, marginTop: Spacing.md,
  },
  primaryButtonText: { ...Typography.bodyBold, color: "#fff" },
  topBar: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  topRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  roundButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  giftLayer: { position: "absolute", left: Spacing.lg, right: Spacing.lg, alignItems: "flex-start" },
  preLiveOverlay: {
    position: "absolute", left: Spacing.xl, right: Spacing.xl,
    alignItems: "center", backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: BorderRadius.lg, padding: Spacing.xl, gap: Spacing.sm,
  },
  liveIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(233,25,22,0.18)", alignItems: "center", justifyContent: "center",
  },
  preLiveTitle: { ...Typography.h3, color: "#fff", textAlign: "center" },
  preLiveBody: { ...Typography.small, color: "rgba(255,255,255,0.75)", textAlign: "center" },
  goLiveButton: {
    height: 48, borderRadius: BorderRadius.full, backgroundColor: Colors.liveRed,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: Spacing["2xl"], marginTop: Spacing.sm, minWidth: 160,
  },
  startingBadge: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.65)", borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm,
  },
  bottomBar: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: Spacing.md,
  },
  stopButton: {
    flex: 1, height: 48, borderRadius: BorderRadius.full,
    backgroundColor: Colors.liveRed, alignItems: "center", justifyContent: "center",
  },
  shopSheet: { position: "absolute", left: Spacing.lg, right: Spacing.lg, borderRadius: BorderRadius.md, padding: Spacing.md },
  shopTitle: { ...Typography.h4, marginBottom: Spacing.sm },
  shopRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  shopThumb: { width: 40, height: 40, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  clearRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm, marginTop: Spacing.sm, alignItems: "center" },
});
