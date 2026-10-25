// Web-compatible Firestore operations for mobile.
//
// These mirror the web app's services/db.js + services/customerFinance.js so a record created
// on a phone is indistinguishable from one created in the browser: same collection paths
// (users/{business_owner_uid}/businessData/{name}/records), canonical `shop_id`, canonical
// product_code / normalized_phone, atomic per-branch invoice counters, inventory movements.
import { getApp } from "@react-native-firebase/app";
import {
  arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, getFirestore, increment, limit, onSnapshot, query, runTransaction, setDoc, updateDoc, where,
} from "@react-native-firebase/firestore";
import { useBusiness } from "./business";
import { useAppStore } from "../store/shop";
import { normalizePhone, validPhone, phoneVariants } from "../domain/phone.ts";
import { randomProductCode } from "../domain/productCodes.ts";
import { discountLimit } from "../domain/pricing.ts";

const LEGACY_SLUG_BY_ID: Record<string, string> = { "shop-1": "poonamallee", "shop-2": "kundrathur" };
const db = () => getFirestore(getApp(), "default");

export interface DataContext { businessId: string; uid: string; role: string; shopId: string; branchSlug: string | null; invoicePrefix: string | null; servicePrefix: string | null; shopName: string }

/** Current business / actor / branch — the equivalent of the web app's `dataContext`. */
export function dataContext(shops: any[] = []): DataContext {
  const b = useBusiness.getState();
  const shopId = useAppStore.getState().shopId;
  if (!b.businessId || !b.actorUid) throw new Error("Secure access is not established yet. Sign in again.");
  const shop: any = shops.find((s) => s.id === shopId) || {};
  return {
    businessId: b.businessId, uid: b.actorUid, role: b.access?.role || "STAFF", shopId,
    branchSlug: shop.slug || LEGACY_SLUG_BY_ID[shopId] || shopId || null,
    invoicePrefix: shop.invoice_prefix || null, servicePrefix: shop.service_prefix || null, shopName: shop.display_name || shop.nickname || shop.name || "",
  };
}
const requireShop = (c: DataContext) => { if (!c.shopId || c.shopId === "all") throw new Error("Select a branch first."); return c; };

export const recordsCol = (businessId: string, name: string) => collection(db(), "users", businessId, "businessData", name, "records");
export const recordDoc = (businessId: string, name: string, id: string) => doc(db(), "users", businessId, "businessData", name, "records", id);

export function sanitize(value: any): any {
  if (value === undefined || typeof value === "function") return undefined;
  if (value === null) return null;
  if (typeof value === "number" && !Number.isFinite(value)) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && (value._methodName || value.constructor?.name === "FieldValue")) return value;
  if (Array.isArray(value)) return value.map(sanitize).filter((v) => v !== undefined);
  if (typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v)]).filter(([, v]) => v !== undefined));
  return value;
}

// Ledger CREDIT row for a Pay Later sale / service (web writeCredit) — keeps balance_before/after consistent.
function writeCredit(tx: any, c: DataContext, customer: any, before: number, amount: number, referenceType: string, referenceId: string, reference: string, now: string) {
  const ref = doc(recordsCol(c.businessId, "paylaterLedger"));
  const b = Math.round(Number(before) * 100) / 100, a = Math.round(Number(amount) * 100) / 100;
  tx.set(ref, sanitize({
    id: ref.id, shop_id: c.shopId, customer_id: customer.id, customer_name: customer.name, customer_phone: customer.phone || "", type: "CREDIT",
    balance_before: b, balance_after: Math.round((b + a) * 100) / 100, amount: a, delta: a,
    reference_type: referenceType, reference_id: referenceId, reference, payment_method: "Pay Later",
    created_by_uid: c.uid, created_by_name: c.uid, role: c.role, created_at: now, createdAt: now, source: "mobile",
  }));
}

// ------------------------------------------------------------------------------- customers
/** Targeted phone lookup within the current branch — all stored phone spellings, legacy fields included. */
export async function lookupCustomer(phone: string, shops: any[] = []): Promise<any | null> {
  const c = dataContext(shops);
  const p = normalizePhone(phone);
  if (!validPhone(p) || !c.shopId || c.shopId === "all") return null;
  const col = recordsCol(c.businessId, "customers");
  for (const [field, values] of [["normalized_phone", [p]], ["phone", phoneVariants(phone)], ["customerPhone", phoneVariants(phone)], ["customer_phone", phoneVariants(phone)]] as [string, string[]][]) {
    const snap = await getDocs(query(col, where("shop_id", "==", c.shopId), where(field, "in", values), limit(2)));
    if (snap.size > 1) throw new Error("Multiple customers share this phone. Resolve duplicate customer records before billing.");
    if (!snap.empty) {
      const found: any = { ...snap.docs[0].data(), id: snap.docs[0].id };
      if (!found.normalized_phone) {
        try { await updateDoc(snap.docs[0].ref, { normalized_phone: p }); found.normalized_phone = p; } catch { /* best-effort backfill */ }
      }
      return { ...found, outstanding: Number(found.outstanding ?? found.total_due ?? 0), total_due: Number(found.total_due ?? found.outstanding ?? 0), phone: found.phone ?? found.customerPhone ?? p };
    }
  }
  return null;
}

