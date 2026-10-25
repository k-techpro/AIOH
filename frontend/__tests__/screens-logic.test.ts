// Logic behind the mobile Product / Service / POS screens (pure, runs under `npm test`).
import { test } from "node:test";
import assert from "node:assert/strict";
import { blankProductForm, formFromProduct, pricingOf, discountErrorOf, validateProductForm, buildProductPayload } from "../src/domain/productForm.ts";
import { buildServiceJob, itemsWithCharge, serviceTotal } from "../src/domain/serviceRecord.ts";
import { toWhatsAppNumber, whatsAppUrl, buildInvoiceWhatsAppMessage } from "../src/domain/whatsapp.ts";
import { computeTotals, maxDiscountPercent } from "../src/domain/billing.ts";
import { genServiceNo } from "../src/domain/serviceWizard.ts";
import { sortProducts, filterProductsByCategory, branchLabel, sortCustomers, customerTypeOf } from "../src/domain/listTools.ts";

test("product form: Basic / GST / Price incl. GST follow price, GST and discount live", () => {
  const f = { ...blankProductForm(), price: "1000", gst: "18" };
  assert.equal(pricingOf(f).priceInclGst, 1180);
  f.discount_value = "10";
  assert.deepEqual([pricingOf(f).basicAmount, pricingOf(f).gstAmount, pricingOf(f).priceInclGst], [900, 162, 1062]);
  f.discount_type = "fixed"; f.discount_value = "250";
  assert.deepEqual([pricingOf(f).basicAmount, pricingOf(f).gstAmount, pricingOf(f).priceInclGst], [750, 135, 885]);
  f.price = "2000";
  assert.equal(pricingOf(f).priceInclGst, 2065);
  f.gst = "5";
  assert.equal(pricingOf(f).priceInclGst, 1837.5);
});

test("product form: invalid discount is reported and never produces NaN / negatives", () => {
  const f = { ...blankProductForm(), price: "100", gst: "18", discount_value: "150" };
  assert.match(discountErrorOf(f)!, /100/);
  assert.ok(Object.values(pricingOf(f)).every((v) => Number.isFinite(v) && v >= 0));
  assert.match(validateProductForm({ ...f, name: "X" }, { editing: true, codeMode: "", products: [] })!, /100/);
  f.discount_type = "fixed"; f.discount_value = "-5";
  assert.match(discountErrorOf(f)!, /negative/);
});

test("product form: Maximum Allowed Discount is a cap and does not move the cards", () => {
  const f = { ...blankProductForm(), price: "500", gst: "12" };
  const before = pricingOf(f);
  f.max_discount_value = "50";
  assert.deepEqual(pricingOf(f), before);
});

test("product form: legacy mobile docs load; payload uses the canonical web schema", () => {
  const legacy = formFromProduct({ name: "Old", selling_price: 250, cost_price: 100, stock: 3, min_stock: 2, gst: 18, discount: 10 });
  assert.equal(legacy.price, "250"); assert.equal(legacy.cost, "100"); assert.equal(legacy.lowStockAlert, "2"); assert.equal(legacy.discount_value, "10");
  const payload = buildProductPayload({ ...legacy, name: "Old" }, "2026100100001", "Audio");
  assert.deepEqual(
    [payload.price, payload.cost, payload.product_code, payload.qr_id, payload.barcode, payload.basic_amount, payload.gst_amount, payload.price_incl_gst],
    [250, 100, "2026100100001", "2026100100001", "2026100100001", 225, 40.5, 265.5],
  );
  assert.equal(payload.discount_type, "percentage"); assert.equal(payload.discount, 10);
  assert.ok(!("is_accessory" in payload));
});

test("product form: new product needs a code mode; manual needs a code; custom category needs a name", () => {
  const f = { ...blankProductForm(), name: "N", price: "10" };
  assert.match(validateProductForm(f, { editing: false, codeMode: "", products: [] })!, /Generate Code/);
  assert.match(validateProductForm(f, { editing: false, codeMode: "manual", products: [] })!, /existing/);
  assert.equal(validateProductForm({ ...f, product_code: "00123" }, { editing: false, codeMode: "manual", products: [] }), null);
  assert.match(validateProductForm({ ...f, category: "Custom" }, { editing: true, codeMode: "", products: [] })!, /custom category/i);
});

