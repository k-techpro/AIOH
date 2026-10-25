import React, { useMemo, useState } from "react";
import { Alert, FlatList, Image, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { getDownloadURL, getStorage, putFile, ref } from "@react-native-firebase/storage";
import { useTheme } from "../src/theme/theme";
import { Card, EmptyState, PrimaryButton } from "../src/components/ui";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { useBusiness } from "../src/services/business";
import { useCollection } from "../src/hooks/useCollection";
import { branchLabel } from "../src/domain/listTools.ts";
import { submitAttendance } from "../src/services/repository";

// Attendance — same evidence-based flow as the web app: ONE record per branch/user/day, photo evidence required
// unless an OWNER/ADMIN records an authorised (audited) manual correction.
export default function Attendance() {
  const { colors, gradients } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const shops = useMockStore((s) => s.shops);
  const shop = shops.find((s: any) => s.id === shopId);
  const access = useBusiness((b) => b.access);
  const businessId = useBusiness((b) => b.businessId);
  const user = getAuth(getApp()).currentUser;
  const { data } = useCollection("attendance");
  const [photo, setPhoto] = useState<{ uri: string; captured_at: string } | null>(null);
  const [manual, setManual] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const date = new Date().toLocaleDateString("en-CA");
  const isAdmin = ["OWNER", "ADMIN"].includes(access?.role || "");
  const mine = useMemo(() => data.find((r) => r.id === `${shopId}_${user?.uid}_${date}`), [data, shopId, user?.uid, date]);

  const capture = async () => {
    const p = await ImagePicker.requestCameraPermissionsAsync();
    if (!p.granted) return Alert.alert("Camera permission required", "Allow camera access to capture attendance evidence.");
    const r = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6 });
    if (!r.canceled) setPhoto({ uri: r.assets[0].uri, captured_at: new Date().toISOString() });
  };

  const save = async () => {
    setMessage("");
    if ((!manual && !photo) || (manual && !reason.trim())) return setMessage("Photo evidence or an authorized correction reason is required.");
    if (!user || !businessId || !shopId || shopId === "all") return setMessage("Select a branch first.");
    setBusy(true);
    try {
      let evidence: Record<string, any> = {};
      if (!manual && photo) {
        const path = `users/${businessId}/attendance/${shopId}/${user.uid}/${date}/${Date.now()}.jpg`;
        const r = ref(getStorage(getApp()), path);
        await putFile(r, photo.uri, { contentType: "image/jpeg" });
        evidence = { photo_url: await getDownloadURL(r), photo_storage_path: path, captured_at: photo.captured_at };
      }
      await submitAttendance({ date, staffName: user.displayName || user.email || "Staff", evidence, manual, reason }, shops);
      setPhoto(null); setReason(""); setManual(false);
      setMessage("Attendance submitted.");
    } catch (e: any) {
      setMessage(String(e?.code || "").startsWith("storage/") ? `Photo upload failed (${e.code}). Attendance was not submitted. Retry when Storage access is available.` : e?.message || "Could not submit attendance.");
    } finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Attendance · {branchLabel(shop)}</Text>
      </View>
      <FlatList
        data={data}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListHeaderComponent={
          <Card style={{ marginBottom: 6 }}>
            <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{user?.displayName || user?.email}</Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{date}{mine ? " · already submitted today" : ""}</Text>
            {isAdmin && (
              <Pressable onPress={() => setManual((m) => !m)} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.brand, fontWeight: "700" }}>{manual ? "☑" : "☐"} Manual correction</Text>
              </Pressable>
            )}
            {manual ? (
              <TextInput testID="att-reason" value={reason} onChangeText={setReason} placeholder="Reason for correction (required)" placeholderTextColor={colors.muted} style={{ marginTop: 10, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, color: colors.onSurface }} />
            ) : (
              <View style={{ marginTop: 10 }}>
                <Pressable testID="att-capture" onPress={capture} style={{ padding: 12, borderRadius: 12, backgroundColor: photo ? colors.successBg : colors.surfaceSecondary }}>
                  <Text style={{ color: photo ? colors.success : colors.brand, fontWeight: "700" }}>{photo ? "Photo captured — tap to retake" : "Capture photo evidence"}</Text>
                </Pressable>
                {photo && <Image source={{ uri: photo.uri }} style={{ width: 120, height: 120, borderRadius: 12, marginTop: 10 }} />}
              </View>
            )}
            {!!message && <Text testID="att-message" style={{ color: message.startsWith("Attendance submitted") ? colors.success : colors.error, marginTop: 10 }}>{message}</Text>}
            <PrimaryButton testID="att-submit" label={busy ? "Submitting…" : "Submit attendance"} onPress={save} disabled={busy} gradient={gradients.brand} style={{ marginTop: 12 }} />
          </Card>
        }
        ListEmptyComponent={<EmptyState icon="calendar-outline" title="No attendance yet" message="Submitted attendance appears here." />}
        renderItem={({ item }) => (
          <Card>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              {item.photo_url ? <Image source={{ uri: item.photo_url }} style={{ width: 44, height: 44, borderRadius: 10 }} /> : <Ionicons name="person-circle-outline" size={44} color={colors.muted} />}
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.staffName || item.staff_id}</Text>
                <Text style={{ color: colors.muted, fontSize: 12 }}>{item.date || item.attendance_date} · in {item.checkIn || "—"}{item.manual_override ? " · manual" : ""}</Text>
              </View>
              <Text style={{ color: colors.success, fontWeight: "700" }}>{item.status}</Text>
            </View>
          </Card>
        )}
      />
    </SafeAreaView>
  );
}
