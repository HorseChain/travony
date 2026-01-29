import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import BookingsScreen from "@/screens/BookingsScreen";
import RideDetailsScreen from "@/screens/RideDetailsScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type BookingsStackParamList = {
  Bookings: undefined;
  RideDetails: { rideId: string };
};

const Stack = createNativeStackNavigator<BookingsStackParamList>();

export default function BookingsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Bookings"
        component={BookingsScreen}
        options={{ headerTitle: "My Bookings" }}
      />
      <Stack.Screen
        name="RideDetails"
        component={RideDetailsScreen}
        options={{ headerTitle: "Ride Details" }}
      />
    </Stack.Navigator>
  );
}
