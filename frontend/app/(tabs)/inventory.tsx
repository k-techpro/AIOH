import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, FlatList, ActivityIndicator, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { formatINR } from "../../src/utils/format";
import { api } from "../../src/api/client";
import { useAppStore } from "../../src/store/shop";
import { Card, StatusBadge, PrimaryButton, EmptyState } from "../../src/components/ui";

const CATEGORIES = ["All", "Smartphones", "Chargers", "Cables", "Earphones", "Power Banks", "Smart Watches", "Cases", "Screen Protectors"];

export default function Inventory() {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [products, setProducts] = useState<any[]>([]);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [filter, setFilter] = useState<"all" | "low" | "out">("all");

  const load = async () => {
    setLoading(true);
    const params: any = {};
    if (category !== "All") params.category = category;
    if (search) params.search = search;
    const p = await api.listProducts(shopId, params);
    setProducts(p);
    setLoading(false);
  };

  useEffect(() => { if (shopId) load(); }, [shopId, category, search]);

  const filtered = products.filter((p) => {
    if (filter === "low") return p.stock <= p.min_stock && p.stock > 0;
    if (filter === "out") return p.stock === 0;
    return true;
  });

  const totalValue = products.reduce((a, p) => a + p.cost_price * p.stock, 0);
  const potentialProfit = products.reduce((a, p) => a + (p.selling_price - p.cost_price) * p.stock, 0);
  const lowCount = products.filter((p) => p.stock <= p.min_stock && p.stock > 0).length;
  const outCount = products.filter((p) => p.stock === 0).length;

  if (!shopId) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }} />;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <Text style={{ color: colors.onSurface, fontSize: 26, fontWeight: "500" }}>Inventory</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{products.length} products · {formatINR(totalValue, true)} value · {lowCount} need attention</Text>
      </View>

      {/* KPI strip */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10, paddingBottom: 8 }}>
        <Pressable testID="filter-all" onPress={() => setFilter("all")} style={{ backgroundColor: filter === "all" ? colors.brand : colors.surfaceSecondary, borderRadius: 12, padding: 12, minWidth: 130, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: filter === "all" ? colors.onBrandPrimary : colors.muted, fontSize: 11, letterSpacing: 0.5 }}>TOTAL VALUE</Text>
          <Text style={{ color: filter === "all" ? colors.onBrandPrimary : colors.onSurface, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{formatINR(totalValue, true)}</Text>
        </Pressable>
        <Pressable testID="filter-profit" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, minWidth: 130, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>POTENTIAL PROFIT</Text>
          <Text style={{ color: colors.success, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{formatINR(potentialProfit, true)}</Text>
        </Pressable>
        <Pressable testID="filter-low" onPress={() => setFilter("low")} style={{ backgroundColor: filter === "low" ? colors.warningBg : colors.surfaceSecondary, borderRadius: 12, padding: 12, minWidth: 130, borderWidth: 1, borderColor: filter === "low" ? colors.warning : colors.border }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>LOW STOCK</Text>
          <Text style={{ color: colors.warning, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{lowCount}</Text>
        </Pressable>
        <Pressable testID="filter-out" onPress={() => setFilter("out")} style={{ backgroundColor: filter === "out" ? colors.errorBg : colors.surfaceSecondary, borderRadius: 12, padding: 12, minWidth: 130, borderWidth: 1, borderColor: filter === "out" ? colors.error : colors.border }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>OUT OF STOCK</Text>
          <Text style={{ color: colors.error, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{outCount}</Text>
        </Pressable>
      </ScrollView>

      {/* Search */}
      <View style={{ paddingHorizontal: 20, marginTop: 12 }}>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="inventory-search" value={search} onChangeText={setSearch} placeholder="Search products..." placeholderTextColor={colors.muted} style={{ flex: 1, marginLeft: 8, color: colors.onSurface, fontSize: 14 }} />
        </View>
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 12, gap: 8 }}>
        {CATEGORIES.map((c) => (
          <Pressable
            key={c}
            testID={`cat-${c}`}
            onPress={() => setCategory(c)}
            style={{ flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: category === c ? colors.brand : colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: category === c ? colors.brand : colors.border }}
          >
            <Text style={{ color: category === c ? colors.onBrandPrimary : colors.onSurface, fontSize: 12, fontWeight: "500" }}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color={colors.brand} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const status = item.stock === 0 ? "out_stock" : item.stock <= item.min_stock ? "low_stock" : "in_stock";
            return (
              <Pressable testID={`inv-${item.id}`} onPress={() => setSelected(item)} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.is_accessory ? "hardware-chip-outline" : "phone-portrait-outline"} size={20} color={colors.onSurface} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{item.brand} · {item.sku}</Text>
                  <View style={{ marginTop: 6 }}>
                    <StatusBadge status={status} />
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500" }}>{formatINR(item.selling_price)}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{item.stock} in stock</Text>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="No products" message="Try adjusting your filters" />}
        />
      )}

      {/* Detail drawer */}
      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%" }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>{selected?.category}</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500", marginTop: 4 }}>{selected?.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{selected?.brand}</Text>
                </View>
                <Pressable testID="close-detail" onPress={() => setSelected(null)}>
                  <Ionicons name="close" size={24} color={colors.onSurface} />
                </Pressable>
              </View>

              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
                  <View>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>SELLING PRICE</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "500", marginTop: 4 }}>{formatINR(selected?.selling_price || 0)}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>PROFIT</Text>
                    <Text style={{ color: colors.success, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{formatINR((selected?.selling_price || 0) - (selected?.cost_price || 0))}</Text>
                  </View>
                </View>
                <View style={{ height: 1, backgroundColor: colors.divider, marginVertical: 8 }} />
                {[
                  ["SKU", selected?.sku],
                  ["Barcode", selected?.barcode],
                  ["HSN", selected?.hsn],
                  ["Cost Price", formatINR(selected?.cost_price || 0)],
                  ["GST", `${selected?.gst}%`],
                  ["Current Stock", `${selected?.stock} units`],
                  ["Minimum Stock", `${selected?.min_stock} units`],
                  ["Supplier", selected?.supplier || "-"],
                ].map(([k, v]) => (
                  <View key={k} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                    <Text style={{ color: colors.muted, fontSize: 13 }}>{k}</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "500" }}>{v}</Text>
                  </View>
                ))}
              </Card>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
                <PrimaryButton testID="restock-btn" label="Adjust Stock" onPress={() => {}} icon="add" style={{ flex: 1 }} />
                <PrimaryButton testID="barcode-btn" label="Barcode" onPress={() => { setSelected(null); router.push("/barcode-generator" as any); }} icon="barcode-outline" style={{ flex: 1 }} />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
