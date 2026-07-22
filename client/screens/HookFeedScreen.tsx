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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withSequence,
  withRepeat,
  FadeIn,
  FadeInDown,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("screen");
const AUTO_ADVANCE_MS = 7000;
const TAB_BAR_H = 80;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CardType = "live" | "post" | "route" | "feature";

interface LiveStream {
  name: string;
  avatar: string | null;
  twitchChannel: string | null;
  city: string | null;
  country: string | null;
  startedAt: string;
  provider: string;
  viewerCount?: number;
}

interface SocialPost {
  id: string;
  caption: string | null;
  photoUrl: string | null;
  cityName: string | null;
  distanceKm: string | null;
  isLive: boolean;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  reactions: Record<string, number>;
  reactionCount: number;
  myReaction: string | null;
  commentCount: number;
}

interface TrendingRoute {
  label: string;
  score: number;
  velocity: number;
  rising: boolean;
  driversLive: number;
  openRequests: number;
  city: string | null;
}

interface FeatureDef {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  gradient: readonly [string, string, string];
  cta: string;
  ctaRoute?: keyof HomeStackParamList;
}

interface FeedCard {
  id: string;
  type: CardType;
  liveStream?: LiveStream;
  post?: SocialPost;
  route?: TrendingRoute;
  feature?: FeatureDef;
}

// ---------------------------------------------------------------------------
// Static feature cards — represent every pillar of Travony
// ---------------------------------------------------------------------------

