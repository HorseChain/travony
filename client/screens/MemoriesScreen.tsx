import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import RideMap from "@/components/RideMap";
import LiteTripView from "@/components/LiteTripView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useLiteMode } from "@/hooks/useLiteMode";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";

interface Memory {
  rideId: string;
  role: "rider" | "driver";
  date: string | null;
  cityName: string | null;
  distanceKm: number | null;
  fare: number | null;
  currency: string;
  counterpart: { name: string; avatar: string | null } | null;
  pickup: { lat: number | null; lng: number | null };
  dropoff: { lat: number | null; lng: number | null };
  isEvRide: boolean;
  isPmgthRide: boolean;
  hasPosted: boolean;
}

interface MemoriesResponse {
  currency: string;
  highlight: {
    monthly: { rides: number; distanceKm: number; amount: number } | null;
    onThisDay: {
      rideId: string;
      date: string;
      cityName: string | null;
      distanceKm: number | null;
      yearsAgo: number;
    } | null;
  };
  memories: Memory[];
}

function notify(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(amount: number | null, currency: string): string | null {
  if (amount == null || isNaN(amount)) return null;
  return `${currency} ${amount.toFixed(2)}`;
}

function Avatar({ uri, name, size }: { uri: string | null; name: string; size: number }) {
  const { theme } = useTheme();
  if (uri) {
    return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: theme.backgroundSecondary,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ThemedText style={{ fontWeight: "600", fontSize: size * 0.4 }}>
        {(name || "?").charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

function HighlightBanner({ data }: { data: MemoriesResponse }) {
  const { theme } = useTheme();
  const { monthly, onThisDay } = data.highlight;
  if (!monthly && !onThisDay) return null;

  return (
    <View style={styles.highlightWrap}>
      {monthly ? (
        <View style={[styles.highlightCard, { backgroundColor: theme.primary }]}>
          <ThemedText style={styles.highlightLabel}>This month</ThemedText>
          <ThemedText style={styles.highlightBig}>
            {monthly.rides} {monthly.rides === 1 ? "ride" : "rides"}
          </ThemedText>
          <ThemedText style={styles.highlightSub}>
            {[
              monthly.distanceKm ? `${monthly.distanceKm.toFixed(1)} km` : null,
              formatMoney(monthly.amount, data.currency),
            ]
              .filter(Boolean)
              .join(" · ")}
          </ThemedText>
        </View>
      ) : null}
      {onThisDay ? (
        <View style={[styles.highlightCard, { backgroundColor: theme.backgroundDefault }]}>
          <View style={styles.onThisDayTop}>
            <Ionicons name="time-outline" size={16} color={theme.primary} />
            <ThemedText style={[styles.highlightLabel, { color: theme.textSecondary }]}>
              On this day
            </ThemedText>
          </View>
          <ThemedText style={[styles.highlightBig, { color: theme.text }]}>
            {onThisDay.yearsAgo} {onThisDay.yearsAgo === 1 ? "year" : "years"} ago
          </ThemedText>
          <ThemedText style={[styles.highlightSub, { color: theme.textSecondary }]}>
            {onThisDay.cityName ? `You rode in ${onThisDay.cityName}` : "You took a ride"}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function MemoryCard({ memory, onShare }: { memory: Memory; onShare: (m: Memory) => void }) {
  const { theme } = useTheme();
  const { liteMode } = useLiteMode();

  const meta = [
    memory.cityName,
    memory.distanceKm ? `${memory.distanceKm.toFixed(1)} km` : null,
    formatMoney(memory.fare, memory.currency),
  ]
    .filter(Boolean)
    .join(" · ");

  const cityLabel = memory.cityName || "This ride";
  const hasCoords =
    memory.pickup.lat != null &&
    memory.pickup.lng != null &&
    memory.dropoff.lat != null &&
    memory.dropoff.lng != null;

  return (
    <Card style={styles.memoryCard}>
      <View style={styles.memoryTop}>
        <ThemedText style={styles.memoryDate}>{formatDate(memory.date)}</ThemedText>
        <View style={[styles.roleChip, { backgroundColor: theme.backgroundSecondary }]}>
          <Ionicons
            name={memory.role === "driver" ? "car-sport-outline" : "person-outline"}
            size={12}
            color={theme.primary}
          />
          <ThemedText style={styles.roleChipText}>
            {memory.role === "driver" ? "Driver" : "Rider"}
          </ThemedText>
        </View>
      </View>

      <View style={styles.mapWrap}>
        {liteMode || !hasCoords ? (
          <LiteTripView
            pickupAddress={cityLabel}
            dropoffAddress={cityLabel}
            distance={memory.distanceKm}
            height={140}
          />
        ) : (
          <RideMap
            pickupLocation={{ lat: memory.pickup.lat as number, lng: memory.pickup.lng as number }}
            dropoffLocation={{ lat: memory.dropoff.lat as number, lng: memory.dropoff.lng as number }}
            showRoute
            interactive={false}
            height={140}
          />
        )}
      </View>

      <ThemedText style={[styles.memoryMeta, { color: theme.textSecondary }]}>
        {meta || "A ride on the Travony network"}
      </ThemedText>

      {(memory.isEvRide || memory.isPmgthRide) ? (
        <View style={styles.tagRow}>
          {memory.isEvRide ? (
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Ionicons name="flash-outline" size={12} color={theme.primary} />
              <ThemedText style={styles.tagText}>EV</ThemedText>
            </View>
          ) : null}
          {memory.isPmgthRide ? (
            <View style={[styles.tag, { backgroundColor: theme.backgroundSecondary }]}>
              <Ionicons name="home-outline" size={12} color={theme.primary} />
              <ThemedText style={styles.tagText}>Going Home</ThemedText>
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.memoryBottom}>
        {memory.counterpart ? (
          <View style={styles.counterpart}>
            <Avatar uri={memory.counterpart.avatar} name={memory.counterpart.name} size={28} />
            <ThemedText style={[styles.counterpartName, { color: theme.textSecondary }]} numberOfLines={1}>
              with {memory.counterpart.name}
            </ThemedText>
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}

        {memory.hasPosted ? (
          <View style={styles.postedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
            <ThemedText style={[styles.postedText, { color: theme.primary }]}>On your feed</ThemedText>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.shareButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => onShare(memory)}
          >
            <Ionicons name="share-social-outline" size={14} color={Colors.light.textOnPrimary} />
            <ThemedText style={styles.shareButtonText}>Share</ThemedText>
          </Pressable>
        )}
      </View>
    </Card>
  );
}

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [shareMemory, setShareMemory] = useState<Memory | null>(null);
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);

  const memoriesQuery = useQuery<MemoriesResponse>({
    queryKey: ["/api/social/memories"],
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!shareMemory) return;
      return apiRequest(`/api/rides/${shareMemory.rideId}/publish`, {
        method: "POST",
        body: JSON.stringify({ caption: caption.trim() || null, photoUrl: photo }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/social/memories"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/feed"] });
      closeShare();
      notify("Shared", "Your ride memory is now on the feed.");
    },
    onError: (error: any) => {
      notify("Share", error.message || "Could not share this memory");
    },
  });

  const closeShare = () => {
    setShareMemory(null);
    setCaption("");
    setPhoto(null);
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      notify("Permission needed", "Allow photo access to add a photo to your memory.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const memories = memoriesQuery.data?.memories || [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundRoot }}>
      <FlatList
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarInset + Spacing.xl,
          paddingHorizontal: Spacing.lg,
        }}
        scrollIndicatorInsets={{ bottom: tabBarInset }}
        data={memories}
        keyExtractor={(item) => item.rideId}
        initialNumToRender={4}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={memoriesQuery.isRefetching}
            onRefresh={() => memoriesQuery.refetch()}
            tintColor={theme.primary}
          />
        }
        ListHeaderComponent={
          memoriesQuery.data ? <HighlightBanner data={memoriesQuery.data} /> : null
        }
        renderItem={({ item }) => <MemoryCard memory={item} onShare={setShareMemory} />}
        ListEmptyComponent={
          memoriesQuery.isLoading ? null : (
            <View style={styles.emptyState}>
              <Ionicons name="images-outline" size={48} color={theme.textMuted} />
              <ThemedText style={styles.emptyTitle}>No memories yet</ThemedText>
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                When you complete a ride, it becomes a memory here. Share the ones
                you love to your network.
              </ThemedText>
            </View>
          )
        }
      />

      <Modal
        visible={!!shareMemory}
        animationType="slide"
        transparent
        onRequestClose={closeShare}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.lg }]}>
            <KeyboardAwareScrollViewCompat
              contentContainerStyle={{ padding: Spacing.lg }}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.modalHeader}>
                <ThemedText style={styles.modalTitle}>Share this memory</ThemedText>
                <Pressable onPress={closeShare} hitSlop={12}>
                  <Ionicons name="close" size={24} color={theme.textSecondary} />
                </Pressable>
              </View>

              <TextInput
                style={[
                  styles.captionInput,
                  { backgroundColor: theme.backgroundDefault, color: theme.text, borderColor: theme.border },
                ]}
                placeholder="Say something about this ride (optional)"
                placeholderTextColor={theme.textMuted}
                value={caption}
                onChangeText={setCaption}
                multiline
                maxLength={280}
              />

              {photo ? (
                <View style={styles.photoPreviewWrap}>
                  <Image source={{ uri: photo }} style={styles.photoPreview} />
                  <Pressable
                    style={[styles.removePhoto, { backgroundColor: theme.backgroundRoot }]}
                    onPress={() => setPhoto(null)}
                    hitSlop={8}
                  >
                    <Ionicons name="close-circle" size={24} color={theme.error} />
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  style={[styles.addPhoto, { borderColor: theme.border }]}
                  onPress={pickPhoto}
                >
                  <Ionicons name="image-outline" size={18} color={theme.primary} />
                  <ThemedText style={[styles.addPhotoText, { color: theme.primary }]}>
                    Add a photo
                  </ThemedText>
                </Pressable>
              )}

              <Pressable
                style={({ pressed }) => [
                  styles.publishButton,
                  { backgroundColor: theme.primary, opacity: pressed || publishMutation.isPending ? 0.8 : 1 },
                ]}
                onPress={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <ActivityIndicator color={Colors.light.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="share-social-outline" size={16} color={Colors.light.textOnPrimary} />
                    <ThemedText style={styles.publishButtonText}>Share to feed</ThemedText>
                  </>
                )}
              </Pressable>
            </KeyboardAwareScrollViewCompat>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  highlightWrap: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  highlightCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    minHeight: 104,
    justifyContent: "center",
  },
  onThisDayTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  highlightLabel: {
    ...Typography.smallBold,
    color: "rgba(255,255,255,0.85)",
  },
  highlightBig: {
    ...Typography.h3,
    color: Colors.light.textOnPrimary,
    marginTop: 4,
  },
  highlightSub: {
    ...Typography.small,
    color: "rgba(255,255,255,0.9)",
    marginTop: 2,
  },
  memoryCard: {
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  memoryTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  memoryDate: {
    ...Typography.bodyBold,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  roleChipText: {
    ...Typography.captionBold,
  },
  mapWrap: {
    height: 140,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
  },
  memoryMeta: {
    ...Typography.small,
    marginTop: Spacing.md,
  },
  tagRow: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  tagText: {
    ...Typography.captionBold,
  },
  memoryBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.md,
  },
  counterpart: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
    marginRight: Spacing.md,
  },
  counterpartName: {
    ...Typography.small,
    flexShrink: 1,
  },
  postedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  postedText: {
    ...Typography.smallBold,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.lg,
    height: 36,
    borderRadius: BorderRadius.full,
  },
  shareButtonText: {
    ...Typography.smallHeavy,
    color: Colors.light.textOnPrimary,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h4,
    marginTop: Spacing.lg,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    ...Typography.h4,
  },
  captionInput: {
    minHeight: 90,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.md,
    ...Typography.body,
    textAlignVertical: "top",
  },
  addPhoto: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: Spacing.md,
  },
  addPhotoText: {
    ...Typography.bodyBold,
  },
  photoPreviewWrap: {
    marginTop: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: "hidden",
    position: "relative",
  },
  photoPreview: {
    width: "100%",
    height: 180,
    borderRadius: BorderRadius.md,
  },
  removePhoto: {
    position: "absolute",
    top: Spacing.sm,
    right: Spacing.sm,
    borderRadius: 12,
  },
  publishButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 50,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
  },
  publishButtonText: {
    ...Typography.bodyHeavy,
    color: Colors.light.textOnPrimary,
  },
});
