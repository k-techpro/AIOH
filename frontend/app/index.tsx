import { BrandMark } from "@/src/components/Brand";
import { BrandLoader } from "@/src/components/Brand";
import React from "react";
import { View, Text, Pressable, ScrollView, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { LineChart } from "react-native-gifted-charts";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { useMockStore } from "../src/store/mock-data";
import { useAppStore } from "../src/store/shop";
import { activeBranches } from "../src/domain/branches.ts";
import { branchLabel } from "../src/domain/listTools.ts";
import { GlassCard, PrimaryButton } from "../src/components/ui";

export default function ShopSelection() {
  const { colors, spacing, radius, isDark, shadows, gradients } = useTheme();
  const router = useRouter();
  const setShop = useAppStore((s) => s.setShop);
  const products = useMockStore((s) => s.products);
  const invoices = useMockStore((s) => s.invoices);
  const shops = useMockStore((s) => s.shops);
  const loading = useMockStore((s) => s.loading);

  const openShop = (id: string, name: string) => {
    setShop(id, name);
    router.push("/(tabs)/dashboard");
  };

  const totalSales = invoices.reduce((a, b) => a + b.total, 0);
  const totalProducts = products.length;
  const totalLow = products.filter(p => p.stock <= p.min_stock).length;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        <View style={{ marginBottom: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                ...shadows.md,
              }}
            >
              <BrandMark size={44} />
            </LinearGradient>
            <Text style={{ color: colors.brand, fontSize: 22, fontWeight: "700", letterSpacing: -0.5 }}>
              RetailPrime
            </Text>
          </View>
          <Text style={{ color: colors.onSurface, fontSize: 32, fontWeight: "700", lineHeight: 38 }}>
            Select your shop
          </Text>
          <Text style={{ color: colors.muted, fontSize: 14, marginTop: 8, lineHeight: 20 }}>
            Choose a shop to manage or view your entire business at a glance.
          </Text>
        </View>

        {loading && <BrandLoader style={{ marginTop: 40 }} color={colors.brand} />}

        {/* Shop Cards */}
        {!loading &&
          (activeBranches(shops) as any[]).map((sourceShop: any) => {
            const shop = {
              ...sourceShop,
              today_sales: invoices.filter(invoice => invoice.shop_id === sourceShop.id && invoice.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).reduce((sum, invoice) => sum + Number(invoice.total || 0), 0),
              today_invoices: invoices.filter(invoice => invoice.shop_id === sourceShop.id && invoice.created_at?.slice(0, 10) === new Date().toISOString().slice(0, 10)).length,
              products: products.filter(product => product.shop_id === sourceShop.id).length,
              low_stock: products.filter(product => product.shop_id === sourceShop.id && product.stock <= product.min_stock).length,
            };
            return (
            <Pressable
              key={shop.id}
              testID={`shop-card-${shop.id}`}
              onPress={() => openShop(shop.id, branchLabel(shop))}
              style={({ pressed }) => ({
                marginBottom: 16,
                transform: [{ scale: pressed ? 0.98 : 1 }],
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <GlassCard style={{ padding: 20 }}>
                {/* Shop Header */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700" }}>{branchLabel(shop)}</Text>
                      <View
                        style={{
                          backgroundColor: colors.successBg,
                          paddingHorizontal: 10,
                          paddingVertical: 4,
                          borderRadius: 8,
                        }}
                      >
                        <Text style={{ color: colors.success, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>
                          ACTIVE
                        </Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                      <Ionicons name="location" size={14} color={colors.muted} />
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500" }}>{shop.location}</Text>
                    </View>
                  </View>

                  {/* Mini Sparkline */}
                  <View
                    style={{
                      height: 48,
                      width: 100,
                      backgroundColor: colors.brand + "10",
                      borderRadius: 10,
                      padding: 4,
                      overflow: "hidden",
                    }}
                  >
                    <LineChart
                      data={(shop.trend || [0, 0, 0, 0, 0, 0, 0]).map((v: number) => ({ value: v }))}
                      height={40}
                      width={92}
                      hideDataPoints
                      hideRules
                      hideYAxisText
                      hideAxesAndRules
                      color={colors.brand}
                      thickness={2}
                      curved
                      initialSpacing={0}
                      endSpacing={0}
                      disableScroll
                    />
                  </View>
                </View>

                {/* Today's Sales */}
                <View style={{ marginTop: 20 }}>
                  <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.8, fontWeight: "600" }}>
                    TODAY&apos;S SALES
                  </Text>
                  <Text style={{ color: colors.brand, fontSize: 32, fontWeight: "800", marginTop: 4 }}>
                    {formatINR(shop.today_sales || 0)}
                  </Text>
                </View>

                {/* Stats Row */}
                <View
                  style={{
                    flexDirection: "row",
                    marginTop: 20,
                    gap: 16,
                    paddingTop: 16,
                    borderTopWidth: 1,
                    borderTopColor: colors.glassBorder,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>Invoices</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: 4 }}>
                      {shop.today_invoices || 0}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>Products</Text>
                    <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "700", marginTop: 4 }}>
                      {shop.products || 0}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>Low Stock</Text>
                    <Text
                      style={{
                        color: shop.low_stock > 5 ? colors.warning : colors.success,
                        fontSize: 18,
                        fontWeight: "700",
                        marginTop: 4,
                      }}
                    >
                      {shop.low_stock || 0}
                    </Text>
                  </View>
                </View>

                {/* Open Button */}
                <Pressable
                  style={({ pressed }) => ({
                    marginTop: 20,
                    opacity: pressed ? 0.8 : 1,
                  })}
                  onPress={() => openShop(shop.id, branchLabel(shop))}
                >
                  <LinearGradient
                    colors={gradients.brand}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      borderRadius: 12,
                      paddingVertical: 14,
                      alignItems: "center",
                      flexDirection: "row",
                      justifyContent: "center",
                      gap: 8,
                      ...shadows.md,
                    }}
                  >
                    <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "700" }}>Open Shop</Text>
                    <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                  </LinearGradient>
                </Pressable>
              </GlassCard>
            </Pressable>
          );
          })}

        {/* Overall Business Card */}
        {!loading && shops.length > 0 && (
          <Pressable
            testID="view-overall"
            onPress={() => openShop("all", "All Shops")}
            style={({ pressed }) => ({
              transform: [{ scale: pressed ? 0.98 : 1 }],
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <LinearGradient
              colors={gradients.brand}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 18,
                padding: 20,
                ...shadows.lg,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "rgba(255,255,255,0.7)", fontSize: 10, letterSpacing: 1, fontWeight: "700" }}
                  >
                    CONSOLIDATED VIEW
                  </Text>
                  <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "700", marginTop: 6 }}>
                    View Overall Business
                  </Text>
                  <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13, marginTop: 8, lineHeight: 18 }}>
                    {formatINR(totalSales)} · {totalProducts} products
                    {totalLow > 0 && ` · ${totalLow} need attention`}
                  </Text>
                </View>
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: "rgba(255,255,255,0.2)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="arrow-forward" size={24} color="#FFFFFF" />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
