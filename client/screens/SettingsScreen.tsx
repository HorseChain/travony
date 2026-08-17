import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { LiteModeSetting } from "@/components/LiteModeSetting";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Typography } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "Settings">;

interface MenuItemProps {
  icon: string;
  title: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

function MenuItem({ icon, title, onPress, showArrow = true, danger = false }: MenuItemProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, { opacity: pressed ? 0.8 : 1 }]}
      onPress={onPress}
    >
      <View
        style={[
          styles.menuIconContainer,
          { backgroundColor: danger ? theme.error + "20" : theme.backgroundDefault },
        ]}
      >
        <Ionicons name={icon as any} size={20} color={danger ? theme.error : theme.primary} />
      </View>
      <ThemedText style={[styles.menuItemText, danger && { color: theme.error }]}>
        {title}
      </ThemedText>
      {showArrow && (
        <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const { theme } = useTheme();
  const { logout } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const handleLogout = async () => {
    const doLogout = async () => {
      await logout();
      navigation.popToTop();
    };
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to sign out?");
      if (confirmed) {
        await doLogout();
      }
    } else {
      Alert.alert("Sign Out", "Are you sure you want to sign out?", [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: doLogout,
        },
      ]);
    }
  };

  const handleDeleteAccount = () => {
    const doDelete = async () => {
      try {
        await apiRequest("/api/account/delete", { method: "POST" });
        await logout();
        navigation.popToTop();
      } catch (error: any) {
        const msg = error?.message || "Failed to delete account. Please try again.";
        if (Platform.OS === "web") {
          window.alert(msg);
        } else {
          Alert.alert("Couldn't Delete Account", msg);
        }
      }
    };
    const warning =
      "This permanently deletes your account. Your personal information is removed immediately and cannot be recovered. Ride and payment records are anonymized.";
    if (Platform.OS === "web") {
      if (window.confirm(`Delete your account?\n\n${warning}`)) {
        doDelete();
      }
    } else {
      Alert.alert("Delete Account", warning, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Are you absolutely sure?",
              "Your account and personal data will be permanently deleted.",
              [
                { text: "Keep My Account", style: "cancel" },
                { text: "Yes, Delete", style: "destructive", onPress: doDelete },
              ]
            ),
        },
      ]);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: Spacing.xl,
        paddingBottom: tabBarInset + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: tabBarInset }}
    >
      <ThemedText style={[styles.sectionHeader, { color: theme.textMuted }]}>Account</ThemedText>
      <Card style={styles.menuCard}>
        <MenuItem
          icon="person-outline"
          title="Edit Profile"
          onPress={() => navigation.navigate("EditProfile")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <MenuItem
          icon="location-outline"
          title="Saved Addresses"
          onPress={() => navigation.navigate("SavedAddresses")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <MenuItem
          icon="people-outline"
          title="Emergency Contacts"
          onPress={() => navigation.navigate("EmergencyContacts")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <MenuItem
          icon="trash-outline"
          title="Delete Account"
          onPress={handleDeleteAccount}
          showArrow={false}
          danger
        />
      </Card>

      <ThemedText style={[styles.sectionHeader, { color: theme.textMuted }]}>Privacy</ThemedText>
      <Card style={styles.menuCard}>
        <MenuItem
          icon="eye-off-outline"
          title="Ghost Mode"
          onPress={() => navigation.navigate("GhostMode")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <MenuItem
          icon="analytics-outline"
          title="Ride Truth Engine"
          onPress={() => navigation.navigate("RideTruth")}
        />
      </Card>

      <ThemedText style={[styles.sectionHeader, { color: theme.textMuted }]}>App</ThemedText>
      <View style={styles.menuCard}>
        <LiteModeSetting />
      </View>
      <Card style={styles.menuCard}>
        <MenuItem
          icon="chatbubbles-outline"
          title="Messages"
          onPress={() => navigation.navigate("Messages")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <MenuItem
          icon="help-circle-outline"
          title="Help & Support"
          onPress={() => navigation.navigate("Help")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <MenuItem
          icon="chatbox-outline"
          title="Share Feedback"
          onPress={() => navigation.navigate("Feedback")}
        />
      </Card>

      <ThemedText style={[styles.sectionHeader, { color: theme.textMuted }]}>Legal</ThemedText>
      <Card style={styles.menuCard}>
        <MenuItem
          icon="document-text-outline"
          title="Terms of Service"
          onPress={() => Alert.alert("Terms of Service", "Terms and conditions content here.")}
        />
        <View style={[styles.menuDivider, { backgroundColor: theme.border }]} />
        <MenuItem
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          onPress={() => Alert.alert("Privacy Policy", "Privacy policy content here.")}
        />
      </Card>

      <Card style={styles.menuCard}>
        <MenuItem
          icon="log-out-outline"
          title="Sign Out"
          onPress={handleLogout}
          showArrow={false}
          danger
        />
      </Card>

      <ThemedText style={[styles.version, { color: theme.textMuted }]}>Travony v6.6.6</ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    ...Typography.small,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: Spacing.sm,
    marginTop: Spacing.md,
  },
  menuCard: {
    marginBottom: Spacing.lg,
    padding: 0,
    overflow: "hidden",
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
  version: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
