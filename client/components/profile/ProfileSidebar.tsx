import React from "react";
import { View, StyleSheet, Modal, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import Animated, { SlideInRight, FadeIn } from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography } from "@/constants/theme";

interface ProfileSidebarProps {
  visible: boolean;
  onClose: () => void;
  balanceTitle: string;
  balanceValue?: string | null;
  onBalance: () => void;
  onRewards: () => void;
  onActivity: () => void;
  onQRCode: () => void;
  onSettings: () => void;
}

interface RowProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  onPress: () => void;
}

function SidebarRow({ icon, label, value, onPress }: RowProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={22} color={theme.text} />
      <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      {value ? (
        <ThemedText style={[styles.rowValue, { color: theme.textSecondary }]} numberOfLines={1}>
          {value}
        </ThemedText>
      ) : null}
      <Ionicons name="chevron-forward-outline" size={18} color={theme.textMuted} />
    </Pressable>
  );
}

export default function ProfileSidebar({
  visible,
  onClose,
  balanceTitle,
  balanceValue,
  onBalance,
  onRewards,
  onActivity,
  onQRCode,
  onSettings,
}: ProfileSidebarProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeIn.duration(160)} style={StyleSheet.absoluteFillObject}>
          <Pressable style={[styles.backdrop]} onPress={onClose} />
        </Animated.View>
        <Animated.View
          entering={SlideInRight.duration(220)}
          style={[
            styles.panel,
            {
              backgroundColor: theme.backgroundElevated,
              paddingTop: insets.top + Spacing.xl,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <ThemedText style={[styles.sectionHeader, { color: theme.textMuted }]}>
            Assets
          </ThemedText>
          <SidebarRow
            icon="wallet-outline"
            label={balanceTitle}
            value={balanceValue}
            onPress={() => {
              onClose();
              onBalance();
            }}
          />
          <SidebarRow
            icon="gift-outline"
            label="Rewards"
            onPress={() => {
              onClose();
              onRewards();
            }}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <ThemedText style={[styles.sectionHeader, { color: theme.textMuted }]}>
            Personal tools
          </ThemedText>
          <SidebarRow
            icon="pulse-outline"
            label="Activity centre"
            onPress={() => {
              onClose();
              onActivity();
            }}
          />
          <SidebarRow
            icon="qr-code-outline"
            label="Your QR code"
            onPress={() => {
              onClose();
              onQRCode();
            }}
          />

          <View style={[styles.divider, { backgroundColor: theme.border }]} />

          <SidebarRow
            icon="settings-outline"
            label="Settings and privacy"
            onPress={() => {
              onClose();
              onSettings();
            }}
          />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    width: "76%",
    maxWidth: 340,
    height: "100%",
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    ...Typography.small,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    gap: Spacing.md,
  },
  rowLabel: {
    ...Typography.body,
    flex: 1,
  },
  rowValue: {
    ...Typography.bodySmallMedium,
    maxWidth: 120,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
  },
});
