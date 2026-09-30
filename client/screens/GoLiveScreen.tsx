import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Platform,
  Linking,
  Share,
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
import { useVehicleSpeed } from "@/hooks/useVehicleSpeed";
import { Spacing, BorderRadius, Typography, Colors, Glass } from "@/constants/theme";

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
  const rideId: string | undefined = route.params?.rideId;
  // When a go-live request is accepted by the driver the server pre-creates the
  // stream post and passes its id here — we skip the startMutation entirely.
  const preStartedPostId: string | undefined = route.params?.postId;

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();

  const nativeOk = agoraNativeAvailable();
  const rtc = useRef(loadAgoraRtc()).current;

  const [engine, setEngine] = useState<any>(null);
  const [phase, setPhase] = useState<Phase>("preview");
  const [cameraReleased, setCameraReleased] = useState(false);
  const [frontCamera, setFrontCamera] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [onTv, setOnTv] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [featuredKey, setFeaturedKey] = useState<string | null>(null);
  // Public share URL for standalone (no-ride) streams — fetched once the post is created.
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [post, setPost] = useState<any>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  // Distinguishes first connect from a mid-stream drop for the status badge.
  const everPublishedRef = useRef(false);
  // Speed-based distraction-prevention lockout (task #83)
  const { movingState, speedKmhRef } = useVehicleSpeed();
  // Controls are locked when moving OR when speed state is unknown (fail-safe).
  // "unknown" covers: permission denied, GPS unavailable, cold-start timeout.
  const isControlLocked = (movingState === "moving" || movingState === "unknown") && phase === "live";
  const [showLockoutToast, setShowLockoutToast] = useState(false);
  const lockoutToastShownRef = useRef(false);

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
  const abortedPostsRef = useRef<Set<string>>(new Set());
  const postRef = useRef<any>(null);
  const screenMountedRef = useRef(true);

  useEffect(() => {
    screenMountedRef.current = true;
    return () => {
      screenMountedRef.current = false;
      try {
        engineRef.current?.leaveChannel?.();
        engineRef.current?.release?.();
      } catch {}
      engineRef.current = null;
      // Android back/swipe navigation can bypass the on-screen close button.
      // Never leave a private accepted post or a public stream orphaned.
      const id = postRef.current?.id;
      if (id) apiRequest(`/api/agora/streams/${id}/stop`, { method: "POST" }).catch(() => {});
    };
  }, []);

  // When the driver accepted a go-live request the server pre-created the
  // stream post. Keep the camera visible while we fetch the token and app ID.
  useEffect(() => {
    if (preStartedPostId && phase === "preview") {
      setPost({ id: preStartedPostId });
      queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preStartedPostId]);

  // Fetch the public share link for standalone (no-ride) streams so the driver
  // can copy and share it while broadcasting.
  useEffect(() => {
    if (!post?.id || rideId) return;
    apiRequest(`/api/agora/streams/${post.id}/share-link`, { method: "GET" })
      .then((data: any) => { if (data?.url) setShareUrl(data.url); })
      .catch(() => {});
  }, [post?.id, rideId]);

  // ---------------------------------------------------------------------------
  // Go Live flow
  // ---------------------------------------------------------------------------
  const startMutation = useMutation({
    mutationFn: async () =>
      apiRequest(rideId ? `/api/agora/streams/${rideId}/start` : `/api/agora/streams/standalone/start`, { method: "POST" }),
    onSuccess: (data) => {
      setPost(data.post);
      queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
    },
    onError: () => setLiveError("Could not create the broadcast. Please check your connection and try again."),
  });

  const stopMutation = useMutation({
    mutationFn: async () =>
      apiRequest(`/api/agora/streams/${post.id}/stop`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
      // Hand the driver straight to the highlight review screen — the server
      // is already turning the stream's best moments into candidate clips.
      const endedPostId = post?.id;
      if (endedPostId) {
        (navigation as any).replace("StreamHighlights", { postId: endedPostId });
      } else {
        navigation.goBack();
      }
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

  // Abort a half-started stream so a failed Go Live never leaves a phantom
  // "live" card in the feed. Fire-and-forget; the server host-grace loop is
  // the backstop if this request itself fails.
  const abortStartedPost = useCallback((postId?: string) => {
    const id = postId ?? postRef.current?.id;
    if (!id || abortedPostsRef.current.has(id)) return;
    abortedPostsRef.current.add(id);
    try { engineRef.current?.leaveChannel?.(); } catch {}
    try { engineRef.current?.stopPreview?.(); } catch {}
    try { engineRef.current?.release?.(); } catch {}
    engineRef.current = null;
    setEngine(null);
    setPublishing(false);
    apiRequest(`/api/agora/streams/${id}/stop`, { method: "POST" }).catch(() => {});
    setPost(null);
    queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
  }, [queryClient]);
  useEffect(() => { postRef.current = post; }, [post]);

  // Only switch camera ownership once the post, token and app ID are ready.
  // Otherwise the first tap used to remove CameraView immediately and show a
  // blank screen while the network was still starting the stream.
  useEffect(() => {
    if (phase === "preview" && post?.id && tokens && agoraAppId && !liveError) {
      setPhase("starting");
    }
  }, [phase, post?.id, tokens, agoraAppId, liveError]);

  useEffect(() => {
    if (phase !== "starting") {
      setCameraReleased(false);
      return;
    }
    // CameraView unmounts on the first starting render. Give the native
    // camera session time to close before Agora asks Android for the camera.
    const timer = setTimeout(() => setCameraReleased(true), 400);
    return () => clearTimeout(timer);
  }, [phase]);

  // If the token query errors out, keep the camera preview and explain why.
  useEffect(() => {
    if (tokenQuery.isError && post?.id && phase !== "live") {
      setLiveError("Couldn't get a stream token — check your connection and try again.");
      setPhase("preview");
      abortStartedPost();
    }
  }, [tokenQuery.isError, post?.id, phase, abortStartedPost]);

  // Safety timeout: if still "starting" after 25s, something silently failed.
  useEffect(() => {
    if (!post?.id || phase === "live") return;
    const t = setTimeout(() => {
      setLiveError("Stream took too long to start. Please try again.");
      setPhase("preview");
      abortStartedPost();
    }, 25000);
    return () => clearTimeout(t);
  }, [post?.id, phase, abortStartedPost]);

  // Host heartbeat — the server's authoritative "still broadcasting" signal.
  // Keeps the stream alive through the host-grace loop and detects the server
  // ending the stream (ride completed, admin stop) so the UI exits cleanly.
  useEffect(() => {
    if (phase !== "live" || !post?.id) return;
    let stopped = false;
    const beat = async () => {
      try {
        // Safety layer: report the latest GPS speed with each heartbeat so the
        // server can derive deterministic speed-delta flags for the ride report.
        const speedKmh = speedKmhRef.current;
        const r = await apiRequest(`/api/agora/streams/${post.id}/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(speedKmh !== null ? { speedKmh: Math.round(speedKmh * 10) / 10 } : {}),
        });
        if (!stopped && r && r.live === false) {
          queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
          navigation.goBack();
        } else if (!stopped && typeof r?.viewerCount === "number") {
          setViewerCount(r.viewerCount);
          setOnTv(r.onTv === true);
        }
      } catch {} // transient network errors: keep broadcasting, keep trying
    };
    beat();
    const t = setInterval(beat, 15000);
    return () => { stopped = true; clearInterval(t); };
  }, [phase, post?.id]);

  // Initialize Agora and join the channel once the token arrives. CameraView is
  // unmounted in "starting", giving Agora sole ownership of camera + microphone.
  // The server post becomes public only after onJoinChannelSuccess and /ready.
  useEffect(() => {
    if (!rtc || !tokens || !agoraAppId) return;
    if (phase !== "starting" || !cameraReleased) return;
    // A token refresh must not create a second native engine for the same post.
    if (engineRef.current) return;

    if (tokens.role !== "publisher") {
      setLiveError("You are not a participant on this ride.");
      setPhase("preview");
      abortStartedPost();
      return;
    }

    let localEngine: any = null;
    let terminal = false;
    let joined = false;
    let firstFrameEncoded = false;
    let readyInFlight = false;
    let recoveryTimer: ReturnType<typeof setTimeout> | null = null;
    const report = (stage: string, code?: number) => {
      const id = postRef.current?.id;
      if (!id) return;
      apiRequest(`/api/agora/streams/${id}/diagnostic`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, code }),
      }).catch(() => {});
    };
    try {
      const { createAgoraRtcEngine, ChannelProfileType, ClientRoleType } = rtc;
      localEngine = createAgoraRtcEngine();
      localEngine.initialize({
        appId: agoraAppId,
        channelProfile: ChannelProfileType.ChannelProfileLiveBroadcasting,
      });
      const bail = (msg: string) => {
        if (terminal) return;
        terminal = true;
        setLiveError(msg);
        setPhase("preview");
        // Never release the native engine inside an Agora event callback. That
        // can re-enter native code while its callback is still on the stack.
        // abortStartedPost owns the single leave/release path.
        const id = postRef.current?.id;
        setTimeout(() => abortStartedPost(id), 0);
      };
      const markReadyWhenVideoWorks = () => {
        if (!joined || !firstFrameEncoded || terminal || readyInFlight) return;
        const id = postRef.current?.id;
        if (!id || abortedPostsRef.current.has(id)) return;
        readyInFlight = true;
        // Joining audio alone can succeed even while Android cannot open the
        // camera. A real encoded video frame is required before inviting riders
        // or making this stream eligible for Travony TV.
        apiRequest(`/api/agora/streams/${id}/ready`, { method: "POST" })
          .then(() => {
            if (terminal || !screenMountedRef.current || abortedPostsRef.current.has(id)) return;
            everPublishedRef.current = true;
            setPublishing(true);
            setPhase("live");
            queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
          })
          .catch(() => {
            report("ready_failed");
            bail("Connected to video, but couldn't publish the stream. Please try again.");
          });
      };
      localEngine.registerEventHandler({
        onJoinChannelSuccess: () => {
          if (terminal) return;
          report("joined");
          joined = true;
          markReadyWhenVideoWorks();
        },
        onError: (err: number, msg: string) => {
          console.log("[GoLive] RTC error", err, msg);
          if (!everPublishedRef.current) {
            report("rtc_error", err);
            bail(`Camera connection failed (${err}). Please try again.`);
          }
        },
        onLocalVideoStateChanged: (_source: number, state: number, reason: number) => {
          // A successful channel join without a working camera is not a usable
          // broadcast. Capture errors are especially useful for Android
          // camera-ownership failures that happen before /ready.
          if (state === 3 && !terminal) {
            report("camera_error", reason);
            bail(`Camera could not start (${reason}). Please try again.`);
          } else if (state === 2 && !terminal) {
            firstFrameEncoded = true;
            markReadyWhenVideoWorks();
          }
        },
        onConnectionStateChanged: (_conn: any, state: number, reason: number) => {
          console.log("[GoLive] connection state", state, "reason", reason);
          // Agora ConnectionStateType: 1 DISCONNECTED, 2 CONNECTING,
          // 3 CONNECTED, 4 RECONNECTING, 5 FAILED.
          if (state === 3) {
            // Recovered — cancel any pending recovery timer and go back live.
            if (recoveryTimer) { clearTimeout(recoveryTimer); recoveryTimer = null; }
            if (everPublishedRef.current) setPublishing(true);
          } else if (state === 5) {
            if (!everPublishedRef.current) {
              // Never successfully published — fail cleanly.
              report("connection_failed", reason);
              bail(`Stream connection failed (${reason}). Please try again.`);
            } else {
              // Already live — show reconnecting badge and give 45 s for
              // the network to recover before ending the broadcast.
              // The heartbeat useEffect keeps running (phase is still "live"),
              // so the server-side stream stays alive during this window.
              setPublishing(false);
              if (!recoveryTimer) {
                recoveryTimer = setTimeout(() => {
                  recoveryTimer = null;
                  if (!terminal) bail("Stream lost. Your broadcast has ended.");
                }, 45000);
              }
            }
          } else if (state === 1 || state === 4) {
            setPublishing(false); // dropped → "reconnecting" badge
          }
          // state 2 (CONNECTING): leave the indicator as-is until resolved
        },
      });
      localEngine.setClientRole?.(ClientRoleType?.ClientRoleBroadcaster ?? 1);
      localEngine.enableVideo();
      if (!frontCamera) localEngine.switchCamera?.();

      // Dual-stream: viewers on slow connections automatically receive the
      // low-quality simulcast layer (set in AgoraStreamViewerScreen).
      localEngine.enableDualStreamMode?.(true);

      // Encoder profile — 720p dashcam optimised for battery + data:
      //   1000 kbps target / 600 kbps floor, 24 fps, 2-second keyframe interval,
      //   MAINTAIN_FRAMERATE degradation (keep 24 fps, drop quality on congestion),
      //   ADAPTIVE orientation (rotates with device, avoids pillarbox).
      localEngine.setVideoEncoderConfiguration?.({
        dimensions: { width: 1280, height: 720 },
        frameRate: 24,
        bitrate: 1000,       // kbps — explicit; 0 lets Agora pick a sub-optimal default
        minBitrate: 600,     // floor: degrade quality before dropping the feed
        orientationMode: 0,  // 0 = ADAPTIVE — follows device rotation
        degradationPreference: 2, // 2 = MAINTAIN_FRAMERATE (smooth > sharp for dashcam)
      });

      // Audio: MUSIC_STANDARD profile (48 kHz stereo, 64 kbps AAC) on the
      // CHATROOM scenario — voice-optimised noise suppression, echo-cancelled.
      // Keeps audio crisp for local guide commentary without wasting data.
      localEngine.setAudioProfile?.(1, 5); // MUSIC_STANDARD, AUDIO_SCENARIO_CHATROOM
      // Agora may synchronously report a failed join: the engine must already
      // be owned by our cleanup path before that callback can run.
      engineRef.current = localEngine;
      report("joining");
      const joinResult = localEngine.joinChannelWithUserAccount(
        tokens.rtcToken,
        tokens.channel,
        tokens.uid,
        {
          clientRoleType: ClientRoleType?.ClientRoleBroadcaster ?? 1,
          publishCameraTrack: true,
          publishMicrophoneTrack: true,
        }
      );
      // Agora can reject the join synchronously without firing onError or
      // onJoinChannelSuccess. Don't leave the driver waiting for the timeout.
      if (typeof joinResult === "number" && joinResult < 0) {
        report("join_rejected", joinResult);
        bail(`Stream could not connect (${joinResult}). Please try again.`);
        return;
      }
      setEngine(localEngine);
    } catch (err) {
      console.log("[GoLive] RTC init/join failed:", (err as any)?.message ?? err);
      report("init_failed");
      setLiveError("Camera couldn't start the broadcast. Please try again.");
      setPhase("preview");
      const ownedByRef = engineRef.current === localEngine;
      abortStartedPost();
      if (!ownedByRef) {
        try { localEngine?.release?.(); } catch {}
      }
    }
  }, [rtc, tokens, phase, agoraAppId, cameraReleased]);

  // Show a one-time toast the first time the lockout activates this session.
  useEffect(() => {
    // Only show toast when we have confirmed movement, not on unknown state.
    if (movingState !== "moving" || phase !== "live" || lockoutToastShownRef.current) return;
    lockoutToastShownRef.current = true;
    // Safety layer: record that the distraction lockout engaged during this
    // stream (context for the post-ride safety report). Server throttles;
    // best-effort — never affects the broadcast.
    if (post?.id) {
      apiRequest(`/api/agora/streams/${post.id}/safety-event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "control_lockout" }),
      }).catch(() => {});
    }
    setShowLockoutToast(true);
    const t = setTimeout(() => setShowLockoutToast(false), 3500);
    return () => clearTimeout(t);
  }, [movingState, phase]);

  const catalogQuery = useQuery<{ products: CatalogProduct[] }>({
    queryKey: ["/api/agora/products/catalog"],
    enabled: !!post?.id,
  });

  // RTM is for live gifts/viewer events; it need not claim another native SDK
  // while the video engine is still trying to acquire the camera.
  const { subscribe } = useStreamChannel(phase === "live" ? post?.id ?? null : null, tokens);
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
  const AgoraLocalView = rtc?.RtcTextureView ?? rtc?.RtcSurfaceView;
  const BOTTOM_OFFSET = insets.bottom + Spacing["2xl"];
  const SHOP_BOTTOM = BOTTOM_OFFSET + 48 + Spacing.lg;

  return (
    <View style={styles.root}>

      {/* ------------------------------------------------------------------ */}
      {/* Camera background. expo-camera is preview-only; it unmounts before */}
      {/* Agora starts so two native camera owners never fight each other.   */}
      {/* ------------------------------------------------------------------ */}
      {phase === "preview" ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing={frontCamera ? "front" : "back"}
        />
      ) : engine && AgoraLocalView ? (
        <AgoraLocalView
          style={StyleSheet.absoluteFill}
          canvas={{ uid: 0, renderMode: 1 }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.liveBg]}>
          <Ionicons name="videocam-outline" size={40} color="rgba(255,255,255,0.45)" />
        </View>
      )}

      {/* Spinner overlay — only shown while joining (starting phase) */}
      {phase === "starting" ? (
        <View style={[StyleSheet.absoluteFill, styles.startingOverlay]}>
          <ActivityIndicator color="#fff" size="large" />
          <ThemedText style={styles.startingText}>
            {!post?.id
              ? "Starting your stream…"
              : !tokens
                ? "Securing your channel…"
                : "Connecting…"}
          </ThemedText>
        </View>
      ) : null}

      {/* Reconnecting badge — visible whenever the live connection drops so
          the host always knows the stream state (Agora auto-reconnects). */}
      {phase === "live" && !publishing ? (
        <View style={[styles.reconnectBadge, { top: insets.top + Spacing.md + 52 }]}>
          <ActivityIndicator size="small" color="#fff" />
          <ThemedText style={styles.reconnectText}>
            {everPublishedRef.current ? "Reconnecting…" : "Connecting…"}
          </ThemedText>
        </View>
      ) : null}

      {/* Top bar */}
      <View style={[styles.topBar, { top: insets.top + Spacing.md }]}>
        <View style={styles.topLeft}>
          {phase === "live" ? <LiveBadge /> : null}
          {phase === "live" ? <ViewerCountChip count={viewerCount} /> : null}
          {phase === "live" && onTv ? (
            <View style={styles.onTvBadge}>
              <Ionicons name="tv" size={12} color="#04240f" />
              <ThemedText style={styles.onTvText}>ON TV</ThemedText>
            </View>
          ) : null}
        </View>
        {/* Hide camera-flip and close when locked — driver must use End Stream
            in the locked bar instead of navigating away mid-movement. */}
        {!isControlLocked ? (
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
            {/* Share button — only for standalone streams where viewers need the link */}
            {!rideId && shareUrl && phase === "live" ? (
              <Pressable
                style={styles.roundButton}
                onPress={() => {
                  Share.share({ message: `Watch me live on Travony! ${shareUrl}`, url: shareUrl });
                }}
              >
                <Ionicons name="share-outline" size={20} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable
              style={styles.roundButton}
              onPress={() => {
                // Closing while live must END the stream — leaving it running
                // would strand viewers on a frozen frame until the server
                // grace timeout and leave a ghost "live" card in the feed.
                if (phase === "live" && post?.id) {
                  stopMutation.mutate();
                } else {
                   if (post?.id) abortStartedPost(post.id);
                  navigation.goBack();
                }
              }}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>
        ) : null}
      </View>

      {/* Gift overlay — suppressed while moving so animation doesn't cover the
          driver's view during active driving. Events received during lockout are
          dropped (the queue still advances); this is intentional — a backlog of
          gift animations playing when the driver stops would be distracting. */}
      <View
        style={[styles.giftLayer, { top: insets.top + 90 }]}
        pointerEvents="none"
      >
        <GiftAnimationLayer gift={isControlLocked ? null : currentGift} />
      </View>

      {/* Lockout toast — shown once per session on first lockout entry */}
      {showLockoutToast ? (
        <View style={[styles.lockoutToast, { top: insets.top + 90 + 60 }]}>
          <Ionicons name="car-outline" size={15} color="#fff" />
          <ThemedText style={styles.lockoutToastText}>
            Controls locked while moving — stay safe
          </ThemedText>
        </View>
      ) : null}

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
              startMutation.mutate();
            }}
            disabled={startMutation.isPending || !!post?.id || !agoraAppId}
          >
            {startMutation.isPending || !!post?.id ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.primaryButtonText}>Go Live</ThemedText>
            )}
          </Pressable>
          {post?.id ? (
            <ThemedText style={styles.preLiveBody}>
              Securing your channel… Your camera preview will stay on until we can connect.
            </ThemedText>
          ) : null}
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

      {/* Live controls — locked when isMoving, full controls when stopped */}
      {phase === "live" ? (
        <>
          {/* Product shop panel — hidden when controls are locked */}
          {shopOpen && !isControlLocked ? (
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

          {isControlLocked ? (
            /* ── Locked state: minimal LIVE badge + End button only ── */
            <View style={[styles.lockedBar, { bottom: BOTTOM_OFFSET }]}>
              <LiveBadge />
              <ThemedText style={styles.lockedText} numberOfLines={1}>
                {movingState === "unknown" ? "Location unavailable" : "Controls locked"}
              </ThemedText>
              <Pressable
                style={({ pressed }) => [
                  styles.lockedEndButton,
                  { opacity: pressed || stopMutation.isPending ? 0.85 : 1 },
                ]}
                onPress={() => stopMutation.mutate()}
                disabled={stopMutation.isPending}
              >
                {stopMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>End Stream</ThemedText>
                )}
              </Pressable>
            </View>
          ) : (
            /* ── Normal state: shop toggle + end + wifi indicator ── */
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
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  center: { alignItems: "center", justifyContent: "center", gap: Spacing.md, padding: Spacing.xl },
  startingOverlay: {
    backgroundColor: Glass.chip,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    gap: Spacing.md,
  },
  startingText: {
    ...Typography.small,
    color: Glass.textOnGlassDim,
  },
  onTvBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22c55e",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  onTvText: {
    ...Typography.captionBold,
    color: "#04240f",
  },
  reconnectBadge: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Glass.scrim,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    zIndex: 20,
    elevation: 20,
  },
  reconnectText: {
    ...Typography.small,
    color: "#fff",
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
  permBody: { ...Typography.small, color: Glass.textOnGlassDim, textAlign: "center" },
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
    backgroundColor: Glass.chip, alignItems: "center", justifyContent: "center",
  },
  giftLayer: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    alignItems: "flex-start", zIndex: 10, elevation: 10,
  },
  preLiveOverlay: {
    position: "absolute", left: Spacing.xl, right: Spacing.xl,
    alignItems: "center", backgroundColor: Glass.scrim,
    borderRadius: BorderRadius.lg, padding: Spacing.xl, gap: Spacing.sm,
    zIndex: 10, elevation: 10,
  },
  liveIconCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(233,25,22,0.18)", alignItems: "center", justifyContent: "center",
  },
  preLiveTitle: { ...Typography.h3, color: "#fff", textAlign: "center" },
  preLiveBody: { ...Typography.small, color: Glass.textOnGlassDim, textAlign: "center" },
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
  // Speed-lockout styles
  lockedBar: {
    position: "absolute", left: Spacing.lg, right: Spacing.lg,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    gap: Spacing.md, zIndex: 10, elevation: 10,
    backgroundColor: Glass.scrim,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  lockedText: {
    ...Typography.small,
    color: Glass.textOnGlassDim,
    flex: 1,
    textAlign: "center",
  },
  lockedEndButton: {
    height: 38, borderRadius: BorderRadius.full,
    backgroundColor: Colors.liveRed,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  lockoutToast: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: Glass.scrimHeavy,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    zIndex: 20, elevation: 20,
  },
  lockoutToastText: {
    ...Typography.small,
    color: "#fff",
  },
});
