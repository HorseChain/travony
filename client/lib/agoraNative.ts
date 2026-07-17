// Web variant of the Agora loaders. The native SDKs (react-native-agora,
// agora-react-native-rtm) are native-only modules that break the web bundle
// if Metro ever sees them — importing them here, even behind a Platform.OS
// guard or inside try/catch require(), pulls native-only internals
// (codegenNativeComponent) into the web bundle and 500s Metro.
//
// iOS/Android use agoraNative.native.ts, which does the real guarded loads.

export function loadAgoraRtc(): any | null {
  return null;
}

export function loadAgoraRtm(): any | null {
  return null;
}

export function agoraNativeAvailable(): boolean {
  return false;
}
