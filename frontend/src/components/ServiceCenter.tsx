import React, { useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTheme } from "../theme/theme";
import { Card, PrimaryButton, ScreenHeader } from "./ui";
import CustomerPhoneLookup from "./CustomerPhoneLookup";
import { formatINR } from "../utils/format";
import { useAppStore } from "../store/shop";
import { useMockStore } from "../store/mock-data";
import { branchLabel } from "../domain/listTools.ts";
import { findProductByCode, normalizeScan, searchProducts } from "../domain/productCodes.ts";
import { PAY_METHODS, paymentState, secondaryRemainder, type PayMethod } from "../domain/payments.ts";
import {
  ACCESSORY_PRESETS, LOCK_TYPES, PRIORITIES, SERVICE_TYPES, WARRANTY_OPTIONS, WIZARD_STEPS, accessoriesText, buildReview, genServiceNo, validateServiceStep, type StepId,
} from "../domain/serviceWizard.ts";
import { SERVICE_STATUSES, buildServiceJob, itemsWithCharge, serviceTotal, type ServiceItem } from "../domain/serviceRecord.ts";
import { buildServiceWhatsAppMessage, whatsAppUrl } from "../domain/whatsapp.ts";
import { createServiceWithUsage, updateServiceFields } from "../services/repository";
import type { Customer, FlushResult } from "../domain/customerAutosave.ts";

type Form = Record<string, any>;
const today = () => new Date().toISOString().slice(0, 10);
const blank = (prefix: string): Form => ({
  service_no: genServiceNo(prefix), service_type: "Repair", custom_service_type: "", priority: "Medium", status: "Pending",
  received_date: today(), has_estimate: false, estimated_date: today(), customer_id: "", customer_name: "", customer_phone: "",
  shop_product_id: "", device_category: "", custom_device_category: "", product: "", accessory: "", imei1: "", imei2: "", issue: "", technician_notes: "", service_description: "",
  product_source: "external",
  warranty_type: "No warranty", warranty_custom: "", warranty_description: "",
  received_by_name: "", brand: "", model: "", lock_type: "None", lock_value: "", customer_description: "", device_condition: "",
  accessories_selected: [], accessories_custom: "", service_charge: "", customer_email: "", customer_address: "", customer_gstin: "", customer_type: "",
});

// ---- stable, module-level building blocks (stable identity => TextInputs keep focus) ----
function useStyles() {
  const { colors } = useTheme();
  return {
    colors,
    field: { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const,
    lbl: { color: colors.muted, fontSize: 12, fontWeight: "600" as const, marginBottom: 6, marginTop: 12 },
  };
}
function Chip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : "transparent", marginRight: 8, marginBottom: 8 }}>
      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
