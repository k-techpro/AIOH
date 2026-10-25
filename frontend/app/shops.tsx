import React, { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { Card, PrimaryButton } from "../src/components/ui";
import { useMockStore } from "../src/store/mock-data";
import { useAppStore } from "../src/store/shop";
import { useBusiness } from "../src/services/business";
import { archiveBranch, createBranch, deleteBranch, inspectBranchDeletion, restoreBranch, updateBranch } from "../src/services/repository";
import { RETIRED_BRANCHES, slugOf, validateBranchInput } from "../src/domain/branches.ts";
import { branchLabel, deleteConfirmationPhrase, isDeletedBranch } from "../src/domain/listTools.ts";
import { lookupIndianPincode, type PostOffice } from "../src/domain/pincode.ts";
import { validateGSTIN } from "../src/domain/gst.ts";

type F = Record<string, any>;
const blank = (): F => ({
  name: "", display_name: "", branch_code: "", invoice_prefix: "", service_prefix: "", return_prefix: "", manager: "", phone: "", email: "",
  address1: "", address2: "", street: "", area: "", city: "", district: "", state: "", pincode: "", gst_registered: false, gstin: "",
  license_number: "", msme_registered: false, udyam_number: "", invoice_footer: "", start_invoice_no: "1", start_service_no: "1", start_return_no: "1", status: "active",
});
const FIELDS: [string, string, any?][] = [
  ["name", "Branch name (legal identity) *"], ["display_name", "Nickname / display name"], ["manager", "Manager"], ["phone", "Phone", "phone-pad"], ["email", "Email"],
  ["pincode", "PIN Code *", "number-pad"], ["state", "State *"], ["district", "District *"], ["area", "Area / Post Office *"],
  ["city", "City / Locality"], ["street", "Street / Landmark (optional)"], ["invoice_footer", "Invoice footer"],
];
const CREATE_ONLY: [string, string, any?][] = [
  ["branch_code", "Branch code"], ["invoice_prefix", "Invoice prefix (e.g. PON)"], ["service_prefix", "Service prefix"], ["return_prefix", "Return prefix"],
  ["start_invoice_no", "Start invoice no.", "number-pad"], ["start_service_no", "Start service no.", "number-pad"], ["start_return_no", "Start return no.", "number-pad"],
];

// Stable (module-level) so the keyboard never drops while typing.
function Input({ label, value, onChange, kb, testID, secure }: { label: string; value: string; onChange: (v: string) => void; kb?: any; testID?: string; secure?: boolean }) {
  const { colors } = useTheme();
  return (
    <View>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 12 }}>{label}</Text>
      <TextInput testID={testID} value={value} onChangeText={onChange} keyboardType={kb} secureTextEntry={secure} placeholder={label} placeholderTextColor={colors.muted} autoCapitalize="none" style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }} />
    </View>
  );
}

