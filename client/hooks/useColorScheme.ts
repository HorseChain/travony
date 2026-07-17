import { useColorScheme as useRNColorScheme } from "react-native";

// Follow the device's light/dark setting.
export function useColorScheme(): "light" | "dark" {
  return useRNColorScheme() ?? "light";
}
