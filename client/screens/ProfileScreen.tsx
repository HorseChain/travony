import React from "react";
import { View, StyleSheet, ScrollView, Pressable, Alert, Image, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { Card } from "@/components/Card";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList, "Profile">;

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
      style={({ pressed }) => [
        styles.menuItem,
        { opacity: pressed ? 0.7 : 1 },
      ]}
      onPress={onPress}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: danger ? theme.error + "20" : theme.backgroundDefault }]}>
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

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const { theme } = useTheme();
  const { user, logout } = useAuth();
  const navigation = useNavigation<NavigationProp>();

  const handleLogout = async () => {
    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to sign out?");
      if (confirmed) {
        await logout();
      }
    } else {
      Alert.alert(
        "Sign Out",
        "Are you sure you want to sign out?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Sign Out",
            style: "destructive",
            onPress: async () => {
              await logout();
            },
          },
        ]
      );
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundRoot }]}
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.lg,
        paddingBottom: tabBarHeight + Spacing.xl,
        paddingHorizontal: Spacing.lg,
      }}
      scrollIndicatorInsets={{ bottom: insets.bottom }}
    >
      <View style={styles.profileHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.backgroundDefault }]}>
          {user?.avatar ? (
            <Image source={{ uri: user.avatar }} style={styles.avatar} />
          ) : (
            <Ionicons name="person-outline" size={40} color={theme.primary} />
          )}
        </View>
        <View style={styles.profileInfo}>
          <ThemedText style={styles.profileName}>{user?.name || "Guest User"}</ThemedText>
          <ThemedText style={[styles.profileEmail, { color: theme.textSecondary }]}>
            {user?.email || "No email"}
          </ThemedText>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.editButton,
            { backgroundColor: theme.backgroundDefault, opacity: pressed ? 0.7 : 1 },
          ]}
          onPress={() => navigation.navigate("EditProfile")}
        >
          <Ionicons name="pencil-outline" size={18} color={theme.primary} />
        </Pressable>
      </View>

      <Card style={styles.menuCard}>
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
          icon="help-circle-outline"
          title="Help & Support"
          onPress={() => navigation.navigate("Help")}
        />
      </Card>

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

      <ThemedText style={[styles.version, { color: theme.textMuted }]}>
        Travony v1.0.0
      </ThemedText>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatar: {
    width: 80,
    height: 80,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.lg,
  },
  profileName: {
    ...Typography.h3,
  },
  profileEmail: {
    ...Typography.bodyMedium,
    marginTop: Spacing.xs,
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
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
