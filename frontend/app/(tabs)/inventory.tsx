import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { formatINR } from "../../src/utils/format";
import { useAppStore } from "../../src/store/shop";
import { useMockStore } from "../../src/store/mock-data";
import { EmptyState, FloatingActionButton, GlassCard, PrimaryButton, StatusBadge } from "../../src/components/ui";
import { ALL, PRODUCT_SORTS, filterProductsByCategory, productCategoryOptions, sortProducts } from "../../src/domain/listTools.ts";
import { CODE_MODE, finalizeCode, searchProducts, selectCodeMode, isMobileCategory, type CodeMode } from "../../src/domain/productCodes.ts";
import { CUSTOM_CATEGORY_SENTINEL, buildCategoryOptions, normalizeCategoryName, resolveCategoryName } from "../../src/domain/categories.ts";
import { GST_RATES, blankProductForm, buildProductPayload, discountErrorOf, formFromProduct, pricingOf, profitOf, validateProductForm, type ProductForm } from "../../src/domain/productForm.ts";
import { findExistingProductByCode, generateUniqueProductCode, saveProductRecord } from "../../src/services/repository";
import { newOperationId } from "../../src/services/neon/client";

type Row = Record<string, any>;


// Module-level (stable identity) so TextInputs keep focus while typing.
const useFormStyles = (colors: any) => ({
  field: { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 13, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15, fontWeight: "500" as const },
  lbl: { color: colors.muted, fontSize: 12, fontWeight: "600" as const, marginBottom: 6, marginTop: 14 },
});
function Chip({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable testID={testID} onPress={onPress} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.brand : colors.border, backgroundColor: active ? colors.brand : "transparent", marginRight: 8, marginBottom: 8 }}>
      <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
function FormInput({ form, setField, label, k, kb = "default", testID, placeholder }: { form: ProductForm; setField: (k: keyof ProductForm, v: any) => void; label: string; k: keyof ProductForm; kb?: any; testID?: string; placeholder?: string }) {
  const { colors } = useTheme();
  const { field, lbl } = useFormStyles(colors);
  return (
    <View>
      <Text style={lbl}>{label}</Text>
      <TextInput testID={testID} value={String(form[k])} onChangeText={(v) => setField(k, v)} keyboardType={kb} placeholder={placeholder || label} placeholderTextColor={colors.muted} style={field} />
    </View>
  );
}
function Card3({ label, value, testID }: { label: string; value: number; testID: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexBasis: "46%", flexGrow: 1, padding: 10, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
      <Text style={{ color: colors.muted, fontSize: 11 }}>{label}</Text>
      <Text testID={testID} style={{ color: colors.onSurface, fontWeight: "700", marginTop: 4 }}>{formatINR(value)}</Text>
    </View>
  );
}

