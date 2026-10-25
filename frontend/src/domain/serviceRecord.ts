// Builds the canonical service record (ticket OR quick bill) — port of web Services.js buildJob().
// One record, written once; field names (snake_case + camelCase mirrors) match what the web reads.
import { accessoriesText } from "./serviceWizard.ts";

export interface ServiceItem { kind?: "inventory" | "custom" | "charge"; product_id?: string; product_code?: string; barcode?: string; category?: string; gst?: number; stock?: number; name: string; price: number; qty: number }
type Form = Record<string, any>;
const txt = (v: unknown) => String(v ?? "").trim();

export const SERVICE_STATUSES = ["Pending", "In Progress", "Waiting for Parts", "Ready", "Delivered", "Cancelled"];
export const isoDate = (v: unknown) => { const t = new Date(String(v || "")); return Number.isFinite(t.getTime()) ? t.toISOString() : new Date().toISOString(); };

export function itemsWithCharge(items: ServiceItem[], form: Form, wizard: boolean): ServiceItem[] {
  const amount = Number(form.service_charge);
  if (!wizard || !Number.isFinite(amount) || amount <= 0) return items;
  const label = form.service_type === "Custom" ? txt(form.custom_service_type) || "Service charge" : `${form.service_type || "Service"} charge`;
  return [...items, { kind: "charge", name: label, price: amount, qty: 1 }];
}
export const serviceTotal = (items: ServiceItem[]) => items.reduce((s, it) => s + (Number(it.price) || 0) * (Number(it.qty) || 1), 0);

export function buildServiceJob(args: { form: Form; mode: "ticket" | "quick"; items: ServiceItem[]; productName: string; now?: Date }) {
  const { form, mode, items } = args;
  const wizard = mode === "ticket";
  const all = itemsWithCharge(items, form, wizard);
  const total = Math.round(serviceTotal(all) * 100) / 100;
  const accessories = wizard ? accessoriesText(form.accessories_selected, form.accessories_custom) : [];
  const serviceName = form.service_type === "Custom" ? txt(form.custom_service_type) : form.service_type;
  return {
    service_no: form.service_no,
    service_mode: mode === "quick" ? "quick_bill" : "ticket",
    service_type: form.service_type, custom_service_type: form.service_type === "Custom" ? txt(form.custom_service_type) : null,
    serviceName, priority: form.priority,
    // A Quick Service Bill is already done: it must never appear as pending work.
    status: mode === "quick" ? "Delivered" : form.status,
    service_description: txt(form.service_description) || null,
    warranty_type: form.warranty_type,
    warranty_value: form.warranty_type === "Custom" ? txt(form.warranty_custom) : form.warranty_type,
    warranty_description: txt(form.warranty_description) || null,
    received_date: isoDate(form.received_date),
    estimated_date: form.has_estimate ? isoDate(form.estimated_date) : null,
    expectedDelivery: form.has_estimate ? isoDate(form.estimated_date) : null,
    customer_id: form.customer_id || null,
    customer_name: txt(form.customer_name), customerName: txt(form.customer_name),
    customer_phone: txt(form.customer_phone), customerPhone: txt(form.customer_phone),
    product_source: form.product_source === "shop" && form.shop_product_id ? "shop" : "external", shop_product_id: form.product_source === "shop" ? form.shop_product_id || null : null,
    product: args.productName,
    device_category: form.device_category === "Other / Custom" ? txt(form.custom_device_category) : txt(form.device_category),
    brand: txt(form.brand) || null,
    accessory: wizard ? accessories.join(", ") || null : txt(form.accessory) || null,
    ...(wizard ? {
      created_via: "service_wizard",
      received_by_name: txt(form.received_by_name),
      brand: txt(form.brand) || null, model: txt(form.model) || null,
      lock_type: form.lock_type || "None",
      // Technician-only: never listed / reported / printed.
      lock_secret: form.lock_type && form.lock_type !== "None" ? txt(form.lock_value) || null : null,
      customer_description: txt(form.customer_description) || null,
      device_condition: txt(form.device_condition) || null,
      accessories_received: accessories,
      customer_email: form.customer_email || null, customer_address: form.customer_address || null,
      customer_gstin: form.customer_gstin || null, customer_type: form.customer_type || null,
    } : {}),
    imei1: txt(form.imei1) || null, imei2: txt(form.imei2) || null,
    issue: txt(form.issue), complaint: txt(form.issue), technician_notes: txt(form.technician_notes) || null,
    items: all, total, price: total,
  };
}