/** Idempotent create: the deterministic `${shop}_phone_${phone}` id serialises concurrent attempts. */
export async function createPhoneCustomer(input: Record<string, any>, shops: any[] = []): Promise<any> {
  const c = requireShop(dataContext(shops));
  const p = normalizePhone(input.phone);
  if (!validPhone(p) || !String(input.name || "").trim()) throw new Error("Enter a name and a valid 10-digit phone number.");
  const existing = await lookupCustomer(input.phone, shops);
  if (existing) return existing;
  const ref = recordDoc(c.businessId, "customers", `${c.shopId}_phone_${p}`);
  const now = new Date().toISOString();
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return { ...(snap.data() as any), id: ref.id };
    const customer = {
      ...input, id: ref.id, name: String(input.name).trim(), phone: p, normalized_phone: p, shop_id: c.shopId, branchId: c.branchSlug,
      gstIn: input.gstin ?? null, total_purchases: 0, total_paid: 0, outstanding: 0, total_due: 0,
      created_at: now, createdAt: now, updated_at: now, updatedAt: now, created_by_uid: c.uid, source: "mobile",
    };
    tx.set(ref, sanitize(customer));
    return customer;
  });
}

/** Descriptive fields only — never phone identity, shop, balances or ledger. */
export async function updateCustomerDetails(customerId: string, fields: Record<string, any>, shops: any[] = []): Promise<void> {
  const c = requireShop(dataContext(shops));
  const patch: Record<string, any> = {};
  for (const k of ["name", "address", "email", "gstin", "type", "customer_type"]) if (k in fields) patch[k] = fields[k];
  if ("gstin" in patch) patch.gstIn = patch.gstin;
  if (typeof patch.name === "string" && !patch.name.trim()) throw new Error("Customer name is required.");
  if (typeof patch.name === "string") patch.name = patch.name.trim();
  const now = new Date().toISOString();
  await updateDoc(recordDoc(c.businessId, "customers", customerId), sanitize({ ...patch, updated_at: now, updatedAt: now, updated_by_uid: c.uid }));
}

// ------------------------------------------------------------------------------- products
async function findConflict(businessId: string, code: string) {
  const col = recordsCol(businessId, "products");
  for (const field of ["product_code", "qr_id", "barcode"]) {
    const snap = await getDocs(query(col, where(field, "==", code), limit(1)));
    if (!snap.empty) return { id: snap.docs[0].id, ...(snap.docs[0].data() as any) };
  }
  return null;
}
export async function findExistingProductByCode(code: string, shops: any[] = []) {
  if (!code) return null;
  return findConflict(dataContext(shops).businessId, code);
}
export async function generateUniqueProductCode(shops: any[] = []): Promise<string> {
  const c = dataContext(shops);
  let timeoutId: ReturnType<typeof setTimeout>;
  const work = (async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = randomProductCode(new Date());
      if (!(await findConflict(c.businessId, candidate))) return candidate;
    }
    throw new Error("Could not generate a unique product code. Retry.");
  })();
  const timeout = new Promise<string>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Could not generate product code. Retry.")), 12000);
  });
  try { return await Promise.race([work, timeout]); }
  finally { clearTimeout(timeoutId!); }
}

/** Audited stock edit: product update + inventory movement in one transaction. */
export async function adjustProductStock(productId: string, requested: number, reason = "CORRECTION", meta: { reason?: string } = {}, shops: any[] = []) {
  const c = requireShop(dataContext(shops));
  const productRef = recordDoc(c.businessId, "products", productId);
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(productRef);
    const p: any = snap.data();
    if (!snap.exists() || p.shop_id !== c.shopId) throw new Error("Product is not available in this branch.");
    const oldQuantity = Number(p.stock || 0), newQuantity = Number(requested);
    if (!Number.isFinite(newQuantity) || newQuantity < 0) throw new Error("Stock must be a non-negative number.");
    const change = newQuantity - oldQuantity;
    if (!change) return { oldQuantity, newQuantity, changeQuantity: 0 };
    const now = new Date().toISOString();
    const movementRef = doc(recordsCol(c.businessId, "inventoryMovements"));
    tx.set(productRef, { stock: newQuantity, updatedAt: now, updated_at: now, updated_by_uid: c.uid }, { merge: true });
    tx.set(movementRef, sanitize({
      id: movementRef.id, shop_id: c.shopId, branchId: c.branchSlug, product_id: productId, productId, product_code: p.product_code ?? p.barcode ?? null,
      product_name: p.name ?? null, old_quantity: oldQuantity, change_quantity: change, new_quantity: newQuantity,
      previousQuantity: oldQuantity, quantityDelta: change, type: reason, reason: meta.reason || reason, user_uid: c.uid, createdAt: now, created_at: now, source: "mobile",
    }));
    return { oldQuantity, newQuantity, changeQuantity: change };
  });
}

/** Create or update a product in the canonical web schema (price/cost/lowStockAlert + legacy mirrors). */
export async function saveProductRecord(payload: Record<string, any>, opts: { id?: string | null; openingStock?: number; newCategory?: { name: string; normalized_name: string } | null; stockEdit?: number | null; expectedStock?: number; operationId?: string }, shops: any[] = []): Promise<string> {
  const c = requireShop(dataContext(shops));
  const now = new Date().toISOString();
  if (opts.newCategory) {
    const ref = doc(recordsCol(c.businessId, "productCategories"));
    await setDoc(ref, sanitize({ ...opts.newCategory, id: ref.id, active: true, created_by: c.uid, scope: "business", created_at: now, createdAt: now }));
  }
  const body = {
    ...payload, shop_id: c.shopId, selling_price: payload.price, cost_price: payload.cost, min_stock: payload.lowStockAlert,
    updated_by_uid: c.uid, updatedAt: now, updated_at: now,
  };
  if (opts.id) {
    await setDoc(recordDoc(c.businessId, "products", opts.id), sanitize(body), { merge: true });
    if (opts.stockEdit != null) await adjustProductStock(opts.id, opts.stockEdit, "CORRECTION", { reason: "Product stock edit" }, shops);
    return opts.id;
  }
  const ref = doc(recordsCol(c.businessId, "products"));
  await setDoc(ref, sanitize({ is_accessory: false, ...body, id: ref.id, stock: 0, created_by_uid: c.uid, createdAt: now, created_at: now, source: "mobile" }));
  if ((opts.openingStock || 0) > 0) await adjustProductStock(ref.id, opts.openingStock as number, "OPENING_STOCK", { reason: "Opening stock" }, shops);
  return ref.id;
}

