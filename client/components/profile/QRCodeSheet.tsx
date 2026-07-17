import React, { useState } from "react";
import {
  View,
  StyleSheet,
  Modal,
  Pressable,
  Image,
  Platform,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import QRCode from "react-native-qrcode-svg";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

interface QRCodeSheetProps {
  visible: boolean;
  onClose: () => void;
  initialMode?: "code" | "scan";
}

interface UserPreview {
  id: string;
  name: string;
  avatar: string | null;
  bio: string | null;
  handle: string;
  isSelf: boolean;
  followers: number;
  rides: number;
  isFollowing: boolean;
}

function parseScannedUserId(data: string): string | null {
  const match = /travony:\/\/user\/([A-Za-z0-9-]+)/.exec(data);
  if (match) return match[1];
  if (/^[A-Za-z0-9-]{10,}$/.test(data.trim())) return data.trim();
  return null;
}

export default function QRCodeSheet({ visible, onClose, initialMode = "code" }: QRCodeSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [mode, setMode] = useState<"code" | "scan">(initialMode);
  const [scannedId, setScannedId] = useState<string | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  React.useEffect(() => {
    if (visible) {
      setMode(initialMode);
      setScannedId(null);
    }
  }, [visible, initialMode]);

  const countsQuery = useQuery<{ handle: string | null }>({
    queryKey: ["/api/social/counts"],
    enabled: visible && !!user,
  });

  const previewQuery = useQuery<UserPreview>({
    queryKey: [`/api/social/users/${scannedId}/preview`],
    enabled: !!scannedId,
  });

  const followMutation = useMutation({
    mutationFn: async ({ userId, follow }: { userId: string; follow: boolean }) => {
      await apiRequest(`/api/social/follow/${userId}`, {
        method: follow ? "POST" : "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/social/users/${scannedId}/preview`] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/counts"] });
    },
  });

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scannedId) return;
    const id = parseScannedUserId(data);
    if (id) setScannedId(id);
  };

  const renderScanTab = () => {
    if (Platform.OS === "web") {
      return (
        <View style={styles.scanFallback}>
          <Ionicons name="camera-outline" size={44} color={theme.textMuted} />
          <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
            Run the app in Expo Go to scan QR codes
          </ThemedText>
        </View>
      );
    }
    if (!permission) {
      return <View style={styles.scanFallback} />;
    }
    if (!permission.granted) {
      if (permission.status === "denied" && !permission.canAskAgain) {
        return (
          <View style={styles.scanFallback}>
            <Ionicons name="camera-outline" size={44} color={theme.textMuted} />
            <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
              Camera permission is required to scan QR codes
            </ThemedText>
            <Pressable
              style={[styles.primaryButton, { backgroundColor: theme.primary }]}
              onPress={async () => {
                try {
                  await Linking.openSettings();
                } catch {}
              }}
            >
              <ThemedText style={styles.primaryButtonText}>Open Settings</ThemedText>
            </Pressable>
          </View>
        );
      }
      return (
        <View style={styles.scanFallback}>
          <Ionicons name="camera-outline" size={44} color={theme.textMuted} />
          <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
            Allow camera access to scan a friend's Travony code
          </ThemedText>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: theme.primary }]}
            onPress={requestPermission}
          >
            <ThemedText style={styles.primaryButtonText}>Enable Camera</ThemedText>
          </Pressable>
        </View>
      );
    }
    if (scannedId) {
      const preview = previewQuery.data;
      return (
        <View style={styles.previewWrap}>
          {previewQuery.isLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : preview ? (
            <View style={[styles.previewCard, { backgroundColor: theme.backgroundElevated }]}>
              {preview.avatar ? (
                <Image source={{ uri: preview.avatar }} style={styles.previewAvatar} />
              ) : (
                <View style={[styles.previewAvatar, styles.avatarFallback, { backgroundColor: theme.backgroundDefault }]}>
                  <Ionicons name="person-outline" size={30} color={theme.primary} />
                </View>
              )}
              <ThemedText style={styles.previewName}>{preview.name}</ThemedText>
              <ThemedText style={[styles.previewHandle, { color: theme.textMuted }]}>
                @{preview.handle}
              </ThemedText>
              {preview.bio ? (
                <ThemedText style={[styles.previewBio, { color: theme.textSecondary }]} numberOfLines={2}>
                  {preview.bio}
                </ThemedText>
              ) : null}
              <ThemedText style={[styles.previewMeta, { color: theme.textSecondary }]}>
                {preview.followers} followers · {preview.rides} rides shared
              </ThemedText>
              {preview.isSelf ? (
                <ThemedText style={[styles.previewMeta, { color: theme.textMuted }]}>
                  This is your own code
                </ThemedText>
              ) : (
                <Pressable
                  style={[
                    styles.primaryButton,
                    preview.isFollowing
                      ? { backgroundColor: theme.backgroundDefault }
                      : { backgroundColor: theme.primary },
                  ]}
                  disabled={followMutation.isPending}
                  onPress={() =>
                    followMutation.mutate({ userId: preview.id, follow: !preview.isFollowing })
                  }
                >
                  <ThemedText
                    style={[
                      styles.primaryButtonText,
                      preview.isFollowing ? { color: theme.text } : null,
                    ]}
                  >
                    {preview.isFollowing ? "Following" : "Follow"}
                  </ThemedText>
                </Pressable>
              )}
            </View>
          ) : (
            <ThemedText style={[styles.fallbackText, { color: theme.textSecondary }]}>
              Couldn't find that profile
            </ThemedText>
          )}
          <Pressable style={styles.scanAgain} onPress={() => setScannedId(null)}>
            <ThemedText style={[styles.scanAgainText, { color: theme.primary }]}>
              Scan again
            </ThemedText>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <ThemedText style={[styles.scanHint, { color: theme.textSecondary }]}>
          Point at a friend's Travony code
        </ThemedText>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot, paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={12}>
            <Ionicons name="close-outline" size={28} color={theme.text} />
          </Pressable>
          <ThemedText style={styles.title}>QR code</ThemedText>
          <View style={{ width: 28 }} />
        </View>

        <View style={[styles.segment, { backgroundColor: theme.backgroundDefault }]}>
          <Pressable
            style={[
              styles.segmentItem,
              mode === "code" ? { backgroundColor: theme.backgroundElevated } : null,
            ]}
            onPress={() => setMode("code")}
          >
            <ThemedText
              style={[styles.segmentText, mode === "code" ? null : { color: theme.textMuted }]}
            >
              My code
            </ThemedText>
          </Pressable>
          <Pressable
            style={[
              styles.segmentItem,
              mode === "scan" ? { backgroundColor: theme.backgroundElevated } : null,
            ]}
            onPress={() => setMode("scan")}
          >
            <ThemedText
              style={[styles.segmentText, mode === "scan" ? null : { color: theme.textMuted }]}
            >
              Scan
            </ThemedText>
          </Pressable>
        </View>

        {mode === "code" ? (
          <View style={styles.codeWrap}>
            <View style={[styles.codeCard, { backgroundColor: theme.backgroundElevated }]}>
              {user?.avatar ? (
                <Image source={{ uri: user.avatar }} style={styles.codeAvatar} />
              ) : (
                <View style={[styles.codeAvatar, styles.avatarFallback, { backgroundColor: theme.backgroundDefault }]}>
                  <Ionicons name="person-outline" size={26} color={theme.primary} />
                </View>
              )}
              <ThemedText style={styles.codeName}>{user?.name || "Traveller"}</ThemedText>
              {countsQuery.data?.handle ? (
                <ThemedText style={[styles.codeHandle, { color: theme.textMuted }]}>
                  @{countsQuery.data.handle}
                </ThemedText>
              ) : null}
              <View style={styles.qrBox}>
                {user?.id ? (
                  <QRCode value={`travony://user/${user.id}`} size={190} backgroundColor="transparent" color={theme.text} />
                ) : null}
              </View>
              <ThemedText style={[styles.codeHint, { color: theme.textSecondary }]}>
                Friends can scan this to follow you on Travony
              </ThemedText>
            </View>
          </View>
        ) : (
          renderScanTab()
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h4,
  },
  segment: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 3,
    marginBottom: Spacing.xl,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md - 2,
    alignItems: "center",
  },
  segmentText: {
    ...Typography.bodySmallMedium,
  },
  codeWrap: {
    flex: 1,
    alignItems: "center",
  },
  codeCard: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  codeAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  codeName: {
    ...Typography.h4,
    marginTop: Spacing.md,
  },
  codeHandle: {
    ...Typography.bodySmallMedium,
    marginTop: 2,
  },
  qrBox: {
    marginVertical: Spacing["2xl"],
  },
  codeHint: {
    ...Typography.small,
    textAlign: "center",
  },
  cameraWrap: {
    flex: 1,
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    marginBottom: Spacing["2xl"],
  },
  camera: {
    flex: 1,
  },
  scanHint: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  scanFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  fallbackText: {
    ...Typography.body,
    textAlign: "center",
  },
  primaryButton: {
    paddingHorizontal: Spacing["2xl"],
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    marginTop: Spacing.md,
  },
  primaryButtonText: {
    ...Typography.bodySmallMedium,
    color: Colors.light.textOnPrimary,
  },
  previewWrap: {
    flex: 1,
    alignItems: "center",
    paddingTop: Spacing["2xl"],
  },
  previewCard: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    alignItems: "center",
    padding: Spacing["2xl"],
  },
  previewAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  previewName: {
    ...Typography.h4,
    marginTop: Spacing.md,
  },
  previewHandle: {
    ...Typography.bodySmallMedium,
    marginTop: 2,
  },
  previewBio: {
    ...Typography.bodySmall,
    textAlign: "center",
    marginTop: Spacing.sm,
  },
  previewMeta: {
    ...Typography.small,
    marginTop: Spacing.sm,
  },
  scanAgain: {
    marginTop: Spacing.xl,
  },
  scanAgainText: {
    ...Typography.bodySmallMedium,
  },
});
