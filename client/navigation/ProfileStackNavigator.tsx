import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ProfileScreen from "@/screens/ProfileScreen";
import EditProfileScreen from "@/screens/EditProfileScreen";
import SavedAddressesScreen from "@/screens/SavedAddressesScreen";
import EmergencyContactsScreen from "@/screens/EmergencyContactsScreen";
import HelpScreen from "@/screens/HelpScreen";
import RideTruthScreen from "@/screens/RideTruthScreen";
import GhostModeScreen from "@/screens/GhostModeScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  SavedAddresses: undefined;
  EmergencyContacts: undefined;
  Help: undefined;
  RideTruth: undefined;
  GhostMode: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerTitle: "Profile" }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerTitle: "Edit Profile" }}
      />
      <Stack.Screen
        name="SavedAddresses"
        component={SavedAddressesScreen}
        options={{ headerTitle: "Saved Addresses" }}
      />
      <Stack.Screen
        name="EmergencyContacts"
        component={EmergencyContactsScreen}
        options={{ headerTitle: "Emergency Contacts" }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ headerTitle: "Help & Support" }}
      />
      <Stack.Screen
        name="RideTruth"
        component={RideTruthScreen}
        options={{ headerTitle: "Ride Truth Engine" }}
      />
      <Stack.Screen
        name="GhostMode"
        component={GhostModeScreen}
        options={{ headerTitle: "Ghost Mode" }}
      />
    </Stack.Navigator>
  );
}