// ------------------------------------------------------------------------------- sales
/**
 * Atomic checkout: invoice + inventory + sales row + payments + customer + Pay Later due in one
 * transaction, with a per-branch/year invoice counter (e.g. PON-2026-000123) exactly like web.
 * Idempotent on `sale.operation_id`.
 */
export async function completeSale(sale: Record<string, any>, customer: any | null, coupon: any | null = null, shops: any[] = []): Promise<any> {
  const c = requireShop(dataContext(shops));
  if (sale.balance > 0 && !customer?.id) throw new Error("Customer is required for Pay Later.");
  const invoiceRef = sale.operation_id ? recordDoc(c.businessId, "invoices", sale.operation_id) : doc(recordsCol(c.businessId, "invoices"));
  const year = new Date().getFullYear();
  const prefix = (c.invoicePrefix || c.branchSlug || c.shopId || "INV").slice(0, 6).toUpperCase();
  const counterRef = recordDoc(c.businessId, "counters", `invoice_${prefix}_${year}`);
  const legacyCounterRef = recordDoc(c.businessId, "counters", `invoice_${c.shopId}_${year}`);
  const productRefs = sale.items.map((i: any) => recordDoc(c.businessId, "products", i.productId));
  const customerRef = customer ? recordDoc(c.businessId, "customers", customer.id) : null;
  const couponRef = coupon ? recordDoc(c.businessId, "coupons", coupon.id) : null;
  const now = new Date().toISOString();
  return runTransaction(db(), async (tx) => {
    const existing = await tx.get(invoiceRef);
    if (existing.exists()) return { ...(existing.data() as any), id: invoiceRef.id };
    const snaps: any[] = await Promise.all([tx.get(counterRef), tx.get(legacyCounterRef), ...productRefs.map((r: any) => tx.get(r)), ...(customerRef ? [tx.get(customerRef)] : []), ...(couponRef ? [tx.get(couponRef)] : [])]);
    const storedSequence = Math.max(Number(snaps[0].data()?.value || 0), Number(snaps[1].data()?.value || 0));
    const sequence = storedSequence + 1;
    const invoiceNumber = `${prefix}-${year}-${String(sequence).padStart(6, "0")}`;
    const products = snaps.slice(2, productRefs.length + 2);
    const customerSnap = customerRef ? snaps[2 + productRefs.length] : null;
    if (customerRef && (!customerSnap.exists() || customerSnap.data().shop_id !== c.shopId)) throw new Error("Customer is not available in this branch.");
    products.forEach((snap: any, index: number) => {
      const item = sale.items[index];
      if (!snap.exists() || snap.data().shop_id !== c.shopId) throw new Error(`${item.name} is not available in this branch.`);
      if (Number(snap.data().stock || 0) < Number(item.qty)) throw new Error(`Insufficient stock for ${item.name}.`);
      if (!(Number(item.qty) > 0)) throw new Error("Invalid quantity.");
      const over = (Number(item.price) * Number(item.discount || 0)) / 100 > discountLimit({ ...snap.data(), price: item.price }) + 0.005;
      if (over && (!["OWNER", "ADMIN"].includes(c.role) || !sale.discount_override?.override_reason)) throw new Error("Discount exceeds authorized limit.");
    });
    const couponSnap = couponRef ? snaps[snaps.length - 1] : null;
    if (couponSnap && (!couponSnap.exists() || couponSnap.data().enabled === false || couponSnap.data().active === false)) throw new Error("The selected coupon is no longer available.");
    if (couponSnap && couponSnap.data().usageLimit != null && Number(couponSnap.data().usageCount ?? couponSnap.data().used ?? 0) >= Number(couponSnap.data().usageLimit)) throw new Error("The selected coupon has reached its usage limit.");

    // Cost of goods / gross profit (kept for the mobile dashboard's profit KPIs; extra fields are harmless to web).
    const costOfGoods = products.reduce((n: number, snap: any, i: number) => n + Number(snap.data().cost ?? snap.data().cost_price ?? 0) * Number(sale.items[i].qty), 0);
    const invoice = sanitize({
      ...sale, costOfGoods, grossProfit: Number(sale.grandTotal || 0) - costOfGoods, shop_id: c.shopId, branchId: c.branchSlug, id: invoiceRef.id, invoiceId: invoiceRef.id, invoiceNumber, invoice_number: invoiceNumber, source: "mobile",
      createdBy: c.uid, created_by: c.uid, customerId: customer?.id ?? null, customer_id: customer?.id ?? null,
      customerName: customer?.name ?? "Walk-in Customer", customer_name: customer?.name ?? "Walk-in Customer",
      customerPhone: customer?.phone ?? null, customer_phone: customer?.phone ?? null, customerEmail: customer?.email ?? null, customer_email: customer?.email ?? null,
      customerAddress: customer?.address ?? null, customer_address: customer?.address ?? null,
      customerGstin: customer?.gstin ?? customer?.gstIn ?? null, customer_gstin: customer?.gstin ?? customer?.gstIn ?? null,
      total: sale.grandTotal, discount: sale.totalDiscount, amount_paid: sale.paidAmount, balance_due: sale.balance, payment_method: sale.paymentMethod,
      items: sale.items.map((i: any) => ({ ...i, product_id: i.productId, quantity: i.qty })),
      createdAt: now, created_at: now, updatedAt: now, updated_at: now,
    });
    tx.set(counterRef, { value: sequence, shop_id: c.shopId, updated_at: now }, { merge: true });
    products.forEach((snap: any, index: number) => {
      const item = sale.items[index], before = Number(snap.data().stock || 0), movementRef = doc(recordsCol(c.businessId, "inventoryMovements"));
      tx.set(productRefs[index], { stock: before - Number(item.qty), updatedAt: now, updated_at: now }, { merge: true });
      tx.set(movementRef, sanitize({
        id: movementRef.id, shop_id: c.shopId, branchId: c.branchSlug, created_by_uid: c.uid, productId: item.productId, product_id: item.productId, productName: item.name, product_name: item.name,
        product_code: snap.data().product_code ?? null, type: "SALE", quantityDelta: -Number(item.qty), change_quantity: -Number(item.qty), previousQuantity: before, old_quantity: before,
        newQuantity: before - Number(item.qty), new_quantity: before - Number(item.qty), invoiceId: invoiceRef.id, invoice_id: invoiceRef.id, invoiceNumber, createdAt: now, created_at: now, source: "mobile",
      }));
    });
    tx.set(invoiceRef, invoice);
    const pf = {
      cash_amount: sale.cash_amount ?? 0, upi_amount: sale.upi_amount ?? 0, card_amount: sale.card_amount ?? 0, pay_later_amount: sale.pay_later_amount ?? sale.balance ?? 0,
      payment_primary_method: sale.payment_primary_method ?? sale.paymentMethod, total_paid: sale.paidAmount, outstanding_amount: sale.balance,
      customer_name: invoice.customerName, customer_phone: invoice.customerPhone,
    };
    tx.set(doc(recordsCol(c.businessId, "sales"), invoiceRef.id), sanitize({
      ...pf, shop_id: c.shopId, branchId: c.branchSlug, created_by_uid: c.uid, id: invoiceRef.id, invoiceId: invoiceRef.id, invoice_id: invoiceRef.id, invoiceNumber, invoice_number: invoiceNumber,
      customerId: customer?.id ?? null, customer_id: customer?.id ?? null, total: sale.grandTotal, grandTotal: sale.grandTotal, status: sale.status, createdAt: now, created_at: now, source: "mobile",
    }));
    const entries = (sale.paymentBreakdown ?? []).filter((e: any) => Number(e.amount) > 0 && e.method !== "Pay Later");
    entries.forEach((entry: any, index: number) => {
      const ref = doc(recordsCol(c.businessId, "payments"));
      tx.set(ref, sanitize({
        shop_id: c.shopId, branchId: c.branchSlug, created_by_uid: c.uid, id: ref.id, invoiceId: invoiceRef.id, invoice_id: invoiceRef.id, invoiceNumber, invoice_number: invoiceNumber,
        customerId: customer?.id ?? null, customer_id: customer?.id ?? null, customerName: invoice.customerName, customer_name: invoice.customerName,
        amount: Number(entry.amount), method: entry.method, payment_method: entry.method, status: sale.status, paymentBreakdown: sale.paymentBreakdown, sequence: index + 1,
        createdAt: now, created_at: now, source: "mobile",
      }));
    });
    if (customerRef) tx.set(customerRef, { total_purchases: increment(sale.grandTotal), total_paid: increment(sale.paidAmount), total_due: increment(sale.balance), outstanding: increment(sale.balance), updatedAt: now, updated_at: now }, { merge: true });
    if (sale.balance > 0) writeCredit(tx, c, { ...(customerSnap.data() as any), id: customerRef!.id }, Number(customerSnap.data().outstanding ?? customerSnap.data().total_due ?? 0), sale.balance, "invoice", invoiceRef.id, invoiceNumber, now);
    if (sale.balance > 0) {
      const dueRef = doc(recordsCol(c.businessId, "paylater"));
      tx.set(dueRef, sanitize({
        shop_id: c.shopId, branchId: c.branchSlug, created_by_uid: c.uid, id: dueRef.id, invoiceId: invoiceRef.id, invoice_id: invoiceRef.id, invoiceNumber, invoice_number: invoiceNumber,
        customerId: customer.id, customer_id: customer.id, customerName: customer.name, customer_name: customer.name, customerPhone: customer.phone ?? null,
        amount: sale.grandTotal, paid: sale.paidAmount, remaining: sale.balance, status: sale.paidAmount > 0 ? "partial" : "pending", createdAt: now, created_at: now, source: "mobile",
      }));
    }
    if (couponRef) tx.set(couponRef, { used: increment(1), usageCount: increment(1), updatedAt: now, updated_at: now }, { merge: true });
    return { ...invoice, id: invoiceRef.id };
  });
}