test("service: ticket record carries wizard fields; staff name stays separate from customer; lock secret only in lock_secret", () => {
  const form = {
    service_no: "PON-20261007-1234", service_type: "Repair", priority: "High", status: "Pending", received_date: "2026-10-07", customer_id: "c1",
    customer_name: "Arun", customer_phone: "9876543210", product: "iPhone 13", received_by_name: "Counter Staff", lock_type: "PIN", lock_value: "1234",
    accessories_selected: ["Charger"], accessories_custom: "Pouch", service_charge: "500", warranty_type: "No warranty", issue: "No display",
  };
  const job: any = buildServiceJob({ form, mode: "ticket", items: [{ kind: "custom", name: "Screen", price: 1000, qty: 1 }], productName: "iPhone 13" });
  assert.equal(job.customer_name, "Arun"); assert.equal(job.received_by_name, "Counter Staff");
  assert.equal(job.lock_secret, "1234"); assert.equal(job.total, 1500); assert.equal(job.status, "Pending");
  assert.deepEqual(job.accessories_received, ["Charger", "Pouch"]);
  assert.equal(job.service_mode, "ticket"); assert.equal(job.created_via, "service_wizard");
});

test("service: quick bill is Delivered immediately and has no wizard-only fields", () => {
  const form = { service_no: "X", service_type: "Repair", status: "Pending", customer_name: "A", customer_phone: "9876543210", warranty_type: "30 days" };
  const job: any = buildServiceJob({ form, mode: "quick", items: [{ kind: "custom", name: "Labour", price: 150, qty: 2 }], productName: "Watch" });
  assert.equal(job.status, "Delivered"); assert.equal(job.service_mode, "quick_bill"); assert.equal(job.total, 300); assert.equal(job.lock_secret, undefined);
  assert.equal(itemsWithCharge([], { service_charge: "100", service_type: "Repair" }, false).length, 0);
  assert.equal(serviceTotal(itemsWithCharge([], { service_charge: "100", service_type: "Repair" }, true)), 100);
});

test("service number format matches web: PREFIX-YYYYMMDD-NNNN", () => {
  assert.equal(genServiceNo("pon", new Date(2026, 9, 7), 4321), "PON-20261007-4321");
});

test("whatsapp: number normalisation and message", () => {
  assert.equal(toWhatsAppNumber("98765 43210"), "919876543210");
  assert.equal(toWhatsAppNumber("+91 9876543210"), "919876543210");
  assert.equal(toWhatsAppNumber("123"), null);
  assert.match(whatsAppUrl("9876543210", "hi there")!, /^https:\/\/wa\.me\/919876543210\?text=hi%20there$/);
  const msg = buildInvoiceWhatsAppMessage({ customer_name: "Arun", invoice_number: "PON-2026-000007", total: 1180, amount_paid: 1000, balance_due: 180 }, { branchName: "Poonamallee" });
  assert.match(msg, /Invoice: PON-2026-000007/); assert.match(msg, /Balance: ₹180\.00/);
});

test("billing: totals match web computeTotals (discount before GST, rounded grand total)", () => {
  const t = computeTotals([{ price: 1000, qty: 2, discount: 10, gst: 18 }]);
  assert.deepEqual([t.subtotal, t.itemDiscount, t.taxable, t.tax, t.grandTotal], [2000, 200, 1800, 324, 2124]);
  assert.equal(computeTotals([{ price: 100.5, qty: 1, gst: 18 }]).grandTotal, 119);
  assert.equal(computeTotals([{ price: 1000, qty: 1, gst: 0 }], { coupon: { discountType: "fixed", discount: 5000 } }).grandTotal, 0);
  assert.equal(maxDiscountPercent(500, 50), 10);
  assert.equal(maxDiscountPercent(0, 50), 0);
});

test("lists: sort, category filter, branch nickname, customer sort", () => {
  const ps = [{ name: "b", price: 20, stock: 1, category: "Audio" }, { name: "a", selling_price: 10, stock: 5, category: "Laptops" }];
  assert.deepEqual(sortProducts(ps, "name-asc").map((p) => p.name), ["a", "b"]);
  assert.deepEqual(sortProducts(ps, "price-desc").map((p) => p.name), ["b", "a"]);
  assert.deepEqual(filterProductsByCategory(ps, "audio").map((p) => p.name), ["b"]);
  assert.equal(branchLabel({ name: "Poonamallee Branch", display_name: "Main Shop" }), "Main Shop");
  assert.equal(branchLabel({ name: "Kundrathur" }), "Kundrathur");
  assert.equal(customerTypeOf({}), "Unspecified");
  assert.deepEqual(sortCustomers([{ name: "B", outstanding: 1 }, { name: "A", total_due: 9 }], "outstanding-desc").map((c) => c.name), ["A", "B"]);
});
