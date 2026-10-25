import { BrandLoader } from "@/src/components/Brand";
import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, FlatList, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useTheme } from "../../src/theme/theme";
import { formatINR } from "../../src/utils/format";
import { useAppStore } from "../../src/store/shop";
import { branches, type Invoice, useMockStore } from "../../src/store/mock-data";
import { useAuthStore } from "../../src/services/auth";


import { createInvoicePdf, uploadInvoicePdf } from "../../src/services/invoice-storage";
import { calculateInvoice, calculatePaymentState, validateCoupon } from "../../src/services/invoice-calculations";
import { GlassCard, Card, PrimaryButton, EmptyState, StatusBadge } from "../../src/components/ui";
import CustomerPhoneLookup from "../../src/components/CustomerPhoneLookup";
import { computeTotals, maxDiscountPercent } from "../../src/domain/billing.ts";
import { PAY_METHODS, paymentState, secondaryRemainder, validateCheckout, type PayMethod } from "../../src/domain/payments.ts";
import { discountLimit } from "../../src/domain/pricing.ts";
import { findProductByCode, searchProducts } from "../../src/domain/productCodes.ts";
import { branchLabel } from "../../src/domain/listTools.ts";
import { updateShopRecord, completeSale, createShopRecord } from "../../src/services/repository";
import { useBusiness } from "../../src/services/business";

/** Product -> cart line (web parity: price/GST + Maximum Allowed Discount cap; applied discount starts at 0). */
const cartLine = (p: any) => ({
  product_id: p.id, name: p.name, price: Number(p.price ?? p.selling_price ?? 0), quantity: 0, gst: Number(p.gst || 0), cost_price: Number(p.cost ?? p.cost_price ?? 0),
  discount: 0, max_discount_type: p.max_discount_type, max_discount_value: p.max_discount_value ?? p.discount ?? 0, stock: Number(p.stock || 0), sku: p.product_code || p.sku || "",
});

