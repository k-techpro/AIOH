import React, { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, FlatList, ActivityIndicator, Modal, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { formatINR } from "../../src/utils/format";
import { api } from "../../src/api/client";
import { useAppStore } from "../../src/store/shop";
import { Card, PrimaryButton, EmptyState, StatusBadge } from "../../src/components/ui";

export default function POS() {
  const { colors, radius, spacing } = useTheme();
  const router = useRouter();
  const { shopId, cart, addToCart, updateQty, clearCart, selectedCustomer, setCustomer } = useAppStore();
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCart, setShowCart] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [payment, setPayment] = useState<"cash" | "upi" | "card" | "pay_later">("cash");
  const [amountReceived, setAmountReceived] = useState("");
  const [showSuccess, setShowSuccess] = useState<any>(null);

  useEffect(() => {
    if (!shopId) return;
    api.listProducts(shopId, { search }).then(setProducts).finally(() => setLoading(false));
  }, [shopId, search]);

  const totals = useMemo(() => {
    const subtotal = cart.reduce((a, c) => a + c.price * c.quantity, 0);
    const gstAmount = cart.reduce((a, c) => a + (c.price * c.quantity * c.gst) / (100 + c.gst), 0);
    const taxable = subtotal - gstAmount;
    return { subtotal, gst: gstAmount, taxable, total: subtotal };
  }, [cart]);

  const cartCount = cart.reduce((a, c) => a + c.quantity, 0);

  const openCustomers = async () => {
    setShowCustomer(true);
    if (customers.length === 0) {
      const cs = await api.listCustomers(shopId);
      setCustomers(cs);
    }
  };

  const generateInvoice = async () => {
    const received = payment === "pay_later" ? parseFloat(amountReceived || "0") : totals.total;
    const balance = totals.total - received;
    const status = balance <= 0 ? "paid" : received > 0 ? "partial" : "due";
    const inv = await api.createInvoice({
      shop_id: shopId,
      customer_id: selectedCustomer?.id || null,
      customer_name: selectedCustomer?.name || "Walk-in Customer",
      items: cart.map((c) => ({
        product_id: c.product_id,
        name: c.name,
        quantity: c.quantity,
        price: c.price,
        discount: 0,
        gst: c.gst,
        subtotal: c.price * c.quantity,
      })),
      subtotal: totals.taxable,
      discount: 0,
      gst: totals.gst,
      total: totals.total,
      amount_paid: received,
      balance_due: Math.max(0, balance),
      payment_method: payment,
      status,
    });
    setShowSuccess(inv);
    setShowCart(false);
    clearCart();
    setAmountReceived("");
    setPayment("cash");
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
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: colors.muted, fontSize: 12 }}>POS TERMINAL</Text>
            <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>New Invoice</Text>
          </View>
          <Pressable testID="scan-btn" onPress={() => {}} style={{ backgroundColor: colors.surfaceTertiary, padding: 12, borderRadius: 12 }}>
            <Ionicons name="scan" size={22} color={colors.onSurface} />
          </Pressable>
        </View>

        <View style={{ marginTop: 14, backgroundColor: colors.surfaceSecondary, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, height: 48, borderWidth: 1, borderColor: colors.border }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput
            testID="pos-search"
            value={search}
            onChangeText={setSearch}
            placeholder="Search product, SKU, barcode..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, marginLeft: 10, color: colors.onSurface, fontSize: 14 }}
          />
        </View>

        {/* Customer chip */}
        <Pressable testID="customer-select" onPress={openCustomers} style={{ marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 10, backgroundColor: colors.surfaceSecondary, borderRadius: 10, borderWidth: 1, borderColor: colors.border }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name="person-circle-outline" size={20} color={colors.brand} />
            <Text style={{ color: colors.onSurface, fontSize: 13 }}>{selectedCustomer?.name || "Walk-in Customer"}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.muted} />
        </Pressable>
      </View>

      {/* Product list */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          renderItem={({ item }) => {
            const stockColor = item.stock === 0 ? colors.error : item.stock <= item.min_stock ? colors.warning : colors.success;
            return (
              <Pressable
                testID={`product-${item.id}`}
                onPress={() => item.stock > 0 && addToCart({
                  product_id: item.id, name: item.name, price: item.selling_price, quantity: 0, gst: item.gst, cost_price: item.cost_price,
                })}
                style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: item.stock === 0 ? 0.5 : 1 }}
              >
                <View style={{ width: 46, height: 46, borderRadius: 10, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name={item.is_accessory ? "hardware-chip-outline" : "phone-portrait-outline"} size={20} color={colors.onSurface} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                    <Text style={{ color: colors.muted, fontSize: 11 }}>{item.sku}</Text>
                    <Text style={{ color: stockColor, fontSize: 11, fontWeight: "500" }}>· {item.stock} in stock</Text>
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500" }}>{formatINR(item.selling_price)}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 2, marginTop: 4 }}>
                    <Ionicons name="add-circle" size={18} color={colors.brand} />
                    <Text style={{ color: colors.brand, fontSize: 11, fontWeight: "500" }}>Add</Text>
                  </View>
                </View>
              </Pressable>
            );
          }}
          ListEmptyComponent={<EmptyState icon="cube-outline" title="No products" message="Try a different search" />}
        />
      )}

      {/* Floating cart CTA */}
      {cart.length > 0 && (
        <View style={{ position: "absolute", bottom: 16, left: 20, right: 20 }}>
          <Pressable testID="floating-cart" onPress={() => setShowCart(true)} style={{ backgroundColor: colors.brand, borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.onBrandPrimary, fontSize: 14, fontWeight: "500" }}>{cartCount}</Text>
              </View>
              <Text style={{ color: colors.onBrandPrimary, fontSize: 14, fontWeight: "500" }}>View Cart</Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ color: colors.onBrandPrimary, fontSize: 16, fontWeight: "500" }}>{formatINR(totals.total)}</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.onBrandPrimary} />
            </View>
          </Pressable>
        </View>
      )}

      {/* Cart Modal */}
      <Modal visible={showCart} animationType="slide" transparent onRequestClose={() => setShowCart(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "90%" }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "500" }}>Review Invoice</Text>
                <Pressable testID="close-cart" onPress={() => setShowCart(false)}>
                  <Ionicons name="close" size={24} color={colors.onSurface} />
                </Pressable>
              </View>

              {cart.map((item) => (
                <View key={item.product_id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.divider }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{formatINR(item.price)} × {item.quantity}</Text>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceTertiary, borderRadius: 8, padding: 4 }}>
                    <Pressable testID={`qty-dec-${item.product_id}`} onPress={() => updateQty(item.product_id, item.quantity - 1)} style={{ padding: 4 }}>
                      <Ionicons name="remove" size={16} color={colors.onSurface} />
                    </Pressable>
                    <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "500", minWidth: 20, textAlign: "center" }}>{item.quantity}</Text>
                    <Pressable testID={`qty-inc-${item.product_id}`} onPress={() => updateQty(item.product_id, item.quantity + 1)} style={{ padding: 4 }}>
                      <Ionicons name="add" size={16} color={colors.onSurface} />
                    </Pressable>
                  </View>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500", marginLeft: 12, minWidth: 70, textAlign: "right" }}>{formatINR(item.price * item.quantity)}</Text>
                </View>
              ))}

              <Card style={{ marginTop: 16, backgroundColor: colors.surfaceTertiary }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>Taxable Amount</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 13 }}>{formatINR(totals.taxable)}</Text>
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
                  <Text style={{ color: colors.muted, fontSize: 13 }}>GST</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 13 }}>{formatINR(totals.gst)}</Text>
                </View>
                <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 8 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500" }}>Grand Total</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "500" }}>{formatINR(totals.total)}</Text>
                </View>
              </Card>

              <Text style={{ color: colors.muted, fontSize: 12, marginTop: 16, marginBottom: 8, letterSpacing: 0.5 }}>PAYMENT METHOD</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(["cash", "upi", "card", "pay_later"] as const).map((m) => (
                  <Pressable
                    key={m}
                    testID={`pay-${m}`}
                    onPress={() => setPayment(m)}
                    style={{ flex: 1, minWidth: 100, borderWidth: 1, borderColor: payment === m ? colors.brand : colors.border, backgroundColor: payment === m ? colors.brand : colors.surfaceSecondary, borderRadius: 10, padding: 12, alignItems: "center" }}
                  >
                    <Text style={{ color: payment === m ? colors.onBrandPrimary : colors.onSurface, fontSize: 12, fontWeight: "500" }}>{m.replace("_", " ").toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              {payment === "pay_later" && (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Amount Received</Text>
                  <TextInput
                    testID="amount-received"
                    value={amountReceived}
                    onChangeText={setAmountReceived}
                    placeholder="0"
                    placeholderTextColor={colors.muted}
                    keyboardType="numeric"
                    style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 10, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }}
                  />
                </View>
              )}

              <PrimaryButton testID="generate-invoice" label={`Generate Invoice · ${formatINR(totals.total)}`} onPress={generateInvoice} style={{ marginTop: 20 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Customer picker */}
      <Modal visible={showCustomer} animationType="slide" transparent onRequestClose={() => setShowCustomer(false)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%" }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 }}>
              <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "500" }}>Select Customer</Text>
              <Pressable testID="close-customer" onPress={() => setShowCustomer(false)}>
                <Ionicons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <Pressable testID="walkin" onPress={() => { setCustomer(null); setShowCustomer(false); }} style={{ padding: 16, marginHorizontal: 20, borderRadius: 10, backgroundColor: colors.surfaceTertiary, marginBottom: 8 }}>
              <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>Walk-in Customer</Text>
            </Pressable>
            <FlatList
              data={customers}
              keyExtractor={(c) => c.id}
              contentContainerStyle={{ padding: 20 }}
              renderItem={({ item }) => (
                <Pressable testID={`customer-${item.id}`} onPress={() => { setCustomer(item); setShowCustomer(false); }} style={{ padding: 12, borderRadius: 10, backgroundColor: colors.surfaceSecondary, marginBottom: 8, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{item.name}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.phone}</Text>
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={!!showSuccess} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", padding: 24 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.successBg, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
            <Ionicons name="checkmark-circle" size={68} color={colors.success} />
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Invoice Generated</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 4 }}>{showSuccess?.invoice_number}</Text>
          <Text style={{ color: colors.onSurface, fontSize: 32, fontWeight: "500", marginTop: 20 }}>{formatINR(showSuccess?.total || 0)}</Text>
          <View style={{ marginTop: 8 }}>
            <StatusBadge status={showSuccess?.status || "paid"} />
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 32 }}>
            <Pressable testID="done-invoice" onPress={() => setShowSuccess(null)} style={{ backgroundColor: colors.brand, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 }}>
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "500" }}>Done</Text>
            </Pressable>
            <Pressable testID="new-invoice-again" onPress={() => setShowSuccess(null)} style={{ backgroundColor: colors.surfaceTertiary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 }}>
              <Text style={{ color: colors.onSurface, fontWeight: "500" }}>New Invoice</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
