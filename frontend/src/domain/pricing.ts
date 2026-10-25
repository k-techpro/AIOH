// Product pricing — a TypeScript twin of the web app's lib/productPricing.js.
// Keep the two in lock-step: both apps must show identical Basic / GST / Price incl. GST.
//
// Model (unchanged RetailPrime): the MOP / selling price is GST-EXCLUSIVE and GST is
// added on top. The actual product Discount is applied to the price first:
//   percent: price × pct / 100  (pct clamped 0…100)      fixed: min(value, price)
// then Basic = price − discount and GST is charged on the discounted Basic.
// "Maximum Allowed Discount" is a separate checkout CAP and never feeds this.

export type DiscountType = "percentage" | "fixed";
export const DISCOUNT_TYPE = { PERCENT: "percentage" as DiscountType, FIXED: "fixed" as DiscountType };

const finite = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const money = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PricingInput { price: unknown; gst: unknown; discountType?: DiscountType; discountValue?: unknown }
export interface Pricing { discountAmount: number; discountedAmount: number; basicAmount: number; gstAmount: number; priceInclGst: number; discountPercent: number }

export function validateDiscount(input: { price: unknown; discountType?: DiscountType; discountValue?: unknown }): string | null {
  const { price, discountType, discountValue } = input;
  if (discountValue === "" || discountValue == null) return null;
  const value = Number(discountValue);
  if (!Number.isFinite(value)) return "Enter a valid discount";
  if (value < 0) return "Discount cannot be negative";
  if (discountType === DISCOUNT_TYPE.FIXED) {
    if (value > Math.max(0, finite(price))) return "Fixed discount cannot exceed the product price";
  } else if (value > 100) {
    return "Percent discount cannot exceed 100%";
  }
  return null;
}

export function computeProductPricing({ price, gst, discountType = DISCOUNT_TYPE.PERCENT, discountValue = 0 }: PricingInput): Pricing {
  const base = Math.max(0, finite(price));
  const rate = Math.max(0, finite(gst));
  const raw = Math.max(0, finite(discountValue));
  const discountAmount = discountType === DISCOUNT_TYPE.FIXED ? Math.min(raw, base) : (base * Math.min(raw, 100)) / 100;
  const basicAmount = Math.max(0, base - discountAmount);
  const gstAmount = (basicAmount * rate) / 100;
  return {
    discountAmount: money(discountAmount),
    discountedAmount: money(basicAmount),
    basicAmount: money(basicAmount),
    gstAmount: money(gstAmount),
    priceInclGst: money(basicAmount + gstAmount),
    discountPercent: base > 0 ? money((discountAmount / base) * 100) : 0,
  };
}

/** DP and MOP are compared on RetailPrime's shared GST-exclusive base. */
export function computeProductProfit(input: { cost: unknown; price: unknown; discountType?: DiscountType; discountValue?: unknown }) {
  const cost = Math.max(0, finite(input.cost));
  const price = Math.max(0, finite(input.price));
  const afterDiscount = computeProductPricing({ price, gst: 0, discountType: input.discountType, discountValue: input.discountValue }).discountedAmount;
  return { profit: money(price - cost), profitAfterDiscount: money(afterDiscount - cost) };
}

/** Per-unit maximum a salesperson may discount at checkout (the cap — web discountLimit). */
export function discountLimit(product: { max_discount_type?: string; max_discount_value?: unknown; discount?: unknown; price?: unknown; selling_price?: unknown }): number {
  const price = Number(product.price ?? product.selling_price ?? 0);
  return product.max_discount_type === "fixed"
    ? Number(product.max_discount_value || 0)
    : (price * Number(product.max_discount_value ?? product.discount ?? 0)) / 100;
}
