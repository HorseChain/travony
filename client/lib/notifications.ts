import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

let handlerConfigured = false;
let permissionGranted = false;
let permissionChecked = false;

/**
 * Ensure the foreground notification handler is configured and that we have
 * notification permission. Local (in-app) notifications work in Expo Go; remote
 * push and reliable delivery while the app is fully closed require a custom dev
 * build. This is best-effort and never throws.
 */
export async function ensureNotificationsSetup(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (!handlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerConfigured = true;
  }

  if (permissionChecked && permissionGranted) return true;

  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current.status;
    if (status !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      status = requested.status;
    }
    permissionGranted = status === "granted";
  } catch {
    permissionGranted = false;
  }
  permissionChecked = true;
  return permissionGranted;
}

/**
 * Show a local notification immediately. Plays a sound and pops a banner even
 * while the app is in the foreground (via the handler above). Best-effort.
 */
export async function presentLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const ready = await ensureNotificationsSetup();
    if (!ready) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: data || {},
        sound: true,
      },
      trigger: null,
    });
  } catch {
    // best-effort; notifications are non-critical
  }
}