// ------------------------------------------------------------------------------- services
/** Service ticket / quick bill: one record; inventory parts consume stock with SERVICE_USAGE movements. */
export async function createServiceWithUsage(service: Record<string, any>, shops: any[] = []): Promise<any> {
  const c = requireShop(dataContext(shops));
  if (service.pay_later_amount > 0 && !service.customer_id) throw new Error("Customer is required for Pay Later.");
  const customerRef = service.customer_id ? recordDoc(c.businessId, "customers", service.customer_id) : null;
  const serviceRef = service.operation_id ? recordDoc(c.businessId, "services", service.operation_id) : doc(recordsCol(c.businessId, "services"));
  const stockItems = (service.items || []).filter((i: any) => i.kind === "inventory" && i.product_id);
  const productRefs = stockItems.map((i: any) => recordDoc(c.businessId, "products", i.product_id));
  const now = new Date().toISOString();
  return runTransaction(db(), async (tx) => {
    const existing = await tx.get(serviceRef);
    if (existing.exists()) return existing.data();
    const snaps: any[] = await Promise.all(productRefs.map((r: any) => tx.get(r)));
    const customerSnap = customerRef ? await tx.get(customerRef) : null;
    if (customerRef && (!customerSnap!.exists() || (customerSnap!.data() as any).shop_id !== c.shopId)) throw new Error("Customer is not available in this branch.");
    snaps.forEach((snap, i) => {
      const item = stockItems[i];
      if (!snap.exists() || snap.data().shop_id !== c.shopId) throw new Error(`${item.name} is not available in this branch.`);
      if (Number(snap.data().stock || 0) < Number(item.qty || 0)) throw new Error(`Insufficient stock for ${item.name}.`);
    });
    tx.set(serviceRef, sanitize({ ...service, id: serviceRef.id, shop_id: c.shopId, branchId: c.branchSlug, created_by_uid: c.uid, createdAt: now, created_at: now, updatedAt: now, updated_at: now, source: "mobile" }));
    if (customerSnap) {
      const cu: any = customerSnap.data(), credit = Number(service.pay_later_amount || 0), paid = Number(service.total_paid || 0);
      tx.update(customerRef!, { total_purchases: Number(cu.total_purchases || 0) + Number(service.total || 0), total_paid: Number(cu.total_paid || 0) + paid, outstanding: Number(cu.outstanding ?? cu.total_due ?? 0) + credit, total_due: Number(cu.outstanding ?? cu.total_due ?? 0) + credit, updatedAt: now, updated_at: now });
      if (credit > 0) {
        writeCredit(tx, c, { ...cu, id: customerRef!.id }, Number(cu.outstanding ?? cu.total_due ?? 0), credit, "service", serviceRef.id, service.service_no, now);
        const due = doc(recordsCol(c.businessId, "paylater"));
        tx.set(due, sanitize({ id: due.id, shop_id: c.shopId, customer_id: customerRef!.id, customerId: customerRef!.id, customer_name: cu.name, customerName: cu.name, customer_phone: cu.phone || "", service_id: serviceRef.id, invoiceNumber: service.service_no, amount: Number(service.total), paid, remaining: credit, status: "pending", created_at: now, createdAt: now, source: "mobile" }));
      }
    }
    (service.paymentBreakdown || []).filter((p: any) => p.method !== "Pay Later" && p.amount > 0).forEach((p: any) => {
      const ref = doc(recordsCol(c.businessId, "payments"));
      tx.set(ref, sanitize({ id: ref.id, shop_id: c.shopId, branchId: c.branchSlug, service_id: serviceRef.id, reference: service.service_no, customer_id: service.customer_id || null, customer_name: service.customer_name, customer_phone: service.customer_phone, amount: Number(p.amount), method: p.method, payment_method: p.method, status: "paid", created_by_uid: c.uid, createdAt: now, created_at: now, source: "mobile" }));
    });
    snaps.forEach((snap, i) => {
      const item = stockItems[i], old = Number(snap.data().stock || 0), qty = Number(item.qty || 0), ref = doc(recordsCol(c.businessId, "inventoryMovements"));
      tx.set(productRefs[i], { stock: old - qty, updatedAt: now, updated_at: now }, { merge: true });
      tx.set(ref, sanitize({ id: ref.id, shop_id: c.shopId, branchId: c.branchSlug, product_id: item.product_id, productId: item.product_id, product_code: item.product_code || snap.data().product_code || null, product_name: item.name, old_quantity: old, change_quantity: -qty, new_quantity: old - qty, previousQuantity: old, quantityDelta: -qty, type: "SERVICE_USAGE", reason: "Service usage", service_id: serviceRef.id, service_no: service.service_no || null, user_uid: c.uid, createdAt: now, created_at: now, source: "mobile" }));
    });
    return { id: serviceRef.id, ...service };
  });
}

