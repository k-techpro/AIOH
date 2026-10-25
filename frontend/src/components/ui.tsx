import React from "react";
import { View, Text, Pressable, TextInput, type TextInputProps, ViewStyle, Animated, type ColorValue } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";
import { formatINR, formatPercent } from "../utils/format";
type GradientColors = readonly [ColorValue, ColorValue, ...ColorValue[]];

// ============================================================================
// GLASS CARD COMPONENT
// ============================================================================
export function GlassCard({
  children,
  style,
  testID,
  intensity = 40,
  gradient,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  intensity?: number;
  gradient?: GradientColors;
}) {
  const { colors, radius, shadows, isDark } = useTheme();

  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            borderRadius: radius.lg,
            padding: 16,
            ...shadows.md,
          },
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? "dark" : "light"}
      style={[
        {
          borderRadius: radius.lg,
          overflow: "hidden",
          backgroundColor: colors.glassOverlay,
          borderWidth: 1,
          borderColor: colors.glassBorder,
        },
        shadows.md,
      ]}
    >
      <View
        testID={testID}
        style={[
          {
            padding: 16,
          },
          style,
        ]}
      >
        {children}
      </View>
    </BlurView>
  );
}

// ============================================================================
// REGULAR CARD (for non-glass contexts)
// ============================================================================
export function Card({
  children,
  style,
  testID,
  gradient,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
  gradient?: GradientColors;
}) {
  const { colors, radius, shadows } = useTheme();

  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            borderRadius: radius.lg,
            padding: 16,
            ...shadows.md,
          },
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: colors.surfaceSecondary,
          borderRadius: radius.lg,
          padding: 16,
          ...shadows.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ============================================================================
// STATUS BADGE
// ============================================================================
export function StatusBadge({ status }: { status: string }) {
  const { colors, radius } = useTheme();
  const map: Record<string, { bg: string; fg: string; label: string; icon?: any }> = {
    paid: { bg: colors.successBg, fg: colors.success, label: "Paid", icon: "checkmark-circle" },
    partial: { bg: colors.warningBg, fg: colors.warning, label: "Partial", icon: "time" },
    due: { bg: colors.errorBg, fg: colors.error, label: "Due", icon: "alert-circle" },
    refunded: { bg: colors.infoBg, fg: colors.info, label: "Refunded", icon: "arrow-undo" },
    completed: { bg: colors.successBg, fg: colors.success, label: "Completed", icon: "checkmark-circle" },
    in_transit: { bg: colors.infoBg, fg: colors.info, label: "In Transit", icon: "airplane" },
    pending: { bg: colors.warningBg, fg: colors.warning, label: "Pending", icon: "time" },
    in_stock: { bg: colors.successBg, fg: colors.success, label: "In Stock", icon: "checkmark" },
    low_stock: { bg: colors.warningBg, fg: colors.warning, label: "Low Stock", icon: "warning" },
    out_stock: { bg: colors.errorBg, fg: colors.error, label: "Out of Stock", icon: "close-circle" },
    active: { bg: colors.successBg, fg: colors.success, label: "Active", icon: "checkmark-circle" },
  };
  const s = map[status] || { bg: colors.surfaceTertiary, fg: colors.onSurface, label: status };

  return (
    <View
      style={{
        backgroundColor: s.bg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: radius.pill,
        alignSelf: "flex-start",
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
      }}
    >
      {s.icon && <Ionicons name={s.icon} size={12} color={s.fg} />}
      <Text style={{ color: s.fg, fontSize: 11, fontWeight: "600" }}>{s.label}</Text>
    </View>
  );
}

// ============================================================================
// KPI CARD with Glass Effect
// ============================================================================
export function KpiCard({
  label,
  value,
  change,
  icon,
  iconColor,
  compact,
  testID,
  gradient,
}: {
  label: string;
  value: number | string;
  change?: number;
  icon: any;
  iconColor?: string;
  compact?: boolean;
  testID?: string;
  gradient?: GradientColors;
}) {
  const { colors, radius, shadows, gradients } = useTheme();
  const positive = (change ?? 0) >= 0;

  const content = (
    <View style={{ padding: 16, minHeight: 120 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View
          style={{
            backgroundColor: gradient ? "rgba(255,255,255,0.2)" : (iconColor || colors.brand) + "15",
            padding: 10,
            borderRadius: radius.md,
          }}
        >
          <Ionicons name={icon} size={20} color={gradient ? "#FFFFFF" : iconColor || colors.brand} />
        </View>
        {change !== undefined && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Ionicons
              name={positive ? "trending-up" : "trending-down"}
              size={14}
              color={gradient ? "#FFFFFF" : positive ? colors.success : colors.error}
            />
            <Text
              style={{
                color: gradient ? "#FFFFFF" : positive ? colors.success : colors.error,
                fontSize: 12,
                fontWeight: "600",
              }}
            >
              {formatPercent(change)}
            </Text>
          </View>
        )}
      </View>
      <Text
        style={{
          color: gradient ? "rgba(255,255,255,0.8)" : colors.muted,
          fontSize: 12,
          marginTop: 12,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: gradient ? "#FFFFFF" : colors.onSurface,
          fontSize: 24,
          fontWeight: "700",
          marginTop: 4,
        }}
      >
        {typeof value === "number" ? formatINR(value, compact) : value}
      </Text>
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          {
            borderRadius: radius.lg,
            ...shadows.md,
          },
        ]}
      >
        {content}
      </LinearGradient>
    );
  }

  return (
    <GlassCard testID={testID} style={{ padding: 0 }}>
      {content}
    </GlassCard>
  );
}

