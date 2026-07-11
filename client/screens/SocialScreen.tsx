import React from "react";
import { View, StyleSheet, FlatList, Pressable, RefreshControl, ScrollView, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useLiteMode, litePollMs } from "@/hooks/useLiteMode";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { SocialStackParamList } from "@/navigation/SocialStackNavigator";

type NavigationProp = NativeStackNavigationProp<SocialStackParamList, "Social">;

interface SocialPost {
  id: string;
  type: "published" | "stream";
  twitchChannel: string | null;
  caption: string | null;
  cityName: string | null;
  distanceKm: string | null;
  isLive: boolean;
  createdAt: string;
  endedAt: string | null;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
}

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

function LiveCard({ post, onPress }: { post: SocialPost; onPress: () => void }) {
  const { theme } = useTheme();
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
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <ThemedText style={styles.liveBadgeText}>LIVE</ThemedText>
        </View>
      </View>
      <ThemedText style={styles.liveCardName} numberOfLines={1}>
        {post.authorName}
      </ThemedText>
      <ThemedText style={[styles.liveCardCity, { color: theme.textSecondary }]} numberOfLines={1}>
        {post.cityName ? `Riding in ${post.cityName}` : "On a ride"}
      </ThemedText>
    </Pressable>
  );
}

function FeedCard({ post, onWatch }: { post: SocialPost; onWatch: () => void }) {
  const { theme } = useTheme();
  const isStream = post.type === "stream";
  const streamOver = isStream && (!!post.endedAt || !post.isLive);
  const distance = post.distanceKm ? parseFloat(post.distanceKm) : null;

  return (
    <Card style={styles.feedCard}>
      <View style={styles.feedHeader}>
        <Avatar uri={post.authorAvatar} name={post.authorName} size={40} />
        <View style={styles.feedHeaderText}>
          <ThemedText style={styles.feedAuthor}>{post.authorName}</ThemedText>
          <ThemedText style={[styles.feedTime, { color: theme.textMuted }]}>
            {timeAgo(post.createdAt)}
          </ThemedText>
        </View>
        {isStream && post.isLive ? (
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <ThemedText style={styles.liveBadgeText}>LIVE</ThemedText>
          </View>
        ) : null}
      </View>

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

      {isStream && post.isLive && post.twitchChannel ? (
        <Pressable
          style={({ pressed }) => [
            styles.watchButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={onWatch}
        >
          <Ionicons name="play" size={14} color="#FFFFFF" />
          <ThemedText style={styles.watchButtonText}>Watch live</ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function SocialScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { liteMode } = useLiteMode();

  const feedQuery = useQuery<{ posts: SocialPost[] }>({
    queryKey: ["/api/social/feed"],
    refetchInterval: litePollMs(45000, liteMode),
  });
  const liveQuery = useQuery<{ streams: SocialPost[] }>({
    queryKey: ["/api/social/live"],
    refetchInterval: litePollMs(30000, liteMode),
  });

  const posts = feedQuery.data?.posts || [];
  const streams = liveQuery.data?.streams || [];
  const refreshing = feedQuery.isRefetching || liveQuery.isRefetching;

  const openStream = (post: SocialPost) => {
    if (!post.twitchChannel) return;
    navigation.navigate("StreamViewer", {
      channel: post.twitchChannel,
      name: post.authorName,
    });
  };

  return (
    <FlatList
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
      data={posts}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            feedQuery.refetch();
            liveQuery.refetch();
          }}
          tintColor={theme.primary}
        />
      }
      ListHeaderComponent={
        <View>
          {streams.length > 0 ? (
            <View style={styles.liveSection}>
              <ThemedText style={styles.sectionTitle}>Live now</ThemedText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {streams.map((s) => (
                  <LiveCard key={s.id} post={s} onPress={() => openStream(s)} />
                ))}
              </ScrollView>
            </View>
          ) : null}
          {posts.length > 0 ? (
            <ThemedText style={styles.sectionTitle}>Feed</ThemedText>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <FeedCard post={item} onWatch={() => openStream(item)} />}
      ListEmptyComponent={
        feedQuery.isLoading ? null : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={theme.textMuted} />
            <ThemedText style={styles.emptyTitle}>Your network starts here</ThemedText>
            <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
              Follow the people you ride with. When they publish or stream a
              ride, it shows up here.
            </ThemedText>
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  liveSection: {
    marginBottom: Spacing.xl,
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
    backgroundColor: "#E91916",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FFFFFF",
  },
  liveBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  liveCardName: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  liveCardCity: {
    ...Typography.small,
    marginTop: 2,
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
    ...Typography.bodyMedium,
    fontWeight: "600",
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
    ...Typography.bodyMedium,
    fontWeight: "500",
  },
  feedMeta: {
    ...Typography.small,
    marginTop: 1,
  },
  feedCaption: {
    ...Typography.body,
    marginTop: Spacing.md,
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
    ...Typography.bodyMedium,
    fontWeight: "600",
    color: "#FFFFFF",
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
});
