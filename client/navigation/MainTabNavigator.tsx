import React, { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from "react-native-reanimated";
import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import BookingsStackNavigator from "@/navigation/BookingsStackNavigator";
import WalletStackNavigator from "@/navigation/WalletStackNavigator";
import SocialStackNavigator from "@/navigation/SocialStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Motion } from "@/constants/theme";
import { useAuth } from "@/hooks/useAuth";
import { useAuthGate } from "@/hooks/useAuthGate";
import { useNotificationAlerts } from "@/hooks/useNotifications";

export type MainTabParamList = {
  HomeTab: undefined;
  BookingsTab: undefined;
  WalletTab: undefined;
  SocialTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * Springy glass tab icon — the focused tab gets a soft tinted pill that
 * scales in with a spring while the icon swaps to its filled variant and
 * lifts slightly. Feels weightless, reads instantly.
 */
function TabIcon({
  focused,
  color,
  size,
  outline,
  filled,
  pillColor,
}: {
  focused: boolean;
  color: string;
  size: number;
  outline: keyof typeof Ionicons.glyphMap;
  filled: keyof typeof Ionicons.glyphMap;
  pillColor: string;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = focused
      ? withSpring(1, { damping: 14, stiffness: 220 })
      : withTiming(0, { duration: Motion.duration.base });
  }, [focused, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.6, 1]) }],
  }));

  const iconStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -1.5]) },
      { scale: interpolate(progress.value, [0, 1], [1, 1.08]) },
    ],
  }));

  return (
    <View style={tabStyles.iconWrap}>
      <Animated.View
        style={[tabStyles.pill, { backgroundColor: pillColor }, pillStyle]}
      />
      <Animated.View style={iconStyle}>
        <Ionicons name={focused ? filled : outline} size={size} color={color} />
      </Animated.View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  iconWrap: {
    width: 56,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.full,
  },
});

export default function MainTabNavigator() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuth();
  const { openLoginSheet } = useAuthGate();

  useNotificationAlerts();

  const pillColor = isDark
    ? "rgba(0, 201, 92, 0.16)"
    : "rgba(0, 177, 79, 0.12)";

  const makeIcon =
    (
      outline: keyof typeof Ionicons.glyphMap,
      filled: keyof typeof Ionicons.glyphMap,
    ) =>
    ({
      color,
      size,
      focused,
    }: {
      color: string;
      size: number;
      focused: boolean;
    }) => (
      <TabIcon
        focused={focused}
        color={color}
        size={size - 2}
        outline={outline}
        filled={filled}
        pillColor={pillColor}
      />
    );

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
              intensity={90}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            >
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: isDark
                      ? "rgba(26,26,26,0.45)"
                      : "rgba(255,255,255,0.55)",
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: isDark
                      ? "rgba(255,255,255,0.08)"
                      : "rgba(0,0,0,0.06)",
                  },
                ]}
              />
            </BlurView>
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  borderTopWidth: StyleSheet.hairlineWidth,
                  borderTopColor: theme.border,
                },
              ]}
            />
          ),
        headerShown: false,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: 2,
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: makeIcon("home-outline", "home"),
        }}
      />
      <Tab.Screen
        name="BookingsTab"
        component={BookingsStackNavigator}
        options={{
          title: "Movements",
          tabBarIcon: makeIcon("calendar-outline", "calendar"),
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
          tabBarIcon: makeIcon("people-outline", "people"),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: makeIcon("person-outline", "person"),
        }}
      />
    </Tab.Navigator>
  );
}
