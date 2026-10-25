export type BillItem = {
  product_id: string;
  name: string;
  category?: string;
  subcategory?: string;
  quantity: number;
  price: number;
  gst: number;
};

export type BillCoupon = {
  id: string;
  code: string;
  discount: number;
  discountType: "fixed" | "percentage";
  enabled?: boolean;
  isActive?: boolean;
  minimumPurchase?: number;
  maximumDiscount?: number;
  startDate?: string;
  endDate?: string;
  expiryDate?: string;
  usageLimit?: number;
  usageCount?: number;
  applicableCategory?: string;
  applicableSubcategory?: string;
  applicableProductIds?: string[];
  branchIds?: string[];
};

export type CouponValidation = {
  valid: boolean;
  reason: string | null;
  eligibleItems: BillItem[];
};

export type InvoiceCalculation = {
  subtotal: number;
  taxable: number;
  gst: number;
  eligibleSubtotal: number;
  couponDiscount: number;
  total: number;
  lineDiscounts: Record<string, number>;
};

export type PaymentPart = { method: string; amount: number };
export type PaymentState = { payments: PaymentPart[]; paidAmount: number; pendingAmount: number; paymentStatus: "paid" | "partial" | "due" };

const round = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

// Single source of truth for billing and later-settlement amounts. Values are
// rounded at the currency boundary and overpayments are rejected, never hidden.
export function calculatePaymentState(grandTotal: number, parts: PaymentPart[]): PaymentState {
  const total = round(grandTotal);
  const payments = parts.map((part) => ({ method: String(part.method || "").trim().toLowerCase(), amount: round(Number(part.amount)) })).filter((part) => part.method && part.amount > 0);
  if (parts.some((part) => !Number.isFinite(Number(part.amount)) || Number(part.amount) < 0)) throw new Error("Payment amounts must be valid positive numbers.");
  const paidAmount = round(payments.reduce((sum, part) => sum + part.amount, 0));
  if (paidAmount > total) throw new Error("Total paid cannot exceed the grand total.");
  const pendingAmount = round(total - paidAmount);
  return { payments, paidAmount, pendingAmount, paymentStatus: paidAmount <= 0 ? "due" : pendingAmount <= 0 ? "paid" : "partial" };
}

const eligibleItems = (coupon: BillCoupon, items: BillItem[]) =>
  items.filter(
    (item) =>
      (!coupon.applicableCategory || item.category === coupon.applicableCategory) &&
      (!coupon.applicableSubcategory || item.subcategory === coupon.applicableSubcategory) &&
      (!coupon.applicableProductIds?.length || coupon.applicableProductIds.includes(item.product_id))
  );

export function validateCouponResult(coupon: BillCoupon, items: BillItem[], branchId?: string): CouponValidation {
  const today = new Date().toISOString().slice(0, 10);

  // Check if coupon is enabled
  if (coupon.enabled === false || coupon.isActive === false) {
    return { valid: false, reason: "Coupon is inactive.", eligibleItems: [] };
  }

  // Check if coupon is in future
  if (coupon.startDate && today < coupon.startDate) {
    return { valid: false, reason: "Coupon is not active yet.", eligibleItems: [] };
  }

  // Check if coupon is expired
  if ((coupon.expiryDate || coupon.endDate) && today > (coupon.expiryDate || coupon.endDate)!) {
    return { valid: false, reason: "Coupon is expired.", eligibleItems: [] };
  }

  // Check usage limit
  if (coupon.usageLimit != null && (coupon.usageCount || 0) >= coupon.usageLimit) {
    return { valid: false, reason: "Coupon usage limit has been reached.", eligibleItems: [] };
  }

  // Check branch restriction
  if (branchId && coupon.branchIds?.length && !coupon.branchIds.includes(branchId)) {
    return { valid: false, reason: "Coupon is not available for this branch.", eligibleItems: [] };
  }

  // Check applicability
  const eligible = eligibleItems(coupon, items);
  if (!eligible.length) {
    return { valid: false, reason: "Coupon is not applicable to the selected products.", eligibleItems: [] };
  }

  // Check minimum purchase
  const value = eligible.reduce((total, item) => total + item.price * item.quantity, 0);
  if (coupon.minimumPurchase && value < coupon.minimumPurchase) {
    return {
      valid: false,
      reason: `Coupon requires a minimum eligible purchase of ₹${coupon.minimumPurchase}.`,
      eligibleItems: eligible,
    };
  }

  return { valid: true, reason: null, eligibleItems: eligible };
}

export function validateCoupon(coupon: BillCoupon, items: BillItem[], branchId?: string) {
  return validateCouponResult(coupon, items, branchId).reason;
}

export function calculateInvoice(items: BillItem[], coupon?: BillCoupon | null): InvoiceCalculation {
  const subtotal = round(items.reduce((total, item) => total + item.price * item.quantity, 0));
  const gst = round(items.reduce((total, item) => total + (item.price * item.quantity * item.gst) / (100 + item.gst), 0));
  const taxable = round(subtotal - gst);

  // If no coupon, return simple calculation
  if (!coupon) {
    return {
      subtotal,
      taxable,
      gst,
      eligibleSubtotal: 0,
      couponDiscount: 0,
      total: subtotal,
      lineDiscounts: {},
    };
  }

  // Calculate coupon discount
  const eligible = eligibleItems(coupon, items);
  const eligibleSubtotal = round(eligible.reduce((total, item) => total + item.price * item.quantity, 0));

  // Calculate discount amount based on type
  let discountAmount = 0;
  if (coupon.discountType === "percentage") {
    discountAmount = round((eligibleSubtotal * coupon.discount) / 100);
  } else {
    // Fixed discount
    discountAmount = coupon.discount;
  }

  // Apply maximum discount cap if percentage
  if (coupon.maximumDiscount && coupon.discountType === "percentage") {
    discountAmount = Math.min(discountAmount, coupon.maximumDiscount);
  }

  // Ensure discount doesn't exceed eligible subtotal
  const couponDiscount = round(Math.min(discountAmount, eligibleSubtotal));

  // Calculate line-item discounts proportionally
  const lineDiscounts: Record<string, number> = {};
  eligible.forEach((item) => {
    const line = item.price * item.quantity;
    lineDiscounts[item.product_id] = round(eligibleSubtotal ? (couponDiscount * line) / eligibleSubtotal : 0);
  });

  return {
    subtotal,
    taxable,
    gst,
    eligibleSubtotal,
    couponDiscount,
    total: round(Math.max(0, subtotal - couponDiscount)),
    lineDiscounts,
  };
}
