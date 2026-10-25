import { BrandLoader } from "@/src/components/Brand";
import React, { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {listenCollection}from "../src/services/repository";
import {DATABASE_BACKEND}from "../src/services/databaseBackend";
import { getApp } from "@react-native-firebase/app";
import { getAuth } from "@react-native-firebase/auth";
import { useTheme } from "../src/theme/theme";
import { useAuthStore } from "../src/services/auth";

const collections = ["customers", "products", "inventoryMovements", "sales", "invoices", "payments", "expenses", "transfers", "shops", "staff", "attendance", "coupons", "notifications", "settings", "services"];
export default function FirebaseViewer() {
  const { colors } = useTheme(); const router = useRouter(); const user = useAuthStore(s => s.user);
  const [selected, setSelected] = useState("customers"), [records, setRecords] = useState<any[]>([]), [loading, setLoading] = useState(false), [error, setError] = useState<string | null>(null);
  const app = getApp();
  const [result, setResult] = useState("Not yet queried");
  const load = useCallback(async () => { if (!user) { setError("No authenticated Firebase user."); return; } setLoading(true); setError(null); try { const result=await new Promise<any[]>((resolve,reject)=>{let stop=()=>{};stop=listenCollection(selected,rows=>{stop();resolve(rows);},error=>{stop();reject(error);});});setRecords(result);setResult('SUCCESS: '+result.length+' '+selected+' record(s)'); } catch (e: any) { const detail = `${e?.code || "unknown"}: ${e?.message || "Unable to load business records."}`; setError(detail); setResult(`FAIL: ${detail}`); } finally { setLoading(false); } }, [selected, user]);
  useEffect(() => { load(); }, [load]);
  const diagnostics = `Project: ${app.options.projectId || "unknown"}\nApp ID: ${app.options.appId || "unknown"}\nAuth UID: ${getAuth(app).currentUser?.uid || "none"}\nDatabase: ${DATABASE_BACKEND}\nRead: ${result}`;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><View style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 12 }}><Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface}/></Pressable><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Business Data</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Read-only cloud records</Text></View><Pressable onPress={load}><Ionicons name="refresh" size={22} color={colors.brand}/></Pressable></View><View style={{ marginHorizontal: 20, padding: 12, borderRadius: 10, backgroundColor: colors.surfaceSecondary }}><Text selectable style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{diagnostics}</Text></View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, gap: 8 }}>{collections.map(name => <Pressable key={name} onPress={() => setSelected(name)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: selected === name ? colors.brand : colors.surfaceSecondary }}><Text style={{ color: selected === name ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 12 }}>{name}</Text></Pressable>)}</ScrollView><View style={{ padding: 20, paddingBottom: 0 }}><Text style={{ color: colors.muted, fontSize: 13 }}>{records.length} {selected} record{records.length === 1 ? "" : "s"}</Text></View>{loading ? <BrandLoader style={{ marginTop: 40 }} color={colors.brand}/> : error ? <View style={{ padding: 24, alignItems: "center" }}><Text style={{ color: colors.error, textAlign: "center" }}>{error}</Text><Pressable onPress={load} style={{ marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: colors.brand }}><Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Retry</Text></Pressable></View> : <ScrollView contentContainerStyle={{ padding: 20, gap: 10 }}>{records.length === 0 ? <Text style={{ color: colors.muted, textAlign: "center", marginTop: 30 }}>No cloud records in this collection.</Text> : records.map(record => <View key={record.id} style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceSecondary }}><Text style={{ color: colors.brand, fontWeight: "700", marginBottom: 6 }}>{record.id}</Text><Text selectable style={{ color: colors.onSurface, fontSize: 12, lineHeight: 18 }}>{JSON.stringify(record, null, 2)}</Text></View>)}</ScrollView>}</SafeAreaView>;
}
