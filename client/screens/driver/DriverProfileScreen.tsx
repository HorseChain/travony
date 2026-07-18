import React, { useState, useLayoutEffect } from "react";
import { View, StyleSheet, Pressable, Alert, ScrollView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTabBarInset } from "@/hooks/useTabBarInset";
import { useHeaderHeight, HeaderButton } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StatusBadges, type StatusBadge } from "@/components/StatusBadges";
import ProfileSidebar from "@/components/profile/ProfileSidebar";
import QRCodeSheet from "@/components/profile/QRCodeSheet";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/hooks/useAuth";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";
import { DriverProfileStackParamList } from "@/navigation/driver/DriverProfileStackNavigator";

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  onPress: () => void;
  rightContent?: React.ReactNode;
  destructive?: boolean;
}

interface DriverData {
  id: string;
  rating: string;
  totalTrips: number;
  totalEarnings: string;
  prayerRideCount?: number;
}

type NavigationProp = NativeStackNavigationProp<DriverProfileStackParamList>;

export default function DriverProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tabBarInset = useTabBarInset();
  const headerHeight = useHeaderHeight();
  const { theme } = useTheme();
  const { user, logout } = useAuth();

  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [qrVisible, setQrVisible] = useState(false);

  const { data: driverData } = useQuery<DriverData>({
    queryKey: ["/api/drivers/me"],
    enabled: !!user,
  });

  const { data: socialData } = useQuery<{
    followers: number;
    following: number;
    likes: number;
    handle: string | null;
  }>({
    queryKey: ["/api/social/counts"],
    enabled: !!user,
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <HeaderButton onPress={() => navigation.navigate("FindFriends")}>
          <Ionicons name="person-add-outline" size={22} color={theme.text} />
        </HeaderButton>
      ),
      headerRight: () => (
        <HeaderButton onPress={() => setSidebarVisible(true)}>
          <Ionicons name="menu-outline" size={26} color={theme.text} />
        </HeaderButton>
      ),
    });
  }, [navigation, theme.text]);

  const { data: badgesData } = useQuery<{ badges: StatusBadge[] }>({
    queryKey: ["/api/social/badges", user?.id],
    enabled: !!user?.id,
  });

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
          { text: "Sign Out", style: "destructive", onPress: logout },
        ]
      );
    }
  };

  const menuItems: MenuItem[][] = [
    [
      {
        icon: "person-outline",
        label: "Personal Information",
        subtitle: "Name, email, phone",
        onPress: () => navigation.navigate("DriverPersonalInfo"),
      },
      {
        icon: "car-outline",
        label: "Vehicle Details",
        subtitle: "Manage your vehicle info",
        onPress: () => navigation.navigate("DriverVehicleDetails"),
      },
      {
        icon: "document-text-outline",
        label: "Documents",
        subtitle: "License, insurance, registration",
        onPress: () => navigation.navigate("DriverDocuments"),
      },
    ],
    [
      {
        icon: "card-outline",
        label: "Payment Settings",
        subtitle: "Bank account, payout preferences",
        onPress: () => navigation.navigate("DriverPaymentSettings"),
      },
      {
        icon: "star-outline",
        label: "Ratings & Reviews",
        subtitle: driverData?.rating ? `${driverData.rating} rating` : "View your ratings",
        onPress: () => navigation.navigate("DriverRatings"),
      },
    ],
    [
      {
        icon: "settings-outline",
        label: "App Settings",
        subtitle: "Notifications, preferences",
        onPress: () => navigation.navigate("DriverAppSettings"),
      },
      {
        icon: "help-circle-outline",
        label: "Help & Support",
        subtitle: "FAQs, contact support",
        onPress: () => navigation.navigate("DriverHelp"),
      },
    ],
    [
      {
        icon: "chatbox-outline",
        label: "Share Feedback",
        subtitle: "Help us improve",
        onPress: () => navigation.navigate("Feedback" as any),
      },
    ],
    [
      {
        icon: "chatbubbles-outline",
        label: "Messages",
        subtitle: "Chat with your rider",
        onPress: () => navigation.navigate("DriverMessages" as any),
      },
    ],
    [
      {
        icon: "log-out-outline",
        label: "Sign Out",
        onPress: handleLogout,
        destructive: true,
      },
    ],
  ];

  const renderMenuItem = (item: MenuItem, index: number, isLast: boolean) => (
    <Pressable
      key={index}
      style={[
        styles.menuItem,
        !isLast && styles.menuItemBorder,
        { borderBottomColor: theme.border },
      ]}
      onPress={item.onPress}
    >
      <View style={[styles.menuIcon, { backgroundColor: item.destructive ? theme.error + "20" : theme.backgroundElevated }]}>
        <Ionicons
          name={item.icon}
          size={20}
          color={item.destructive ? theme.error : Colors.travonyGreen}
        />
      </View>
      <View style={styles.menuContent}>
        <ThemedText style={[styles.menuLabel, item.destructive && { color: theme.error }]}>
          {item.label}
        </ThemedText>
        {item.subtitle ? (
          <ThemedText style={[styles.menuSubtitle, { color: theme.textSecondary }]}>
            {item.subtitle}
          </ThemedText>
        ) : null}
      </View>
      {!item.destructive && (
        <Ionicons name="chevron-forward-outline" size={20} color={theme.textMuted} />
      )}
    </Pressable>
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: tabBarInset + Spacing["5xl"] + Spacing["4xl"] + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileHeader, { backgroundColor: theme.backgroundElevated }]}>
          <View style={[styles.avatar, { backgroundColor: Colors.travonyGreen + "20" }]}>
            <ThemedText style={[styles.avatarText, { color: Colors.travonyGreen }]}>
              {user?.name?.charAt(0).toUpperCase() || "D"}
            </ThemedText>
          </View>
          <View style={styles.profileInfo}>
            <ThemedText style={styles.profileName}>{user?.name || "Driver"}</ThemedText>
            <ThemedText style={[styles.profileEmail, { color: theme.textSecondary }]}>
              {user?.email}
            </ThemedText>
            {(driverData?.prayerRideCount ?? 0) > 0 ? (
              <View style={[styles.prayerBadge, { backgroundColor: Colors.travonyGreen + "18" }]}>
                <Ionicons name="moon-outline" size={13} color={Colors.travonyGreen} />
                <ThemedText style={[styles.prayerBadgeText, { color: Colors.travonyGreen }]}>
                  {driverData?.prayerRideCount} Prayer Ride{(driverData?.prayerRideCount ?? 0) === 1 ? "" : "s"} · Volunteer
                </ThemedText>
              </View>
            ) : null}
            <StatusBadges badges={badgesData?.badges} size="md" />
          </View>
          <View style={styles.ratingBadge}>
            <Ionicons name="star-outline" size={16} color={theme.star} />
            <ThemedText style={styles.ratingText}>
              {driverData?.rating || "5.0"}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.statsCard, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
              {driverData?.totalTrips || 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Routes Completed
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
              AED {driverData?.totalEarnings || "0.00"}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Vehicle Contribution (Year)
            </ThemedText>
          </View>
        </View>

        <View style={[styles.statsCard, { backgroundColor: theme.backgroundElevated }]}>
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
              AED {driverData?.totalEarnings || "0.00"}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Lifetime Yield
            </ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
          <View style={styles.statItem}>
            <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
              {driverData?.totalTrips || 0}
            </ThemedText>
            <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
              Network Participation
            </ThemedText>
          </View>
        </View>

        {socialData ? (
          <View style={[styles.statsCard, { backgroundColor: theme.backgroundElevated }]}>
            <Pressable
              style={styles.statItem}
              onPress={() => navigation.navigate("FollowList", { mode: "followers" })}
            >
              <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
                {socialData.followers}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Followers
              </ThemedText>
            </Pressable>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <Pressable
              style={styles.statItem}
              onPress={() => navigation.navigate("FollowList", { mode: "following" })}
            >
              <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
                {socialData.following}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Following
              </ThemedText>
            </Pressable>
            <View style={[styles.statDivider, { backgroundColor: theme.border }]} />
            <View style={styles.statItem}>
              <ThemedText style={[styles.statValue, { color: Colors.travonyGreen }]}>
                {socialData.likes ?? 0}
              </ThemedText>
              <ThemedText style={[styles.statLabel, { color: theme.textSecondary }]}>
                Likes
              </ThemedText>
            </View>
          </View>
        ) : null}

        {menuItems.map((section, sectionIndex) => (
          <View
            key={sectionIndex}
            style={[styles.menuSection, { backgroundColor: theme.backgroundElevated }]}
          >
            {section.map((item, itemIndex) =>
              renderMenuItem(item, itemIndex, itemIndex === section.length - 1)
            )}
          </View>
        ))}

        <ThemedText style={[styles.version, { color: theme.textMuted }]}>
          T Driver v5.6.0
        </ThemedText>
      </ScrollView>

      <ProfileSidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        balanceTitle="Vehicle Wallet"
        onBalance={() => {
          setSidebarVisible(false);
          setTimeout(() => (navigation as any).getParent()?.navigate("DriverEarningsTab", { screen: "VehicleWallet" }), 250);
        }}
        onRewards={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("Rewards"), 250);
        }}
        onActivity={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("ActivityCentre"), 250);
        }}
        onQRCode={() => {
          setSidebarVisible(false);
          setTimeout(() => setQrVisible(true), 250);
        }}
        onSettings={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("DriverAppSettings"), 250);
        }}
        onTravonyAI={() => {
          setSidebarVisible(false);
          setTimeout(() => navigation.navigate("TravonyAI"), 250);
        }}
      />

      <QRCodeSheet visible={qrVisible} onClose={() => setQrVisible(false)} />
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
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...Typography.h1,
    fontWeight: "700",
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileName: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  profileEmail: {
    ...Typography.body,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: Colors.amber + "20",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  ratingText: {
    ...Typography.h4,
  },
  prayerBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  prayerBadgeText: {
    ...Typography.smallBold,
  },
  statsCard: {
    flexDirection: "row",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statDivider: {
    width: 1,
    marginHorizontal: Spacing.lg,
  },
  statValue: {
    ...Typography.xxlHeavy,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    ...Typography.small,
  },
  menuSection: {
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  menuContent: {
    flex: 1,
  },
  menuLabel: {
    ...Typography.bodySmallMedium,
  },
  menuSubtitle: {
    ...Typography.small,
    marginTop: 2,
  },
  version: {
    ...Typography.caption,
    textAlign: "center",
    marginTop: Spacing.lg,
  },
});
