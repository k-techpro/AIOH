import { useColorScheme } from "react-native";

export const lightColors = {
  surface: "#F9FAFB",
  onSurface: "#111827",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#1F2937",
  surfaceTertiary: "#F3F4F6",
  onSurfaceTertiary: "#374151",
  surfaceInverse: "#111827",
  onSurfaceInverse: "#FFFFFF",
  brand: "#0F172A",
  brandPrimary: "#0F172A",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#334155",
  onBrandSecondary: "#FFFFFF",
  brandTertiary: "#E2E8F0",
  onBrandTertiary: "#0F172A",
  success: "#059669",
  successBg: "#ECFDF5",
  onSuccess: "#FFFFFF",
  warning: "#D97706",
  warningBg: "#FFFBEB",
  onWarning: "#FFFFFF",
  error: "#DC2626",
  errorBg: "#FEF2F2",
  onError: "#FFFFFF",
  info: "#2563EB",
  infoBg: "#EFF6FF",
  onInfo: "#FFFFFF",
  border: "#E5E7EB",
  borderStrong: "#D1D5DB",
  divider: "#F3F4F6",
  muted: "#6B7280",
};

export const darkColors = {
  surface: "#0B1220",
  onSurface: "#F9FAFB",
  surfaceSecondary: "#111827",
  onSurfaceSecondary: "#F3F4F6",
  surfaceTertiary: "#1F2937",
  onSurfaceTertiary: "#E5E7EB",
  surfaceInverse: "#F9FAFB",
  onSurfaceInverse: "#111827",
  brand: "#FFFFFF",
  brandPrimary: "#FFFFFF",
  onBrandPrimary: "#0B1220",
  brandSecondary: "#9CA3AF",
  onBrandSecondary: "#0B1220",
  brandTertiary: "#374151",
  onBrandTertiary: "#F9FAFB",
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
  border: "#1F2937",
  borderStrong: "#374151",
  divider: "#111827",
  muted: "#9CA3AF",
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const radius = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 };

export type Colors = typeof lightColors;

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return {
    colors: isDark ? darkColors : lightColors,
    isDark,
    spacing,
    radius,
  };
}
