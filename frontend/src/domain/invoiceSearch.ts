// Robust invoice search — port of the web app's lib/invoiceSearch.js. Case-insensitive, whitespace-tolerant and
// phone-format aware (+91 / spaces / dashes / leading 0). Matches invoice number, customer name, customer phone,
// payment method and line-item product names. An empty query returns the list unchanged.
import { normalizePhone } from "./phone.ts";

type R = Record<string, any>;
const digitsOnly = (v: unknown) => String(v || "").replace(/\D/g, "");
export const normalizeInvoiceQuery = (raw: unknown) => String(raw || "").trim().toLowerCase().replace(/\s+/g, " ");

function phoneCandidates(qDigits: string): string[] {
  const out = new Set<string>();
  if (qDigits.length >= 3) {
    out.add(qDigits);
    if (qDigits.length > 10 && qDigits.startsWith("91")) out.add(qDigits.slice(2));
    if (qDigits.startsWith("0")) out.add(qDigits.replace(/^0+/, ""));
    const np = normalizePhone(qDigits);
    if (np.length >= 3) out.add(np);
  }
  return [...out].filter((c) => c.length >= 3);
}

export function invoiceMatches(inv: R, rawQuery: unknown): boolean {
  const q = normalizeInvoiceQuery(rawQuery);
  if (!q) return true;
  const qCompact = q.replace(/\s+/g, "");
  const qDigits = digitsOnly(q);
  const num = String(inv.invoiceNumber || inv.invoice_number || inv.invoice_no || "").toLowerCase();
  if (num.includes(q) || num.replace(/\s+/g, "").includes(qCompact)) return true;
  if (String(inv.customerName || inv.customer_name || "").toLowerCase().includes(q)) return true;
  const phone = digitsOnly(inv.customerPhone || inv.customer_phone);
  if (phone && phoneCandidates(qDigits).some((c) => phone.includes(c))) return true;
  const method = String(inv.paymentMethod || inv.payment_method || inv.method || "").toLowerCase();
  if (method && method.includes(q)) return true;
  const items = Array.isArray(inv.items) ? inv.items : [];
  return items.some((it: R) => String(it.name || it.product || "").toLowerCase().includes(q));
}

export function filterInvoices(invoices: R[], rawQuery: unknown): R[] {
  const list = Array.isArray(invoices) ? invoices : [];
  return normalizeInvoiceQuery(rawQuery) ? list.filter((inv) => invoiceMatches(inv, rawQuery)) : list;
}

const ts = (i: R) => (typeof i.created_at === "number" ? i.created_at : Date.parse(i.created_at || "") || 0);
const amt = (i: R) => Number(i.total ?? i.grandTotal) || 0;
export const INVOICE_SORTS = [
  { id: "newest", label: "Newest" }, { id: "oldest", label: "Oldest" }, { id: "amount-desc", label: "Amount ↓" }, { id: "amount-asc", label: "Amount ↑" },
];
export function sortInvoices(list: R[], id: string): R[] {
  const by: Record<string, (a: R, b: R) => number> = {
    newest: (a, b) => ts(b) - ts(a), oldest: (a, b) => ts(a) - ts(b), "amount-desc": (a, b) => amt(b) - amt(a), "amount-asc": (a, b) => amt(a) - amt(b),
  };
  return by[id] ? [...list].sort(by[id]) : list;
}
