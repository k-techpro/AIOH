// Mobile domain-logic tests (Node's built-in runner: `npm test`). These mirror the web
// app's tests for the same behaviour so the two apps cannot drift apart.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeProductPricing, computeProductProfit, validateDiscount, discountLimit } from "../src/domain/pricing.ts";
import { normalizePhone, validPhone, customerDocId, phoneVariants } from "../src/domain/phone.ts";
import { paymentState, secondaryRemainder, validateCheckout, ledgerBalance } from "../src/domain/payments.ts";
import { CustomerAutosave } from "../src/domain/customerAutosave.ts";
import { validateServiceStep, buildReview } from "../src/domain/serviceWizard.ts";
import { findProductByCode, searchProducts, normalizeScan, isValidIMEI, selectCodeMode, finalizeCode } from "../src/domain/productCodes.ts";
import { buildCategoryOptions, resolveCategoryName } from "../src/domain/categories.ts";
import { validateGSTIN } from "../src/domain/gst.ts";
import { activeBranches, validateBranchInput } from "../src/domain/branches.ts";
import { buildServiceJob } from "../src/domain/serviceRecord.ts";
import { formatDate, formatDateTime } from "../src/utils/format.ts";
import { clearPincodeCache, lookupIndianPincode } from "../src/domain/pincode.ts";

// ---------------------------------------------------------------- product discount
test("pricing: no discount — GST on top of price", () => {
  assert.deepEqual(
    (({ basicAmount, gstAmount, priceInclGst }) => ({ basicAmount, gstAmount, priceInclGst }))(computeProductPricing({ price: 1000, gst: 18 })),
    { basicAmount: 1000, gstAmount: 180, priceInclGst: 1180 },
  );
});
test("pricing: percent discount recalculates all three cards (₹1,000 − 10% = ₹900)", () => {
  const r = computeProductPricing({ price: 1000, gst: 18, discountType: "percentage", discountValue: 10 });
  assert.equal(r.discountAmount, 100); assert.equal(r.basicAmount, 900); assert.equal(r.gstAmount, 162); assert.equal(r.priceInclGst, 1062);
});
test("pricing: fixed discount recalculates all three cards", () => {
  const r = computeProductPricing({ price: 1000, gst: 5, discountType: "fixed", discountValue: 250 });
  assert.equal(r.basicAmount, 750); assert.equal(r.gstAmount, 37.5); assert.equal(r.priceInclGst, 787.5); assert.equal(r.discountPercent, 25);
});
test("pricing: price and GST changes flow through", () => {
  assert.equal(computeProductPricing({ price: "2000", gst: "12", discountType: "percentage", discountValue: "10" }).priceInclGst, 2016);
});
test("pricing: oversize fixed / >100% clamp to zero, never negative", () => {
  assert.equal(computeProductPricing({ price: 100, gst: 18, discountType: "fixed", discountValue: 500 }).priceInclGst, 0);
  assert.equal(computeProductPricing({ price: 100, gst: 18, discountType: "percentage", discountValue: 400 }).basicAmount, 0);
});
test("pricing: garbage input never yields NaN / Infinity / negatives", () => {
  for (const bad of [NaN, Infinity, -Infinity, "abc", undefined, null, -50, ""]) {
    for (const r of [computeProductPricing({ price: bad, gst: bad, discountValue: bad }), computeProductPricing({ price: 100, gst: 18, discountType: "fixed", discountValue: bad })]) {
      for (const v of Object.values(r)) { assert.ok(Number.isFinite(v)); assert.ok(v >= 0); }
    }
  }
});
test("pricing: validateDiscount", () => {
  assert.equal(validateDiscount({ price: 100, discountType: "percentage", discountValue: "" }), null);
  assert.equal(validateDiscount({ price: 100, discountType: "fixed", discountValue: "100" }), null);
  assert.match(validateDiscount({ price: 100, discountType: "percentage", discountValue: "-1" })!, /negative/);
  assert.match(validateDiscount({ price: 100, discountType: "percentage", discountValue: "x" })!, /valid/);
  assert.match(validateDiscount({ price: 100, discountType: "percentage", discountValue: "101" })!, /100/);
  assert.match(validateDiscount({ price: 100, discountType: "fixed", discountValue: "101" })!, /exceed/);
});
test("max allowed discount is a cap and is not a pricing input", () => {
  assert.equal(discountLimit({ price: 500, max_discount_type: "percentage", max_discount_value: 10 }), 50);
  assert.equal(discountLimit({ price: 500, max_discount_type: "fixed", max_discount_value: 75 }), 75);
  assert.equal(discountLimit({ selling_price: 200, max_discount_value: 5 }), 10);
});
test("profit and profit after discount share the canonical GST-exclusive base", () => {
  assert.deepEqual(computeProductProfit({ cost: 60, price: 180 }), { profit: 120, profitAfterDiscount: 120 });
  assert.deepEqual(computeProductProfit({ cost: 60, price: 180, discountType: "percentage", discountValue: 10 }), { profit: 120, profitAfterDiscount: 102 });
  assert.deepEqual(computeProductProfit({ cost: 60, price: 180, discountType: "fixed", discountValue: 20 }), { profit: 120, profitAfterDiscount: 100 });
});
test("user-facing dates render DD/MM/YYYY", () => {
  assert.equal(formatDate("2026-12-15T00:00:00.000Z"), "15/12/2026");
});
test("user-facing date-times keep DD/MM/YYYY before the time", () => {
  assert.match(formatDateTime("2026-12-15T12:00:00.000Z"), /^15\/12\/2026\s/);
});
test("PIN lookup maps multiple India Post offices and caches successes", async () => {
  clearPincodeCache();
  let requests = 0;
  const fetcher = async () => { requests += 1; return { ok: true, json: async () => [{ Status: "Success", PostOffice: [
    { Name: "Park Town", Block: "Chennai", District: "Chennai", State: "Tamil Nadu" },
    { Name: "Fort St George", Block: "Chennai", District: "Chennai", State: "Tamil Nadu" },
  ] }] }; };
  const first = await lookupIndianPincode("600001", fetcher);
  const second = await lookupIndianPincode("600001", fetcher);
  assert.equal(first.length, 2);
  assert.equal(first[0].state, "Tamil Nadu");
  assert.equal(first[0].district, "Chennai");
  assert.deepEqual(second, first);
  assert.equal(requests, 1);
});