/** Status / notes edit on an existing service (web: updateRecord(services, id, {status, technician_notes})). */
export async function updateServiceFields(serviceId: string, fields: Record<string, any>, shops: any[] = []): Promise<void> {
  const c = requireShop(dataContext(shops));
  const now = new Date().toISOString();
  const patch: Record<string, any> = {};
  for (const k of ["status", "technician_notes"]) if (k in fields) patch[k] = fields[k];
  await updateDoc(recordDoc(c.businessId, "services", serviceId), sanitize({ ...patch, updated_by_uid: c.uid, updatedAt: now, updated_at: now }));
}

// ------------------------------------------------------------------------------- branches
const omit = (obj: Record<string, any>, keys: string[]) => Object.fromEntries(Object.entries(obj || {}).filter(([k]) => !keys.includes(k)));
const canManage = () => { const a = useBusiness.getState().access; return !!a && (["OWNER", "ADMIN"].includes(a.role) || a.full_access === true); };

/** Create a branch (web createBranch): shop doc + owner's allowed lists + optional counter seeds. */
export async function createBranch(input: Record<string, any>, existing: any[]): Promise<{ shopId: string; slug: string }> {
  const b = useBusiness.getState();
  if (!canManage() || !b.businessId || !b.actorUid) throw new Error("You are not authorized to create branches.");
  const { nextShopId, slugify, validateBranchInput } = await import("../domain/branches.ts");
  const problem = validateBranchInput(input, existing);
  if (problem) throw new Error(problem);
  const shopId = nextShopId(existing);
  const slug = slugify(input.slug || input.name) || String(input.branch_code || shopId).toLowerCase();
  const now = new Date().toISOString();
  const record = sanitize({
    ...omit(input, ["start_invoice_no", "start_service_no", "start_return_no"]),
    id: shopId, shop_id: shopId, slug, status: input.status || "active", active: (input.status || "active") === "active", open_state: input.open_state || "open",
    initialized: true, schema_version: 1, created_at: now, updated_at: now, created_by_uid: b.actorUid,
  });
  try {
    await setDoc(recordDoc(b.businessId, "shops", shopId), record);
    await setDoc(doc(db(), "authorizedUsers", b.actorUid), { allowed_branches: arrayUnion(slug), allowed_shop_ids: arrayUnion(shopId), updated_at: now }, { merge: true });
  } catch (e: any) {
    if (e?.code === "firestore/permission-denied") throw new Error("Branch creation is blocked by the current Firestore rules for this account. Ask an OWNER / ADMIN.");
    throw e;
  }
  const year = new Date().getFullYear();
  const invoicePrefix = String(input.invoice_prefix || slug).slice(0, 6).toUpperCase();
  const invoiceCounterId = `invoice_${invoicePrefix}_${year}`;
  try {
    const priorBranches = existing.filter((branch) => String(branch.invoice_prefix || "").toUpperCase() === invoicePrefix && branch.id !== shopId);
    const priorCounters = await Promise.all(priorBranches.map((branch) => getDoc(recordDoc(b.businessId as string, "counters", `invoice_${branch.id}_${year}`))));
    const sharedCounter = await getDoc(recordDoc(b.businessId as string, "counters", invoiceCounterId));
    let value = Math.max(Number(sharedCounter.data()?.value || 0), Number(input.start_invoice_no || 1) - 1, ...priorCounters.map((snap: any) => Number(snap.data()?.value || 0)));
    await Promise.all(priorBranches.map(async (branch) => {
      const oldInvoices = await getDocs(query(recordsCol(b.businessId as string, "invoices"), where("shop_id", "==", branch.id)));
      const match = new RegExp(`^${invoicePrefix}-${year}-(\\d+)$`);
      oldInvoices.docs.forEach((invoice: any) => {
        const number = String(invoice.data().invoice_number || invoice.data().invoiceNumber || "").match(match);
        if (number) value = Math.max(value, Number(number[1]));
      });
    }));
    await setDoc(recordDoc(b.businessId, "counters", invoiceCounterId), sanitize({ id: invoiceCounterId, value, shop_id: shopId, updated_at: now }), { merge: true });
  } catch { /* best-effort migration from legacy per-branch counters */ }
  for (const [kind, start] of [["invoice", Number(input.start_invoice_no) || 1], ["service", Number(input.start_service_no) || 1], ["return", Number(input.start_return_no) || 1]] as [string, number][]) {
    if (start > 1 && kind !== "invoice") {
      const counterId = `${kind}_${shopId}_${year}`;
      try { await setDoc(recordDoc(b.businessId, "counters", counterId), sanitize({ id: counterId, value: start - 1, shop_id: shopId, updated_at: now }), { merge: true }); } catch { /* first record starts at 1 */ }
    }
  }
  return { shopId, slug };
}

