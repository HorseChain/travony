import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import DriverHomeScreen from "@/screens/driver/DriverHomeScreen";
import DriverActiveRideScreen from "@/screens/driver/DriverActiveRideScreen";
import GoLiveScreen from "@/screens/GoLiveScreen";
import OpenClawScreen from "@/screens/OpenClawScreen";
import HubDetailScreen from "@/screens/HubDetailScreen";
import DriverCoffeeOrdersScreen from "@/screens/driver/DriverCoffeeOrdersScreen";
import EvDriverScreen from "@/screens/driver/EvDriverScreen";

export type DriverHomeStackParamList = {
  DriverHome: undefined;
  DriverActiveRide: { rideId: string };
  GoLive: { rideId?: string; postId?: string };
  OpenClaw: { variant: "driver" };
  HubDetail: { hubId: string; hubName: string };
  DriverCoffeeOrders: undefined;
  EvDriver: undefined;
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
        name="GoLive"
        component={GoLiveScreen}
        options={{ headerShown: false, presentation: "fullScreenModal" }}
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
        name="DriverCoffeeOrders"
        component={DriverCoffeeOrdersScreen}
        options={{ headerTitle: "Coffee Orders" }}
      />
      <Stack.Screen
        name="EvDriver"
        component={EvDriverScreen}
        options={{ headerTitle: "My EV" }}
      />
    </Stack.Navigator>
  );
}
