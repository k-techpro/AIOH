// Returns — port of the web Returns page rules: per-item quantities, refund = qty × price after line discount,
// plus GST, rounded to the rupee; reasons / refund methods are the same lists.
export const RETURN_REASONS = ["Defective / not working", "Wrong item", "Customer changed mind", "Damaged in transit", "Warranty replacement", "Other"];
export const REFUND_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Store Credit", "Adjust against dues"];

type R = Record<string, any>;
export const lineQty = (it: R) => Number(it.qty ?? it.quantity ?? 0);

/** Refund for the chosen quantities. `qtys` is keyed by line index. Never exceeds the sold quantity, never negative. */
export function refundTotal(items: R[], qtys: Record<number, string | number>): number {
  return items.reduce((sum, it, i) => {
    const sold = lineQty(it);
    const q = Math.min(Math.max(Number(qtys[i]) || 0, 0), sold);
    return sum + q * Number(it.price || 0) * (1 - Number(it.discount || 0) / 100) * (1 + Number(it.gst || 0) / 100);
  }, 0);
}

export function validateReturn(items: R[], qtys: Record<number, string | number>, reason: string, customReason: string): string | null {
  const chosen = items.map((it, i) => ({ it, q: Number(qtys[i]) || 0 })).filter((x) => x.q > 0);
  if (!chosen.length) return "Select at least one item to return";
  if (chosen.some((x) => x.q > lineQty(x.it))) return "Return quantity cannot exceed the quantity sold";
  if (reason === "Other" && !customReason.trim()) return "Enter the custom return reason";
  return null;
}

export function buildReturnRecord(args: { invoice: R; items: R[]; qtys: Record<number, string | number>; reason: string; customReason: string; refundMethod: string; note: string; restock: boolean; branchSlug: string | null; processedBy: string | null }) {
  const { invoice, items, qtys } = args;
  const chosen = items.map((it, i): R => ({ ...it, returnQty: Number(qtys[i]) || 0 })).filter((it) => it.returnQty > 0);
  const refund = Math.round(refundTotal(items, qtys));
  const invoiceNumber = invoice.invoiceNumber ?? invoice.invoice_number;
  const customerName = invoice.customerName ?? invoice.customer_name;
  return {
    invoiceId: invoice.id, invoiceNumber, invoice_number: invoiceNumber, customerId: invoice.customerId ?? invoice.customer_id ?? null, customerName, customer_name: customerName,
    branchId: args.branchSlug,
    items: chosen.map((it) => ({ name: it.name, productId: it.productId ?? it.product_id ?? null, returnQty: it.returnQty, price: it.price })),
    reason: args.reason, custom_return_reason: args.reason === "Other" ? args.customReason.trim() : null,
    refund_method: args.refundMethod, refundMethod: args.refundMethod, note: args.note.trim() || null, restocked: args.restock,
    refundAmount: refund, refund_amount: refund, createdAt: new Date().toISOString(), processed_by: args.processedBy,
  };
}
