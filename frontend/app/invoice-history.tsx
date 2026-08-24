import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, TextInput, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatINR, formatDate, formatTime } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { StatusBadge, EmptyState } from "../src/components/ui";

export default function InvoiceHistory() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!shopId) return;
    const params: any = {};
    if (search) params.search = search;
    if (status) params.status = status;
    api.listInvoices(shopId, params).then(setInvoices).finally(() => setLoading(false));
  }, [shopId, search, status]);

  const total = invoices.reduce((a, i) => a + i.total, 0);
  const due = invoices.reduce((a, i) => a + i.balance_due, 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Invoice History</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{invoices.length} invoices · {formatINR(total, true)}</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20 }}>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="inv-search" value={search} onChangeText={setSearch} placeholder="Invoice # or customer..." placeholderTextColor={colors.muted} style={{ flex: 1, marginLeft: 8, color: colors.onSurface, fontSize: 14 }} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, marginTop: 12, flexDirection: "row", gap: 8 }}>
        {["", "paid", "partial", "due"].map((s) => (
          <Pressable key={s || "all"} testID={`stat-${s || "all"}`} onPress={() => setStatus(s)} style={{ flex: 1, height: 36, borderRadius: 999, backgroundColor: status === s ? colors.brand : colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: status === s ? colors.brand : colors.border }}>
            <Text style={{ color: status === s ? colors.onBrandPrimary : colors.onSurface, fontSize: 12, fontWeight: "500" }}>{s ? s.toUpperCase() : "ALL"}</Text>
          </Pressable>
        ))}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.brand} /> : (
        <FlatList
          data={invoices}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable testID={`inv-item-${item.id}`} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{item.invoice_number}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.customer_name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{formatDate(item.created_at)} · {formatTime(item.created_at)} · {item.items.length} items</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "500" }}>{formatINR(item.total)}</Text>
                  <StatusBadge status={item.status} />
                </View>
              </View>
              {item.balance_due > 0 && (
                <View style={{ marginTop: 8, backgroundColor: colors.errorBg, borderRadius: 8, padding: 8, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: "500" }}>Balance Due</Text>
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: "500" }}>{formatINR(item.balance_due)}</Text>
                </View>
              )}
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="No invoices" message="Create your first invoice from the POS" />}
        />
      )}
    </SafeAreaView>
  );
}
