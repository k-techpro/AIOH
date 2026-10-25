import React, { useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { Card, EmptyState, PrimaryButton, StatusBadge } from "../src/components/ui";
import { formatINR, formatDateTime } from "../src/utils/format";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { adjustProductStock, createShopRecord } from "../src/services/repository";
import { searchProducts } from "../src/domain/productCodes.ts";

type Filter = "all" | "low" | "out" | "movements";
const ms = (v: any) => (typeof v === "number" ? v : v?.toMillis ? v.toMillis() : Date.parse(v || "") || 0);

// Inventory — stock overview (all / low / out), stock value, audited Stock In / Out adjustments, and the movement log.
export default function Stock() {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const products = useMockStore((s) => s.products);
  const movements = useMockStore((s) => s.inventoryMovements);
  const shops = useMockStore((s) => s.shops);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [adj, setAdj] = useState<any | null>(null);
  const [mode, setMode] = useState<"in" | "out">("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const branch = useMemo(() => products.filter((p: any) => shopId === "all" || p.shop_id === shopId), [products, shopId]);
  const alertOf = (p: any) => Number(p.lowStockAlert ?? p.min_stock ?? 5);
  const rows = useMemo(() => searchProducts(branch, search).filter((p: any) => {
    const stock = Number(p.stock) || 0;
    if (filter === "low") return stock > 0 && stock <= alertOf(p);
    if (filter === "out") return stock <= 0;
    return true;
  }), [branch, search, filter]);
  const log = useMemo(() => movements.filter((m: any) => shopId === "all" || m.shop_id === shopId || m.branchId === shopId).sort((a: any, b: any) => ms(b.createdAt ?? b.created_at) - ms(a.createdAt ?? a.created_at)).slice(0, 150), [movements, shopId]);
  const value = branch.reduce((n: number, p: any) => n + (Number(p.stock) || 0) * (Number(p.cost ?? p.cost_price ?? p.price ?? p.selling_price) || 0), 0);
  const lowCount = branch.filter((p: any) => Number(p.stock) > 0 && Number(p.stock) <= alertOf(p)).length;
  const outCount = branch.filter((p: any) => Number(p.stock) <= 0).length;

  const save = async () => {
    const q = Number(qty);
    if (!Number.isFinite(q) || q <= 0) return Alert.alert("Stock", "Enter a valid quantity.");
    const current = Number(adj.stock) || 0;
    const next = mode === "in" ? current + q : Math.max(0, current - q);
    setBusy(true);
    try {
      await adjustProductStock(adj.id, next, mode === "in" ? "STOCK_IN" : "STOCK_OUT", { reason: reason.trim() || "adjustment" }, shops);
      await createShopRecord("history", { type: "inventory", title: `Stock ${mode === "in" ? "In" : "Out"} · ${adj.name}`, message: `${mode === "in" ? "+" : "-"}${q} (${reason.trim() || "adjustment"})`, amount: 0 }, shops).catch(() => undefined);
      setAdj(null);
    } catch (e: any) { Alert.alert("Stock not updated", e?.message || "Try again."); }
    finally { setBusy(false); }
  };
  const field = { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Inventory</Text>
          <Text testID="stock-value" style={{ color: colors.muted, fontSize: 12 }}>Stock value {formatINR(value)} · {branch.length} products · {lowCount} low · {outCount} out</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 10 }}>
        <TextInput testID="stock-search" value={search} onChangeText={setSearch} placeholder="Search name, code, barcode…" placeholderTextColor={colors.muted} style={field} />
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {([["all", "All stock"], ["low", "Low stock"], ["out", "Out of stock"], ["movements", "Movements"]] as [Filter, string][]).map(([k, l]) => (
            <Pressable key={k} testID={`stock-filter-${k}`} onPress={() => setFilter(k)} style={{ paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: filter === k ? colors.brand : colors.border, backgroundColor: filter === k ? colors.brand : "transparent" }}>
              <Text style={{ color: filter === k ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 12 }}>{l}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {filter === "movements" ? (
        <FlatList
          data={log}
          keyExtractor={(m: any) => m.id}
          contentContainerStyle={{ padding: 20, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="swap-vertical-outline" title="No stock movements" message="Sales, returns, transfers and adjustments are logged here." />}
          renderItem={({ item }: any) => {
            const delta = Number(item.change_quantity ?? item.quantityDelta ?? 0);
            return (
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "700", flex: 1 }}>{item.product_name || item.productName || "Product"}</Text>
                  <Text style={{ color: delta < 0 ? colors.error : colors.success, fontWeight: "700" }}>{delta > 0 ? "+" : ""}{delta}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.type} · {Number(item.old_quantity ?? item.previousQuantity ?? 0)} → {Number(item.new_quantity ?? item.newQuantity ?? 0)} · {formatDateTime(ms(item.createdAt ?? item.created_at))}</Text>
              </Card>
            );
          }}
        />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(p: any) => p.id}
          contentContainerStyle={{ padding: 20, gap: 8 }}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="No products found" message="Add products or adjust filters." />}
          renderItem={({ item }: any) => {
            const stock = Number(item.stock) || 0;
            return (
              <Pressable testID={`stock-row-${item.id}`} onPress={() => { setAdj(item); setMode("in"); setQty(""); setReason(""); }}>
                <Card>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.name}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.category} · value {formatINR(stock * (Number(item.cost ?? item.cost_price ?? item.price ?? item.selling_price) || 0))}</Text>
                    </View>
                    <View style={{ alignItems: "flex-end", gap: 4 }}>
                      <Text style={{ color: colors.onSurface, fontWeight: "800", fontSize: 18 }}>{stock}</Text>
                      <StatusBadge status={stock <= 0 ? "out_stock" : stock <= alertOf(item) ? "low_stock" : "in_stock"} />
                    </View>
                  </View>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
      <Modal visible={!!adj} transparent animationType="slide" onRequestClose={() => setAdj(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,.4)" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 12 }}>
            <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700" }}>Adjust stock · {adj?.name}</Text>
            <Text style={{ color: colors.muted }}>Current stock {adj?.stock ?? 0}</Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {(["in", "out"] as const).map((m) => (
                <Pressable key={m} testID={`stock-mode-${m}`} onPress={() => setMode(m)} style={{ paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: mode === m ? colors.brand : colors.border, backgroundColor: mode === m ? colors.brand : "transparent" }}>
                  <Text style={{ color: mode === m ? colors.onBrandPrimary : colors.onSurface, fontWeight: "700" }}>{m === "in" ? "Stock In" : "Stock Out"}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput testID="stock-qty" value={qty} onChangeText={setQty} keyboardType="number-pad" placeholder="Quantity" placeholderTextColor={colors.muted} style={field} />
            <TextInput value={reason} onChangeText={setReason} placeholder="Reason (optional)" placeholderTextColor={colors.muted} style={field} />
            <PrimaryButton testID="stock-save" label={busy ? "Saving…" : "Save adjustment"} onPress={save} disabled={busy} gradient={gradients.brand} />
            <Pressable onPress={() => setAdj(null)} style={{ padding: 10 }}><Text style={{ color: colors.muted, textAlign: "center" }}>Cancel</Text></Pressable>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
