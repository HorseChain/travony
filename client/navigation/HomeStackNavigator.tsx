import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HookFeedScreen from "@/screens/HookFeedScreen";
import AssistantHomeScreen from "@/screens/AssistantHomeScreen";
import HomeScreen from "@/screens/HomeScreen";
import SelectLocationScreen from "@/screens/SelectLocationScreen";
import ConfirmRideScreen from "@/screens/ConfirmRideScreen";
import ActiveRideScreen from "@/screens/ActiveRideScreen";
import GoLiveScreen from "@/screens/GoLiveScreen";
import RatingScreen from "@/screens/RatingScreen";
import InvoiceScreen from "@/screens/InvoiceScreen";
import OpenClawScreen from "@/screens/OpenClawScreen";
import HubDetailScreen from "@/screens/HubDetailScreen";
import CoffeeScreen from "@/screens/CoffeeScreen";
import ScheduledArrivalsScreen from "@/screens/ScheduledArrivalsScreen";
import PrayerRidesScreen from "@/screens/PrayerRidesScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HomeStackParamList = {
  // TikTok-style hook feed — first thing users see when they open the app.
  // Booking params forwarded here are immediately delegated to AssistantHome.
  Home: {
    selectedLocation?: {
      type: "pickup" | "dropoff";
      address: string;
      lat: number;
      lng: number;
    };
    selectedPickup?: {
      address: string;
      lat: number;
      lng: number;
    };
  } | undefined;
  // AI assistant chat (formerly the Home route)
  AssistantHome: {
    selectedLocation?: {
      type: "pickup" | "dropoff";
      address: string;
      lat: number;
      lng: number;
    };
    selectedPickup?: {
      address: string;
      lat: number;
      lng: number;
    };
  } | undefined;
  MapHome: {
    selectedLocation?: {
      type: "pickup" | "dropoff";
      address: string;
      lat: number;
      lng: number;
    };
    selectedPickup?: {
      address: string;
      lat: number;
      lng: number;
    };
  } | undefined;
  SelectLocation: { type: "pickup" | "dropoff" };
  ConfirmRide: {
    pickup: { address: string; lat: number; lng: number };
    dropoff: { address: string; lat: number; lng: number };
  };
  ActiveRide: { rideId: string };
  GoLive: { rideId: string };
  Rating: { rideId: string; driverId: string; driverName: string };
  Invoice: { rideId: string };
  OpenClaw: { variant: "rider" };
  HubDetail: { hubId: string; hubName: string };
  Coffee: undefined;
  ScheduledArrivals: undefined;
  PrayerRides: undefined;
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {/* TikTok-style hook feed — the new Home */}
      <Stack.Screen
        name="Home"
        component={HookFeedScreen}
        options={{ headerShown: false }}
      />
      {/* AI assistant chat */}
      <Stack.Screen
        name="AssistantHome"
        component={AssistantHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MapHome"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SelectLocation"
        component={SelectLocationScreen}
        options={{ headerTitle: "Select Location" }}
      />
      <Stack.Screen
        name="ConfirmRide"
        component={ConfirmRideScreen}
        options={{ headerTitle: "Confirm Ride" }}
      />
      <Stack.Screen
        name="ActiveRide"
        component={ActiveRideScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="GoLive"
        component={GoLiveScreen}
        options={{ headerShown: false, presentation: "fullScreenModal" }}
      />
      <Stack.Screen
        name="Rating"
        component={RatingScreen}
        options={{
          headerTitle: "Rate Your Ride",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="Invoice"
        component={InvoiceScreen}
        options={{
          headerTitle: "Payment Receipt",
          presentation: "modal",
        }}
      />
      <Stack.Screen
        name="OpenClaw"
        component={OpenClawScreen}
        options={{ headerTitle: "Network Hubs" }}
      />
      <Stack.Screen
        name="HubDetail"
        component={HubDetailScreen}
        options={({ route }: any) => ({ headerTitle: route.params?.hubName || "Hub" })}
      />
      <Stack.Screen
        name="Coffee"
        component={CoffeeScreen}
        options={{ headerTitle: "Coffee" }}
      />
      <Stack.Screen
        name="ScheduledArrivals"
        component={ScheduledArrivalsScreen}
        options={{ headerTitle: "On-Time Arrivals" }}
      />
      <Stack.Screen
        name="PrayerRides"
        component={PrayerRidesScreen}
        options={{ headerTitle: "Prayer Rides" }}
      />
    </Stack.Navigator>
  );
}
