import React, { useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { Card, EmptyState, PrimaryButton } from "../src/components/ui";
import { formatINR, formatDateTime } from "../src/utils/format";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { useBusiness } from "../src/services/business";
import { useCollection } from "../src/hooks/useCollection";
import { postCustomerLedger } from "../src/services/repository";
import { ledgerBalance } from "../src/domain/payments.ts";

type Mode = "PAYMENT" | "ADJUSTMENT_INCREASE" | "ADJUSTMENT_DECREASE";
const METHODS = ["Cash", "UPI", "Card"];
const LABEL: Record<string, string> = { CREDIT: "Credit", PAYMENT: "Payment", ADJUSTMENT_INCREASE: "Adjustment · Increase", ADJUSTMENT_DECREASE: "Adjustment · Decrease" };
const outstandingOf = (c: any) => Number(c?.outstanding ?? c?.total_due ?? 0);
const newOpId = () => `op-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// Pay Later · Customer Ledger — same model as the web page: record a payment (Cash/UPI/Card), owner-authorised
// adjustment (with a reason), and the full per-customer ledger history. Balances update atomically.
export default function PayLater() {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const customers = useMockStore((s) => s.customers);
  const shops = useMockStore((s) => s.shops);
  const access = useBusiness((b) => b.access);
  const { data: ledger } = useCollection("paylaterLedger");
  const isAdmin = ["OWNER", "ADMIN"].includes(access?.role || "");
  const [search, setSearch] = useState("");
  const [onlyDue, setOnlyDue] = useState(true);
  const [target, setTarget] = useState<any | null>(null);
  const [mode, setMode] = useState<Mode | "HISTORY">("PAYMENT");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const opId = React.useRef<string | null>(null);

  const rows = useMemo(
    () => customers
      .filter((c: any) => shopId === "all" || c.shop_id === shopId)
      .filter((c: any) => (!onlyDue || outstandingOf(c) > 0) && `${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()))
      .sort((a: any, b: any) => outstandingOf(b) - outstandingOf(a)),
    [customers, shopId, search, onlyDue],
  );
  const total = rows.reduce((n: number, c: any) => n + outstandingOf(c), 0);
  const entries = useMemo(() => (target ? ledger.filter((e) => e.customer_id === target.id) : []), [ledger, target]);

  // Live preview — never allows overpaying the outstanding balance.
  let preview: ReturnType<typeof ledgerBalance> | null = null;
  try { if (target && mode !== "HISTORY") preview = ledgerBalance(outstandingOf(target), mode, amount); } catch { preview = null; }

  const open = (c: any, m: Mode | "HISTORY") => { setTarget(c); setMode(m); setAmount(m === "PAYMENT" ? String(outstandingOf(c)) : ""); setMethod("Cash"); setNotes(""); setError(""); opId.current = null; };
  const save = async () => {
    if (!target || !preview || busy || mode === "HISTORY") return;
    setBusy(true); setError("");
    if (!opId.current) opId.current = newOpId();
    try {
      await postCustomerLedger(target.id, { type: mode, amount, payment_method: mode === "PAYMENT" ? method : undefined, notes, operation_id: opId.current }, shops);
      setTarget(null);
      Alert.alert(mode === "PAYMENT" ? "Payment recorded" : "Outstanding adjusted", `New balance ${formatINR(preview.balance_after)}`);
    } catch (e: any) { setError(e?.message || "Could not post the entry."); }
    finally { setBusy(false); }
  };

  const field = { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Pay Later</Text>
          <Text testID="paylater-outstanding" style={{ color: colors.warning, fontSize: 13, fontWeight: "700" }}>Outstanding {formatINR(total)} · {rows.filter((c: any) => outstandingOf(c) > 0).length} accounts</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 10 }}>
        <TextInput testID="paylater-search" value={search} onChangeText={setSearch} placeholder="Search name or phone" placeholderTextColor={colors.muted} style={field} />
        <Pressable onPress={() => setOnlyDue((v) => !v)}><Text style={{ color: colors.brand, fontWeight: "700" }}>{onlyDue ? "☑" : "☐"} Outstanding only</Text></Pressable>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(c: any) => c.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListEmptyComponent={<EmptyState icon="card-outline" title="No pay later accounts" message="Credit sales from POS and Services appear here." />}
        renderItem={({ item }: any) => (
          <Card>
            <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}>{item.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{item.phone}</Text>
            <Text testID={`paylater-outstanding-${item.id}`} style={{ color: outstandingOf(item) > 0 ? colors.warning : colors.success, fontWeight: "700", marginTop: 6 }}>Outstanding {formatINR(outstandingOf(item))}</Text>
            <View style={{ flexDirection: "row", gap: 18, marginTop: 10, flexWrap: "wrap" }}>
              {outstandingOf(item) > 0 && <Pressable testID={`paylater-pay-${item.id}`} onPress={() => open(item, "PAYMENT")}><Text style={{ color: colors.brand, fontWeight: "700" }}>Record payment</Text></Pressable>}
              {isAdmin && <Pressable onPress={() => open(item, "ADJUSTMENT_INCREASE")}><Text style={{ color: colors.warning, fontWeight: "700" }}>Adjust</Text></Pressable>}
              <Pressable onPress={() => open(item, "HISTORY")}><Text style={{ color: colors.muted, fontWeight: "700" }}>History</Text></Pressable>
            </View>
          </Card>
        )}
      />
      <Modal visible={!!target} animationType="slide" onRequestClose={() => setTarget(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <View>
                <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>{target?.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{target?.phone} · Outstanding {formatINR(outstandingOf(target))}</Text>
              </View>
              <Pressable onPress={() => setTarget(null)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {mode === "HISTORY" ? (
                entries.length ? entries.map((e) => (
                  <Card key={e.id}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{LABEL[e.type] || e.type}</Text>
                      <Text style={{ color: e.type === "PAYMENT" || e.type === "ADJUSTMENT_DECREASE" ? colors.success : colors.warning, fontWeight: "700" }}>{formatINR(Number(e.amount || 0))}</Text>
                    </View>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{formatDateTime(e.created_at || e.createdAt)} · {e.payment_method || "—"} · {e.reference || "—"}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Balance {formatINR(Number(e.balance_before || 0))} → {formatINR(Number(e.balance_after || 0))}{e.notes ? ` · ${e.notes}` : ""}</Text>
                  </Card>
                )) : <Text style={{ color: colors.muted }}>No ledger entries for this customer yet.</Text>
              ) : (
                <View style={{ gap: 12 }}>
                  {isAdmin && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {(["PAYMENT", "ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE"] as Mode[]).map((m) => (
                        <Pressable key={m} onPress={() => setMode(m)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: mode === m ? colors.brand : colors.border, backgroundColor: mode === m ? colors.brand : "transparent" }}>
                          <Text style={{ color: mode === m ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{LABEL[m]}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <TextInput testID="paylater-amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Amount (₹)" placeholderTextColor={colors.muted} style={field} />
                  {mode === "PAYMENT" && (
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {METHODS.map((m) => (
                        <Pressable key={m} testID={`paylater-method-${m}`} onPress={() => setMethod(m)} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: method === m ? colors.brand : colors.border, backgroundColor: method === m ? colors.brand : "transparent" }}>
                          <Text style={{ color: method === m ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{m}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <TextInput testID="paylater-notes" value={notes} onChangeText={setNotes} placeholder={mode === "PAYMENT" ? "Notes (optional)" : "Reason (required)"} placeholderTextColor={colors.muted} multiline style={[field, { minHeight: 70, textAlignVertical: "top" }]} />
                  {preview ? <Text testID="paylater-preview" style={{ color: colors.muted }}>Balance after: <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{formatINR(preview.balance_after)}</Text></Text>
                    : amount !== "" ? <Text style={{ color: colors.error, fontSize: 12 }}>Enter a positive amount that does not exceed the outstanding balance.</Text> : null}
                  {!!error && <Text testID="paylater-error" style={{ color: colors.error }}>{error}</Text>}
                  <PrimaryButton testID="paylater-confirm" label={busy ? "Saving…" : mode === "PAYMENT" ? "Record payment" : "Post adjustment"} onPress={save} disabled={busy || !preview} gradient={gradients.brand} />
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
