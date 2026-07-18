import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, ScrollView, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
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

// Host side of in-app streaming: broadcast your ride's camera to Travony
// viewers. The publisher role is granted by the server only because you are
// a participant of this ride — the app never picks its own role.
export default function GoLiveScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const rideId: string = route.params?.rideId;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [post, setPost] = useState<any>(null);
  const [publishing, setPublishing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [frontCamera, setFrontCamera] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);

  useKeepAwake();

  const nativeOk = agoraNativeAvailable();
  const rtc = useMemo(() => loadAgoraRtc(), []);
  const [engine, setEngine] = useState<any>(null);

  const startMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/agora/streams/${rideId}/start`, { method: "POST" }),
    onSuccess: (data) => {
      setPost(data.post);
      queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/agora/streams/${post.id}/stop`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
      navigation.goBack();
    },
  });

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

  // Broadcaster join once we hold a publisher token.
  useEffect(() => {
    if (!rtc || !tokens || tokens.role !== "publisher") return;
    let localEngine: any = null;
    try {
      const {
        createAgoraRtcEngine,
        ChannelProfileType,
        ClientRoleType,
        VideoEncoderConfiguration,
      } = rtc;
      localEngine = createAgoraRtcEngine();
      localEngine.initialize({
        appId: tokens.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      localEngine.registerEventHandler({
        onJoinChannelSuccess: () => setPublishing(true),
      });
      localEngine.enableVideo();
      // Simulcast so Lite Mode viewers can pull the low stream.
      localEngine.enableDualStreamMode?.(true);
      localEngine.setVideoEncoderConfiguration?.({
        dimensions: { width: 1280, height: 720 },
        frameRate: 24,
        bitrate: 0,
      });
      localEngine.startPreview();
      localEngine.joinChannelWithUserAccount(tokens.rtcToken, tokens.channel, tokens.uid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishCameraTrack: true,
        publishMicrophoneTrack: true,
      });
      setEngine(localEngine);
    } catch (err) {
      console.log("[GoLive] RTC start failed:", (err as any)?.message || err);
    }
    return () => {
      try {
        localEngine?.stopPreview?.();
        localEngine?.leaveChannel();
        localEngine?.release();
      } catch {}
      setEngine(null);
      setPublishing(false);
    };
  }, [rtc, tokens?.rtcToken]);

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

  // ---- permission gates -----------------------------------------------
  if (!cameraPermission || !micPermission) return <View style={styles.root} />;

  const permissionDeniedForever =
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
        {permissionDeniedForever ? (
          Platform.OS !== "web" ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch {}
              }}
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
          Live streaming ships with the next T Ride / T Driver update. Update your app to go live.
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

  // ---- pre-live confirm --------------------------------------------------
  if (!post) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <View style={styles.liveIconCircle}>
          <Ionicons name="radio-outline" size={34} color={Colors.liveRed} />
        </View>
        <ThemedText style={styles.permTitle}>Go live on Travony</ThemedText>
        <ThemedText style={styles.permBody}>
          Your camera streams inside the Travony app. Viewers can send gifts while they watch.
          Your exact location is never shown.
        </ThemedText>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: Colors.liveRed }]}
          onPress={() => startMutation.mutate()}
          disabled={startMutation.isPending}
        >
          {startMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <ThemedText style={styles.primaryButtonText}>Start streaming</ThemedText>
          )}
        </Pressable>
        {startMutation.isError ? (
          <ThemedText style={[styles.permBody, { color: Colors.liveRed }]}>
            {(startMutation.error as any)?.message || "Could not start the stream"}
          </ThemedText>
        ) : null}
        <Pressable onPress={() => navigation.goBack()} style={{ marginTop: Spacing.md }}>
          <ThemedText style={styles.permBody}>Cancel</ThemedText>
        </Pressable>
      </View>
    );
  }

  // ---- live ----------------------------------------------------------------
  const RtcSurfaceView = rtc?.RtcSurfaceView;
  const products = catalogQuery.data?.products || [];

  // Distance from bottom edge: leave room for home indicator + gesture bar.
  const BOTTOM_OFFSET = insets.bottom + Spacing["2xl"];
  // Bottom bar is 48px tall; shop sheet sits above it with extra padding.
  const SHOP_BOTTOM = BOTTOM_OFFSET + 48 + Spacing.lg;

  return (
    <View style={styles.root}>
      {/* Camera layer (native view — must come first in JSX) */}
      {RtcSurfaceView && engine ? (
        <RtcSurfaceView style={StyleSheet.absoluteFill} canvas={{ uid: 0 }} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "#101014" }]}>
          <ActivityIndicator color="#fff" />
          <ThemedText style={styles.permBody}>Starting your camera…</ThemedText>
        </View>
      )}

      {/* All overlays use zIndex + elevation so they render above the native camera view */}
      <View style={[styles.topBar, { top: insets.top + Spacing.md, zIndex: 10, elevation: 10 }]}>
        <View style={styles.topLeft}>
          <LiveBadge />
          <ViewerCountChip count={viewerCount} />
        </View>
        <Pressable
          style={styles.roundButton}
          onPress={() => {
            setFrontCamera((f) => !f);
            try {
              engine?.switchCamera?.();
            } catch {}
          }}
        >
          <Ionicons name="camera-reverse-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      <View
        style={[styles.giftLayer, { top: insets.top + 90, zIndex: 10, elevation: 10 }]}
        pointerEvents="none"
      >
        <GiftAnimationLayer gift={currentGift} />
      </View>

      {/* Shop the Look host controls — sits above the bottom bar */}
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
          style={({ pressed }) => [
            styles.stopButton,
            { opacity: pressed || stopMutation.isPending ? 0.85 : 1 },
          ]}
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
          <Ionicons name={publishing ? "wifi-outline" : "hourglass-outline"} size={20} color="#fff" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  permTitle: {
    ...Typography.h3,
    color: "#fff",
    textAlign: "center",
  },
  permBody: {
    ...Typography.small,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  primaryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.md,
  },
  primaryButtonText: {
    ...Typography.bodyBold,
    color: "#fff",
  },
  liveIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(233,25,22,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBar: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  topLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  roundButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  giftLayer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: "flex-start",
  },
  bottomBar: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  stopButton: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.liveRed,
    alignItems: "center",
    justifyContent: "center",
  },
  shopSheet: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  shopTitle: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
  },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  shopThumb: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  clearRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    marginTop: Spacing.sm,
    alignItems: "center",
  },
});
