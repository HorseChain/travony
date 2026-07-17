import { View, StyleSheet, TextInput, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useHeaderHeight } from "@react-navigation/elements";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { Button } from "@/components/Button";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

interface DriverData {
  id: string;
  userId: string;
  licenseNumber: string;
  phone: string | null;
}

export default function DriverPersonalInfoScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [twitch, setTwitch] = useState("");
  const [twitchTouched, setTwitchTouched] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  const { data: driverData, isLoading } = useQuery<DriverData>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  const socialQuery = useQuery<{ followers: number; following: number; twitchChannel: string | null }>({
    queryKey: ["/api/social/counts"],
    enabled: !!user,
  });
  const savedTwitch = socialQuery.data?.twitchChannel || "";
  const twitchValue = twitchTouched ? twitch : savedTwitch;

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    if (driverData) {
      if (driverData.phone) {
        setPhone(driverData.phone);
      }
      setIsDataLoaded(true);
    }
  }, [driverData]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("/api/users/me", {
        method: "PATCH",
        body: JSON.stringify({ name, phone }),
        headers: { "Content-Type": "application/json" },
      });
      if (twitchTouched && twitch.trim() !== savedTwitch) {
        await apiRequest("/api/me/twitch-channel", {
          method: "PATCH",
          body: JSON.stringify({ channel: twitch.trim() || null }),
          headers: { "Content-Type": "application/json" },
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/drivers/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/social/counts"] });
      if (Platform.OS === "web") {
        alert("Personal information updated successfully!");
      } else {
        Alert.alert("Success", "Personal information updated successfully!");
      }
    },
    onError: (error: any) => {
      const msg = error?.message || "Failed to update personal information. Please try again.";
      if (Platform.OS === "web") {
        alert(msg);
      } else {
        Alert.alert("Error", msg);
      }
    },
  });

  const handleSave = () => {
    updateMutation.mutate();
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarInset + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Name
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Enter your full name"
            placeholderTextColor={theme.textMuted}
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Email
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.textMuted,
                borderColor: theme.border,
              },
            ]}
            value={email}
            editable={false}
            placeholder="Email address"
            placeholderTextColor={theme.textMuted}
          />
          <ThemedText style={[styles.hint, { color: theme.textMuted }]}>
            Email cannot be changed
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Phone Number
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={phone}
            onChangeText={setPhone}
            placeholder="Enter phone number"
            placeholderTextColor={theme.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            License Number
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { 
                backgroundColor: theme.backgroundRoot,
                color: theme.textMuted,
                borderColor: theme.border,
              },
            ]}
            value={driverData?.licenseNumber || ""}
            editable={false}
            placeholder="License number"
            placeholderTextColor={theme.textMuted}
          />
          <ThemedText style={[styles.hint, { color: theme.textMuted }]}>
            Contact support to update license details
          </ThemedText>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundElevated }]}>
          <ThemedText style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            Twitch Channel
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: theme.backgroundRoot,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            value={twitchValue}
            onChangeText={(t) => {
              setTwitchTouched(true);
              setTwitch(t);
            }}
            placeholder="Your Twitch username (optional)"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <ThemedText style={[styles.hint, { color: theme.textMuted }]}>
            Link your Twitch channel to stream your rides live. Leave empty to remove.
          </ThemedText>
        </View>

        <Button
          onPress={handleSave}
          disabled={updateMutation.isPending || !isDataLoaded || isLoading}
          style={styles.saveButton}
        >
          {isLoading ? "Loading..." : updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </KeyboardAwareScrollViewCompat>
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
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.smallBold,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
  },
  input: {
    ...Typography.body,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  hint: {
    ...Typography.caption,
    marginTop: Spacing.sm,
  },
  saveButton: {
    marginTop: Spacing.lg,
  },
});