// ============================================================================
// PRIMARY BUTTON with Glass Effect
// ============================================================================
export function PrimaryButton({
  label,
  onPress,
  icon,
  testID,
  style,
  disabled,
  gradient,
}: {
  label: string;
  onPress: () => void;
  icon?: any;
  testID?: string;
  style?: ViewStyle;
  disabled?: boolean;
  gradient?: GradientColors;
}) {
  const { colors, radius, shadows } = useTheme();

  if (gradient && !disabled) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [
          {
            opacity: pressed ? 0.85 : 1,
          },
          style,
        ]}
      >
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: radius.md,
            paddingVertical: 14,
            paddingHorizontal: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            ...shadows.md,
          }}
        >
          {icon && <Ionicons name={icon} size={18} color="#FFFFFF" />}
          <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>{label}</Text>
        </LinearGradient>
      </Pressable>
    );
  }

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          backgroundColor: disabled ? colors.borderStrong : colors.brandPrimary,
          borderRadius: radius.md,
          paddingVertical: 14,
          paddingHorizontal: 20,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: pressed ? 0.85 : 1,
          ...shadows.md,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={18} color={colors.onBrandPrimary} />}
      <Text style={{ color: colors.onBrandPrimary, fontSize: 15, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

// ============================================================================
// SECONDARY BUTTON
// ============================================================================
export function SecondaryButton({ label, onPress, icon, testID, style }: any) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [
        {
          backgroundColor: colors.surfaceTertiary,
          borderRadius: radius.md,
          paddingVertical: 12,
          paddingHorizontal: 16,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          opacity: pressed ? 0.7 : 1,
        },
        style,
      ]}
    >
      {icon && <Ionicons name={icon} size={16} color={colors.onSurface} />}
      <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

/** Web-equivalent outlined/filled text field used by mobile form surfaces. */
export function AiohInput({ label, error, style, ...props }: TextInputProps & { label?: string; error?: string; style?: ViewStyle }) {
  const { colors, radius } = useTheme();
  return (
    <View>
      {label && <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 6 }}>{label}</Text>}
      <TextInput
        {...props}
        placeholderTextColor={colors.muted}
        style={[{
          minHeight: props.multiline ? 76 : 48,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.onSurface,
          backgroundColor: colors.surfaceTertiary,
          borderWidth: 1,
          borderColor: error ? colors.error : colors.border,
          borderRadius: radius.md,
          fontSize: 15,
        }, style]}
      />
      {error && <Text style={{ color: colors.error, fontSize: 11, marginTop: 5 }}>{error}</Text>}
    </View>
  );
}

/** 44dp glass icon target matching the web topbar/action treatment. */
export function AiohIconButton({ icon, onPress, label, testID, style, iconColor }: { icon: any; onPress: () => void; label?: string; testID?: string; style?: ViewStyle; iconColor?: string }) {
  const { colors, radius } = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} testID={testID} onPress={onPress} style={({ pressed }) => [{ width: 44, height: 44, borderRadius: radius.md, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.72 : 1 }, style]}><Ionicons name={icon} size={20} color={iconColor || colors.onSurface} /></Pressable>;
}

// ============================================================================
// SCREEN HEADER
// ============================================================================
export function ScreenHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        flexDirection: "row",
        alignItems: "flex-end",
        justifyContent: "space-between",
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "600" }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: any;
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  const { colors, radius } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: 40,
          backgroundColor: colors.surfaceTertiary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={36} color={colors.muted} />
      </View>
      <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, textAlign: "center", maxWidth: 280 }}>{message}</Text>
      {action}
    </View>
  );
}

// ============================================================================
// FLOATING ACTION BUTTON
// ============================================================================
export function FloatingActionButton({
  icon,
  onPress,
  testID,
  badge,
}: {
  icon: any;
  onPress: () => void;
  testID?: string;
  badge?: number;
}) {
  const { colors, shadows, gradients } = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: "center",
        justifyContent: "center",
        transform: [{ scale: pressed ? 0.95 : 1 }],
      })}
    >
      <LinearGradient
        colors={gradients.brand}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: "center",
          justifyContent: "center",
          ...shadows.lg,
        }}
      >
        <Ionicons name={icon} size={24} color="#FFFFFF" />
        {badge && badge > 0 && (
          <View
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              backgroundColor: colors.error,
              minWidth: 18,
              height: 18,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 4,
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "700" }}>{badge > 99 ? "99+" : badge}</Text>
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}
