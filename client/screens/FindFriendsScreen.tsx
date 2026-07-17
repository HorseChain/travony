import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  Image,
  Platform,
  Share,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Contacts from "expo-contacts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import QRCodeSheet from "@/components/profile/QRCodeSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

interface Person {
  id: string;
  name: string;
  avatar: string | null;
  handle?: string;
  followers: number;
  rides: number;
  isFollowing?: boolean;
}

function PersonRow({ person }: { person: Person }) {
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState(!!person.isFollowing);

  const followMutation = useMutation({
    mutationFn: async (follow: boolean) => {
      await apiRequest(`/api/social/follow/${person.id}`, {
        method: follow ? "POST" : "DELETE",
      });
      return follow;
    },
    onSuccess: (follow) => {
      setIsFollowing(follow);
      queryClient.invalidateQueries({ queryKey: ["/api/social/counts"] });
    },
  });

  return (
    <View style={styles.personRow}>
      {person.avatar ? (
        <Image source={{ uri: person.avatar }} style={styles.personAvatar} />
      ) : (
        <View style={[styles.personAvatar, styles.avatarFallback, { backgroundColor: theme.backgroundDefault }]}>
          <Ionicons name="person-outline" size={22} color={theme.primary} />
        </View>
      )}
      <View style={styles.personInfo}>
        <ThemedText style={styles.personName} numberOfLines={1}>
          {person.name}
        </ThemedText>
        <ThemedText style={[styles.personMeta, { color: theme.textMuted }]} numberOfLines={1}>
          {person.handle ? `@${person.handle} · ` : ""}
          {person.followers} followers
        </ThemedText>
      </View>
      <Pressable
        style={[
          styles.followButton,
          isFollowing
            ? { backgroundColor: theme.backgroundDefault }
            : { backgroundColor: "#FE2C55" },
        ]}
        disabled={followMutation.isPending}
        onPress={() => followMutation.mutate(!isFollowing)}
      >
        <ThemedText
          style={[
            styles.followButtonText,
            isFollowing ? { color: theme.text } : { color: "#FFFFFF" },
          ]}
        >
          {isFollowing ? "Following" : "Follow"}
        </ThemedText>
      </Pressable>
    </View>
  );
}

interface ActionRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  loading?: boolean;
}

function ActionRow({ icon, color, title, subtitle, onPress, loading }: ActionRowProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
      disabled={loading}
    >
      <View style={[styles.actionIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={22} color="#FFFFFF" />
      </View>
      <View style={styles.actionInfo}>
        <ThemedText style={styles.actionTitle}>{title}</ThemedText>
        <ThemedText style={[styles.actionSubtitle, { color: theme.textMuted }]}>
          {subtitle}
        </ThemedText>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={theme.primary} />
      ) : (
        <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
      )}
    </Pressable>
  );
}

