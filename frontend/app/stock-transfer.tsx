import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, FlatList, ActivityIndicator, TextInput, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatDate, formatTime } from "../src/utils/format";
import { api } from "../src/api/client";
import { Card, PrimaryButton, StatusBadge, EmptyState } from "../src/components/ui";

export default function StockTransfer() {
  const { colors } = useTheme();
  const router = useRouter();
  const [transfers, setTransfers] = useState<any[]>([]);
  const [shops, setShops] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [fromShop, setFromShop] = useState<any>(null);
  const [toShop, setToShop] = useState<any>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [quantity, setQuantity] = useState("");
  const [remarks, setRemarks] = useState("");

  const load = async () => {
    setLoading(true);
    const [t, s] = await Promise.all([api.listTransfers(), api.listShops()]);
    setTransfers(t);
    setShops(s);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openNew = async () => {
    setShowNew(true);
    if (products.length === 0 && shops.length > 0) {
      const p = await api.listProducts(shops[0].id);
      setProducts(p);
      setFromShop(shops[0]);
      setToShop(shops[1]);
    }
  };

  const create = async () => {
    if (!fromShop || !toShop || !selectedProduct || !quantity) return;
    await api.createTransfer({
      from_shop_id: fromShop.id,
      to_shop_id: toShop.id,
      product_id: selectedProduct.id,
      product_name: selectedProduct.name,
      quantity: parseInt(quantity),
      remarks,
    });
    setShowNew(false);
    setSelectedProduct(null);
    setQuantity("");
    setRemarks("");
    load();
  };

  const shopName = (id: string) => shops.find((s) => s.id === id)?.name || id;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Stock Transfer</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{transfers.length} transfers</Text>
        </View>
        <Pressable testID="new-transfer" onPress={openNew} style={{ backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="add" size={16} color={colors.onBrandPrimary} />
          <Text style={{ color: colors.onBrandPrimary, fontSize: 12, fontWeight: "500" }}>New</Text>
        </Pressable>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.brand} /> : (
        <FlatList
          data={transfers}
          keyExtractor={(t) => t.id}
          contentContainerStyle={{ padding: 20 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{item.transfer_number}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.product_name}</Text>
                </View>
                <StatusBadge status={item.status} />
              </View>
              <View style={{ marginTop: 10, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <View style={{ backgroundColor: colors.surfaceTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 11, fontWeight: "500" }}>{shopName(item.from_shop_id)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={12} color={colors.muted} />
                <View style={{ backgroundColor: colors.brandTertiary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 11, fontWeight: "500" }}>{shopName(item.to_shop_id)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, marginLeft: "auto" }}>Qty {item.quantity} · {formatDate(item.created_at)}</Text>
              </View>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="swap-horizontal-outline" title="No transfers" message="Start moving stock between your shops" />}
        />
      )}

      <Modal visible={showNew} animationType="slide" transparent onRequestClose={() => setShowNew(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "500" }}>New Stock Transfer</Text>
                <Pressable testID="close-transfer" onPress={() => setShowNew(false)}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
              </View>

              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>FROM SHOP</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {shops.map((s) => (
                  <Pressable key={s.id} testID={`from-${s.id}`} onPress={() => { setFromShop(s); api.listProducts(s.id).then(setProducts); setSelectedProduct(null); }} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: fromShop?.id === s.id ? colors.brand : colors.surfaceSecondary, borderWidth: 1, borderColor: fromShop?.id === s.id ? colors.brand : colors.border }}>
                    <Text style={{ color: fromShop?.id === s.id ? colors.onBrandPrimary : colors.onSurface, fontSize: 13, fontWeight: "500" }}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>TO SHOP</Text>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                {shops.filter((s) => s.id !== fromShop?.id).map((s) => (
                  <Pressable key={s.id} testID={`to-${s.id}`} onPress={() => setToShop(s)} style={{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: toShop?.id === s.id ? colors.brand : colors.surfaceSecondary, borderWidth: 1, borderColor: toShop?.id === s.id ? colors.brand : colors.border }}>
                    <Text style={{ color: toShop?.id === s.id ? colors.onBrandPrimary : colors.onSurface, fontSize: 13, fontWeight: "500" }}>{s.name}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>PRODUCT {selectedProduct && `(${selectedProduct.stock} available)`}</Text>
              <ScrollView style={{ maxHeight: 180, backgroundColor: colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
                {products.slice(0, 40).map((p) => (
                  <Pressable key={p.id} testID={`transfer-prod-${p.id}`} onPress={() => setSelectedProduct(p)} style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.divider, backgroundColor: selectedProduct?.id === p.id ? colors.brandTertiary : "transparent" }}>
                    <Text style={{ color: colors.onSurface, fontSize: 13 }}>{p.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{p.stock} in stock</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>QUANTITY</Text>
              <TextInput testID="transfer-qty" value={quantity} onChangeText={setQuantity} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }} />

              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>REMARKS (OPTIONAL)</Text>
              <TextInput testID="transfer-remarks" value={remarks} onChangeText={setRemarks} placeholder="e.g., Balancing stock" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }} />

              <PrimaryButton testID="confirm-transfer" label="Confirm Transfer" onPress={create} style={{ marginTop: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
