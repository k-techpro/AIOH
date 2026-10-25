import React, { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AiohIconButton, Card, StatusBadge } from "../../src/components/ui";
import { useTheme } from "../../src/theme/theme";
import { formatINR, greeting } from "../../src/utils/format";
import { useAppStore } from "../../src/store/shop";
import { useMockStore } from "../../src/store/mock-data";

type Action = { label: string; icon: any; route: string; tone: "primary" | "success" | "warning" | "error" | "info" };
const groups: { title: string; actions: Action[] }[] = [
  { title: "SALES & BILLING", actions: [
    { label: "New Sale", icon: "add-circle-outline", route: "/(tabs)/pos", tone: "primary" },
    { label: "Customers", icon: "people-outline", route: "/(tabs)/customers", tone: "info" },
    { label: "Invoices", icon: "receipt-outline", route: "/invoice-history", tone: "primary" },
    { label: "Services", icon: "construct-outline", route: "/services", tone: "success" },
  ] },
  { title: "QUICK ACTIONS", actions: [
    { label: "Return Product", icon: "reload-outline", route: "/returns", tone: "error" },
    { label: "Pay Later", icon: "time-outline", route: "/pay-later", tone: "warning" },
    { label: "History", icon: "time-outline", route: "/history", tone: "info" },
    { label: "Walk-in List", icon: "people-outline", route: "/walk-in", tone: "success" },
  ] },
  { title: "INVENTORY & OPERATIONS", actions: [
    { label: "Products", icon: "cube-outline", route: "/(tabs)/inventory", tone: "warning" },
    { label: "Stock Check", icon: "layers-outline", route: "/stock", tone: "info" },
    { label: "Expenses", icon: "wallet-outline", route: "/expenses", tone: "error" },
    { label: "Reports", icon: "bar-chart-outline", route: "/(tabs)/reports", tone: "primary" },
  ] },
];

export default function Dashboard() {
  const { colors, isDark, toggleTheme, radius, shadows } = useTheme();
  const router = useRouter();
  const { shopId, shopName } = useAppStore();
  const products = useMockStore((s) => s.products);
  const invoices = useMockStore((s) => s.invoices);
  const customers = useMockStore((s) => s.customers);
  const services = useMockStore((s) => s.services);
  const [refreshing, setRefreshing] = useState(false);
  const scopedInvoices = useMemo(() => invoices.filter((item) => shopId === "all" || item.shop_id === shopId), [invoices, shopId]);
  const today = new Date().toDateString();
  const todayInvoices = scopedInvoices.filter((item) => new Date(item.created_at || item.createdAt || 0).toDateString() === today);
  const revenue = todayInvoices.reduce((sum, item) => sum + Number(item.total || 0), 0);
  const pending = scopedInvoices.reduce((sum, item) => sum + Number(item.balance_due || item.balance || 0), 0);
  const lowStock = products.filter((item) => (shopId === "all" || item.shop_id === shopId) && Number(item.stock) <= Number(item.min_stock)).length;
  // Same pending / ready service counts as the web dashboard (Quick Service Bills are Delivered, never pending).
  const scopedServices = services.filter((x: any) => shopId === "all" || x.shop_id === shopId);
  const pendingServices = scopedServices.filter((x: any) => !["Ready", "Delivered", "Cancelled", "READY"].includes(x.status)).length;
  const readyServices = scopedServices.filter((x: any) => x.status === "Ready" || x.status === "READY").length;
  const customerCount = customers.filter((item) => shopId === "all" || item.shop_id === shopId).length;
  const tone = (kind: Action["tone"]) => ({ primary: colors.brand, success: colors.success, warning: colors.warning, error: colors.error, info: colors.info }[kind]);
  const refresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 500); };

  return <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
    <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 108, gap: 20 }} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.brand} />}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 23, fontWeight: "800", letterSpacing: -0.4 }}>ALL IN ONE HUB</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{shopName || "Select a branch"}</Text>
        </View>
        <AiohIconButton icon={isDark ? "sunny-outline" : "moon-outline"} label="Toggle theme" onPress={toggleTheme} />
        <AiohIconButton icon="search" label="Search" onPress={() => router.push("/search" as any)} />
        <AiohIconButton icon="notifications-outline" label="Notifications" onPress={() => router.push("/notifications" as any)} />
      </View>

      <View>
        <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "800" }}>{greeting()}</Text>
        <Text style={{ color: colors.muted, fontSize: 14, marginTop: 5 }}>Here’s what’s happening with your business today.</Text>
      </View>

      <Card style={{ padding: 18, borderWidth: 1, borderColor: colors.border, ...shadows.md }}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, fontWeight: "800" }}>TODAY’S REVENUE</Text>
        <Text style={{ color: colors.success, fontSize: 31, fontWeight: "800", marginTop: 7 }}>{formatINR(revenue)}</Text>
        <View style={{ flexDirection: "row", marginTop: 18, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
          {[{ label: "Sales", value: todayInvoices.length, color: colors.onSurface }, { label: "Avg bill", value: todayInvoices.length ? formatINR(revenue / todayInvoices.length) : formatINR(0), color: colors.onSurface }, { label: "Pending", value: formatINR(pending), color: colors.warning }].map((metric) => <View key={metric.label} style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>{metric.label}</Text><Text numberOfLines={1} style={{ color: metric.color, fontSize: 15, fontWeight: "800", marginTop: 4 }}>{metric.value}</Text></View>)}
        </View>
      </Card>

      {groups.map((group) => <View key={group.title}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1.1, fontWeight: "800", marginBottom: 10 }}>{group.title}</Text>
        <Card style={{ padding: 10, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {group.actions.map((action) => <Pressable key={action.label} onPress={() => router.push(action.route as any)} style={({ pressed }) => ({ width: "48%", minHeight: 82, padding: 12, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceTertiary, opacity: pressed ? 0.74 : 1, justifyContent: "space-between" })}>
              <Ionicons name={action.icon} size={20} color={tone(action.tone)} />
              <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "700" }}>{action.label}</Text>
            </Pressable>)}
          </View>
        </Card>
      </View>)}

      <View>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1.1, fontWeight: "800", marginBottom: 10 }}>BUSINESS SNAPSHOT</Text>
        <Card style={{ borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>Customers</Text><Text style={{ color: colors.info, fontWeight: "800" }}>{customerCount}</Text></View>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
          <Pressable onPress={() => router.push("/services" as any)} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>Pending services</Text><Text testID="dash-pending-services" style={{ color: colors.warning, fontWeight: "800" }}>{pendingServices} · {readyServices} ready</Text></Pressable>
          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 12 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>Low stock items</Text><View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}><Text style={{ color: colors.warning, fontWeight: "800" }}>{lowStock}</Text><StatusBadge status={lowStock ? "low_stock" : "in_stock"} /></View></View>
        </Card>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
