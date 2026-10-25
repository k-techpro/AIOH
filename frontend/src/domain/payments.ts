// Checkout payment maths — port of the web app's lib/retailFinance.js so a sale made on
// mobile books exactly like one made on the web (Cash / UPI / Card / Pay Later, with the
// secondary amount auto-calculated as the remainder).
export const money = (v: unknown): number => Math.round(Number(v) * 100) / 100;
export type PayMethod = "Cash" | "UPI" | "Card" | "Pay Later";
export const PAY_METHODS: PayMethod[] = ["Cash", "UPI", "Card", "Pay Later"];

export interface PaymentState {
  valid: boolean; remaining: number;
  cash_amount: number; upi_amount: number; card_amount: number; pay_later_amount: number;
  payment_primary_method: PayMethod; total_paid: number; outstanding_amount: number;
  paidAmount: number; balance: number; pendingAmount: number;
  status: "paid" | "partial" | "unpaid"; paymentMethod: PayMethod;
  paymentBreakdown: { method: string; amount: number }[];
}

export function paymentState(total: unknown, method: PayMethod, cash: unknown, secondary: unknown = 0): PaymentState {
  const due = money(total), c = money(cash), s = method === "Cash" ? 0 : money(secondary);
  const remaining = money(due - c - s);
  const valid = PAY_METHODS.includes(method) && [due, c, s].every((v) => Number.isFinite(v) && v >= 0) && remaining === 0;
  const credit = method === "Pay Later" ? s : 0;
  const total_paid = money(c + s - credit);
  return {
    valid, remaining,
    cash_amount: c, upi_amount: method === "UPI" ? s : 0, card_amount: method === "Card" ? s : 0,
    pay_later_amount: credit, payment_primary_method: method, total_paid, outstanding_amount: credit,
    paidAmount: total_paid, balance: credit, pendingAmount: credit,
    status: credit ? (c ? "partial" : "unpaid") : "paid",
    paymentMethod: method,
    paymentBreakdown: [{ method: "Cash", amount: c }, ...(method !== "Cash" ? [{ method, amount: s }] : [])].filter((x) => x.amount > 0),
  };
}

/**
 * Auto-calculated remainder for the non-cash leg once the cash amount is typed:
 * UPI / Card / Pay Later = total − cash (never negative). Cash-only has no remainder.
 */
export function secondaryRemainder(total: unknown, method: PayMethod, cash: unknown): number {
  if (method === "Cash") return 0;
  return Math.max(0, money(money(total) - money(cash || 0)));
}

export function validateCheckout(
  items: { qty: unknown; stock: unknown; price: unknown; discount?: unknown }[],
  payment: Pick<PaymentState, "valid" | "pay_later_amount">,
  customer: { id?: string } | null,
): string | null {
  if (!items.length) return "Cart is empty.";
  if (items.some((i) => !Number.isFinite(Number(i.qty)) || Number(i.qty) <= 0 || Number(i.qty) > Number(i.stock) || Number(i.price) < 0 || !Number.isFinite(Number(i.price)) || Number(i.discount) < 0 || Number(i.discount) > 100)) return "Check quantities, stock, prices and discounts.";
  if (!payment.valid) return "Payment amounts must equal the bill total.";
  if (payment.pay_later_amount > 0 && !customer?.id) return "Select a customer for Pay Later.";
  return null;
}

export function ledgerBalance(before: unknown, type: string, amount: unknown) {
  const b = money(before), a = money(amount);
  if (!Number.isFinite(b) || b < 0 || !Number.isFinite(a) || a <= 0) throw new Error("Enter a positive amount.");
  if (!["CREDIT", "PAYMENT", "ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE"].includes(type)) throw new Error("Invalid ledger entry type.");
  const delta = ["PAYMENT", "ADJUSTMENT_DECREASE"].includes(type) ? -a : a;
  const after = money(b + delta);
  if (after < 0) throw new Error("Amount cannot exceed outstanding balance.");
  return { balance_before: b, balance_after: after, amount: a, delta };
}
