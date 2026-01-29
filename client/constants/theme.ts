import { Platform } from "react-native";

export const Colors = {
  travonyGreen: "#00B14F",
  travonyGold: "#FFB800",
  light: {
    text: "#1A1A1A",
    textPrimary: "#1A1A1A",
    textSecondary: "#4A4A4A",
    textMuted: "#9E9E9E",
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
    card: "#FFFFFF",
    overlay: "rgba(0, 0, 0, 0.5)",
    backgroundPressed: "#EBEBEB",
  },
  dark: {
    text: "#ECEDEE",
    textPrimary: "#ECEDEE",
    textSecondary: "#B0B0B0",
    textMuted: "#6E6E6E",
    buttonText: "#FFFFFF",
    tabIconDefault: "#6E6E6E",
    tabIconSelected: "#00C95C",
    link: "#00C95C",
    primary: "#00C95C",
    primaryLight: "#00D968",
    primaryDark: "#00B14F",
    backgroundRoot: "#1A1A1A",
    backgroundDefault: "#2A2C2E",
    backgroundElevated: "#2A2C2E",
    backgroundSecondary: "#353739",
    backgroundTertiary: "#404244",
    border: "#404244",
    error: "#EF5350",
    warning: "#FFA726",
    success: "#66BB6A",
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
};

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: "#000",
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
      shadowColor: "#000",
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
      shadowColor: "#000",
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
