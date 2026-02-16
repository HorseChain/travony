import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import DriverHomeScreen from "@/screens/driver/DriverHomeScreen";
import DriverActiveRideScreen from "@/screens/driver/DriverActiveRideScreen";
import OpenClawScreen from "@/screens/OpenClawScreen";
import HubDetailScreen from "@/screens/HubDetailScreen";

export type DriverHomeStackParamList = {
  DriverHome: undefined;
  DriverActiveRide: { rideId: string };
  OpenClaw: { variant: "driver" };
  HubDetail: { hubId: string; hubName: string };
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
