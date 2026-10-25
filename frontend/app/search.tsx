import React, { useState, useMemo } from "react";
import { View, Text, ScrollView, Pressable, TextInput, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../src/theme/theme";
import { formatINR, formatTime } from "../src/utils/format";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { GlassCard, EmptyState, StatusBadge } from "../src/components/ui";

export default function SearchScreen() {
  const { colors, shadows } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const invoices = useMockStore((s) => s.invoices);
  const services = useMockStore((s) => s.services);
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<"all" | "invoices" | "services">("all");

  const results = useMemo(() => {
    if (!query.trim()) return [];

    const q = query.trim().toLowerCase();
    const filtered: any[] = [];

    // Search invoices
    if (searchType === "all" || searchType === "invoices") {
      const invoiceMatches = invoices
        .filter((inv) => shopId === "all" || inv.shop_id === shopId)
        .filter(
          (inv) =>
            inv.invoice_number?.toLowerCase().includes(q) ||
            inv.customer_name?.toLowerCase().includes(q) ||
            inv.customer_phone?.toLowerCase().includes(q) ||
            String(inv.id).toLowerCase().includes(q)
        );
      filtered.push(
        ...invoiceMatches.map((inv) => ({
          type: "invoice",
          ...inv,
        }))
      );
    }

    // Search services
    if (searchType === "all" || searchType === "services") {
      const serviceMatches = services
        .filter((svc) => shopId === "all" || svc.shop_id === shopId)
        .filter(
          (svc) =>
            svc.product?.toLowerCase().includes(q) ||
            svc.serviceName?.toLowerCase().includes(q) ||
            svc.customerName?.toLowerCase().includes(q) ||
            svc.customerPhone?.toLowerCase().includes(q)
        );
      filtered.push(
        ...serviceMatches.map((svc) => ({
          type: "service",
          ...svc,
        }))
      );
    }

    return filtered.sort((a, b) => {
      const aTime = new Date(a.created_at || a.createdAt).getTime();
      const bTime = new Date(b.created_at || b.createdAt).getTime();
      return bTime - aTime;
    });
  }, [query, searchType, invoices, services, shopId]);

  const handleInvoicePress = (invoiceId: string) => {
    router.push(`/invoice/${invoiceId}` as any);
  };

  const handleServicePress = (serviceId: string) => {
    // Navigate to service details if available, otherwise just close
    router.back();
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Pressable onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={{ color: colors.onSurface, fontSize: 24, fontWeight: "700" }}>Search</Text>
        </View>

        {/* Search Bar */}
        <View
          style={{
            backgroundColor: colors.glassLight,
            borderRadius: 14,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            height: 52,
            borderWidth: 1,
            borderColor: colors.border,
            ...shadows.sm,
          }}
        >
          <Ionicons name="search" size={20} color={colors.brand} />
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Invoice number, service, customer..."
            placeholderTextColor={colors.muted}
            autoFocus
            style={{ flex: 1, marginLeft: 12, color: colors.onSurface, fontSize: 15, fontWeight: "500" }}
          />
        </View>
      </View>

      {/* Filter Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {(["all", "invoices", "services"] as const).map((type) => (
          <Pressable
            key={type}
            testID={`filter-${type}`}
            onPress={() => setSearchType(type)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 20,
              backgroundColor: searchType === type ? colors.brand : colors.surfaceSecondary,
              borderWidth: 1,
              borderColor: searchType === type ? colors.brand : colors.border,
            }}
          >
            <Text
              style={{
                color: searchType === type ? "#FFFFFF" : colors.onSurface,
                fontWeight: "700",
                fontSize: 13,
              }}
            >
              {type === "all" ? "All" : type === "invoices" ? "Invoices" : "Services"}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Results */}
      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
        {!query.trim() ? (
          <EmptyState
            icon="search-outline"
            title="Search for invoices or services"
            message="Enter invoice number, service name, or customer details"
          />
        ) : results.length === 0 ? (
          <EmptyState
            icon="close-circle-outline"
            title="No results found"
            message={`No ${searchType === "all" ? "invoices or services" : searchType} match "${query}"`}
          />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, idx) => `${item.type}-${item.id}-${idx}`}
            contentContainerStyle={{ paddingBottom: 40, gap: 12 }}
            renderItem={({ item }) => {
              if (item.type === "invoice") {
                return (
                  <Pressable
                    testID={`search-result-invoice-${item.id}`}
                    onPress={() => handleInvoicePress(item.id)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <GlassCard>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: colors.successBg,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="receipt-outline" size={22} color={colors.success} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "700" }}>
                            {item.invoice_number}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                            {item.customer_name}
                          </Text>
                        </View>
                        <StatusBadge status={item.status} />
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          {formatTime(item.created_at)}
                        </Text>
                        <Text style={{ color: colors.brand, fontSize: 16, fontWeight: "700" }}>
                          {formatINR(item.total)}
                        </Text>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              } else if (item.type === "service") {
                return (
                  <Pressable
                    testID={`search-result-service-${item.id}`}
                    onPress={() => handleServicePress(item.id)}
                    style={({ pressed }) => ({
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <GlassCard>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 12,
                            backgroundColor: colors.infoBg,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Ionicons name="hammer-outline" size={22} color={colors.info} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: colors.onSurface, fontSize: 15, fontWeight: "700" }}>
                            {item.serviceName}
                          </Text>
                          <Text style={{ color: colors.muted, fontSize: 12, marginTop: 2 }}>
                            {item.customerName} · {item.product}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                        <Text style={{ color: colors.muted, fontSize: 12 }}>
                          Delivery: {item.expectedDelivery}
                        </Text>
                        <Text style={{ color: colors.brand, fontSize: 16, fontWeight: "700" }}>
                          {formatINR(item.price)}
                        </Text>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              }
              return null;
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
