import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../src/theme/theme";
import { formatINR, formatDate } from "../../src/utils/format";
import { api } from "../../src/api/client";
import { Card, StatusBadge } from "../../src/components/ui";

export default function CustomerDetail() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<any>(null);

  useEffect(() => { if (id) api.getCustomer(id).then(setC); }, [id]);

  if (!c) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} /></SafeAreaView>;

  const aov = c.invoices.length > 0 ? c.total_purchases / c.invoices.length : 0;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 20, fontWeight: "500" }}>Customer</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: "center", marginBottom: 20 }}>
          <View style={{ width: 76, height: 76, borderRadius: 38, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <Text style={{ color: colors.onBrandPrimary, fontSize: 26, fontWeight: "500" }}>{c.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}</Text>
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>{c.name}</Text>
          <Text style={{ color: colors.muted, fontSize: 13, marginTop: 4 }}>{c.phone}</Text>
          {c.email && <Text style={{ color: colors.muted, fontSize: 12 }}>{c.email}</Text>}
          {c.gstin && <View style={{ marginTop: 8, backgroundColor: colors.infoBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}><Text style={{ color: colors.info, fontSize: 11, fontWeight: "500" }}>GST · {c.gstin}</Text></View>}
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
            <Text style={{ color: colors.success, fontSize: 18, fontWeight: "500", marginTop: 4 }}>{formatINR(c.total_paid, true)}</Text>
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
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{formatDate(inv.created_at)} · {inv.items.length} items</Text>
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
    </SafeAreaView>
  );
}
