import React from "react";
import { View, StyleSheet, ActivityIndicator, Platform } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { RideConversation } from "@/components/RideChat";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface ActiveRideConversation {
  id: string;
  status: string;
  myRole: "customer" | "driver";
  otherPartyName: string;
}

export default function MessagesScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();

  const { data: active, isLoading, refetch } = useQuery<ActiveRideConversation | null>({
    queryKey: ["/api/me/active-ride"],
    enabled: !!user?.id,
    refetchInterval: 8000,
  });

  // Re-check for a live trip whenever the screen comes into focus so the chat
  // appears as soon as a ride is matched.
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) refetch();
    }, [user?.id, refetch]),
  );

  // iOS uses a transparent header (content slides under it); Android's header is
  // opaque, so content already starts below it.
  const topInset = Platform.OS === "ios" ? headerHeight : 0;

  if (isLoading) {
    return (
      <ThemedView style={[styles.center, { paddingTop: topInset }]}>
        <ActivityIndicator color={theme.primary} />
      </ThemedView>
    );
  }

  if (active?.id && user?.id) {
    return (
      <ThemedView style={styles.flex}>
        <RideConversation
          rideId={active.id}
          myUserId={user.id}
          otherPartyName={active.otherPartyName}
          embedded
          topInset={topInset}
          bottomInset={tabBarHeight}
          keyboardOffset={Platform.OS === "ios" ? headerHeight : 0}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.center, { paddingTop: topInset, paddingBottom: tabBarHeight }]}>
      <View style={[styles.iconCircle, { backgroundColor: theme.card }]}>
        <Ionicons name="chatbubbles-outline" size={36} color={theme.primary} />
      </View>
      <ThemedText style={styles.emptyTitle}>No active conversation</ThemedText>
      <ThemedText style={[styles.emptyBody, { color: theme.textSecondary }]}>
        Messaging opens up during a trip. As soon as you're matched, you and the
        other person can chat right here — your messages are translated
        automatically into each other's language.
      </ThemedText>
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
    marginBottom: Spacing.lg,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.sm },
  emptyBody: { fontSize: 14, lineHeight: 21, textAlign: "center" },
});