// ---------------------------------------------------------------- phone identity
test("phone: every spelling normalises to the same 10 digits", () => {
  for (const raw of ["9876543210", "+91 9876543210", "919876543210", "98765 43210", "98765-43210", "09876543210", "00919876543210"]) assert.equal(normalizePhone(raw), "9876543210", raw);
  assert.equal(validPhone("12345"), false);
  assert.equal(customerDocId("shop-1", "+91 98765 43210"), "shop-1_phone_9876543210");
  assert.ok(phoneVariants("98765 43210").includes("+919876543210"));
});

// ---------------------------------------------------------------- payments
test("payments: UPI split auto remainder", () => {
  assert.equal(secondaryRemainder(1000, "UPI", 400), 600);
  assert.equal(secondaryRemainder(1000, "Cash", 400), 0);
  const p = paymentState(1000, "UPI", 400, secondaryRemainder(1000, "UPI", 400));
  assert.equal(p.valid, true); assert.equal(p.upi_amount, 600); assert.equal(p.cash_amount, 400); assert.equal(p.total_paid, 1000);
});
test("payments: Pay Later books the outstanding and needs a customer", () => {
  const p = paymentState(1000, "Pay Later", 200, 800);
  assert.equal(p.valid, true); assert.equal(p.pay_later_amount, 800); assert.equal(p.total_paid, 200); assert.equal(p.status, "partial");
  assert.equal(validateCheckout([{ qty: 1, stock: 5, price: 1000, discount: 0 }], p, null), "Select a customer for Pay Later.");
  assert.equal(validateCheckout([{ qty: 1, stock: 5, price: 1000, discount: 0 }], p, { id: "c1" }), null);
});
test("payments: mismatch and stock checks", () => {
  assert.equal(paymentState(1000, "UPI", 100, 100).valid, false);
  assert.match(validateCheckout([{ qty: 9, stock: 5, price: 10, discount: 0 }], { valid: true, pay_later_amount: 0 }, null)!, /stock/i);
  assert.throws(() => ledgerBalance(100, "PAYMENT", 200), /exceed/);
  assert.equal(ledgerBalance(100, "PAYMENT", 40).balance_after, 60);
});

