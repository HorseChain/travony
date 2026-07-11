import React from "react";
import { View, StyleSheet, Pressable, Platform, Linking } from "react-native";
import { WebView } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useRoute, type RouteProp } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { SocialStackParamList } from "@/navigation/SocialStackNavigator";

type StreamViewerRoute = RouteProp<SocialStackParamList, "StreamViewer">;

export default function StreamViewerScreen() {
  const route = useRoute<StreamViewerRoute>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  let tabBarHeight = 0;
  try {
    tabBarHeight = useBottomTabBarHeight();
  } catch {
    tabBarHeight = insets.bottom;
  }
  const { theme } = useTheme();
  const { channel } = route.params;

  const twitchUrl = `https://m.twitch.tv/${encodeURIComponent(channel)}`;

  const openInTwitch = async () => {
    try {
      await Linking.openURL(`https://twitch.tv/${encodeURIComponent(channel)}`);
    } catch {
      // Nothing else we can do — the button stays available to retry.
    }
  };

  if (Platform.OS === "web") {
    return (
      <ThemedView style={[styles.container, styles.webFallback, { paddingTop: headerHeight + Spacing.xl }]}>
        <Ionicons name="videocam-outline" size={48} color={theme.primary} />
        <ThemedText style={styles.webFallbackTitle}>Watch on Twitch</ThemedText>
        <ThemedText style={[styles.webFallbackText, { color: theme.textSecondary }]}>
          Streams open directly on Twitch when using the web version.
        </ThemedText>
        <Pressable
          style={({ pressed }) => [styles.openButton, { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 }]}
          onPress={openInTwitch}
        >
          <ThemedText style={styles.openButtonText}>Open {channel} on Twitch</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <WebView
        source={{ uri: twitchUrl }}
        style={[styles.webview, { marginTop: headerHeight }]}
        allowsFullscreenVideo
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        startInLoadingState
      />
      <Pressable
        style={({ pressed }) => [
          styles.floatingButton,
          {
            backgroundColor: theme.backgroundDefault,
            bottom: tabBarHeight + Spacing.xl,
            opacity: pressed ? 0.8 : 1,
          },
        ]}
        onPress={openInTwitch}
      >
        <Ionicons name="open-outline" size={16} color={theme.primary} />
        <ThemedText style={[styles.floatingButtonText, { color: theme.primary }]}>Open in Twitch</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  webFallback: {
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
  },
  webFallbackTitle: {
    ...Typography.h3,
    marginTop: Spacing.lg,
  },
  webFallbackText: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  openButton: {
    paddingHorizontal: Spacing.xl,
    height: 48,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  openButtonText: {
    ...Typography.button,
    color: "#FFFFFF",
  },
  floatingButton: {
    position: "absolute",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    height: 40,
    borderRadius: 20,
  },
  floatingButtonText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
});
