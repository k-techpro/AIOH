import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { Card, PrimaryButton, SecondaryButton } from "../src/components/ui";

// Simple CODE128 pattern renderer using stripes (visual only)
function BarcodeVisual({ value }: { value: string }) {
  const { colors } = useTheme();
  const bars: number[] = [];
  const seed = value.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  for (let i = 0; i < 60; i++) {
    bars.push(((seed * (i + 1)) % 5) + 1);
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 100, gap: 1, justifyContent: "center" }}>
      {bars.map((w, i) => (
        <View key={i} style={{ width: w, height: 100, backgroundColor: i % 2 === 0 ? "#000" : "transparent" }} />
      ))}
    </View>
  );
}

export default function BarcodeGen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [products, setProducts] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [copies, setCopies] = useState("1");
  const [search, setSearch] = useState("");

  useEffect(() => { if (shopId) api.listProducts(shopId).then(setProducts); }, [shopId]);

  const filtered = products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Barcode Generator</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Print labels for your products</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Card>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: 8 }}>PREVIEW</Text>
          {selected ? (
            <View style={{ alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderRadius: 10 }}>
              <Text style={{ color: "#000", fontSize: 15, fontWeight: "500" }}>{selected.name}</Text>
              <Text style={{ color: "#111", fontSize: 20, fontWeight: "500", marginTop: 4 }}>{formatINR(selected.selling_price)}</Text>
              <View style={{ marginTop: 12 }}>
                <BarcodeVisual value={selected.barcode} />
              </View>
              <Text style={{ color: "#111", fontSize: 12, marginTop: 6, letterSpacing: 2 }}>{selected.barcode}</Text>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="barcode-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8 }}>Select a product to preview</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Text style={{ color: colors.muted, fontSize: 12, alignSelf: "center" }}>Copies</Text>
            <TextInput testID="copies" value={copies} onChangeText={setCopies} keyboardType="numeric" style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 8, padding: 8, color: colors.onSurface }} />
            <PrimaryButton testID="print-btn" label="Print" onPress={() => {}} icon="print-outline" />
          </View>
        </Card>

        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>SELECT PRODUCT</Text>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border, marginBottom: 12 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="prod-search" value={search} onChangeText={setSearch} placeholder="Search product..." placeholderTextColor={colors.muted} style={{ flex: 1, marginLeft: 8, color: colors.onSurface }} />
        </View>
        {filtered.slice(0, 25).map((p) => (
          <Pressable key={p.id} testID={`bc-prod-${p.id}`} onPress={() => setSelected(p)} style={{ backgroundColor: selected?.id === p.id ? colors.brandTertiary : colors.surfaceSecondary, borderRadius: 10, padding: 12, marginBottom: 6, borderWidth: 1, borderColor: selected?.id === p.id ? colors.brand : colors.border }}>
            <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "500" }}>{p.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{p.barcode} · {formatINR(p.selling_price)}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
