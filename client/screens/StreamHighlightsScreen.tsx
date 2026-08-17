import React, { useMemo } from "react";
import { View, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Share, Alert } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

// Post-stream highlight review. The server turns the ended stream's best
// moments (clip marks, gift bursts, viewer spikes) into up to 3 candidate
// clips. NOTHING goes public until the driver taps Post — approval creates
// the feed post and adds the clip to the car's public highlight reel.

interface HighlightClip {
  id: string;
  status: "rendering" | "ready" | "approved" | "discarded" | "failed";
  title: string | null;
  caption: string | null;
  cityName: string | null;
  handle: string | null;
  durationSec: number;
  thumbnailData: string | null;
  videoUrl: string;
  reasons: Record<string, number> | null;
  peakViewers: number;
  giftCoins: number;
  clipMarks: number;
  // Short-lived token for playing an unapproved clip (host-only preview).
  previewToken: string | null;
}

function reasonLabel(reasons: Record<string, number> | null): string {
  if (!reasons) return "Highlight moment";
  if (reasons.clipMarks) return `${reasons.clipMarks} viewer${reasons.clipMarks > 1 ? "s" : ""} tapped "Clip that"`;
  if (reasons.giftCoins) return "Gift burst from viewers";
  if (reasons.viewerSpike) return "Viewers jumped in";
  if (reasons.durationSegment) return "A slice of your ride";
  return "Highlight moment";
}

