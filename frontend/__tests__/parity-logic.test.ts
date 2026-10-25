// Branch / expense / return / invoice-search / barcode logic — pure, mirrors the web behaviour.
import { test } from "node:test";
import assert from "node:assert/strict";
import { activeBranches, branchExists, nextShopId, slugify, slugOf, validateBranchInput } from "../src/domain/branches.ts";
import { deleteConfirmationPhrase, isDeletedBranch } from "../src/domain/listTools.ts";
import { blankExpenseForm, buildExpensePayload, methodBucket, summarizeExpenses, validateExpense } from "../src/domain/expenses.ts";
import { buildReturnRecord, refundTotal, validateReturn } from "../src/domain/returns.ts";
import { filterInvoices, invoiceMatches, sortInvoices } from "../src/domain/invoiceSearch.ts";
import { code128Svg, productQrPayload, qrSvg } from "../src/domain/barcodeSvg.ts";

const shops = [
  { id: "shop-1", name: "Poonamallee", slug: "poonamallee", branch_code: "PON", invoice_prefix: "PON" },
  { id: "shop-2", name: "Kundrathur" },
  { id: "shop-test", name: "Test Bench", slug: "testbench" },
  { id: "shop-3", name: "Old", status: "archived" },
  { id: "shop-4", name: "Gone", status: "deleted", deleted: true },
];

test("branches: only active, non-retired, non-deleted branches are selectable; legacy slugs resolve", () => {
  const active = activeBranches(shops).map((b) => b.id);
  assert.deepEqual(active, ["shop-2", "shop-1"]); // sorted by name: Kundrathur, Poonamallee
  assert.equal(slugOf({ id: "shop-2" }), "kundrathur");
  assert.equal(nextShopId(shops), "shop-5");
  assert.equal(slugify("  New Branch! #2 "), "new-branch-2");
});

test("branches: creation validates name, duplicate slug / code / prefix and GSTIN", () => {
  assert.match(validateBranchInput({ name: "" }, shops)!, /required/);
  assert.match(validateBranchInput({ name: "Poonamallee" }, shops)!, /similar name/);
  assert.match(validateBranchInput({ name: "X", branch_code: "pon" }, shops)!, /already in use/);
  assert.match(validateBranchInput({ name: "Y", invoice_prefix: "PON" }, shops)!, /already in use/);
  assert.match(validateBranchInput({ name: "Z", gst_registered: true, gstin: "BAD" }, shops)!, /GSTIN/);
  assert.equal(validateBranchInput({ name: "Fresh Branch", pincode: "600001", state: "Tamil Nadu", district: "Chennai", area: "Park Town" }, shops), null);
  assert.equal(validateBranchInput({ name: "Poonamallee" }, shops, { editingId: "shop-1" }), null); // editing itself is fine
  assert.equal(branchExists(shops, { code: "PON" }), true);
});

test("branches: delete needs the exact typed phrase and uses the nickname when set", () => {
  assert.equal(deleteConfirmationPhrase({ name: "Poonamallee", display_name: "Main" }), "DELETE Main");
  assert.equal(deleteConfirmationPhrase({ name: "Kundrathur" }), "DELETE Kundrathur");
  assert.equal(isDeletedBranch({ status: "deleted" }), true);
  assert.equal(isDeletedBranch({ deleted: true }), true);
  assert.equal(isDeletedBranch({ status: "active" }), false);
});

test("expenses: payload matches the web schema (with legacy mirrors) and validation", () => {
  const f = { ...blankExpenseForm(), description: "Shop rent", amount: "15000", expense_type: "Rent", payment_method: "UPI", paidTo: "Landlord", remarks: "Oct" };
  assert.equal(validateExpense(f), null);
  const p = buildExpensePayload(f, "owner@x.com");
  assert.deepEqual([p.expense_type, p.category, p.amount, p.payment_method, p.method, p.paidTo, p.paid_to, p.remarks, p.note, p.entered_by], ["Rent", "Rent", 15000, "UPI", "UPI", "Landlord", "Landlord", "Oct", "Oct", "owner@x.com"]);
  assert.match(validateExpense({ ...f, description: " " })!, /description/);
  assert.match(validateExpense({ ...f, amount: "0" })!, /amount/);
  assert.match(validateExpense({ ...f, expense_type: "Other", custom_expense_type: "" })!, /custom/);
});

