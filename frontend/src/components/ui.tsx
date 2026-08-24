import React from "react";
import { View, Text, StyleSheet, Pressable, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";
import { formatINR, formatPercent } from "../utils/format";

export function Card({ children, style, testID }: { children: React.ReactNode; style?: ViewStyle; testID?: string }) {
  const { colors, radius } = useTheme();
  return (
    <View testID={testID} style={[{
      backgroundColor: colors.surfaceSecondary,
      borderRadius: radius.lg,
      padding: 16,
      shadowColor: "#0F172A",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
    }, style]}>{children}</View>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const { colors } = useTheme();
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    paid: { bg: colors.successBg, fg: colors.success, label: "Paid" },
    partial: { bg: colors.warningBg, fg: colors.warning, label: "Partial" },
    due: { bg: colors.errorBg, fg: colors.error, label: "Due" },
    refunded: { bg: colors.infoBg, fg: colors.info, label: "Refunded" },
    completed: { bg: colors.successBg, fg: colors.success, label: "Completed" },
    in_transit: { bg: colors.infoBg, fg: colors.info, label: "In Transit" },
    pending: { bg: colors.warningBg, fg: colors.warning, label: "Pending" },
    in_stock: { bg: colors.successBg, fg: colors.success, label: "In Stock" },
    low_stock: { bg: colors.warningBg, fg: colors.warning, label: "Low Stock" },
    out_stock: { bg: colors.errorBg, fg: colors.error, label: "Out of Stock" },
    active: { bg: colors.successBg, fg: colors.success, label: "Active" },
  };
  const s = map[status] || { bg: colors.surfaceTertiary, fg: colors.onSurface, label: status };
  return (
    <View style={{ backgroundColor: s.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, alignSelf: "flex-start" }}>
      <Text style={{ color: s.fg, fontSize: 11, fontWeight: "500" }}>{s.label}</Text>
    </View>
  );
}

export function KpiCard({ label, value, change, icon, iconColor, compact, testID, subtle }: {
  label: string; value: number | string; change?: number; icon: any; iconColor?: string; compact?: boolean; testID?: string; subtle?: boolean;
}) {
  const { colors, radius } = useTheme();
  const positive = (change ?? 0) >= 0;
  return (
    <Card testID={testID} style={{ padding: 16, minHeight: 120 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ backgroundColor: (iconColor || colors.brand) + "15", padding: 8, borderRadius: radius.md }}>
          <Ionicons name={icon} size={18} color={iconColor || colors.brand} />
        </View>
        {change !== undefined && (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
            <Ionicons name={positive ? "trending-up" : "trending-down"} size={12} color={positive ? colors.success : colors.error} />
            <Text style={{ color: positive ? colors.success : colors.error, fontSize: 11, fontWeight: "500" }}>{formatPercent(change)}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 12 }}>{label}</Text>
      <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500", marginTop: 2 }}>
        {typeof value === "number" ? formatINR(value, compact) : value}
      </Text>
    </Card>
  );
}

export function PrimaryButton({ label, onPress, icon, testID, style, disabled }: {
  label: string; onPress: () => void; icon?: any; testID?: string; style?: ViewStyle; disabled?: boolean;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [{
        backgroundColor: disabled ? colors.borderStrong : colors.brandPrimary,
        borderRadius: radius.md,
        paddingVertical: 14,
        paddingHorizontal: 20,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        opacity: pressed ? 0.85 : 1,
      }, style]}
    >
      {icon && <Ionicons name={icon} size={18} color={colors.onBrandPrimary} />}
      <Text style={{ color: colors.onBrandPrimary, fontSize: 15, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ label, onPress, icon, testID, style }: any) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => [{
        backgroundColor: colors.surfaceTertiary,
        borderRadius: radius.md,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        opacity: pressed ? 0.7 : 1,
      }, style]}
    >
      {icon && <Ionicons name={icon} size={16} color={colors.onSurface} />}
      <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{label}</Text>
    </Pressable>
  );
}

export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "500" }}>{title}</Text>
        {subtitle && <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: any; title: string; message: string; action?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: 32, gap: 12 }}>
      <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
        <Ionicons name={icon} size={32} color={colors.muted} />
      </View>
      <Text style={{ color: colors.onSurface, fontSize: 17, fontWeight: "500" }}>{title}</Text>
      <Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{message}</Text>
      {action}
    </View>
  );
}
