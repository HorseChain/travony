import React, { useState } from "react";
import { View, StyleSheet, Pressable, TextInput, ActivityIndicator, Alert, Platform, Linking } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";

export interface RideSocialContext {
  counterpart: {
    id: string;
    name: string;
    avatar: string | null;
    twitchChannel: string | null;
    isFollowing: boolean;
  } | null;
  myTwitchChannel: string | null;
  isStreaming: boolean;
  hasPublished: boolean;
}

export function useRideSocialContext(rideId: string | undefined) {
  return useQuery<RideSocialContext>({
    queryKey: [`/api/rides/${rideId}/social-context`],
    enabled: !!rideId,
  });
}

function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function confirmDialog(title: string, message: string, confirmText: string, onConfirm: () => void) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) {
      onConfirm();
    }
  } else {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: confirmText, onPress: onConfirm },
    ]);
  }
}

async function openTwitchBroadcast() {
  if (Platform.OS === "web") {
    return;
  }
  try {
    // Jumps straight to the Twitch app's mobile Go Live (camera) screen.
    await Linking.openURL("twitch://broadcast");
  } catch {
    try {
      // Twitch app not installed — universal link opens the app if present,
      // otherwise the Twitch site where the app can be installed.
      await Linking.openURL("https://www.twitch.tv/");
    } catch {
      // Nothing we can open; the ride is still marked live on the feed.
    }
  }
}

function invalidateSocial(queryClient: ReturnType<typeof useQueryClient>, rideId: string) {
  queryClient.invalidateQueries({ queryKey: [`/api/rides/${rideId}/social-context`] });
  queryClient.invalidateQueries({ queryKey: ["/api/social/feed"] });
  queryClient.invalidateQueries({ queryKey: ["/api/social/live"] });
  queryClient.invalidateQueries({ queryKey: ["/api/social/counts"] });
}

export function FollowCounterpartButton({ rideId }: { rideId: string }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { data } = useRideSocialContext(rideId);

  const followMutation = useMutation({
    mutationFn: async ({ userId, unfollow }: { userId: string; unfollow: boolean }) => {
      return apiRequest(`/api/social/follow/${userId}`, {
        method: unfollow ? "DELETE" : "POST",
      });
    },
    onSuccess: () => invalidateSocial(queryClient, rideId),
    onError: (error: any) => {
      notify("Error", error.message || "Could not update follow");
    },
  });

  if (!data?.counterpart) return null;
  const { counterpart } = data;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.followButton,
        counterpart.isFollowing
          ? { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, borderWidth: 1 }
          : { backgroundColor: theme.primary },
        { opacity: pressed || followMutation.isPending ? 0.8 : 1 },
      ]}
      onPress={() =>
        followMutation.mutate({ userId: counterpart.id, unfollow: counterpart.isFollowing })
      }
      disabled={followMutation.isPending}
    >
      <Ionicons
        name={counterpart.isFollowing ? "checkmark" : "person-add-outline"}
        size={15}
        color={counterpart.isFollowing ? theme.text : Colors.light.textOnPrimary}
      />
      <ThemedText
        style={[
          styles.followButtonText,
          { color: counterpart.isFollowing ? theme.text : Colors.light.textOnPrimary },
        ]}
      >
        {counterpart.isFollowing ? "Following" : `Follow ${counterpart.name.split(" ")[0]}`}
      </ThemedText>
    </Pressable>
  );
}

