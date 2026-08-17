import React, { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

/**
 * SafetyBookmarkButton — one tap pins "this moment" to the ride's safety
 * timeline. Works for the rider and the driver during an active ride; if the
 * ride is being streamed, the pin carries the stream offset so the moment can
 * be reviewed against the footage later. Server enforces participant auth and
 * a per-user cooldown; this component only mirrors the cooldown for UX.
 */
export function SafetyBookmarkButton({
  rideId,
  compact = false,
}: {
  rideId: string;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const cooldownRef = useRef(0);

  const handlePress = async () => {
    const now = Date.now();
    if (state === "saving" || now - cooldownRef.current < 10000) return;
    cooldownRef.current = now;
    setState("saving");
    try {
      await apiRequest(`/api/rides/${rideId}/safety/bookmark`, { method: "POST" });
      setState("saved");
    } catch {
      // Never claim a pin that didn't land — show a retryable failure state
      // and lift the local cooldown so the user can try again immediately.
      cooldownRef.current = 0;
      setState("failed");
    }
    setTimeout(() => setState("idle"), 3000);
  };

  const saved = state === "saved";
  const failed = state === "failed";
  if (compact) {
    return (
      <Pressable
        style={[
          styles.compactBtn,
          { backgroundColor: saved ? theme.primary : theme.card },
        ]}
        onPress={handlePress}
        accessibilityLabel="Bookmark this moment"
      >
        <Ionicons
          name={failed ? "alert-circle-outline" : saved ? "bookmark" : "bookmark-outline"}
          size={22}
          color={saved ? theme.textOnPrimary : failed ? theme.error : theme.primary}
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[
        styles.chip,
        {
          backgroundColor: saved ? theme.primary + "20" : theme.backgroundDefault,
          borderColor: saved ? theme.primary : theme.border,
        },
      ]}
      onPress={handlePress}
      accessibilityLabel="Bookmark this moment"
    >
      <Ionicons
        name={failed ? "alert-circle-outline" : saved ? "bookmark" : "bookmark-outline"}
        size={16}
        color={failed ? theme.error : theme.primary}
      />
      <ThemedText style={[styles.chipText, { color: failed ? theme.error : theme.primary }]}>
        {failed ? "Couldn't pin — tap to retry" : saved ? "Moment pinned" : "Bookmark moment"}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  chipText: {
    ...Typography.small,
    fontWeight: "600",
  },
  compactBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
});
