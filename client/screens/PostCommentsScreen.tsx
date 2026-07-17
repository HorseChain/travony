import React, { useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  Image,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, type RouteProp } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import type { SocialStackParamList } from "@/navigation/SocialStackNavigator";

interface Comment {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string;
  authorAvatar: string | null;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
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

export default function PostCommentsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const route = useRoute<RouteProp<SocialStackParamList, "PostComments">>();
  const { postId } = route.params;

  const [body, setBody] = useState("");

  const commentsQuery = useQuery<{ comments: Comment[] }>({
    queryKey: ["/api/social/posts", postId, "comments"],
  });

  const addComment = useMutation({
    mutationFn: async () => {
      return apiRequest(`/api/social/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: body.trim() }),
        headers: { "Content-Type": "application/json" },
      });
    },
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["/api/social/posts", postId, "comments"] });
      queryClient.setQueriesData<any>({ queryKey: ["/api/social/feed"] }, (old: any) => {
        if (!old?.posts) return old;
        return {
          ...old,
          posts: old.posts.map((p: any) =>
            p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p
          ),
        };
      });
    },
    onError: (error: any) => {
      const msg = error.message || "Could not post your comment";
      if (Platform.OS === "web") window.alert(msg);
      else Alert.alert("Comment", msg);
    },
  });

  const comments = commentsQuery.data?.comments || [];
  const canSend = body.trim().length > 0 && !addComment.isPending;

  return (
    <KeyboardAwareScrollViewCompat
      style={{ flex: 1, backgroundColor: theme.backgroundRoot }}
      contentContainerStyle={{ flexGrow: 1 }}
      bottomOffset={Spacing.md}
      keyboardShouldPersistTaps="handled"
    >
      <FlatList
        scrollEnabled={false}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: Spacing.lg,
        }}
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.commentRow}>
            <Avatar uri={item.authorAvatar} name={item.authorName} size={36} />
            <View style={styles.commentBody}>
              <View style={styles.commentHeader}>
                <ThemedText style={styles.commentAuthor}>{item.authorName}</ThemedText>
                <ThemedText style={[styles.commentTime, { color: theme.textMuted }]}>
                  {timeAgo(item.createdAt)}
                </ThemedText>
              </View>
              <ThemedText style={styles.commentText}>{item.body}</ThemedText>
            </View>
          </View>
        )}
        ListEmptyComponent={
          commentsQuery.isLoading ? null : (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={theme.textMuted} />
              <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
                No comments yet. Be the first to say something.
              </ThemedText>
            </View>
          )
        }
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: theme.backgroundDefault,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + Spacing.sm,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { backgroundColor: theme.backgroundRoot, color: theme.text }]}
          placeholder="Add a comment"
          placeholderTextColor={theme.textMuted}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={280}
        />
        <Pressable
          style={({ pressed }) => [
            styles.sendButton,
            { backgroundColor: canSend ? theme.primary : theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={() => addComment.mutate()}
          disabled={!canSend}
        >
          {addComment.isPending ? (
            <ActivityIndicator color={Colors.light.textOnPrimary} size="small" />
          ) : (
            <Ionicons name="arrow-up" size={20} color={Colors.light.textOnPrimary} />
          )}
        </Pressable>
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  commentRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  commentBody: {
    flex: 1,
  },
  commentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  commentAuthor: {
    ...Typography.bodyBold,
  },
  commentTime: {
    ...Typography.caption,
  },
  commentText: {
    ...Typography.body,
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    ...Typography.body,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    ...Typography.body,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
