import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TextInput, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { formatINR } from "../../src/utils/format";
import { api } from "../../src/api/client";
import { useAppStore } from "../../src/store/shop";
import { EmptyState } from "../../src/components/ui";

export default function Customers() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "due" | "gst">("all");

  useEffect(() => {
    if (!shopId) return;
    setLoading(true);
    api.listCustomers(shopId, search || undefined).then(setCustomers).finally(() => setLoading(false));
  }, [shopId, search]);

  const filtered = customers.filter((c) => {
    if (filter === "due") return c.total_due > 0;
    if (filter === "gst") return !!c.gstin;
    return true;
  });

  const totalDue = customers.reduce((a, c) => a + c.total_due, 0);
  const dueCount = customers.filter((c) => c.total_due > 0).length;
  const gstCount = customers.filter((c) => !!c.gstin).length;

  if (!shopId) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} />;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "500" }}>Customers</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{customers.length} customers · {formatINR(totalDue, true)} outstanding</Text>
      </View>

      <View style={{ paddingHorizontal: 20, gap: 8, flexDirection: "row" }}>
        {[
          { key: "all", label: "All", count: customers.length },
          { key: "due", label: "Has Due", count: dueCount },
          { key: "gst", label: "GST", count: gstCount },
        ].map((f: any) => (
          <Pressable
            key={f.key}
            testID={`filter-${f.key}`}
            onPress={() => setFilter(f.key)}
            style={{ flex: 1, backgroundColor: filter === f.key ? colors.brand : colors.surfaceSecondary, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: filter === f.key ? colors.brand : colors.border }}
          >
            <Text style={{ color: filter === f.key ? colors.onBrandPrimary : colors.muted, fontSize: 11, letterSpacing: 0.5 }}>{f.label.toUpperCase()}</Text>
            <Text style={{ color: filter === f.key ? colors.onBrandPrimary : colors.onSurface, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{f.count}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="customer-search" value={search} onChangeText={setSearch} placeholder="Search customer, phone..." placeholderTextColor={colors.muted} style={{ flex: 1, marginLeft: 8, color: colors.onSurface, fontSize: 14 }} />
        </View>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.brand} /> : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <Pressable testID={`cust-${item.id}`} onPress={() => router.push(`/customer/${item.id}` as any)} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.onBrandPrimary, fontSize: 15, fontWeight: "500" }}>{item.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
                  {item.gstin && <View style={{ backgroundColor: colors.infoBg, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999 }}><Text style={{ color: colors.info, fontSize: 9, fontWeight: "500" }}>GST</Text></View>}
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.phone}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{formatINR(item.total_purchases, true)}</Text>
                {item.total_due > 0 && <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>Due {formatINR(item.total_due)}</Text>}
              </View>
            </Pressable>
          )}
          ListEmptyComponent={<EmptyState icon="people-outline" title="No customers" message="Your customer list is empty" />}
        />
      )}
    </SafeAreaView>
  );
}