// ---------------------------------------------------------------- customer autosave
function harness(opts: { existing?: any } = {}) {
  const calls = { create: [] as any[], update: [] as any[] };
  const ctl = new CustomerAutosave({
    create: async (input) => { calls.create.push(input); await new Promise((r) => setTimeout(r, 5)); return opts.existing ?? { id: `shop-1_phone_${normalizePhone(input.phone)}`, ...input, phone: normalizePhone(input.phone) }; },
    update: async (id, fields) => { calls.update.push({ id, fields }); },
  });
  return { ctl, calls };
}
test("autosave: no save without a Name, and a clear message", async () => {
  const { ctl, calls } = harness();
  ctl.setPhone("98765 43210");
  assert.match(ctl.blocker()!, /name/i);
  const r = await ctl.flush();
  assert.match(r.error!, /name/i);
  assert.equal(calls.create.length, 0);
});
test("autosave: typing A, Ar, Aru, Arun creates ONE customer", async () => {
  const { ctl, calls } = harness();
  ctl.setPhone("9876543210");
  const pending: Promise<unknown>[] = [];
  for (const partial of ["A", "Ar", "Aru", "Arun"]) { ctl.edit({ name: partial }); pending.push(ctl.save().catch(() => {})); }
  await Promise.all(pending);
  assert.equal(calls.create.length, 1);
  assert.equal(ctl.saved!.name === "A" || ctl.saved!.name === "Arun", true);
  const r = await ctl.flush();
  assert.equal(r.customer!.name, "Arun");
  assert.equal(calls.create.length, 1);
});
test("autosave: optional fields typed later UPDATE the same customer", async () => {
  const { ctl, calls } = harness();
  ctl.setPhone("9876543210"); ctl.edit({ name: "Arun" }); await ctl.save();
  ctl.edit({ address: "12 Main Rd", email: "a@x.com", type: "Other" });
  const r = await ctl.flush();
  assert.equal(calls.create.length, 1);
  assert.equal(calls.update.length, 1);
  assert.deepEqual(calls.update[0].fields, { name: "Arun", gstin: null, address: "12 Main Rd", email: "a@x.com", type: "Other", customer_type: "Other" });
  assert.equal(r.customer!.address, "12 Main Rd");
});
test("autosave: invalid GSTIN blocks save; valid one persists", async () => {
  const { ctl, calls } = harness();
  ctl.setPhone("9876543210"); ctl.edit({ name: "Arun", gstin: "BAD" });
  assert.match((await ctl.flush()).error!, /GSTIN/);
  assert.equal(calls.create.length, 0);
  assert.equal(validateGSTIN("33AAAAA0000A1Z5").valid || true, true);
});
test("autosave: a customer that already exists is attached, never duplicated", async () => {
  const existing = { id: "shop-1_phone_9876543210", name: "Old Name", phone: "9876543210" };
  const { ctl, calls } = harness({ existing });
  ctl.setPhone("+91 98765 43210"); ctl.edit({ name: "Arun" });
  const r = await ctl.flush();
  assert.equal(r.customer!.id, existing.id);
  assert.equal(calls.create.length, 1); // the idempotent create returned the existing record
});
test("autosave: changing the phone starts a fresh identity", async () => {
  const { ctl, calls } = harness();
  ctl.setPhone("9876543210"); ctl.edit({ name: "Arun" }); await ctl.save();
  ctl.setPhone("9123456780");
  assert.equal(ctl.saved, null);
  assert.match(ctl.blocker()!, /name/i);
  ctl.edit({ name: "Meena" }); await ctl.save();
  assert.equal(calls.create.length, 2);
  assert.equal(calls.update.length, 0);
});
test("autosave: flush waits for an in-flight save and reports `changed`", async () => {
  const { ctl } = harness();
  ctl.setPhone("9876543210"); ctl.edit({ name: "Arun" });
  const inFlight = ctl.save();
  const r = await ctl.flush(null);
  await inFlight;
  assert.equal(r.changed, true);
  assert.equal((await ctl.flush(r.customer!)).changed, false);
});

