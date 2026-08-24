import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { Card } from "../src/components/ui";

export default function Finance() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [data, setData] = useState<any>(null);
  const [expTotal, setExpTotal] = useState(0);

  useEffect(() => {
    if (!shopId) return;
    Promise.all([api.dashboard(shopId), api.listExpenses(shopId)]).then(([d, e]) => {
      setData(d);
      setExpTotal(e.reduce((a: number, x: any) => a + x.amount, 0));
    });
  }, [shopId]);

  if (!data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /></SafeAreaView>;

  const k = data.kpis;
  const totalRev = data.trend_30.reduce((a: number, b: any) => a + b.revenue, 0);
  const totalProfit = data.trend_30.reduce((a: number, b: any) => a + b.profit, 0);
  const netProfit = totalProfit - expTotal;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Finance</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Card style={{ backgroundColor: colors.brand }}>
          <Text style={{ color: colors.onBrandPrimary, opacity: 0.7, fontSize: 11, letterSpacing: 1 }}>NET PROFIT · 30 DAYS</Text>
          <Text style={{ color: colors.onBrandPrimary, fontSize: 32, fontWeight: "500", marginTop: 6 }}>{formatINR(netProfit, true)}</Text>
          <View style={{ flexDirection: "row", marginTop: 16, gap: 20 }}>
            <View>
              <Text style={{ color: colors.onBrandPrimary, opacity: 0.6, fontSize: 11 }}>Revenue</Text>
              <Text style={{ color: colors.onBrandPrimary, fontSize: 15, fontWeight: "500" }}>{formatINR(totalRev, true)}</Text>
            </View>
            <View>
              <Text style={{ color: colors.onBrandPrimary, opacity: 0.6, fontSize: 11 }}>Expenses</Text>
              <Text style={{ color: colors.onBrandPrimary, fontSize: 15, fontWeight: "500" }}>{formatINR(expTotal, true)}</Text>
            </View>
          </View>
        </Card>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {[
            ["Outstanding", k.outstanding, colors.warning, "time-outline"],
            ["Payments Received", totalRev - k.outstanding, colors.success, "cash-outline"],
            ["Total Expenses", expTotal, colors.error, "wallet-outline"],
            ["Monthly Revenue", k.monthly_revenue, colors.info, "bar-chart-outline"],
          ].map(([k2, v, c, i]: any) => (
            <Card key={k2} style={{ flexBasis: "48%", flexGrow: 1 }}>
              <Ionicons name={i} size={18} color={c} />
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>{k2}</Text>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "500", marginTop: 2 }}>{formatINR(v, true)}</Text>
            </Card>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
