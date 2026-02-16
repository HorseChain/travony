import { View, StyleSheet, ScrollView, Switch, Pressable, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import Slider from "@react-native-community/slider";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface SettingItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  type: "toggle" | "button";
  value?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
}

export default function DriverAppSettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();

  const [pushNotifications, setPushNotifications] = useState(true);
  const [rideAlerts, setRideAlerts] = useState(true);
  const [earningsUpdates, setEarningsUpdates] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [vibration, setVibration] = useState(true);
  
  // Rating filter settings
  const [ratingFilterEnabled, setRatingFilterEnabled] = useState(false);
  const [minRiderRating, setMinRiderRating] = useState(4.0);

  // Fetch current driver settings
  const { data: driverData } = useQuery<any>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  useEffect(() => {
    if (driverData) {
      setRatingFilterEnabled(driverData.minRiderRatingEnabled || false);
      setMinRiderRating(parseFloat(driverData.minRiderRating || "4.0"));
    }
  }, [driverData]);

  // Update rating filter mutation
  const updateRatingFilter = useMutation({
    mutationFn: async (data: { enabled: boolean; minRating: number }) => {
      const driverId = driverData?.id;
      if (!driverId) throw new Error("Driver not found");
      
      return apiRequest(`/api/drivers/${driverId}/rating-filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: data.enabled,
          minRating: data.minRating,
        }),
      });
    },
    onError: (error: any) => {
      Alert.alert("Error", error.message || "Failed to update rating filter");
    },
  });

  const handleRatingFilterToggle = (enabled: boolean) => {
    setRatingFilterEnabled(enabled);
    updateRatingFilter.mutate({ enabled, minRating: minRiderRating });
  };

  const handleMinRatingChange = (rating: number) => {
    const roundedRating = Math.round(rating * 10) / 10;
    setMinRiderRating(roundedRating);
  };

  const handleMinRatingSlidingComplete = (rating: number) => {
    const roundedRating = Math.round(rating * 10) / 10;
    if (ratingFilterEnabled) {
      updateRatingFilter.mutate({ enabled: true, minRating: roundedRating });
    }
  };

  const showComingSoon = () => {
    const msg = "This feature is coming soon!";
    if (Platform.OS === "web") {
      window.alert(msg);
    } else {
      Alert.alert("Coming Soon", msg);
    }
  };

  const notificationSettings: SettingItem[] = [
    {
      icon: "notifications-outline",
      label: "Push Notifications",
      subtitle: "Receive route requests and updates",
      type: "toggle",
      value: pushNotifications,
      onToggle: setPushNotifications,
    },
    {
      icon: "car-outline",
      label: "Route Alerts",
      subtitle: "Get notified of new route requests",
      type: "toggle",
      value: rideAlerts,
      onToggle: setRideAlerts,
    },
    {
      icon: "cash-outline",
      label: "Earnings Updates",
      subtitle: "Receive payment and payout notifications",
      type: "toggle",
      value: earningsUpdates,
      onToggle: setEarningsUpdates,
    },
  ];

  const soundSettings: SettingItem[] = [
    {
      icon: "volume-high-outline",
      label: "Sound Effects",
      subtitle: "Play sounds for ride alerts",
      type: "toggle",
      value: soundEffects,
      onToggle: setSoundEffects,
    },
    {
      icon: "phone-portrait-outline",
      label: "Vibration",
      subtitle: "Vibrate for important alerts",
      type: "toggle",
      value: vibration,
      onToggle: setVibration,
    },
  ];

  const generalSettings: SettingItem[] = [
    {
      icon: "language-outline",
      label: "Language",
      subtitle: "English",
      type: "button",
      onPress: showComingSoon,
    },
    {
      icon: "moon-outline",
      label: "Dark Mode",
      subtitle: "Follow system settings",
      type: "button",
      onPress: showComingSoon,
    },
    {
      icon: "location-outline",
      label: "Location Services",
      subtitle: "Always enabled for ride tracking",
      type: "button",
      onPress: showComingSoon,
    },
  ];

  const renderSettingItem = (item: SettingItem, index: number, isLast: boolean) => (
    <Pressable
      key={index}
      style={[
        styles.settingItem,
        !isLast && styles.settingItemBorder,
        { borderBottomColor: theme.border },
      ]}
      onPress={item.type === "button" ? item.onPress : undefined}
      disabled={item.type === "toggle"}
    >
      <View style={[styles.settingIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
        <Ionicons name={item.icon} size={20} color={Colors.travonyGreen} />
      </View>
      <View style={styles.settingContent}>
        <ThemedText style={styles.settingLabel}>{item.label}</ThemedText>
        {item.subtitle ? (
          <ThemedText style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
            {item.subtitle}
          </ThemedText>
        ) : null}
      </View>
      {item.type === "toggle" ? (
        <Switch
          value={item.value}
          onValueChange={item.onToggle}
          trackColor={{ false: theme.border, true: Colors.travonyGreen + "80" }}
          thumbColor={item.value ? Colors.travonyGreen : theme.textMuted}
        />
      ) : (
        <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
      )}
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <ThemedText style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            NOTIFICATIONS
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundElevated }]}>
            {notificationSettings.map((item, index) =>
              renderSettingItem(item, index, index === notificationSettings.length - 1)
            )}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            SOUNDS & HAPTICS
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundElevated }]}>
            {soundSettings.map((item, index) =>
              renderSettingItem(item, index, index === soundSettings.length - 1)
            )}
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            RIDE PREFERENCES
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundElevated }]}>
            <View style={[styles.settingItem, styles.settingItemBorder, { borderBottomColor: theme.border }]}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.travonyGreen + "20" }]}>
                <Ionicons name="star-outline" size={20} color={Colors.travonyGreen} />
              </View>
              <View style={styles.settingContent}>
                <ThemedText style={styles.settingLabel}>Rider Rating Filter</ThemedText>
                <ThemedText style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                  Only accept riders above minimum rating
                </ThemedText>
              </View>
              <Switch
                value={ratingFilterEnabled}
                onValueChange={handleRatingFilterToggle}
                trackColor={{ false: theme.border, true: Colors.travonyGreen + "80" }}
                thumbColor={ratingFilterEnabled ? Colors.travonyGreen : theme.textMuted}
              />
            </View>
            {ratingFilterEnabled ? (
              <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                  <ThemedText style={[styles.settingSubtitle, { color: theme.textSecondary }]}>
                    Minimum rider rating
                  </ThemedText>
                  <View style={styles.ratingBadge}>
                    <Ionicons name="star" size={14} color={theme.warning} />
                    <ThemedText style={[styles.ratingValue, { color: theme.warning }]}>
                      {minRiderRating.toFixed(1)}
                    </ThemedText>
                  </View>
                </View>
                <Slider
                  style={styles.slider}
                  minimumValue={3.0}
                  maximumValue={5.0}
                  step={0.1}
                  value={minRiderRating}
                  onValueChange={handleMinRatingChange}
                  onSlidingComplete={handleMinRatingSlidingComplete}
                  minimumTrackTintColor={Colors.travonyGreen}
                  maximumTrackTintColor={theme.border}
                  thumbTintColor={Colors.travonyGreen}
                />
                <View style={styles.sliderLabels}>
                  <ThemedText style={[styles.sliderLabel, { color: theme.textMuted }]}>3.0</ThemedText>
                  <ThemedText style={[styles.sliderLabel, { color: theme.textMuted }]}>5.0</ThemedText>
                </View>
              </View>
            ) : null}
          </View>
          <View style={[styles.warningCard, { backgroundColor: theme.warning + "15" }]}>
            <Ionicons name="alert-circle-outline" size={16} color={theme.warning} />
            <ThemedText style={[styles.warningText, { color: theme.warning }]}>
              Setting a high minimum may reduce route requests
            </ThemedText>
          </View>
        </View>

        <View style={styles.section}>
          <ThemedText style={[styles.sectionHeader, { color: theme.textSecondary }]}>
            GENERAL
          </ThemedText>
          <View style={[styles.settingsCard, { backgroundColor: theme.backgroundElevated }]}>
            {generalSettings.map((item, index) =>
              renderSettingItem(item, index, index === generalSettings.length - 1)
            )}
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.backgroundElevated }]}>
          <Ionicons name="information-circle-outline" size={20} color={theme.textSecondary} />
          <ThemedText style={[styles.infoText, { color: theme.textSecondary }]}>
            Settings are stored locally on this device. Some features may require app restart.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    ...Typography.caption,
    fontWeight: "600",
    marginBottom: Spacing.sm,
    marginLeft: Spacing.sm,
  },
  settingsCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
  },
  settingItemBorder: {
    borderBottomWidth: 1,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    ...Typography.body,
    fontWeight: "500",
  },
  settingSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  infoText: {
    ...Typography.small,
    flex: 1,
  },
  sliderContainer: {
    padding: Spacing.md,
    paddingTop: 0,
  },
  sliderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingValue: {
    ...Typography.body,
    fontWeight: "700",
  },
  slider: {
    width: "100%",
    height: 40,
  },
  sliderLabels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -Spacing.sm,
  },
  sliderLabel: {
    ...Typography.caption,
  },
  warningCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    gap: Spacing.xs,
  },
  warningText: {
    ...Typography.small,
    flex: 1,
  },
});
