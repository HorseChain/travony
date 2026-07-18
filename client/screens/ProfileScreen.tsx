import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Share,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { StatusBadges, type StatusBadge } from "@/components/StatusBadges";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import QRCodeSheet from "@/components/profile/QRCodeSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "Profile">;

const TIKTOK_CYAN = "#20D5EC";
const LIVE_RED = "#FE2C55";

interface SocialCounts {
  followers: number;
  following: number;
  likes: number;
  posts: number;
  bio: string | null;
  handle: string | null;
}

interface ProfilePost {
  id: string;
  type: "published" | "stream";
  caption: string | null;
  photoUrl: string | null;
  cityName: string | null;
  distanceKm: string | null;
  isLive: boolean;
  reactionCount: number;
}

function formatCount(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<"posts" | "liked">("posts");
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  const countsQuery = useQuery<SocialCounts>({
    queryKey: ["/api/social/counts"],
    enabled: !!user,
  });

  const badgesQuery = useQuery<{ badges: StatusBadge[] }>({
    queryKey: ["/api/social/badges", user?.id],
    enabled: !!user?.id,
  });

  const myPostsQuery = useQuery<{ posts: ProfilePost[] }>({
    queryKey: ["/api/social/my-posts"],
    enabled: !!user,
  });

  const likedPostsQuery = useQuery<{ posts: ProfilePost[] }>({
    queryKey: ["/api/social/liked-posts"],
    enabled: !!user && activeTab === "liked",
  });

  const walletQuery = useQuery<{ balance: string }>({
    queryKey: [`/api/wallet/balance/${user?.id}`],
    enabled: !!user?.id,
  });

  const counts = countsQuery.data;
  const posts = activeTab === "posts" ? myPostsQuery.data?.posts : likedPostsQuery.data?.posts;
  const postsLoading = activeTab === "posts" ? myPostsQuery.isLoading : likedPostsQuery.isLoading;

  const tileWidth = (width - Spacing.lg * 2 - 4) / 3;

  const openPost = (postId: string) => {
    (navigation as any).getParent()?.navigate("SocialTab", {
      screen: "PostComments",
      params: { postId },
    });
  };

  const handleShareProfile = async () => {
    try {
      const handlePart = counts?.handle ? ` (@${counts.handle})` : "";
      await Share.share({
        message: `Follow ${user?.name || "me"}${handlePart} on Travony. ${getApiUrl()}`,
      });
    } catch {}
  };

  const tasks = [
    {
      key: "photo",
      done: !!user?.avatar,
      icon: "person-circle-outline" as const,
      title: "Add profile photo",
      subtitle: "Help friends recognise you",
      onPress: () => navigation.navigate("EditProfile"),
    },
    {
      key: "bio",
      done: !!counts?.bio,
      icon: "create-outline" as const,
      title: "Add a bio",
      subtitle: "Tell people about yourself",
      onPress: () => navigation.navigate("EditProfile"),
    },
    {
      key: "post",
      done: (counts?.posts ?? 0) > 0,
      icon: "share-social-outline" as const,
      title: "Share a ride",
      subtitle: "Publish your first ride",
      onPress: () => (navigation as any).getParent()?.navigate("SocialTab"),
    },
  ];
  const doneCount = tasks.filter((t) => t.done).length;
  const pendingTasks = tasks.filter((t) => !t.done);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable hitSlop={8} onPress={() => navigation.navigate("FindFriends")}>
          <Ionicons name="person-add-outline" size={24} color={theme.text} />
        </Pressable>
        <View style={styles.topBarRight}>
          <Pressable hitSlop={8} onPress={handleShareProfile}>
            <Ionicons name="arrow-redo-outline" size={24} color={theme.text} />
          </Pressable>
          <Pressable hitSlop={8} onPress={() => setSidebarVisible(true)}>
            <Ionicons name="menu-outline" size={28} color={theme.text} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: tabBarHeight + Spacing.xl }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.avatarWrap}>
            {user?.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="person-outline" size={44} color={theme.primary} />
              </View>
            )}
            <Pressable
              style={[styles.plusBadge, { borderColor: theme.backgroundRoot }]}
              onPress={() => navigation.navigate("EditProfile")}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          <View style={styles.nameRow}>
            <Pressable style={styles.namePressable} onPress={() => navigation.navigate("EditProfile")}>
              <ThemedText style={styles.name}>{user?.name || "Add name"}</ThemedText>
              <Ionicons name="chevron-down-outline" size={16} color={theme.textSecondary} />
            </Pressable>
            <View style={[styles.nameDivider, { backgroundColor: theme.border }]} />
            <Pressable
              style={[styles.editPill, { borderColor: theme.border }]}
              onPress={() => navigation.navigate("EditProfile")}
            >
              <ThemedText style={styles.editPillText}>Edit</ThemedText>
            </Pressable>
          </View>

          {counts?.handle ? (
            <ThemedText style={[styles.handle, { color: theme.textMuted }]}>
              @{counts.handle}
            </ThemedText>
          ) : null}

          <View style={styles.statsRow}>
            <Pressable
              style={styles.stat}
              onPress={() => navigation.navigate("FollowList", { mode: "following" })}
            >
              <ThemedText style={styles.statValue}>
                {formatCount(counts?.following ?? 0)}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
                Following
              </ThemedText>
            </Pressable>
            <Pressable
              style={styles.stat}
              onPress={() => navigation.navigate("FollowList", { mode: "followers" })}
            >
              <ThemedText style={styles.statValue}>
                {formatCount(counts?.followers ?? 0)}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>
                Followers
              </ThemedText>
            </Pressable>
            <View style={styles.stat}>
              <ThemedText style={styles.statValue}>{formatCount(counts?.likes ?? 0)}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textMuted }]}>Likes</ThemedText>
            </View>
          </View>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => navigation.navigate("EditProfile")}
            >
              <ThemedText style={styles.actionButtonText}>Edit profile</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={handleShareProfile}
            >
              <ThemedText style={styles.actionButtonText}>Share profile</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.qrButton, { backgroundColor: theme.backgroundDefault }]}
              onPress={() => setQrVisible(true)}
            >
              <Ionicons name="qr-code-outline" size={18} color={theme.text} />
            </Pressable>
          </View>

          <Pressable style={styles.bioWrap} onPress={() => navigation.navigate("EditProfile")}>
            {counts?.bio ? (
              <ThemedText style={styles.bioText}>{counts.bio}</ThemedText>
            ) : (
              <ThemedText style={[styles.addBio, { color: theme.textMuted }]}>+ Add bio</ThemedText>
            )}
          </Pressable>

          <StatusBadges badges={badgesQuery.data?.badges} size="md" />
        </View>

        {pendingTasks.length > 0 ? (
          <View style={styles.completeSection}>
            <View style={styles.completeHeader}>
              <ThemedText style={styles.completeTitle}>Complete your profile</ThemedText>
              <ThemedText style={[styles.completeCount, { color: theme.textMuted }]}>
                {doneCount}/4 completed
              </ThemedText>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.completeCards}
            >
              {pendingTasks.map((task) => (
                <View
                  key={task.key}
                  style={[styles.completeCard, { backgroundColor: theme.backgroundElevated }]}
                >
                  <View style={[styles.completeIcon, { backgroundColor: theme.backgroundDefault }]}>
                    <Ionicons name={task.icon} size={22} color={theme.primary} />
                  </View>
                  <ThemedText style={styles.completeCardTitle} numberOfLines={1}>
                    {task.title}
                  </ThemedText>
                  <ThemedText
                    style={[styles.completeCardSubtitle, { color: theme.textMuted }]}
                    numberOfLines={2}
                  >
                    {task.subtitle}
                  </ThemedText>
                  <Pressable
                    style={[styles.completeCta, { backgroundColor: LIVE_RED }]}
                    onPress={task.onPress}
                  >
                    <ThemedText style={styles.completeCtaText}>
                      {task.key === "post" ? "Share" : "Add"}
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={[styles.tabsRow, { borderBottomColor: theme.border }]}>
          <Pressable style={styles.tab} onPress={() => setActiveTab("posts")}>
            <Ionicons
              name="grid-outline"
              size={22}
              color={activeTab === "posts" ? theme.text : theme.textMuted}
            />
            {activeTab === "posts" ? (
              <View style={[styles.tabIndicator, { backgroundColor: theme.text }]} />
            ) : null}
          </Pressable>
          <Pressable style={styles.tab} onPress={() => setActiveTab("liked")}>
            <Ionicons
              name={activeTab === "liked" ? "heart" : "heart-outline"}
              size={22}
              color={activeTab === "liked" ? theme.text : theme.textMuted}
            />
            {activeTab === "liked" ? (
              <View style={[styles.tabIndicator, { backgroundColor: theme.text }]} />
            ) : null}
          </Pressable>
        </View>

        <View style={styles.grid}>
          {(posts || []).map((post) => (
            <Pressable
              key={post.id}
              style={[
                styles.tile,
                { width: tileWidth, backgroundColor: theme.backgroundElevated },
              ]}
              onPress={() => openPost(post.id)}
            >
              {post.photoUrl ? (
                <Image source={{ uri: post.photoUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
              ) : (
                <View style={styles.tilePlaceholder}>
                  <Ionicons name="car-outline" size={22} color={theme.textMuted} />
                  {post.cityName ? (
                    <ThemedText style={[styles.tileCity, { color: theme.textSecondary }]} numberOfLines={1}>
                      {post.cityName}
                    </ThemedText>
                  ) : null}
                  {post.distanceKm ? (
                    <ThemedText style={[styles.tileKm, { color: theme.textMuted }]}>
                      {parseFloat(post.distanceKm).toFixed(1)} km
                    </ThemedText>
                  ) : null}
                </View>
              )}
              {post.isLive ? (
                <View style={[styles.livePill, { backgroundColor: LIVE_RED }]}>
                  <ThemedText style={styles.livePillText}>LIVE</ThemedText>
                </View>
              ) : null}
              <View style={styles.tileFooter}>
                <Ionicons name="heart" size={12} color="#FFFFFF" />
                <ThemedText style={styles.tileLikes}>{post.reactionCount}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        {!postsLoading && (posts || []).length === 0 ? (
          <View style={styles.emptyPosts}>
            <Ionicons
              name={activeTab === "posts" ? "videocam-outline" : "heart-outline"}
              size={44}
              color={theme.textMuted}
            />
            <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
              {activeTab === "posts"
                ? "Share your first ride to start your profile"
                : "Rides you like will appear here"}
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>

      <ProfileSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        balanceTitle="Balance"
        balanceValue={walletQuery.data?.balance ? `AED ${walletQuery.data.balance}` : null}
        onBalance={() => {
          setSidebarVisible(false);
          setTimeout(() => (navigation as any).getParent()?.navigate("WalletTab"), 250);
        }}
        onRewards={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("Rewards"), 250);
        }}
        onActivity={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("ActivityCentre"), 250);
        }}
        onQRCode={() => {
          setSidebarVisible(false);
          setTimeout(() => setQrVisible(true), 250);
        }}
        onSettings={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("Settings"), 250);
        }}
        onTravonyAI={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("TravonyAI"), 250);
        }}
      />

      <QRCodeSheet visible={qrVisible} onClose={() => setQrVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  topBarRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.lg,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  plusBadge: {
    position: "absolute",
    bottom: 0,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: TIKTOK_CYAN,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.md,
  },
  namePressable: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  name: {
    ...Typography.h4,
  },
  nameDivider: {
    width: 1,
    height: 16,
  },
  editPill: {
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  editPillText: {
    ...Typography.bodySmallMedium,
  },
  handle: {
    ...Typography.bodySmall,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    gap: Spacing["3xl"],
  },
  stat: {
    alignItems: "center",
  },
  statValue: {
    ...Typography.bodyBold,
  },
  statLabel: {
    ...Typography.small,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  actionButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  actionButtonText: {
    ...Typography.bodySmallMedium,
  },
  qrButton: {
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: BorderRadius.sm,
  },
  bioWrap: {
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  bioText: {
    ...Typography.bodySmall,
    textAlign: "center",
  },
  addBio: {
    ...Typography.bodySmall,
  },
  completeSection: {
    marginTop: Spacing["2xl"],
  },
  completeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  completeTitle: {
    ...Typography.bodyMedium,
  },
  completeCount: {
    ...Typography.small,
  },
  completeCards: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  completeCard: {
    width: 150,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: "center",
  },
  completeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  completeCardTitle: {
    ...Typography.bodySmallMedium,
    textAlign: "center",
  },
  completeCardSubtitle: {
    ...Typography.small,
    textAlign: "center",
    marginTop: 2,
    minHeight: 28,
  },
  completeCta: {
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  completeCtaText: {
    ...Typography.bodySmallMedium,
    color: "#FFFFFF",
  },
  tabsRow: {
    flexDirection: "row",
    marginTop: Spacing["2xl"],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    width: 44,
    height: 2,
    borderRadius: 1,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.lg,
    paddingTop: 2,
    gap: 2,
  },
  tile: {
    aspectRatio: 3 / 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  tilePlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.sm,
    gap: 2,
  },
  tileCity: {
    ...Typography.small,
    textAlign: "center",
  },
  tileKm: {
    ...Typography.small,
  },
  livePill: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  livePillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tileFooter: {
    position: "absolute",
    bottom: 4,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tileLikes: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  emptyPosts: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.bodySmall,
    textAlign: "center",
  },
});
