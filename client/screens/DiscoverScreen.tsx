import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { SocialStackParamList } from "@/navigation/SocialStackNavigator";

type NavigationProp = NativeStackNavigationProp<SocialStackParamList, "Discover">;

interface TrendingRoute {
  label: string;
  score: number;
  velocity: number;
  rising: boolean;
  driversLive: number;
  openRequests: number;
  peakHour: number | null;
  city: string | null;
  origin?: string;
  destination?: string;
}

interface TrendingPost {
  postId: string;
  label: string;
  score: number;
  city: string | null;
  isLive?: boolean;
  reactions?: number;
  comments?: number;
}

interface TrendingResponse {
  routes: TrendingRoute[];
  posts: TrendingPost[];
  searches: string[];
  updatedAt: string | null;
}

interface SearchDriver {
  userId: string;
  name: string;
  avatar: string | null;
  rating: string | null;
  totalTrips: number | null;
  isOnline: boolean | null;
  followers: number;
}

interface SearchRoute {
  routeKey: string;
  origin: string;
  destination: string;
  tripsLast7d: number;
  city: string | null;
  peakHour: number | null;
}

interface SearchPost {
  id: string;
  caption: string | null;
  cityName: string | null;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
  reactions: number;
}

interface SearchHub {
  id: string;
  name: string;
  type: string;
  address: string | null;
  regionCode: string | null;
  isEvHub: boolean;
}

interface SearchResponse {
  queryId: string | null;
  drivers: SearchDriver[];
  routes: SearchRoute[];
  posts: SearchPost[];
  hubs: SearchHub[];
  trendingSearches: string[];
}