export default function Shops() {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const shops = useMockStore((s) => s.shops);
  const products = useMockStore((s) => s.products);
  const invoices = useMockStore((s) => s.invoices);
  const { shopId, setShop } = useAppStore();
  const access = useBusiness((b) => b.access);
  const canManage = !!access && (["OWNER", "ADMIN"].includes(access.role) || access.full_access === true);

  const [editing, setEditing] = useState<F | null | undefined>(); // undefined closed, null = new
  const [form, setForm] = useState<F>(blank());
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<F | null>(null);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [phrase, setPhrase] = useState("");
  const [postOffices, setPostOffices] = useState<PostOffice[]>([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState("");
  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    const pin = String(form.pincode || "").replace(/\D/g, "");
    if (pin.length !== 6) { setPostOffices([]); setPinError(""); return undefined; }
    let current = true;
    const timer = setTimeout(async () => {
      setPinLoading(true); setPinError("");
      try {
        const offices = await lookupIndianPincode(pin);
        if (!current) return;
        setPostOffices(offices);
        const first = offices[0];
        setForm((f) => ({ ...f, state: first.state, district: first.district, city: first.city, area: offices.length === 1 ? first.area : "" }));
      } catch {
        if (current) { setPostOffices([]); setPinError("Could not fetch address automatically. Enter manually."); }
      } finally { if (current) setPinLoading(false); }
    }, 350);
    return () => { current = false; clearTimeout(timer); };
  }, [form.pincode]);

  const visible = useMemo(
    () => shops.filter((b: any) => !isDeletedBranch(b) && !RETIRED_BRANCHES.has(slugOf(b) || "") && !RETIRED_BRANCHES.has(b.id))
      .sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""))),
    [shops],
  );
  const stats = (id: string) => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      sales: invoices.filter((i: any) => i.shop_id === id && String(i.created_at).slice(0, 10) === today).reduce((n: number, i: any) => n + Number(i.total || 0), 0),
      products: products.filter((p: any) => p.shop_id === id).length,
      low: products.filter((p: any) => p.shop_id === id && p.stock <= (p.lowStockAlert ?? p.min_stock ?? 5)).length,
    };
  };

  const open = (b?: F) => { setEditing(b || null); setForm(b ? { ...blank(), ...b, street: b.street || [b.address1 || b.addressLine1, b.address2 || b.addressLine2].filter(Boolean).join(", ") || b.address || "" } : blank()); setPinError(""); };
  const save = async () => {
    const editingId = editing?.id;
    const problem = validateBranchInput(form, shops, { editingId });
    if (problem) return Alert.alert("Check branch details", problem);
    if (!editingId && (!/^\d{6}$/.test(String(form.pincode || "")) || !form.state || !form.district || !form.area)) return Alert.alert("Check branch details", "Enter the 6-digit PIN, state, district, and area / post office.");
    if (form.gst_registered && !validateGSTIN(form.gstin).valid) return Alert.alert("Check branch details", "Enter a valid GSTIN format.");
    if (form.msme_registered && !String(form.udyam_number || "").trim()) return Alert.alert("Check branch details", "Enter the MSME / Udyam Registration Number.");
    setBusy(true);
    try {
      if (editingId) {
        await updateBranch(editingId, { ...form, name: form.name.trim(), display_name: String(form.display_name || "").trim(), gstin: form.gst_registered ? form.gstin.trim().toUpperCase() : "", udyam_number: form.msme_registered ? form.udyam_number.trim() : "", address: [form.street, form.area, form.city, form.district, form.state, form.pincode].filter(Boolean).join(", ") });
      } else {
        await createBranch({ ...form, name: form.name.trim(), display_name: String(form.display_name || "").trim(), gstin: form.gst_registered ? form.gstin.trim().toUpperCase() : "", udyam_number: form.msme_registered ? form.udyam_number.trim() : "", address: [form.street, form.area, form.city, form.district, form.state, form.pincode].filter(Boolean).join(", ") }, shops);
      }
      setEditing(undefined);
    } catch (e: any) { Alert.alert("Branch not saved", e?.message || "Try again."); }
    finally { setBusy(false); }
  };
  const toggleArchive = async (b: F) => {
    try { await (b.status === "archived" ? restoreBranch(b.id) : archiveBranch(b.id)); }
    catch (e: any) { Alert.alert("Branch not updated", e?.message || "Try again."); }
  };
  const startDelete = async (b: F) => {
    if (b.id === shopId) return Alert.alert("Delete branch", "Switch to another branch before deleting this one.");
    setRemoving(b); setPhrase(""); setCounts(null);
    try { setCounts(await inspectBranchDeletion(b.id)); } catch { setCounts({}); }
  };
  const confirmDelete = async () => {
    if (!removing) return;
    try { await deleteBranch(removing, phrase, shopId); setRemoving(null); Alert.alert("Branch deleted", "It is removed from active operation; its history is kept."); }
    catch (e: any) { Alert.alert("Branch not deleted", e?.message || "Try again."); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "600" }}>Shops / Branches</Text>
        {canManage && <Pressable testID="add-branch" onPress={() => open()}><Ionicons name="add-circle" size={30} color={colors.brand} /></Pressable>}
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {visible.map((b: any) => {
          const st = stats(b.id);
          const archived = (b.status || "active") === "archived";
          return (
            <Card key={b.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600" }}>{branchLabel(b)}</Text>
                  {!!b.display_name && b.display_name !== b.name && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{b.name}</Text>}
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{b.address || b.location || ""}</Text>
                  <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{b.branch_code || b.id}{b.gstin ? ` · ${b.gstin}` : ""}</Text>
                </View>
                <View style={{ backgroundColor: archived ? colors.warningBg : colors.successBg, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                  <Text style={{ color: archived ? colors.warning : colors.success, fontSize: 10, fontWeight: "600" }}>{archived ? "ARCHIVED" : "ACTIVE"}</Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", marginTop: 14, gap: 12 }}>
                <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Today&apos;s Sales</Text><Text style={{ color: colors.onSurface, fontWeight: "600" }}>{formatINR(st.sales)}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Products</Text><Text style={{ color: colors.onSurface, fontWeight: "600" }}>{st.products}</Text></View>
                <View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 11 }}>Low Stock</Text><Text style={{ color: colors.warning, fontWeight: "600" }}>{st.low}</Text></View>
              </View>
              <View style={{ flexDirection: "row", gap: 16, marginTop: 14, flexWrap: "wrap" }}>
                {!archived && <Pressable testID={`open-${b.id}`} onPress={() => { setShop(b.id, branchLabel(b)); router.replace("/(tabs)/dashboard"); }}><Text style={{ color: colors.brand, fontWeight: "700" }}>Open</Text></Pressable>}
                {canManage && <Pressable testID={`edit-${b.id}`} onPress={() => open(b)}><Text style={{ color: colors.brand, fontWeight: "700" }}>Edit</Text></Pressable>}
                {canManage && <Pressable testID={`archive-${b.id}`} onPress={() => toggleArchive(b)}><Text style={{ color: colors.warning, fontWeight: "700" }}>{archived ? "Restore" : "Archive"}</Text></Pressable>}
                {canManage && <Pressable testID={`delete-${b.id}`} onPress={() => startDelete(b)}><Text style={{ color: colors.error, fontWeight: "700" }}>Delete</Text></Pressable>}
              </View>
            </Card>
          );
        })}
        {!visible.length && <Card><Text style={{ color: colors.muted }}>No branches yet.</Text></Card>}
        {!canManage && <Text style={{ color: colors.muted, fontSize: 12 }}>Only owners and full-access users can add or edit branches.</Text>}
      </ScrollView>

      <Modal visible={editing !== undefined} animationType="slide" onRequestClose={() => setEditing(undefined)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>{editing ? `Edit ${branchLabel(editing)}` : "Add Branch"}</Text>
              <Pressable onPress={() => setEditing(undefined)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {editing && <Text style={{ color: colors.muted, fontSize: 11 }}>Branch ID {editing.id} is immutable — changing the nickname never changes the shop_id or any saved invoice.</Text>}
              {FIELDS.map(([k, l, kb]) => (
                <View key={k}>
                  <Input label={k === "pincode" && pinLoading ? "PIN Code * · Looking up…" : l} value={String(form[k] ?? "")} onChange={(v) => set(k, k === "pincode" ? v.replace(/\D/g, "").slice(0, 6) : v)} kb={kb} testID={`branch-${k}`} />
                  {k === "pincode" && !!pinError && <Text style={{ color: colors.warning, fontSize: 12, marginTop: 5 }}>{pinError}</Text>}
                  {k === "area" && postOffices.length > 1 && <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>{postOffices.map((office) => <Pressable key={office.area} onPress={() => setForm((f) => ({ ...f, area: office.area, city: office.city, district: office.district, state: office.state }))} style={{ paddingHorizontal: 10, paddingVertical: 7, marginRight: 6, marginBottom: 6, borderRadius: 999, backgroundColor: form.area === office.area ? colors.brand : colors.surfaceSecondary }}><Text style={{ color: form.area === office.area ? colors.onBrandPrimary : colors.onSurface, fontSize: 12 }}>{office.area}</Text></Pressable>)}</View>}
                </View>
              ))}
              {!editing && CREATE_ONLY.map(([k, l, kb]) => <Input key={k} label={l} value={String(form[k] ?? "")} onChange={(v) => set(k, v)} kb={kb} testID={`branch-${k}`} />)}
              <View style={{ flexDirection: "row", marginTop: 14 }}>
                <Pressable onPress={() => set("gst_registered", !form.gst_registered)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: form.gst_registered ? colors.brand : colors.border, backgroundColor: form.gst_registered ? colors.brand : "transparent" }}>
                  <Text style={{ color: form.gst_registered ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{form.gst_registered ? "✓ GST registered" : "GST registered?"}</Text>
                </Pressable>
              </View>
              {form.gst_registered && <Input label="GSTIN" value={String(form.gstin || "")} onChange={(v) => set("gstin", v.toUpperCase())} testID="branch-gstin" />}
              <Input label="Business / Shop License Number (optional)" value={String(form.license_number || "")} onChange={(v) => set("license_number", v)} testID="branch-license" />
              <Pressable onPress={() => set("msme_registered", !form.msme_registered)} style={{ marginTop: 14, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: form.msme_registered ? colors.brand : colors.border, backgroundColor: form.msme_registered ? colors.brand : "transparent" }}><Text style={{ color: form.msme_registered ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{form.msme_registered ? "✓ MSME registered" : "MSME registered?"}</Text></Pressable>
              {form.msme_registered && <Input label="MSME / Udyam Registration Number *" value={String(form.udyam_number || "")} onChange={(v) => set("udyam_number", v.toUpperCase())} testID="branch-udyam" />}
              <PrimaryButton testID="branch-save" label={busy ? "Saving…" : editing ? "Save changes" : "Create branch"} onPress={save} disabled={busy} gradient={gradients.brand} style={{ marginTop: 24 }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!removing} transparent animationType="fade" onRequestClose={() => setRemoving(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(15,23,42,.5)", justifyContent: "center", padding: 24 }}>
          <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 20 }}>
            <Text style={{ color: colors.onSurface, fontSize: 19, fontWeight: "700" }}>Delete {removing ? branchLabel(removing) : ""}?</Text>
            <Text style={{ color: colors.muted, marginTop: 8, fontSize: 13 }}>The branch leaves every selector and cannot be used for new records. Its history (invoices, services, reports) is kept.</Text>
            {counts && <Text testID="delete-counts" style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>{Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${k}`).join(" · ") || "No records in this branch."}</Text>}
            <Text style={{ color: colors.onSurface, marginTop: 12, fontSize: 13 }}>Type <Text style={{ fontWeight: "800" }}>{removing ? deleteConfirmationPhrase(removing) : ""}</Text> to confirm</Text>
            <TextInput testID="delete-phrase" value={phrase} onChangeText={setPhrase} autoCapitalize="none" autoCorrect={false} style={{ marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.onSurface }} />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => setRemoving(null)} style={{ flex: 1, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.onSurface, textAlign: "center", fontWeight: "700" }}>Cancel</Text></Pressable>
              <Pressable testID="delete-confirm" disabled={!removing || phrase !== deleteConfirmationPhrase(removing)} onPress={confirmDelete} style={{ flex: 1, padding: 13, borderRadius: 12, backgroundColor: colors.error, opacity: removing && phrase === deleteConfirmationPhrase(removing) ? 1 : 0.4 }}><Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>Delete</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
