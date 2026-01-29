import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";

import { useTheme } from "@/hooks/useTheme";
import { Colors } from "@/constants/theme";

import DriverHomeStackNavigator from "./DriverHomeStackNavigator";
import DriverEarningsStackNavigator from "./DriverEarningsStackNavigator";
import DriverHistoryStackNavigator from "./DriverHistoryStackNavigator";
import DriverProfileStackNavigator from "./DriverProfileStackNavigator";

export type DriverTabParamList = {
  DriverHomeTab: undefined;
  DriverEarningsTab: undefined;
  DriverHistoryTab: undefined;
  DriverProfileTab: undefined;
};

const Tab = createBottomTabNavigator<DriverTabParamList>();

export default function DriverTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <Tab.Navigator
      initialRouteName="DriverHomeTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.travonyGreen,
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
        name="DriverHomeTab"
        component={DriverHomeStackNavigator}
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverEarningsTab"
        component={DriverEarningsStackNavigator}
        options={{
          title: "Earnings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cash-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverHistoryTab"
        component={DriverHistoryStackNavigator}
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="DriverProfileTab"
        component={DriverProfileStackNavigator}
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
