/**
 * TravonyTVScreen — full-screen WebView showing Travony TV.
 *
 * One channel, the city's best live rides, auto-directed by AI. The page is
 * served by the server at /tv; the URL is derived from the same base the app
 * uses for every API request (getApiUrl) so it always points at the right
 * environment — never a hardcoded domain.
 *
 * Watch-to-earn: the TV page authenticates its credit/heartbeat calls via
 * localStorage("travonyWebToken"). On native we hand the app's own session
 * token to the page with injectedJavaScriptBeforeContentLoaded (runs before
 * the page's scripts, same-app WebView — never a token in the URL), so a
 * signed-in rider earns credits in the app exactly like on the web. On the
 * web platform we render a plain iframe (react-native-webview doesn't run
 * there); in production the app and /tv share an origin, so the page uses
 * whatever web session already exists.
 */

import React, { useEffect, useMemo, useState } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator, StatusBar, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Spacing, Typography } from "@/constants/theme";
import { getApiUrl, getAuthToken } from "@/lib/query-client";
import type { HomeStackParamList } from "@/navigation/HomeStackNavigator";

const TV_BG = "#0B0B14";

export default function TravonyTVScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList>>();
  const [loading, setLoading] = useState(true);
  // undefined = still reading storage; string | null = resolved.
  const [token, setToken] = useState<string | null | undefined>(
    Platform.OS === "web" ? null : undefined,
  );

  // Derive the TV page URL from the app's shared API base (never hardcoded).
  const tvUrl = useMemo(() => new URL("/tv", getApiUrl()).href, []);

  useEffect(() => {
    if (Platform.OS === "web") return;
    let alive = true;
    getAuthToken()
      .then((t) => {
        if (alive) setToken(t ?? null);
      })
      .catch(() => {
        if (alive) setToken(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Runs before the page's own scripts so its first credit/heartbeat calls
  // are already authenticated. JSON.stringify guarantees safe embedding.
  const injectAuth = token
    ? `try { localStorage.setItem("travonyWebToken", ${JSON.stringify(token)}); } catch (e) {} true;`
    : undefined;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Slim header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.xs }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.closeBtn}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close Travony TV"
        >
          <Ionicons name="chevron-down" size={24} color="#fff" />
        </Pressable>
        <ThemedText style={styles.title}>Travony TV</ThemedText>
        <View style={styles.closeBtn} />
      </View>

      <View style={styles.webWrap}>
        {Platform.OS === "web" ? (
          React.createElement("iframe", {
            src: tvUrl,
            style: { border: 0, width: "100%", height: "100%", backgroundColor: TV_BG },
            allow: "autoplay; fullscreen",
            onLoad: () => setLoading(false),
          })
        ) : token !== undefined ? (
          <WebView
            source={{ uri: tvUrl }}
            style={styles.webview}
            onLoadEnd={() => setLoading(false)}
            injectedJavaScriptBeforeContentLoaded={injectAuth}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            originWhitelist={["*"]}
            startInLoadingState
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
          />
        ) : null}
        {loading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="large" color="#fff" />
            <ThemedText style={styles.loadingText}>Loading Travony TV…</ThemedText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: TV_BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: TV_BG,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...Typography.h4, color: "#fff" },
  webWrap: { flex: 1, backgroundColor: TV_BG },
  webview: { flex: 1, backgroundColor: TV_BG },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: TV_BG,
    gap: Spacing.md,
  },
  loadingText: { ...Typography.bodyMedium, color: "rgba(255,255,255,0.7)" },
});
