import React from "react";
import { View, StyleSheet, FlatList, Image, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

interface ActivityItem {
  id: string;
  kind: "follow" | "reaction" | "comment";
  user: { id: string; name: string; avatar: string | null };
  reaction?: string;
  body?: string;
  postId?: string;
  cityName?: string | null;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

const KIND_META: Record<
  ActivityItem["kind"],
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  follow: { icon: "person-add", color: "#20D5EC" },
  reaction: { icon: "heart", color: "#FE2C55" },
  comment: { icon: "chatbubble", color: "#5B8DEF" },
};

function activityText(item: ActivityItem): string {
  if (item.kind === "follow") return "started following you";
  if (item.kind === "reaction") {
    return item.cityName ? `reacted to your ride in ${item.cityName}` : "reacted to your ride";
  }
  return item.body ? `commented: ${item.body}` : "commented on your ride";
}

export default function ActivityCentreScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<any>();

  const activityQuery = useQuery<{ items: ActivityItem[] }>({
    queryKey: ["/api/social/activity"],
  });

  const items = activityQuery.data?.items || [];

  const openPost = (item: ActivityItem) => {
    if (!item.postId) return;
    const socialTab = user?.role === "driver" ? "DriverSocialTab" : "SocialTab";
    navigation.getParent()?.navigate(socialTab, {
      screen: "PostComments",
      params: { postId: item.postId },
    });
  };

  const renderItem = ({ item }: { item: ActivityItem }) => {
    const meta = KIND_META[item.kind];
    return (
      <Pressable
        style={({ pressed }) => [styles.row, { opacity: pressed && item.postId ? 0.7 : 1 }]}
        onPress={() => openPost(item)}
        disabled={!item.postId}
      >
        <View style={styles.avatarWrap}>
          {item.user.avatar ? (
            <Image source={{ uri: item.user.avatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.backgroundDefault }]}>
              <Ionicons name="person-outline" size={20} color={theme.primary} />
            </View>
          )}
          <View style={[styles.kindBadge, { backgroundColor: meta.color }]}>
            <Ionicons name={meta.icon} size={10} color="#FFFFFF" />
          </View>
        </View>
        <View style={styles.rowContent}>
          <ThemedText style={styles.rowText} numberOfLines={2}>
            <ThemedText style={styles.rowName}>{item.user.name}</ThemedText>
            {" "}
            {activityText(item)}
          </ThemedText>
          <ThemedText style={[styles.rowTime, { color: theme.textMuted }]}>
            {timeAgo(item.createdAt)}
          </ThemedText>
        </View>
        {item.postId ? (
          <Ionicons name="chevron-forward-outline" size={18} color={theme.textMuted} />
        ) : null}
      </Pressable>
    );
  };

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingTop: Spacing.xl,
          paddingBottom: tabBarInset + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: tabBarInset }}
        ListEmptyComponent={
          activityQuery.isLoading ? null : (
            <View style={styles.empty}>
              <Ionicons name="pulse-outline" size={44} color={theme.textMuted} />
              <ThemedText style={[styles.emptyTitle, { color: theme.textSecondary }]}>
                Nothing here yet
              </ThemedText>
              <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                New followers, reactions and comments on your rides will show up here
              </ThemedText>
            </View>
          )
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  kindBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  rowContent: {
    flex: 1,
  },
  rowText: {
    ...Typography.bodySmall,
  },
  rowName: {
    ...Typography.bodySmallMedium,
  },
  rowTime: {
    ...Typography.small,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.md,
  },
  emptyTitle: {
    ...Typography.bodyBold,
  },
  emptyText: {
    ...Typography.bodySmall,
    textAlign: "center",
  },
});
