import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import DriverHomeScreen from "@/screens/driver/DriverHomeScreen";
import DriverActiveRideScreen from "@/screens/driver/DriverActiveRideScreen";

export type DriverHomeStackParamList = {
  DriverHome: undefined;
  DriverActiveRide: { rideId: string };
};

const Stack = createNativeStackNavigator<DriverHomeStackParamList>();

export default function DriverHomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="DriverHome"
        component={DriverHomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="DriverActiveRide"
        component={DriverActiveRideScreen}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}
