import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, RefreshControl, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LineChart, PieChart } from "react-native-gifted-charts";
import { useTheme } from "../../src/theme/theme";
import { formatINR, formatPercent, formatTime, greeting } from "../../src/utils/format";
import { api } from "../../src/api/client";
import { useAppStore } from "../../src/store/shop";
import { Card, KpiCard, StatusBadge } from "../../src/components/ui";

export default function Dashboard() {
  const { colors, radius } = useTheme();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { shopId, shopName } = useAppStore();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<"7D" | "30D">("30D");

  const load = async () => {
    if (!shopId) return;
    try {
      const d = await api.dashboard(shopId);
      setData(d);
    } catch (e) { console.log(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useFocusEffect(useCallback(() => { load(); }, [shopId]));

  if (!shopId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: 24 }}>
        <Text style={{ color: colors.onSurface, fontSize: 16 }}>Please select a shop first</Text>
        <Pressable testID="pick-shop" onPress={() => router.replace("/")} style={{ marginTop: 12, backgroundColor: colors.brand, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 }}>
          <Text style={{ color: colors.onBrandPrimary }}>Choose shop</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  if (loading || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.brand} />
      </SafeAreaView>
    );
  }

  const k = data.kpis;
  const trend = period === "7D" ? data.trend_30.slice(-7) : data.trend_30;
  const chartData = trend.map((t: any) => ({ value: t.revenue, label: t.date }));
  const maxRev = Math.max(...trend.map((t: any) => t.revenue));

  const attention: any[] = [];
  if (k.out_stock > 0) attention.push({ id: "out", icon: "alert-circle", tone: "error", label: `${k.out_stock} products are out of stock`, action: "Restock", target: "/inventory" });
  if (k.low_stock > 0) attention.push({ id: "low", icon: "warning", tone: "warning", label: `${k.low_stock} products are running low`, action: "Review", target: "/(tabs)/inventory" });
  if (k.outstanding > 0) attention.push({ id: "due", icon: "cash", tone: "warning", label: `${formatINR(k.outstanding, true)} outstanding from ${k.due_customers} customers`, action: "Collect", target: "/(tabs)/customers" });
  attention.push({ id: "ok", icon: "checkmark-circle", tone: "success", label: `${k.today_orders} invoices generated today`, action: "View", target: "/invoice-history" });

  const catColors = [colors.brand, colors.info, colors.success, colors.warning, colors.error, "#8B5CF6", "#EC4899", "#14B8A6"];
  const pieData = (data.categories || []).slice(0, 6).map((c: any, i: number) => ({
    value: c.value, color: catColors[i], text: "", label: c.name,
  }));
  const totalCat = pieData.reduce((a: number, b: any) => a + b.value, 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      >
        {/* Hero header */}
        <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 20 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.muted, fontSize: 13 }}>{greeting()} 👋</Text>
              <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", marginTop: 4 }}>Here's your business today</Text>
              <Pressable testID="shop-switcher" onPress={() => router.replace("/")} style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 }}>
                <Ionicons name="storefront-outline" size={13} color={colors.muted} />
                <Text style={{ color: colors.muted, fontSize: 12 }}>{shopName} · {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.muted} />
              </Pressable>
            </View>
            <Pressable testID="new-invoice-header" onPress={() => router.push("/(tabs)/pos")} style={{ backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="add" size={16} color={colors.onBrandPrimary} />
              <Text style={{ color: colors.onBrandPrimary, fontSize: 13, fontWeight: "500" }}>Invoice</Text>
            </Pressable>
          </View>
        </View>

        {/* Attention row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 4 }}>
          {attention.map((a) => {
            const tone = a.tone === "error" ? colors.error : a.tone === "warning" ? colors.warning : a.tone === "success" ? colors.success : colors.info;
            const bg = a.tone === "error" ? colors.errorBg : a.tone === "warning" ? colors.warningBg : a.tone === "success" ? colors.successBg : colors.infoBg;
            return (
              <Pressable key={a.id} testID={`attention-${a.id}`} onPress={() => router.push(a.target as any)} style={{ backgroundColor: bg, borderRadius: 12, padding: 12, minWidth: 240, borderLeftWidth: 3, borderLeftColor: tone }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <Ionicons name={a.icon} size={14} color={tone} />
                  <Text style={{ color: tone, fontSize: 10, fontWeight: "500", letterSpacing: 0.5 }}>NEEDS ATTENTION</Text>
                </View>
                <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "500" }}>{a.label}</Text>
                <Text style={{ color: tone, fontSize: 11, marginTop: 4, fontWeight: "500" }}>{a.action} →</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* KPI grid */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", padding: 20, gap: 12 }}>
          <View style={{ width: (width - 52) / 2 }}>
            <KpiCard testID="kpi-sales" label="Today's Sales" value={k.today_sales} change={k.today_sales_change} icon="cash-outline" iconColor={colors.brand} />
          </View>
          <View style={{ width: (width - 52) / 2 }}>
            <KpiCard testID="kpi-profit" label="Today's Profit" value={k.today_profit} change={k.today_profit_change} icon="trending-up-outline" iconColor={colors.success} />
          </View>
          <View style={{ width: (width - 52) / 2 }}>
            <KpiCard testID="kpi-outstanding" label="Outstanding" value={k.outstanding} icon="time-outline" iconColor={colors.warning} compact />
          </View>
          <View style={{ width: (width - 52) / 2 }}>
            <KpiCard testID="kpi-monthly" label="Monthly Revenue" value={k.monthly_revenue} icon="bar-chart-outline" iconColor={colors.info} compact />
          </View>
        </View>

        {/* Sales chart */}
        <View style={{ paddingHorizontal: 20 }}>
          <Card style={{ padding: 16 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View>
                <Text style={{ color: colors.muted, fontSize: 12 }}>SALES PERFORMANCE</Text>
                <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "500", marginTop: 2 }}>{formatINR(trend.reduce((a: number, b: any) => a + b.revenue, 0), true)}</Text>
              </View>
              <View style={{ flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: 8, padding: 2 }}>
                {(["7D", "30D"] as const).map((p) => (
                  <Pressable key={p} testID={`period-${p}`} onPress={() => setPeriod(p)} style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 6, backgroundColor: period === p ? colors.surfaceSecondary : "transparent" }}>
                    <Text style={{ color: period === p ? colors.onSurface : colors.muted, fontSize: 11, fontWeight: "500" }}>{p}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
            <LineChart
              data={chartData}
              height={160}
              width={width - 90}
              color={colors.brand}
              thickness={2.5}
              curved
              hideDataPoints
              areaChart
              startFillColor={colors.brand}
              endFillColor={colors.brand}
              startOpacity={0.2}
              endOpacity={0.02}
              hideRules
              xAxisColor={colors.divider}
              yAxisColor={"transparent"}
              yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
              xAxisLabelTextStyle={{ color: colors.muted, fontSize: 9 }}
              noOfSections={3}
              maxValue={maxRev * 1.2 || 100}
              initialSpacing={0}
              endSpacing={0}
              spacing={period === "7D" ? (width - 120) / 7 : (width - 120) / 30}
              disableScroll
            />
          </Card>
        </View>

        {/* Top products + Category */}
        <View style={{ padding: 20, gap: 16 }}>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500" }}>Top Selling Products</Text>
              <Text style={{ color: colors.muted, fontSize: 11 }}>This month</Text>
            </View>
            {(data.top_products || []).map((p: any, i: number) => (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }}>
                <View style={{ width: 26, height: 26, borderRadius: 6, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 12, fontWeight: "500" }}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{p.units} units · {p.brand}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{formatINR(p.revenue, true)}</Text>
                  <Text style={{ color: colors.success, fontSize: 11 }}>+{formatINR(p.profit, true)}</Text>
                </View>
              </View>
            ))}
          </Card>

          {pieData.length > 0 && (
            <Card>
              <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500", marginBottom: 12 }}>Sales by Category</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                <PieChart
                  data={pieData}
                  radius={70}
                  innerRadius={50}
                  centerLabelComponent={() => (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ color: colors.muted, fontSize: 10 }}>Total</Text>
                      <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "500" }}>{formatINR(totalCat, true)}</Text>
                    </View>
                  )}
                />
                <View style={{ flex: 1, gap: 6 }}>
                  {pieData.map((c: any, i: number) => (
                    <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c.color }} />
                      <Text style={{ color: colors.onSurface, fontSize: 11, flex: 1 }} numberOfLines={1}>{c.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>{Math.round((c.value / totalCat) * 100)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          )}

          {/* Low stock */}
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <View>
                <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500" }}>Stock Attention</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Products running low</Text>
              </View>
              <Pressable testID="view-inventory" onPress={() => router.push("/(tabs)/inventory")}>
                <Text style={{ color: colors.brand, fontSize: 12, fontWeight: "500" }}>View all →</Text>
              </Pressable>
            </View>
            {(data.low_stock_items || []).slice(0, 5).map((p: any, i: number) => (
              <View key={p.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{p.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Minimum: {p.min_stock}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ color: p.stock === 0 ? colors.error : colors.warning, fontSize: 14, fontWeight: "500" }}>{p.stock} left</Text>
                  <StatusBadge status={p.stock === 0 ? "out_stock" : "low_stock"} />
                </View>
              </View>
            ))}
          </Card>

          {/* Recent activity */}
          <Card>
            <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500", marginBottom: 12 }}>Recent Sales</Text>
            {(data.recent_invoices || []).slice(0, 5).map((inv: any, i: number) => (
              <Pressable key={inv.id} onPress={() => router.push(`/invoice/${inv.id}` as any)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: colors.divider, gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="receipt-outline" size={16} color={colors.success} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "500" }}>{inv.invoice_number}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>{inv.customer_name} · {formatTime(inv.created_at)}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{formatINR(inv.total)}</Text>
                  <StatusBadge status={inv.status} />
                </View>
              </Pressable>
            ))}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
