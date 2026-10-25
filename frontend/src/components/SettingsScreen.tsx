import React, { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useTheme } from "../theme/theme";
import { Card, PrimaryButton, ScreenHeader } from "./ui";
import { useBusiness } from "../services/business";
import { useAuthStore } from "../services/auth";
import { useMockStore } from "../store/mock-data";
import { validateGSTIN } from "../domain/gst.ts";

type Tab = "business" | "invoice" | "operations" | "branches";
const BUSINESS: [string, string][] = [["businessName", "Business name"], ["ownerName", "Owner name"], ["phone", "Phone"], ["email", "Email"], ["state", "State"], ["city", "City"], ["pinCode", "PIN code"], ["pan", "PAN"], ["businessType", "Business type"], ["address", "Address"]];
const INVOICE: [string, string][] = [["gstin", "Business GSTIN"], ["invoicePrefix", "Invoice prefix"], ["defaultGst", "Default GST %"], ["stateCode", "Seller state code"], ["currency", "Currency"], ["invoiceTerms", "Terms & notes"], ["invoiceFooter", "Invoice footer message"], ["labelSize", "Product label size"], ["receiptSize", "Receipt width"]];

// Stable module-level input so the keyboard stays open while typing.
function Fld({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={colors.muted} autoCapitalize="none" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }} />
    </View>
  );
}

// Settings — business profile + invoice/GST (same `settings/business-profile` document as web), appearance, branches,
// account. Browser-only printer panels (WebUSB / WebSerial) are replaced by the system print + share sheet.
export default function SettingsScreen() {
  const { colors, isDark, preference, toggleTheme, gradients } = useTheme();
  const router = useRouter();
  const profile = useBusiness((b) => b.profile);
  const saveProfile = useBusiness((b) => b.saveProfile);
  const access = useBusiness((b) => b.access);
  const logout = useAuthStore((s) => s.logout);
  const shops = useMockStore((s) => s.shops);
  const [tab, setTab] = useState<Tab>("business");
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (profile) setForm(profile); }, [profile]);
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (form.gstin && !validateGSTIN(form.gstin).valid) return Alert.alert("Check settings", "Enter a valid business GSTIN.");
    setBusy(true);
    try { await saveProfile(Object.fromEntries([...BUSINESS, ...INVOICE].map(([k]) => [k, form[k] ?? ""]))); Alert.alert("Settings saved"); }
    catch (e: any) { Alert.alert("Unable to save settings", e?.message || "Try again."); }
    finally { setBusy(false); }
  };
  const version = Constants.expoConfig?.version || "1.0.1";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScreenHeader title="Settings" subtitle="Business configuration & preferences" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 50 }} contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 6 }}>
          {([["business", "Business Profile"], ["invoice", "Invoice & GST"], ["operations", "Operations"], ["branches", "Branches"]] as [Tab, string][]).map(([k, l]) => (
            <Pressable key={k} testID={`settings-tab-${k}`} onPress={() => setTab(k)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: tab === k ? colors.brand : colors.border, backgroundColor: tab === k ? colors.brand : "transparent", marginRight: 8 }}>
              <Text style={{ color: tab === k ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{l}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60, gap: 12 }} keyboardShouldPersistTaps="handled">
          {tab === "business" && (<View>{BUSINESS.map(([k, l]) => <Fld key={k} label={l} value={String(form[k] ?? "")} onChange={(v) => set(k, v)} />)}</View>)}
          {tab === "invoice" && (<View>{INVOICE.map(([k, l]) => <Fld key={k} label={l} value={String(form[k] ?? "")} onChange={(v) => set(k, k === "gstin" ? v.toUpperCase() : v)} />)}</View>)}
          {(tab === "business" || tab === "invoice") && <PrimaryButton testID="settings-save" label={busy ? "Saving…" : "Save"} onPress={save} disabled={busy} gradient={gradients.brand} style={{ marginTop: 16 }} />}

          {tab === "operations" && (
            <View style={{ gap: 12 }}>
              {([["allowPayLater", "Allow Pay Later"], ["lowStockAlerts", "Low-stock alerts"]] as [string, string][]).map(([k, l]) => (
                <Pressable key={k} onPress={() => { const v = form[k] === false; set(k, v); saveProfile({ [k]: v }).catch(() => undefined); }} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between" }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "600" }}>{l}</Text>
                  <Text style={{ color: form[k] === false ? colors.muted : colors.success, fontWeight: "700" }}>{form[k] === false ? "Off" : "On"}</Text>
                </Pressable>
              ))}
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: isDark }} onPress={toggleTheme} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View><Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>Appearance</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Using {preference === "system" ? "system" : preference} mode · saved on this device</Text></View>
                <Ionicons name={isDark ? "moon" : "sunny"} size={24} color={colors.brand} />
              </Pressable>
              <Pressable onPress={() => router.push("/coupon-management")} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: colors.border, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <View><Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>Coupon Management</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Create and manage discount coupons</Text></View>
                <Ionicons name="chevron-forward" size={20} color={colors.brand} />
              </Pressable>
              <Card>
                <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700" }}>Printing</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Invoices, job sheets and labels print through the system print dialog / PDF share sheet. Direct USB / Serial printer pairing is a browser-only feature and is not available on the phone.</Text>
              </Card>
            </View>
          )}

          {tab === "branches" && (
            <View style={{ gap: 12 }}>
              {shops.map((b: any) => (
                <Card key={b.id}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{b.display_name || b.name}</Text><Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{b.address || b.location || ""} · {(b.status || "active")}</Text></Card>
              ))}
              <PrimaryButton label="Manage branches" onPress={() => router.push("/shops")} />
            </View>
          )}

          <Card>
            <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>Account</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Role: {access?.role || "—"}{access?.full_access ? " · full access" : ""}</Text>
            <Pressable testID="settings-signout" onPress={() => logout()} style={{ marginTop: 12 }}><Text style={{ color: colors.error, fontWeight: "700" }}>Sign out</Text></Pressable>
          </Card>
          <Card>
            <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "700", marginBottom: 8 }}>About RetailPrime</Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Version {version}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Mobile ERP for retail and services</Text>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
