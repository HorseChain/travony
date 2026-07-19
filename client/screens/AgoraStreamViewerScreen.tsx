import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import { apiRequest } from "@/lib/query-client";
import { loadAgoraRtc, agoraNativeAvailable } from "@/lib/agoraNative";
import { useStreamChannel, StreamTokenBundle, StreamEvent } from "@/hooks/useStreamChannel";
import {
  ViewerCountChip,
  LiveBadge,
  GiftAnimationLayer,
  useGiftAnimations,
  ShopTheLookCard,
  ActiveProduct,
} from "@/components/stream/StreamOverlays";
import GiftSheet from "@/components/rewards/GiftSheet";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";

interface StreamSnapshot {
  id: string;
  isLive: boolean;
  hostId: string;
  hostName: string | null;
  hostAvatar: string | null;
  viewerCount: number;
  activeProduct: ActiveProduct | null;
}

// Watch an in-app (Agora) ride stream as audience, with the interactive
// overlay layer riding on RTM. All overlay state is server-authored: gifts
// and product cards come only from server-published events; the snapshot
// endpoint is the reconciliation source after any missed events.
export default function AgoraStreamViewerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { liteMode } = useLiteMode();
  const postId: string = route.params?.postId;

  // Hide tab bar — this is a full-screen viewer.
  useFocusEffect(
    useCallback(() => {
      const parent = (navigation as any).getParent?.();
      parent?.setOptions({ tabBarStyle: { display: "none" } });
      return () => {
        parent?.setOptions({ tabBarStyle: undefined });
      };
    }, [navigation])
  );

  const [giftOpen, setGiftOpen] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [engineReady, setEngineReady] = useState(false);
  const [product, setProduct] = useState<ActiveProduct | null>(null);
  const [viewerCount, setViewerCount] = useState(0);
  const [ended, setEnded] = useState(false);

  const nativeOk = agoraNativeAvailable();

  const tokenQuery = useQuery<StreamTokenBundle>({
    queryKey: ["/api/agora/token", postId],
    queryFn: () =>
      apiRequest("/api/agora/token", {
        method: "POST",
        body: JSON.stringify({ ridePostId: postId }),
        headers: { "Content-Type": "application/json" },
      }),
    enabled: !!postId,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const tokens = tokenQuery.data ?? null;

  // Snapshot doubles as the no-native / reconnect fallback: poll it (Lite
  // Mode-aware) and mirror its overlay state into local state.
  const snapshotQuery = useQuery<StreamSnapshot>({
    queryKey: ["/api/agora/streams", postId],
    enabled: !!postId,
    refetchInterval: litePollMs(nativeOk ? 15000 : 6000, liteMode),
  });
  const snapshot = snapshotQuery.data;

  useEffect(() => {
    if (!snapshot) return;
    setViewerCount(snapshot.viewerCount);
    setProduct(snapshot.activeProduct);
    if (!snapshot.isLive) setEnded(true);
  }, [snapshot?.viewerCount, snapshot?.activeProduct?.productId, snapshot?.isLive]);

  const { subscribe } = useStreamChannel(postId, tokens);
  const { current: currentGift, onGiftEvent } = useGiftAnimations();

  useEffect(() => {
    return subscribe((event: StreamEvent) => {
      switch (event.type) {
        case "gift.sent":
          onGiftEvent(event);
          break;
        case "viewer.count":
          setViewerCount(Number(event.data?.count) || 0);
          break;
        case "product.push":
          setProduct({
            productId: event.data.productId,
            productKey: event.data.productKey,
            title: event.data.title,
            imageUrl: event.data.imageUrl,
            priceLabel: event.data.priceLabel,
            ttlSeconds: event.data.ttlSeconds,
          });
          break;
        case "product.clear":
          setProduct(null);
          break;
        case "stream.state":
          if (event.data?.state === "ended") setEnded(true);
          break;
      }
    });
  }, [subscribe, onGiftEvent]);

  // RTC audience join — native builds only.
  const rtc = useMemo(() => loadAgoraRtc(), []);
  useEffect(() => {
    if (!rtc || !tokens || ended) return;
    let engine: any = null;
    try {
      const {
        createAgoraRtcEngine,
        ChannelProfileType,
        ClientRoleType,
        VideoStreamType,
      } = rtc;
      engine = createAgoraRtcEngine();
      engine.initialize({
        appId: tokens.appId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      engine.registerEventHandler({
        onJoinChannelSuccess: () => setEngineReady(true),
        onUserJoined: (_conn: any, uid: number) => setRemoteUid(uid),
        onUserOffline: (_conn: any, uid: number) =>
          setRemoteUid((prev) => (prev === uid ? null : prev)),
      });
      engine.enableVideo();
      // Lite Mode: ask for the low-quality simulcast stream.
      if (liteMode) {
        engine.setRemoteDefaultVideoStreamType?.(VideoStreamType.VideoStreamLow);
      }
      engine.joinChannelWithUserAccount(tokens.rtcToken, tokens.channel, tokens.uid, {
        clientRoleType: ClientRoleType.ClientRoleAudience,
        autoSubscribeVideo: true,
        autoSubscribeAudio: true,
        publishCameraTrack: false,
        publishMicrophoneTrack: false,
      });
    } catch (err) {
      console.log("[Stream] RTC join failed:", (err as any)?.message || err);
    }
    return () => {
      try {
        engine?.leaveChannel();
        engine?.unregisterEventHandler?.({});
        engine?.release();
      } catch {}
      setEngineReady(false);
      setRemoteUid(null);
    };
  }, [rtc, tokens?.rtcToken, ended]);

  // Prefer TextureView (renders inline, no z-index black on Android).
  const AgoraRemoteView = rtc?.RtcTextureView ?? rtc?.RtcSurfaceView;
  const isSelf = user?.id && snapshot?.hostId === user.id;

  return (
    <View style={styles.root}>
      {/* Video layer */}
      {nativeOk && AgoraRemoteView && remoteUid !== null && !ended ? (
        <AgoraRemoteView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: remoteUid, renderMode: 1 }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.videoFallback]}>
          {ended ? (
            <>
              <Ionicons name="radio-outline" size={44} color="rgba(255,255,255,0.5)" />
              <ThemedText style={styles.fallbackTitle}>Stream ended</ThemedText>
            </>
          ) : !nativeOk ? (
            <>
              <Ionicons name="videocam-off-outline" size={44} color="rgba(255,255,255,0.5)" />
              <ThemedText style={styles.fallbackTitle}>In-app video needs the new app build</ThemedText>
              <ThemedText style={styles.fallbackBody}>
                Update T Ride / T Driver to the latest version to watch live ride streams here.
                Gifts and updates below still work.
              </ThemedText>
            </>
          ) : (
            <>
              <ActivityIndicator color="#fff" />
              <ThemedText style={styles.fallbackBody}>
                {engineReady ? "Waiting for the host's video…" : "Connecting…"}
              </ThemedText>
            </>
          )}
        </View>
      )}

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + Spacing.md }]}>
        <View style={styles.hostRow}>
          {snapshot?.hostAvatar ? (
            <Image source={{ uri: snapshot.hostAvatar }} style={styles.hostAvatar} />
          ) : (
            <View style={[styles.hostAvatar, styles.hostAvatarFallback]}>
              <Ionicons name="person" size={14} color="#fff" />
            </View>
          )}
          <ThemedText style={styles.hostName} numberOfLines={1}>
            {snapshot?.hostName || route.params?.name || "Live ride"}
          </ThemedText>
        </View>
        <View style={styles.topRight}>
          {!ended ? <LiveBadge /> : null}
          <ViewerCountChip count={viewerCount} />
          <Pressable style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Ionicons name="close" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Gift animations */}
      <View style={[styles.giftLayer, { top: insets.top + 90 }]} pointerEvents="none">
        <GiftAnimationLayer gift={currentGift} />
      </View>

      {/* Bottom overlay: product card + gift action */}
      <View style={[styles.bottomArea, { bottom: insets.bottom + Spacing.xl }]}>
        {product ? (
          <ShopTheLookCard product={product} onExpired={() => setProduct(null)} />
        ) : null}
        {!ended && !isSelf ? (
          <Pressable
            style={({ pressed }) => [
              styles.giftButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => setGiftOpen(true)}
          >
            <Ionicons name="gift-outline" size={18} color={Colors.light.textOnPrimary} />
            <ThemedText style={styles.giftButtonText}>Send a gift</ThemedText>
          </Pressable>
        ) : null}
        {ended ? (
          <Pressable
            style={({ pressed }) => [
              styles.giftButton,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => navigation.goBack()}
          >
            <ThemedText style={[styles.giftButtonText, { color: theme.text }]}>Back to feed</ThemedText>
          </Pressable>
        ) : null}
      </View>

      <GiftSheet
        visible={giftOpen}
        onClose={() => setGiftOpen(false)}
        postId={postId}
        recipientName={snapshot?.hostName || null}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoFallback: {
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    padding: Spacing.xl,
    backgroundColor: "#101014",
  },
  fallbackTitle: {
    ...Typography.h4,
    color: "#fff",
    textAlign: "center",
  },
  fallbackBody: {
    ...Typography.small,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  topBar: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  hostRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: BorderRadius.full,
    paddingRight: Spacing.md,
    paddingLeft: 4,
    paddingVertical: 4,
    flexShrink: 1,
  },
  hostAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  hostAvatarFallback: {
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  hostName: {
    ...Typography.smallBold,
    color: "#fff",
    maxWidth: 140,
  },
  topRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  giftLayer: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: "flex-start",
  },
  bottomArea: {
    position: "absolute",
    left: Spacing.lg,
    right: Spacing.lg,
    gap: Spacing.md,
  },
  giftButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 46,
    borderRadius: BorderRadius.full,
  },
  giftButtonText: {
    ...Typography.bodyBold,
    color: Colors.light.textOnPrimary,
  },
});
