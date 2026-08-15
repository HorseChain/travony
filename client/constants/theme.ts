import { Platform } from "react-native";

export const Colors = {
  travonyGreen: "#00B14F",
  travonyGold: "#FFB800",
  black: "#000000",
  tierBronze: "#CD7F32",
  tierSilver: "#C0C0C0",
  tierGold: "#FFD700",
  tierPlatinum: "#E5E4E2",
  tierDiamond: "#B9F2FF",
  eventPurple: "#7C4DFF",
  evCharger: "#0EA5A4",
  surfaceGray: "#E0E0E0",
  coffee: "#8B4513",
  coffeeDark: "#6B3410",
  successLight: "#E8F5E9",
  gray: "#666666",
  mapDarkBg: "#1a1a2e",
  mapDarkGrid: "#2a2a4e",
  mapDarkRoad: "#3a3a5e",
  mapLightBg: "#e8f4e8",
  mapLightGrid: "#d0e8d0",
  mapLightRoad: "#c0d8c0",
  networkError: "#B23B3B",
  liveRed: "#E91916",
  heatmapLow: "#4FC3F7",
  heatmapMid: "#FFA726",
  heatmapHigh: "#EF5350",
  amber: "#F59E0B",
  travonyDarkGreen: "#008B3D",
  cityChampion: "#8E44AD",
  prestige: "#00A3A3",
  chargerGray: "#9CA3AF",
  mapPinGray: "#555555",
  mapDarkElement: "#1d1d1d",
  mapLightSurface: "#f5f5f5",
  mapWater: "#aadaff",
  mapRoadStroke: "#e0e0e0",
  mapStrokeDark: "#4a4a4a",
  mapDarkMarker: "#1a1a1a",
  reactionLike: "#4285F4",
  reactionLove: "#E0518F",
  reactionFire: "#FB8C00",
  reactionCelebrate: "#F5A623",
  light: {
    text: "#1A1A1A",
    textPrimary: "#1A1A1A",
    textSecondary: "#4A4A4A",
    textMuted: "#9E9E9E",
    textOnPrimary: "#FFFFFF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9E9E9E",
    tabIconSelected: "#00B14F",
    link: "#00B14F",
    primary: "#00B14F",
    primaryLight: "#00C95C",
    primaryDark: "#009940",
    backgroundRoot: "#FFFFFF",
    backgroundDefault: "#F5F5F5",
    backgroundElevated: "#FFFFFF",
    backgroundSecondary: "#E0E0E0",
    backgroundTertiary: "#D9D9D9",
    border: "#E0E0E0",
    error: "#E53935",
    warning: "#FB8C00",
    success: "#43A047",
    crypto: "#26A17B",
    blockchain: "#8247E5",
    evGreen: "#16a34a",
    info: "#0EA5E9",
    star: "#F5A623",
    card: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.5)",
    backgroundPressed: "#EBEBEB",
  },
  dark: {
    text: "#ECEDEE",
    textPrimary: "#ECEDEE",
    textSecondary: "#B0B0B0",
    textMuted: "#6E6E6E",
    textOnPrimary: "#FFFFFF",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6E6E6E",
    tabIconSelected: "#00C95C",
    link: "#00C95C",
    primary: "#00C95C",
    primaryLight: "#00D968",
    primaryDark: "#00B14F",
    backgroundRoot: "#1A1A1A",
    backgroundDefault: "#2A2C2E",
    backgroundElevated: "#353739",
    backgroundSecondary: "#353739",
    backgroundTertiary: "#404244",
    border: "#404244",
    error: "#EF5350",
    warning: "#FFA726",
    success: "#66BB6A",
    crypto: "#2EC090",
    blockchain: "#A47BF5",
    evGreen: "#22c55e",
    info: "#38BDF8",
    star: "#F5A623",
    card: "#2A2C2E",
    overlay: "rgba(0, 0, 0, 0.7)",
    backgroundPressed: "#404244",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 28,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 22,
    fontWeight: "600" as const,
  },
  h3: {
    fontSize: 18,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  bodyMedium: {
    fontSize: 14,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 12,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 11,
    fontWeight: "400" as const,
  },
  button: {
    fontSize: 16,
    fontWeight: "600" as const,
  },
  link: {
    fontSize: 16,
    fontWeight: "400" as const,
  },
  bodyBold: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  bodyHeavy: {
    fontSize: 14,
    fontWeight: "700" as const,
  },
  smallBold: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  smallHeavy: {
    fontSize: 12,
    fontWeight: "700" as const,
  },
  captionBold: {
    fontSize: 11,
    fontWeight: "600" as const,
  },
  label: {
    fontSize: 13,
    fontWeight: "500" as const,
  },
  labelBold: {
    fontSize: 13,
    fontWeight: "600" as const,
  },
  labelHeavy: {
    fontSize: 13,
    fontWeight: "700" as const,
  },
  smallMedium: {
    fontSize: 12,
    fontWeight: "500" as const,
  },
  bodyMediumMedium: {
    fontSize: 14,
    fontWeight: "500" as const,
  },
  h4Heavy: {
    fontSize: 16,
    fontWeight: "700" as const,
  },
  h2Heavy: {
    fontSize: 22,
    fontWeight: "700" as const,
  },
  h3Heavy: {
    fontSize: 18,
    fontWeight: "700" as const,
  },
  nano: {
    fontSize: 9,
    fontWeight: "400" as const,
  },
  micro: {
    fontSize: 10,
    fontWeight: "400" as const,
  },
  microBold: {
    fontSize: 10,
    fontWeight: "600" as const,
  },
  microHeavy: {
    fontSize: 10,
    fontWeight: "700" as const,
  },
  labelLight: {
    fontSize: 13,
    fontWeight: "400" as const,
  },
  bodySmall: {
    fontSize: 15,
    fontWeight: "400" as const,
  },
  bodySmallBold: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
  bodySmallHeavy: {
    fontSize: 15,
    fontWeight: "700" as const,
  },
  bodySmallMedium: {
    fontSize: 15,
    fontWeight: "500" as const,
  },
  bodyLarge: {
    fontSize: 17,
    fontWeight: "400" as const,
  },
  bodyLargeBold: {
    fontSize: 17,
    fontWeight: "600" as const,
  },
  bodyLargeHeavy: {
    fontSize: 17,
    fontWeight: "700" as const,
  },
  xl: {
    fontSize: 20,
    fontWeight: "400" as const,
  },
  xlBold: {
    fontSize: 20,
    fontWeight: "600" as const,
  },
  xlHeavy: {
    fontSize: 20,
    fontWeight: "700" as const,
  },
  xxl: {
    fontSize: 24,
    fontWeight: "400" as const,
  },
  xxlBold: {
    fontSize: 24,
    fontWeight: "600" as const,
  },
  xxlHeavy: {
    fontSize: 24,
    fontWeight: "700" as const,
  },
};

