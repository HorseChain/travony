import React, { useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  TextInput,
  ActivityIndicator,
  Image,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as ImagePicker from "expo-image-picker";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest } from "@/lib/query-client";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";

function getScoreColor(score: number, theme: any): string {
  if (score > 75) return theme.success;
  if (score >= 50) return theme.warning;
  return theme.error;
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

export default function RideTruthScreen() {
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState("");
  const [city, setCity] = useState("");
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [screenshotUri, setScreenshotUri] = useState<string | null>(null);
  const [priceMatched, setPriceMatched] = useState<boolean | null>(null);
  const [driverCancelled, setDriverCancelled] = useState<boolean | null>(null);
  const [arrivedOnTime, setArrivedOnTime] = useState<boolean | null>(null);
  const [rankingCity, setRankingCity] = useState("");

  const { data: consentData, isLoading: consentLoading } = useQuery<any>({
    queryKey: ["/api/truth/consent"],
  });

  const hasConsented = consentData?.hasConsent === true || consentData?.consented === true;

  const { data: myRides, isLoading: ridesLoading } = useQuery<any>({
    queryKey: ["/api/truth/my-rides"],
    enabled: hasConsented,
  });

  const { data: rankings, isLoading: rankingsLoading } = useQuery<any>({
    queryKey: ["/api/truth/rankings", rankingCity ? `?city=${rankingCity}` : null],
    enabled: hasConsented && rankingCity.trim().length > 0,
  });

  const consentMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/truth/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truth/consent"] });
    },
  });

  const logRideMutation = useMutation({
    mutationFn: async (body: any) =>
      apiRequest("/api/truth/rides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truth/my-rides"] });
      setProvider("");
      setCity("");
      setScreenshotBase64(null);
      setScreenshotUri(null);
      setPriceMatched(null);
      setDriverCancelled(null);
      setArrivedOnTime(null);
      if (Platform.OS === "web") {
        window.alert("Ride logged successfully!");
      } else {
        Alert.alert("Success", "Ride logged successfully!");
      }
    },
    onError: (error: Error) => {
      if (Platform.OS === "web") {
        window.alert(error.message || "Failed to log ride.");
      } else {
        Alert.alert("Error", error.message || "Failed to log ride.");
      }
    },
  });

  const deleteDataMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/truth/my-data", {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truth/my-rides"] });
      queryClient.invalidateQueries({ queryKey: ["/api/truth/consent"] });
      if (Platform.OS === "web") {
        window.alert("Your data has been deleted.");
      } else {
        Alert.alert("Done", "Your data has been deleted.");
      }
    },
  });

  const revokeConsentMutation = useMutation({
    mutationFn: async () =>
      apiRequest("/api/truth/consent", {
        method: "DELETE",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/truth/consent"] });
      queryClient.invalidateQueries({ queryKey: ["/api/truth/my-rides"] });
    },
  });

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      setScreenshotBase64(result.assets[0].base64 ?? null);
      setScreenshotUri(result.assets[0].uri);
    }
  };

  const handleSubmitRide = () => {
    if (!provider.trim()) {
      if (Platform.OS === "web") {
        window.alert("Please enter a provider name.");
      } else {
        Alert.alert("Missing Info", "Please enter a provider name.");
      }
      return;
    }
    if (!city.trim()) {
      if (Platform.OS === "web") {
        window.alert("Please enter a city name.");
      } else {
        Alert.alert("Missing Info", "Please enter a city name.");
      }
      return;
    }

    logRideMutation.mutate({
      provider: provider.trim(),
      city: city.trim(),
      screenshot: screenshotBase64,
      priceMatched,
      driverCancelled,
      arrivedOnTime,
    });
  };

  const handleDeleteData = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Are you sure you want to delete all your Truth Engine data? This cannot be undone."
      );
      if (confirmed) deleteDataMutation.mutate();
    } else {
      Alert.alert(
        "Delete My Data",
        "Are you sure you want to delete all your Truth Engine data? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => deleteDataMutation.mutate(),
          },
        ]
      );
    }
  };

  const handleRevokeConsent = () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Revoking consent will remove your participation from the Truth Engine. Continue?"
      );
      if (confirmed) revokeConsentMutation.mutate();
    } else {
      Alert.alert(
        "Revoke Consent",
        "Revoking consent will remove your participation from the Truth Engine. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Revoke",
            style: "destructive",
            onPress: () => revokeConsentMutation.mutate(),
          },
        ]
      );
    }
  };

  const renderQuickQuestion = (
    label: string,
    value: boolean | null,
    onToggle: (val: boolean) => void
  ) => (
    <View style={styles.questionRow}>
      <ThemedText style={[styles.questionLabel, { color: theme.textSecondary }]}>
        {label}
      </ThemedText>
      <View style={styles.questionButtons}>
        <Pressable
          style={[
            styles.questionBtn,
            {
              backgroundColor:
                value === true ? theme.success + "30" : theme.backgroundDefault,
              borderColor: value === true ? theme.success : theme.border,
            },
          ]}
          onPress={() => onToggle(true)}
        >
          <ThemedText
            style={[
              styles.questionBtnText,
              { color: value === true ? theme.success : theme.textSecondary },
            ]}
          >
            Yes
          </ThemedText>
        </Pressable>
        <Pressable
          style={[
            styles.questionBtn,
            {
              backgroundColor:
                value === false ? theme.error + "30" : theme.backgroundDefault,
              borderColor: value === false ? theme.error : theme.border,
            },
          ]}
          onPress={() => onToggle(false)}
        >
          <ThemedText
            style={[
              styles.questionBtnText,
              { color: value === false ? theme.error : theme.textSecondary },
            ]}
          >
            No
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );

  if (consentLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: insets.bottom + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      {!hasConsented ? (
        <Card style={styles.consentCard}>
          <View style={styles.consentHeader}>
            <View
              style={[
                styles.consentIconContainer,
                { backgroundColor: theme.primary + "20" },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={28} color={theme.primary} />
            </View>
            <ThemedText type="h3" style={styles.consentTitle}>
              Ride Truth Engine
            </ThemedText>
          </View>
          <ThemedText
            style={[styles.consentDescription, { color: theme.textSecondary }]}
          >
            The Ride Truth Engine is a platform-agnostic, crowd-sourced reliability scoring system. Log rides from any provider (Uber, Careem, Bolt, Lyft, and more) to contribute anonymous data that helps everyone make better choices.
          </ThemedText>

          <View style={styles.consentFeatures}>
            <View style={styles.consentFeatureRow}>
              <Ionicons name="analytics-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.consentFeatureText, { color: theme.textSecondary }]}>
                Compare providers by price accuracy, pickup reliability, cancellation rates, and support quality
              </ThemedText>
            </View>
            <View style={styles.consentFeatureRow}>
              <Ionicons name="eye-off-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.consentFeatureText, { color: theme.textSecondary }]}>
                All data is fully anonymized - your identity is never linked to scores or rankings
              </ThemedText>
            </View>
            <View style={styles.consentFeatureRow}>
              <Ionicons name="shield-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.consentFeatureText, { color: theme.textSecondary }]}>
                Anti-fraud protections ensure data integrity with per-user caps and anomaly detection
              </ThemedText>
            </View>
            <View style={styles.consentFeatureRow}>
              <Ionicons name="trash-outline" size={18} color={theme.primary} />
              <ThemedText style={[styles.consentFeatureText, { color: theme.textSecondary }]}>
                You can revoke consent or delete all your data at any time - no impact on your rides
              </ThemedText>
            </View>
          </View>

          <ThemedText
            style={[styles.consentLegal, { color: theme.textMuted }]}
          >
            By joining, you agree to the Ride Truth Engine terms in our Terms of Service and Privacy Policy.
          </ThemedText>

          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: theme.primary },
              consentMutation.isPending && styles.buttonDisabled,
            ]}
            onPress={() => consentMutation.mutate()}
            disabled={consentMutation.isPending}
          >
            {consentMutation.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <ThemedText style={[styles.primaryButtonText, { color: "#FFFFFF" }]}>
                Join the Truth Engine
              </ThemedText>
            )}
          </Pressable>
        </Card>
      ) : null}

      {hasConsented ? (
        <>
          <View style={styles.sectionHeader}>
            <Ionicons name="create-outline" size={22} color={theme.primary} />
            <ThemedText type="h3" style={styles.sectionTitle}>
              Log a Ride
            </ThemedText>
          </View>
          <Card style={styles.formCard}>
            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Provider Name
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="e.g. Uber, Lyft, Bolt"
              placeholderTextColor={theme.textMuted}
              value={provider}
              onChangeText={setProvider}
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              City
            </ThemedText>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="e.g. Mexico City"
              placeholderTextColor={theme.textMuted}
              value={city}
              onChangeText={setCity}
            />

            <ThemedText style={[styles.inputLabel, { color: theme.textSecondary }]}>
              Receipt Screenshot (optional)
            </ThemedText>
            <Pressable
              style={[
                styles.uploadButton,
                {
                  backgroundColor: theme.backgroundDefault,
                  borderColor: theme.border,
                },
              ]}
              onPress={handlePickImage}
            >
              {screenshotUri ? (
                <Image source={{ uri: screenshotUri }} style={styles.screenshotPreview} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="camera-outline" size={24} color={theme.textMuted} />
                  <ThemedText
                    style={[styles.uploadText, { color: theme.textMuted }]}
                  >
                    Tap to upload screenshot
                  </ThemedText>
                </View>
              )}
            </Pressable>

            <ThemedText
              style={[styles.inputLabel, { color: theme.textSecondary, marginTop: Spacing.lg }]}
            >
              Quick Questions
            </ThemedText>
            {renderQuickQuestion("Price matched the estimate?", priceMatched, setPriceMatched)}
            {renderQuickQuestion("Driver cancelled on you?", driverCancelled, setDriverCancelled)}
            {renderQuickQuestion("Driver arrived on time?", arrivedOnTime, setArrivedOnTime)}

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: theme.primary, marginTop: Spacing.xl },
                logRideMutation.isPending && styles.buttonDisabled,
              ]}
              onPress={handleSubmitRide}
              disabled={logRideMutation.isPending}
            >
              {logRideMutation.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <ThemedText style={[styles.primaryButtonText, { color: "#FFFFFF" }]}>
                  Submit Ride
                </ThemedText>
              )}
            </Pressable>
          </Card>

          <View style={styles.sectionHeader}>
            <Ionicons name="star-outline" size={22} color={theme.primary} />
            <ThemedText type="h3" style={styles.sectionTitle}>
              My Ride Scores
            </ThemedText>
          </View>
          <Card style={styles.listCard}>
            {ridesLoading ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : myRides?.length > 0 ? (
              (myRides as any[]).map((ride: any, index: number) => (
                <View key={ride.id || index}>
                  {index > 0 ? (
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  ) : null}
                  <View style={styles.rideRow}>
                    <View style={styles.rideInfo}>
                      <ThemedText style={styles.rideProvider}>
                        {ride.provider}
                      </ThemedText>
                      <ThemedText
                        style={[styles.rideDate, { color: theme.textMuted }]}
                      >
                        {formatDate(ride.createdAt || ride.date)}
                      </ThemedText>
                    </View>
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor:
                            getScoreColor(ride.score ?? 0, theme) + "20",
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.scoreText,
                          { color: getScoreColor(ride.score ?? 0, theme) },
                        ]}
                      >
                        {ride.score ?? "--"}/100
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={32} color={theme.textMuted} />
                <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                  No rides logged yet. Submit your first ride above.
                </ThemedText>
              </View>
            )}
          </Card>

          <View style={styles.sectionHeader}>
            <Ionicons name="trophy-outline" size={22} color={theme.primary} />
            <ThemedText type="h3" style={styles.sectionTitle}>
              Provider Rankings
            </ThemedText>
          </View>
          <Card style={styles.formCard}>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: theme.backgroundDefault,
                  color: theme.text,
                  borderColor: theme.border,
                },
              ]}
              placeholder="Enter city to see rankings"
              placeholderTextColor={theme.textMuted}
              value={rankingCity}
              onChangeText={setRankingCity}
              returnKeyType="search"
            />
            {rankingsLoading ? (
              <ActivityIndicator
                size="small"
                color={theme.primary}
                style={{ marginTop: Spacing.lg }}
              />
            ) : rankings?.length > 0 ? (
              (rankings as any[]).map((entry: any, index: number) => (
                <View key={entry.provider || index}>
                  {index > 0 ? (
                    <View style={[styles.divider, { backgroundColor: theme.border }]} />
                  ) : null}
                  <View style={styles.rankingRow}>
                    <View
                      style={[
                        styles.rankBadge,
                        { backgroundColor: theme.primary + "20" },
                      ]}
                    >
                      <ThemedText
                        style={[styles.rankNumber, { color: theme.primary }]}
                      >
                        #{index + 1}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.rankProvider}>
                      {entry.provider}
                    </ThemedText>
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor:
                            getScoreColor(entry.score ?? 0, theme) + "20",
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.scoreText,
                          { color: getScoreColor(entry.score ?? 0, theme) },
                        ]}
                      >
                        {entry.score ?? "--"}/100
                      </ThemedText>
                    </View>
                  </View>
                </View>
              ))
            ) : rankingCity.trim().length > 0 && !rankingsLoading ? (
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={32} color={theme.textMuted} />
                <ThemedText style={[styles.emptyText, { color: theme.textMuted }]}>
                  No rankings found for this city yet.
                </ThemedText>
              </View>
            ) : null}
          </Card>

          <View style={styles.sectionHeader}>
            <Ionicons name="lock-closed-outline" size={22} color={theme.primary} />
            <ThemedText type="h3" style={styles.sectionTitle}>
              Privacy Settings
            </ThemedText>
          </View>
          <Card style={{ ...styles.menuCard, padding: 0, overflow: "hidden" }}>
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleDeleteData}
              disabled={deleteDataMutation.isPending}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: theme.error + "20" },
                ]}
              >
                <Ionicons name="trash-outline" size={20} color={theme.error} />
              </View>
              <ThemedText style={[styles.menuItemText, { color: theme.error }]}>
                {deleteDataMutation.isPending ? "Deleting..." : "Delete My Data"}
              </ThemedText>
            </Pressable>
            <View
              style={[
                styles.menuDivider,
                { backgroundColor: theme.border },
              ]}
            />
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                { opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={handleRevokeConsent}
              disabled={revokeConsentMutation.isPending}
            >
              <View
                style={[
                  styles.menuIconContainer,
                  { backgroundColor: theme.warning + "20" },
                ]}
              >
                <Ionicons name="hand-left-outline" size={20} color={theme.warning} />
              </View>
              <ThemedText style={[styles.menuItemText, { color: theme.warning }]}>
                {revokeConsentMutation.isPending ? "Revoking..." : "Revoke Consent"}
              </ThemedText>
            </Pressable>
          </Card>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  consentCard: {
    marginBottom: Spacing.lg,
  },
  consentHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  consentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  consentTitle: {
    flex: 1,
  },
  consentDescription: {
    ...Typography.bodyMedium,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  consentFeatures: {
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  consentFeatureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  consentFeatureText: {
    ...Typography.bodyMedium,
    flex: 1,
    lineHeight: 20,
  },
  consentLegal: {
    ...Typography.small,
    lineHeight: 18,
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
    marginTop: Spacing.lg,
  },
  sectionTitle: {
    marginLeft: Spacing.sm,
  },
  formCard: {
    marginBottom: Spacing.lg,
  },
  listCard: {
    marginBottom: Spacing.lg,
  },
  inputLabel: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  textInput: {
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderRadius: BorderRadius.xs,
    paddingHorizontal: Spacing.lg,
    ...Typography.body,
  },
  uploadButton: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: BorderRadius.xs,
    minHeight: 100,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  uploadPlaceholder: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  uploadText: {
    ...Typography.bodyMedium,
    marginTop: Spacing.sm,
  },
  screenshotPreview: {
    width: "100%",
    height: 200,
    resizeMode: "contain",
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
  },
  questionLabel: {
    ...Typography.bodyMedium,
    flex: 1,
    marginRight: Spacing.md,
  },
  questionButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  questionBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.xs,
    borderWidth: 1,
    minWidth: 56,
    alignItems: "center",
  },
  questionBtnText: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    ...Typography.button,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  rideRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  rideInfo: {
    flex: 1,
  },
  rideProvider: {
    ...Typography.body,
    fontWeight: "600",
  },
  rideDate: {
    ...Typography.small,
    marginTop: 2,
  },
  scoreBadge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.xs,
  },
  scoreText: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  rankingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  rankNumber: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  rankProvider: {
    ...Typography.body,
    fontWeight: "600",
    flex: 1,
  },
  divider: {
    height: 1,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["2xl"],
  },
  emptyText: {
    ...Typography.bodyMedium,
    marginTop: Spacing.sm,
    textAlign: "center",
  },
  menuCard: {
    marginBottom: Spacing.lg,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  menuItemText: {
    ...Typography.body,
    flex: 1,
  },
  menuDivider: {
    height: 1,
    marginLeft: Spacing.lg + 40 + Spacing.md,
  },
});
