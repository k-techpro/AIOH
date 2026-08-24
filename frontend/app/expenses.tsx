import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatINR, formatDate } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { Card, PrimaryButton, EmptyState } from "../src/components/ui";

const CATS = ["Rent", "Electricity", "Staff Salary", "Transport", "Supplier Payment", "Maintenance", "Marketing", "Other"];

export default function Expenses() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [cat, setCat] = useState(CATS[0]);
  const [amount, setAmount] = useState("");
  const [desc, setDesc] = useState("");

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    const e = await api.listExpenses(shopId);
    setItems(e);
    setLoading(false);
  };
  useEffect(() => { load(); }, [shopId]);

  const total = items.reduce((a, e) => a + e.amount, 0);
  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthTotal = items.filter((e) => new Date(e.date) >= monthStart).reduce((a, e) => a + e.amount, 0);

  const catTotals: Record<string, number> = {};
  items.forEach((e) => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  const create = async () => {
    if (!amount) return;
    await api.createExpense({ shop_id: shopId, category: cat, description: desc || cat, amount: parseFloat(amount), payment_method: "cash" });
    setShow(false); setAmount(""); setDesc("");
    load();
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Expenses</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{items.length} entries</Text>
        </View>
        <Pressable testID="new-expense" onPress={() => setShow(true)} style={{ backgroundColor: colors.brand, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Ionicons name="add" size={16} color={colors.onBrandPrimary} />
          <Text style={{ color: colors.onBrandPrimary, fontSize: 12, fontWeight: "500" }}>Add</Text>
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: 20, flexDirection: "row", gap: 10 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>THIS MONTH</Text>
          <Text style={{ color: colors.error, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{formatINR(monthTotal, true)}</Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>TOP CATEGORY</Text>
          <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500", marginTop: 4 }}>{topCat ? topCat[0] : "-"}</Text>
          {topCat && <Text style={{ color: colors.muted, fontSize: 12 }}>{formatINR(topCat[1], true)}</Text>}
        </Card>
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={colors.brand} /> : (
        <FlatList
          data={items}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => (
            <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.errorBg, alignItems: "center", justifyContent: "center", marginRight: 12 }}>
                <Ionicons name="wallet-outline" size={16} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{item.category}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{item.description} · {formatDate(item.date)}</Text>
              </View>
              <Text style={{ color: colors.error, fontSize: 15, fontWeight: "500" }}>-{formatINR(item.amount)}</Text>
            </View>
          )}
          ListEmptyComponent={<EmptyState icon="wallet-outline" title="No expenses" message="Log your business expenses" />}
        />
      )}

      <Modal visible={show} animationType="slide" transparent onRequestClose={() => setShow(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
                <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "500" }}>Add Expense</Text>
                <Pressable testID="close-exp" onPress={() => setShow(false)}><Ionicons name="close" size={24} color={colors.onSurface} /></Pressable>
              </View>
              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: 6 }}>CATEGORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATS.map((c) => (
                  <Pressable key={c} testID={`exp-cat-${c}`} onPress={() => setCat(c)} style={{ flexShrink: 0, height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: cat === c ? colors.brand : colors.surfaceSecondary, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: cat === c ? colors.brand : colors.border }}>
                    <Text style={{ color: cat === c ? colors.onBrandPrimary : colors.onSurface, fontSize: 12, fontWeight: "500" }}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>AMOUNT (₹)</Text>
              <TextInput testID="exp-amount" value={amount} onChangeText={setAmount} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 14, fontSize: 20, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontWeight: "500" }} />
              <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginTop: 12, marginBottom: 6 }}>DESCRIPTION</Text>
              <TextInput testID="exp-desc" value={desc} onChangeText={setDesc} placeholder="e.g., August rent" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }} />
              <PrimaryButton testID="save-exp" label="Save Expense" onPress={create} style={{ marginTop: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