/**
 * Motion — the single motion language for the app.
 * Use these durations/springs everywhere instead of ad-hoc numbers so
 * transitions, presses, and badge pulses all feel like one system.
 *   fast    → micro-interactions (press feedback, toggles)
 *   base    → most UI transitions (tab underline, fades, sheet content)
 *   slow    → larger moves (sheets entering, screen-level fades)
 *   pulse   → looping attention effects (live dot, skeletons)
 */
export const Motion = {
  duration: {
    fast: 150,
    base: 220,
    slow: 350,
    pulse: 900,
  },
  // Spring config for Animated.spring press feedback (Button et al.)
  spring: {
    speed: 50,
    bounciness: 4,
  },
  pressScale: 0.97,
} as const;

/**
 * Opacity — shared interaction-state opacities. Pair with Motion.
 */
export const Opacity = {
  pressed: 0.85,
  disabled: 0.5,
  overlayText: 0.75,
} as const;

/**
 * Glass — the dark glassmorphic overlay treatment used on live surfaces
 * (Go Live, stream viewer, hook feed). One set of scrims/chips so every
 * overlay element sits in the same visual layer.
 */
export const Glass = {
  chip: "rgba(0,0,0,0.55)",       // pills/chips floating on video
  scrim: "rgba(0,0,0,0.65)",      // panels/cards floating on video
  scrimHeavy: "rgba(0,0,0,0.78)", // toasts needing max contrast
  border: "rgba(255,255,255,0.25)",
  iconOnGlass: "#FFFFFF",
  textOnGlass: "#FFFFFF",
  textOnGlassDim: "rgba(255,255,255,0.75)",
  fill: "rgba(255,255,255,0.2)",  // avatar/icon circles on glass
} as const;

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: {
      elevation: 4,
    },
    default: {},
  }),
  bottomSheet: Platform.select({
    ios: {
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: -4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
    },
    android: {
      elevation: 8,
    },
    default: {},
  }),
  fab: Platform.select({
    ios: {
      shadowColor: Colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 4,
    },
    android: {
      elevation: 6,
    },
    default: {},
  }),
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
