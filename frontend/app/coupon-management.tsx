import React, { useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Card, PrimaryButton } from "../src/components/ui";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { Coupon, useMockStore } from "../src/store/mock-data";

interface CouponForm {
  code: string;
  discount: string;
  discountType: "fixed" | "percentage";
  enabled: boolean;
  minimumPurchase: string;
  maximumDiscount: string;
  advanced: boolean;
  startDate: string;
  endDate: string;
  usageLimit: string;
}

const blank: CouponForm = {
  code: "",
  discount: "",
  discountType: "fixed" as const,
  enabled: true,
  minimumPurchase: "",
  maximumDiscount: "",
  advanced: false,
  startDate: "",
  endDate: "",
  usageLimit: "",
};

export default function CouponManagement() {
  const { colors } = useTheme();
  const router = useRouter();
  const coupons = useMockStore((s) => s.coupons);
  const saveCoupon = useMockStore((s) => s.saveCoupon);
  const deleteCoupon = useMockStore((s) => s.deleteCoupon);
  const [editing, setEditing] = useState<Coupon | null | undefined>();
  const [form, setForm] = useState<CouponForm>(blank);

  const open = (coupon?: Coupon) => {
    setEditing(coupon || null);
    setForm(
      coupon
        ? {
            code: coupon.code,
            discount: String(coupon.discount),
            discountType: coupon.discountType || "fixed",
            enabled: coupon.enabled,
            minimumPurchase: coupon.minimumPurchase ? String(coupon.minimumPurchase) : "",
            maximumDiscount: coupon.maximumDiscount ? String(coupon.maximumDiscount) : "",
            advanced: !!(coupon.startDate || coupon.endDate || coupon.usageLimit),
            startDate: coupon.startDate || "",
            endDate: coupon.endDate || "",
            usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
          }
        : blank
    );
  };

  const save = async () => {
    const code = form.code.trim().toUpperCase();
    const discount = Number(form.discount);
    const minimumPurchase = form.minimumPurchase ? Number(form.minimumPurchase) : undefined;
    const maximumDiscount = form.maximumDiscount ? Number(form.maximumDiscount) : undefined;
    const usageLimit = form.usageLimit ? Number(form.usageLimit) : undefined;

    if (!code) return Alert.alert("Coupon code required", "Enter a coupon code.");
    if (!Number.isFinite(discount) || discount <= 0)
      return Alert.alert("Invalid discount", "Enter a positive numeric discount.");
    if (form.discountType === "percentage" && discount > 100)
      return Alert.alert("Invalid percentage", "Percentage discount cannot exceed 100%.");
    if (coupons.some((c) => c.code === code && c.id !== editing?.id))
      return Alert.alert("Duplicate coupon", "That coupon code already exists.");
    if (
      form.advanced &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(form.startDate) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(form.endDate) ||
        form.startDate > form.endDate)
    )
      return Alert.alert("Invalid validity", "Use YYYY-MM-DD dates with an end date on or after the start date.");

    try {
      await saveCoupon({
      id: editing?.id,
      code,
      discount,
      discountType: form.discountType,
      enabled: form.enabled,
      minimumPurchase,
      maximumDiscount,
      startDate: form.advanced ? form.startDate : undefined,
      endDate: form.advanced ? form.endDate : undefined,
      usageLimit: form.advanced ? usageLimit : undefined,
      });
      setEditing(undefined);
      Alert.alert("Coupon saved", `${code} is now available in billing.`);
    } catch (error: any) {
      Alert.alert("Coupon not saved", error?.message || "Please check your connection and try again.");
    }
  };

  const formatDiscount = (c: Coupon) => {
    if (c.discountType === "percentage") return `${c.discount}% off`;
    return `${formatINR(c.discount)} off`;
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ padding: 20, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "700" }}>Coupon Management</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Create and control billing discounts</Text>
        </View>
        <Pressable
          testID="add-coupon"
          onPress={() => open()}
          style={{ backgroundColor: colors.brand, borderRadius: 12, padding: 10 }}
        >
          <Ionicons name="add" size={22} color="#FFF" />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12 }}>
        <PrimaryButton label="Add Coupon" icon="add-circle-outline" onPress={() => open()} />
        {coupons.length === 0 && (
          <Card>
            <Text style={{ color: colors.onSurface, fontWeight: "600" }}>No coupons yet</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>Create a coupon to make it available in billing.</Text>
          </Card>
        )}
        {coupons.map((c) => (
          <Card key={c.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <View>
                <Text style={{ color: colors.onSurface, fontSize: 17, fontWeight: "700" }}>{c.code}</Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>{formatDiscount(c)}</Text>
                {c.minimumPurchase && <Text style={{ color: colors.muted, marginTop: 2, fontSize: 11 }}>Min: {formatINR(c.minimumPurchase)}</Text>}
                <Text style={{ color: c.enabled ? colors.success : colors.error, marginTop: 5, fontSize: 12, fontWeight: "700" }}>
                  {c.enabled ? "Enabled" : "Disabled"}
                  {c.startDate && c.endDate ? ` · Valid: ${c.startDate} – ${c.endDate}` : ""}
                  {c.usageLimit ? ` · Limit: ${c.usageCount || 0}/${c.usageLimit}` : ""}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 18, marginTop: 14 }}>
              <Pressable onPress={() => open(c)}>
                <Text style={{ color: colors.brand, fontWeight: "700" }}>Edit</Text>
              </Pressable>
              <Pressable onPress={() => saveCoupon({ ...c, enabled: !c.enabled })}>
                <Text style={{ color: colors.brand, fontWeight: "700" }}>{c.enabled ? "Disable" : "Enable"}</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  Alert.alert("Delete coupon?", c.code + " will be removed from billing.", [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () => deleteCoupon(c.id),
                    },
                  ])
                }
              >
                <Text style={{ color: colors.error, fontWeight: "700" }}>Delete</Text>
              </Pressable>
            </View>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={editing !== undefined} transparent animationType="slide" onRequestClose={() => setEditing(undefined)}>
        <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "#0007" }}>
          <ScrollView
            style={{ maxHeight: "90%" }}
            contentContainerStyle={{ backgroundColor: colors.surface, padding: 20, borderTopLeftRadius: 28, borderTopRightRadius: 28, gap: 10 }}
          >
            <Text style={{ color: colors.onSurface, fontSize: 21, fontWeight: "700" }}>
              {editing ? "Edit Coupon" : "Add Coupon"}
            </Text>

            <TextInput
              testID="coupon-name"
              value={form.code}
              onChangeText={(v) => setForm({ ...form, code: v })}
              autoCapitalize="characters"
              placeholder="Coupon Code (e.g., SAVE10)"
              placeholderTextColor={colors.muted}
              style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13 }}
            />

            <View>
              <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6, fontWeight: "600" }}>Discount Type</Text>
              <View style={{ flexDirection: "row", gap: 10 }}>
                {(["fixed", "percentage"] as const).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => setForm({ ...form, discountType: type })}
                    style={{
                      flex: 1,
                      padding: 12,
                      borderRadius: 12,
                      backgroundColor: form.discountType === type ? colors.brand : colors.surfaceSecondary,
                      borderWidth: 1,
                      borderColor: form.discountType === type ? colors.brand : colors.border,
                    }}
                  >
                    <Text style={{ color: form.discountType === type ? "#FFF" : colors.onSurface, fontWeight: "700", textAlign: "center" }}>
                      {type === "fixed" ? "Fixed (₹)" : "Percentage (%)"}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <TextInput
              testID="coupon-discount"
              value={form.discount}
              onChangeText={(v) => setForm({ ...form, discount: v })}
              keyboardType="numeric"
              placeholder={form.discountType === "fixed" ? "Discount Amount (₹)" : "Discount Percentage (%)"}
              placeholderTextColor={colors.muted}
              style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13 }}
            />

            <TextInput
              testID="min-purchase"
              value={form.minimumPurchase}
              onChangeText={(v) => setForm({ ...form, minimumPurchase: v })}
              keyboardType="numeric"
              placeholder="Min Purchase Amount (Optional)"
              placeholderTextColor={colors.muted}
              style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13 }}
            />

            {form.discountType === "percentage" && (
              <TextInput
                testID="max-discount"
                value={form.maximumDiscount}
                onChangeText={(v) => setForm({ ...form, maximumDiscount: v })}
                keyboardType="numeric"
                placeholder="Max Discount Amount (Optional)"
                placeholderTextColor={colors.muted}
                style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13 }}
              />
            )}

            <Pressable
              onPress={() => setForm({ ...form, enabled: !form.enabled })}
              style={{ padding: 13, borderRadius: 12, backgroundColor: form.enabled ? colors.successBg : colors.surfaceTertiary }}
            >
              <Text style={{ color: form.enabled ? colors.success : colors.muted, fontWeight: "700" }}>
                Enabled: {form.enabled ? "ON" : "OFF"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setForm({ ...form, advanced: !form.advanced })}
              style={{ padding: 13, borderRadius: 12, backgroundColor: form.advanced ? colors.brandTertiary : colors.surfaceTertiary }}
            >
              <Text style={{ color: colors.onSurface, fontWeight: "700" }}>Advanced Options: {form.advanced ? "ON" : "OFF"}</Text>
            </Pressable>

            {form.advanced && (
              <>
                <TextInput
                  value={form.startDate}
                  onChangeText={(v) => setForm({ ...form, startDate: v })}
                  placeholder="Validity Start Date (YYYY-MM-DD)"
                  placeholderTextColor={colors.muted}
                  style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13 }}
                />
                <TextInput
                  value={form.endDate}
                  onChangeText={(v) => setForm({ ...form, endDate: v })}
                  placeholder="Validity End Date (YYYY-MM-DD)"
                  placeholderTextColor={colors.muted}
                  style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13 }}
                />
                <TextInput
                  value={form.usageLimit}
                  onChangeText={(v) => setForm({ ...form, usageLimit: v })}
                  keyboardType="numeric"
                  placeholder="Usage Limit (Optional)"
                  placeholderTextColor={colors.muted}
                  style={{ color: colors.onSurface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 13 }}
                />
              </>
            )}

            <PrimaryButton testID="save-coupon" label="Save Coupon" onPress={save} />
            <Pressable onPress={() => setEditing(undefined)} style={{ alignItems: "center", padding: 10 }}>
              <Text style={{ color: colors.muted }}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
