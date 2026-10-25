import React, { useMemo, useState,useRef } from "react";
import {IS_NEON}from '../services/databaseBackend';
import {newOperationId}from '../services/neon/client';
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme/theme";
import { Card, EmptyState, PrimaryButton } from "./ui";
import { useCollection } from "../hooks/useCollection";
import { useMockStore } from "../store/mock-data";
import { createShopRecord, deleteShopRecord, updateShopRecord } from "../services/repository";
import { formatDate } from "../utils/format";

export type FieldDef = {
  name: string; label: string; type?: "text" | "number" | "currency" | "tel" | "email" | "select" | "date" | "textarea" | "switch";
  options?: string[]; required?: boolean;
};
export type Row = Record<string, any>;
export interface ResourceConfig {
  title: string; subtitle: string; collection: string; addLabel: string;
  fields: FieldDef[]; searchKeys: string[]; defaults?: Row;
  /** One list card: primary line, secondary line and an optional right-hand value. */
  card: (r: Row) => { title: string; subtitle?: string; right?: string; badge?: string };
}

// Stable module-level field editor (keeps the keyboard open while typing).
function FieldEditor({ def, value, onChange }: { def: FieldDef; value: any; onChange: (v: any) => void }) {
  const { colors } = useTheme();
  const base = { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const;
  const label = <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 14 }}>{def.label}{def.required ? " *" : ""}</Text>;
  if (def.type === "switch") {
    return (
      <View style={{ flexDirection: "row", marginTop: 14 }}>
        <Pressable onPress={() => onChange(!value)} style={{ paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: value ? colors.brand : colors.border, backgroundColor: value ? colors.brand : "transparent" }}>
          <Text style={{ color: value ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{value ? `✓ ${def.label}` : def.label}</Text>
        </Pressable>
      </View>
    );
  }
  if (def.type === "select") {
    return (
      <View>
        {label}
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {(def.options || []).map((o) => (
            <Pressable key={o} onPress={() => onChange(o)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: value === o ? colors.brand : colors.border, backgroundColor: value === o ? colors.brand : "transparent", marginRight: 8, marginBottom: 8 }}>
              <Text style={{ color: value === o ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{o}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  const kb = def.type === "number" || def.type === "currency" ? "decimal-pad" : def.type === "tel" ? "phone-pad" : def.type === "email" ? "email-address" : "default";
  const dateValue = String(value ?? "");
  const text = def.type === "date" ? (!dateValue ? "" : /^\d{4}-\d{2}-\d{2}/.test(dateValue) || typeof value === "number" ? formatDate(value) : dateValue) : String(value ?? "");
  const onTextChange = (v: string) => {
    if (def.type !== "date") return onChange(v);
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v);
    if (match) {
      const [, day, month, year] = match;
      const parsed = new Date(Number(year), Number(month) - 1, Number(day));
      if (parsed.getFullYear() === Number(year) && parsed.getMonth() === Number(month) - 1 && parsed.getDate() === Number(day)) return onChange(`${year}-${month}-${day}`);
    }
    onChange(v);
  };
  return (
    <View>
      {label}
      <TextInput testID={`field-${def.name}`} value={text} onChangeText={onTextChange} keyboardType={kb} multiline={def.type === "textarea"} autoCapitalize="none"
        placeholder={def.type === "date" ? "DD/MM/YYYY" : def.label} placeholderTextColor={colors.muted} style={[base, def.type === "textarea" ? { minHeight: 80, textAlignVertical: "top" } : null]} />
    </View>
  );
}

/** Config-driven branch-scoped CRUD screen — mobile twin of the web ResourceManager. */
export function ResourceScreen({ config }: { config: ResourceConfig }) {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const shops = useMockStore((s) => s.shops);
  const { data, loading, error } = useCollection(config.collection);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Row | null | undefined>();
  const [form, setForm] = useState<Row>({});
  const [busy, setBusy] = useState(false);
  const operation=useRef<string|null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? data.filter((r) => config.searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(q))) : data;
  }, [data, search, config.searchKeys]);

  const open = (r?: Row) => { operation.current=newOperationId();setEditing(r || null); setForm(r ? { ...r } : { ...(config.defaults || {}), ...(config.fields.some((f) => f.type === "date") ? Object.fromEntries(config.fields.filter((f) => f.type === "date").map((f) => [f.name, new Date().toISOString().slice(0, 10)])) : {}) }); };
  const save = async () => {
    const missing = config.fields.find((f) => f.required && !String(form[f.name] ?? "").trim());
    if (missing) return Alert.alert("Missing details", `${missing.label} is required.`);
    const payload: Row = { ...form };
    for (const f of config.fields) if ((f.type === "number" || f.type === "currency") && payload[f.name] !== undefined && payload[f.name] !== "") payload[f.name] = Number(payload[f.name]) || 0;
    // Web stores picked dates as epoch milliseconds.
    for (const f of config.fields) if (f.type === "date" && typeof payload[f.name] === "string") { const t = Date.parse(payload[f.name]); payload[f.name] = Number.isFinite(t) ? t : Date.now(); }
    delete payload.id;
    if(IS_NEON)payload.operation_id=operation.current||(operation.current=newOperationId());
    setBusy(true);
    try {
      if (editing?.id) await updateShopRecord(config.collection, editing.id, payload, shops);
      else await createShopRecord(config.collection, payload, shops);
      setEditing(undefined);
    } catch (e: any) { Alert.alert("Not saved", e?.message || "Check your connection and try again."); }
    finally { setBusy(false); }
  };
  const remove = (r: Row) => Alert.alert("Delete record?", "This cannot be undone.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: async () => { try { await deleteShopRecord(config.collection, r.id, shops); setEditing(undefined); } catch (e: any) { Alert.alert("Not deleted", e?.message || "Try again."); } } },
  ]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>{config.title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{config.subtitle}</Text>
        </View>
        <Pressable testID="add-record" onPress={() => open()}><Ionicons name="add-circle" size={30} color={colors.brand} /></Pressable>
      </View>
      <View style={{ paddingHorizontal: 20, paddingBottom: 8 }}>
        <TextInput testID="resource-search" value={search} onChangeText={setSearch} placeholder={`Search ${config.title.toLowerCase()}…`} placeholderTextColor={colors.muted} style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border }} />
      </View>
      {!!error && <Text style={{ color: colors.error, paddingHorizontal: 20 }}>{error}</Text>}
      <FlatList
        data={rows}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 10 }}
        ListEmptyComponent={loading ? null : <EmptyState icon="file-tray-outline" title={`No ${config.title.toLowerCase()} yet`} message={`Tap + to ${config.addLabel.toLowerCase()}`} />}
        renderItem={({ item, index }) => {
          const c = config.card(item);
          return (
            <Pressable testID={`row-${item.id}`} onPress={() => open(item)}>
              <Card>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: colors.muted, width: 24, fontWeight: "700" }}>{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.onSurface, fontWeight: "700", fontSize: 15 }}>{c.title}</Text>
                    {!!c.subtitle && <Text style={{ color: colors.muted, fontSize: 12, marginTop: 3 }}>{c.subtitle}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    {!!c.right && <Text style={{ color: colors.brand, fontWeight: "700" }}>{c.right}</Text>}
                    {!!c.badge && <Text style={{ color: colors.muted, fontSize: 11, marginTop: 3 }}>{c.badge}</Text>}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        }}
      />
      <Modal visible={editing !== undefined} animationType="slide" onRequestClose={() => setEditing(undefined)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>{editing ? `Edit ${config.title}` : config.addLabel}</Text>
              <Pressable onPress={() => setEditing(undefined)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              {config.fields.map((f) => <FieldEditor key={f.name} def={f} value={form[f.name]} onChange={(v) => setForm((s) => ({ ...s, [f.name]: v }))} />)}
              <PrimaryButton testID="resource-save" label={busy ? "Saving…" : "Save"} onPress={save} disabled={busy} gradient={gradients.brand} style={{ marginTop: 24 }} />
              {editing?.id && (
                <Pressable onPress={() => remove(editing)} style={{ alignItems: "center", padding: 14, marginTop: 12, backgroundColor: colors.errorBg, borderRadius: 12 }}>
                  <Text style={{ color: colors.error, fontWeight: "600" }}>Delete</Text>
                </Pressable>
              )}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
