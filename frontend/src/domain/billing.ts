// Cart totals — port of the web app's services/invoice.js computeTotals, so a bill built
// on mobile has the same subtotal / discount / GST / rounded grand total as one built on web.
const r = (n: unknown) => Math.round((Number(n) || 0) * 100) / 100;

export interface CartLine { price: unknown; qty: unknown; discount?: unknown; gst?: unknown }
export interface CouponLike { discountType?: string; type?: string; discount?: unknown; value?: unknown; maximumDiscount?: unknown }
export interface Totals {
  subtotal: number; itemDiscount: number; couponDiscount: number; totalDiscount: number; taxable: number;
  tax: number; cgst: number; sgst: number; igst: number; roundOff: number; grandTotal: number;
}

export function computeTotals(items: CartLine[], opts: { coupon?: CouponLike | null; interState?: boolean } = {}): Totals {
  const { coupon = null, interState = false } = opts;
  let subtotal = 0, itemDiscount = 0, tax = 0;
  items.forEach((it) => {
    const qty = Number(it.qty) || 0, price = Number(it.price) || 0, disc = Number(it.discount) || 0, gst = Number(it.gst) || 0;
    const lineSub = price * qty, lineDisc = (lineSub * disc) / 100, lineTaxable = lineSub - lineDisc;
    subtotal += lineSub; itemDiscount += lineDisc; tax += (lineTaxable * gst) / 100;
  });
  const afterItemDiscount = subtotal - itemDiscount;
  let couponDiscount = 0;
  if (coupon) {
    const type = coupon.discountType ?? coupon.type ?? "fixed";
    const value = Number(coupon.discount ?? coupon.value ?? 0);
    couponDiscount = type === "percentage" ? (afterItemDiscount * value) / 100 : value;
    if (coupon.maximumDiscount != null) couponDiscount = Math.min(couponDiscount, Number(coupon.maximumDiscount) || 0);
    couponDiscount = Math.min(couponDiscount, afterItemDiscount);
  }
  const grandRaw = afterItemDiscount + tax - couponDiscount;
  const grandTotal = Math.round(grandRaw);
  return {
    subtotal: r(subtotal), itemDiscount: r(itemDiscount), couponDiscount: r(couponDiscount), totalDiscount: r(itemDiscount + couponDiscount),
    taxable: r(afterItemDiscount), tax: r(tax), cgst: interState ? 0 : r(tax / 2), sgst: interState ? 0 : r(tax / 2), igst: interState ? r(tax) : 0,
    roundOff: r(grandTotal - grandRaw), grandTotal,
  };
}

/** Largest applied-discount percent a line may take given the product's Maximum Allowed Discount. */
export function maxDiscountPercent(price: number, perUnitLimit: number): number {
  if (!(price > 0)) return 0;
  return Math.min(100, Math.floor((perUnitLimit / price) * 10000 + 1e-6) / 100);
}