/** Edit a branch. Identity (id / shop_id / slug) is immutable; a nickname never touches saved invoices. */
export async function updateBranch(shopId: string, patch: Record<string, any>): Promise<void> {
  const b = useBusiness.getState();
  if (!canManage() || !b.businessId) throw new Error("You are not authorized to edit branches.");
  const safe = omit(patch, ["id", "shop_id", "slug", "created_at", "created_by_uid", "schema_version"]);
  try {
    await setDoc(recordDoc(b.businessId, "shops", shopId), sanitize({ ...safe, updated_at: new Date().toISOString() }), { merge: true });
  } catch (e: any) {
    if (e?.code === "firestore/permission-denied") throw new Error("Editing branches is blocked by the current Firestore rules for this account. Ask an OWNER / ADMIN.");
    throw e;
  }
}
export const archiveBranch = (shopId: string) => updateBranch(shopId, { status: "archived", active: false });
export const restoreBranch = (shopId: string) => updateBranch(shopId, { status: "active", active: true });

const HISTORY = ["products", "customers", "invoices", "sales", "services", "expenses", "payments", "returns", "paylater", "attendance", "transfers", "history", "inventoryMovements"];
export async function inspectBranchDeletion(shopId: string): Promise<Record<string, number>> {
  const b = useBusiness.getState();
  const result: Record<string, number> = {};
  await Promise.all(HISTORY.map(async (name) => { result[name] = (await getDocs(query(recordsCol(b.businessId as string, name), where("shop_id", "==", shopId)))).size; }));
  return result;
}

