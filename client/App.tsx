import React, { useEffect, useCallback, useState } from "react";
import { StyleSheet, View, Text, Platform } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, getApiUrl } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";

let StripeProviderComponent: any = null;
if (Platform.OS !== "web") {
  try {
    StripeProviderComponent = require("@stripe/stripe-react-native").StripeProvider;
  } catch (e) {}
}

SplashScreen.preventAutoHideAsync();

function StripeWrapper({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") return;
    async function fetchKey() {
      try {
        const res = await fetch(new URL("/api/stripe/publishable-key", getApiUrl()).toString());
        if (res.ok) {
          const data = await res.json();
          if (data.publishableKey) {
            setPublishableKey(data.publishableKey);
          }
        }
      } catch (e) {
        console.warn("Could not fetch Stripe publishable key:", e);
      }
    }
    fetchKey();
  }, []);

  if (!publishableKey || !StripeProviderComponent) {
    return <>{children}</>;
  }

  return (
    <StripeProviderComponent publishableKey={publishableKey}>
      <>{children}</>
    </StripeProviderComponent>
  );
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...MaterialIcons.font,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    if (fontError) {
      console.warn("Font loading error:", fontError);
    }
  }, [fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
            <KeyboardProvider>
              <StripeWrapper>
                <NavigationContainer>
                  <RootStackNavigator />
                </NavigationContainer>
              </StripeWrapper>
              <StatusBar style="auto" />
            </KeyboardProvider>
          </GestureHandlerRootView>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
