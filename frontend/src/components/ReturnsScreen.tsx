import React, { useMemo, useState,useRef } from "react";
import {IS_NEON}from '../services/databaseBackend';
import {newOperationId}from '../services/neon/client';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { useTheme } from "../theme/theme";
import { Card, EmptyState, PrimaryButton } from "./ui";
import { formatINR } from "../utils/format";
import { useAppStore } from "../store/shop";
import { useMockStore } from "../store/mock-data";
import { adjustProductStock, createShopRecord } from "../services/repository";
import { filterInvoices } from "../domain/invoiceSearch.ts";
import { REFUND_METHODS, RETURN_REASONS, buildReturnRecord, lineQty, refundTotal, validateReturn } from "../domain/returns.ts";

// Returns & Refunds — same behaviour as the web page: pick an invoice, choose per-item quantities, reason, refund
// method, optionally restock (audited RETURN stock movement), and record a `returns` document + notification.
export default function ReturnsScreen() {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const invoices = useMockStore((s) => s.invoices);
  const returns = useMockStore((s) => s.returns);
  const products = useMockStore((s) => s.products);
  const shops = useMockStore((s) => s.shops);
  const shop = shops.find((s: any) => s.id === shopId);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [qtys, setQtys] = useState<Record<number, string>>({});
  const [reason, setReason] = useState(RETURN_REASONS[0]);
  const [customReason, setCustomReason] = useState("");
  const [refundMethod, setRefundMethod] = useState(REFUND_METHODS[0]);
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState(true);
  const operation=useRef<string|null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => filterInvoices(invoices.filter((i: any) => shopId === "all" || i.shop_id === shopId), search).slice(0, 60) as any[], [invoices, shopId, search]);
  const items: any[] = selected?.items || [];
  const refund = refundTotal(items, qtys);
  const field = { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const;

  const open = (inv: any) => { operation.current=newOperationId();setSelected(inv); setQtys({}); setReason(RETURN_REASONS[0]); setCustomReason(""); setRefundMethod(REFUND_METHODS[0]); setNote(""); setRestock(true); };
  const process = async () => {
    const err = validateReturn(items, qtys, reason, customReason);
    if (err) return Alert.alert("Return", err);
    const user = getAuth(getApp()).currentUser;
    setBusy(true);
    try {
      const rec = buildReturnRecord({ invoice: selected, items, qtys, reason, customReason, refundMethod, note, restock, branchSlug: shop?.slug || shopId, processedBy: user?.email || null });
      if(!operation.current)operation.current=newOperationId();
      await createShopRecord("returns", {...rec,operation_id:operation.current}, shops);
      if (restock && !IS_NEON) {
        for (const it of rec.items) {
          const prod = it.productId ? products.find((p: any) => p.id === it.productId) : null;
          if (prod) await adjustProductStock(prod.id, (Number(prod.stock) || 0) + it.returnQty, "RETURN", { reason: "Sellable customer return" }, shops);
        }
      }
      await createShopRecord("notifications", { type: "return", title: "Return processed", message: `${rec.invoiceNumber} · ${formatINR(rec.refundAmount)}`, read: false }, shops).catch(() => undefined);
      setSelected(null);
      operation.current=null;
      Alert.alert("Return processed", `${formatINR(rec.refundAmount)} refunded via ${refundMethod}${restock ? " · inventory restored" : ""}`);
    } catch (e: any) { Alert.alert("Return not processed", e?.message || "Please try again."); }
    finally { setBusy(false); }
  };

  const Chip = ({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) => (
    <Pressable onPress={onPress} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : "transparent", marginRight: 8, marginBottom: 8 }}>
      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Returns & Refunds</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{returns.filter((r: any) => shopId === "all" || r.shop_id === shopId).length} returns recorded</Text>
        </View>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10 }}>
        <TextInput testID="return-search" value={search} onChangeText={setSearch} placeholder="Search invoice # / customer / phone…" placeholderTextColor={colors.muted} style={field} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(i: any) => i.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListEmptyComponent={<EmptyState icon="return-up-back-outline" title="No invoices found" message="Search by invoice number, customer or phone" />}
        renderItem={({ item }: any) => (
          <Pressable testID={`return-inv-${item.id}`} onPress={() => open(item)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.invoice_number}</Text>
                <Text style={{ color: colors.brand, fontWeight: "700" }}>{formatINR(Number(item.total || 0))}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{item.customer_name} · {(item.items || []).length} items</Text>
            </Card>
          </Pressable>
        )}
      />
      <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>Return {selected?.invoice_number}</Text>
              <Pressable onPress={() => setSelected(null)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 60, gap: 8 }} keyboardShouldPersistTaps="handled">
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>ITEMS TO RETURN</Text>
              {items.map((it, i) => (
                <View key={`${it.name}-${i}`} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{it.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12 }}>Sold {lineQty(it)} × {formatINR(Number(it.price || 0))}</Text>
                  </View>
                  <TextInput testID={`return-qty-${i}`} value={qtys[i] ?? ""} onChangeText={(v) => setQtys((q) => ({ ...q, [i]: String(Math.min(lineQty(it), Math.max(0, Number(v.replace(/\D/g, "")) || 0)) || "") }))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.muted} style={[field, { width: 70, textAlign: "center" }]} />
                </View>
              ))}
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 12 }}>REASON</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{RETURN_REASONS.map((r) => <Chip key={r} label={r} active={reason === r} onPress={() => setReason(r)} />)}</View>
              {reason === "Other" && <TextInput testID="return-custom-reason" value={customReason} onChangeText={setCustomReason} placeholder="Custom reason *" placeholderTextColor={colors.muted} style={field} />}
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 8 }}>REFUND METHOD</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{REFUND_METHODS.map((m) => <Chip key={m} label={m} active={refundMethod === m} onPress={() => setRefundMethod(m)} />)}</View>
              <TextInput value={note} onChangeText={setNote} placeholder="Note (optional)" placeholderTextColor={colors.muted} multiline style={[field, { minHeight: 60, textAlignVertical: "top" }]} />
              <Pressable onPress={() => setRestock((r) => !r)}><Text style={{ color: colors.brand, fontWeight: "700", marginTop: 6 }}>{restock ? "☑" : "☐"} Return items to stock</Text></Pressable>
              <Text testID="return-refund" style={{ color: colors.onSurface, fontWeight: "800", fontSize: 18, marginTop: 10 }}>Refund {formatINR(Math.round(refund))}</Text>
              <PrimaryButton testID="return-submit" label={busy ? "Processing…" : "Process return"} onPress={process} disabled={busy} gradient={gradients.brand} style={{ marginTop: 14 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
