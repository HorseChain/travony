import React, { useState, useCallback, useRef } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Dimensions,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import RideMap from "@/components/RideMap";
import LiteTripView from "@/components/LiteTripView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useLiteMode } from "@/hooks/useLiteMode";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("screen");

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
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "rgba(255,255,255,0.25)",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <ThemedText style={{ fontWeight: "600", fontSize: size * 0.4, color: "#fff" }}>
        {(name || "?").charAt(0).toUpperCase()}
      </ThemedText>
    </View>
  );
}

function MemorySlide({
  memory,
  itemHeight,
  isVisible,
  onShare,
}: {
  memory: Memory;
  itemHeight: number;
  isVisible: boolean;
  onShare: (m: Memory) => void;
}) {
  const { liteMode } = useLiteMode();

  const hasCoords =
    memory.pickup.lat != null &&
    memory.pickup.lng != null &&
    memory.dropoff.lat != null &&
    memory.dropoff.lng != null;

  const city = memory.cityName || "Your ride";
  const distance = memory.distanceKm ? `${memory.distanceKm.toFixed(1)} km` : null;
  const fare = formatMoney(memory.fare, memory.currency);
  const date = formatDate(memory.date);

  return (
    <View style={[styles.slide, { height: itemHeight }]}>
      {/* Background — map or dark gradient */}
      <View style={StyleSheet.absoluteFill}>
        {hasCoords && !liteMode ? (
          <RideMap
            pickupLocation={{
              lat: memory.pickup.lat as number,
              lng: memory.pickup.lng as number,
            }}
            dropoffLocation={{
              lat: memory.dropoff.lat as number,
              lng: memory.dropoff.lng as number,
            }}
            showRoute
            interactive={false}
            height={itemHeight}
          />
        ) : (
          <LinearGradient
            colors={["#0d1117", "#1a1f2e", "#0d1117"]}
            style={StyleSheet.absoluteFill}
          />
        )}
        {/* Always darken the map so text is readable */}
        <LinearGradient
          colors={["rgba(0,0,0,0.25)", "transparent", "rgba(0,0,0,0.75)"]}
          style={StyleSheet.absoluteFill}
          locations={[0, 0.4, 1]}
        />
      </View>

      {/* Top row — date + role chip */}
      {isVisible ? (
        <Animated.View entering={FadeIn.duration(300)} style={styles.topRow}>
          <View style={styles.datePill}>
            <ThemedText style={styles.datePillText}>{date}</ThemedText>
          </View>
          <View style={styles.rolePill}>
            <Ionicons
              name={memory.role === "driver" ? "car-sport-outline" : "person-outline"}
              size={12}
              color="#fff"
            />
            <ThemedText style={styles.rolePillText}>
              {memory.role === "driver" ? "Driver" : "Rider"}
            </ThemedText>
          </View>
        </Animated.View>
      ) : null}

      {/* Right sidebar — TikTok style */}
      {isVisible ? (
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={styles.sidebar}>
          {memory.isEvRide ? (
            <View style={styles.sideAction}>
              <Ionicons name="flash" size={26} color="#4ade80" />
              <ThemedText style={styles.sideLabel}>EV</ThemedText>
            </View>
          ) : null}
          {memory.isPmgthRide ? (
            <View style={styles.sideAction}>
              <Ionicons name="home" size={26} color="#60a5fa" />
              <ThemedText style={styles.sideLabel}>Home</ThemedText>
            </View>
          ) : null}
          <Pressable
            style={({ pressed }) => [styles.sideAction, { opacity: pressed ? 0.7 : 1 }]}
            onPress={() => onShare(memory)}
          >
            {memory.hasPosted ? (
              <>
                <Ionicons name="checkmark-circle" size={30} color="#4ade80" />
                <ThemedText style={styles.sideLabel}>Shared</ThemedText>
              </>
            ) : (
              <>
                <Ionicons name="share-social" size={30} color="#fff" />
                <ThemedText style={styles.sideLabel}>Share</ThemedText>
              </>
            )}
          </Pressable>
        </Animated.View>
      ) : null}

      {/* Bottom overlay */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.85)"]}
        style={styles.bottomGradient}
        locations={[0, 1]}
      >
        {isVisible ? (
          <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.bottomContent}>
            <ThemedText style={styles.cityName} numberOfLines={1}>
              {city}
            </ThemedText>
            <ThemedText style={styles.statsLine}>
              {[distance, fare].filter(Boolean).join(" · ") || "On the Travony network"}
            </ThemedText>

            {memory.counterpart ? (
              <View style={styles.counterpartRow}>
                <Avatar
                  uri={memory.counterpart.avatar}
                  name={memory.counterpart.name}
                  size={28}
                />
                <ThemedText style={styles.counterpartName} numberOfLines={1}>
                  with {memory.counterpart.name}
                </ThemedText>
              </View>
            ) : null}
          </Animated.View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const itemHeight = SCREEN_H - tabBarInset;

  const [shareMemory, setShareMemory] = useState<Memory | null>(null);
  const [caption, setCaption] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [visibleIndex, setVisibleIndex] = useState(0);

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
      if (Platform.OS === "web") window.alert("Shared!\nYour ride memory is now on the feed.");
      else Alert.alert("Shared", "Your ride memory is now on the feed.");
    },
    onError: (error: any) => {
      const msg = error.message || "Could not share this memory";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Share", msg);
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
      if (Platform.OS === "web") window.alert("Allow photo access to add a photo to your memory.");
      else Alert.alert("Permission needed", "Allow photo access to add a photo to your memory.");
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

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setVisibleIndex(viewableItems[0].index);
      }
    },
    [],
  );
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 });

  const memories = memoriesQuery.data?.memories || [];

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      {memories.length > 0 ? (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.rideId}
          pagingEnabled
          snapToInterval={itemHeight}
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig.current}
          renderItem={({ item, index }) => (
            <MemorySlide
              memory={item}
              itemHeight={itemHeight}
              isVisible={index === visibleIndex}
              onShare={setShareMemory}
            />
          )}
          getItemLayout={(_data, index) => ({
            length: itemHeight,
            offset: itemHeight * index,
            index,
          })}
          initialNumToRender={2}
          maxToRenderPerBatch={2}
          windowSize={3}
          removeClippedSubviews
        />
      ) : memoriesQuery.isLoading ? (
        <View style={styles.emptyState}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : (
        <View style={[styles.emptyState, { paddingBottom: tabBarInset }]}>
          <Ionicons name="images-outline" size={52} color="rgba(255,255,255,0.3)" />
          <ThemedText style={styles.emptyTitle}>No memories yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            When you complete a ride, it shows up here. Share the ones you love to your network.
          </ThemedText>
        </View>
      )}

      {/* Scroll indicator dots */}
      {memories.length > 1 ? (
        <View style={[styles.dots, { top: insets.top + Spacing.md }]}>
          {memories.slice(0, Math.min(memories.length, 8)).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === visibleIndex ? "#fff" : "rgba(255,255,255,0.35)",
                  width: i === visibleIndex ? 18 : 6,
                },
              ]}
            />
          ))}
        </View>
      ) : null}

      {/* Share modal */}
      <Modal
        visible={!!shareMemory}
        animationType="slide"
        transparent
        onRequestClose={closeShare}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: theme.backgroundRoot, paddingBottom: insets.bottom + Spacing.lg },
            ]}
          >
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
                  {
                    backgroundColor: theme.backgroundDefault,
                    color: theme.text,
                    borderColor: theme.border,
                  },
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
                  {
                    backgroundColor: theme.primary,
                    opacity: pressed || publishMutation.isPending ? 0.8 : 1,
                  },
                ]}
                onPress={() => publishMutation.mutate()}
                disabled={publishMutation.isPending}
              >
                {publishMutation.isPending ? (
                  <ActivityIndicator color={Colors.light.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons
                      name="share-social-outline"
                      size={16}
                      color={Colors.light.textOnPrimary}
                    />
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
  slide: {
    width: SCREEN_W,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  topRow: {
    position: "absolute",
    top: Spacing["3xl"],
    left: Spacing.lg,
    right: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    zIndex: 10,
  },
  datePill: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  datePillText: {
    ...Typography.caption,
    color: "#fff",
  },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  rolePillText: {
    ...Typography.caption,
    color: "#fff",
  },
  sidebar: {
    position: "absolute",
    right: Spacing.lg,
    bottom: 140,
    alignItems: "center",
    gap: Spacing.xl,
    zIndex: 10,
  },
  sideAction: {
    alignItems: "center",
    gap: 4,
  },
  sideLabel: {
    ...Typography.caption,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 80,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  bottomContent: {
    gap: Spacing.sm,
  },
  cityName: {
    ...Typography.h2,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  statsLine: {
    ...Typography.body,
    color: "rgba(255,255,255,0.85)",
  },
  counterpartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  counterpartName: {
    ...Typography.small,
    color: "rgba(255,255,255,0.8)",
    flexShrink: 1,
  },
  dots: {
    position: "absolute",
    right: Spacing.md,
    flexDirection: "column",
    alignItems: "center",
    gap: 5,
    zIndex: 20,
  },
  dot: {
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing["3xl"],
  },
  emptyTitle: {
    ...Typography.h4,
    color: "#fff",
    textAlign: "center",
  },
  emptyText: {
    ...Typography.body,
    color: "rgba(255,255,255,0.6)",
    textAlign: "center",
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