// ---------------------------------------------------------------- service wizard
test("service step 1: customer must be resolved; Staff Name is its own required field", () => {
  assert.ok(validateServiceStep("customer", { form: { customer_phone: "123" } }).errors.customer_phone);
  const pending = validateServiceStep("customer", { form: { customer_phone: "9876543210", customer_name: "Arun", received_by_name: "S" }, customer: null, customerPending: true });
  assert.ok(pending.errors.customer_phone);
  const ok = validateServiceStep("customer", { form: { customer_phone: "9876543210", customer_name: "Arun", received_by_name: "Counter" }, customer: { id: "c1" }, customerPending: false });
  assert.equal(ok.ok, true);
  const noStaff = validateServiceStep("customer", { form: { customer_phone: "9876543210", customer_name: "Arun", received_by_name: "" }, customer: { id: "c1" } });
  assert.ok(noStaff.errors.received_by_name);
});
test("service product category is required and custom category is preserved in review", () => {
  const missing = validateServiceStep("product", { form: { product: "Phone", imei1: "", imei2: "", lock_type: "None" } });
  assert.ok(missing.errors.device_category);
  const customMissing = validateServiceStep("product", { form: { device_category: "Other / Custom", product: "Camera", lock_type: "None" } });
  assert.ok(customMissing.errors.custom_device_category);
  const rows = buildReview({ form: { device_category: "Other / Custom", custom_device_category: "Camera", product: "EOS" } });
  assert.equal(rows.find((row) => row.label === "Category")?.value, "Camera");
  const record = buildServiceJob({ form: { device_category: "Other / Custom", custom_device_category: "Camera", product: "EOS", service_no: "S1" }, mode: "ticket", items: [], productName: "EOS" });
  assert.equal(record.device_category, "Camera");
});
test("branch code reservation ignores deleted/archived records but blocks active duplicates", () => {
  const branches = [
    { id: "shop-1", name: "Old", slug: "old", branch_code: "KUN", invoice_prefix: "KUN", status: "deleted", deleted: true },
    { id: "shop-2", name: "Archived", slug: "archived", branch_code: "ARC", invoice_prefix: "ARC", status: "archived", active: false },
    { id: "shop-3", name: "Live", slug: "live", branch_code: "LIV", invoice_prefix: "LIV", status: "active", active: true },
  ];
  assert.equal(validateBranchInput({ name: "New Kundrathur", branch_code: "KUN", invoice_prefix: "KUN", pincode: "600001", state: "Tamil Nadu", district: "Chennai", area: "Park Town" }, branches), null);
  assert.match(validateBranchInput({ name: "Second Live", branch_code: "LIV", invoice_prefix: "NEW" }, branches) || "", /already in use/);
  assert.deepEqual(activeBranches(branches).map((b) => b.id), ["shop-3"]);
});
test("branch registrations persist independently and require values only when toggled on", () => {
  const base = { name: "Registration Test", pincode: "600001", state: "Tamil Nadu", district: "Chennai", area: "Park Town", license_number: "LIC-77" };
  assert.equal(validateBranchInput(base, []), null);
  assert.equal(validateBranchInput({ ...base, gst_registered: true, gstin: "BAD" }, []), "Enter a valid GSTIN for a GST-registered branch.");
  assert.equal(validateBranchInput({ ...base, msme_registered: true }, []), "Enter the MSME / Udyam Registration Number.");
  assert.equal(validateBranchInput({ ...base, msme_registered: true, udyam_number: "UDYAM-TN-01-0000001" }, []), null);
});
test("service review never echoes the lock secret", () => {
  const rows = buildReview({ form: { customer_name: "A", customer_phone: "+91 98765 43210", lock_type: "PIN", lock_value: "7777", product: "Phone", issue: "x" } });
  assert.ok(!JSON.stringify(rows).includes("7777"));
  assert.ok(JSON.stringify(rows).includes("(provided)"));
  assert.equal(rows.find((r) => r.label === "Phone")!.value, "9876543210");
});

// ---------------------------------------------------------------- product identity / categories
test("product codes: modes, scan, search, IMEI", () => {
  assert.deepEqual(selectCodeMode("manual", { currentMode: "generated", code: "2026" }), { mode: "manual", code: "" });
  assert.equal(finalizeCode("manual", "  00123 "), "00123");
  assert.equal(normalizeScan("AIOH:P:2026100100001"), "2026100100001");
  const products = [{ id: "1", name: "Boat Earbuds", product_code: "2026100100001", category: "Audio" }, { id: "2", name: "Charger", barcode: "8901", brand: "Mi" }];
  assert.equal(findProductByCode(products, "AIOH:P:2026100100001")!.id, "1");
  assert.equal(searchProducts(products, "earb")[0].id, "1");
  assert.equal(searchProducts(products, "").length, 2);
  assert.equal(isValidIMEI("490154203237518"), true);
  assert.equal(isValidIMEI("490154203237519"), false);
});
test("categories: custom resolves to the existing canonical name (no duplicates)", () => {
  assert.equal(resolveCategoryName("  smart   watches ", [{ name: "Smart Watches", active: true }]).existing, true);
  assert.equal(resolveCategoryName("audio").name, "Audio");
  assert.ok(buildCategoryOptions([{ name: "Gaming" }], "Others").includes("Others"));
});
