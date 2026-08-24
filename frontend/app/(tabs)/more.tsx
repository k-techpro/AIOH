import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { useAppStore } from "../../src/store/shop";

const SECTIONS = [
  {
    title: "SALES",
    items: [
      { icon: "receipt-outline", label: "Invoice History", route: "/invoice-history", color: "#2563EB" },
      { icon: "return-up-back-outline", label: "Returns & Refunds", route: "/returns", color: "#D97706" },
    ],
  },
  {
    title: "INVENTORY",
    items: [
      { icon: "swap-horizontal-outline", label: "Stock Transfer", route: "/stock-transfer", color: "#059669" },
      { icon: "barcode-outline", label: "Barcode Generator", route: "/barcode-generator", color: "#0F172A" },
    ],
  },
  {
    title: "FINANCE",
    items: [
      { icon: "wallet-outline", label: "Expenses", route: "/expenses", color: "#DC2626" },
      { icon: "trending-up-outline", label: "Finance Overview", route: "/finance", color: "#059669" },
    ],
  },
  {
    title: "REPORTS",
    items: [
      { icon: "analytics-outline", label: "All Reports", route: "/reports", color: "#2563EB" },
      { icon: "document-text-outline", label: "GST Summary", route: "/gst-report", color: "#8B5CF6" },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { icon: "storefront-outline", label: "Shops", route: "/shops", color: "#0F172A" },
      { icon: "construct-outline", label: "Services", route: "/services", color: "#0891B2" },
      { icon: "people-outline", label: "Staff & Roles", route: "/staff", color: "#7C3AED" },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { icon: "settings-outline", label: "General Settings", route: "/settings", color: "#6B7280" },
      { icon: "notifications-outline", label: "Notifications", route: "/notifications", color: "#D97706" },
    ],
  },
];

export default function More() {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const { shopName } = useAppStore();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "500" }}>More</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>Manage every aspect of your business</Text>

        <Pressable testID="switch-shop-btn" onPress={() => router.replace("/")} style={{ marginTop: 16, backgroundColor: colors.brand, borderRadius: 12, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.onBrandPrimary, opacity: 0.7, fontSize: 11, letterSpacing: 0.5 }}>CURRENT SHOP</Text>
            <Text style={{ color: colors.onBrandPrimary, fontSize: 16, fontWeight: "500", marginTop: 2 }}>{shopName || "No shop selected"}</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ color: colors.onBrandPrimary, opacity: 0.9, fontSize: 12 }}>Switch</Text>
            <Ionicons name="swap-horizontal" size={16} color={colors.onBrandPrimary} />
          </View>
        </Pressable>

        {SECTIONS.map((section) => (
          <View key={section.title} style={{ marginTop: 24 }}>
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>{section.title}</Text>
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: colors.border }}>
              {section.items.map((item, i) => (
                <Pressable
                  key={item.route}
                  testID={`more-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onPress={() => router.push(item.route as any)}
                  style={{ padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }}
                >
                  <View style={{ width: 34, height: 34, borderRadius: 8, backgroundColor: item.color + "18", alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon as any} size={18} color={item.color} />
                  </View>
                  <Text style={{ flex: 1, color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
