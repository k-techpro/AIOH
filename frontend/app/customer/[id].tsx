import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { formatINR, formatDate } from "../../src/utils/format";
import { useMockStore } from "../../src/store/mock-data";
import { Card, StatusBadge } from "../../src/components/ui";
import { useAuthStore } from "../../src/services/auth";

import {updateCustomerDetails}from "../../src/services/repository";

export default function CustomerDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const c = useMockStore((s) => s.customers.find((customer) => customer.id === id));
  const user = useAuthStore((s) => s.user);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: c?.name || "", phone: c?.phone || "", email: c?.email || "", address: typeof c?.address === "string" ? c.address : "", gstin: c?.gstin || c?.gstIn || "" });

  if (!c) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.onSurface }}>Customer record not found.</Text><Pressable onPress={() => router.back()}><Text style={{ color: colors.brand, marginTop: 12 }}>Go back</Text></Pressable></SafeAreaView>;

  const aov = c.invoices.length > 0 ? c.total_purchases / c.invoices.length : 0;
  const saveCustomer = async () => {
    if (!user?.uid || !form.name.trim() || !form.phone.trim()) return Alert.alert("Missing details", "Name and phone are required.");
    const gstin = form.gstin.trim().toUpperCase();
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z]\d[Z][A-Z\d]$/.test(gstin)) return Alert.alert("Invalid GSTIN", "Enter a valid GSTIN format.");
    setSaving(true);
    try { await updateCustomerDetails(c.id, { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() || null, address: form.address.trim() || null, gstin: gstin || null, gstIn: gstin || null, gstFormatValid: Boolean(gstin), gstVerified: false, updatedAt: new Date().toISOString(), updated_at: new Date().toISOString() }); setEditing(false); }
    catch (error: any) { Alert.alert("Customer not updated", error?.message || "Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 20, fontWeight: "500" }}>Customer</Text>
        <Pressable testID="edit-customer" onPress={() => setEditing(true)}><Ionicons name="pencil" size={21} color={colors.brand} /></Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Text style={{ color: colors.onBrandPrimary, fontSize: 26, fontWeight: "500" }}>{c.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>{c.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{c.phone}</Text>
          {c.email && <Text style={{ color: colors.muted, fontSize: 12 }}>{c.email}</Text>}
          {c.address && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8, textAlign: "center" }}>{typeof c.address === "string" ? c.address : [c.address.line1, c.address.line2, c.address.city, c.address.state, c.address.postalCode].filter(Boolean).join(", ")}</Text>}
          {c.gstin && <View style={{ marginTop: 8, backgroundColor: colors.infoBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}><Text style={{ color: colors.info, fontSize: 11, fontWeight: "500" }}>GST Â· {c.gstin}</Text></View>}
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>LIFETIME VALUE</Text>
            <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{formatINR(c.total_purchases, true)}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>AVG ORDER</Text>
            <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "500", marginTop: 4 }}>{formatINR(aov, true)}</Text>
          </Card>
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>TOTAL PAID</Text>
            <Text style={{ color: colors.success, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{formatINR(c.total_paid || 0, true)}</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={{ color: colors.muted, fontSize: 11 }}>OUTSTANDING</Text>
            <Text style={{ color: c.total_due > 0 ? colors.error : colors.muted, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{formatINR(c.total_due, true)}</Text>
          </Card>
        </View>

        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, marginTop: 24, marginBottom: 10 }}>PURCHASE HISTORY</Text>
        <View style={{ gap: 8 }}>
          {c.invoices.slice(0, 20).map((inv: any) => (
            <View key={inv.id} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 14, flexDirection: "row", alignItems: "center" }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "500" }}>{inv.invoice_number}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{formatDate(inv.created_at)} Â· {inv.items.length} items</Text>
              </View>
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <Text style={{ color: colors.onSurface, fontSize: 14, fontWeight: "500" }}>{formatINR(inv.total)}</Text>
                <StatusBadge status={inv.status} />
              </View>
            </View>
          ))}
          {c.invoices.length === 0 && <Text style={{ color: colors.muted, textAlign: "center", padding: 20 }}>No purchases yet</Text>}
        </View>
      </ScrollView>
      <Modal visible={editing} transparent animationType="slide" onRequestClose={() => setEditing(false)}><View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,.45)" }}><View style={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 10 }}><Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700" }}>Edit Customer</Text>{([['name','Name'],['phone','Phone'],['email','Email (optional)'],['address','Address (optional)'],['gstin','GSTIN (optional)']] as const).map(([key,label])=><TextInput key={key} value={form[key]} onChangeText={(value)=>setForm((old)=>({...old,[key]:key==='gstin'?value.toUpperCase():value}))} placeholder={label} placeholderTextColor={colors.muted} multiline={key==='address'} keyboardType={key==='phone'?"phone-pad":key==='email'?"email-address":"default"} style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: key==='address'?72:48 }} />)}<Pressable disabled={saving} onPress={saveCustomer} style={{ backgroundColor: colors.brand, borderRadius: 12, padding: 14, alignItems: "center", opacity: saving?.6:1 }}><Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>{saving?"Savingâ€¦":"Save Changes"}</Text></Pressable><Pressable onPress={()=>setEditing(false)} style={{ padding: 10, alignItems:"center" }}><Text style={{ color: colors.muted }}>Cancel</Text></Pressable></View></View></Modal>
    </SafeAreaView>
  );
}

