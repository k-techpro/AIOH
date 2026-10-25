// Product form state + payload — port of the web app's Add/Edit Product behaviour (pure, testable).
import { computeProductPricing, computeProductProfit, validateDiscount, type DiscountType } from "./pricing.ts";
import { CODE_MODE, isMobileCategory, isValidIMEI, type CodeMode } from "./productCodes.ts";
import { CUSTOM_CATEGORY_SENTINEL } from "./categories.ts";

export const GST_RATES = ["0", "3", "5", "12", "18", "28"];

export interface ProductForm {
  name: string; hsn: string; product_code: string; barcode: string; imei1: string; imei2: string;
  cost: string; price: string; stock: string; gst: string;
  category: string; custom_category: string; brand: string; description: string; lowStockAlert: string;
  discount_type: DiscountType; discount_value: string;
  max_discount_type: DiscountType; max_discount_value: string;
  mrp: string; batch_no: string; mfg_date: string; expiry_date: string;
}

export const blankProductForm = (): ProductForm => ({
  name: "", hsn: "", product_code: "", barcode: "", imei1: "", imei2: "",
  cost: "", price: "", stock: "", gst: "0",
  category: "Smartphones", custom_category: "", brand: "", description: "", lowStockAlert: "5",
  discount_type: "percentage", discount_value: "0",
  max_discount_type: "percentage", max_discount_value: "0",
  mrp: "", batch_no: "", mfg_date: "", expiry_date: "",
});

type P = Record<string, any>;
/** Existing product -> form. Reads both web (`price`) and legacy mobile (`selling_price`) field names. */
export function formFromProduct(p: P): ProductForm {
  return {
    name: p.name || "", hsn: p.hsn || "", product_code: p.product_code || p.qr_id || "", barcode: p.barcode || "", imei1: p.imei1 || "", imei2: p.imei2 || "",
    cost: String(p.cost ?? p.cost_price ?? ""), price: String(p.price ?? p.selling_price ?? ""), stock: String(p.stock ?? ""), gst: String(p.gst ?? "0"),
    category: p.category || "Smartphones", custom_category: "", brand: p.brand || "", description: p.description || "", lowStockAlert: String(p.lowStockAlert ?? p.min_stock ?? "5"),
    discount_type: (p.discount_type as DiscountType) || "percentage", discount_value: String(p.discount_value ?? p.discount ?? "0"),
    max_discount_type: (p.max_discount_type as DiscountType) || "percentage", max_discount_value: String(p.max_discount_value ?? "0"),
    mrp: p.mrp != null ? String(p.mrp) : "", batch_no: p.batch_no || "", mfg_date: p.mfg_date || "", expiry_date: p.expiry_date || "",
  };
}

export const pricingOf = (f: ProductForm) => computeProductPricing({ price: f.price, gst: f.gst, discountType: f.discount_type, discountValue: f.discount_value });
export const profitOf = (f: ProductForm) => computeProductProfit({ cost: f.cost, price: f.price, discountType: f.discount_type, discountValue: f.discount_value });
export const discountErrorOf = (f: ProductForm) => validateDiscount({ price: f.price, discountType: f.discount_type, discountValue: f.discount_value });

export interface ValidateCtx { editing: boolean; codeMode: CodeMode | ""; products: P[]; editingId?: string | null }
export function validateProductForm(f: ProductForm, ctx: ValidateCtx): string | null {
  if (!f.name.trim()) return "Product name is required";
  if (!ctx.editing) {
    if (!ctx.codeMode) return "Choose Generate Code or Enter Existing Code for the product's code";
    if (ctx.codeMode === CODE_MODE.MANUAL && !f.product_code.trim()) return "Enter the existing product / barcode code";
    if (ctx.codeMode === CODE_MODE.GENERATED && !f.product_code) return "Tap Generate Code to create the product code";
  }
  if (!Number.isFinite(Number(f.price)) || Number(f.price) < 0 || f.price === "") return "Enter a valid selling price";
  if (!Number.isFinite(Number(f.stock || 0)) || Number(f.stock || 0) < 0) return "Enter a non-negative stock quantity";
  const d = discountErrorOf(f);
  if (d) return d;
  if (!Number.isFinite(Number(f.max_discount_value)) || Number(f.max_discount_value) < 0) return "Maximum discount cannot be negative";
  if (f.category === CUSTOM_CATEGORY_SENTINEL && !f.custom_category.trim()) return "Enter the custom category name";
  if (isMobileCategory(f.category)) {
    if (f.imei1 && !isValidIMEI(f.imei1)) return "IMEI 1 is not a valid 15-digit IMEI";
    if (f.imei2 && !isValidIMEI(f.imei2)) return "IMEI 2 is not a valid 15-digit IMEI";
    const dupe = ctx.products.find((p) => p.id !== ctx.editingId && f.imei1 && (p.imei1 === f.imei1 || p.imei2 === f.imei1));
    if (dupe) return `IMEI 1 already exists on "${dupe.name}"`;
  }
  return null;
}

/** Firestore payload in the canonical web schema (basic/GST/incl are derived from price+GST+discount at save time). */
export function buildProductPayload(f: ProductForm, code: string, category: string) {
  const pr = pricingOf(f);
  const mobile = isMobileCategory(f.category);
  return {
    name: f.name.trim(), hsn: f.hsn.trim() || null, product_code: code, qr_id: code, barcode: code,
    imei1: mobile ? f.imei1.trim() || null : null, imei2: mobile ? f.imei2.trim() || null : null,
    cost: Number(f.cost) || 0, price: Number(f.price) || 0, gst: Number(f.gst) || 0,
    discount_type: f.discount_type, discount_value: Number(f.discount_value) || 0, discount: pr.discountPercent,
    gst_amount: pr.gstAmount, basic_amount: pr.basicAmount, price_incl_gst: pr.priceInclGst,
    category, brand: f.brand.trim() || null, description: f.description.trim() || null,
    max_discount_type: f.max_discount_type, max_discount_value: Number(f.max_discount_value) || 0,
    lowStockAlert: Number(f.lowStockAlert) || 5,
    mrp: f.mrp !== "" ? Number(f.mrp) : null, batch_no: f.batch_no.trim() || null, mfg_date: f.mfg_date || null, expiry_date: f.expiry_date || null,
  };
}
