import React, { useMemo, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { Card, EmptyState, PrimaryButton } from "../src/components/ui";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { useCollection } from "../src/hooks/useCollection";
import { createShopRecord, deleteShopRecord, updateShopRecord } from "../src/services/repository";

type Item = { id: string; text: string; done: boolean };
type Draft = { title: string; body: string; checklistMode: boolean; checklist: Item[]; scope: "branch" | "general" };
const newItem = (text = ""): Item => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, text, done: false });
const ms = (v: any) => (typeof v === "number" ? v : v?.toMillis ? v.toMillis() : Date.parse(v || "") || 0);

// Notes — same `notes` collection / fields as web: branch notes carry shop_id, "General" notes carry shop_id:null.
export default function Notes() {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const shops = useMockStore((s) => s.shops);
  const shop = shops.find((s: any) => s.id === shopId);
  const { data } = useCollection("notes");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"active" | "archived">("active");
  const [editing, setEditing] = useState<any | null | undefined>();
  const [draft, setDraft] = useState<Draft>({ title: "", body: "", checklistMode: false, checklist: [], scope: "branch" });
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data
      .filter((n) => n.shop_id === shopId || n.shop_id == null)
      .filter((n) => !!n.archived === (view === "archived"))
      .filter((n) => !q || [n.title, n.body, ...(n.checklist || []).map((i: Item) => i.text)].some((v) => String(v || "").toLowerCase().includes(q)))
      .sort((a, b) => Number(!!b.pinned) - Number(!!a.pinned) || ms(b.updatedAt ?? b.updated_at) - ms(a.updatedAt ?? a.updated_at));
  }, [data, shopId, search, view]);

  const open = (n?: any) => {
    setEditing(n || null);
    setDraft(n ? { title: n.title || "", body: n.body || "", checklistMode: (n.checklist || []).length > 0, checklist: (n.checklist || []).map((i: Item) => ({ ...i })), scope: n.shop_id ? "branch" : "general" } : { title: "", body: "", checklistMode: false, checklist: [], scope: "branch" });
  };
  const save = async () => {
    if (!draft.title.trim() && !draft.body.trim() && draft.checklist.every((i) => !i.text.trim())) { setEditing(undefined); return; }
    setBusy(true);
    try {
      const fields = {
        title: draft.title.trim(), body: draft.body.trim(), checklist: draft.checklistMode ? draft.checklist.filter((i) => i.text.trim()) : [],
        shop_id: draft.scope === "branch" ? shopId : null, branchId: draft.scope === "branch" ? shop?.slug || shopId : null,
      };
      if (editing?.id) await updateShopRecord("notes", editing.id, fields, shops);
      else await createShopRecord("notes", { ...fields, pinned: false, archived: false }, shops);
      setEditing(undefined);
    } catch (e: any) { Alert.alert("Note not saved", e?.message || "Try again."); }
    finally { setBusy(false); }
  };
  const patch = (n: any, fields: any) => updateShopRecord("notes", n.id, fields, shops).catch((e) => Alert.alert("Note not updated", e?.message || "Try again."));
  const remove = (n: any) => Alert.alert("Delete note?", "This cannot be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => deleteShopRecord("notes", n.id, shops).then(() => setEditing(undefined)).catch((e) => Alert.alert("Not deleted", e?.message)) }]);

  const field = { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, fontSize: 15 } as const;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Notes</Text>
        <Pressable testID="add-note" onPress={() => open()}><Ionicons name="add-circle" size={30} color={colors.brand} /></Pressable>
      </View>
      <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 10 }}>
        <TextInput testID="notes-search" value={search} onChangeText={setSearch} placeholder="Search notes…" placeholderTextColor={colors.muted} style={field} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["active", "archived"] as const).map((v) => (
            <Pressable key={v} onPress={() => setView(v)} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: view === v ? colors.brand : colors.border, backgroundColor: view === v ? colors.brand : "transparent" }}>
              <Text style={{ color: view === v ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", textTransform: "capitalize" }}>{v}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <FlatList
        data={list}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListEmptyComponent={<EmptyState icon="reader-outline" title={view === "archived" ? "No archived notes" : "No notes yet"} message="Tap + to write a note" />}
        renderItem={({ item }) => (
          <Pressable testID={`note-${item.id}`} onPress={() => open(item)}>
            <Card>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700", flex: 1 }}>{item.pinned ? "📌 " : ""}{item.title || "Untitled"}</Text>
                <Text style={{ color: colors.muted, fontSize: 11 }}>{item.shop_id ? "Branch" : "General"}</Text>
              </View>
              {!!item.body && <Text numberOfLines={3} style={{ color: colors.muted, marginTop: 6 }}>{item.body}</Text>}
              {(item.checklist || []).slice(0, 4).map((i: Item) => <Text key={i.id} style={{ color: colors.muted, marginTop: 3 }}>{i.done ? "☑" : "☐"} {i.text}</Text>)}
              <View style={{ flexDirection: "row", gap: 18, marginTop: 10 }}>
                <Pressable onPress={() => patch(item, { pinned: !item.pinned })}><Text style={{ color: colors.brand, fontWeight: "600" }}>{item.pinned ? "Unpin" : "Pin"}</Text></Pressable>
                <Pressable onPress={() => patch(item, { archived: !item.archived, ...(item.archived ? {} : { pinned: false }) })}><Text style={{ color: colors.warning, fontWeight: "600" }}>{item.archived ? "Restore" : "Archive"}</Text></Pressable>
              </View>
            </Card>
          </Pressable>
        )}
      />
      <Modal visible={editing !== undefined} animationType="slide" onRequestClose={() => setEditing(undefined)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
            <View style={{ padding: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>{editing ? "Edit note" : "New note"}</Text>
              <Pressable onPress={() => setEditing(undefined)}><Ionicons name="close" size={26} color={colors.onSurface} /></Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
              <TextInput testID="note-title" value={draft.title} onChangeText={(v) => setDraft((d) => ({ ...d, title: v }))} placeholder="Title" placeholderTextColor={colors.muted} style={field} />
              {!draft.checklistMode ? (
                <TextInput testID="note-body" value={draft.body} onChangeText={(v) => setDraft((d) => ({ ...d, body: v }))} placeholder="Take a note…" placeholderTextColor={colors.muted} multiline style={[field, { minHeight: 120, textAlignVertical: "top" }]} />
              ) : (
                <View style={{ gap: 8 }}>
                  {draft.checklist.map((i) => (
                    <View key={i.id} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                      <Pressable onPress={() => setDraft((d) => ({ ...d, checklist: d.checklist.map((x) => (x.id === i.id ? { ...x, done: !x.done } : x)) }))}><Ionicons name={i.done ? "checkbox" : "square-outline"} size={24} color={colors.brand} /></Pressable>
                      <TextInput value={i.text} onChangeText={(v) => setDraft((d) => ({ ...d, checklist: d.checklist.map((x) => (x.id === i.id ? { ...x, text: v } : x)) }))} placeholder="List item" placeholderTextColor={colors.muted} style={[field, { flex: 1 }]} />
                      <Pressable onPress={() => setDraft((d) => ({ ...d, checklist: d.checklist.filter((x) => x.id !== i.id) }))}><Ionicons name="close" size={20} color={colors.muted} /></Pressable>
                    </View>
                  ))}
                  <Pressable onPress={() => setDraft((d) => ({ ...d, checklist: [...d.checklist, newItem()] }))}><Text style={{ color: colors.brand, fontWeight: "700" }}>+ Add item</Text></Pressable>
                </View>
              )}
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
                <Pressable onPress={() => setDraft((d) => ({ ...d, checklistMode: !d.checklistMode, checklist: !d.checklistMode && !d.checklist.length ? [newItem()] : d.checklist }))} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: colors.border }}><Text style={{ color: colors.onSurface, fontWeight: "600" }}>{draft.checklistMode ? "Switch to text" : "Checklist"}</Text></Pressable>
                {(["branch", "general"] as const).map((sc) => (
                  <Pressable key={sc} onPress={() => setDraft((d) => ({ ...d, scope: sc }))} style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: draft.scope === sc ? colors.brand : colors.border, backgroundColor: draft.scope === sc ? colors.brand : "transparent" }}>
                    <Text style={{ color: draft.scope === sc ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600" }}>{sc === "branch" ? "This branch" : "General / all branches"}</Text>
                  </Pressable>
                ))}
              </View>
              <PrimaryButton testID="note-save" label={busy ? "Saving…" : "Save note"} onPress={save} disabled={busy} gradient={gradients.brand} />
              {editing?.id && <Pressable onPress={() => remove(editing)} style={{ alignItems: "center", padding: 14, backgroundColor: colors.errorBg, borderRadius: 12 }}><Text style={{ color: colors.error, fontWeight: "600" }}>Delete note</Text></Pressable>}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
