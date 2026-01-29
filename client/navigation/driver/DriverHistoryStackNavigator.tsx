import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import DriverRideHistoryScreen from "@/screens/driver/DriverRideHistoryScreen";

export type DriverHistoryStackParamList = {
  DriverHistory: undefined;
};

const Stack = createNativeStackNavigator<DriverHistoryStackParamList>();

export default function DriverHistoryStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="DriverHistory"
        component={DriverRideHistoryScreen}
        options={{ headerTitle: "Ride History" }}
      />
    </Stack.Navigator>
  );
}
