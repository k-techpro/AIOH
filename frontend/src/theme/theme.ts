import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";
import { useColorScheme } from "react-native";

// Premium Light Theme Colors
export const lightColors = {
  // Premium surfaces with warm tints
  // Matches web [data-theme="light"] canvas/card/utility colors.
  surface: "#F5F7FB",
  onSurface: "#172033",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#172033",
  surfaceTertiary: "#F8FAFF",
  onSurfaceTertiary: "#52627A",
  surfaceInverse: "#111827",
  onSurfaceInverse: "#FFFFFF",

  // Glass tokens for glassmorphism
  glassLight: "rgba(255, 255, 255, 0.5)",
  glassMedium: "rgba(255, 255, 255, 0.7)",
  glassDark: "rgba(255, 255, 255, 0.9)",
  glassOverlay: "rgba(255, 255, 255, 0.85)",
  glassBorder: "rgba(255, 255, 255, 0.3)",

  // Premium brand colors
  brand: "#6366F1",
  brandPrimary: "#6366F1",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#34D399",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#EEF2FF",
  onBrandTertiary: "#4F46E5",

  // Semantic colors
  success: "#10b981",
  successBg: "#ECFDF5",
  onSuccess: "#FFFFFF",
  warning: "#f59e0b",
  warningBg: "#FFFBEB",
  onWarning: "#FFFFFF",
  error: "#ef4444",
  errorBg: "#FEF2F2",
  onError: "#FFFFFF",
  info: "#3b82f6",
  infoBg: "#EFF6FF",
  onInfo: "#FFFFFF",

  // UI elements
  border: "#D8DEE8",
  borderStrong: "#C5CEDC",
  divider: "#E7EBF2",
  muted: "#52627A",

  // Chart colors (premium palette)
  chartColors: [
    "#667eea", // Purple
    "#3b82f6", // Blue
    "#10b981", // Green
    "#ec4899", // Pink
    "#f59e0b", // Amber
    "#06b6d4", // Cyan
    "#8b5cf6", // Violet
    "#f43f5e", // Rose
  ],
};

export const darkColors = {
  // Matches the web dark-first --background and card-surface gradients.
  surface: "#060911",
  onSurface: "#F9FAFB",
  surfaceSecondary: "#0E1320",
  onSurfaceSecondary: "#F3F4F6",
  surfaceTertiary: "#181F30",
  onSurfaceTertiary: "#E5E7EB",
  surfaceInverse: "#F9FAFB",
  onSurfaceInverse: "#111827",

  glassLight: "rgba(17, 24, 39, 0.5)",
  glassMedium: "rgba(17, 24, 39, 0.7)",
  glassDark: "rgba(17, 24, 39, 0.9)",
  glassOverlay: "rgba(17, 24, 39, 0.85)",
  glassBorder: "rgba(255, 255, 255, 0.1)",

  // Mirrors the web app's dark-first indigo/emerald visual identity.
  brand: "#818CF8",
  brandPrimary: "#6366F1",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#34D399",
  onBrandSecondary: "#062016",
  brandTertiary: "#1E2850",
  onBrandTertiary: "#C7D2FE",

  success: "#10B981",
  successBg: "#022C22",
  onSuccess: "#022C22",
  warning: "#F59E0B",
  warningBg: "#2A1706",
  onWarning: "#2A1706",
  error: "#EF4444",
  errorBg: "#2A0808",
  onError: "#2A0808",
  info: "#3B82F6",
  infoBg: "#0B1B33",
  onInfo: "#EFF6FF",

  border: "#1D2637",
  borderStrong: "#29364B",
  divider: "#111827",
  muted: "#9CA3AF",

  chartColors: [
    "#818cf8",
    "#60a5fa",
    "#34d399",
    "#f472b6",
    "#fbbf24",
    "#22d3ee",
    "#a78bfa",
    "#fb7185",
  ],
};

// Spacing system
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

// Border radius system
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  pill: 999,
};

// Shadow system for depth and elevation
export const shadows = {
  sm: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 8,
  },
  xl: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 12,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  }),
};

// Blur intensity levels
export const blur = {
  light: 20,
  medium: 40,
  strong: 60,
  extraStrong: 80,
};

// Gradient definitions
export const gradients = {
  brand: ["#818CF8", "#6366F1"] as const,
  brandVertical: ["#818CF8", "#6366F1"] as const,
  success: ["#11998e", "#38ef7d"] as const,
  warning: ["#f093fb", "#f5576c"] as const,
  info: ["#4facfe", "#00f2fe"] as const,
  sunset: ["#ff6b6b", "#feca57"] as const,
  ocean: ["#6366F1", "#34D399"] as const,
  purple: ["#a855f7", "#ec4899"] as const,
  warm: ["#f59e0b", "#ef4444"] as const,
};

// Animation timing
export const animations = {
  quick: 150,
  normal: 250,
  slow: 350,
  verySlow: 500,
  spring: {
    tension: 300,
    friction: 20,
  },
};

export type Colors = typeof lightColors;
export type Shadows = typeof shadows;
export type Gradients = typeof gradients;

export type ThemePreference = "light" | "dark" | "system";

type ThemeContextValue = {
  colors: Colors;
  isDark: boolean;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => Promise<void>;
  toggleTheme: () => Promise<void>;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  blur: typeof blur;
  gradients: typeof gradients;
  animations: typeof animations;
};

const THEME_PREFERENCE_KEY = "retailprime.theme-preference";
const ThemeContext = createContext<ThemeContextValue | null>(null);

function useThemeValue(): ThemeContextValue {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");

  useEffect(() => {
    AsyncStorage.getItem(THEME_PREFERENCE_KEY)
      .then((saved) => {
        if (saved === "light" || saved === "dark" || saved === "system") setPreferenceState(saved);
      })
      .catch(() => undefined);
  }, []);

  const isDark = (preference === "system" ? systemScheme : preference) === "dark";
  const setPreference = async (next: ThemePreference) => {
    setPreferenceState(next);
    try { await AsyncStorage.setItem(THEME_PREFERENCE_KEY, next); } catch { /* preference remains active for this session */ }
  };
  const toggleTheme = () => setPreference(isDark ? "light" : "dark");

  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    preference,
    setPreference,
    toggleTheme,
    spacing,
    radius,
    shadows,
    blur,
    gradients,
    animations,
  };
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return React.createElement(ThemeContext.Provider, { value: useThemeValue() }, children);
}

/** Returns system-aware, persisted RetailPrime visual tokens. */
export function useTheme() {
  const context = useContext(ThemeContext);
  const systemScheme = useColorScheme();
  if (context) return context;
  // Safe fallback for isolated component tests that do not mount the provider.
  const isDark = systemScheme === "dark";
  return { colors: isDark ? darkColors : lightColors, isDark, preference: "system" as ThemePreference,
    setPreference: async () => undefined, toggleTheme: async () => undefined,
    spacing, radius, shadows, blur, gradients, animations };
}
