import React, { useEffect, useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { NavigationContainer, DefaultTheme, DarkTheme } from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { reportCrash } from "@/lib/reportCrash";
import { LiteModeProvider } from "@/hooks/useLiteMode";
import { NetworkStatusBanner } from "@/components/NetworkStatusBanner";
import { useTheme } from "@/hooks/useTheme";
import { AuthGateProvider } from "@/hooks/useAuthGate";
import { LoginSheet } from "@/components/auth/LoginSheet";

let KeyboardProvider: React.ComponentType<{ children: React.ReactNode }> | null = null;
try {
  KeyboardProvider = require("react-native-keyboard-controller").KeyboardProvider;
} catch (e) {
  KeyboardProvider = null;
}

SplashScreen.preventAutoHideAsync();

function ThemedNavigation() {
  const { theme, isDark } = useTheme();
  const base = isDark ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: theme.primary,
      background: theme.backgroundRoot,
      card: theme.backgroundRoot,
      text: theme.text,
      border: theme.border,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      <RootStackNavigator />
    </NavigationContainer>
  );
}

function SafeKeyboardProvider({ children }: { children: React.ReactNode }) {
  if (KeyboardProvider) {
    try {
      return <KeyboardProvider>{children}</KeyboardProvider>;
    } catch (e) {
      return <>{children}</>;
    }
  }
  return <>{children}</>;
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
    <ErrorBoundary onError={reportCrash}>
      <QueryClientProvider client={queryClient}>
        <LiteModeProvider>
          <SafeAreaProvider>
            <GestureHandlerRootView style={styles.root} onLayout={onLayoutRootView}>
              <SafeKeyboardProvider>
                <AuthGateProvider>
                  <ThemedNavigation />
                  <LoginSheet />
                  <NetworkStatusBanner />
                  <StatusBar style="auto" />
                </AuthGateProvider>
              </SafeKeyboardProvider>
            </GestureHandlerRootView>
          </SafeAreaProvider>
        </LiteModeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
