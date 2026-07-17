import React from "react";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";

import HomeStackNavigator from "@/navigation/HomeStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import BookingsStackNavigator from "@/navigation/BookingsStackNavigator";

export type MainTabParamList = {
  HomeTab: undefined;
  MovementsTab: undefined;
  WalletTab: undefined;
  ProfileTab: undefined;
};

const Tab = createNativeBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator26() {
  return (
    <Tab.Navigator
      initialRouteName="HomeTab"
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackNavigator}
        options={{
          title: "Home",
          // @ts-ignore — sfSymbolName is valid for iOS 26 native tabs; type definitions are incomplete for this unstable API
          icon: { sfSymbolName: "house" },
          // @ts-ignore — sfSymbolName is valid for iOS 26 native tabs; type definitions are incomplete for this unstable API
          selectedIcon: { sfSymbolName: "house.fill" },
        }}
      />
      <Tab.Screen
        name="MovementsTab"
        component={BookingsStackNavigator}
        options={{
          title: "Movements",
          // @ts-ignore — sfSymbolName is valid for iOS 26 native tabs; type definitions are incomplete for this unstable API
          icon: { sfSymbolName: "clock.arrow.circlepath" },
          // @ts-ignore — sfSymbolName is valid for iOS 26 native tabs; type definitions are incomplete for this unstable API
          selectedIcon: { sfSymbolName: "clock.arrow.circlepath" },
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: "Profile",
          // @ts-ignore — sfSymbolName is valid for iOS 26 native tabs; type definitions are incomplete for this unstable API
          icon: { sfSymbolName: "person" },
          // @ts-ignore — sfSymbolName is valid for iOS 26 native tabs; type definitions are incomplete for this unstable API
          selectedIcon: { sfSymbolName: "person.fill" },
        }}
      />
    </Tab.Navigator>
  );
}
