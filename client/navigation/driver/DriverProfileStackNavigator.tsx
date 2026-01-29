import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useScreenOptions } from "@/hooks/useScreenOptions";

import DriverProfileScreen from "@/screens/driver/DriverProfileScreen";
import DriverPersonalInfoScreen from "@/screens/driver/DriverPersonalInfoScreen";
import DriverVehicleDetailsScreen from "@/screens/driver/DriverVehicleDetailsScreen";
import DriverDocumentsScreen from "@/screens/driver/DriverDocumentsScreen";
import DriverPaymentSettingsScreen from "@/screens/driver/DriverPaymentSettingsScreen";
import DriverRatingsScreen from "@/screens/driver/DriverRatingsScreen";
import DriverAppSettingsScreen from "@/screens/driver/DriverAppSettingsScreen";
import DriverHelpScreen from "@/screens/driver/DriverHelpScreen";

export type DriverProfileStackParamList = {
  DriverProfile: undefined;
  DriverPersonalInfo: undefined;
  DriverVehicleDetails: undefined;
  DriverDocuments: undefined;
  DriverPaymentSettings: undefined;
  DriverRatings: undefined;
  DriverAppSettings: undefined;
  DriverHelp: undefined;
};

const Stack = createNativeStackNavigator<DriverProfileStackParamList>();

export default function DriverProfileStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="DriverProfile"
        component={DriverProfileScreen}
        options={{ headerTitle: "Profile" }}
      />
      <Stack.Screen
        name="DriverPersonalInfo"
        component={DriverPersonalInfoScreen}
        options={{ headerTitle: "Personal Information" }}
      />
      <Stack.Screen
        name="DriverVehicleDetails"
        component={DriverVehicleDetailsScreen}
        options={{ headerTitle: "Vehicle Details" }}
      />
      <Stack.Screen
        name="DriverDocuments"
        component={DriverDocumentsScreen}
        options={{ headerTitle: "Documents" }}
      />
      <Stack.Screen
        name="DriverPaymentSettings"
        component={DriverPaymentSettingsScreen}
        options={{ headerTitle: "Payment Settings" }}
      />
      <Stack.Screen
        name="DriverRatings"
        component={DriverRatingsScreen}
        options={{ headerTitle: "Ratings & Reviews" }}
      />
      <Stack.Screen
        name="DriverAppSettings"
        component={DriverAppSettingsScreen}
        options={{ headerTitle: "App Settings" }}
      />
      <Stack.Screen
        name="DriverHelp"
        component={DriverHelpScreen}
        options={{ headerTitle: "Help & Support" }}
      />
    </Stack.Navigator>
  );
}
