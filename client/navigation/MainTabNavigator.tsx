import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, Pressable } from "react-native";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import BookingsStackNavigator from "@/navigation/BookingsStackNavigator";
import WalletStackNavigator from "@/navigation/WalletStackNavigator";
import SocialStackNavigator from "@/navigation/SocialStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";

export type MainTabParamList = {
  HomeTab: undefined;
  BookingsTab: undefined;
  WalletTab: undefined;
  SocialTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { openLoginSheet } = useAuthGate();

  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenListeners={({ route }) => ({
        tabPress: (e) => {
          if (!isAuthenticated && route.name !== "HomeTab") {
            e.preventDefault();
            openLoginSheet();
          }
        },
      })}
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: theme.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
          height: 80,
          paddingBottom: Platform.OS === "ios" ? 24 : 12,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "500",
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={BookingsStackNavigator}
        options={{
          title: "Movements",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      {/* Wallet stays reachable (profile sidebar, booking sheet, assistant)
          but is hidden from the tab bar. */}
      <Tab.Screen
        name="WalletTab"
        component={WalletStackNavigator}
        options={{
          title: "Wallet",
          tabBarButton: () => null,
          tabBarItemStyle: { display: "none" },
        }}
      />
      <Tab.Screen
        name="SocialTab"
        component={SocialStackNavigator}
        options={{
          title: "Network",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