function formatHour(hour: number | null): string | null {
  if (hour == null) return null;
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}${hour < 12 ? "am" : "pm"}`;
}

function logClick(queryId: string | null, resultId: string, resultType: string) {
  if (!queryId) return;
  apiRequest("/api/search/click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queryId, resultId, resultType }),
  }).catch(() => {});
}

function SmallAvatar({ uri, name }: { uri: string | null; name: string }) {
  const { theme } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={styles.avatar} />;
  }
  return (
    <View style={[styles.avatar, { backgroundColor: theme.backgroundSecondary, alignItems: "center", justifyContent: "center" }]}>
      <ThemedText style={{ fontWeight: "600" }}>{(name || "?").charAt(0).toUpperCase()}</ThemedText>
    </View>
  );
}

export default function DiscoverScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setQuery(input.trim()), 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [input]);

  const trendingQuery = useQuery<TrendingResponse>({
    queryKey: ["/api/trending"],
    staleTime: 60_000,
  });

  const searchActive = query.length >= 2;
  const searchQuery = useQuery<SearchResponse>({
    queryKey: [`/api/search?q=${encodeURIComponent(query)}`],
    enabled: searchActive,
    staleTime: 30_000,
  });

  const trending = trendingQuery.data;
  const results = searchQuery.data;
  const queryId = results?.queryId ?? null;

  const hasResults = useMemo(() => {
    if (!results) return false;
    return (
      results.drivers.length > 0 ||
      results.routes.length > 0 ||
      results.posts.length > 0 ||
      results.hubs.length > 0
    );
  }, [results]);

  const openHub = (hub: SearchHub) => {
    logClick(queryId, hub.id, "hub");
    navigation.navigate("HubDetail", { hubId: hub.id, hubName: hub.name });
  };

  const openPost = (postId: string, fromSearch: boolean) => {
    if (fromSearch) logClick(queryId, postId, "post");
    navigation.navigate("PostComments", { postId });
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
        <Ionicons name="search" size={18} color={theme.textMuted} />
        <TextInput
          ref={inputRef}
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search routes, drivers, places..."
          placeholderTextColor={theme.textMuted}
          value={input}
          onChangeText={setInput}
          autoFocus
          autoCorrect={false}
          returnKeyType="search"
        />
        {input.length > 0 ? (
          <Pressable onPress={() => setInput("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={theme.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {searchActive ? (
        <View>
          {searchQuery.isLoading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} color={theme.primary} />
          ) : !hasResults ? (
            <View style={styles.emptyState}>
              <Ionicons name="search-outline" size={40} color={theme.textMuted} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                Nothing found for "{query}"
              </ThemedText>
              {results && results.trendingSearches.length > 0 ? (
                <View style={styles.chipRow}>
                  {results.trendingSearches.map((term) => (
                    <Pressable
                      key={term}
                      style={[styles.chip, { backgroundColor: theme.backgroundDefault }]}
                      onPress={() => setInput(term)}
                    >
                      <Ionicons name="trending-up" size={13} color={theme.primary} />
                      <ThemedText style={styles.chipText}>{term}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View>
              {results!.routes.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Routes</ThemedText>
                  {results!.routes.map((r) => (
                    <Pressable
                      key={r.routeKey}
                      onPress={() => logClick(queryId, r.routeKey, "route")}
                    >
                      <Card style={styles.resultCard}>
                        <View style={[styles.iconWrap, { backgroundColor: theme.backgroundSecondary }]}>
                          <Ionicons name="navigate-outline" size={18} color={theme.primary} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.resultTitle} numberOfLines={1}>
                            {r.origin} → {r.destination}
                          </ThemedText>
                          <ThemedText style={[styles.resultMeta, { color: theme.textSecondary }]}>
                            {[
                              `${r.tripsLast7d} trips this week`,
                              formatHour(r.peakHour) ? `peaks ${formatHour(r.peakHour)}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </ThemedText>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {results!.drivers.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Drivers</ThemedText>
                  {results!.drivers.map((d) => (
                    <Pressable key={d.userId} onPress={() => logClick(queryId, d.userId, "driver")}>
                      <Card style={styles.resultCard}>
                        <SmallAvatar uri={d.avatar} name={d.name} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.driverNameRow}>
                            <ThemedText style={styles.resultTitle} numberOfLines={1}>
                              {d.name}
                            </ThemedText>
                            {d.isOnline ? (
                              <View style={[styles.onlineDot, { backgroundColor: theme.success }]} />
                            ) : null}
                          </View>
                          <ThemedText style={[styles.resultMeta, { color: theme.textSecondary }]}>
                            {[
                              d.rating ? `★ ${parseFloat(d.rating).toFixed(1)}` : null,
                              d.totalTrips ? `${d.totalTrips} trips` : null,
                              d.followers > 0 ? `${d.followers} followers` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Travony driver"}
                          </ThemedText>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {results!.hubs.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Hubs</ThemedText>
                  {results!.hubs.map((h) => (
                    <Pressable key={h.id} onPress={() => openHub(h)}>
                      <Card style={styles.resultCard}>
                        <View style={[styles.iconWrap, { backgroundColor: theme.backgroundSecondary }]}>
                          <Ionicons
                            name={h.isEvHub ? "flash-outline" : "location-outline"}
                            size={18}
                            color={theme.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.resultTitle} numberOfLines={1}>
                            {h.name}
                          </ThemedText>
                          <ThemedText
                            style={[styles.resultMeta, { color: theme.textSecondary }]}
                            numberOfLines={1}
                          >
                            {h.address || h.regionCode || "Travony hub"}
                          </ThemedText>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
                      </Card>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {results!.posts.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>From the network</ThemedText>
                  {results!.posts.map((p) => (
                    <Pressable key={p.id} onPress={() => openPost(p.id, true)}>
                      <Card style={styles.resultCard}>
                        <SmallAvatar uri={p.authorAvatar} name={p.authorName} />
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.resultTitle} numberOfLines={2}>
                            {p.caption || "Shared journey"}
                          </ThemedText>
                          <ThemedText style={[styles.resultMeta, { color: theme.textSecondary }]}>
                            {[p.authorName, p.cityName, p.reactions > 0 ? `${p.reactions} reactions` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </ThemedText>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          )}
        </View>
      ) : (
        <View>
          {trendingQuery.isLoading ? (
            <ActivityIndicator style={{ marginTop: Spacing.xl }} color={theme.primary} />
          ) : (
            <View>
              {trending && trending.searches.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Trending searches</ThemedText>
                  <View style={styles.chipRow}>
                    {trending.searches.map((term) => (
                      <Pressable
                        key={term}
                        style={[styles.chip, { backgroundColor: theme.backgroundDefault }]}
                        onPress={() => setInput(term)}
                      >
                        <Ionicons name="trending-up" size={13} color={theme.primary} />
                        <ThemedText style={styles.chipText}>{term}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}

              {trending && trending.routes.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Hot routes right now</ThemedText>
                  {trending.routes.map((r, i) => (
                    <Card key={r.label} style={styles.resultCard}>
                      <ThemedText style={[styles.rankNumber, { color: i < 3 ? theme.primary : theme.textMuted }]}>
                        {i + 1}
                      </ThemedText>
                      <View style={{ flex: 1 }}>
                        <View style={styles.driverNameRow}>
                          <ThemedText style={styles.resultTitle} numberOfLines={1}>
                            {r.label}
                          </ThemedText>
                          {r.rising ? (
                            <Ionicons name="trending-up" size={14} color={theme.success} />
                          ) : null}
                        </View>
                        <ThemedText style={[styles.resultMeta, { color: theme.textSecondary }]}>
                          {[
                            r.driversLive > 0 ? `${r.driversLive} drivers live` : null,
                            r.openRequests > 0 ? `${r.openRequests} riders waiting` : null,
                            formatHour(r.peakHour) ? `peaks ${formatHour(r.peakHour)}` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Active this week"}
                        </ThemedText>
                      </View>
                    </Card>
                  ))}
                </View>
              ) : null}

              {trending && trending.posts.length > 0 ? (
                <View style={styles.section}>
                  <ThemedText style={styles.sectionTitle}>Talked about</ThemedText>
                  {trending.posts.map((p) => (
                    <Pressable key={p.postId} onPress={() => openPost(p.postId, false)}>
                      <Card style={styles.resultCard}>
                        <View style={[styles.iconWrap, { backgroundColor: theme.backgroundSecondary }]}>
                          <Ionicons
                            name={p.isLive ? "radio-outline" : "chatbubbles-outline"}
                            size={18}
                            color={p.isLive ? theme.error : theme.primary}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <ThemedText style={styles.resultTitle} numberOfLines={2}>
                            {p.label}
                          </ThemedText>
                          <ThemedText style={[styles.resultMeta, { color: theme.textSecondary }]}>
                            {[
                              p.city,
                              p.reactions && p.reactions > 0 ? `${p.reactions} reactions` : null,
                              p.comments && p.comments > 0 ? `${p.comments} comments` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Trending on the network"}
                          </ThemedText>
                        </View>
                      </Card>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              {trending &&
              trending.routes.length === 0 &&
              trending.posts.length === 0 &&
              trending.searches.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="pulse-outline" size={40} color={theme.textMuted} />
                  <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                    Trends appear as the network moves. Check back soon.
                  </ThemedText>
                </View>
              ) : null}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 46,
    marginBottom: Spacing.lg,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
    height: "100%",
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
  },
  chipText: {
    ...Typography.smallBold,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  rankNumber: {
    ...Typography.h4,
    width: 24,
    textAlign: "center",
  },
  resultTitle: {
    ...Typography.bodyMediumMedium,
  },
  resultMeta: {
    ...Typography.small,
    marginTop: 1,
  },
  driverNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["2xl"],
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
  },
});
