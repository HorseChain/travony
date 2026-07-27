import React, { useLayoutEffect } from "react";
import { View, StyleSheet, FlatList, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography } from "@/constants/theme";

interface FollowUser {
  id: string;
  name: string;
  avatar: string | null;
}

export default function FollowListScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mode: "followers" | "following" = route.params?.mode === "following" ? "following" : "followers";

  useLayoutEffect(() => {
    navigation.setOptions({ headerTitle: mode === "following" ? "Following" : "Followers" });
  }, [navigation, mode]);

  const listQuery = useQuery<{ users: FollowUser[] }>({
    queryKey: [`/api/social/${mode}`],
  });

  const usersList = listQuery.data?.users || [];

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={usersList}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: Spacing.xl,
          paddingBottom: tabBarInset + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: tabBarInset }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: theme.backgroundDefault }]}>
                <Ionicons name="person-outline" size={20} color={theme.primary} />
              </View>
            )}
            <View style={styles.info}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {item.name}
              </ThemedText>
            </View>
          </View>
        )}
        ListEmptyComponent={
          listQuery.isLoading ? null : (
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={44} color={theme.textMuted} />
              <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                {mode === "following"
                  ? "You aren't following anyone yet"
                  : "No followers yet — share a ride to get noticed"}
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
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  name: {
    ...Typography.bodyMedium,
  },
  meta: {
    ...Typography.small,
    marginTop: 2,
  },
  empty: {
    alignItems: "center",
    paddingTop: Spacing["5xl"],
    gap: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
  },
  emptyText: {
    ...Typography.bodySmall,
    textAlign: "center",
  },
});
