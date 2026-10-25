import React, { useState } from "react";
import { Alert, FlatList, Modal, Pressable, ScrollView, Text, TextInput, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { formatINR } from "../../src/utils/format";
import { useAppStore } from "../../src/store/shop";
import { useMockStore } from "../../src/store/mock-data";
import { AiohInput, Card, EmptyState, PrimaryButton, FloatingActionButton } from "../../src/components/ui";
import CustomerPhoneLookup from "../../src/components/CustomerPhoneLookup";
import { ALL, CUSTOMER_SORTS, CUSTOMER_TYPE_CHOICES, customerTypeOf, customerTypeOptions, filterCustomersByType, sortCustomers } from "../../src/domain/listTools.ts";
import { validateGSTIN } from "../../src/domain/gst.ts";
import { updateCustomerDetails } from "../../src/services/repository";

export default function Customers() {
  const { colors, shadows } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const customers = useMockStore((s) => s.customers);
  const shops = useMockStore((s) => s.shops);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "pay_later" | "history" | "walk_in">("all");
  const [showAdd, setShowAdd] = useState(false);
  const [lookupCustomer, setLookupCustomer] = useState<any>(null);
  const [sortId, setSortId] = useState(CUSTOMER_SORTS[0].id);
  const [typeFilter, setTypeFilter] = useState(ALL);
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ name: "", address: "", email: "", gstin: "", type: "Retail" });

  const rows = sortCustomers(
    filterCustomersByType(
      customers.filter(
        (c) =>
          (shopId === "all" || c.shop_id === shopId) &&
          `${c.name} ${c.phone} ${customerTypeOf(c)}`.toLowerCase().includes(search.toLowerCase()) &&
          (view !== "pay_later" || c.total_due > 0) &&
          (view !== "history" || c.invoices.length > 0)
      ),
      typeFilter
    ),
    sortId
  );
  const typeChoices = customerTypeOptions(customers.filter((c) => shopId === "all" || c.shop_id === shopId));

  const startEdit = (c: any) => { setEditing(c); setEditForm({ name: c.name || "", address: c.address || "", email: c.email || "", gstin: c.gstin || c.gstIn || "", type: customerTypeOf(c) === "Unspecified" ? "Retail" : customerTypeOf(c) }); };
  const saveEdit = async () => {
    if (!editing) return;
    if (!editForm.name.trim()) return Alert.alert("Missing details", "Customer name is required.");
    const gstin = editForm.gstin.trim().toUpperCase();
    if (gstin && !validateGSTIN(gstin).valid) return Alert.alert("Invalid GSTIN", "Enter a valid GSTIN.");
    try {
      await updateCustomerDetails(editing.id, { name: editForm.name, address: editForm.address.trim() || null, email: editForm.email.trim() || null, gstin: gstin || null, type: editForm.type, customer_type: editForm.type }, shops);
      setEditing(null);
    } catch (error: any) { Alert.alert("Customer not saved", error?.message || "Check your internet connection and try again."); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Floating Action Button */}
      <View style={{ position: "absolute", bottom: 24, right: 24, zIndex: 100 }}>
        <FloatingActionButton icon="person-add" onPress={() => setShowAdd(true)} testID="fab-add-customer" />
      </View>

      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: "600" }}>
              CUSTOMER MANAGEMENT
            </Text>
            <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700", marginTop: 4 }}>
              Customers
            </Text>
            <Text style={{ color: colors.muted, fontSize: 13, marginTop: 6 }}>
              {rows.length} customers in your network
            </Text>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 14 }}>
          {[["all","All Customers"],["pay_later","Pay Later"],["history","History"],["walk_in","Walk-in List"]].map(([key,label]) => <Pressable key={key} onPress={() => (key === "walk_in" ? router.push("/walk-in" as any) : setView(key as any))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: view === key ? colors.brand : colors.surfaceSecondary }}><Text style={{ color: view === key ? colors.onBrandPrimary : colors.onSurface, fontSize: 12, fontWeight: "700" }}>{label}</Text></Pressable>)}
        </ScrollView>

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
            value={search}
            onChangeText={setSearch}
            placeholder="Search customer name or phone..."
            placeholderTextColor={colors.muted}
            style={{ flex: 1, marginLeft: 12, color: colors.onSurface, fontSize: 15, fontWeight: "500" }}
          />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 8 }} style={{ maxHeight: 44 }}>
        {CUSTOMER_SORTS.map((o) => (
          <Pressable key={o.id} testID={`csort-${o.id}`} onPress={() => setSortId(o.id)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: sortId === o.id ? colors.brand : colors.border, backgroundColor: sortId === o.id ? colors.brand : "transparent" }}>
            <Text style={{ color: sortId === o.id ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 12 }}>{o.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 20, paddingBottom: 10 }} style={{ maxHeight: 44 }}>
        {[ALL, ...typeChoices].map((t) => (
          <Pressable key={t} testID={`ctype-${t}`} onPress={() => setTypeFilter(t)} style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: typeFilter === t ? colors.brand : colors.border, backgroundColor: typeFilter === t ? colors.brand : "transparent" }}>
            <Text style={{ color: typeFilter === t ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 12 }}>{t === ALL ? "All types" : t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Customer List */}
      <FlatList
        data={rows}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100, gap: 10 }}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No customers found"
            message="Add your first customer to start building relationships"
          />
        }
        renderItem={({ item }) => {
          const initials = item.name
            .split(" ")
            .map((n: string) => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();

          return (
            <Pressable
              testID={`cust-${item.id}`}
              onPress={() => router.push(`/customer/${item.id}` as any)}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, borderColor: colors.border }}>
                <View
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 26,
                    backgroundColor: colors.brand,
                    alignItems: "center",
                    justifyContent: "center",
                    ...shadows.sm,
                  }}
                >
                  <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>{initials}</Text>
                </View>

                {/* Customer details */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "600", fontSize: 15 }}>{item.name}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <Ionicons name="call" size={12} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "500" }}>{item.phone} · {customerTypeOf(item)}</Text>
                  </View>
                </View>

                {/* Purchase stats */}
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "700" }}>
                    {formatINR(item.total_purchases, true)}
                  </Text>
                  {item.total_due > 0 ? (
                    <View
                      style={{
                        marginTop: 6,
                        backgroundColor: colors.errorBg,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        borderRadius: 8,
                      }}
                    >
                      <Text style={{ color: colors.error, fontSize: 11, fontWeight: "600" }}>
                        Due {formatINR(item.total_due, true)}
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ color: colors.success, fontSize: 11, marginTop: 4, fontWeight: "600" }}>Paid</Text>
                  )}
                </View>

                <Pressable testID={`edit-cust-${item.id}`} onPress={() => startEdit(item)} hitSlop={10}>
                  <Ionicons name="create-outline" size={20} color={colors.brand} />
                </Pressable>
              </Card>
            </Pressable>
          );
        }}
      />

      {/* Add Customer Modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.4)" }}>
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
              {/* Modal header */}
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Add Customer</Text>
                <Pressable
                  onPress={() => setShowAdd(false)}
                  style={{ backgroundColor: colors.surfaceTertiary, padding: 6, borderRadius: 20 }}
                >
                  <Ionicons name="close" size={22} color={colors.onSurface} />
                </Pressable>
              </View>

              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 4 }}>Enter the phone number first. An existing customer is selected automatically; a new number opens the New Customer form, which saves automatically once the name is filled in.</Text>
              <CustomerPhoneLookup customer={lookupCustomer} onSelect={setLookupCustomer} testIDPrefix="cust-add" />
              <PrimaryButton label="Done" onPress={() => { setShowAdd(false); setLookupCustomer(null); }} style={{ marginTop: 24 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 23, 42, 0.4)" }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ backgroundColor: colors.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "90%", ...shadows.xl }}>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Edit Customer</Text>
                <Pressable onPress={() => setEditing(null)}><Ionicons name="close" size={22} color={colors.onSurface} /></Pressable>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Phone {editing?.phone} identifies this customer and cannot be changed here.</Text>
              <View style={{ gap: 14, marginTop: 12 }}>
                {([["name", "Customer name *"], ["address", "Address"], ["email", "Email"], ["gstin", "GSTIN"]] as const).map(([k, l]) => (
                  <AiohInput key={k} label={l} value={editForm[k]} onChangeText={(v) => setEditForm({ ...editForm, [k]: k === "gstin" ? v.toUpperCase() : v })} placeholder={l} placeholderTextColor={colors.muted} />
                ))}
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {CUSTOMER_TYPE_CHOICES.map((t) => (
                    <Pressable key={t} onPress={() => setEditForm({ ...editForm, type: t })} style={{ paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: editForm.type === t ? colors.brand : colors.border, backgroundColor: editForm.type === t ? colors.brand : "transparent" }}>
                      <Text style={{ color: editForm.type === t ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{t}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <PrimaryButton testID="save-customer-edit" label="Save changes" onPress={saveEdit} style={{ marginTop: 24 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