test("expenses: method buckets and summaries", () => {
  assert.equal(methodBucket("GPay"), "upi"); assert.equal(methodBucket("Debit card"), "card"); assert.equal(methodBucket("NEFT"), "bank"); assert.equal(methodBucket(""), "other");
  const s = summarizeExpenses([{ amount: 100, payment_method: "Cash", expense_type: "Rent" }, { amount: 50, method: "UPI", category: "Rent" }, { amount: 25, payment_method: "Cheque" }]);
  assert.deepEqual([s.totals.cash, s.totals.upi, s.totals.bank, s.totals.grand], [100, 50, 25, 175]);
  assert.equal(s.byType.Rent, 150);
});

test("returns: refund = qty × price after discount + GST, capped at sold qty; validation", () => {
  const items = [{ name: "A", price: 100, qty: 3, discount: 10, gst: 18, productId: "p1" }, { name: "B", price: 50, quantity: 2 }];
  assert.equal(Math.round(refundTotal(items, { 0: "2" })), Math.round(2 * 100 * 0.9 * 1.18));
  assert.equal(refundTotal(items, { 0: "99" }), 3 * 100 * 0.9 * 1.18); // capped to what was sold
  assert.equal(refundTotal(items, {}), 0);
  assert.match(validateReturn(items, {}, "Wrong item", "")!, /at least one/);
  assert.match(validateReturn(items, { 1: "5" }, "Wrong item", "")!, /exceed/);
  assert.match(validateReturn(items, { 0: "1" }, "Other", " ")!, /custom/);
  assert.equal(validateReturn(items, { 0: "1" }, "Other", "Broken"), null);
  const rec = buildReturnRecord({ invoice: { id: "i1", invoice_number: "PON-2026-000001", customer_name: "Arun" }, items, qtys: { 0: "1" }, reason: "Wrong item", customReason: "", refundMethod: "Cash", note: "", restock: true, branchSlug: "poonamallee", processedBy: "a@b.c" });
  assert.deepEqual([rec.invoiceNumber, rec.invoice_number, rec.customerName, rec.refundAmount, rec.refund_amount, rec.restocked, rec.items[0].productId, rec.items[0].returnQty], ["PON-2026-000001", "PON-2026-000001", "Arun", 106, 106, true, "p1", 1]);
});

test("invoice search: number / name / phone formats / method / item name; sorts", () => {
  const inv = [
    { id: "1", invoice_number: "PON-2026-000007", customer_name: "Arun Kumar", customer_phone: "9876543210", payment_method: "UPI", total: 500, created_at: "2026-10-01T10:00:00Z", items: [{ name: "Boat Earbuds" }] },
    { id: "2", invoice_number: "KUN-2026-000002", customer_name: "Meena", customer_phone: "9123456780", payment_method: "Cash", total: 900, created_at: "2026-10-05T10:00:00Z", items: [] },
  ];
  assert.equal(filterInvoices(inv, "").length, 2);
  assert.equal(filterInvoices(inv, "pon-2026-000007").length, 1);
  assert.equal(filterInvoices(inv, "arun")[0].id, "1");
  for (const q of ["98765 43210", "+91 98765-43210", "919876543210", "09876543210", "76543"]) assert.equal(filterInvoices(inv, q)[0]?.id, "1", q);
  assert.equal(filterInvoices(inv, "cash")[0].id, "2");
  assert.equal(filterInvoices(inv, "earbuds")[0].id, "1");
  assert.equal(invoiceMatches(inv[0], "nomatch"), false);
  assert.deepEqual(sortInvoices(inv, "newest").map((i) => i.id), ["2", "1"]);
  assert.deepEqual(sortInvoices(inv, "amount-asc").map((i) => i.id), ["1", "2"]);
});

test("barcode: real CODE128 SVG (binary bars) and a QR with the AIOH payload", () => {
  const bar = code128Svg("2026100100001");
  assert.match(bar, /^<svg /); assert.ok((bar.match(/<rect /g) || []).length > 20);
  assert.ok(bar.includes("2026100100001")); // human-readable text
  assert.equal(productQrPayload("123"), "AIOH:P:123");
  const qr = qrSvg(productQrPayload("2026100100001"));
  assert.match(qr, /^<svg /); assert.ok(qr.includes("<path "));
  assert.throws(() => code128Svg(""), /Nothing/);
  // deterministic: same input, same output
  assert.equal(code128Svg("ABC-123"), code128Svg("ABC-123"));
});
