import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Bottom inset that clears the floating (absolute-positioned) tab bar when the
 * screen lives inside the tab navigator, and falls back to the safe-area inset
 * everywhere else. Use this for scroll-content bottom padding so buttons never
 * hide behind the tab bar.
 */
export function useTabBarInset(): number {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const insets = useSafeAreaInsets();
  return Math.max(tabBarHeight, insets.bottom);
}
