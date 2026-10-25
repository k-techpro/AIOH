import { BrandLoader } from "@/src/components/Brand";
import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { Card } from "../src/components/ui";

export default function GstReport() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const [g, setG] = useState<any>(null);
  useEffect(() => { if (shopId) api.gstReport(shopId).then(setG); }, [shopId]);
  if (!g) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><BrandLoader style={{ marginTop: 40 }} color={colors.brand} /></SafeAreaView>;
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>GST Summary</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        <Card>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1 }}>TAXABLE SALES</Text>
          <Text style={{ color: colors.onSurface, fontSize: 30, fontWeight: "500", marginTop: 4 }}>{formatINR(g.taxable_sales, true)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{g.gst_invoices} GST invoices</Text>
        </Card>
        {[["CGST", g.cgst, colors.info], ["SGST", g.sgst, colors.info], ["IGST", g.igst, colors.muted], ["Total GST Collected", g.total_gst, colors.success]].map(([k, v, c]: any) => (
          <Card key={k}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>{k}</Text>
            <Text style={{ color: c, fontSize: 22, fontWeight: "500", marginTop: 4 }}>{formatINR(v)}</Text>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
