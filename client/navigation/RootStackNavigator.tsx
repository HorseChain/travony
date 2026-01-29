import React, { useState, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import DriverTabNavigator from "@/navigation/driver/DriverTabNavigator";
import OnboardingScreen from "@/screens/OnboardingScreen";
import { CreditToast } from "@/components/CreditToast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { APP_VARIANT, isRiderApp, isDriverApp } from "@/lib/appVariant";

function SafeMainTabNavigator() {
  return (
    <ErrorBoundary>
      <MainTabNavigator />
    </ErrorBoundary>
  );
}

function SafeDriverTabNavigator() {
  return (
    <ErrorBoundary>
      <DriverTabNavigator />
    </ErrorBoundary>
  );
}

export type RootStackParamList = {
  Main: undefined;
  DriverMain: undefined;
  Onboarding: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();
  const { isAuthenticated, isLoading, user } = useAuth();
  const { theme } = useTheme();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prevAuth, setPrevAuth] = useState(false);

  useEffect(() => {
    console.log("RootStackNavigator: isAuthenticated changed to", isAuthenticated, "user:", user?.id, "role:", user?.role);
    if (isAuthenticated && !prevAuth) {
      console.log("RootStackNavigator: Starting transition animation");
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        console.log("RootStackNavigator: Transition complete");
        setIsTransitioning(false);
      }, 800);
      return () => clearTimeout(timer);
    }
    setPrevAuth(isAuthenticated);
  }, [isAuthenticated, prevAuth, user]);

  if (isLoading || isTransitioning) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundRoot }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const userIsDriver = user?.role === "driver";
  
  const shouldShowDriverApp = APP_VARIANT === 'driver' || (APP_VARIANT === 'unified' && userIsDriver);
  const shouldShowRiderApp = APP_VARIANT === 'rider' || (APP_VARIANT === 'unified' && !userIsDriver);

  return (
    <>
      <Stack.Navigator screenOptions={{ ...screenOptions, animation: 'none' }}>
        {isAuthenticated ? (
          shouldShowDriverApp ? (
            <Stack.Screen
              name="DriverMain"
              component={SafeDriverTabNavigator}
              options={{ headerShown: false, animation: 'none' }}
            />
          ) : (
            <Stack.Screen
              name="Main"
              component={SafeMainTabNavigator}
              options={{ headerShown: false, animation: 'none' }}
            />
          )
        ) : (
          <Stack.Screen
            name="Onboarding"
            component={OnboardingScreen}
            options={{ headerShown: false }}
          />
        )}
      </Stack.Navigator>
      {isAuthenticated ? <CreditToast /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
