import { Platform } from "react-native";
import { NativeStackNavigationOptions } from "@react-navigation/native-stack";

import { useTheme } from "@/hooks/useTheme";

const glassAvailable = false;

interface UseScreenOptionsParams {
  transparent?: boolean;
}

export function useScreenOptions({
  transparent = true,
}: UseScreenOptionsParams = {}): NativeStackNavigationOptions {
  const { theme, isDark } = useTheme();

  const isIOS = Platform.OS === "ios";
  const isAndroid = Platform.OS === "android";

  return {
    headerTitleAlign: "center",
    headerTransparent: isAndroid ? false : transparent,
    ...(isIOS ? { headerBlurEffect: isDark ? "dark" : "light" } : {}),
    headerTintColor: theme.text,
    headerStyle: {
      backgroundColor: isIOS && transparent ? undefined : theme.backgroundRoot,
    },
    gestureEnabled: isIOS,
    ...(isIOS ? { gestureDirection: "horizontal" as const } : {}),
    ...(isIOS ? { fullScreenGestureEnabled: !glassAvailable } : {}),
    contentStyle: {
      backgroundColor: theme.backgroundRoot,
    },
    animation: isAndroid ? "none" : "default",
  };
}
