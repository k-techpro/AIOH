import React, { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { Card, EmptyState } from "../src/components/ui";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { useCollection } from "../src/hooks/useCollection";
import { updateShopRecord } from "../src/services/repository";
import { formatDateTime } from "../src/utils/format";

const ICON: Record<string, any> = { sale: "cart-outline", stock: "cube-outline", paylater: "time-outline", return: "return-up-back-outline", service: "construct-outline", low: "warning-outline" };
const ROUTE: Record<string, string> = { sale: "/invoice-history", stock: "/(tabs)/inventory", paylater: "/pay-later", return: "/returns", service: "/services", low: "/(tabs)/inventory" };
const ms = (v: any) => (typeof v === "number" ? v : v?.toMillis ? v.toMillis() : Date.parse(v || "") || 0);

// Notifications — the same `notifications` collection the web writes (sale / return / stock …) with read tracking,
// plus live low-stock alerts derived from inventory.
export default function Notifications() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const products = useMockStore((s) => s.products);
  const shops = useMockStore((s) => s.shops);
  const { data } = useCollection("notifications");

  const live = useMemo(
    () => products
      .filter((p: any) => (shopId === "all" || p.shop_id === shopId) && Number(p.stock) <= Number(p.lowStockAlert ?? p.min_stock ?? 5))
      .map((p: any) => ({ id: `live-${p.id}`, type: "low", title: Number(p.stock) <= 0 ? "Out of stock" : "Low stock", message: `${p.name}: ${p.stock} remaining`, read: true, createdAt: 0, live: true })),
    [products, shopId],
  );
  const rows = useMemo(() => [...data.sort((a, b) => ms(b.createdAt ?? b.created_at) - ms(a.createdAt ?? a.created_at)), ...live], [data, live]);
  const unread = data.filter((n) => !n.read);

  const markRead = (n: any) => { if (!n.read && !n.live) updateShopRecord("notifications", n.id, { read: true }, shops).catch(() => undefined); };
  const open = (n: any) => { markRead(n); router.push((ROUTE[n.type] || "/") as any); };
  const markAll = () => Promise.all(unread.map((n) => updateShopRecord("notifications", n.id, { read: true }, shops))).catch(() => undefined);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Notifications</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>{unread.length} unread · {live.length} stock alert{live.length === 1 ? "" : "s"}</Text>
        </View>
        {unread.length > 0 && <Pressable testID="notif-mark-all" onPress={markAll}><Text style={{ color: colors.brand, fontWeight: "700" }}>Mark all read</Text></Pressable>}
      </View>
      <FlatList
        data={rows}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, gap: 10 }}
        ListEmptyComponent={<EmptyState icon="notifications-outline" title="No notifications" message="Alerts about sales, stock and payments will appear here." />}
        renderItem={({ item }) => (
          <Pressable testID={`notif-${item.id}`} onPress={() => open(item)}>
            <Card style={!item.read ? { borderWidth: 1, borderColor: colors.brand } : undefined}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Ionicons name={ICON[item.type] || "notifications-outline"} size={22} color={item.type === "low" ? colors.warning : colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.onSurface, fontWeight: "700" }}>{item.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>{item.message}</Text>
                  {!!ms(item.createdAt ?? item.created_at) && <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{formatDateTime(ms(item.createdAt ?? item.created_at))}</Text>}
                </View>
                {!item.read && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} />}
              </View>
            </Card>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
