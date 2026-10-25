// WhatsApp deep-link helpers — port of the web app's lib/whatsapp.js (wa.me flow, no Meta API).
import { normalizePhone } from "./phone.ts";

const amt2 = (v: unknown) => Number(v || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Any Indian-style number -> wa.me target (91 + 10 digits). Never prefixes 91 twice; null if not a phone. */
export function toWhatsAppNumber(raw: unknown): string | null {
  const local = normalizePhone(raw);
  if (/^\d{10}$/.test(local)) return `91${local}`;
  const digits = String(raw || "").replace(/\D/g, "");
  if (digits.length >= 11 && digits.length <= 15) return digits;
  return null;
}

type R = Record<string, any>;
export function buildInvoiceWhatsAppMessage(invoice: R = {}, opts: { branchName?: string; includeUrl?: boolean } = {}): string {
  const paid = Number(invoice.paidAmount ?? invoice.amount_paid ?? invoice.total_paid ?? 0);
  const balance = Number(invoice.pendingAmount ?? invoice.balance ?? invoice.balance_due ?? 0);
  const url = opts.includeUrl === false ? "" : invoice.documentUrl || invoice.storage_url || "";
  const lines = [
    `Hello ${invoice.customerName || invoice.customer_name || "Customer"},`, "",
    "Thank you for shopping with ALL IN ONE HUB.", "",
    `Invoice: ${invoice.invoiceNumber || invoice.invoice_number || "-"}`,
    `Branch: ${opts.branchName || invoice.branch_name || invoice.branchName || "-"}`,
    `Total: ₹${amt2(invoice.grandTotal ?? invoice.total)}`, `Paid: ₹${amt2(paid)}`, `Balance: ₹${amt2(balance)}`,
  ];
  if (invoice.description) lines.push("", "Description:", String(invoice.description));
  if (url) lines.push("", "Your invoice:", url);
  lines.push("", "Thank you.");
  return lines.join("\n");
}

export function buildServiceWhatsAppMessage(service: R = {}): string {
  return [
    `Hello ${service.customer_name || service.customerName || "Customer"},`, "",
    "Thank you for choosing ALL IN ONE HUB.", "",
    `Service No: ${service.service_no || service.serviceNo || "-"}`,
    `Device: ${service.product || "-"}`,
    `Status: ${service.status || "-"}`,
    `Total: ₹${amt2(service.total ?? service.price)}`,
    ...(Number(service.pay_later_amount || service.pendingAmount || 0) > 0 ? [`Balance due: ₹${amt2(service.pay_later_amount || service.pendingAmount)}`] : []),
    "", "Thank you.",
  ].join("\n");
}

export const whatsAppUrl = (rawPhone: unknown, message: string): string | null => {
  const n = toWhatsAppNumber(rawPhone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null;
};
