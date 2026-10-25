import { BrandLoader } from "@/src/components/Brand";
import React, { useEffect, useState } from "react";
import { Alert, View, Text, ScrollView, Pressable, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BarChart } from "react-native-gifted-charts";
import { useTheme } from "../src/theme/theme";
import { formatINR, formatDate } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { Card, EmptyState } from "../src/components/ui";
import { shareCsv } from "../src/services/export";
import { summarizeExpenses } from "../src/domain/expenses.ts";

const { width } = Dimensions.get("window");

export default function Reports() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const invoices = useMockStore((s) => s.invoices);
  const products = useMockStore((s) => s.products);
  const customers = useMockStore((s) => s.customers);
  const expenses = useMockStore((s) => s.expenses);
  const [gst, setGst] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;

    // Calculate GST from real Firestore data
    const filteredInvoices = invoices.filter(i => shopId === "all" || i.shop_id === shopId);
    const taxable_sales = filteredInvoices.reduce((n, item) => n + Number(item.subtotal || 0), 0);
    const total_gst = filteredInvoices.reduce((n, item) => n + Number(item.gst || 0), 0);

    setGst({
      taxable_sales,
      total_gst,
      total_tax: total_gst,
      cgst: total_gst / 2,
      sgst: total_gst / 2,
      igst: 0,
      gst_invoices: filteredInvoices.length,
      total_sales: filteredInvoices.reduce((n, item) => n + Number(item.total || 0), 0),
    });

    setLoading(false);
  }, [shopId, invoices]);

  if (loading || !gst) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><BrandLoader style={{ marginTop: 40 }} color={colors.brand} /></SafeAreaView>;

  // Generate 14-day trend from real invoices
  const filteredInvoices = invoices.filter(i => shopId === "all" || i.shop_id === shopId);
  const trendData: Record<string, number> = {};
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const dayRevenue = filteredInvoices
      .filter(inv => inv.created_at.slice(0, 10) === dateStr)
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
    trendData[dateStr] = dayRevenue;
  }

  const barData = Object.entries(trendData).map(([date, revenue]) => ({
    value: Math.max(0, revenue),
    label: date.split("-")[2],
    frontColor: colors.brand
  }));

  const maxBar = Math.max(...barData.map((b: any) => b.value || 1), 1);

  const scoped = (r: any) => shopId === "all" || r.shop_id === shopId;
  // Every report is a real export (CSV via the system share sheet) — the phone equivalent of the web CSV / XLSX export.
  const exporters: Record<string, () => Promise<void>> = {
    "Sales Report": () => shareCsv("sales-report.csv", ["Invoice", "Date", "Customer", "Phone", "Method", "Subtotal", "Discount", "GST", "Total", "Paid", "Balance", "Status"],
      filteredInvoices.map((i: any) => [i.invoice_number, formatDate(i.created_at), i.customer_name, i.customer_phone, i.payment_method, i.subtotal, i.discount, i.gst, i.total, i.amount_paid, i.balance_due, i.status])),
    "Stock Report": () => shareCsv("stock-report.csv", ["Product", "Code", "Category", "Stock", "Cost", "Price", "Stock value"],
      products.filter(scoped).map((p: any) => [p.name, p.product_code || p.sku, p.category, p.stock, p.cost ?? p.cost_price, p.price ?? p.selling_price, Number(p.stock || 0) * Number(p.cost ?? p.cost_price ?? 0)])),
    "GST Summary": () => shareCsv("gst-summary.csv", ["Invoice", "Date", "Taxable", "GST", "Total"], filteredInvoices.map((i: any) => [i.invoice_number, formatDate(i.created_at), i.taxable ?? i.subtotal, i.gst, i.total])),
    "Loss & Due Report": () => shareCsv("outstanding-report.csv", ["Customer", "Phone", "Outstanding"], customers.filter((c: any) => scoped(c) && Number(c.outstanding ?? c.total_due ?? 0) > 0).map((c: any) => [c.name, c.phone, c.outstanding ?? c.total_due])),
    "Customer Report": () => shareCsv("customer-report.csv", ["Customer", "Phone", "Type", "Purchases", "Paid", "Outstanding"], customers.filter(scoped).map((c: any) => [c.name, c.phone, c.type || c.customer_type || "", c.total_purchases, c.total_paid, c.outstanding ?? c.total_due])),
    "Shop Comparison": async () => {
      const ids = [...new Set(invoices.map((i: any) => i.shop_id))];
      await shareCsv("shop-comparison.csv", ["Branch", "Invoices", "Sales", "Expenses"], ids.map((id: any) => { const inv = invoices.filter((i: any) => i.shop_id === id); const ex = summarizeExpenses(expenses.filter((e: any) => e.shop_id === id)).totals.grand; return [id, inv.length, inv.reduce((n: number, i: any) => n + Number(i.total || 0), 0), ex]; }));
    },
  };
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
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500", marginTop: 4, marginBottom: 12 }}>{formatINR(barData.reduce((a: number, b: any) => a + (b.value || 0), 0), true)}</Text>
          {barData.length > 0 ? (
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
          ) : (
            <Text style={{ color: colors.muted, padding: 20, textAlign: "center" }}>No sales data for last 14 days</Text>
          )}
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
            <Pressable key={r.title} testID={`report-${r.title}`} onPress={() => exporters[r.title]?.().catch((e: any) => Alert.alert("Export failed", e?.message || "Try again."))} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: colors.border }}>
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
