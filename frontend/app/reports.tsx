import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BarChart } from "react-native-gifted-charts";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { Card } from "../src/components/ui";

const { width } = Dimensions.get("window");

export default function Reports() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [data, setData] = useState<any>(null);
  const [gst, setGst] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    Promise.all([api.dashboard(shopId), api.gstReport(shopId)]).then(([d, g]) => {
      setData(d); setGst(g); setLoading(false);
    });
  }, [shopId]);

  if (loading || !data) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /></SafeAreaView>;

  const barData = data.trend_30.slice(-14).map((t: any) => ({ value: t.revenue, label: t.date.split(" ")[0], frontColor: colors.brand }));
  const maxBar = Math.max(...barData.map((b: any) => b.value));

  const reports = [
    { icon: "trending-up-outline", title: "Sales Report", subtitle: "Daily, weekly & monthly", color: colors.brand },
    { icon: "cube-outline", title: "Stock Report", subtitle: "Inventory value & movement", color: colors.info },
    { icon: "receipt-outline", title: "GST Summary", subtitle: `${formatINR(gst.total_gst, true)} collected`, color: "#8B5CF6" },
    { icon: "warning-outline", title: "Loss & Due Report", subtitle: "Outstanding payments", color: colors.warning },
    { icon: "people-outline", title: "Customer Report", subtitle: "Purchases & LTV", color: colors.success },
    { icon: "business-outline", title: "Shop Comparison", subtitle: "Performance side-by-side", color: colors.error },
  ];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Reports</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Every business insight in one place</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Card>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>REVENUE · LAST 14 DAYS</Text>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500", marginTop: 4, marginBottom: 12 }}>{formatINR(barData.reduce((a: number, b: any) => a + b.value, 0), true)}</Text>
          <BarChart
            data={barData}
            width={width - 90}
            height={160}
            barWidth={(width - 130) / 14 - 6}
            spacing={6}
            hideRules
            barBorderRadius={4}
            frontColor={colors.brand}
            yAxisColor={"transparent"}
            xAxisColor={colors.divider}
            xAxisLabelTextStyle={{ color: colors.muted, fontSize: 8 }}
            yAxisTextStyle={{ color: colors.muted, fontSize: 9 }}
            maxValue={maxBar * 1.2}
            noOfSections={3}
            disableScroll
          />
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: 12 }}>GST SUMMARY</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {[
              ["Taxable Sales", gst.taxable_sales, colors.brand],
              ["CGST", gst.cgst, colors.info],
              ["SGST", gst.sgst, colors.info],
              ["Total GST", gst.total_gst, colors.success],
            ].map(([k, v, c]: any) => (
              <View key={k} style={{ flexBasis: (width - 82) / 2, backgroundColor: colors.surfaceTertiary, borderRadius: 10, padding: 12 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{k}</Text>
                <Text style={{ color: c, fontSize: 16, fontWeight: "500", marginTop: 4 }}>{formatINR(v, true)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>DETAILED REPORTS</Text>
        <View style={{ gap: 8 }}>
          {reports.map((r) => (
            <Pressable key={r.title} testID={`report-${r.title}`} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: r.color + "18", alignItems: "center", justifyContent: "center" }}>
                <Ionicons name={r.icon as any} size={20} color={r.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{r.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{r.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
