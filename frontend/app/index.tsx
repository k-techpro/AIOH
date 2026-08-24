import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../src/theme/theme";
import { formatINR, formatPercent } from "../src/utils/format";
import { api } from "../src/api/client";
import { useAppStore } from "../src/store/shop";
import { Card, PrimaryButton } from "../src/components/ui";

export default function ShopSelection() {
  const { colors, spacing, radius, isDark } = useTheme();
  const router = useRouter();
  const setShop = useAppStore((s) => s.setShop);
  const [shops, setShops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const s = await api.listShops();
      if (s.length === 0) {
        await api.seed();
        const s2 = await api.listShops();
        setShops(s2);
      } else {
        setShops(s);
      }
    } catch (e: any) {
      setError(e.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openShop = (id: string, name: string) => {
    setShop(id, name);
    router.push("/(tabs)/dashboard");
  };

  const totalSales = shops.reduce((a, b) => a + (b.today_sales || 0), 0);
  const totalProducts = shops.reduce((a, b) => a + (b.products || 0), 0);
  const totalLow = shops.reduce((a, b) => a + (b.low_stock || 0), 0);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: colors.brand, alignItems: "center", justifyContent: "center" }}>
              <Ionicons name="storefront" size={20} color={colors.onBrandPrimary} />
            </View>
            <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "500" }}>RetailPrime</Text>
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 30, fontWeight: "500", lineHeight: 36 }}>Select your shop</Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 6 }}>Choose a shop to manage or view your entire business at a glance.</Text>
        </View>

        {loading && <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />}

        {!loading && shops.map((shop) => (
          <Pressable
            key={shop.id}
            testID={`shop-card-${shop.id}`}
            onPress={() => openShop(shop.id, shop.name)}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, marginBottom: 16 })}
          >
            <Card style={{ padding: 20 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>{shop.name}</Text>
                    <View style={{ backgroundColor: colors.successBg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                      <Text style={{ color: colors.success, fontSize: 10, fontWeight: "500" }}>ACTIVE</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                    <Ionicons name="location-outline" size={13} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 13 }}>{shop.location}</Text>
                  </View>
                </View>
                <View style={{ height: 44, width: 90 }}>
                  <LineChart
                    data={(shop.trend || [0,0,0,0,0,0,0]).map((v: number) => ({ value: v }))}
                    height={40}
                    width={90}
                    hideDataPoints hideRules hideYAxisText hideAxesAndRules
                    color={colors.brand}
                    thickness={2}
                    curved
                    initialSpacing={0}
                    endSpacing={0}
                    disableScroll
                  />
                </View>
              </View>

              <View style={{ marginTop: 20 }}>
                <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5 }}>TODAY'S SALES</Text>
                <Text style={{ color: colors.onSurface, fontSize: 28, fontWeight: "500", marginTop: 2 }}>{formatINR(shop.today_sales || 0)}</Text>
              </View>

              <View style={{ flexDirection: "row", marginTop: 16, gap: 12, borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Invoices</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "500", marginTop: 2 }}>{shop.today_invoices || 0}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Products</Text>
                  <Text style={{ color: colors.onSurface, fontSize: 16, fontWeight: "500", marginTop: 2 }}>{shop.products || 0}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.muted, fontSize: 11 }}>Low Stock</Text>
                  <Text style={{ color: shop.low_stock > 5 ? colors.warning : colors.onSurface, fontSize: 16, fontWeight: "500", marginTop: 2 }}>{shop.low_stock || 0}</Text>
                </View>
              </View>

              <View style={{ marginTop: 16, backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 6 }}>
                <Text style={{ color: colors.onBrandPrimary, fontSize: 14, fontWeight: "500" }}>Open Shop</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.onBrandPrimary} />
              </View>
            </Card>
          </Pressable>
        ))}

        {!loading && shops.length > 0 && (
          <Pressable
            testID="view-overall"
            onPress={() => openShop("all", "All Shops")}
            style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
          >
            <Card style={{ padding: 20, backgroundColor: colors.brand }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onBrandPrimary, fontSize: 11, letterSpacing: 0.5, opacity: 0.7 }}>CONSOLIDATED</Text>
                  <Text style={{ color: colors.onBrandPrimary, fontSize: 20, fontWeight: "500", marginTop: 2 }}>View Overall Business</Text>
                  <Text style={{ color: colors.onBrandPrimary, fontSize: 13, opacity: 0.8, marginTop: 4 }}>
                    {formatINR(totalSales)} · {totalProducts} products · {totalLow} need attention
                  </Text>
                </View>
                <Ionicons name="arrow-forward-circle" size={32} color={colors.onBrandPrimary} />
              </View>
            </Card>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