export default function FindFriendsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showNearby, setShowNearby] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);
  const [contactMatches, setContactMatches] = useState<Person[] | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const isSearching = debounced.length >= 2;

  const searchQuery = useQuery<{ users: Person[] }>({
    queryKey: [`/api/social/user-search?q=${encodeURIComponent(debounced)}`],
    enabled: isSearching,
  });

  const suggestedQuery = useQuery<{ creators: Person[] }>({
    queryKey: ["/api/social/suggested-creators"],
    enabled: showNearby,
  });

  const findContactsMutation = useMutation({
    mutationFn: async (phones: string[]) => {
      const res = await apiRequest("/api/social/find-contacts", {
        method: "POST",
        body: JSON.stringify({ phones }),
        headers: { "Content-Type": "application/json" },
      });
      return res as { matches: Person[] };
    },
    onSuccess: (data) => {
      setContactMatches(data.matches);
    },
    onError: () => {
      Alert.alert("Contacts", "Couldn't check your contacts right now. Please try again.");
    },
  });

  const handleInvite = async () => {
    try {
      await Share.share({
        message: `Join me on Travony — rides with a social side. ${getApiUrl()}`,
      });
    } catch {}
  };

  const handleFindContacts = async () => {
    if (Platform.OS === "web") {
      Alert.alert("Find contacts", "Run the app in Expo Go to sync your contacts.");
      return;
    }
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) {
      if (permission.status === "denied" && !permission.canAskAgain) {
        Alert.alert(
          "Contacts permission needed",
          "Enable contact access in Settings to find friends on Travony.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Open Settings",
              onPress: async () => {
                try {
                  await Linking.openSettings();
                } catch {}
              },
            },
          ],
        );
      }
      return;
    }
    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });
    const phones: string[] = [];
    for (const contact of data) {
      for (const p of contact.phoneNumbers || []) {
        if (p.number) phones.push(p.number);
      }
    }
    if (phones.length === 0) {
      setContactMatches([]);
      return;
    }
    findContactsMutation.mutate(phones.slice(0, 2000));
  };

  const suggestions = (suggestedQuery.data?.creators || []).filter((c) => c.id !== user?.id);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: Spacing.xl,
          paddingBottom: tabBarInset + Spacing["2xl"],
          paddingHorizontal: Spacing.lg,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.searchBar, { backgroundColor: theme.backgroundDefault }]}>
          <Ionicons name="search-outline" size={20} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search by name"
            placeholderTextColor={theme.textMuted}
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={theme.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {isSearching ? (
          <View style={styles.section}>
            {searchQuery.isLoading ? (
              <ActivityIndicator color={theme.primary} style={styles.loader} />
            ) : (searchQuery.data?.users || []).length > 0 ? (
              (searchQuery.data?.users || []).map((person) => (
                <PersonRow key={person.id} person={person} />
              ))
            ) : (
              <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                No one found for "{debounced}"
              </ThemedText>
            )}
          </View>
        ) : (
          <>
            <ActionRow
              icon="radio-outline"
              color="#7C4DFF"
              title="Connect Now"
              subtitle="Find people on Travony you may know"
              onPress={() => setShowNearby((v) => !v)}
            />
            {showNearby ? (
              <View style={styles.inlineSection}>
                {suggestedQuery.isLoading ? (
                  <ActivityIndicator color={theme.primary} style={styles.loader} />
                ) : suggestions.length > 0 ? (
                  suggestions.map((person) => (
                    <PersonRow key={person.id} person={person} />
                  ))
                ) : (
                  <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                    No suggestions right now — share a ride to meet people
                  </ThemedText>
                )}
              </View>
            ) : null}

            <ActionRow
              icon="qr-code-outline"
              color="#FF9800"
              title="Use QR code"
              subtitle="Show your code or scan a friend's"
              onPress={() => setQrVisible(true)}
            />

            <ActionRow
              icon="share-social-outline"
              color="#FFC107"
              title="Invite friends"
              subtitle="Share Travony with your friends"
              onPress={handleInvite}
            />

            <ActionRow
              icon="call-outline"
              color={theme.primary}
              title="Find contacts"
              subtitle="See which of your contacts are on Travony"
              onPress={handleFindContacts}
              loading={findContactsMutation.isPending}
            />
            {contactMatches !== null ? (
              <View style={styles.inlineSection}>
                <ThemedText style={[styles.sectionHeader, { color: theme.textSecondary }]}>
                  {contactMatches.length > 0
                    ? `${contactMatches.length} contact${contactMatches.length === 1 ? "" : "s"} on Travony`
                    : "None of your contacts are on Travony yet"}
                </ThemedText>
                {contactMatches.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      <QRCodeSheet visible={qrVisible} onClose={() => setQrVisible(false)} initialMode="scan" />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
  },
  section: {
    marginTop: Spacing.sm,
  },
  inlineSection: {
    paddingLeft: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    ...Typography.bodySmallMedium,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  loader: {
    marginVertical: Spacing.xl,
  },
  emptyText: {
    ...Typography.bodySmall,
    textAlign: "center",
    marginVertical: Spacing.xl,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  actionInfo: {
    flex: 1,
  },
  actionTitle: {
    ...Typography.bodyMedium,
  },
  actionSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  personInfo: {
    flex: 1,
  },
  personName: {
    ...Typography.bodyMedium,
  },
  personMeta: {
    ...Typography.small,
    marginTop: 2,
  },
  followButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  followButtonText: {
    ...Typography.bodySmallMedium,
  },
});