function Field({ label, value, onChange, testID, kb, multiline, secure, error, placeholder }: { label: string; value: string; onChange: (v: string) => void; testID?: string; kb?: any; multiline?: boolean; secure?: boolean; error?: string; placeholder?: string }) {
  const { field, lbl, colors } = useStyles();
  return (
    <View>
      <Text style={lbl}>{label}</Text>
      <TextInput testID={testID} value={value} onChangeText={onChange} keyboardType={kb} multiline={multiline} secureTextEntry={secure} autoCapitalize="none" placeholder={placeholder || label} placeholderTextColor={colors.muted} style={[field, multiline ? { minHeight: 70, textAlignVertical: "top" } : null]} />
      {!!error && <Text testID={testID ? `${testID}-error` : undefined} style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
export function ServiceCenter() {
  const { colors, gradients } = useTheme();
  const { shopId } = useAppStore();
  const services = useMockStore((s) => s.services);
  const products = useMockStore((s) => s.products);
  const shops = useMockStore((s) => s.shops);
  const shop = shops.find((s: any) => s.id === shopId);
  const prefix = shop?.service_prefix || shop?.slug || shopId || "BR";

  const [mode, setMode] = useState<"ticket" | "quick">("ticket");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<Form>(() => blank(prefix));
  const [items, setItems] = useState<ServiceItem[]>([]);
  const [newItem, setNewItem] = useState({ name: "", price: "", qty: "1" });
  const [partQuery, setPartQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [pending, setPending] = useState(false);
  const [method, setMethod] = useState<PayMethod>("Cash");
  const [cash, setCash] = useState("");
  const [saving, setSaving] = useState(false);
  const [partScanOpen, setPartScanOpen] = useState(false);
  const [partScanLocked, setPartScanLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [saved, setSaved] = useState<any>(null);
  const flushRef = useRef<(() => Promise<FlushResult>) | null>(null);
  const opId = useRef<string | null>(null);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const wizard = mode === "ticket";
  const branchProducts = useMemo(() => products.filter((p: any) => p.shop_id === shopId), [products, shopId]);
  const productCategories = useMemo(() => [...new Set(branchProducts.map((p: any) => String(p.category || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [branchProducts]);
  const allItems = useMemo(() => itemsWithCharge(items, form, wizard), [items, form, wizard]);
  const total = useMemo(() => Math.round(serviceTotal(allItems) * 100) / 100, [allItems]);
  // Cash-only pays the whole bill in cash; otherwise the non-cash leg is the auto-calculated remainder.
  const cashEff = method === "Cash" ? total : Number(cash || 0);
  const payment = useMemo(() => paymentState(total, method, cashEff, secondaryRemainder(total, method, cashEff)), [total, method, cashEff]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services
      .filter((x: any) => shopId === "all" || x.shop_id === shopId)
      .filter((x: any) => !q || [x.service_no, x.customer_name ?? x.customerName, x.customer_phone ?? x.customerPhone, x.product, x.status].some((v) => String(v || "").toLowerCase().includes(q)));
  }, [services, shopId, search]);
  const active = services.filter((x: any) => (shopId === "all" || x.shop_id === shopId) && !["Ready", "Delivered", "Cancelled", "READY"].includes(x.status)).length;

  const reset = (nextMode = mode) => {
    setForm(blank(prefix)); setItems([]); setNewItem({ name: "", price: "", qty: "1" }); setStep(0); setFurthest(0); setErrors({});
    setCustomer(null); setPending(false); setMethod("Cash"); setCash(""); setSaved(null); setProductQuery(""); setPartQuery(""); opId.current = null; setMode(nextMode);
  };
  const begin = (m: "ticket" | "quick") => { reset(m); setOpen(true); };

  const onCustomerSelect = (c: Customer | null) => {
    setCustomer(c);
    setForm((f) => ({
      ...f, customer_id: c?.id || "", customer_name: c?.name || "", customer_phone: c?.phone || f.customer_phone || "",
      customer_email: c?.email || "", customer_address: c?.address || "", customer_gstin: c?.gstin || c?.gstIn || "", customer_type: c ? c.type || c.customer_type || "" : "",
    }));
  };

  const ctxFor = (c: Customer | null = customer, pend = pending, f = form) => ({ form: f, customer: c, customerPending: pend });

  const next = async () => {
    const id: StepId = WIZARD_STEPS[step].id;
    let ctx = ctxFor();
    if (id === "customer") {
      // Finish any pending customer autosave BEFORE validating: Next can never race the save.
      const flushed = await flushRef.current?.();
      if (flushed?.error) { setErrors({ customer_phone: flushed.error }); return Alert.alert("Customer", flushed.error); }
      if (flushed?.customer) {
        const c = flushed.customer;
        ctx = ctxFor(c, false, { ...form, customer_name: c.name || form.customer_name, customer_phone: c.phone || form.customer_phone });
      }
    }
    const r = validateServiceStep(id, ctx);
    setErrors(r.errors);
    if (!r.ok) return Alert.alert("Check this step", Object.values(r.errors)[0]);
    const target = Math.min(step + 1, WIZARD_STEPS.length - 1);
    setStep(target); setFurthest((f) => Math.max(f, target));
  };

  const addItem = () => {
    const price = Number(newItem.price), qty = Number(newItem.qty) || 1;
    if (!newItem.name.trim() || !Number.isFinite(price) || price < 0) return Alert.alert("Item", "Enter an item name and a valid price.");
    setItems((l) => [...l, { kind: "custom", name: newItem.name.trim(), price, qty }]);
    setNewItem({ name: "", price: "", qty: "1" });
  };
  const addPart = (p: any) => {
    if (Number(p.stock || 0) <= 0) return Alert.alert("Out of stock", `${p.name} has no stock in this branch.`);
    setItems((l) => {
      const hit = l.find((i) => i.kind === "inventory" && i.product_id === p.id);
      if (hit) return l.map((i) => (i === hit ? { ...i, qty: Math.min(i.qty + 1, Number(p.stock)) } : i));
      return [...l, { kind: "inventory", product_id: p.id, product_code: p.product_code || p.sku || null, barcode: p.barcode || null, category: p.category || null, gst: Number(p.gst || 0), stock: Number(p.stock || 0), name: p.name, price: Number(p.price ?? p.selling_price ?? 0), qty: 1 }];
    });
    setPartQuery("");
  };

  const openPartScanner = async () => {
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) return Alert.alert("Camera access", "Allow camera access to scan a spare-part barcode.");
    }
    setPartScanLocked(false); setPartScanOpen(true);
  };
  const scanPart = (event: any) => {
    if (partScanLocked) return;
    setPartScanLocked(true);
    const product = findProductByCode(branchProducts, normalizeScan(event?.data));
    if (!product) { setPartScanOpen(false); return Alert.alert("Product not found", "No inventory product matches that barcode or product code."); }
    setPartScanOpen(false); addPart(product);
  };

  const submit = async () => {
    if (saving) return;
    // Quick bill: resolve the customer autosave first, then continue with the fresh selection.
    let cust = customer, f = form;
    if (!wizard) {
      const flushed = await flushRef.current?.();
      if (flushed?.error) return Alert.alert("Customer", flushed.error);
      if (flushed?.customer) { cust = flushed.customer; f = { ...form, customer_id: cust.id, customer_name: cust.name, customer_phone: cust.phone || form.customer_phone }; }
    }
    if (wizard) {
      for (let i = 0; i < WIZARD_STEPS.length - 1; i += 1) {
        const r = validateServiceStep(WIZARD_STEPS[i].id, ctxFor(cust, false, f));
        if (!r.ok) { setStep(i); setErrors(r.errors); return Alert.alert("Check this step", Object.values(r.errors)[0]); }
      }
    } else {
      if (!cust?.id) return Alert.alert("Customer", "Enter the customer's phone number and name first.");
      if (!String(f.product || "").trim()) return Alert.alert("Product", "Enter the product / device.");
      if (f.warranty_type === "Custom" && !String(f.warranty_custom || "").trim()) return Alert.alert("Warranty", "Enter the custom warranty.");
    }
    if (!allItems.length && !wizard) return Alert.alert("Items", "Add at least one item or labour charge.");
    if (!payment.valid) return Alert.alert("Payment", "Payment amounts must equal the service total.");
    if (payment.pay_later_amount > 0 && !cust?.id) return Alert.alert("Pay Later", "Select a customer for Pay Later.");
    setSaving(true);
    try {
      const job = buildServiceJob({ form: f, mode, items, productName: String(f.product || "").trim() });
      if (!opId.current) opId.current = `svc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const record = await createServiceWithUsage({ ...job, ...payment, advance: payment.total_paid, payment_method: method, status: job.status, operation_id: opId.current, branch_name: branchLabel(shop) }, shops);
      setSaved({ ...job, id: record.id || opId.current });
    } catch (e: any) {
      Alert.alert("Service not saved", e?.message || "Check your connection and try again.");
    } finally { setSaving(false); }
  };

  const shareReceipt = async (s: any) => {
    const total = Number(s.total ?? s.price ?? 0);
    const html = `<html><body style="font-family:Arial;padding:24px"><h2>ALL IN ONE HUB — Service ${s.service_no || ""}</h2><p>${s.customer_name || s.customerName || ""} · ${s.customer_phone || s.customerPhone || ""}</p><p>Category: ${s.device_category || "—"}</p><p>Device: ${s.product || ""}</p><p>Status: ${s.status || ""}</p><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%">${(s.items || []).map((i: any) => `<tr><td>${i.name}</td><td>${i.qty}</td><td>₹${Number(i.price).toFixed(2)}</td></tr>`).join("")}</table><h3>Total ₹${total.toFixed(2)}</h3></body></html>`;
    const { uri } = await Print.printToFileAsync({ html });
    if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Service ${s.service_no || s.id}` });
  };
  const whatsApp = async (s: any) => {
    const url = whatsAppUrl(s.customer_phone ?? s.customerPhone, buildServiceWhatsAppMessage(s));
    if (!url) return Alert.alert("WhatsApp", "No valid WhatsApp number for this customer.");
    Linking.openURL(url).catch(() => Alert.alert("WhatsApp", "Could not open WhatsApp."));
  };

  const review = useMemo(() => buildReview({ form, items: allItems, total, branchName: branchLabel(shop) }), [form, allItems, total, shop]);
  const stepId = WIZARD_STEPS[step].id;

  const selectedCategory = form.device_category === "Other / Custom" ? form.custom_device_category : form.device_category;
  const categoryProducts = useMemo(() => branchProducts.filter((p: any) => !selectedCategory || p.category === selectedCategory), [branchProducts, selectedCategory]);
  const productHits = useMemo(() => (productQuery.trim() ? searchProducts(categoryProducts, productQuery).slice(0, 5) : []), [categoryProducts, productQuery]);
  const partHits = useMemo(() => (partQuery.trim() ? searchProducts(branchProducts, partQuery).slice(0, 5) : []), [branchProducts, partQuery]);

  const PaymentBlock = (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 16 }}>PAYMENT · Total {formatINR(total)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        {PAY_METHODS.map((m) => <Chip key={m} testID={`svc-pay-${m}`} label={m} active={method === m} onPress={() => setMethod(m)} />)}
      </View>
      {method !== "Cash" && (
        <View>
          <Field label="Cash received now (₹)" value={cash} onChange={setCash} kb="decimal-pad" testID="svc-pay-cash" />
          <Text testID="svc-pay-remainder" style={{ color: colors.muted, marginTop: 6 }}>{method} / balance (auto): {formatINR(secondaryRemainder(total, method, cashEff))}</Text>
        </View>
      )}
      {!payment.valid && total > 0 && <Text style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>Payment must equal the total.</Text>}
    </View>
  );

  const ItemsBlock = (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 16 }}>PRODUCTS / SPARE PARTS / LABOUR</Text>
      <Pressable testID="svc-scan-part" onPress={openPartScanner} style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 10 }}><Ionicons name="scan-outline" size={19} color={colors.brand} /><Text style={{ color: colors.brand, fontWeight: "700" }}>Scan Product</Text></Pressable>
      <Field label="Inventory part (search)" value={partQuery} onChange={setPartQuery} testID="svc-part-search" />
      {partHits.map((p: any) => (
        <Pressable key={p.id} testID={`svc-part-${p.id}`} onPress={() => addPart(p)} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <Text style={{ color: colors.onSurface }}>{p.name} · Stock {p.stock || 0} · {formatINR(Number(p.price ?? p.selling_price ?? 0))}</Text>
          <Text style={{ color: colors.muted, fontSize: 11 }}>{[p.category, p.product_code || p.sku, p.barcode ? `Barcode ${p.barcode}` : null, `GST ${Number(p.gst || 0)}%`].filter(Boolean).join(" · ")}</Text>
        </Pressable>
      ))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 2 }}><Field label="Item / labour" value={newItem.name} onChange={(v) => setNewItem((n) => ({ ...n, name: v }))} testID="svc-item-name" /></View>
        <View style={{ flex: 1 }}><Field label="Price" value={newItem.price} onChange={(v) => setNewItem((n) => ({ ...n, price: v }))} kb="decimal-pad" testID="svc-item-price" /></View>
        <View style={{ flex: 1 }}><Field label="Qty" value={newItem.qty} onChange={(v) => setNewItem((n) => ({ ...n, qty: v }))} kb="number-pad" testID="svc-item-qty" /></View>
      </View>
      <Pressable testID="svc-add-item" onPress={addItem} style={{ marginTop: 10, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
        <Text style={{ color: colors.brand, fontWeight: "700", textAlign: "center" }}>+ Add Item</Text>
      </Pressable>
      {allItems.map((it, i) => (
        <View key={`${it.name}-${i}`} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
          <View style={{ flex: 1 }}><Text style={{ color: colors.onSurface }}>{it.name}{it.kind === "inventory" ? ` · stock${it.product_code ? ` · ${it.product_code}` : ""}` : ""} × {it.qty}</Text>{it.kind === "inventory" && <Text style={{ color: colors.muted, fontSize: 10 }}>{[it.category, it.barcode ? `Barcode ${it.barcode}` : null, `GST ${Number(it.gst || 0)}%`, `Available ${Number(it.stock || 0)}`].filter(Boolean).join(" · ")}</Text>}</View>
          <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{formatINR(it.price * it.qty)}</Text>
          {it.kind !== "charge" && <Pressable onPress={() => setItems((l) => l.filter((x) => x !== it))}><Ionicons name="close" size={18} color={colors.muted} style={{ marginLeft: 10 }} /></Pressable>}
        </View>
      ))}
      <Text testID="svc-total" style={{ color: colors.onSurface, fontWeight: "700", marginTop: 10 }}>Total charges {formatINR(total)}</Text>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Services" subtitle={`${active} active · ${list.length} total`} right={<Pressable testID="svc-new" onPress={() => begin(mode)}><Ionicons name="add-circle" size={28} color={colors.brand} /></Pressable>} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable testID="svc-mode-ticket" onPress={() => begin("ticket")} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.brand }}>
            <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Create Service Ticket</Text>
            <Text style={{ color: colors.onBrandPrimary, opacity: 0.8, fontSize: 11, marginTop: 2 }}>Diagnosis, repair time, tracking</Text>
          </Pressable>
          <Pressable testID="svc-mode-quick" onPress={() => begin("quick")} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
            <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Quick Service Bill</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>Completed immediately</Text>
          </Pressable>
        </View>
        <TextInput testID="svc-search" value={search} onChangeText={setSearch} placeholder="Search service no, customer, phone, device, status…" placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }} />
        {list.map((x: any) => (
          <Pressable key={x.id} testID={`svc-row-${x.id}`} onPress={() => setDetail(x)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.brand, fontWeight: "700" }}>{x.service_no || x.id.slice(0, 8)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{x.status}</Text>
              </View>
              <Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 4 }}>{x.customer_name ?? x.customerName} · {x.product}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{x.issue ?? x.complaint ?? x.service_description ?? ""}</Text>
              <Text style={{ color: colors.onSurface, fontWeight: "700", marginTop: 6 }}>{formatINR(Number(x.total ?? x.price ?? 0))}</Text>
            </Card>
          </Pressable>
        ))}
        {!list.length && <Card><Text style={{ color: colors.muted }}>No service records yet.</Text></Card>}
      </ScrollView>

      {/* ------------------------------------------------------------- wizard / quick bill */}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ padding: 20, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>{wizard ? "Create Service Ticket" : "Quick Service Bill"}</Text>
                {wizard && <Text testID="wiz-step-count" style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>Step {step + 1} of {WIZARD_STEPS.length} · {WIZARD_STEPS[step].label}</Text>}
              </View>
              <Pressable testID="svc-close" onPress={() => setOpen(false)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            </View>
            {wizard && !saved && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 48, paddingHorizontal: 20 }}>
                {WIZARD_STEPS.map((s, i) => <Chip key={s.id} testID={`wiz-step-${i + 1}`} label={`${i + 1}. ${s.short}`} active={i === step} onPress={() => { if (i <= furthest) { setErrors({}); setStep(i); } }} />)}
              </ScrollView>
            )}

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {saved ? (
                <View testID="svc-saved" style={{ alignItems: "center", gap: 10, paddingTop: 30 }}>
                  <Ionicons name="checkmark-circle" size={64} color={colors.success} />
                  <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700" }}>Service {saved.service_no} saved</Text>
                  <Text style={{ color: colors.muted }}>{saved.customer_name} · {formatINR(saved.total)} · {saved.status}</Text>
                  <PrimaryButton label="Share receipt (PDF)" onPress={() => shareReceipt(saved).catch((e) => Alert.alert("Receipt", e?.message))} gradient={gradients.brand} style={{ alignSelf: "stretch", marginTop: 14 }} />
                  <PrimaryButton label="Send on WhatsApp" onPress={() => whatsApp(saved)} style={{ alignSelf: "stretch" }} />
                  <Pressable onPress={() => reset(mode)}><Text style={{ color: colors.brand, fontWeight: "700", padding: 12 }}>New service</Text></Pressable>
                </View>
              ) : (
                <View>
                  {/* ---- customer: phone-first, ONE section. Quick bill shows it inline, ticket on step 1 ---- */}
                  {(!wizard || stepId === "customer") && (
                    <View>
                      <CustomerPhoneLookup customer={customer} onSelect={onCustomerSelect} onPending={setPending} flushRef={flushRef} testIDPrefix="svc-customer" />
                      {(errors.customer_phone || errors.customer_name) && <Text testID="wiz-error-customer" style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>{errors.customer_phone || errors.customer_name}</Text>}
                      {wizard && (
                        <View>
                          <Field label="Staff Name / Received By *" value={form.received_by_name} onChange={(v) => set("received_by_name", v)} testID="wiz-received-by" error={errors.received_by_name} placeholder="Staff member who took this request" />
                          <Field label="Received date (YYYY-MM-DD)" value={form.received_date} onChange={(v) => set("received_date", v)} testID="wiz-received-date" />
                        </View>
                      )}
                    </View>
                  )}

                  {(!wizard || stepId === "product") && (
                    <View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 10 }}>
                        <Chip label="Customer Product" active={form.product_source !== "shop"} onPress={() => setForm((f) => ({ ...f, product_source: "external", shop_product_id: "" }))} testID="service-source-external" />
                        <Chip label="Shop Product" active={form.product_source === "shop"} onPress={() => set("product_source", "shop")} testID="service-source-shop" />
                      </View>
                      {wizard && (
                        <View>
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Category *</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                            {[...new Set(["Mobile", "Watch", "Laptop", "Speaker", "Tablet", "TV", ...productCategories, "Other / Custom"])].map((category) => <Chip key={category} testID={`wiz-category-${category}`} label={category} active={form.device_category === category} onPress={() => setForm((f) => ({ ...f, device_category: category, custom_device_category: category === "Other / Custom" ? f.custom_device_category : "" }))} />)}
                          </View>
                          {!form.device_category && !!errors.device_category && <Text style={{ color: colors.error, fontSize: 12 }}>{errors.device_category}</Text>}
                          {form.device_category === "Other / Custom" && <Field label="Custom Category *" value={form.custom_device_category} onChange={(v) => set("custom_device_category", v)} testID="wiz-custom-device-category" error={errors.custom_device_category} placeholder="Printer, Camera, Earbuds" />}
                        </View>
                      )}
                      {!wizard && (
                        <View>
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Category *</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{[...productCategories, "Other / Custom"].map((category) => <Chip key={category} label={category} active={form.device_category === category} onPress={() => setForm((f) => ({ ...f, device_category: category, custom_device_category: category === "Other / Custom" ? f.custom_device_category : "", shop_product_id: "" }))} />)}</View>
                          {form.device_category === "Other / Custom" && <Field label="Custom Category *" value={form.custom_device_category} onChange={(v) => set("custom_device_category", v)} testID="quick-service-custom-category" />}
                        </View>
                      )}
                      <Field label="Device / Product name *" value={form.product} onChange={(v) => set("product", v)} testID="svc-product" error={errors.product} placeholder="e.g. iPhone 13, Samsung A15, Laptop" />
                      {form.product_source === "shop" && <Field label="Pick from category inventory" value={productQuery} onChange={setProductQuery} testID="svc-product-search" />}
                      {productHits.map((p: any) => (
                        <Pressable key={p.id} onPress={() => { const cat = String(p.category || ""); setForm((f) => ({ ...f, product: p.name, shop_product_id: p.id, product_source: "shop", device_category: wizard ? (productCategories.includes(cat) ? cat : "Other / Custom") : cat, custom_device_category: wizard && !productCategories.includes(cat) ? cat : "", brand: p.brand || f.brand || "", model: p.model || f.model || "", imei1: p.imei1 || f.imei1, imei2: p.imei2 || f.imei2 })); setProductQuery(""); }} style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                          <Text style={{ color: colors.onSurface }}>{p.name} · {p.product_code || p.barcode || ""}</Text>
                        </Pressable>
                      ))}
                      {(wizard || !wizard) && (
                        <View>
                          <Field label="Brand" value={form.brand} onChange={(v) => set("brand", v)} testID={wizard ? "wiz-brand" : "quick-service-brand"} />
                          <Field label="Model number" value={form.model} onChange={(v) => set("model", v)} testID="wiz-model" />
                        </View>
                      )}
                      <Field label="IMEI / Serial number" value={form.imei1} onChange={(v) => set("imei1", v)} testID="wiz-imei1" error={errors.imei1} />
                      <Field label="IMEI 2 (dual-SIM)" value={form.imei2} onChange={(v) => set("imei2", v)} testID="wiz-imei2" error={errors.imei2} />
                      {wizard && (
                        <View>
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Device lock</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                            {LOCK_TYPES.map((t) => <Chip key={t} label={t} active={(form.lock_type || "None") === t} onPress={() => setForm((f) => ({ ...f, lock_type: t, lock_value: t === "None" ? "" : f.lock_value }))} />)}
                          </View>
                          {form.lock_type && form.lock_type !== "None" && <Field label={form.lock_type === "Pattern" ? "Pattern (describe the dots)" : `${form.lock_type} / unlock detail`} value={form.lock_value} onChange={(v) => set("lock_value", v)} secure testID="wiz-lock-value" />}
                          <Text style={{ color: colors.muted, fontSize: 11, marginTop: 6 }}>Lock details are for the technician only — never shown in lists, reports or the job sheet.</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {(!wizard || stepId === "problem") && (
                    <View>
                      <Field label={wizard ? "Problem / Complaint *" : "Service description"} value={wizard ? form.issue : form.service_description} onChange={(v) => set(wizard ? "issue" : "service_description", v)} multiline testID="wiz-issue" error={errors.issue} />
                      {wizard && (
                        <View>
                          <Field label="Customer description (in their words)" value={form.customer_description} onChange={(v) => set("customer_description", v)} multiline />
                          <Field label="Device condition (scratches, dents…)" value={form.device_condition} onChange={(v) => set("device_condition", v)} multiline />
                          <Field label="Technician notes (internal)" value={form.technician_notes} onChange={(v) => set("technician_notes", v)} multiline />
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Priority</Text>
                          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{PRIORITIES.map((p) => <Chip key={p} label={p} active={form.priority === p} onPress={() => set("priority", p)} />)}</View>
                        </View>
                      )}
                    </View>
                  )}

                  {(!wizard || stepId === "service") && (
                    <View>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Service type</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{SERVICE_TYPES.map((t) => <Chip key={t} label={t} active={form.service_type === t} onPress={() => setForm((f) => ({ ...f, service_type: t, custom_service_type: t === "Custom" ? f.custom_service_type : "" }))} />)}</View>
                      {form.service_type === "Custom" && <Field label="Custom service type *" value={form.custom_service_type} onChange={(v) => set("custom_service_type", v)} error={errors.custom_service_type} />}
                      {wizard && <Field label="Estimated / service charge (₹)" value={form.service_charge} onChange={(v) => set("service_charge", v)} kb="decimal-pad" testID="wiz-service-charge" error={errors.service_charge} />}
                      {wizard && (
                        <View>
                          <View style={{ flexDirection: "row", marginTop: 12 }}><Chip label={form.has_estimate ? "✓ Expected delivery date" : "Set expected delivery date"} active={!!form.has_estimate} onPress={() => set("has_estimate", !form.has_estimate)} /></View>
                          {form.has_estimate && <Field label="Expected delivery (YYYY-MM-DD)" value={form.estimated_date} onChange={(v) => set("estimated_date", v)} error={errors.estimated_date} />}
                        </View>
                      )}
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginTop: 12, marginBottom: 6 }}>Warranty</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>{WARRANTY_OPTIONS.map((t) => <Chip key={t} label={t} active={form.warranty_type === t} onPress={() => set("warranty_type", t)} />)}</View>
                      {form.warranty_type === "Custom" && <Field label="Custom warranty *" value={form.warranty_custom} onChange={(v) => set("warranty_custom", v)} error={errors.warranty_custom} />}
                      <Field label="Warranty description (customer-visible)" value={form.warranty_description} onChange={(v) => set("warranty_description", v)} multiline />
                      {ItemsBlock}
                      {PaymentBlock}
                    </View>
                  )}

                  {wizard && stepId === "review" && (
                    <View>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 4 }}>ACCESSORIES RECEIVED</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
                        {ACCESSORY_PRESETS.map((n) => {
                          const on = (form.accessories_selected || []).includes(n);
                          return <Chip key={n} label={`${on ? "✓ " : ""}${n}`} active={on} onPress={() => setForm((f) => ({ ...f, accessories_selected: on ? f.accessories_selected.filter((x: string) => x !== n) : [...(f.accessories_selected || []), n] }))} />;
                        })}
                      </View>
                      <Field label="Other accessories (comma separated)" value={form.accessories_custom} onChange={(v) => set("accessories_custom", v)} />
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 16 }}>REVIEW</Text>
                      {review.map((r) => (
                        <View key={r.label} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                          <Text style={{ color: colors.muted }}>{r.label}</Text>
                          <Text style={{ color: colors.onSurface, flex: 1, textAlign: "right", marginLeft: 12 }}>{r.value}</Text>
                        </View>
                      ))}
                      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>{accessoriesText(form.accessories_selected, form.accessories_custom).length} accessories noted.</Text>
                    </View>
                  )}

                  {/* ---- navigation ---- */}
                  <View style={{ flexDirection: "row", gap: 10, marginTop: 24 }}>
                    {wizard && step > 0 && <Pressable testID="wiz-back" onPress={() => { setErrors({}); setStep((s) => Math.max(0, s - 1)); }} style={{ flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.onSurface, textAlign: "center", fontWeight: "700" }}>Back</Text></Pressable>}
                    {wizard && stepId !== "review" ? (
                      <Pressable testID="wiz-next" onPress={next} style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: colors.brand }}><Text style={{ color: colors.onBrandPrimary, textAlign: "center", fontWeight: "700" }}>Next</Text></Pressable>
                    ) : (
                      <Pressable testID="wiz-submit" onPress={submit} disabled={saving} style={{ flex: 2, padding: 14, borderRadius: 12, backgroundColor: colors.brand, opacity: saving ? 0.6 : 1 }}><Text style={{ color: colors.onBrandPrimary, textAlign: "center", fontWeight: "700" }}>{saving ? "Saving…" : wizard ? "Create Service Ticket" : "Save Quick Bill"}</Text></Pressable>
                    )}
                  </View>
                </View>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ------------------------------------------------------------- detail / status */}
      <Modal visible={!!detail} animationType="slide" onRequestClose={() => setDetail(null)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          {detail && (
            <ScrollView contentContainerStyle={{ padding: 20, gap: 8 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>{detail.service_no || detail.id}</Text>
                <Pressable onPress={() => setDetail(null)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
              </View>
              <Text style={{ color: colors.onSurface }}>{detail.customer_name ?? detail.customerName} · {detail.customer_phone ?? detail.customerPhone}</Text>
              <Text style={{ color: colors.muted }}>{detail.product}{detail.received_by_name ? ` · received by ${detail.received_by_name}` : ""}</Text>
              {!!detail.device_category && <Text style={{ color: colors.muted }}>Category: {detail.device_category}</Text>}
              <Text style={{ color: colors.muted }}>{detail.issue ?? detail.complaint ?? ""}</Text>
              <Text style={{ color: colors.brand, fontWeight: "700" }}>{formatINR(Number(detail.total ?? detail.price ?? 0))}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 12 }}>STATUS</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {SERVICE_STATUSES.map((st) => (
                  <Chip key={st} label={st} active={detail.status === st} onPress={async () => {
                    try { await updateServiceFields(detail.id, { status: st }, shops); setDetail({ ...detail, status: st }); } catch (e: any) { Alert.alert("Status not updated", e?.message || "Try again."); }
                  }} />
                ))}
              </View>
              <PrimaryButton label="Share receipt (PDF)" onPress={() => shareReceipt(detail).catch((e) => Alert.alert("Receipt", e?.message))} gradient={gradients.brand} style={{ marginTop: 12 }} />
              <PrimaryButton label="Send on WhatsApp" onPress={() => whatsApp(detail)} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
      <Modal visible={partScanOpen} animationType="slide" onRequestClose={() => setPartScanOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 }}>
            <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700" }}>Scan Product</Text>
            <Pressable testID="svc-scan-close" onPress={() => setPartScanOpen(false)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
          </View>
          <View style={{ flex: 1, margin: 16, overflow: "hidden", borderRadius: 16 }}>
            <CameraView testID="svc-product-camera" style={{ flex: 1 }} facing="back" onBarcodeScanned={scanPart} barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"] }} />
          </View>
          <Text style={{ color: colors.muted, textAlign: "center", padding: 18 }}>Point the camera at a product barcode or QR code.</Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
