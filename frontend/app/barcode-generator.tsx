import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SvgXml } from "react-native-svg";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useTheme } from "../src/theme/theme";
import { formatINR } from "../src/utils/format";
import { useAppStore } from "../src/store/shop";
import { useMockStore } from "../src/store/mock-data";
import { Card, PrimaryButton, SecondaryButton } from "../src/components/ui";
import { searchProducts } from "../src/domain/productCodes.ts";
import { code128Svg, productQrPayload, qrSvg } from "../src/domain/barcodeSvg.ts";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
// height / width of an SVG from its viewBox, so SvgXml can be sized proportionally.
const aspect = (svg: string) => { const m = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg); return m ? Number(m[2]) / Number(m[1]) : 0.3; };
const codeOf = (p: any) => String(p.product_code || p.barcode || p.sku || "").trim();

/** Printable label sheet: name, price, REAL CODE128 barcode and (optionally) the AIOH QR, repeated `copies` times. */
function labelHtml(p: any, copies: number, withQr: boolean) {
  const code = codeOf(p);
  const bar = code128Svg(code, { height: 60, module: 2 });
  const qr = withQr ? qrSvg(productQrPayload(code), { size: 90 }) : "";
  const one = `<div class="label"><div class="name">${esc(p.name)}</div><div class="price">${formatINR(Number(p.price ?? p.selling_price ?? 0))}</div><div class="codes">${bar}${qr}</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8"/><style>@page{margin:6mm}body{font-family:Arial;margin:0}.label{display:inline-block;width:62mm;border:1px dashed #bbb;padding:3mm;margin:1.5mm;text-align:center;vertical-align:top;page-break-inside:avoid}.name{font-size:12px;font-weight:700}.price{font-size:15px;font-weight:700;margin:2px 0}.codes{display:flex;justify-content:center;align-items:center;gap:6px}.codes svg{max-width:100%;height:auto}</style></head><body>${Array.from({ length: copies }, () => one).join("")}</body></html>`;
}

// Barcode / QR generator — real CODE128 + QR (same encoders as the web app), printed through the system print dialog.
export default function BarcodeGen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { shopId } = useAppStore();
  const products = useMockStore((s) => s.products);
  const [selected, setSelected] = useState<any>(null);
  const [copies, setCopies] = useState("1");
  const [search, setSearch] = useState("");
  const [withQr, setWithQr] = useState(true);

  const list = useMemo(() => searchProducts(products.filter((p: any) => shopId === "all" || p.shop_id === shopId), search).slice(0, 25), [products, shopId, search]);
  const code = selected ? codeOf(selected) : "";
  const preview = useMemo(() => {
    if (!code) return null;
    try { return { bar: code128Svg(code, { height: 70, module: 2 }), qr: qrSvg(productQrPayload(code), { size: 110 }) }; } catch { return null; }
  }, [code]);
  const n = Math.min(100, Math.max(1, Math.floor(Number(copies) || 1)));

  const print = async () => {
    if (!selected || !code) return Alert.alert("Select a product", "Pick a product that has a product code.");
    try { await Print.printAsync({ html: labelHtml(selected, n, withQr) }); } catch (e: any) { Alert.alert("Print failed", e?.message || "Try again."); }
  };
  const sharePdf = async () => {
    if (!selected || !code) return Alert.alert("Select a product", "Pick a product that has a product code.");
    try {
      const { uri } = await Print.printToFileAsync({ html: labelHtml(selected, n, withQr) });
      if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device.");
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: `Labels ${selected.name}` });
    } catch (e: any) { Alert.alert("Share failed", e?.message || "Try again."); }
  };

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable testID="back" onPress={() => router.back()}><Ionicons name="chevron-back" size={26} color={colors.onSurface} /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.onSurface, fontSize: 22, fontWeight: "500" }}>Barcode & QR Labels</Text>
          <Text style={{ color: colors.muted, fontSize: 12 }}>Print labels for your products</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 0.5, marginBottom: 8 }}>PREVIEW</Text>
          {selected && preview ? (
            <View style={{ alignItems: "center", padding: 16, backgroundColor: "#FFFFFF", borderRadius: 10 }}>
              <Text style={{ color: "#000", fontSize: 15, fontWeight: "600" }}>{selected.name}</Text>
              <Text style={{ color: "#111", fontSize: 20, fontWeight: "600", marginTop: 4 }}>{formatINR(Number(selected.price ?? selected.selling_price ?? 0))}</Text>
              <View testID="barcode-preview" style={{ marginTop: 12, alignItems: "center", gap: 10 }}>
                <SvgXml xml={preview.bar} width={260} height={260 * aspect(preview.bar)} />
                {withQr && <SvgXml xml={preview.qr} width={110} height={110} />}
              </View>
            </View>
          ) : (
            <View style={{ padding: 40, alignItems: "center" }}>
              <Ionicons name="barcode-outline" size={48} color={colors.muted} />
              <Text style={{ color: colors.muted, marginTop: 8 }}>{selected ? "This product has no code to encode." : "Select a product to preview"}</Text>
            </View>
          )}
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12, alignItems: "center" }}>
            <Text style={{ color: colors.muted, fontSize: 12 }}>Copies</Text>
            <TextInput testID="copies" value={copies} onChangeText={setCopies} keyboardType="number-pad" style={{ flex: 1, backgroundColor: colors.surfaceTertiary, borderRadius: 10, padding: 10, color: colors.onSurface }} />
            <Pressable onPress={() => setWithQr((v) => !v)}><Text style={{ color: colors.brand, fontWeight: "700" }}>{withQr ? "☑" : "☐"} QR</Text></Pressable>
          </View>
          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}><PrimaryButton testID="print-btn" label="Print" onPress={print} icon="print-outline" /></View>
            <View style={{ flex: 1 }}><SecondaryButton testID="share-labels" label="Share PDF" onPress={sharePdf} icon="share-outline" /></View>
          </View>
        </Card>

        <Text style={{ color: colors.muted, fontSize: 11, letterSpacing: 1, marginTop: 20, marginBottom: 8 }}>SELECT PRODUCT</Text>
        <View style={{ backgroundColor: colors.surfaceSecondary, borderRadius: 12, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: colors.border, marginBottom: 8 }}>
          <Ionicons name="search" size={18} color={colors.muted} />
          <TextInput testID="prod-search" value={search} onChangeText={setSearch} placeholder="Search name, code, barcode…" placeholderTextColor={colors.muted} style={{ flex: 1, marginLeft: 8, color: colors.onSurface }} />
        </View>
        {list.map((p: any) => (
          <Pressable key={p.id} testID={`bc-prod-${p.id}`} onPress={() => setSelected(p)} style={{ backgroundColor: selected?.id === p.id ? colors.brandTertiary : colors.surfaceSecondary, borderRadius: 12, padding: 12, marginBottom: 8 }}>
            <Text style={{ color: colors.onSurface, fontSize: 13, fontWeight: "600" }}>{p.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{codeOf(p) || "no code"} · {formatINR(Number(p.price ?? p.selling_price ?? 0))}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
