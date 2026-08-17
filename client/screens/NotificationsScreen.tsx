import React, { useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  useNotificationInbox,
  type AppNotification,
} from "@/hooks/useNotifications";

const KIND_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  autopilot_position: "navigate-outline",
  autopilot_onboarding: "document-text-outline",
  autopilot_reengage: "car-outline",
  autopilot_ride_update: "time-outline",
  autopilot_report: "stats-chart-outline",
  ride_update: "car-sport-outline",
  system: "information-circle-outline",
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { notifications, unreadCount, isLoading, refetch, markAllRead } =
    useNotificationInbox();

  const topInset = Platform.OS === "ios" ? headerHeight : 0;
  const markedOnce = useRef(false);

  // Opening the inbox clears the unread state (after a beat so the user sees
  // which items were new).
  useFocusEffect(
    useCallback(() => {
      markedOnce.current = false;
      const t = setTimeout(() => {
        if (!markedOnce.current && unreadCount > 0) {
          markedOnce.current = true;
          markAllRead.mutate();
        }
      }, 1500);
      return () => clearTimeout(t);
    }, [unreadCount]),
  );

  if (isLoading) {
    return (
      <ThemedView style={[styles.center, { paddingTop: topInset }]}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (notifications.length === 0) {
    return (
      <ThemedView style={[styles.center, { paddingTop: topInset }]}>
        <View style={[styles.iconCircle, { backgroundColor: theme.card }]}>
          <Ionicons
            name="notifications-outline"
            size={36}
            color={theme.primary}
          />
        </View>
        <ThemedText style={styles.emptyTitle}>You're all caught up</ThemedText>
        <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
          Ride updates, earning tips, and messages from Travony will land here.
        </ThemedText>
      </ThemedView>
    );
  }

  const renderItem = ({ item }: { item: AppNotification }) => {
    const unread = !item.readAt;
    return (
      <View
        style={[
          styles.item,
          {
            backgroundColor: unread ? theme.card : "transparent",
            borderColor: theme.border,
          },
        ]}
      >
        <View style={[styles.itemIcon, { backgroundColor: theme.backgroundElevated }]}>
          <Ionicons
            name={KIND_ICON[item.kind] ?? "notifications-outline"}
            size={20}
            color={theme.primary}
          />
        </View>
        <View style={styles.itemBody}>
          <View style={styles.itemHeader}>
            <ThemedText style={styles.itemTitle} numberOfLines={2}>
              {item.title}
            </ThemedText>
            <ThemedText style={[styles.itemTime, { color: theme.textMuted }]}>
              {timeAgo(item.createdAt)}
            </ThemedText>
          </View>
          <ThemedText
            style={[styles.itemText, { color: theme.textSecondary }]}
            numberOfLines={3}
          >
            {item.body}
          </ThemedText>
        </View>
        {unread ? (
          <View style={[styles.unreadDot, { backgroundColor: theme.primary }]} />
        ) : null}
      </View>
    );
  };

  return (
    <ThemedView style={styles.flex}>
      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingTop: topInset + Spacing.md,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.md,
        }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={refetch}
            tintColor={theme.primary}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: 17, fontWeight: "600", marginBottom: Spacing.xs },
  emptyBody: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  itemBody: { flex: 1 },
  itemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  itemTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  itemTime: { fontSize: 12, marginTop: 2 },
  itemText: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: Spacing.xs,
    marginTop: 6,
  },
});