/** Delete = tombstone (nothing historical is cascade-deleted); typed confirmation phrase required. */
export async function deleteBranch(branch: Record<string, any>, confirmation: string, currentShopId: string): Promise<{ counts: Record<string, number> }> {
  const b = useBusiness.getState();
  if (!canManage() || !b.businessId || !b.actorUid) throw new Error("You are not authorized to delete branches.");
  const { deleteConfirmationPhrase, isDeletedBranch } = await import("../domain/listTools.ts");
  if (isDeletedBranch(branch)) throw new Error("This branch is already deleted.");
  if (branch.id === currentShopId) throw new Error("Switch to another branch before deleting this one.");
  const expected = deleteConfirmationPhrase(branch);
  if (confirmation !== expected) throw new Error(`Type ${expected} exactly to delete this branch.`);
  const counts = await inspectBranchDeletion(branch.id);
  const now = new Date().toISOString();
  const auditRef = doc(recordsCol(b.businessId, "auditLogs"));
  await setDoc(auditRef, sanitize({ id: auditRef.id, action: "BRANCH_DELETE", mode: "tombstone", shop_id: branch.id, branch_name: branch.name || null, branch_display_name: branch.display_name || null, branch_code: branch.branch_code || null, history_counts: counts, deleted_by: b.actorUid, deleted_at: now, source: "mobile" }));
  await setDoc(recordDoc(b.businessId, "shops", branch.id), sanitize({
    status: "deleted", active: false, deleted: true, deleted_at: now, deleted_by_uid: b.actorUid,
    deleted_snapshot: { name: branch.name || null, display_name: branch.display_name || null, slug: branch.slug || null, branch_code: branch.branch_code || null, invoice_prefix: branch.invoice_prefix || null, history_counts: counts },
    updated_at: now,
  }), { merge: true });
  return { counts };
}

// ------------------------------------------------------------------------------- generic branch records
// Collections that are business-wide rather than branch-scoped (web SHARED set).
const SHARED = new Set(["shops", "settings", "productCategories", "notes", "counters", "auditLogs"]);

/** Live listener on a collection, branch-filtered by `shop_id` like the web useCollection/listen(). */
export function listenCollection(name: string, cb: (rows: any[]) => void, onError?: (e: any) => void, shops: any[] = []): () => void {
  const c = dataContext(shops);
  const col = recordsCol(c.businessId, name);
  const source = !SHARED.has(name) && c.shopId && c.shopId !== "all" ? query(col, where("shop_id", "==", c.shopId)) : col;
  return onSnapshot(source, (snap: any) => {
    const rows = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const ms = (v: any) => (typeof v === "number" ? v : v?.toMillis ? v.toMillis() : Date.parse(v || "") || 0);
    rows.sort((a: any, b: any) => ms(b.updatedAt ?? b.createdAt ?? b.created_at) - ms(a.updatedAt ?? a.createdAt ?? a.created_at));
    cb(rows);
  }, onError);
}

/** createRecord equivalent: branch `shop_id` + audit fields + id/created/updated stamps. */
export async function createShopRecord(name: string, data: Record<string, any>, shops: any[] = []): Promise<string> {
  const c = dataContext(shops);
  if (!SHARED.has(name)) requireShop(c);
  const ref = doc(recordsCol(c.businessId, name));
  const now = new Date().toISOString();
  await setDoc(ref, sanitize({ ...data, ...(!SHARED.has(name) ? { shop_id: c.shopId, branchId: c.branchSlug } : {}), created_by_uid: c.uid, updated_by_uid: c.uid, id: ref.id, createdAt: data.createdAt ?? now, created_at: data.created_at ?? now, updatedAt: now, updated_at: now, source: "mobile" }));
  return ref.id;
}
export async function updateShopRecord(name: string, id: string, data: Record<string, any>, shops: any[] = []): Promise<void> {
  const c = dataContext(shops);
  const now = new Date().toISOString();
  await setDoc(recordDoc(c.businessId, name, id), sanitize({ ...data, ...(!SHARED.has(name) ? { shop_id: c.shopId } : {}), updated_by_uid: c.uid, updatedAt: now, updated_at: now }), { merge: true });
}
export async function deleteShopRecord(name: string, id: string, shops: any[] = []): Promise<void> {
  const c = dataContext(shops);
  await deleteDoc(recordDoc(c.businessId, name, id));
}

/**
 * One attendance row per branch/user/day (web: `${shop}_${uid}_${date}`). Photo evidence is required unless an
 * OWNER/ADMIN records an authorised manual correction (which is audited in `history`).
 */
export async function submitAttendance(args: { date: string; staffName: string; evidence?: Record<string, any>; manual?: boolean; reason?: string }, shops: any[] = []) {
  const c = requireShop(dataContext(shops));
  const ref = recordDoc(c.businessId, "attendance", `${c.shopId}_${c.uid}_${args.date}`);
  if (args.manual && !["OWNER", "ADMIN"].includes(c.role)) throw new Error("Only owners and administrators can make manual corrections.");
  return runTransaction(db(), async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists() && !args.manual) throw new Error("Attendance is already submitted for this date.");
    const now = new Date().toISOString();
    tx.set(ref, sanitize({
      id: ref.id, shop_id: c.shopId, staff_id: c.uid, user_uid: c.uid, staffName: args.staffName, attendance_date: args.date, date: args.date, status: "Present",
      checkIn: new Date().toLocaleTimeString("en-IN"), ...(args.evidence || {}), manual_override: !!args.manual, override_reason: args.manual ? args.reason || "" : "",
      submitted_by_uid: c.uid, created_at: now, createdAt: now, source: "mobile",
    }));
    if (args.manual) {
      const audit = doc(recordsCol(c.businessId, "history"));
      tx.set(audit, sanitize({ id: audit.id, shop_id: c.shopId, action: "ATTENDANCE_CORRECTION", record_id: ref.id, reason: args.reason, created_by_uid: c.uid, role: c.role, created_at: now, before: snap.exists() ? snap.data() : null }));
    }
    return ref.id;
  });
}

