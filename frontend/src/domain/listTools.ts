// Sort / filter helpers for Products and Customers — port of the web app's lib/listTools.js.
// S.No. is a DISPLAY row number only (index in the displayed list) — never stored, never identity.
type R = Record<string, any>;
const text = (v: unknown) => String(v ?? "").trim();
const cmpText = (a: unknown, b: unknown) => text(a).localeCompare(text(b), undefined, { sensitivity: "base", numeric: true });
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const millis = (v: any): number => {
  if (typeof v === "number") return v;
  if (v?.toMillis) return v.toMillis();
  const t = Date.parse(v || "");
  return Number.isFinite(t) ? t : 0;
};
const created = (r: R) => millis(r?.createdAt ?? r?.created_at);

function stableSort<T>(list: T[], compare: (a: T, b: T) => number): T[] {
  return list.map((item, index) => ({ item, index })).sort((a, b) => compare(a.item, b.item) || a.index - b.index).map(({ item }) => item);
}

export const PRODUCT_SORTS = [
  { id: "name-asc", label: "A → Z" }, { id: "name-desc", label: "Z → A" }, { id: "category", label: "Category" },
  { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" },
  { id: "price-asc", label: "Price ↑" }, { id: "price-desc", label: "Price ↓" },
  { id: "stock-asc", label: "Stock ↑" }, { id: "stock-desc", label: "Stock ↓" },
];
const price = (p: R) => num(p?.price ?? p?.selling_price);
const PRODUCT_COMPARE: Record<string, (a: R, b: R) => number> = {
  "name-asc": (a, b) => cmpText(a.name, b.name), "name-desc": (a, b) => cmpText(b.name, a.name),
  category: (a, b) => cmpText(a.category, b.category) || cmpText(a.name, b.name),
  newest: (a, b) => created(b) - created(a), oldest: (a, b) => created(a) - created(b),
  "price-asc": (a, b) => price(a) - price(b), "price-desc": (a, b) => price(b) - price(a),
  "stock-asc": (a, b) => num(a.stock) - num(b.stock), "stock-desc": (a, b) => num(b.stock) - num(a.stock),
};
export const sortProducts = (list: R[], id: string) => (PRODUCT_COMPARE[id] ? stableSort(list || [], PRODUCT_COMPARE[id]) : [...(list || [])]);

export const ALL = "__all__";
export function productCategoryOptions(products: R[], registry: string[] = []): string[] {
  const seen = new Map<string, string>();
  const add = (n: unknown) => { const t = text(n); if (t && !seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t); };
  registry.forEach(add); (products || []).forEach((p) => add(p?.category));
  return [...seen.values()].sort(cmpText);
}
export function filterProductsByCategory(list: R[], category: string): R[] {
  if (!category || category === ALL) return list || [];
  const wanted = text(category).toLowerCase();
  return (list || []).filter((p) => text(p?.category).toLowerCase() === wanted);
}

// ---- Customers
export const UNSPECIFIED_TYPE = "Unspecified";
export const CUSTOMER_TYPE_CHOICES = ["Retail", "Other"];
export const customerTypeOf = (c: R) => text(c?.type ?? c?.customer_type ?? c?.customerType) || UNSPECIFIED_TYPE;
export const CUSTOMER_SORTS = [
  { id: "name-asc", label: "A → Z" }, { id: "name-desc", label: "Z → A" }, { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" },
  { id: "phone", label: "Phone" }, { id: "outstanding-desc", label: "Due ↓" },
];
const outstanding = (c: R) => num(c?.outstanding ?? c?.total_due);
const CUSTOMER_COMPARE: Record<string, (a: R, b: R) => number> = {
  "name-asc": (a, b) => cmpText(a.name, b.name), "name-desc": (a, b) => cmpText(b.name, a.name),
  newest: (a, b) => created(b) - created(a), oldest: (a, b) => created(a) - created(b),
  phone: (a, b) => cmpText(a.phone, b.phone), "outstanding-desc": (a, b) => outstanding(b) - outstanding(a),
};
export const sortCustomers = (list: R[], id: string) => (CUSTOMER_COMPARE[id] ? stableSort(list || [], CUSTOMER_COMPARE[id]) : [...(list || [])]);
export function customerTypeOptions(customers: R[]): string[] {
  const seen = new Map<string, string>();
  CUSTOMER_TYPE_CHOICES.forEach((t) => seen.set(t.toLowerCase(), t));
  (customers || []).forEach((c) => { const t = customerTypeOf(c); if (!seen.has(t.toLowerCase())) seen.set(t.toLowerCase(), t); });
  return [...seen.values()];
}
export function filterCustomersByType(list: R[], type: string): R[] {
  if (!type || type === ALL) return list || [];
  const wanted = text(type).toLowerCase();
  return (list || []).filter((c) => customerTypeOf(c).toLowerCase() === wanted);
}

/** Branch label: editable nickname/display name when set, otherwise the legal name (web lib/branchLabel.js). */
export function branchLabel(branch: R | null | undefined): string {
  if (!branch) return "";
  const nick = String(branch.display_name ?? branch.nickname ?? "").trim();
  return nick || String(branch.name ?? "").trim() || String(branch.slug ?? branch.id ?? "").trim();
}
export const isDeletedBranch = (b: R | null | undefined) => !!b && (b.status === "deleted" || b.deleted === true);
export const deleteConfirmationPhrase = (b: R) => `DELETE ${branchLabel(b)}`;