export default function Inventory() {
  const { colors, shadows, gradients } = useTheme();
  const { shopId } = useAppStore();
  const products = useMockStore((s) => s.products);
  const registry = useMockStore((s) => s.productCategories);
  const shops = useMockStore((s) => s.shops);
  const deleteProduct = useMockStore((s) => s.deleteProduct);

  const [query, setQuery] = useState("");
  const [sortId, setSortId] = useState(PRODUCT_SORTS[0].id);
  const [category, setCategory] = useState(ALL);
  const [editing, setEditing] = useState<Row | null | undefined>(); // undefined = closed, null = new
  const [form, setForm] = useState<ProductForm>(blankProductForm());
  const [codeMode, setCodeMode] = useState<CodeMode | "">("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const inFlight = useRef(false);
  const generation = useRef(0);
  const saveRequest = useRef<{fingerprint:string;payload:Row;options:Row} | null>(null);
  useEffect(() => { generation.current += 1; saveRequest.current = null; setGenerating(false); setEditing(undefined); }, [shopId]);
  const set = <K extends keyof ProductForm>(k: K, v: ProductForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const branchProducts = useMemo(() => products.filter((p) => shopId === "all" || p.shop_id === shopId), [products, shopId]);
  const categoryChoices = useMemo(() => productCategoryOptions(branchProducts, buildCategoryOptions(registry)), [branchProducts, registry]);
  const rows = useMemo(
    () => sortProducts(filterProductsByCategory(searchProducts(branchProducts, query), category), sortId),
    [branchProducts, query, category, sortId],
  );

  const pricing = pricingOf(form); // recomputed on every render: never stale, no Save needed
  const profit = profitOf(form);
  const discountError = discountErrorOf(form);
  const categoryOptions = useMemo(() => [...buildCategoryOptions(registry, editing ? form.category : null), CUSTOM_CATEGORY_SENTINEL], [registry, editing, form.category]);

  const open = (p?: Row) => {
    generation.current += 1;
    saveRequest.current = null;
    setGenerating(false);
    setEditing(p || null);
    setCodeMode("");
    setForm(p ? formFromProduct(p) : blankProductForm());
  };

  const chooseGenerated = async () => {
    if (generating || inFlight.current) return;
    const request = ++generation.current;
    const next = selectCodeMode(CODE_MODE.GENERATED, { currentMode: codeMode, code: form.product_code });
    setCodeMode(next.mode as CodeMode);
    set("product_code", next.code);
    if (next.code) return Alert.alert("Code stays stable", "This product already has a code. Clear it to re-issue.");
    setGenerating(true);
    try { const code = await generateUniqueProductCode(shops); if(request === generation.current) set("product_code", code); }
    catch { Alert.alert("Could not generate product code. Retry.", "You can retry or enter an existing code manually."); }
    finally { if(request === generation.current) setGenerating(false); }
  };
  const chooseManual = () => {
    generation.current += 1;
    setGenerating(false);
    const next = selectCodeMode(CODE_MODE.MANUAL, { currentMode: codeMode, code: form.product_code });
    setCodeMode(next.mode as CodeMode);
    set("product_code", next.code);
  };

  const save = async () => {
    if (inFlight.current || generating) return;
    const editingId = editing?.id || null;
    const err = validateProductForm(form, { editing: !!editingId, codeMode, products: branchProducts, editingId });
    if (err) return Alert.alert("Check product details", err);
    setBusy(true);
    inFlight.current = true;
    const requestFingerprint = JSON.stringify([shopId,editingId,form]);
    const retrying = saveRequest.current?.fingerprint === requestFingerprint;
    const saveGeneration = generation.current;
    try {
      let code = editingId ? form.product_code : finalizeCode(codeMode, form.product_code);
      if (!code) code = await generateUniqueProductCode(shops);
      if (!editingId && !retrying && codeMode === CODE_MODE.MANUAL) {
        const conflict = await findExistingProductByCode(code, shops);
        if (conflict) return Alert.alert("Product code already exists", `Existing product: ${conflict.name || conflict.id}. Use a different code.`);
      }
      let resolvedCategory = form.category;
      let newCategory: { name: string; normalized_name: string } | null = null;
      if (form.category === CUSTOM_CATEGORY_SENTINEL) {
        const resolved = resolveCategoryName(form.custom_category, registry);
        resolvedCategory = resolved.name;
        if (!resolved.existing) newCategory = { name: resolved.name, normalized_name: normalizeCategoryName(resolved.name) };
      }
      const payload = buildProductPayload(form, code, resolvedCategory);
      const stock = Number(form.stock) || 0;
      const stockEdit = editingId && Number(editing?.stock || 0) !== stock ? stock : null;
      const fingerprint = JSON.stringify([shopId,editingId,form]);
      if (!saveRequest.current || saveRequest.current.fingerprint !== fingerprint) saveRequest.current = {fingerprint,payload,options:{ id: editingId, openingStock: stock, newCategory, stockEdit, expectedStock:Number(editing?.stock || 0),operationId:newOperationId() }};
      if (saveGeneration !== generation.current) throw new Error('Branch or product form changed. Review the details before saving.');
      await saveProductRecord(saveRequest.current.payload, saveRequest.current.options, shops);
      if (saveGeneration !== generation.current) return;
      setEditing(undefined);
      Alert.alert(editingId ? "Product updated" : "Product saved", `${payload.name} · ${code}`);
    } catch (error: any) {
      Alert.alert("Product not saved", error?.message || "Check your internet connection and try again.");
    } finally { setBusy(false); inFlight.current = false; }
  };

  const { field, lbl } = useFormStyles(colors);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ position: "absolute", bottom: 24, right: 24, zIndex: 100 }}>
        <FloatingActionButton icon="add" onPress={() => open()} testID="fab-add-product" />
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 }}>
        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: "600" }}>INVENTORY MANAGEMENT</Text>
        <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700", marginTop: 4 }}>Products Catalog</Text>
        <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>{rows.length} of {branchProducts.length} products</Text>
        <View style={{ marginTop: 14, backgroundColor: colors.glassLight, borderRadius: 14, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, height: 50, borderWidth: 1, borderColor: colors.border, ...shadows.sm }}>
          <Ionicons name="search" size={20} color={colors.brand} />
          <TextInput testID="product-search" value={query} onChangeText={setQuery} placeholder="Search name, code, barcode, IMEI, category…" placeholderTextColor={colors.muted} style={{ flex: 1, marginLeft: 12, color: colors.onSurface, fontSize: 15, fontWeight: "500" }} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          {PRODUCT_SORTS.map((s) => <Chip key={s.id} testID={`sort-${s.id}`} label={s.label} active={sortId === s.id} onPress={() => setSortId(s.id)} />)}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Chip label="All categories" active={category === ALL} onPress={() => setCategory(ALL)} />
          {categoryChoices.map((c) => <Chip key={c} label={c} active={category === c} onPress={() => setCategory(c)} />)}
        </ScrollView>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 20, paddingTop: 8, paddingBottom: 100, gap: 10 }}
        ListEmptyComponent={<EmptyState icon="cube-outline" title="No products found" message="Add your first product or adjust your search" />}
        renderItem={({ item, index }) => {
          const status = item.stock === 0 ? "out_stock" : item.stock <= (item.lowStockAlert ?? item.min_stock ?? 5) ? "low_stock" : "in_stock";
          const price = Number(item.price ?? item.selling_price ?? 0);
          return (
            <Pressable testID={`inv-${item.id}`} onPress={() => open(item)}>
              <GlassCard style={{ padding: 14 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Text style={{ color: colors.muted, width: 26, fontWeight: "700" }}>{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text numberOfLines={2} style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}>{item.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{item.category} · {item.product_code || item.barcode || item.sku || "—"}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                      <StatusBadge status={status} />
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{item.stock} units</Text>
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={{ color: colors.brand, fontSize: 17, fontWeight: "700" }}>{formatINR(price)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>GST {Number(item.gst || 0)}%</Text>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
      />

      <Modal visible={editing !== undefined} transparent animationType="slide" onRequestClose={() => setEditing(undefined)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.4)" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "94%", ...shadows.xl }}>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>{editing ? "Edit Product" : "Add Product"}</Text>
                <Pressable onPress={() => setEditing(undefined)} style={{ backgroundColor: colors.surfaceTertiary, padding: 6, borderRadius: 20 }}>
                  <Ionicons name="close" size={22} color={colors.onSurface} />
                </Pressable>
              </View>

              <FormInput form={form} setField={set} label="Product name *" k="name" testID="product-name" />
              <Text style={lbl}>Category</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {categoryOptions.map((c) => <Chip key={c} label={c} active={form.category === c} onPress={() => set("category", c)} />)}
              </View>
              {form.category === CUSTOM_CATEGORY_SENTINEL && <FormInput form={form} setField={set} label="Custom category name" k="custom_category" testID="product-custom-category" />}
              <FormInput form={form} setField={set} label="Brand" k="brand" />

              {/* Product code: generated once (then immutable) or an existing / manual code */}
              <Text style={lbl}>Product code</Text>
              {editing ? (
                <Text testID="product-code" style={[field, { color: colors.muted }]}>{form.product_code || "—"}</Text>
              ) : (
                <View>
                  <View style={{ flexDirection: "row" }}>
                    <Chip testID="code-generate" label={generating ? "Generating…" : "Generate Code"} active={codeMode === CODE_MODE.GENERATED} onPress={chooseGenerated} />
                    <Chip testID="code-manual" label="Enter Existing Code" active={codeMode === CODE_MODE.MANUAL} onPress={chooseManual} />
                  </View>
                  <TextInput testID="product-code" value={form.product_code} editable={codeMode === CODE_MODE.MANUAL} onChangeText={(v) => set("product_code", v)} placeholder={generating ? "Generating…" : codeMode === CODE_MODE.MANUAL ? "Scan / type the existing code" : "Choose Generate Code or Enter Existing Code"} placeholderTextColor={colors.muted} style={field} />
                </View>
              )}

              <FormInput form={form} setField={set} label="DP / Cost price" k="cost" kb="decimal-pad" testID="product-cost" />
              <FormInput form={form} setField={set} label="MOP / Selling price (excl. GST)" k="price" kb="decimal-pad" testID="product-price" />
              <FormInput form={form} setField={set} label={editing ? "Stock (audited correction)" : "Opening quantity / stock"} k="stock" kb="number-pad" testID="product-stock" />

              <Text style={lbl}>GST %</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {GST_RATES.map((g) => <Chip key={g} testID={`gst-${g}`} label={`${g}%`} active={form.gst === g} onPress={() => set("gst", g)} />)}
              </View>

              {/* Actual product Discount — drives the three cards below LIVE (no Save needed). */}
              <View style={{ marginTop: 14, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{"Discount (applied to this product's price)"}</Text>
                <View style={{ flexDirection: "row", marginTop: 8 }}>
                  <Chip testID="discount-type-percentage" label="Percent" active={form.discount_type === "percentage"} onPress={() => set("discount_type", "percentage")} />
                  <Chip testID="discount-type-fixed" label="Fixed ₹" active={form.discount_type === "fixed"} onPress={() => set("discount_type", "fixed")} />
                </View>
                <TextInput testID="product-discount-value" value={form.discount_value} onChangeText={(v) => set("discount_value", v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={field} />
                {!!discountError && <Text testID="product-discount-error" style={{ color: colors.error, fontSize: 12, marginTop: 6 }}>{discountError}</Text>}
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                  <Card3 label="Basic Amount" value={pricing.basicAmount} testID="card-basic" />
                  <Card3 label="GST Amount" value={pricing.gstAmount} testID="card-gst" />
                  <Card3 label="Price incl. GST" value={pricing.priceInclGst} testID="card-incl" />
                  <Card3 label="Profit" value={profit.profit} testID="card-profit" />
                  <Card3 label="Profit After Discount" value={profit.profitAfterDiscount} testID="card-profit-after-discount" />
                </View>
              </View>

              {/* Maximum Allowed Discount: a checkout CAP only — never changes the cards above. */}
              <Text style={lbl}>Maximum Allowed Discount (checkout limit)</Text>
              <View style={{ flexDirection: "row" }}>
                <Chip label="Percent" active={form.max_discount_type === "percentage"} onPress={() => set("max_discount_type", "percentage")} />
                <Chip label="Fixed ₹" active={form.max_discount_type === "fixed"} onPress={() => set("max_discount_type", "fixed")} />
              </View>
              <TextInput testID="product-max-discount-value" value={form.max_discount_value} onChangeText={(v) => set("max_discount_value", v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={field} />

              <FormInput form={form} setField={set} label="Low stock threshold" k="lowStockAlert" kb="number-pad" />
              <FormInput form={form} setField={set} label="MRP" k="mrp" kb="decimal-pad" />
              <FormInput form={form} setField={set} label="Batch number" k="batch_no" />
              <FormInput form={form} setField={set} label="Manufacturing date (YYYY-MM-DD)" k="mfg_date" />
              <FormInput form={form} setField={set} label="Expiry date (YYYY-MM-DD)" k="expiry_date" />
              {isMobileCategory(form.category) && (<><FormInput form={form} setField={set} label="IMEI 1" k="imei1" kb="number-pad" /><FormInput form={form} setField={set} label="IMEI 2" k="imei2" kb="number-pad" /></>)}
              <FormInput form={form} setField={set} label="Description" k="description" />

              <PrimaryButton testID="product-save" label={busy ? "Saving…" : editing ? "Update Product" : "Save Product"} onPress={save} disabled={busy || generating} gradient={gradients.brand} style={{ marginTop: 24 }} />
              {editing && (
                <Pressable
                  onPress={() => Alert.alert("Delete product?", "This action cannot be undone.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Delete", style: "destructive", onPress: async () => { try { await deleteProduct(editing.id); setEditing(undefined); } catch (e: any) { Alert.alert("Product not deleted", e?.message || "Please try again."); } } },
                  ])}
                  style={{ alignItems: "center", padding: 14, marginTop: 12, backgroundColor: colors.errorBg, borderRadius: 12 }}
                >
                  <Text style={{ color: colors.error, fontWeight: "600", fontSize: 15 }}>Delete Product</Text>
                </Pressable>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
