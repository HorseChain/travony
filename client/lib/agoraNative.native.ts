// The Agora Video (RTC) and Signaling (RTM) SDKs are NATIVE modules. They are
// not part of Expo Go and never run on web — they only work in a full EAS
// build that includes them. Everything that touches Agora goes through these
// guarded loaders so the rest of the app keeps working (with a friendly
// "needs the new app build" fallback) when the native modules are absent.
//
// This is the .native.ts variant, bundled only for iOS/Android. The web
// bundle uses agoraNative.ts, which never references the native packages —
// Metro resolves require() calls statically, so even a Platform.OS guard
// would still drag the native-only SDK into the web bundle and break it.

let rtcModule: any | null | undefined;
let rtmModule: any | null | undefined;

export function loadAgoraRtc(): any | null {
  if (rtcModule !== undefined) return rtcModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    rtcModule = require("react-native-agora");
  } catch {
    rtcModule = null;
  }
  return rtcModule;
}

export function loadAgoraRtm(): any | null {
  if (rtmModule !== undefined) return rtmModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    rtmModule = require("agora-react-native-rtm");
  } catch {
    rtmModule = null;
  }
  return rtmModule;
}

export function agoraNativeAvailable(): boolean {
  return loadAgoraRtc() !== null;
}