// ------------------------------------------------------------------------------- Pay Later ledger
/**
 * Record a Pay Later PAYMENT or an owner-authorised ADJUSTMENT for a customer (web postCustomerLedger).
 * Payments are allocated oldest-due-first across the customer's `paylater` dues and the source invoice/service
 * balances; the customer's outstanding and a `paylaterLedger` entry are updated in the same transaction.
 */
export async function postCustomerLedger(customerId: string, input: { type: "PAYMENT" | "ADJUSTMENT_INCREASE" | "ADJUSTMENT_DECREASE"; amount: unknown; payment_method?: string; notes?: string; reference?: string; date?: string; operation_id?: string; user_name?: string }, shops: any[] = []): Promise<any> {
  const c = requireShop(dataContext(shops));
  const { ledgerBalance } = await import("../domain/payments.ts");
  if (!["PAYMENT", "ADJUSTMENT_INCREASE", "ADJUSTMENT_DECREASE"].includes(input.type)) throw new Error("Invalid action.");
  if (input.type !== "PAYMENT" && (!["OWNER", "ADMIN"].includes(c.role) || !String(input.notes || "").trim())) throw new Error("Owner/admin authorization and a reason are required for adjustments.");
  if (input.type === "PAYMENT" && !["Cash", "UPI", "Card"].includes(String(input.payment_method))) throw new Error("Select Cash, UPI or Card.");
  const customerRef = recordDoc(c.businessId, "customers", customerId);
  const entryRef = input.operation_id ? recordDoc(c.businessId, "paylaterLedger", input.operation_id) : doc(recordsCol(c.businessId, "paylaterLedger"));
  const dues = await getDocs(query(recordsCol(c.businessId, "paylater"), where("shop_id", "==", c.shopId), where("customer_id", "==", customerId)));
  return runTransaction(db(), async (tx) => {
    const [existing, snap, ...dueSnaps]: any[] = await Promise.all([tx.get(entryRef), tx.get(customerRef), ...dues.docs.map((d: any) => tx.get(d.ref))]);
    if (existing.exists()) return existing.data();
    if (!snap.exists() || snap.data().shop_id !== c.shopId) throw new Error("Customer is not in this branch.");
    const customer = snap.data();
    const change = ledgerBalance(customer.outstanding ?? customer.total_due ?? 0, input.type, input.amount);
    const now = new Date().toISOString();
    const allocations: { snap: any; amount: number }[] = [];
    let left = input.type === "PAYMENT" ? change.amount : 0;
    for (const d of dueSnaps) {
      if (!d.exists() || left <= 0) continue;
      const amount = Math.min(left, Number(d.data().remaining || 0));
      if (amount > 0) { allocations.push({ snap: d, amount }); left -= amount; }
    }
    const refs = allocations.map(({ snap: d }) => { const v = d.data(); return v.invoice_id ? recordDoc(c.businessId, "invoices", v.invoice_id) : v.service_id ? recordDoc(c.businessId, "services", v.service_id) : null; });
    const refSnaps: any[] = await Promise.all(refs.map((r) => (r ? tx.get(r) : Promise.resolve(null))));
    const entry = sanitize({
      id: entryRef.id, shop_id: c.shopId, customer_id: customerId, customer_name: customer.name, customer_phone: customer.phone || "",
      ...change, type: input.type, reference_type: "customer", reference_id: customerId, reference: input.reference || entryRef.id,
      payment_method: input.type === "PAYMENT" ? input.payment_method : null, notes: input.notes || "", effective_date: input.date || now.slice(0, 10),
      created_at: now, createdAt: now, created_by_uid: c.uid, created_by_name: input.user_name || c.uid, role: c.role, source: "mobile",
    });
    tx.set(entryRef, entry);
    tx.update(customerRef, { outstanding: change.balance_after, total_due: change.balance_after, total_paid: Number(customer.total_paid || 0) + (input.type === "PAYMENT" ? change.amount : 0), updated_at: now });
    allocations.forEach(({ snap: d, amount }, i) => {
      const v = d.data(), remaining = Number(v.remaining) - amount;
      tx.update(d.ref, { remaining, paid: Number(v.paid || 0) + amount, status: remaining ? "partial" : "paid", updated_at: now });
      const r = refSnaps[i];
      if (r?.exists()) {
        const value = r.data();
        const balance = Math.max(0, Number(value.balance ?? value.balance_due ?? 0) - amount);
        const paid = Number(value.paidAmount ?? value.advance ?? value.amount_paid ?? 0) + amount;
        tx.update(r.ref, { balance, balance_due: balance, outstanding_amount: balance, paidAmount: paid, amount_paid: paid, total_paid: paid, updated_at: now });
      }
    });
    if (input.type === "PAYMENT") tx.set(recordDoc(c.businessId, "payments", entryRef.id), sanitize({ ...entry, amount: change.amount, method: input.payment_method, source: "paylater_collection", ledger_id: entryRef.id }));
    return entry;
  });
}
