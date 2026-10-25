import React, { useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { useTheme } from "../src/theme/theme";
import { formatINR, formatDate } from "../src/utils/format";
import { Card, EmptyState, PrimaryButton } from "../src/components/ui";
import { useMockStore } from "../src/store/mock-data";
import { useCollection } from "../src/hooks/useCollection";
import { createShopRecord, deleteShopRecord, updateShopRecord } from "../src/services/repository";
import { EXPENSE_PAYMENT_METHODS, EXPENSE_TYPES, blankExpenseForm, buildExpensePayload, recordDateMs, summarizeExpenses, validateExpense, type ExpenseForm } from "../src/domain/expenses.ts";

const Chip = ({ label, active, onPress, colors }: any) => (
  <Pressable onPress={onPress} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : "transparent", marginRight: 8, marginBottom: 8 }}>
    <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{label}</Text>
  </Pressable>
);

// Expenses — same collection / payload as the web page: type (+custom), description, amount, method, paid-to, remarks.
export default function Expenses() {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const shops = useMockStore((s) => s.shops);
  const { data: expenses } = useCollection("expenses");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null | undefined>();
  const [form, setForm] = useState<ExpenseForm>(blankExpenseForm());
  const [busy, setBusy] = useState(false);
  const set = (k: keyof ExpenseForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const startToday = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const startMonth = useMemo(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d.getTime(); }, []);
  const sum = (from: number) => expenses.filter((e) => recordDateMs(e) >= from).reduce((n, e) => n + (Number(e.amount) || 0), 0);
  const summary = useMemo(() => summarizeExpenses(expenses), [expenses]);
  const topType = Object.entries(summary.byType).sort((a, b) => b[1] - a[1])[0];
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses.filter((e) => !q || [e.description, e.expense_type, e.category, e.paidTo, e.payment_method].some((v) => String(v || "").toLowerCase().includes(q))).sort((a, b) => recordDateMs(b) - recordDateMs(a));
  }, [expenses, search]);

  const open = (e?: any) => {
    setEditing(e || null);
    setForm(e ? { date: new Date(recordDateMs(e) || Date.now()).toISOString().slice(0, 10), expense_type: e.expense_type || e.category || "General", custom_expense_type: e.custom_expense_type || "", description: e.description || e.title || "", amount: String(e.amount ?? ""), payment_method: e.payment_method || e.method || "Cash", paidTo: e.paidTo || e.paid_to || "", remarks: e.remarks || e.note || "" } : blankExpenseForm());
  };
  const save = async () => {
    const err = validateExpense(form);
    if (err) return Alert.alert("Check expense", err);
    const user = getAuth(getApp()).currentUser;
    const payload = buildExpensePayload(form, user?.displayName || user?.email || null);
    setBusy(true);
    try {
      if (editing?.id) await updateShopRecord("expenses", editing.id, payload, shops);
      else await createShopRecord("expenses", payload, shops);
      setEditing(undefined);
    } catch (e: any) { Alert.alert("Expense not saved", e?.message || "Check your connection and try again."); }
    finally { setBusy(false); }
  };
  const remove = (e: any) => Alert.alert("Delete expense?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteShopRecord("expenses", e.id, shops).then(() => setEditing(undefined)).catch((x) => Alert.alert("Not deleted", x?.message)) }]);

  const field = { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const;
  const lbl = { color: colors.muted, fontSize: 12, fontWeight: "600" as const, marginBottom: 6, marginTop: 14 };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Expenses</Text>
        <Pressable testID="add-expense" onPress={() => open()}><Ionicons name="add-circle" size={30} color={colors.brand} /></Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 6 }}>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[["Today", sum(startToday)], ["This month", sum(startMonth)], ["All time", summary.totals.grand]].map(([l, v]) => (
                <Card key={String(l)} style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>{l}</Text><Text testID={`exp-${String(l).replace(/\s/g, "-")}`} style={{ color: colors.onSurface, fontWeight: "700", marginTop: 4 }}>{formatINR(Number(v))}</Text></Card>
              ))}
            </View>
            <Card>
              <Text style={{ color: colors.muted, fontSize: 11 }}>BY METHOD</Text>
              <Text style={{ color: colors.onSurface, marginTop: 4 }}>Cash {formatINR(summary.totals.cash)} · UPI {formatINR(summary.totals.upi)} · Card {formatINR(summary.totals.card)} · Bank/Other {formatINR(summary.totals.bank)}</Text>
              {topType && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Top category: {topType[0]} ({formatINR(topType[1])})</Text>}
            </Card>
            <TextInput testID="expense-search" value={search} onChangeText={setSearch} placeholder="Search expenses…" placeholderTextColor={colors.muted} style={field} />
          </View>
        }
        ListEmptyComponent={<EmptyState icon="wallet-outline" title="No expenses yet" message="Tap + to record one" />}
        renderItem={({ item }) => (
          <Pressable testID={`exp-row-${item.id}`} onPress={() => open(item)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700", flex: 1 }}>{item.custom_expense_type || item.expense_type || item.category}</Text>
                <Text style={{ color: colors.error, fontWeight: "700" }}>{formatINR(Number(item.amount || 0))}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{item.description || item.title} · {item.payment_method || item.method}{item.paidTo ? ` · ${item.paidTo}` : ""}</Text>
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{formatDate(recordDateMs(item))}</Text>
            </Card>
          </Pressable>
        )}
      />
      <Modal visible={editing !== undefined} animationType="slide" onRequestClose={() => setEditing(undefined)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>{editing ? "Edit expense" : "New expense"}</Text>
              <Pressable onPress={() => setEditing(undefined)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              <Text style={lbl}>Date (DD/MM/YYYY)</Text>
              <TextInput value={form.date} onChangeText={(v) => set("date", v)} placeholderTextColor={colors.muted} style={field} />
              <Text style={lbl}>Expense type</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{EXPENSE_TYPES.map((t) => <Chip key={t} colors={colors} label={t} active={form.expense_type === t} onPress={() => set("expense_type", t)} />)}</View>
              {form.expense_type === "Other" && (<><Text style={lbl}>Custom expense type *</Text><TextInput value={form.custom_expense_type} onChangeText={(v) => set("custom_expense_type", v)} placeholderTextColor={colors.muted} style={field} /></>)}
              <Text style={lbl}>Description *</Text>
              <TextInput testID="expense-description" value={form.description} onChangeText={(v) => set("description", v)} placeholder="What was this for?" placeholderTextColor={colors.muted} style={field} />
              <Text style={lbl}>Amount (₹) *</Text>
              <TextInput testID="expense-amount" value={form.amount} onChangeText={(v) => set("amount", v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={field} />
              <Text style={lbl}>Payment method</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{EXPENSE_PAYMENT_METHODS.map((m) => <Chip key={m} colors={colors} label={m} active={form.payment_method === m} onPress={() => set("payment_method", m)} />)}</View>
              <Text style={lbl}>Paid to</Text>
              <TextInput value={form.paidTo} onChangeText={(v) => set("paidTo", v)} placeholderTextColor={colors.muted} style={field} />
              <Text style={lbl}>Remarks</Text>
              <TextInput value={form.remarks} onChangeText={(v) => set("remarks", v)} multiline placeholderTextColor={colors.muted} style={[field, { minHeight: 70, textAlignVertical: "top" }]} />
              <PrimaryButton testID="expense-save" label={busy ? "Saving…" : "Save expense"} onPress={save} disabled={busy} gradient={gradients.brand} style={{ marginTop: 24 }} />
              {editing?.id && <Pressable onPress={() => remove(editing)} style={{ alignItems: "center", padding: 14, marginTop: 12, backgroundColor: colors.errorBg, borderRadius: 12 }}><Text style={{ color: colors.error, fontWeight: "600" }}>Delete expense</Text></Pressable>}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