export default function StreamHighlightsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const postId: string = route.params?.postId;

  const clipsQuery = useQuery<{ generating: boolean; clips: HighlightClip[] }>({
    queryKey: [`/api/streams/${postId}/clips`],
    enabled: !!postId,
    refetchInterval: (q) => {
      const d = q.state.data;
      // Poll while the server is still rendering; stop once everything settles.
      if (!d) return 2500;
      const busy = d.generating || d.clips.some((c) => c.status === "rendering");
      return busy ? 2500 : false;
    },
  });

  const clips = useMemo(
    () => (clipsQuery.data?.clips || []).filter((c) => c.status !== "discarded" && c.status !== "failed"),
    [clipsQuery.data],
  );
  const rendering =
    !clipsQuery.data ||
    clipsQuery.data.generating ||
    clips.some((c) => c.status === "rendering");

  const approveMutation = useMutation({
    mutationFn: (clipId: string) => apiRequest(`/api/stream-clips/${clipId}/approve`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/streams/${postId}/clips`] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/feed"] });
    },
    onError: () => Alert.alert("Couldn't post the clip", "Please try again."),
  });

  const discardMutation = useMutation({
    mutationFn: (clipId: string) => apiRequest(`/api/stream-clips/${clipId}/discard`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [`/api/streams/${postId}/clips`] }),
  });

  const shareClip = async (clip: HighlightClip) => {
    // The public clip page plays the video and carries the watermark + booking
    // link — ready to drop into TikTok/Instagram bios, stories, or chats.
    // Only APPROVED clips are public, so sharing is approval-gated.
    const url = new URL(`/clip/${clip.id}`, getApiUrl()).toString();
    try {
      await Share.share({ message: `${clip.title || "My Travony ride highlight"} — ${url}` });
    } catch {}
  };

  const confirmDiscard = (clip: HighlightClip) => {
    Alert.alert(
      "Discard this clip?",
      clip.status === "approved"
        ? "It will also be removed from your feed and your car's highlight reel."
        : "This can't be undone.",
      [
        { text: "Keep it", style: "cancel" },
        { text: "Discard", style: "destructive", onPress: () => discardMutation.mutate(clip.id) },
      ],
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.headerTitle}>Your highlights</ThemedText>
          <ThemedText style={[styles.headerSub, { color: theme.textSecondary }]}>
            Post them, or download for TikTok & Instagram
          </ThemedText>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Spacing.lg, paddingBottom: insets.bottom + 40 }}>
        {rendering ? (
          <View style={[styles.renderingCard, { backgroundColor: theme.backgroundSecondary }]}>
            <ActivityIndicator color={theme.primary} />
            <View style={{ flex: 1 }}>
              <ThemedText style={styles.renderingTitle}>Cutting your best moments…</ThemedText>
              <ThemedText style={[styles.renderingSub, { color: theme.textSecondary }]}>
                Viewer reactions, gifts and "Clip that" taps decide what makes the cut.
              </ThemedText>
            </View>
          </View>
        ) : null}

        {!rendering && clips.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="film-outline" size={44} color={theme.textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
              No highlights this time
            </ThemedText>
            <ThemedText style={[styles.emptySub, { color: theme.textSecondary }]}>
              Longer streams with viewers, gifts, or "Clip that" taps generate clips automatically.
            </ThemedText>
            <Pressable
              onPress={() => navigation.goBack()}
              style={[styles.doneButton, { backgroundColor: theme.primary }]}
            >
              <ThemedText style={styles.doneButtonText}>Done</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {clips.map((clip) => (
          <View key={clip.id} style={[styles.clipCard, { backgroundColor: theme.backgroundSecondary }]}>
            <Pressable
              style={styles.thumbWrap}
              onPress={() =>
                clip.status !== "rendering" &&
                navigation.navigate("ClipPlayer", {
                  clipId: clip.id,
                  title: clip.title || undefined,
                  previewToken: clip.previewToken || undefined,
                })
              }
            >
              {clip.thumbnailData ? (
                <Image source={{ uri: clip.thumbnailData }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              {clip.status !== "rendering" ? (
                <View style={styles.playBadge}>
                  <Ionicons name="play" size={18} color="#fff" />
                </View>
              ) : null}
              <View style={styles.durationChip}>
                <ThemedText style={styles.durationText}>{clip.durationSec}s</ThemedText>
              </View>
            </Pressable>

            <View style={styles.clipBody}>
              <ThemedText style={styles.clipTitle} numberOfLines={1}>
                {clip.title || "Ride highlight"}
              </ThemedText>
              <ThemedText style={[styles.clipReason, { color: theme.primary }]} numberOfLines={1}>
                {reasonLabel(clip.reasons)}
              </ThemedText>
              {clip.caption ? (
                <ThemedText style={[styles.clipCaption, { color: theme.textSecondary }]} numberOfLines={3}>
                  {clip.caption}
                </ThemedText>
              ) : null}

              {clip.status === "approved" ? (
                <View style={styles.postedRow}>
                  <Ionicons name="checkmark-circle" size={16} color="#3ddc84" />
                  <ThemedText style={styles.postedText}>Posted to your profile</ThemedText>
                </View>
              ) : null}

              <View style={styles.buttonRow}>
                {clip.status === "ready" ? (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: theme.primary }]}
                    disabled={approveMutation.isPending}
                    onPress={() => approveMutation.mutate(clip.id)}
                  >
                    <Ionicons name="megaphone-outline" size={15} color="#fff" />
                    <ThemedText style={styles.actionText}>Post</ThemedText>
                  </Pressable>
                ) : null}
                {clip.status === "approved" ? (
                  // Share/download only unlock AFTER approval — nothing is
                  // publicly reachable until the driver explicitly posts.
                  <Pressable
                    style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.textMuted }]}
                    onPress={() => shareClip(clip)}
                  >
                    <Ionicons name="share-outline" size={15} color={theme.text} />
                    <ThemedText style={[styles.actionText, { color: theme.text }]}>Share</ThemedText>
                  </Pressable>
                ) : null}
                {clip.status !== "rendering" ? (
                  <Pressable
                    style={[styles.actionButton, styles.secondaryButton, { borderColor: theme.textMuted }]}
                    onPress={() => confirmDiscard(clip)}
                  >
                    <Ionicons name="trash-outline" size={15} color={theme.error} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: 6,
  },
  backButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.small },
  renderingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  renderingTitle: { ...Typography.bodyBold },
  renderingSub: { ...Typography.small, marginTop: 2 },
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: Spacing.xl },
  emptyTitle: { ...Typography.h4, marginTop: Spacing.md },
  emptySub: { ...Typography.small, textAlign: "center", marginTop: 6 },
  doneButton: {
    marginTop: Spacing.xl,
    paddingHorizontal: 36,
    paddingVertical: 12,
    borderRadius: BorderRadius.full,
  },
  doneButtonText: { ...Typography.bodyBold, color: "#fff" },
  clipCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
    marginBottom: Spacing.lg,
  },
  thumbWrap: { width: 110 },
  thumb: { width: 110, height: 196 },
  thumbEmpty: { backgroundColor: "#1a1a26", alignItems: "center", justifyContent: "center" },
  playBadge: {
    position: "absolute",
    top: "50%",
    left: "50%",
    marginLeft: -18,
    marginTop: -18,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  durationChip: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  durationText: { fontSize: 11, color: "#fff", fontWeight: "700" },
  clipBody: { flex: 1, padding: Spacing.md },
  clipTitle: { ...Typography.bodyBold },
  clipReason: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  clipCaption: { ...Typography.small, marginTop: 6 },
  postedRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8 },
  postedText: { fontSize: 12, fontWeight: "600", color: "#3ddc84" },
  buttonRow: { flexDirection: "row", gap: 8, marginTop: "auto", paddingTop: 10 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 14,
    height: 34,
    borderRadius: BorderRadius.full,
  },
  secondaryButton: { backgroundColor: "transparent", borderWidth: 1 },
  actionText: { fontSize: 13, fontWeight: "700", color: "#fff" },
});
