import React, { useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMockStore } from "../../src/store/mock-data";
import { useTheme } from "../../src/theme/theme";
import { formatDate, formatINR } from "../../src/utils/format";
import { shareInvoicePdf } from "../../src/services/invoice-storage";
import { buildInvoiceWhatsAppMessage, whatsAppUrl } from "../../src/domain/whatsapp.ts";

// Web invoices carry price/qty/discount% per line (no stored subtotal) — compute the line amount.
const lineAmount = (i: any) => Number(i.subtotal ?? Number(i.price || 0) * Number(i.quantity ?? i.qty ?? 0) * (1 - Number(i.discount || 0) / 100));

export default function InvoiceDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const invoice = useMockStore(s => s.invoices.find(item => item.id === id));
  const [sharing, setSharing] = useState(false);
  if (!invoice) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><Text style={{ color: colors.onSurface }}>Invoice not found.</Text><Pressable onPress={() => router.back()}><Text style={{ color: colors.brand, marginTop: 12 }}>Go back</Text></Pressable></SafeAreaView>;
  const share = async () => { try { setSharing(true); await shareInvoicePdf(invoice); } catch (error: any) { Alert.alert("Unable to share invoice", error?.message || "Please try again."); } finally { setSharing(false); } };
  const whatsApp = (includeUrl: boolean) => {
    const url = whatsAppUrl(invoice.customer_phone, buildInvoiceWhatsAppMessage(invoice, { branchName: invoice.branch_name || invoice.shop_name, includeUrl }));
    if (!url) return Alert.alert("WhatsApp", "No valid WhatsApp number for this customer.");
    Linking.openURL(url).catch(() => Alert.alert("WhatsApp", "Could not open WhatsApp."));
  };
  const payments = invoice.paymentBreakdown || invoice.payment_breakdown || [];
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.surface }}><View style={{ padding: 20, flexDirection: "row", gap: 12, alignItems: "center" }}><Pressable onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface}/></Pressable><View style={{ flex: 1 }}><Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700" }}>{invoice.invoice_number}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{formatDate(invoice.created_at)} · {invoice.branch_name || invoice.shop_name}</Text></View><Pressable testID="invoice-whatsapp" onPress={() => whatsApp(!!(invoice.storage_url || invoice.documentUrl))}><Ionicons name="logo-whatsapp" size={22} color={colors.brand}/></Pressable>{invoice.storage_url && <><Pressable onPress={() => Linking.openURL(invoice.storage_url!)}><Ionicons name="open-outline" size={22} color={colors.brand}/></Pressable><Pressable onPress={share} disabled={sharing}><Ionicons name="share-outline" size={22} color={colors.brand}/></Pressable></>}</View><ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}><View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceSecondary }}><Text style={{ color: colors.brand, fontWeight: "800" }}>{invoice.business_name || "ALL IN ONE HUB"}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Branch: {invoice.branch_name || invoice.shop_name}</Text></View><View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceSecondary }}><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{invoice.customer_name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>{invoice.customer_phone || "Walk-in customer"}</Text>{invoice.customer_email && <Text style={{ color: colors.muted, fontSize: 12 }}>{invoice.customer_email}</Text>}{invoice.customer_address && <Text style={{ color: colors.muted, fontSize: 12 }}>{invoice.customer_address}</Text>}{invoice.customer_gstin && <Text style={{ color: colors.muted, fontSize: 12 }}>Customer GSTIN: {invoice.customer_gstin}</Text>}</View>{invoice.items.map((item: any) => <View key={item.product_id} style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceSecondary, flexDirection: "row", justifyContent: "space-between" }}><View><Text style={{ color: colors.onSurface, fontWeight: "600" }}>{item.name}</Text><Text style={{ color: colors.muted, fontSize: 12 }}>Qty {item.quantity} × {formatINR(item.price)} · Discount {item.discount || 0}% · GST {item.gst || 0}%</Text></View><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{formatINR(lineAmount(item))}</Text></View>)}<View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.surfaceSecondary, gap: 6 }}>{[["Subtotal", invoice.subtotal], ["Discount", -invoice.discount], ["Tax", invoice.gst], ["Grand Total", invoice.total], ["Total Paid", invoice.amount_paid], ["Pending", invoice.balance_due]].map(([label, value]) => <View key={String(label)} style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: colors.muted }}>{label}</Text><Text style={{ color: colors.onSurface, fontWeight: "700" }}>{formatINR(Number(value))}</Text></View>)}{payments.map((entry:any,index:number)=><Text key={index} style={{ color: colors.muted, fontSize: 12 }}>{entry.method}: {formatINR(Number(entry.amount))}</Text>)}<Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>Status: {(invoice.paymentStatus || invoice.payment_status || invoice.status || "due").toUpperCase()}</Text></View>{!invoice.storage_url && <Text style={{ color: colors.muted, textAlign: "center", marginTop: 8 }}>The invoice PDF is being prepared.</Text>}</ScrollView></SafeAreaView>;
}
