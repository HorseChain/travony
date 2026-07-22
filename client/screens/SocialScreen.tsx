import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  Image,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { StatusBadges, type StatusBadge } from "@/components/StatusBadges";
import GiftSheet from "@/components/rewards/GiftSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import type { SocialStackParamList } from "@/navigation/SocialStackNavigator";

type NavigationProp = NativeStackNavigationProp<SocialStackParamList, "Social">;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabKey = "explore" | "following" | "foryou";

const TABS: { key: TabKey; label: string }[] = [
  { key: "explore", label: "Explore" },
  { key: "following", label: "Following" },
  { key: "foryou", label: "For You" },
];

const FEED_KEYS: Record<"following" | "foryou", string> = {
  following: "/api/social/feed?tab=following",
  foryou: "/api/social/feed?tab=foryou",
};

const TOPBAR_CONTENT_HEIGHT = 52;
const UNDERLINE_WIDTH = 28;

const REACTIONS: {
  type: string;
  icon: keyof typeof Ionicons.glyphMap;
  activeIcon: keyof typeof Ionicons.glyphMap;
  color: string;
}[] = [
  { type: "like", icon: "thumbs-up-outline", activeIcon: "thumbs-up", color: Colors.reactionLike },
  { type: "love", icon: "heart-outline", activeIcon: "heart", color: Colors.reactionLove },
  { type: "fire", icon: "flame-outline", activeIcon: "flame", color: Colors.reactionFire },
  { type: "celebrate", icon: "sparkles-outline", activeIcon: "sparkles", color: Colors.reactionCelebrate },
];

interface SocialPost {
  id: string;
  type: "published" | "stream";
  streamProvider: string | null;
  viewerCount?: number;
  caption: string | null;
  photoUrl: string | null;
  cityName: string | null;
  distanceKm: string | null;
  isLive: boolean;
  createdAt: string;
  endedAt: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
  reactions: Record<string, number>;
  reactionCount: number;
  myReaction: string | null;
  commentCount: number;
  badges: StatusBadge[];
}

interface ReactionResult {
  reactions: Record<string, number>;
  reactionCount: number;
  myReaction: string | null;
}

interface Creator {
  id: string;
  name: string;
  avatar: string | null;
  followers: number;
  rides: number;
  photoUrl: string | null;
  cityName: string | null;
  badges: StatusBadge[];
  reason?: string | null;
}

interface TrendingRoute {
  label: string;
  score: number;
  velocity: number;
  rising: boolean;
  driversLive: number;
  openRequests: number;
  peakHour: number | null;
  city: string | null;
  origin?: string;
  destination?: string;
}

interface TrendingPost {
  postId: string;
  label: string;
  score: number;
  city: string | null;
  isLive?: boolean;
  reactions?: number;
  comments?: number;
}

interface TrendingResponse {
  routes: TrendingRoute[];
  posts: TrendingPost[];
  searches: string[];
  updatedAt: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatHour(hour: number | null): string | null {
  if (hour == null) return null;
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const { theme } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.backgroundSecondary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ThemedText style={{ fontWeight: "600", fontSize: size * 0.4 }}>
        {(name || "?").charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Top bar — LIVE | Explore Following For You | Search
// ---------------------------------------------------------------------------

function LiveTvButton({ liveCount, onLive }: { liveCount: number; onLive: () => void }) {
  const { theme } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (liveCount > 0) {
      pulse.value = withRepeat(
        withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })),
        -1,
        false,
      );
    } else {
      pulse.value = 1;
    }
  }, [liveCount, pulse]);

  const pillStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Pressable onPress={onLive} hitSlop={10} style={[styles.topBarIcon, { height: 44, justifyContent: "center", alignItems: "center" }]}>
      <Ionicons name="tv-outline" size={22} color={liveCount > 0 ? Colors.liveRed : theme.text} />
      {liveCount > 0 ? (
        <Animated.View style={[styles.livePill, pillStyle]}>
          <ThemedText style={styles.livePillText}>LIVE</ThemedText>
        </Animated.View>
      ) : null}
    </Pressable>
  );
}

