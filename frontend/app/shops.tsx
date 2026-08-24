import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { api } from "../src/api/client";
import { Card } from "../src/components/ui";

const { width } = Dimensions.get("window");

export default function Shops() {
  const { colors } = useTheme();
  const router = useRouter();
  const [shops, setShops] = useState<any[]>([]);
  useEffect(() => { api.listShops().then(setShops); }, []);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <Text style={{ flex: 1, color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Shops</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
        {shops.map((s) => (
          <Card key={s.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "500" }}>{s.name}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>{s.location}</Text>
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{s.gstin}</Text>
              </View>
              <View style={{ backgroundColor: colors.successBg, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                <Text style={{ color: colors.success, fontSize: 10, fontWeight: "500" }}>ACTIVE</Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", marginTop: 16, gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Today's Sales</Text>
                <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500", marginTop: 2 }}>{formatINR(s.today_sales, true)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Products</Text>
                <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "500", marginTop: 2 }}>{s.products}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 11 }}>Low Stock</Text>
                <Text style={{ color: colors.warning, fontSize: 15, fontWeight: "500", marginTop: 2 }}>{s.low_stock}</Text>
              </View>
            </View>
          </Card>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
