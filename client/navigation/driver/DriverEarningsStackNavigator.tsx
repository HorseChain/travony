import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import DriverEarningsScreen from "@/screens/driver/DriverEarningsScreen";
import VehicleWalletScreen from "@/screens/driver/VehicleWalletScreen";

export type DriverEarningsStackParamList = {
  DriverEarnings: undefined;
  VehicleWallet: undefined;
};

const Stack = createNativeStackNavigator<DriverEarningsStackParamList>();

export default function DriverEarningsStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="DriverEarnings"
        component={DriverEarningsScreen}
        options={{ headerTitle: "Earnings" }}
      />
      <Stack.Screen
        name="VehicleWallet"
        component={VehicleWalletScreen}
        options={{ headerTitle: "Vehicle Wallet" }}
      />
    </Stack.Navigator>
  );
}
