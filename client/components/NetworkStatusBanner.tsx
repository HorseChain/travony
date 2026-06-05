import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";

import { ThemedText } from "@/components/ThemedText";
import { useLiteMode } from "@/hooks/useLiteMode";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

/**
 * App-wide connectivity banner. While the device is offline it shows a clear
 * "Reconnecting…" state instead of letting screens silently spin or crash.
 * When the connection comes back it briefly confirms "Back online" then hides.
 */
export function NetworkStatusBanner() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useLiteMode();
  const [visible, setVisible] = useState(false);
  const [recovered, setRecovered] = useState(false);
  const wasOnline = useRef(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isOnline) {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setRecovered(false);
      setVisible(true);
      wasOnline.current = false;
    } else if (!wasOnline.current) {
      wasOnline.current = true;
      setRecovered(true);
      setVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setVisible(false), 2200);
    }
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [isOnline]);

  if (!visible) return null;

  const bg = recovered ? Colors.travonyGreen : "#B23B3B";
  const top = insets.top + Spacing.xs;

  return (
    <View style={[styles.wrap, { top }]} pointerEvents="none">
      <View style={[styles.banner, { backgroundColor: bg }]}>
        <Ionicons
          name={recovered ? "checkmark-circle-outline" : "cloud-offline-outline"}
          size={16}
          color="#FFFFFF"
        />
        <ThemedText style={styles.text}>
          {recovered ? "Back online" : "Reconnecting…"}
        </ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.full ?? 999,
  },
  text: {
    ...Typography.small,
    color: "#FFFFFF",
    fontWeight: "600",
  },
});
