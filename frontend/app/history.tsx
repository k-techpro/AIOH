import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { Card, EmptyState } from "../src/components/ui";
import { formatINR } from "../src/utils/format";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { useCollection } from "../src/hooks/useCollection";

const TABS = ["all", "invoice", "payment", "return", "service", "inventory"];
const ms = (v: any) => (typeof v === "number" ? v : v?.toMillis ? v.toMillis() : Date.parse(v || "") || 0);

// History — one chronological timeline of invoices, payments, returns, services and inventory events (web History).
export default function History() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const invoices = useMockStore((s) => s.invoices);
  const payments = useMockStore((s) => s.payments);
  const returns = useMockStore((s) => s.returns);
  const services = useMockStore((s) => s.services);
  const { data: hist } = useCollection("history");
  const [tab, setTab] = useState("all");

  const events = useMemo(() => {
    const inShop = (r: any) => shopId === "all" || r.shop_id === shopId;
    const e: { id: string; type: string; icon: any; title: string; desc?: string; amount: number | null; ts: number }[] = [];
    invoices.filter(inShop).forEach((i: any) => e.push({ id: `inv${i.id}`, type: "invoice", icon: "receipt-outline", title: `Invoice ${i.invoice_number || i.invoiceNumber}`, desc: i.customer_name, amount: Number(i.total ?? i.grandTotal ?? 0), ts: ms(i.created_at) }));
    payments.filter(inShop).forEach((p: any) => e.push({ id: `pay${p.id}`, type: "payment", icon: "card-outline", title: `Payment · ${p.method || p.payment_method || ""}`, desc: p.customerName || p.customer_name, amount: Number(p.amount || 0), ts: ms(p.date ?? p.created_at) }));
    returns.filter(inShop).forEach((r: any) => e.push({ id: `ret${r.id}`, type: "return", icon: "return-up-back-outline", title: `Return ${r.invoice_number || r.invoiceNumber || ""}`, desc: r.customer_name, amount: -Number(r.refund_amount ?? r.refundAmount ?? 0), ts: ms(r.created_at) }));
    services.filter(inShop).forEach((s: any) => e.push({ id: `srv${s.id}`, type: "service", icon: "construct-outline", title: s.service_no ? `Service ${s.service_no}` : s.title || "Service", desc: `${s.customer_name ?? s.customerName ?? ""} · ${s.status || ""}`, amount: Number(s.total ?? s.price ?? 0), ts: ms(s.created_at ?? s.createdAt) }));
    hist.forEach((h: any) => e.push({ id: `his${h.id}`, type: "inventory", icon: "cube-outline", title: h.title || h.action || "Event", desc: h.message || h.reason, amount: null, ts: ms(h.created_at ?? h.createdAt) }));
    return e.sort((a, b) => b.ts - a.ts);
  }, [invoices, payments, returns, services, hist, shopId]);
  const rows = (tab === "all" ? events : events.filter((x) => x.type === tab)).slice(0, 150);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>History</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Complete business activity timeline</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 54 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 10 }}>
        {TABS.map((t) => (
          <Pressable key={t} testID={`history-tab-${t}`} onPress={() => setTab(t)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: tab === t ? colors.brand : colors.border, backgroundColor: tab === t ? colors.brand : "transparent", marginRight: 8 }}>
            <Text style={{ color: tab === t ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", textTransform: "capitalize" }}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
        ListEmptyComponent={<EmptyState icon="time-outline" title="No activity yet" message="Your business activity will appear here." />}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Ionicons name={item.icon} size={22} color={colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.title}</Text>
                {!!item.desc && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.desc}</Text>}
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{item.ts ? new Date(item.ts).toLocaleString("en-IN") : ""}</Text>
              </View>
              {item.amount !== null && <Text style={{ color: item.amount < 0 ? colors.error : colors.success, fontWeight: "700" }}>{formatINR(item.amount)}</Text>}
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