export default function POS() {
  const { colors, radius, spacing, gradients, shadows } = useTheme();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { shopId, cart, addToCart, updateQty, setDiscount, clearCart, selectedCustomer, setCustomer } = useAppStore();
  const role = useBusiness((b) => b.access?.role) || "STAFF";
  const shops = useMockStore((m) => m.shops);
  const mockProducts = useMockStore((s) => s.products);
  const mockCustomers = useMockStore((s) => s.customers);
  const coupons = useMockStore((s) => s.coupons);
    const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [payment, setPayment] = useState<PayMethod>("Cash");
  const [phonePending, setPhonePending] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [description, setDescription] = useState("");
  const operationId = React.useRef<string | null>(null);
  const [cash, setCash] = useState("");
  const flushRef = React.useRef<(() => Promise<any>) | null>(null);
  const [showSuccess, setShowSuccess] = useState<any>(null);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponError, setCouponError] = useState("");
  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const openScanner = async () => {
    if (!cameraPermission?.granted) { const result = await requestCameraPermission(); if (!result.granted) { setCouponError("Camera permission is required to scan barcodes."); return; } }
    setScanLocked(false); setScannerOpen(true);
  };
  const onBarcode = ({ data }: { data: string }) => {
    if (scanLocked) return; setScanLocked(true);
    const product = findProductByCode(mockProducts.filter((p) => p.shop_id === shopId), data);
    if (!product) { setCouponError("Product not found"); setScannerOpen(false); return; }
    if (product.stock <= 0) { setCouponError("This product is out of stock"); setScannerOpen(false); return; }
    addToCart(cartLine(product));
    setCouponError(""); setScannerOpen(false);
  };

  useEffect(() => {
    if (!shopId) return;
    setProducts(
      searchProducts(mockProducts.filter(
        (p) =>
          (shopId === "all" || p.shop_id === shopId)
      ), search)
    );
    setLoading(false);
  }, [shopId, search, mockProducts]);

  const billItems = useMemo(() => cart.map(item => { const product = mockProducts.find(candidate => candidate.id === item.product_id); return { ...item, category: product?.category, subcategory: product?.subcategory }; }), [cart, mockProducts]);
  // Coupon eligibility (branch / category) keeps the existing mobile rules; the figures then flow through the
  // SAME totals function as the web app so a sale books identically on both.
  const couponAmount = useMemo(() => (appliedCoupon ? calculateInvoice(billItems, appliedCoupon).couponDiscount : 0), [billItems, appliedCoupon]);
  const cartLines = useMemo(() => cart.map((c) => ({ ...c, qty: c.quantity, discount: c.discount || 0 })), [cart]);
  const web = useMemo(() => computeTotals(cartLines, { coupon: appliedCoupon ? { discountType: "fixed", discount: couponAmount } : null }), [cartLines, appliedCoupon, couponAmount]);
  const totals = useMemo(() => ({ ...web, total: web.grandTotal, gst: web.tax }), [web]);
  const cashEff = payment === "Cash" ? web.grandTotal : Number(cash || 0);
  const pay = useMemo(() => paymentState(web.grandTotal, payment, cashEff, secondaryRemainder(web.grandTotal, payment, cashEff)), [web.grandTotal, payment, cashEff]);
  const isOwnerRole = ["OWNER", "ADMIN"].includes(role);
  const capPct = (c: any) => maxDiscountPercent(Number(c.price) || 0, discountLimit(c));
  const excessDiscount = cart.some((c) => (Number(c.price) * Number(c.discount || 0)) / 100 > discountLimit(c) + 0.005);
  const discountBlocked = excessDiscount && (!isOwnerRole || !overrideReason.trim());
  const setLineDiscount = (c: any, raw: string) => {
    let v = raw === "" ? 0 : Math.min(100, Math.max(0, Number(raw) || 0));
    const cap = capPct(c);
    if (v > cap && !isOwnerRole) { setCouponError(`Maximum allowed discount for ${c.name} is ${cap}%`); v = cap; } else setCouponError("");
    setDiscount(c.product_id, v);
  };

  const cartCount = cart.reduce((a, c) => a + c.quantity, 0);

  const openCustomers = async () => {
    setShowCustomer(true);
    setCustomers(mockCustomers.filter((c) => shopId === "all" || c.shop_id === shopId));
  };
  const applyCoupon = () => {
    const coupon = coupons.find(c => c.code === couponCode.trim().toUpperCase());
    if (!coupon) { setCouponError("Invalid coupon"); return; }
    const reason = validateCoupon(coupon, billItems, shopId);
    if (reason) { setCouponError(reason); return; }
    setAppliedCoupon(coupon); setCouponError("");
  };
  // Sanitize for Firestore - remove undefined, NaN, invalid values
  const sanitizeForFirestore = (obj: any): any => {
    if (obj === null || obj === undefined) return null;
    if (typeof obj === "number" && !Number.isFinite(obj)) return null;
    if (typeof obj === "function") return null;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) {
      return obj.map(sanitizeForFirestore).filter(v => v !== null && v !== undefined);
    }
    if (typeof obj === "object") {
      const sanitized: any = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          if (value === null || value === undefined) continue;
          if (typeof value === "function") continue;
          if (typeof value === "number" && !Number.isFinite(value)) continue;
          if (value instanceof Date) {
            sanitized[key] = value.toISOString();
          } else if (typeof value === "object") {
            sanitized[key] = sanitizeForFirestore(value);
          } else {
            sanitized[key] = value;
          }
        }
      }
      return sanitized;
    }
    return obj;
  };

  const generateInvoice = async () => {
    if (!cart.length) { setCouponError("Add at least one item before generating a bill."); return; }
    if (!user?.uid) { setCouponError("Your sign-in session expired. Please sign in again."); return; }
    if (generatingInvoice) return;
    setGeneratingInvoice(true);
    // A new customer typed in the phone-first section is saved + selected automatically first.
    let customerForSale: any = selectedCustomer;
    if (phonePending) {
      const flushed = await flushRef.current?.();
      if (flushed?.error) { setCouponError(flushed.error); setGeneratingInvoice(false); return; }
      if (flushed?.customer) { customerForSale = flushed.customer; setCustomer(flushed.customer); }
    }
    const validation = validateCheckout(cartLines.map((c) => ({ qty: c.quantity, stock: c.stock ?? Infinity, price: c.price, discount: c.discount })), pay, customerForSale);
    if (validation) { setCouponError(validation); setGeneratingInvoice(false); return; }
    const branch = shops.find((b: any) => b.id === shopId);
    if (!operationId.current) operationId.current = `inv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    let inv: Invoice;
    try {
      const sale = sanitizeForFirestore({
        operation_id: operationId.current,
        ...pay,
        branch_name: branchLabel(branch) || branch?.name || "",
        shop_name: branchLabel(branch) || branch?.name || "",
        description: description.trim() || null,
        discount_override: excessDiscount ? { override_user: user.uid, override_reason: overrideReason, requested_discount: web.totalDiscount, applied_discount: web.totalDiscount } : null,
        items: cart.map((c) => ({ productId: c.product_id, name: c.name, sku: c.sku || null, price: c.price, qty: c.quantity, gst: c.gst, discount: c.discount || 0, hsn: null })),
        ...web,
        subtotal: web.subtotal,
        gst: web.tax,
        couponCode: appliedCoupon?.code || null,
        coupon_code: appliedCoupon?.code || null,
        paymentMethod: payment,
        paymentBreakdown: pay.paymentBreakdown,
        payment_breakdown: pay.paymentBreakdown,
        paidAmount: pay.paidAmount,
        pendingAmount: pay.pendingAmount,
        balance: pay.pendingAmount,
        status: pay.status,
        businessName: "ALL IN ONE HUB",
        createdAt: new Date().toISOString(),
      });
      // Invoice, inventory, sales, payments, customer ledger and Pay Later due commit atomically, with the
      // per-branch invoice counter (e.g. PON-2026-000123) â€” identical to a web sale.
      const saved = await completeSale(sale, customerForSale, appliedCoupon, shops);
      inv = { ...(saved as any), invoice_number: saved.invoice_number || saved.invoiceNumber, total: saved.total ?? saved.grandTotal, status: saved.paymentStatus || saved.status } as Invoice;
      try {
        const local_file_uri = await createInvoicePdf(inv);
        const businessId = useBusiness.getState().businessId || user.uid;
        const uploaded = await uploadInvoicePdf(businessId, inv, local_file_uri);
        await updateShopRecord("invoices", inv.id, { local_file_uri, storage_path: uploaded.path, storage_url: uploaded.downloadUrl, documentUrl: uploaded.downloadUrl, storagePath: uploaded.path });
      } catch (attachmentError) {
        // The committed sale stays correct; the PDF can be regenerated from the invoice screen.
        console.warn("Invoice attachment was not stored", attachmentError);
      }
    } catch (error: any) {
      setCouponError("The bill was not completed. No stock, customer, payment, or sale update was applied. " + (error?.message || "Please retry."));
      setGeneratingInvoice(false);
      return;
    }
    // Same dashboard notification the web app writes after a sale (best-effort).
    createShopRecord("notifications", { type: "sale", title: "New sale completed", message: `${inv.invoice_number} Â· ${formatINR(Number((inv as any).total || 0))}`, read: false }, shops).catch(() => undefined);
    setShowSuccess(inv);
    setShowCart(false);
    clearCart();
    setCash(""); setDescription(""); setOverrideReason(""); setPhonePending(false);
    operationId.current = null;
    setPayment("Cash");
    setAppliedCoupon(null); setCouponCode("");
    setGeneratingInvoice(false);
  };

  if (!shopId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: colors.onSurface }}>Please select a shop</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header with gradient overlay */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: "600" }}>POS TERMINAL</Text>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700", marginTop: 4 }}>New Invoice</Text>
          </View>
          <Pressable
            testID="scan-btn"
            onPress={openScanner}
            style={({ pressed }) => ({
              backgroundColor: colors.surfaceTertiary,
              padding: 12,
              borderRadius: 14,
              opacity: pressed ? 0.8 : 1,
              ...shadows.sm,
            })}
          >
            <Ionicons name="scan" size={22} color={colors.brand} />
          </Pressable>
        </View>

        {/* Premium search bar */}
        <View
          style={{
            marginTop: 16,
            backgroundColor: colors.glassLight,
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 52,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.sm,
          }}
        >
          <Ionicons name="search" size={20} color={colors.brand} />
          <TextInput
            testID="pos-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search product, SKU, barcode..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, marginLeft: 12, color: colors.onSurface, fontSize: 15, fontWeight: "500" }}
          />
        </View>

        {/* Customer picker (Premium glass) */}
        <Pressable
          testID="customer-select"
          onPress={openCustomers}
          style={({ pressed }) => ({
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 14,
            backgroundColor: colors.glassMedium,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.glassBorder,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.99 : 1 }],
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: colors.brand,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </View>
            <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "600" }}>
              {selectedCustomer?.name || "Walk-in Customer"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </Pressable>
      </View>

      {/* Product list */}
      {loading ? (
        <BrandLoader style={{ marginTop: 40 }} color={colors.brand} size="large" />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 140 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => {
            const stockStatus = item.stock === 0 ? "out_stock" : item.stock <= item.min_stock ? "low_stock" : "in_stock";
            const isOut = item.stock === 0;
            return (
              <Pressable
                testID={`product-${item.id}`}
                onPress={() =>
                  item.stock > 0 &&
                  addToCart(cartLine(item))
                }
                style={({ pressed }) => ({
                  transform: [{ scale: pressed && !isOut ? 0.98 : 1 }],
                  opacity: isOut ? 0.5 : pressed ? 0.9 : 1,
                })}
              >
                <GlassCard style={{ padding: 12, flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View
                    style={{
                      width: 50,
                      height: 50,
                      borderRadius: 12,
                      backgroundColor: item.tint ? item.tint + "20" : colors.brand + "20",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Ionicons
                      name={item.icon || (item.is_accessory ? "hardware-chip" : "phone-portrait")}
                      size={24}
                      color={item.tint || colors.brand}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "500" }}>{item.sku}</Text>
                      <StatusBadge status={stockStatus} />
                    </View>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>
                      {formatINR(Number(item.price ?? item.selling_price ?? 0))}
                    </Text>
                    {!isOut && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 }}>
                        <Ionicons name="add-circle" size={18} color={colors.brand} />
                        <Text style={{ color: colors.brand, fontSize: 11, fontWeight: "600" }}>Add</Text>
                      </View>
                    )}
                  </View>
                </GlassCard>
              </Pressable>
            );
          }}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="No products" message="Try a different search" />}
        />
      )}

      {/* Floating cart CTA */}
      {cart.length > 0 && (
        <View style={{ position: "absolute", bottom: 20, left: 20, right: 20 }}>
          <Pressable
            testID="floating-cart"
            onPress={() => setShowCart(true)}
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
              borderRadius: 18,
              padding: 16,
              backgroundColor: colors.brand,
              flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                ...shadows.lg,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>{cartCount}</Text>
                </View>
                <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>View Cart</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 18, fontWeight: "700" }}>{formatINR(totals.total)}</Text>
                <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
              </View>
            </View>
          </Pressable>
        </View>
      )}

      {/* Cart Modal */}
      <Modal visible={showCart} animationType="slide" transparent onRequestClose={() => setShowCart(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "90%",
              ...shadows.xl,
            }}
          >
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Review Invoice</Text>
                <Pressable
                  testID="close-cart"
                  onPress={() => setShowCart(false)}
                  style={{ backgroundColor: colors.surfaceTertiary, padding: 6, borderRadius: 20 }}
                >
                  <Ionicons name="close" size={22} color={colors.onSurface} />
                </Pressable>
              </View>

              {cart.map((item) => (
                <View
                  key={item.product_id}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.divider,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                      {formatINR(item.price)} Ã— {item.quantity}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <Text style={{ color: colors.muted, fontSize: 11 }}>Discount %</Text>
                      <TextInput testID={`pos-discount-${item.product_id}`} value={item.discount ? String(item.discount) : ""} onChangeText={(v) => setLineDiscount(item, v)} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={colors.muted} style={{ width: 56, padding: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, textAlign: "center" }} />
                      <Text testID={`pos-discount-max-${item.product_id}`} style={{ color: colors.muted, fontSize: 11 }}>Max {capPct(item)}%</Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      backgroundColor: colors.surfaceTertiary,
                      borderRadius: 10,
                      padding: 4,
                    }}
                  >
                    <Pressable
                      testID={`qty-dec-${item.product_id}`}
                      onPress={() => updateQty(item.product_id, item.quantity - 1)}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="remove" size={16} color={colors.onSurface} />
                    </Pressable>
                    <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "700", minWidth: 24, textAlign: "center" }}>
                      {item.quantity}
                    </Text>
                    <Pressable
                      testID={`qty-inc-${item.product_id}`}
                      onPress={() => updateQty(item.product_id, item.quantity + 1)}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="add" size={16} color={colors.onSurface} />
                    </Pressable>
                  </View>
                  <Text
                    style={{
                      color: colors.onSurface,
                      fontSize: 15,
                      fontWeight: "700",
                      marginLeft: 16,
                      minWidth: 80,
                      textAlign: "right",
                    }}
                  >
                    {formatINR(item.price * item.quantity * (1 - (item.discount || 0) / 100))}
                  </Text>
                </View>
              ))}

              <View style={{ marginTop: 16 }}>
                <CustomerPhoneLookup customer={selectedCustomer} onSelect={(c) => setCustomer(c)} onPending={setPhonePending} flushRef={flushRef} testIDPrefix="pos-customer" />
                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                  <Pressable testID="walk-in-customer" onPress={openCustomers} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceTertiary }}><Text style={{ color: colors.onSurface, fontWeight: "600", textAlign: "center" }}>Pick from list</Text></Pressable>
                  <Pressable testID="clear-customer" onPress={() => setCustomer(null)} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: colors.surfaceTertiary }}><Text style={{ color: colors.onSurface, fontWeight: "600", textAlign: "center" }}>Walk-in</Text></Pressable>
                </View>
              </View>
              {selectedCustomer && <Text style={{ color: colors.muted, marginTop: 8, fontSize: 12 }}>Bill customer: {selectedCustomer.name} Â· {selectedCustomer.phone}</Text>}
              <View style={{ gap: 10 }}>
                {!appliedCoupon ? (
                  <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                    <TextInput
                      testID="coupon-code"
                      value={couponCode}
                      onChangeText={setCouponCode}
                      placeholder="Coupon code"
                      placeholderTextColor={colors.muted}
                      autoCapitalize="characters"
                      style={{
                        flex: 1,
                        backgroundColor: colors.surfaceSecondary,
                        borderRadius: 12,
                        padding: 12,
                        color: colors.onSurface,
                        borderWidth: 1,
                        borderColor: colors.border,
                      }}
                    />
                    <Pressable
                      testID="apply-coupon"
                      onPress={applyCoupon}
                      style={{ padding: 12, borderRadius: 12, backgroundColor: colors.brand }}
                    >
                      <Text style={{ color: "#FFFFFF", fontWeight: "700" }}>Apply</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: 14,
                      backgroundColor: colors.successBg,
                      borderRadius: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: colors.success,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.success, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>COUPON APPLIED</Text>
                      <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "700", marginTop: 4 }}>
                        {appliedCoupon.code}
                      </Text>
                    </View>
                    <Pressable
                      testID="remove-coupon"
                      onPress={() => {
                        setAppliedCoupon(null);
                        setCouponCode("");
                        setCouponError("");
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        backgroundColor: colors.success,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 12 }}>Remove</Text>
                    </Pressable>
                  </View>
                )}
                {!!couponError && (
                  <View
                    style={{
                      padding: 12,
                      backgroundColor: colors.errorBg,
                      borderRadius: 10,
                      borderLeftWidth: 4,
                      borderLeftColor: colors.error,
                    }}
                  >
                    <Text style={{ color: colors.error, fontSize: 12, fontWeight: "600" }}>{couponError}</Text>
                    <Pressable
                      testID="skip-coupon"
                      onPress={() => {
                        setCouponCode("");
                        setCouponError("");
                        setAppliedCoupon(null);
                      }}
                      style={{ marginTop: 8 }}
                    >
                      <Text style={{ color: colors.error, fontSize: 12, fontWeight: "700" }}>Skip Coupon â†’</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              <GlassCard style={{ marginTop: 12, backgroundColor: "rgba(99, 102, 241, 0.05)" }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>Taxable Amount</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "600" }}>{formatINR(totals.taxable)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>GST</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "600" }}>{formatINR(totals.gst)}</Text>
                </View>
                {appliedCoupon && <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}><Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>Coupon Discount Â· {appliedCoupon.code}</Text><Text style={{ color: colors.success, fontSize: 13, fontWeight: "700" }}>âˆ’{formatINR(totals.couponDiscount)}</Text></View>}
                {totals.itemDiscount > 0 && <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}><Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>Applied discount</Text><Text style={{ color: colors.success, fontSize: 13, fontWeight: "600" }}>-{formatINR(totals.itemDiscount)}</Text></View>}
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 10 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "600" }}>Grand Total</Text>
                  <Text style={{ color: colors.brand, fontSize: 20, fontWeight: "700" }}>{formatINR(totals.total)}</Text>
                </View>
              </GlassCard>

              {excessDiscount && (
                <View style={{ marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: colors.errorBg }}>
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: "700" }}>{"Discount exceeds the product's Maximum Allowed Discount."}</Text>
                  {isOwnerRole ? (
                    <TextInput testID="override-reason" value={overrideReason} onChangeText={setOverrideReason} placeholder="Owner override reason (required)" placeholderTextColor={colors.muted} style={{ marginTop: 8, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, color: colors.onSurface }} />
                  ) : <Text style={{ color: colors.error, fontSize: 12, marginTop: 4 }}>Only the owner can override. Reduce the discount.</Text>}
                </View>
              )}
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 20, marginBottom: 10, letterSpacing: 0.8, fontWeight: "600" }}>
                PAYMENT METHOD
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                {PAY_METHODS.map((m) => {
                  const selected = payment === m;
                  return (
                    <Pressable key={m} testID={`pay-${m}`} onPress={() => setPayment(m)} style={{ flex: 1, minWidth: 100 }}>
                      {selected ? (
                        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 12, padding: 12, alignItems: "center", ...shadows.md }}>
                          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>{m.toUpperCase()}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={{ borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, alignItems: "center" }}>
                          <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "600" }}>{m.toUpperCase()}</Text>
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>
              {payment !== "Cash" && (
                <View style={{ marginTop: 14 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 8 }}>Cash received now (â‚¹)</Text>
                  <TextInput testID="cash-amount" value={cash} onChangeText={setCash} placeholder="0" placeholderTextColor={colors.muted} keyboardType="decimal-pad" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 16, fontWeight: "600" }} />
                  <Text testID="pay-remainder" style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>{payment} (auto-calculated remainder): {formatINR(secondaryRemainder(web.grandTotal, payment, cashEff))}</Text>
                </View>
              )}
              {!pay.valid && web.grandTotal > 0 && <Text style={{ color: colors.error, fontSize: 12, marginTop: 8 }}>Payment must equal the bill total.</Text>}
              {pay.pay_later_amount > 0 && !selectedCustomer && <Text style={{ color: colors.error, fontSize: 12, marginTop: 8 }}>Select a customer for Pay Later.</Text>}
              <TextInput testID="bill-description" value={description} onChangeText={setDescription} placeholder="Bill description (optional, shown to customer)" placeholderTextColor={colors.muted} style={{ marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.onSurface }} />

              <PrimaryButton
                testID="generate-invoice"
                label={generatingInvoice ? "Generatingâ€¦" : `Generate Invoice Â· ${formatINR(totals.total)}`}
                onPress={generateInvoice}
                disabled={generatingInvoice || phonePending && !selectedCustomer || discountBlocked || (pay.pay_later_amount > 0 && !selectedCustomer) || !pay.valid}
                gradient={gradients.brand}
                style={{ marginTop: 24 }}
              />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <CameraView style={{ flex: 1 }} barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "code128", "code39", "upc_a", "upc_e"] }} onBarcodeScanned={onBarcode} />
          <Pressable onPress={() => setScannerOpen(false)} style={{ position: "absolute", top: 55, right: 20, padding: 12, borderRadius: 22, backgroundColor: "#0009" }}><Ionicons name="close" size={24} color="#fff" /></Pressable>
          <Text style={{ position: "absolute", bottom: 48, alignSelf: "center", color: "#fff", fontWeight: "700" }}>Point the camera at a product barcode</Text>
        </View>
      </Modal>

      {/* Customer picker Modal */}
      <Modal visible={showCustomer} animationType="slide" transparent onRequestClose={() => setShowCustomer(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15, 23, 42, 0.4)", justifyContent: "flex-end" }}>
          <View
            style={{
              backgroundColor: colors.surface,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              maxHeight: "80%",
              ...shadows.xl,
            }}
          >
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 }}>
              <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700" }}>Select Customer</Text>
              <Pressable
                testID="close-customer"
                onPress={() => setShowCustomer(false)}
                style={{ backgroundColor: colors.surfaceTertiary, padding: 6, borderRadius: 20 }}
              >
                <Ionicons name="close" size={22} color={colors.onSurface} />
              </Pressable>
            </View>
            <Pressable
              testID="walkin"
              onPress={() => {
                setCustomer(null);
                setShowCustomer(false);
              }}
              style={{
                padding: 16,
                marginHorizontal: 20,
                borderRadius: 14,
                backgroundColor: colors.surfaceTertiary,
                marginBottom: 10,
              }}
            >
              <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "600" }}>Walk-in Customer</Text>
            </Pressable>
            <FlatList
              data={customers}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ padding: 20, paddingTop: 4 }}
              renderItem={({ item }) => (
                <Pressable
                  testID={`customer-${item.id}`}
                  onPress={() => {
                    setCustomer(item);
                    setShowCustomer(false);
                  }}
                  style={{
                    padding: 14,
                    borderRadius: 14,
                    backgroundColor: colors.surfaceSecondary,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: colors.border,
                  }}
                >
                  <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "600" }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{item.phone}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Success Modal with confetti/glow */}
      <Modal visible={!!showSuccess} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <LinearGradient
            colors={[colors.successBg, colors.surface]}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: "#ECFDF5",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 24,
                ...shadows.glow(colors.success),
              }}
            >
              <Ionicons name="checkmark-circle" size={80} color={colors.success} />
            </View>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700" }}>Invoice Generated</Text>
            <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6, fontWeight: "500" }}>
              {showSuccess?.invoice_number}
            </Text>

            <GlassCard style={{ padding: 24, paddingHorizontal: 40, marginTop: 32, alignItems: "center", minWidth: 280 }}>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", letterSpacing: 0.8 }}>TOTAL BILL</Text>
              <Text style={{ color: colors.brand, fontSize: 36, fontWeight: "800", marginTop: 8 }}>
                {formatINR(showSuccess?.total || 0)}
              </Text>
              <View style={{ marginTop: 12 }}>
                <StatusBadge status={showSuccess?.status || "paid"} />
              </View>
            </GlassCard>

            <View style={{ flexDirection: "row", gap: 14, marginTop: 40 }}>
              <PrimaryButton
                testID="view-invoice"
                label="View Invoice"
                onPress={() => { const invoiceId=showSuccess?.id; setShowSuccess(null); if(invoiceId) router.push(`/invoice/${invoiceId}` as any); }}
                gradient={gradients.brand}
                style={{ flex: 1, minWidth: 120 }}
              />
              <Pressable
                testID="new-invoice-again"
                onPress={() => setShowSuccess(null)}
                style={({ pressed }) => ({
                  backgroundColor: colors.surfaceTertiary,
                  paddingHorizontal: 24,
                  paddingVertical: 14,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 130,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "600" }}>New Invoice</Text>
              </Pressable>
            </View>
          </LinearGradient>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function isGstinFormat(value: string) {
  return /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(value);
}

