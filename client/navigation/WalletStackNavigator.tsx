import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import WalletScreen from "@/screens/WalletScreen";
import AddPaymentMethodScreen from "@/screens/AddPaymentMethodScreen";
import PromoCodeScreen from "@/screens/PromoCodeScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type WalletStackParamList = {
  Wallet: undefined;
  AddPaymentMethod: undefined;
  PromoCode: undefined;
};

const Stack = createNativeStackNavigator<WalletStackParamList>();

export default function WalletStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={{ headerTitle: "Wallet" }}
      />
      <Stack.Screen
        name="AddPaymentMethod"
        component={AddPaymentMethodScreen}
        options={{ headerTitle: "Add Payment Method" }}
      />
      <Stack.Screen
        name="PromoCode"
        component={PromoCodeScreen}
        options={{ headerTitle: "Promo Codes" }}
      />
    </Stack.Navigator>
  );
}