export function StreamRideButton({ rideId, rideStatus }: { rideId: string; rideStatus?: string }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data } = useRideSocialContext(rideId);
  const linkChannelHint =
    user?.role === "driver"
      ? "Link your Twitch channel first: open the Profile tab, tap Personal Information, enter your Twitch username, and save. Then you can stream your rides live from here."
      : "Link your Twitch channel first: open the Profile tab, tap Edit Profile, enter your Twitch username, and save. Then you can stream your rides live from here.";

  const streamMutation = useMutation({
    mutationFn: async (action: "start" | "stop") => {
      return apiRequest(`/api/rides/${rideId}/stream/${action}`, { method: "POST" });
    },
    onSuccess: (_data, action) => {
      invalidateSocial(queryClient, rideId);
      if (action === "start") {
        openTwitchBroadcast();
      }
    },
    onError: (error: any) => {
      notify("Streaming", error.message || "Could not update the stream");
    },
  });

  const streamable = ["accepted", "arriving", "started", "in_progress"].includes(rideStatus || "");
  if (!data || !streamable) return null;

  if (!data.myTwitchChannel) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.streamButton,
          {
            backgroundColor: theme.backgroundSecondary,
            borderWidth: 1,
            borderColor: theme.border,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        onPress={() => notify("Go Live on Twitch", linkChannelHint)}
      >
        <Ionicons name="videocam-outline" size={16} color={theme.textMuted} />
        <ThemedText style={[styles.streamButtonText, { color: theme.textSecondary }]}>
          Go Live on Twitch · Link your channel
        </ThemedText>
      </Pressable>
    );
  }

  if (data.isStreaming) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.streamButton,
          { backgroundColor: Colors.liveRed, opacity: pressed || streamMutation.isPending ? 0.8 : 1 },
        ]}
        onPress={() => streamMutation.mutate("stop")}
        disabled={streamMutation.isPending}
      >
        {streamMutation.isPending ? (
          <ActivityIndicator color={Colors.light.textOnPrimary} size="small" />
        ) : (
          <>
            <View style={styles.liveDot} />
            <ThemedText style={styles.streamButtonText}>Live on Twitch · Stop sharing</ThemedText>
          </>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.streamButton,
        {
          backgroundColor: theme.backgroundSecondary,
          borderWidth: 1,
          borderColor: theme.border,
          opacity: pressed || streamMutation.isPending ? 0.8 : 1,
        },
      ]}
      onPress={() =>
        confirmDialog(
          "Go Live on Twitch",
          `This shares your ride on the Travony feed as live on Twitch (${data.myTwitchChannel}) and opens the Twitch camera so you can start broadcasting.`,
          "Go Live",
          () => streamMutation.mutate("start"),
        )
      }
      disabled={streamMutation.isPending}
    >
      {streamMutation.isPending ? (
        <ActivityIndicator color={theme.primary} size="small" />
      ) : (
        <>
          <Ionicons name="videocam-outline" size={16} color={theme.primary} />
          <ThemedText style={[styles.streamButtonText, { color: theme.text }]}>
            Go Live on Twitch
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

// In-app live streaming (Agora) — broadcasts inside Travony instead of via
// the Twitch app. Shown alongside the Twitch button on active ride screens;
// the GoLive screen itself handles permissions, native-module availability
// and the stream lifecycle.
export function GoLiveInAppButton({ rideId, rideStatus }: { rideId: string; rideStatus?: string }) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();

  const streamable = ["accepted", "arriving", "started", "in_progress"].includes(rideStatus || "");
  if (!streamable || Platform.OS === "web") return null;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.streamButton,
        {
          backgroundColor: theme.backgroundSecondary,
          borderWidth: 1,
          borderColor: theme.border,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
      onPress={() => navigation.navigate("GoLive", { rideId })}
    >
      <Ionicons name="radio-outline" size={16} color={Colors.liveRed} />
      <ThemedText style={[styles.streamButtonText, { color: theme.text }]}>
        Go Live on Travony
      </ThemedText>
    </Pressable>
  );
}

export function PublishRideCard({ rideId, rideStatus }: { rideId: string; rideStatus?: string }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { data } = useRideSocialContext(rideId);
  const [caption, setCaption] = useState("");

  const publishMutation = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/rides/${rideId}/publish`, {
        method: "POST",
        body: JSON.stringify({ caption: caption.trim() || null }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      invalidateSocial(queryClient, rideId);
      notify("Published", "Your ride is now on the feed.");
    },
    onError: (error: any) => {
      notify("Publish", error.message || "Could not publish this ride");
    },
  });

  if (!data || rideStatus !== "completed") return null;

  if (data.hasPublished) {
    return (
      <View style={[styles.publishedBanner, { backgroundColor: theme.backgroundSecondary }]}>
        <Ionicons name="checkmark-circle-outline" size={18} color={theme.primary} />
        <ThemedText style={[styles.publishedText, { color: theme.textSecondary }]}>
          This ride is on your feed
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.publishSection}>
      <ThemedText style={styles.publishTitle}>Share this ride</ThemedText>
      <TextInput
        style={[
          styles.captionInput,
          { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border },
        ]}
        placeholder="Add a caption (optional)"
        placeholderTextColor={theme.textMuted}
        value={caption}
        onChangeText={(t) => setCaption(t.slice(0, 280))}
        multiline
      />
      <Pressable
        style={({ pressed }) => [
          styles.publishButton,
          { backgroundColor: theme.primary, opacity: pressed || publishMutation.isPending ? 0.8 : 1 },
        ]}
        onPress={() => publishMutation.mutate()}
        disabled={publishMutation.isPending}
      >
        {publishMutation.isPending ? (
          <ActivityIndicator color={Colors.light.textOnPrimary} size="small" />
        ) : (
          <>
            <Ionicons name="megaphone-outline" size={16} color={Colors.light.textOnPrimary} />
            <ThemedText style={styles.publishButtonText}>Publish to feed</ThemedText>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  followButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 38,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.lg,
    alignSelf: "flex-start",
  },
  followButtonText: {
    ...Typography.bodyBold,
  },
  streamButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  streamButtonText: {
    ...Typography.bodyBold,
    color: Colors.light.textOnPrimary,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.light.textOnPrimary,
  },
  publishSection: {
    marginTop: Spacing.lg,
  },
  publishTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  captionInput: {
    minHeight: 70,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    padding: Spacing.md,
    ...Typography.body,
    textAlignVertical: "top",
  },
  publishButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 44,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  publishedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.lg,
  },
  publishedText: {
    ...Typography.bodyMedium,
  },
  publishButtonText: {
    ...Typography.bodyBold,
    color: Colors.light.textOnPrimary,
  },
});
