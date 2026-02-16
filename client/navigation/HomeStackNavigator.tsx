import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import SelectLocationScreen from "@/screens/SelectLocationScreen";
import ConfirmRideScreen from "@/screens/ConfirmRideScreen";
import ActiveRideScreen from "@/screens/ActiveRideScreen";
import RatingScreen from "@/screens/RatingScreen";
import InvoiceScreen from "@/screens/InvoiceScreen";
import OpenClawScreen from "@/screens/OpenClawScreen";
import HubDetailScreen from "@/screens/HubDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HomeStackParamList = {
  Home: { 
    selectedLocation?: { 
      type: "pickup" | "dropoff"; 
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
  Rating: { rideId: string; driverId: string; driverName: string };
  Invoice: { rideId: string };
  OpenClaw: { variant: "rider" };
  HubDetail: { hubId: string; hubName: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
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
        name="Rating"
        component={RatingScreen}
        options={{ 
          headerTitle: "Rate Your Ride",
          presentation: "modal"
        }}
      />
      <Stack.Screen
        name="Invoice"
        component={InvoiceScreen}
        options={{ 
          headerTitle: "Payment Receipt",
          presentation: "modal"
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
    </Stack.Navigator>
  );
}