const FEATURE_CARDS: FeatureDef[] = [
  {
    id: "feat-welcome",
    title: "Welcome to Travony",
    subtitle: "Social. Live. Rides. Community. Education. Entertainment — all in one place.",
    icon: "globe-outline",
    gradient: ["#00B14F", "#007A38", "#003D1C"],
    cta: "Explore",
  },
  {
    id: "feat-ride",
    title: "Book a Ride in Seconds",
    subtitle: "Tell our AI where you're going. Smart matching finds your ideal driver.",
    icon: "car-outline",
    gradient: ["#0f3460", "#16213e", "#1a1a2e"],
    cta: "Book Now",
    ctaRoute: "AssistantHome",
  },
  {
    id: "feat-golive",
    title: "Go Live on Your Ride",
    subtitle: "Stream your journey live. Build an audience. Receive gifts from viewers.",
    icon: "radio-outline",
    gradient: ["#7C4DFF", "#5C35CC", "#3D1F99"],
    cta: "Go Live",
  },
  {
    id: "feat-prayer",
    title: "Free Prayer Rides",
    subtitle: "Community-first mobility. Volunteer drivers offer free rides to prayer.",
    icon: "heart-outline",
    gradient: ["#00A3A3", "#007A7A", "#004D4D"],
    cta: "Learn More",
    ctaRoute: "PrayerRides",
  },
  {
    id: "feat-coffee",
    title: "Coffee Ordered, Ride Incoming",
    subtitle: "Karak, Arabic coffee, Turkish, and more — ordered right inside your app.",
    icon: "cafe-outline",
    gradient: ["#8B4513", "#6B3410", "#4A2309"],
    cta: "See Menu",
    ctaRoute: "Coffee",
  },
  {
    id: "feat-earn",
    title: "Drive. Earn. Grow.",
    subtitle: "Every ride builds toward your next vehicle. The Car Ladder rewards you.",
    icon: "trending-up-outline",
    gradient: ["#CC9200", "#997000", "#664B00"],
    cta: "Join as Driver",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
      <ThemedText style={{ fontWeight: "700", fontSize: size * 0.4, color: "#fff" }}>
        {(name || "?").charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Right-side action button
// ---------------------------------------------------------------------------

interface ActionBtnProps {
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon?: keyof typeof Ionicons.glyphMap;
  label?: string;
  active?: boolean;
  color?: string;
  onPress: () => void;
}

function ActionBtn({ icon, activeIcon, label, active, color = "#fff", onPress }: ActionBtnProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSequence(withSpring(0.75, { damping: 5 }), withSpring(1, { damping: 8 }));
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.actionBtn}>
      <Animated.View style={[animStyle, styles.actionBtnInner]}>
        <Ionicons
          name={active && activeIcon ? activeIcon : icon}
          size={30}
          color={active ? (color !== "#fff" ? color : Colors.reactionLove) : "#fff"}
        />
        {label ? (
          <ThemedText style={styles.actionBtnLabel}>{label}</ThemedText>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Live Card
// ---------------------------------------------------------------------------

function LiveHookCard({
  stream,
  bottomInset,
  onTap,
}: {
  stream: LiveStream;
  bottomInset: number;
  onTap: () => void;
}) {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(0.6, { duration: 800 }), withTiming(1, { duration: 800 })),
      -1,
      false,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Pressable style={styles.cardRoot} onPress={onTap}>
      <LinearGradient
        colors={["#1a0010", "#3D0020", "#1a0010"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Large pulsing avatar */}
      <View style={styles.liveAvatarWrap}>
        <Animated.View style={[styles.livePulseRing, pulseStyle]} />
        <View style={styles.liveAvatarInner}>
          <Avatar uri={stream.avatar} name={stream.name} size={120} />
        </View>
      </View>

      {/* LIVE badge */}
      <Animated.View entering={FadeIn.delay(200)} style={styles.liveBadge}>
        <View style={styles.liveBadgeDot} />
        <ThemedText style={styles.liveBadgeText}>LIVE</ThemedText>
        {stream.viewerCount ? (
          <ThemedText style={styles.liveBadgeCount}>{stream.viewerCount}</ThemedText>
        ) : null}
      </Animated.View>

      {/* Right sidebar */}
      <View style={[styles.sidebar, { bottom: bottomInset }]}>
        <ActionBtn icon="heart-outline" activeIcon="heart" label="" onPress={onTap} />
        <ActionBtn icon="chatbubble-outline" label="" onPress={onTap} />
        <ActionBtn icon="gift-outline" label="" onPress={onTap} />
        <ActionBtn icon="share-outline" onPress={onTap} />
      </View>

      {/* Bottom overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={[styles.bottomGradient, { paddingBottom: bottomInset + Spacing.sm }]}
      >
        <Animated.View entering={FadeInDown.delay(100)} style={styles.bottomContent}>
          <View style={styles.authorRow}>
            <Avatar uri={stream.avatar} name={stream.name} size={38} />
            <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
              <ThemedText style={styles.authorName}>{stream.name}</ThemedText>
              {stream.city ? (
                <ThemedText style={styles.authorSub}>{stream.city}</ThemedText>
              ) : null}
            </View>
          </View>
          <ThemedText style={styles.caption} numberOfLines={2}>
            Streaming live from{stream.city ? ` ${stream.city}` : " their ride"}
          </ThemedText>
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Post Card
// ---------------------------------------------------------------------------

function PostHookCard({
  post,
  bottomInset,
  isAuthenticated,
  onTap,
  onReact,
}: {
  post: SocialPost;
  bottomInset: number;
  isAuthenticated: boolean;
  onTap: () => void;
  onReact: (type: string) => void;
}) {
  const liked = post.myReaction === "like" || post.myReaction === "love";

  const GRADIENTS: readonly [string, string][] = [
    ["#0f3460", "#1a1a2e"],
    ["#004D22", "#001A0B"],
    ["#3D0020", "#1a0010"],
    ["#004D4D", "#001A1A"],
    ["#1a0038", "#0f0020"],
  ];
  const fallback = GRADIENTS[Math.abs(post.id.charCodeAt(0)) % GRADIENTS.length];

  return (
    <Pressable style={styles.cardRoot} onPress={onTap}>
      {post.photoUrl ? (
        <Image
          source={{ uri: post.photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
      ) : (
        <LinearGradient colors={fallback} style={StyleSheet.absoluteFill} />
      )}
      {/* Scrim for readability when there's a photo */}
      {post.photoUrl ? (
        <LinearGradient
          colors={["rgba(0,0,0,0.15)", "rgba(0,0,0,0.0)", "rgba(0,0,0,0.7)"]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      {/* Right sidebar */}
      <View style={[styles.sidebar, { bottom: bottomInset }]}>
        <ActionBtn
          icon="heart-outline"
          activeIcon="heart"
          label={post.reactionCount > 0 ? String(post.reactionCount) : ""}
          active={liked}
          onPress={() => onReact("love")}
        />
        <ActionBtn
          icon="chatbubble-outline"
          label={post.commentCount > 0 ? String(post.commentCount) : ""}
          onPress={onTap}
        />
        <ActionBtn icon="share-outline" onPress={onTap} />
      </View>

      {/* Bottom overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.88)"]}
        style={[styles.bottomGradient, { paddingBottom: bottomInset + Spacing.sm }]}
      >
        <Animated.View entering={FadeInDown.delay(100)} style={styles.bottomContent}>
          <View style={styles.authorRow}>
            <Avatar uri={post.authorAvatar} name={post.authorName} size={38} />
            <View style={{ marginLeft: Spacing.sm, flex: 1 }}>
              <ThemedText style={styles.authorName}>{post.authorName}</ThemedText>
              {post.cityName ? (
                <ThemedText style={styles.authorSub}>
                  {post.cityName}
                  {post.distanceKm ? ` · ${post.distanceKm}km` : ""}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={styles.timeAgo}>{timeAgo(post.createdAt)}</ThemedText>
          </View>
          {post.caption ? (
            <ThemedText style={styles.caption} numberOfLines={2}>
              {post.caption}
            </ThemedText>
          ) : null}
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Route Card
// ---------------------------------------------------------------------------

function RouteHookCard({
  route,
  bottomInset,
  onTap,
}: {
  route: TrendingRoute;
  bottomInset: number;
  onTap: () => void;
}) {
  const arrowScale = useSharedValue(1);
  useEffect(() => {
    arrowScale.value = withRepeat(
      withSequence(withTiming(1.25, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false,
    );
  }, [arrowScale]);
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: arrowScale.value }],
  }));

  const parts = route.label.split(" → ");
  const from = parts[0] || route.label;
  const to = parts[1] || "";

  return (
    <Pressable style={styles.cardRoot} onPress={onTap}>
      <LinearGradient
        colors={["#4A0000", "#8B1A00", "#CC4400"]}
        style={StyleSheet.absoluteFill}
      />
      {/* Grid pattern overlay */}
      <View style={styles.routeGrid} pointerEvents="none" />

      {/* Hot badge */}
      <Animated.View entering={FadeIn.delay(200)} style={[styles.routeBadge]}>
        <Ionicons name="flame" size={14} color="#fff" />
        <ThemedText style={styles.routeBadgeText}>HOT ROUTE</ThemedText>
      </Animated.View>

      {/* Center content */}
      <View style={styles.routeCenter} pointerEvents="none">
        <Animated.View style={arrowStyle}>
          <Ionicons name="trending-up" size={56} color="rgba(255,255,255,0.9)" />
        </Animated.View>
        <ThemedText style={styles.routeFrom} numberOfLines={1}>{from}</ThemedText>
        <Ionicons name="arrow-down-outline" size={22} color="rgba(255,255,255,0.6)" />
        {to ? (
          <ThemedText style={styles.routeTo} numberOfLines={1}>{to}</ThemedText>
        ) : null}
      </View>

      {/* Right sidebar */}
      <View style={[styles.sidebar, { bottom: bottomInset }]}>
        <ActionBtn icon="car-outline" label="" onPress={onTap} />
        <ActionBtn icon="share-outline" onPress={onTap} />
      </View>

      {/* Bottom overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.75)"]}
        style={[styles.bottomGradient, { paddingBottom: bottomInset + Spacing.sm }]}
      >
        <Animated.View entering={FadeInDown.delay(100)} style={styles.bottomContent}>
          <ThemedText style={styles.routeStats}>
            {route.driversLive > 0 ? `${route.driversLive} drivers active` : ""}
            {route.driversLive > 0 && route.openRequests > 0 ? "  ·  " : ""}
            {route.openRequests > 0 ? `${route.openRequests} open requests` : ""}
          </ThemedText>
          {route.city ? (
            <ThemedText style={styles.authorSub}>{route.city}</ThemedText>
          ) : null}
          <Pressable onPress={onTap} style={styles.bookRouteBtn}>
            <ThemedText style={styles.bookRouteBtnText}>Book this route</ThemedText>
          </Pressable>
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Feature Card
// ---------------------------------------------------------------------------

function FeatureHookCard({
  feat,
  bottomInset,
  onTap,
}: {
  feat: FeatureDef;
  bottomInset: number;
  onTap: () => void;
}) {
  const iconScale = useSharedValue(0.85);
  useEffect(() => {
    iconScale.value = withRepeat(
      withSequence(
        withTiming(1.0, { duration: 1800 }),
        withTiming(0.85, { duration: 1800 }),
      ),
      -1,
      false,
    );
  }, [iconScale]);
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <Pressable style={styles.cardRoot} onPress={onTap}>
      <LinearGradient colors={feat.gradient} style={StyleSheet.absoluteFill} />

      {/* Decorative circles */}
      <View style={[styles.decoCircle, { width: 320, height: 320, top: -60, right: -80, opacity: 0.12 }]} />
      <View style={[styles.decoCircle, { width: 200, height: 200, bottom: 140, left: -50, opacity: 0.09 }]} />

      {/* Center icon */}
      <View style={styles.featureCenter} pointerEvents="none">
        <Animated.View style={[styles.featureIconWrap, iconStyle]}>
          <Ionicons name={feat.icon} size={72} color="rgba(255,255,255,0.95)" />
        </Animated.View>
        <ThemedText style={styles.featureTitle}>{feat.title}</ThemedText>
        <ThemedText style={styles.featureSubtitle}>{feat.subtitle}</ThemedText>
      </View>

      {/* Right sidebar */}
      <View style={[styles.sidebar, { bottom: bottomInset }]}>
        <ActionBtn icon="share-outline" onPress={onTap} />
      </View>

      {/* CTA */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.6)"]}
        style={[styles.bottomGradient, { paddingBottom: bottomInset + Spacing.sm }]}
      >
        <Animated.View entering={FadeInDown.delay(150)} style={[styles.bottomContent, { alignItems: "flex-start" }]}>
          {feat.ctaRoute ? (
            <Pressable onPress={onTap} style={styles.featureCta}>
              <ThemedText style={styles.featureCtaText}>{feat.cta}</ThemedText>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </Pressable>
          ) : null}
        </Animated.View>
      </LinearGradient>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Single hook card (dispatcher)
// ---------------------------------------------------------------------------

const HookCard = memo(function HookCard({
  item,
  bottomInset,
  isAuthenticated,
  onTap,
  onReact,
}: {
  item: FeedCard;
  bottomInset: number;
  isAuthenticated: boolean;
  onTap: () => void;
  onReact: (type: string) => void;
}) {
  if (item.type === "live" && item.liveStream) {
    return (
      <LiveHookCard stream={item.liveStream} bottomInset={bottomInset} onTap={onTap} />
    );
  }
  if (item.type === "post" && item.post) {
    return (
      <PostHookCard
        post={item.post}
        bottomInset={bottomInset}
        isAuthenticated={isAuthenticated}
        onTap={onTap}
        onReact={onReact}
      />
    );
  }
  if (item.type === "route" && item.route) {
    return <RouteHookCard route={item.route} bottomInset={bottomInset} onTap={onTap} />;
  }
  if (item.type === "feature" && item.feature) {
    return <FeatureHookCard feat={item.feature} bottomInset={bottomInset} onTap={onTap} />;
  }
  return null;
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function HookFeedScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const route = useRoute<any>();
  const { isAuthenticated } = useAuth();
  const { openLoginSheet } = useAuthGate();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  // Logged-in users skip the hook feed — go straight to the assistant
  useEffect(() => {
    if (isAuthenticated) {
      navigation.replace("AssistantHome", {});
    }
  }, [isAuthenticated, navigation]);

  // Delegate booking params to AssistantHome
  useEffect(() => {
    const params = route.params as any;
    if (params?.selectedLocation || params?.selectedPickup) {
      navigation.navigate("AssistantHome", params as any);
    }
  }, [route.params, navigation]);

  // Hide the parent tab bar on this screen so content is truly full-bleed
  useFocusEffect(
    useCallback(() => {
      navigation.getParent()?.setOptions({ tabBarStyle: { display: "flex" } });
    }, [navigation]),
  );

  // ---------------------------------------------------------------------------
  // Data
  // ---------------------------------------------------------------------------

  const liveQuery = useQuery<any>({ queryKey: ["/api/network/live-streams"] });
  const trendingQuery = useQuery<any>({ queryKey: ["/api/trending"] });
  const feedQuery = useQuery<any>({
    queryKey: ["/api/social/feed?tab=foryou"],
    enabled: isAuthenticated,
  });

  const feedItems = useMemo<FeedCard[]>(() => {
    const liveStreams: LiveStream[] = liveQuery.data?.streams ?? [];
    const posts: SocialPost[] = feedQuery.data?.posts ?? [];
    const routes: TrendingRoute[] = trendingQuery.data?.routes ?? [];

    const items: FeedCard[] = [];

    // Always lead with the welcome card
    items.push({ id: "feat-welcome", type: "feature", feature: FEATURE_CARDS[0] });

    // Add live streams first (max 3)
    liveStreams.slice(0, 3).forEach((s, i) => {
      items.push({ id: `live-${i}`, type: "live", liveStream: s });
    });

    // Interleave posts, routes, and feature cards
    const postQ = [...posts];
    const routeQ = [...routes];
    const featureQ = FEATURE_CARDS.slice(1);

    let slot = 0;
    while (items.length < 25) {
      const mod = slot % 5;
      if (mod === 0 && postQ.length) {
        const p = postQ.shift()!;
        items.push({ id: `post-${p.id}`, type: "post", post: p });
      } else if (mod === 1 && routeQ.length) {
        const r = routeQ.shift()!;
        items.push({ id: `route-${r.label}-${slot}`, type: "route", route: r });
      } else if (mod === 2 && postQ.length) {
        const p = postQ.shift()!;
        items.push({ id: `post2-${p.id}`, type: "post", post: p });
      } else if (mod === 3 && featureQ.length) {
        const f = featureQ.shift()!;
        items.push({ id: f.id, type: "feature", feature: f });
      } else if (mod === 4 && postQ.length) {
        const p = postQ.shift()!;
        items.push({ id: `post3-${p.id}`, type: "post", post: p });
      } else if (featureQ.length) {
        const f = featureQ.shift()!;
        items.push({ id: `${f.id}-${slot}`, type: "feature", feature: f });
      } else {
        // Cycle through static features
        const f = FEATURE_CARDS[(slot % FEATURE_CARDS.length) + 1 < FEATURE_CARDS.length
          ? (slot % FEATURE_CARDS.length) + 1 : 0];
        items.push({ id: `feat-cycle-${slot}`, type: "feature", feature: f });
      }
      slot++;
      if (slot > 60) break; // safety
    }

    return items;
  }, [liveQuery.data, feedQuery.data, trendingQuery.data]);

  // ---------------------------------------------------------------------------
  // Auto-advance
  // ---------------------------------------------------------------------------

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressAnim = useSharedValue(0);
  const isUserScrolling = useRef(false);

  const advanceTo = useCallback(
    (nextIdx: number) => {
      const target = nextIdx % feedItems.length;
      setCurrentIndex(target);
      flatListRef.current?.scrollToIndex({ index: target, animated: true });
    },
    [feedItems.length],
  );

  useEffect(() => {
    // Reset and start progress bar
    progressAnim.value = 0;
    progressAnim.value = withTiming(1, { duration: AUTO_ADVANCE_MS - 200 });

    // Schedule auto-advance
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (!isUserScrolling.current) {
        advanceTo(currentIndex + 1);
      }
    }, AUTO_ADVANCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [currentIndex, advanceTo, progressAnim]);

  // ---------------------------------------------------------------------------
  // Reactions
  // ---------------------------------------------------------------------------

  const reactMutation = useMutation({
    mutationFn: ({ postId, type }: { postId: string; type: string }) =>
      apiRequest(`/api/social/posts/${postId}/react`, {
        method: "POST",
        body: JSON.stringify({ type }),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      qc.invalidateQueries({
        predicate: (q) => !!q.queryKey[0]?.toString().startsWith("/api/social"),
      });
    },
  });

  // ---------------------------------------------------------------------------
  // Navigation helpers
  // ---------------------------------------------------------------------------

  const goToAssistant = useCallback(() => {
    navigation.navigate("AssistantHome");
  }, [navigation]);

  const goToSocial = useCallback(() => {
    const parent = navigation.getParent<any>();
    parent?.navigate("SocialTab");
  }, [navigation]);

  const handleCardTap = useCallback(
    (item: FeedCard) => {
      if (item.type === "live") {
        goToSocial();
      } else if (item.type === "post") {
        goToSocial();
      } else if (item.type === "route") {
        goToAssistant();
      } else if (item.type === "feature") {
        const r = item.feature?.ctaRoute;
        if (r === "AssistantHome") goToAssistant();
        else if (r === "Coffee") navigation.navigate("Coffee");
        else if (r === "PrayerRides") navigation.navigate("PrayerRides");
        else if (r === "ScheduledArrivals") navigation.navigate("ScheduledArrivals");
      }
    },
    [goToSocial, goToAssistant, navigation],
  );

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------

  // Bottom inset for cards = safe area + tab bar, so content sits above tab bar
  const cardBottomInset = insets.bottom + TAB_BAR_H + Spacing.md;

  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressAnim.value * 100}%` as any,
  }));

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const renderItem = useCallback(
    ({ item, index }: { item: FeedCard; index: number }) => (
      <View style={{ width: SCREEN_W, height: SCREEN_H }}>
        <HookCard
          item={item}
          bottomInset={cardBottomInset}
          isAuthenticated={isAuthenticated}
          onTap={() => handleCardTap(item)}
          onReact={(type) => {
            if (item.type === "post" && item.post) {
              if (!isAuthenticated) { openLoginSheet(); return; }
              reactMutation.mutate({ postId: item.post.id, type });
            }
          }}
        />
      </View>
    ),
    [cardBottomInset, isAuthenticated, handleCardTap, openLoginSheet, reactMutation],
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({ length: SCREEN_H, offset: SCREEN_H * index, index }),
    [],
  );

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Full-screen vertical pager */}
      <FlatList
        ref={flatListRef}
        data={feedItems}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        getItemLayout={getItemLayout}
        onScrollBeginDrag={() => {
          isUserScrolling.current = true;
          if (timerRef.current) clearTimeout(timerRef.current);
        }}
        onMomentumScrollEnd={(e) => {
          isUserScrolling.current = false;
          const idx = Math.round(e.nativeEvent.contentOffset.y / SCREEN_H);
          setCurrentIndex(idx);
        }}
        windowSize={3}
        maxToRenderPerBatch={3}
        initialNumToRender={2}
      />

      {/* Top chrome — Travony wordmark + progress dots + AI button */}
      <View
        style={[styles.topChrome, { paddingTop: insets.top + Spacing.sm }]}
        pointerEvents="box-none"
      >
        {/* Progress bar row */}
        <View style={styles.progressRow} pointerEvents="none">
          {feedItems.slice(0, Math.min(feedItems.length, 20)).map((item, i) => (
            <View key={item.id} style={styles.progressTrack}>
              {i === currentIndex ? (
                <Animated.View style={[styles.progressFill, progressBarStyle]} />
              ) : (
                <View
                  style={[
                    styles.progressFill,
                    { width: i < currentIndex ? "100%" : "0%" },
                  ]}
                />
              )}
            </View>
          ))}
        </View>

        {/* Logo row */}
        <View style={styles.logoRow} pointerEvents="box-none">
          {/* Wordmark */}
          <ThemedText style={styles.wordmark}>travony</ThemedText>

          {/* Right: AI chat */}
          <Pressable
            onPress={goToAssistant}
            style={styles.aiBtn}
            hitSlop={12}
          >
            <BlurView
              intensity={40}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <Ionicons name="chatbubble-ellipses-outline" size={21} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },

  // Card
  cardRoot: {
    width: SCREEN_W,
    height: SCREEN_H,
    backgroundColor: "#111",
    overflow: "hidden",
  },

  // Live card
  liveAvatarWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  livePulseRing: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 3,
    borderColor: Colors.liveRed,
  },
  liveAvatarInner: {
    borderWidth: 3,
    borderColor: Colors.liveRed,
    borderRadius: 66,
    overflow: "hidden",
  },
  liveBadge: {
    position: "absolute",
    top: 90,
    left: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.liveRed,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 5,
  },
  liveBadgeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#fff",
  },
  liveBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1,
  },
  liveBadgeCount: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
  },

  // Route card
  routeGrid: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.07,
    borderWidth: 1,
    borderColor: "#fff",
  },
  routeBadge: {
    position: "absolute",
    top: 90,
    left: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,80,0,0.9)",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  routeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 1.2,
  },
  routeCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  routeFrom: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginTop: Spacing.lg,
    letterSpacing: -0.5,
  },
  routeTo: {
    fontSize: 26,
    fontWeight: "700",
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: Spacing.xs,
    letterSpacing: -0.3,
  },
  routeStats: {
    fontSize: 15,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginBottom: Spacing.xs,
  },
  bookRouteBtn: {
    marginTop: Spacing.sm,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignSelf: "flex-start",
  },
  bookRouteBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },

  // Feature card
  decoCircle: {
    position: "absolute",
    borderRadius: 1000,
    backgroundColor: "#fff",
  },
  featureCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  featureIconWrap: {
    marginBottom: Spacing.xl,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: {
    fontSize: 30,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.5,
    marginBottom: Spacing.md,
  },
  featureSubtitle: {
    fontSize: 16,
    fontWeight: "400",
    color: "rgba(255,255,255,0.82)",
    textAlign: "center",
    lineHeight: 24,
  },
  featureCta: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    gap: 6,
  },
  featureCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },

  // Right sidebar
  sidebar: {
    position: "absolute",
    right: Spacing.md,
    alignItems: "center",
    gap: Spacing.lg,
  },
  actionBtn: {
    alignItems: "center",
  },
  actionBtnInner: {
    alignItems: "center",
  },
  actionBtnLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
    marginTop: 3,
  },

  // Bottom overlay
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 80,
    paddingHorizontal: Spacing.lg,
  },
  bottomContent: {
    paddingRight: 70,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  authorName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  authorSub: {
    fontSize: 12,
    fontWeight: "400",
    color: "rgba(255,255,255,0.75)",
  },
  timeAgo: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
  },
  caption: {
    fontSize: 14,
    fontWeight: "400",
    color: "rgba(255,255,255,0.9)",
    lineHeight: 20,
  },

  // Top chrome
  topChrome: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  progressRow: {
    flexDirection: "row",
    gap: 3,
    paddingHorizontal: Spacing.xs,
  },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 1,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#fff",
    borderRadius: 1,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
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
});
