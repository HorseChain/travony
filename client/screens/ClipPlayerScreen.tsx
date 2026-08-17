import React from "react";
import { View, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { WebView } from "react-native-webview";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import { Spacing } from "@/constants/theme";

// Plays a highlight clip. Video playback runs through a WebView (the public
// /clip/:id page) — same pattern as WebViewMap — so no new native module is
// needed. Accepts either a clipId directly or a feed post id to resolve.
export default function ClipPlayerScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { clipId, feedPostId, previewToken } = route.params || {};

  const resolveQuery = useQuery<any>({
    queryKey: [`/api/stream-clips/by-feed-post/${feedPostId}`],
    enabled: !clipId && !!feedPostId,
  });

  const id = clipId || resolveQuery.data?.id;
  const pageUrl = id
    ? new URL(
        `/clip/${id}${previewToken ? `?pt=${encodeURIComponent(previewToken)}` : ""}`,
        getApiUrl(),
      ).toString()
    : null;

  return (
    <View style={[styles.container, { backgroundColor: "#0a0a12" }]}>
      {pageUrl ? (
        <WebView
          source={{ uri: pageUrl }}
          style={{ flex: 1, backgroundColor: "#0a0a12" }}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.centered]}>
              <ActivityIndicator color={theme.primary} size="large" />
            </View>
          )}
        />
      ) : resolveQuery.isError ? (
        <View style={[styles.centered, { flex: 1 }]}>
          <Ionicons name="film-outline" size={40} color="#666" />
          <ThemedText style={{ color: "#aaa", marginTop: Spacing.md }}>
            This clip is no longer available.
          </ThemedText>
        </View>
      ) : (
        <View style={[styles.centered, { flex: 1 }]}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      )}
      <Pressable
        onPress={() => navigation.goBack()}
        style={[styles.closeButton, { top: insets.top + Spacing.md }]}
        hitSlop={10}
      >
        <Ionicons name="close" size={22} color="#fff" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  closeButton: {
    position: "absolute",
    right: Spacing.lg,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
});
