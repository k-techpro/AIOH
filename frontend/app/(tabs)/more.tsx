import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../src/theme/theme";
import { useAppStore } from "../../src/store/shop";
import { GlassCard } from "../../src/components/ui";

const SECTIONS = [
  {
    title: "SALES",
    items: [
      { icon: "receipt-outline", label: "Invoice History", route: "/invoice-history", color: "#667eea" },
      { icon: "return-up-back-outline", label: "Returns & Refunds", route: "/returns", color: "#f59e0b" },
      { icon: "people-circle-outline", label: "Walk-in List", route: "/walk-in", color: "#06b6d4" },
      { icon: "time-outline", label: "History", route: "/history", color: "#8b5cf6" },
    ],
  },
  {
    title: "INVENTORY",
    items: [
      { icon: "layers-outline", label: "Stock & Movements", route: "/stock", color: "#0ea5e9" },
      { icon: "swap-horizontal-outline", label: "Stock Transfer", route: "/stock-transfer", color: "#10b981" },
      { icon: "barcode-outline", label: "Barcode Generator", route: "/barcode-generator", color: "#374151" },
    ],
  },
  {
    title: "FINANCE",
    items: [
      { icon: "wallet-outline", label: "Expenses", route: "/expenses", color: "#ef4444" },
      { icon: "card-outline", label: "Pay Later", route: "/pay-later", color: "#f59e0b" },
      { icon: "cash-outline", label: "Payments", route: "/payments", color: "#22c55e" },
      { icon: "trending-up-outline", label: "Finance Overview", route: "/finance", color: "#10b981" },
    ],
  },
  {
    title: "REPORTS",
    items: [
      { icon: "analytics-outline", label: "All Reports", route: "/reports", color: "#3b82f6" },
      { icon: "document-text-outline", label: "GST Summary", route: "/gst-report", color: "#ec4899" },
    ],
  },
  {
    title: "BUSINESS",
    items: [
      { icon: "storefront-outline", label: "Shops", route: "/shops", color: "#667eea" },
      { icon: "construct-outline", label: "Services", route: "/services", color: "#06b6d4" },
      { icon: "people-outline", label: "Staff & Roles", route: "/staff", color: "#8b5cf6" },
      { icon: "calendar-outline", label: "Attendance", route: "/attendance", color: "#0ea5e9" },
      { icon: "reader-outline", label: "Notes", route: "/notes", color: "#eab308" },
      { icon: "pricetags-outline", label: "Coupons", route: "/coupon-management", color: "#ec4899" },
      { icon: "phone-portrait-outline", label: "Used Mobiles", route: "/used-mobiles", color: "#14b8a6" },
      { icon: "time-outline", label: "Activity Log", route: "/activity-log", color: "#f59e0b" },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { icon: "cloud-outline", label: "Firebase", route: "/firebase", color: "#2563EB" },
      { icon: "settings-outline", label: "General Settings", route: "/settings", color: "#6B7280" },
      { icon: "notifications-outline", label: "Notifications", route: "/notifications", color: "#f59e0b" },
    ],
  },
];

export default function More() {
  const { colors, radius, shadows, gradients } = useTheme();
  const router = useRouter();
  const { shopName } = useAppStore();

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: "600" }}>BUSINESS HUB</Text>
        <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "700", marginTop: 4 }}>More Options</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>Manage every aspect of your retail primeland</Text>

        {/* Current Shop switcher card */}
        <Pressable
          testID="switch-shop-btn"
          onPress={() => router.replace("/")}
          style={({ pressed }) => ({
            marginTop: 20,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <LinearGradient
            colors={gradients.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              ...shadows.md,
            }}
          >
            <View>
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 0.8, fontWeight: "700" }}>
                CURRENT ACTIVE SHOP
              </Text>
              <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700", marginTop: 4 }}>
                {shopName || "No shop selected"}
              </Text>
            </View>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "600" }}>Switch</Text>
              <Ionicons name="swap-horizontal" size={14} color="#FFFFFF" />
            </View>
          </LinearGradient>
        </Pressable>

        {/* Section List */}
        {SECTIONS.map((section) => (
          <View key={section.title} style={{ marginTop: 24 }}>
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1.2, fontWeight: "700", marginBottom: 10, marginLeft: 4 }}>
              {section.title}
            </Text>
            <GlassCard style={{ padding: 0, overflow: "hidden" }}>
              {section.items.map((item, i) => (
                <Pressable
                  key={item.route}
                  testID={`more-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                  onPress={() => router.push(item.route as any)}
                  style={({ pressed }) => ({
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.glassBorder,
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: pressed ? "rgba(99, 102, 241, 0.05)" : "transparent",
                  })}
                >
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: item.color + "15",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={{ flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "600" }}>
                    {item.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </GlassCard>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