function TopBar({
  tab,
  onTab,
  liveCount,
  onLive,
  onSearch,
}: {
  tab: TabKey;
  onTab: (t: TabKey) => void;
  liveCount: number;
  onLive: () => void;
  onSearch: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [layouts, setLayouts] = useState<Partial<Record<TabKey, { x: number; width: number }>>>({});
  const underlineX = useSharedValue(0);
  const underlineOpacity = useSharedValue(0);

  useEffect(() => {
    const l = layouts[tab];
    if (l) {
      const target = l.x + l.width / 2 - UNDERLINE_WIDTH / 2;
      if (underlineOpacity.value === 0) {
        underlineX.value = target;
        underlineOpacity.value = withTiming(1, { duration: 160 });
      } else {
        underlineX.value = withSpring(target, { damping: 17, stiffness: 230 });
      }
    }
  }, [tab, layouts, underlineX, underlineOpacity]);

  const underlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: underlineX.value }],
    opacity: underlineOpacity.value,
  }));

  return (
    <View
      style={[
        styles.topBar,
        {
          paddingTop: insets.top,
          height: insets.top + TOPBAR_CONTENT_HEIGHT,
          backgroundColor: theme.backgroundRoot,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.topBarRow}>
        <LiveTvButton liveCount={liveCount} onLive={onLive} />

        <View style={styles.tabsWrap}>
          {TABS.map((t) => {
            const active = t.key === tab;
            return (
              <Pressable
                key={t.key}
                onPress={() => onTab(t.key)}
                onLayout={(e) => {
                  const { x, width } = e.nativeEvent.layout;
                  setLayouts((prev) => ({ ...prev, [t.key]: { x, width } }));
                }}
                hitSlop={6}
                style={styles.tabButton}
              >
                <ThemedText
                  style={[
                    styles.tabLabel,
                    active
                      ? { color: theme.text, fontWeight: "700" }
                      : { color: theme.textMuted, fontWeight: "500" },
                  ]}
                >
                  {t.label}
                </ThemedText>
              </Pressable>
            );
          })}
          <Animated.View
            style={[styles.tabUnderline, { backgroundColor: theme.text }, underlineStyle]}
          />
        </View>

        <Pressable onPress={onSearch} hitSlop={10} style={styles.topBarIcon}>
          <Ionicons name="search" size={23} color={theme.text} />
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Live card (horizontal rail)
// ---------------------------------------------------------------------------

function LiveCard({ post, onPress }: { post: SocialPost; onPress: () => void }) {
  const { theme } = useTheme();
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(0.4, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
      false,
    );
  }, [pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <Pressable
      style={({ pressed }) => [
        styles.liveCard,
        { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={styles.liveCardTop}>
        <Avatar uri={post.authorAvatar} name={post.authorName} size={36} />
        <View style={[styles.liveBadge, { backgroundColor: Colors.liveRed }]}>
          <Animated.View style={[styles.liveDot, dotStyle]} />
          <ThemedText style={styles.liveBadgeText}>LIVE</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.liveCardName} numberOfLines={1}>
        {post.authorName}
      </ThemedText>
      <ThemedText style={[styles.liveCardCity, { color: theme.textSecondary }]} numberOfLines={1}>
        {post.cityName ? `Riding in ${post.cityName}` : "On a ride"}
      </ThemedText>
      {(post.viewerCount ?? 0) > 0 ? (
        <ThemedText style={[styles.liveCardCity, { color: theme.textMuted }]} numberOfLines={1}>
          {post.viewerCount} watching
        </ThemedText>
      ) : null}
      <View style={[styles.liveWatchRow, { borderTopColor: theme.border }]}>
        <Ionicons name="play-circle" size={16} color={theme.primary} />
        <ThemedText style={[styles.liveWatchText, { color: theme.primary }]}>Watch live</ThemedText>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Creator cards — TikTok "Trending creators" clone
// ---------------------------------------------------------------------------

function CreatorCard({
  creator,
  followed,
  onFollow,
  onDismiss,
}: {
  creator: Creator;
  followed: boolean;
  onFollow: () => void;
  onDismiss: () => void;
}) {
  const { theme } = useTheme();
  const hasBackdrop = !!creator.photoUrl;
  const textColor = hasBackdrop ? "#FFFFFF" : theme.text;
  const subColor = hasBackdrop ? "rgba(255,255,255,0.75)" : theme.textSecondary;

  return (
    <View style={[styles.creatorCard, { backgroundColor: theme.backgroundDefault }]}>
      {hasBackdrop ? (
        <Image source={{ uri: creator.photoUrl! }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      ) : null}
      {hasBackdrop ? <View style={styles.creatorOverlay} /> : null}

      <Pressable onPress={onDismiss} hitSlop={8} style={styles.creatorDismiss}>
        <Ionicons name="close" size={16} color={hasBackdrop ? "#FFFFFF" : theme.textMuted} />
      </Pressable>

      <View style={styles.creatorContent}>
        <View style={[styles.creatorAvatarRing, { borderColor: hasBackdrop ? "#FFFFFF" : theme.border }]}>
          <Avatar uri={creator.avatar} name={creator.name} size={72} />
        </View>
        <ThemedText style={[styles.creatorName, { color: textColor }]} numberOfLines={1}>
          {creator.name}
        </ThemedText>
        <ThemedText style={[styles.creatorMeta, { color: subColor }]} numberOfLines={1}>
          {[
            creator.followers > 0
              ? `${creator.followers} follower${creator.followers === 1 ? "" : "s"}`
              : null,
            creator.cityName,
          ]
            .filter(Boolean)
            .join(" · ") || "On the Travony network"}
        </ThemedText>
        {creator.reason ? (
          <ThemedText style={[styles.creatorReason, { color: subColor }]} numberOfLines={1}>
            {creator.reason}
          </ThemedText>
        ) : null}
        <View style={styles.creatorBadges}>
          <StatusBadges badges={creator.badges} />
        </View>
        <Pressable
          onPress={followed ? undefined : onFollow}
          style={({ pressed }) => [
            styles.followButton,
            followed
              ? { backgroundColor: "transparent", borderWidth: 1, borderColor: hasBackdrop ? "rgba(255,255,255,0.6)" : theme.border }
              : { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <ThemedText
            style={[
              styles.followButtonText,
              { color: followed ? textColor : theme.textOnPrimary },
            ]}
          >
            {followed ? "Following" : "Follow"}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

function CreatorChip({
  creator,
  followed,
  onFollow,
}: {
  creator: Creator;
  followed: boolean;
  onFollow: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.creatorChip, { backgroundColor: theme.backgroundDefault }]}>
      <Avatar uri={creator.avatar} name={creator.name} size={52} />
      <ThemedText style={styles.creatorChipName} numberOfLines={1}>
        {creator.name}
      </ThemedText>
      <ThemedText style={[styles.creatorChipMeta, { color: theme.textMuted }]} numberOfLines={1}>
        {creator.followers > 0
          ? `${creator.followers} follower${creator.followers === 1 ? "" : "s"}`
          : creator.cityName || "New on Travony"}
      </ThemedText>
      <Pressable
        onPress={followed ? undefined : onFollow}
        style={({ pressed }) => [
          styles.chipFollowButton,
          followed
            ? { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border }
            : { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <ThemedText
          style={[styles.chipFollowText, { color: followed ? theme.text : theme.textOnPrimary }]}
        >
          {followed ? "Following" : "Follow"}
        </ThemedText>
      </Pressable>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Feed card
// ---------------------------------------------------------------------------

function FeedCard({
  post,
  onWatch,
  onReact,
  onOpenComments,
  onGift,
  currentUserId,
  onDelete,
}: {
  post: SocialPost;
  onWatch: () => void;
  onReact: (post: SocialPost, type: string) => void;
  onOpenComments: (post: SocialPost) => void;
  onGift?: (post: SocialPost) => void;
  currentUserId?: string;
  onDelete?: (post: SocialPost) => void;
}) {
  const { theme } = useTheme();
  const isStream = post.type === "stream";
  const streamOver = isStream && (!!post.endedAt || !post.isLive);
  const distance = post.distanceKm ? parseFloat(post.distanceKm) : null;
  const isAuthor = !!currentUserId && currentUserId === post.authorId;

  return (
    <Card style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <Avatar uri={post.authorAvatar} name={post.authorName} size={40} />
        <View style={styles.feedHeaderText}>
          <ThemedText style={styles.feedAuthor}>{post.authorName}</ThemedText>
          <ThemedText style={[styles.feedTime, { color: theme.textMuted }]}>
            {timeAgo(post.createdAt)}
          </ThemedText>
          <StatusBadges badges={post.badges} />
        </View>
        {isStream && post.isLive ? (
          <View style={[styles.liveBadge, { backgroundColor: theme.error }]}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveBadgeText}>LIVE</ThemedText>
          </View>
        ) : null}
        {isAuthor && onDelete ? (
          <Pressable
            hitSlop={10}
            onPress={() => onDelete(post)}
            style={{ paddingLeft: Spacing.sm }}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <Pressable onPress={() => onOpenComments(post)} style={{ flexShrink: 1 }}>
        <View style={styles.feedBody}>
          <View style={[styles.feedIconWrap, { backgroundColor: theme.backgroundSecondary }]}>
            <Ionicons
              name={isStream ? "videocam-outline" : "car-outline"}
              size={18}
              color={theme.primary}
            />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.feedTitle}>
              {isStream
                ? streamOver
                  ? "Streamed a ride"
                  : "Streaming a ride live"
                : "Completed a ride"}
            </ThemedText>
            <ThemedText style={[styles.feedMeta, { color: theme.textSecondary }]}>
              {[post.cityName, distance ? `${distance.toFixed(1)} km` : null]
                .filter(Boolean)
                .join(" · ") || "On the Travony network"}
            </ThemedText>
          </View>
        </View>

        {post.caption ? (
          <ThemedText style={styles.feedCaption}>{post.caption}</ThemedText>
        ) : null}

        {post.photoUrl ? (
          <Image source={{ uri: post.photoUrl }} style={styles.feedPhoto} resizeMode="cover" />
        ) : null}
      </Pressable>

      {isStream && post.isLive ? (
        <Pressable
          style={({ pressed }) => [
            styles.watchButton,
            { backgroundColor: Colors.liveRed, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={onWatch}
        >
          <Ionicons name="play" size={14} color="#fff" />
          <ThemedText style={[styles.watchButtonText, { color: "#fff" }]}>Watch live</ThemedText>
          {(post.viewerCount ?? 0) > 0 ? (
            <ThemedText style={[styles.watchButtonText, { color: "rgba(255,255,255,0.75)", fontSize: 12 }]}>
              · {post.viewerCount} watching
            </ThemedText>
          ) : null}
        </Pressable>
      ) : null}

      <View style={[styles.reactionBar, { borderTopColor: theme.border }]}>
        <View style={styles.reactionRow}>
          {REACTIONS.map((r) => {
            const active = post.myReaction === r.type;
            return (
              <Pressable
                key={r.type}
                style={styles.reactionButton}
                onPress={() => onReact(post, r.type)}
                hitSlop={6}
              >
                <Ionicons
                  name={active ? r.activeIcon : r.icon}
                  size={20}
                  color={active ? r.color : theme.textMuted}
                />
              </Pressable>
            );
          })}
          {post.reactionCount > 0 ? (
            <ThemedText style={[styles.reactionCount, { color: theme.textSecondary }]}>
              {post.reactionCount}
            </ThemedText>
          ) : null}
        </View>

        <View style={styles.reactionRow}>
          {onGift ? (
            <Pressable style={styles.commentButton} onPress={() => onGift(post)} hitSlop={6}>
              <Ionicons name="gift-outline" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
          <Pressable
            style={styles.commentButton}
            onPress={() => onOpenComments(post)}
            hitSlop={6}
          >
            <Ionicons name="chatbubble-outline" size={18} color={theme.textMuted} />
            <ThemedText style={[styles.commentCount, { color: theme.textSecondary }]}>
              {post.commentCount > 0 ? post.commentCount : "Comment"}
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={theme.primary} />
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Explore page — the discovery hub connecting search, trending, live, people
// ---------------------------------------------------------------------------

function ExplorePage({
  topPad,
  bottomPad,
  streams,
  creators,
  followedIds,
  onFollow,
  openStream,
  refreshing,
  onRefresh,
}: {
  topPad: number;
  bottomPad: number;
  streams: SocialPost[];
  creators: Creator[];
  followedIds: Set<string>;
  onFollow: (id: string) => void;
  openStream: (post: SocialPost) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  const trendingQuery = useQuery<TrendingResponse>({
    queryKey: ["/api/trending"],
    staleTime: 60_000,
  });
  const trending = trendingQuery.data;

  const chips = useMemo(() => {
    const list: string[] = [];
    for (const s of trending?.searches || []) {
      if (!list.some((c) => c.toLowerCase() === s.toLowerCase())) list.push(s);
    }
    for (const r of trending?.routes || []) {
      const dest = (r.destination || "").trim();
      if (dest && !list.some((c) => c.toLowerCase() === dest.toLowerCase())) list.push(dest);
    }
    return list.slice(0, 8);
  }, [trending]);

  const routes = (trending?.routes || []).slice(0, 5);
  const posts = (trending?.posts || []).slice(0, 5);
  const nothingYet =
    !trendingQuery.isLoading &&
    chips.length === 0 &&
    routes.length === 0 &&
    posts.length === 0 &&
    streams.length === 0 &&
    creators.length === 0;

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: bottomPad,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || trendingQuery.isRefetching}
          onRefresh={() => {
            trendingQuery.refetch();
            onRefresh();
          }}
          tintColor={theme.primary}
          progressViewOffset={topPad}
        />
      }
    >
      <Pressable
        onPress={() => navigation.navigate("Discover", {})}
        style={({ pressed }) => [
          styles.searchBar,
          { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <ThemedText style={[styles.searchPlaceholder, { color: theme.textMuted }]}>
          Search drivers, routes, places
        </ThemedText>
      </Pressable>

      {chips.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRail}
          contentContainerStyle={styles.chipRailContent}
        >
          {chips.map((c, i) => (
            <Pressable
              key={c}
              onPress={() => navigation.navigate("Discover", { initialQuery: c })}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              {i === 0 ? <Ionicons name="flame" size={13} color={Colors.reactionFire} /> : null}
              <ThemedText style={styles.chipText}>{c}</ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {streams.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader icon="radio-outline" title="Live now" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railContent}
          >
            {streams.map((s) => (
              <LiveCard key={s.id} post={s} onPress={() => openStream(s)} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {creators.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader icon="people-outline" title="Trending creators" />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.railContent}
          >
            {creators.map((c) => (
              <CreatorChip
                key={c.id}
                creator={c}
                followed={followedIds.has(c.id)}
                onFollow={() => onFollow(c.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {routes.length > 0 ? (
        <View style={[styles.section, styles.sectionPadded]}>
          <SectionHeader icon="trending-up-outline" title="Hot routes right now" />
          {routes.map((r, i) => {
            const peak = formatHour(r.peakHour);
            const meta = [
              r.driversLive > 0 ? `${r.driversLive} drivers live` : null,
              r.openRequests > 0 ? `${r.openRequests} looking now` : null,
              peak ? `Peak ${peak}` : null,
              r.city,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Pressable
                key={r.label}
                onPress={() =>
                  navigation.navigate("Discover", {
                    initialQuery: (r.destination || r.label).trim(),
                  })
                }
                style={({ pressed }) => [
                  styles.routeRow,
                  { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <ThemedText style={[styles.routeRank, { color: theme.textMuted }]}>
                  {i + 1}
                </ThemedText>
                <View style={{ flex: 1 }}>
                  <ThemedText style={styles.routeLabel} numberOfLines={1}>
                    {r.origin && r.destination ? `${r.origin} → ${r.destination}` : r.label}
                  </ThemedText>
                  {meta ? (
                    <ThemedText style={[styles.routeMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {meta}
                    </ThemedText>
                  ) : null}
                </View>
                {r.rising ? (
                  <View style={[styles.risingPill, { backgroundColor: theme.primary + "22" }]}>
                    <Ionicons name="arrow-up" size={11} color={theme.primary} />
                    <ThemedText style={[styles.risingText, { color: theme.primary }]}>
                      Rising
                    </ThemedText>
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                )}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {posts.length > 0 ? (
        <View style={[styles.section, styles.sectionPadded]}>
          <SectionHeader icon="chatbubbles-outline" title="Talked about" />
          {posts.map((p) => (
            <Pressable
              key={p.postId}
              onPress={() => navigation.navigate("PostComments", { postId: p.postId })}
              style={({ pressed }) => [
                styles.routeRow,
                { borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <View style={[styles.talkedIcon, { backgroundColor: theme.backgroundSecondary }]}>
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={theme.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.routeLabel} numberOfLines={1}>
                  {p.label}
                </ThemedText>
                <ThemedText style={[styles.routeMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                  {[
                    p.city,
                    p.reactions ? `${p.reactions} reactions` : null,
                    p.comments ? `${p.comments} comments` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Join the conversation"}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={[styles.section, styles.sectionPadded]}>
        <Pressable
          onPress={() => navigation.navigate("Memories")}
          style={({ pressed }) => [
            styles.memoriesTile,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.talkedIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Ionicons name="images-outline" size={16} color={theme.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <ThemedText style={styles.routeLabel}>Ride Memories</ThemedText>
            <ThemedText style={[styles.routeMeta, { color: theme.textSecondary }]}>
              Your private timeline of every ride
            </ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </Pressable>
      </View>

      {nothingYet ? (
        <View style={styles.emptyState}>
          <Ionicons name="compass-outline" size={48} color={theme.textMuted} />
          <ThemedText style={styles.emptyTitle}>The network is warming up</ThemedText>
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Trending routes, live rides and creators appear here as the
            community moves.
          </ThemedText>
        </View>
      ) : null}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Feed pages (Following / For You)
// ---------------------------------------------------------------------------

function FeedPage({
  tab,
  topPad,
  bottomPad,
  posts,
  isLoading,
  refreshing,
  onRefresh,
  onReact,
  openStream,
  openComments,
  onGift,
  currentUserId,
  onDelete,
  creators,
  followedIds,
  onFollow,
  dismissedIds,
  onDismiss,
  goExplore,
}: {
  tab: "following" | "foryou";
  topPad: number;
  bottomPad: number;
  posts: SocialPost[];
  isLoading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onReact: (post: SocialPost, type: string) => void;
  openStream: (post: SocialPost) => void;
  openComments: (post: SocialPost) => void;
  onGift: (post: SocialPost) => void;
  currentUserId?: string;
  onDelete: (post: SocialPost) => void;
  creators: Creator[];
  followedIds: Set<string>;
  onFollow: (id: string) => void;
  dismissedIds: Set<string>;
  onDismiss: (id: string) => void;
  goExplore: () => void;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const visibleCreators = creators.filter((c) => !dismissedIds.has(c.id));

  const followingEmpty = (
    <View style={styles.trendingCreatorsWrap}>
      <ThemedText style={styles.trendingCreatorsTitle}>Trending creators</ThemedText>
      <ThemedText style={[styles.trendingCreatorsSub, { color: theme.textSecondary }]}>
        Follow an account to see their latest rides here.
      </ThemedText>
      {visibleCreators.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.creatorCarousel}
          snapToInterval={246}
          decelerationRate="fast"
        >
          {visibleCreators.map((c) => (
            <CreatorCard
              key={c.id}
              creator={c}
              followed={followedIds.has(c.id)}
              onFollow={() => onFollow(c.id)}
              onDismiss={() => onDismiss(c.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={44} color={theme.textMuted} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            Ride with the community and the people you meet appear here.
          </ThemedText>
        </View>
      )}
    </View>
  );

  const forYouEmpty = (
    <View style={styles.emptyState}>
      <Ionicons name="planet-outline" size={48} color={theme.textMuted} />
      <ThemedText style={styles.emptyTitle}>Nothing on the network yet</ThemedText>
      <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
        When riders and drivers publish or stream rides, the best of the
        network shows up here.
      </ThemedText>
      <Pressable
        onPress={goExplore}
        style={({ pressed }) => [
          styles.exploreCta,
          { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <ThemedText style={[styles.exploreCtaText, { color: theme.textOnPrimary }]}>
          Explore Travony
        </ThemedText>
      </Pressable>
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: topPad,
        paddingBottom: bottomPad,
        paddingHorizontal: Spacing.lg,
        flexGrow: 1,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
          progressViewOffset={topPad}
        />
      }
      renderItem={({ item }) => (
        <FeedCard
          post={item}
          onWatch={() => openStream(item)}
          onReact={onReact}
          onOpenComments={openComments}
          onGift={currentUserId && item.authorId === currentUserId ? undefined : onGift}
          currentUserId={currentUserId}
          onDelete={onDelete}
        />
      )}
      ListFooterComponent={
        tab === "following" && posts.length > 0 && visibleCreators.length > 0 ? (
          <View style={styles.footerSuggested}>
            <SectionHeader icon="person-add-outline" title="Suggested for you" />
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingRight: Spacing.lg }}
            >
              {visibleCreators.map((c) => (
                <CreatorChip
                  key={c.id}
                  creator={c}
                  followed={followedIds.has(c.id)}
                  onFollow={() => onFollow(c.id)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null
      }
      ListEmptyComponent={
        isLoading ? null : tab === "following" ? followingEmpty : forYouEmpty
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { liteMode } = useLiteMode();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<TabKey>("foryou");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [giftPost, setGiftPost] = useState<SocialPost | null>(null);

  const topPad = insets.top + TOPBAR_CONTENT_HEIGHT + Spacing.lg;
  const bottomPad = tabBarHeight + Spacing.xl;

  const feedTab: "following" | "foryou" = tab === "following" ? "following" : "foryou";
  const feedQuery = useQuery<{ posts: SocialPost[] }>({
    queryKey: [FEED_KEYS[feedTab]],
    refetchInterval: litePollMs(45000, liteMode),
  });
  const liveQuery = useQuery<{ streams: SocialPost[] }>({
    queryKey: ["/api/social/live"],
    refetchInterval: litePollMs(30000, liteMode),
  });
  const suggestedQuery = useQuery<{ creators: Creator[] }>({
    queryKey: ["/api/social/suggested-creators"],
    staleTime: 300_000,
  });

  // Patch a single post across both feed caches without refetching (posts can
  // carry base64 photos, so a full invalidate would re-download everything).
  const patchPost = (postId: string, patch: Partial<SocialPost>) => {
    for (const key of [FEED_KEYS.following, FEED_KEYS.foryou]) {
      queryClient.setQueryData<{ posts: SocialPost[] }>([key], (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          posts: prev.posts.map((p) => (p.id === postId ? { ...p, ...patch } : p)),
        };
      });
    }
  };

  const reactMutation = useMutation({
    mutationFn: async ({ post, type }: { post: SocialPost; type: string }) => {
      const remove = post.myReaction === type;
      return apiRequest(`/api/social/posts/${post.id}/react`, {
        method: remove ? "DELETE" : "POST",
        body: remove ? undefined : JSON.stringify({ type }),
        headers: remove ? undefined : { "Content-Type": "application/json" },
      }) as Promise<ReactionResult>;
    },
    onSuccess: (result, { post }) => {
      if (result) patchPost(post.id, result);
    },
    onError: (_error, { post }) => {
      patchPost(post.id, {
        reactions: post.reactions,
        myReaction: post.myReaction,
        reactionCount: post.reactionCount,
      });
    },
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) =>
      apiRequest(`/api/social/follow/${userId}`, { method: "POST" }),
    onSuccess: (_result, userId) => {
      queryClient.invalidateQueries({ queryKey: [FEED_KEYS.following] });
    },
    onError: (_error, userId) => {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    },
  });

  const handleFollow = (userId: string) => {
    setFollowedIds((prev) => new Set(prev).add(userId));
    followMutation.mutate(userId);
  };

  const handleDismiss = (userId: string) => {
    setDismissedIds((prev) => new Set(prev).add(userId));
    // Teach the match agent — fire and forget.
    apiRequest("/api/match/feedback", {
      method: "POST",
      body: JSON.stringify({ candidateId: userId, action: "dismiss" }),
      headers: { "Content-Type": "application/json" },
    }).catch(() => {});
  };

  const posts = feedQuery.data?.posts || [];
  const streams = liveQuery.data?.streams || [];
  const creators = suggestedQuery.data?.creators || [];

  const openStream = (post: SocialPost) => {
    navigation.navigate("AgoraStreamViewer", {
      postId: post.id,
      name: post.authorName,
    });
  };

  const handleReact = (post: SocialPost, type: string) => {
    const wasActive = post.myReaction === type;
    const reactions = { ...post.reactions };
    if (post.myReaction) reactions[post.myReaction] = Math.max(0, (reactions[post.myReaction] || 0) - 1);
    let myReaction: string | null = null;
    if (!wasActive) {
      reactions[type] = (reactions[type] || 0) + 1;
      myReaction = type;
    }
    const reactionCount = Object.values(reactions).reduce((a, b) => a + b, 0);
    patchPost(post.id, { reactions, myReaction, reactionCount });
    reactMutation.mutate({ post, type });
  };

  const openComments = (post: SocialPost) => {
    navigation.navigate("PostComments", { postId: post.id });
  };

  const handleGift = (post: SocialPost) => {
    if (user?.id && post.authorId === user.id) return;
    setGiftPost(post);
  };

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) =>
      apiRequest(`/api/social/posts/${postId}`, { method: "DELETE" }),
    onSuccess: (_result, postId) => {
      for (const key of [FEED_KEYS.following, FEED_KEYS.foryou]) {
        queryClient.setQueryData<{ posts: SocialPost[] }>([key], (prev) => {
          if (!prev) return prev;
          return { ...prev, posts: prev.posts.filter((p) => p.id !== postId) };
        });
      }
    },
  });

  const handleDelete = (post: SocialPost) => {
    Alert.alert("Delete post", "Remove this post from your feed?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => deleteMutation.mutate(post.id),
      },
    ]);
  };

  const onLivePress = () => {
    if (streams.length > 0) {
      openStream(streams[0]);
    } else {
      setTab("explore");
    }
  };

  const refreshFeed = () => {
    feedQuery.refetch();
    liveQuery.refetch();
    suggestedQuery.refetch();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      {tab === "explore" ? (
        <Animated.View key="explore" entering={FadeIn.duration(200)} style={{ flex: 1 }}>
          <ExplorePage
            topPad={topPad}
            bottomPad={bottomPad}
            streams={streams}
            creators={creators.filter((c) => !dismissedIds.has(c.id))}
            followedIds={followedIds}
            onFollow={handleFollow}
            openStream={openStream}
            refreshing={liveQuery.isRefetching || suggestedQuery.isRefetching}
            onRefresh={refreshFeed}
          />
        </Animated.View>
      ) : (
        <Animated.View key={feedTab} entering={FadeIn.duration(200)} style={{ flex: 1 }}>
          <FeedPage
            tab={feedTab}
            topPad={topPad}
            bottomPad={bottomPad}
            posts={posts}
            isLoading={feedQuery.isLoading}
            refreshing={feedQuery.isRefetching}
            onRefresh={refreshFeed}
            onReact={handleReact}
            openStream={openStream}
            openComments={openComments}
            onGift={handleGift}
            currentUserId={user?.id}
            onDelete={handleDelete}
            creators={creators}
            followedIds={followedIds}
            onFollow={handleFollow}
            dismissedIds={dismissedIds}
            onDismiss={handleDismiss}
            goExplore={() => setTab("explore")}
          />
        </Animated.View>
      )}

      <TopBar
        tab={tab}
        onTab={setTab}
        liveCount={streams.length}
        onLive={onLivePress}
        onSearch={() => navigation.navigate("Discover", {})}
      />

      <GiftSheet
        visible={!!giftPost}
        onClose={() => setGiftPost(null)}
        postId={giftPost?.id}
        recipientName={giftPost?.authorName}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topBarRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
  },
  topBarIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  livePill: {
    backgroundColor: Colors.liveRed,
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    marginTop: 2,
  },
  livePillText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  tabsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
    height: "100%",
  },
  tabButton: {
    height: "100%",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 16,
    letterSpacing: 0.1,
  },
  tabUnderline: {
    position: "absolute",
    bottom: 6,
    left: 0,
    width: UNDERLINE_WIDTH,
    height: 3,
    borderRadius: 2,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    paddingHorizontal: Spacing.md,
    height: 42,
    borderRadius: BorderRadius.md,
  },
  searchPlaceholder: {
    ...Typography.body,
  },
  chipRail: {
    marginTop: Spacing.md,
  },
  chipRailContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.md,
    height: 32,
    borderRadius: 16,
  },
  chipText: {
    ...Typography.smallBold,
  },
  section: {
    marginTop: Spacing.xl,
  },
  sectionPadded: {
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.md,
    paddingHorizontal: 0,
  },
  sectionTitle: {
    ...Typography.h4,
  },
  railContent: {
    paddingHorizontal: Spacing.lg,
  },
  liveCard: {
    width: 150,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginRight: Spacing.md,
  },
  liveCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.light.textOnPrimary,
  },
  liveBadgeText: {
    ...Typography.captionBold,
    color: Colors.light.textOnPrimary,
  },
  liveCardName: {
    ...Typography.bodyBold,
  },
  liveCardCity: {
    ...Typography.small,
    marginTop: 2,
  },
  liveWatchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  liveWatchText: {
    ...Typography.smallBold,
  },
  creatorCard: {
    width: 230,
    height: 320,
    borderRadius: BorderRadius.lg,
    marginRight: Spacing.lg,
    overflow: "hidden",
  },
  creatorOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  creatorDismiss: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    zIndex: 2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  creatorContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  creatorAvatarRing: {
    borderWidth: 2,
    borderRadius: 40,
    padding: 2,
  },
  creatorName: {
    ...Typography.h4,
    marginTop: Spacing.md,
    textAlign: "center",
  },
  creatorMeta: {
    ...Typography.small,
    marginTop: 3,
    textAlign: "center",
  },
  creatorReason: {
    ...Typography.small,
    fontSize: 11,
    marginTop: 2,
    textAlign: "center",
  },
  creatorBadges: {
    marginTop: Spacing.sm,
    alignItems: "center",
  },
  followButton: {
    marginTop: Spacing.lg,
    height: 42,
    minWidth: 150,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  followButtonText: {
    ...Typography.bodyBold,
  },
  creatorChip: {
    width: 140,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginRight: Spacing.md,
    alignItems: "center",
  },
  creatorChipName: {
    ...Typography.bodyBold,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  creatorChipMeta: {
    ...Typography.caption,
    marginTop: 2,
    textAlign: "center",
  },
  chipFollowButton: {
    marginTop: Spacing.sm,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
    alignSelf: "stretch",
  },
  chipFollowText: {
    ...Typography.smallBold,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routeRank: {
    ...Typography.h3,
    width: 24,
    textAlign: "center",
  },
  routeLabel: {
    ...Typography.bodyMediumMedium,
  },
  routeMeta: {
    ...Typography.small,
    marginTop: 1,
  },
  risingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  risingText: {
    ...Typography.captionBold,
  },
  talkedIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  memoriesTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  trendingCreatorsWrap: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
  trendingCreatorsTitle: {
    ...Typography.h3,
    textAlign: "center",
  },
  trendingCreatorsSub: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.xs,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  creatorCarousel: {
    paddingHorizontal: Spacing.sm,
  },
  footerSuggested: {
    marginTop: Spacing.md,
  },
  feedCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  feedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  feedHeaderText: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  feedAuthor: {
    ...Typography.bodyBold,
  },
  feedTime: {
    ...Typography.small,
    marginTop: 1,
  },
  feedBody: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
  },
  feedIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  feedTitle: {
    ...Typography.bodyMediumMedium,
  },
  feedMeta: {
    ...Typography.small,
    marginTop: 1,
  },
  feedCaption: {
    ...Typography.body,
    marginTop: Spacing.md,
  },
  feedPhoto: {
    width: "100%",
    height: 200,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  reactionBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reactionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  reactionButton: {
    padding: 2,
  },
  reactionCount: {
    ...Typography.smallBold,
    marginLeft: Spacing.xs,
  },
  commentButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  commentCount: {
    ...Typography.smallBold,
  },
  watchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 40,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  watchButtonText: {
    ...Typography.bodyBold,
    color: Colors.light.textOnPrimary,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h4,
    marginTop: Spacing.lg,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  exploreCta: {
    marginTop: Spacing.xl,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  exploreCtaText: {
    ...Typography.bodyBold,
  },
});
