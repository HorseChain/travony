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
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
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
  const [liveError, setLiveError] = useState<string | null>(null);

  useKeepAwake();

  useFocusEffect(
    useCallback(() => {
      const parent = (navigation as any).getParent?.();
      parent?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  // App ID — needed to initialize Agora when going live.
  const appIdQuery = useQuery<{ appId: string }>({
    queryKey: ["/api/agora/app-id"],
    staleTime: Infinity,
    retry: 3,
  });
  const agoraAppId = appIdQuery.data?.appId ?? "";

  // ---------------------------------------------------------------------------
  // Agora engine — created ONLY after the user taps Go Live and the server
  // has created the stream post. By that point CameraView is unmounted and
  // the camera hardware is released, so Agora can open it cleanly.
  // ---------------------------------------------------------------------------
  const engineRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      try {
        engineRef.current?.leaveChannel?.();
        engineRef.current?.release?.();
      } catch {}
      engineRef.current = null;
    };
  }, []);

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

  // If the token query errors out, bounce back to preview so we're not stuck.
  useEffect(() => {
    if (tokenQuery.isError && phase === "starting") {
      setLiveError("Couldn't get a stream token — check your connection and try again.");
      setPhase("preview");
    }
  }, [tokenQuery.isError, phase]);

  // Safety timeout: if still "starting" after 25s, something silently failed.
  useEffect(() => {
    if (phase !== "starting") return;
    const t = setTimeout(() => {
      setLiveError("Stream took too long to start. Please try again.");
      setPhase("preview");
    }, 25000);
    return () => clearTimeout(t);
  }, [phase]);

  // Initialize Agora and join the channel once the token arrives.
  // CameraView stays mounted throughout — expo-camera is the broadcaster's
  // view at all times. Agora streams audio and attempts camera (device-dependent
  // camera sharing); if camera sharing isn't supported, audio still works.
  useEffect(() => {
    if (!rtc || !tokens || !agoraAppId) return;
    if (phase !== "starting") return;

    if (tokens.role !== "publisher") {
      setLiveError("You are not a participant on this ride.");
      setPhase("preview");
      return;
    }

    let localEngine: any = null;
    try {
      const { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } = rtc;
      localEngine = createAgoraRtcEngine();
      localEngine.initialize({
        appId: agoraAppId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      const bail = (msg: string) => {
        setLiveError(msg);
        setPhase("preview");
        try { localEngine?.leaveChannel?.(); } catch {}
        try { localEngine?.release?.(); } catch {}
      };
      localEngine.registerEventHandler({
        // onJoinChannelSuccess confirms the server-side connection —
        // we go LIVE immediately after calling join (same as original code),
        // and use this callback only to light up the wifi icon.
        onJoinChannelSuccess: () => setPublishing(true),
        onError: (err: number, msg: string) =>
          console.log("[GoLive] RTC error", err, msg),
        onConnectionStateChanged: (_conn: any, state: number, reason: number) =>
          console.log("[GoLive] connection state", state, "reason", reason),
      });
      localEngine.setClientRole?.(ClientRoleType?.ClientRoleBroadcaster ?? 1);
      localEngine.enableVideo();
      // Do NOT call startPreview() — expo-camera already owns the camera.
      // Agora will attempt camera sharing (works on Android 9+); if the
      // device doesn't support it, audio-only streaming continues safely.
      localEngine.enableDualStreamMode?.(true);
      localEngine.setVideoEncoderConfiguration?.({
        dimensions: { width: 1280, height: 720 },
        frameRate: 24,
        bitrate: 0,
      });
      localEngine.joinChannelWithUserAccount(
        tokens.rtcToken,
        tokens.channel,
        tokens.uid,
        {
          clientRoleType: ClientRoleType?.ClientRoleBroadcaster ?? 1,
          publishCameraTrack: true,
          publishMicrophoneTrack: true,
        }
      );
      engineRef.current = localEngine;
      setEngine(localEngine);
      // Go live immediately — same pattern as working builds 77-80.
      // onJoinChannelSuccess above only lights the wifi icon.
      setPhase("live");
    } catch (err) {
      console.log("[GoLive] RTC init/join failed:", (err as any)?.message ?? err);
      setLiveError("Failed to start stream. Please try again.");
      setPhase("preview");
      try { localEngine?.release?.(); } catch {}
    }
  }, [rtc, tokens, phase, agoraAppId]);

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

  const products = catalogQuery.data?.products ?? [];
  const BOTTOM_OFFSET = insets.bottom + Spacing["2xl"];
  const SHOP_BOTTOM = BOTTOM_OFFSET + 48 + Spacing.lg;

  return (
    <View style={styles.root}>

      {/* ------------------------------------------------------------------ */}
      {/* Camera background — stays mounted for every phase.                 */}
      {/* Agora's RtcSurfaceView is definitively broken on this device;      */}
      {/* expo-camera is the broadcaster's preview at all times.             */}
      {/* Agora joins for audio + attempts camera sharing (Android 9+).      */}
      {/* ------------------------------------------------------------------ */}
      <CameraView
        style={StyleSheet.absoluteFill}
        facing={frontCamera ? "front" : "back"}
      />

      {/* Spinner overlay — only shown while joining (starting phase) */}
      {phase === "starting" ? (
        <View style={[StyleSheet.absoluteFill, styles.startingOverlay]}>
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : null}

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + Spacing.md }]}>
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
        style={[styles.giftLayer, { top: insets.top + 90 }]}
        pointerEvents="none"
      >
        <GiftAnimationLayer gift={currentGift} />
      </View>

      {/* Pre-live panel */}
      {phase === "preview" ? (
        <View style={[styles.preLiveOverlay, { bottom: BOTTOM_OFFSET }]}>
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
              setLiveError(null);
              setPhase("starting");
              startMutation.mutate();
            }}
            disabled={startMutation.isPending || !agoraAppId}
          >
            {startMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Go Live</ThemedText>
            )}
          </Pressable>
          {liveError ? (
            <ThemedText style={[styles.preLiveBody, { color: Colors.liveRed }]}>
              {liveError}
            </ThemedText>
          ) : startMutation.isError ? (
            <ThemedText style={[styles.preLiveBody, { color: Colors.liveRed }]}>
              {(startMutation.error as any)?.message || "Could not start the stream"}
            </ThemedText>
          ) : null}
        </View>
      ) : null}

      {/* Live controls */}
      {phase === "live" ? (
        <>
          {shopOpen ? (
            <View
              style={[
                styles.shopSheet,
                { bottom: SHOP_BOTTOM, backgroundColor: theme.backgroundElevated },
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

          <View style={[styles.bottomBar, { bottom: BOTTOM_OFFSET }]}>
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
  startingOverlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  liveBg: {
    backgroundColor: "#0d0d0d",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
  },
  liveDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.liveRed,
  },
  liveLabel: {
    ...Typography.small,
    color: "rgba(255,255,255,0.6)",
  },
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
    zIndex: 10, elevation: 10,
  },
  topLeft: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  topRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  roundButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
  },
  giftLayer: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    alignItems: "flex-start", zIndex: 10, elevation: 10,
  },
  preLiveOverlay: {
    position: "absolute", left: Spacing.xl, right: Spacing.xl,
    alignItems: "center", backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: BorderRadius.lg, padding: Spacing.xl, gap: Spacing.sm,
    zIndex: 10, elevation: 10,
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
  bottomBar: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: Spacing.md, zIndex: 10, elevation: 10,
  },
  stopButton: {
    flex: 1, height: 48, borderRadius: BorderRadius.full,
    backgroundColor: Colors.liveRed, alignItems: "center", justifyContent: "center",
  },
  shopSheet: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    borderRadius: BorderRadius.md, padding: Spacing.md,
    zIndex: 11, elevation: 11,
  },
  shopTitle: { ...Typography.h4, marginBottom: Spacing.sm },
  shopRow: { flexDirection: "row", alignItems: "center", gap: Spacing.md, paddingVertical: Spacing.sm },
  shopThumb: { width: 40, height: 40, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center" },
  clearRow: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm, marginTop: Spacing.sm, alignItems: "center" },
});
