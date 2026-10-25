// Product identity — port of the web app's lib/productCodes.js (pure parts).
// Generated code format: YYYYMMDDXXXXX (date + 5 random digits), collision-checked at save time.
export const QR_PREFIX = "AIOH:P:";
const pad = (n: number, w: number) => String(n).padStart(w, "0");
export const CODE_MODE = { GENERATED: "generated", MANUAL: "manual" } as const;
export type CodeMode = (typeof CODE_MODE)[keyof typeof CODE_MODE];

export const datePrefix = (date = new Date()) => `${date.getFullYear()}${pad(date.getMonth() + 1, 2)}${pad(date.getDate(), 2)}`;
export const randomProductCode = (date = new Date(), rand = Math.floor(Math.random() * 100000)) => `${datePrefix(date)}${pad(rand, 5)}`;
export const isProductCode = (v: unknown) => /^\d{13}$/.test(String(v || "").trim());
export function normalizeScan(raw: unknown): string {
  let v = String(raw || "").trim();
  if (v.toUpperCase().startsWith(QR_PREFIX)) v = v.slice(QR_PREFIX.length);
  return v.trim();
}
export const qrPayload = (code: string) => `${QR_PREFIX}${code}`;

/** Selecting a mode discards whatever the OTHER mode had staged. */
export function selectCodeMode(nextMode: CodeMode, cur: { currentMode?: CodeMode | ""; code?: string } = {}) {
  if (nextMode === cur.currentMode) return { mode: cur.currentMode, code: cur.code || "" };
  return { mode: nextMode, code: "" };
}
/** Manual codes are only trimmed — never re-cased, never stripped of leading zeros. */
export const finalizeCode = (_mode: CodeMode | "", raw: unknown) => String(raw ?? "").trim();

export function isValidIMEI(value: unknown): boolean {
  const s = String(value || "").replace(/\s|-/g, "");
  if (!/^\d{15}$/.test(s)) return false;
  let sum = 0;
  for (let i = 0; i < 15; i += 1) {
    let d = Number(s[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}
export const isMobileCategory = (category: unknown) => /smartphone|mobile|phone/i.test(String(category || "")) && !/accessor|cover|case|charger|guard|cable/i.test(String(category || ""));

type P = Record<string, any>;
export function findProductByCode(products: P[], raw: unknown): P | null {
  const key = normalizeScan(raw).toLowerCase();
  if (!key) return null;
  for (const field of ["product_code", "qr_id", "barcode", "sku", "imei1", "imei2"]) {
    const hit = products.find((p) => String(p[field] || "").toLowerCase() === key);
    if (hit) return hit;
  }
  return null;
}

/** Relevance-ordered live search: exact code → code prefix → name prefix → name contains → brand/category → HSN/IMEI. */
export function searchProducts(products: P[], raw: unknown): P[] {
  const list = Array.isArray(products) ? products : [];
  const q = normalizeScan(raw).toLowerCase().trim();
  if (!q) return list;
  const compact = q.replace(/\s+/g, "");
  const scored: { p: P; score: number }[] = [];
  for (const p of list) {
    const f = (k: string) => String(p[k] || "").toLowerCase();
    const [code, barcode, qr, sku, name, brand, category, hsn, imei1, imei2] = ["product_code", "barcode", "qr_id", "sku", "name", "brand", "category", "hsn", "imei1", "imei2"].map(f);
    let score = 0;
    if ([code, barcode, qr, sku, imei1, imei2].includes(q)) score = 100;
    else if ([code, barcode, qr, sku].some((v) => v && v.startsWith(compact))) score = 80;
    else if (name.startsWith(q)) score = 60;
    else if (name.includes(q)) score = 45;
    else if (brand.includes(q) || category.includes(q)) score = 30;
    else if ((hsn && hsn.includes(q)) || imei1.includes(q) || imei2.includes(q)) score = 20;
    if (score > 0) scored.push({ p, score });
  }
  scored.sort((a, b) => b.score - a.score || String(a.p.name || "").localeCompare(String(b.p.name || "")));
  return scored.map((s) => s.p);
}
