import { Platform } from "react-native";
import Constants from "expo-constants";
import { getApiUrl } from "@/lib/query-client";

export function reportCrash(error: Error, componentStack: string, screen?: string) {
  try {
    const url = new URL("/api/client-error", getApiUrl()).toString();
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error?.message || String(error),
        stack: error?.stack || null,
        componentStack: componentStack || null,
        screen: screen || null,
        appVersion: Constants.expoConfig?.version || null,
        buildNumber:
          Constants.expoConfig?.ios?.buildNumber ||
          Constants.expoConfig?.android?.versionCode ||
          null,
        platform: Platform.OS,
      }),
    }).catch(() => {});
  } catch {
    // never let crash reporting cause a crash
  }
}
