// Create Service Ticket — step logic. Port of the web app's lib/serviceWizard.js (pure).
import { normalizePhone, validPhone } from "./phone.ts";
import { isValidIMEI } from "./productCodes.ts";

export const WIZARD_STEPS = [
  { id: "customer", label: "Customer Details", short: "Customer" },
  { id: "product", label: "Product & Security", short: "Product" },
  { id: "problem", label: "Problem Details", short: "Problem" },
  { id: "service", label: "Service Details", short: "Service" },
  { id: "review", label: "Accessories / Review", short: "Review" },
] as const;
export type StepId = (typeof WIZARD_STEPS)[number]["id"];

export const LOCK_TYPES = ["None", "PIN", "Pattern", "Password", "Other"];
export const ACCESSORY_PRESETS = ["Charger", "Cable", "Adapter", "Case", "SIM", "Memory Card", "Battery"];
export const PRIORITIES = ["Low", "Medium", "High", "Urgent"];
export const SERVICE_TYPES = ["Repair", "Maintenance", "Diagnosis", "Software / OS", "Battery Replacement", "Screen Replacement", "Water Damage", "Warranty", "Custom"];
export const WARRANTY_OPTIONS = ["No warranty", "7 days", "30 days", "3 months", "6 months", "1 year", "Custom"];

const txt = (v: unknown) => String(v ?? "").trim();
type Form = Record<string, any>;

/** A 15-digit number is an IMEI and must pass Luhn; anything else is accepted as a serial. */
export function serialProblem(value: unknown): string | null {
  const v = txt(value);
  if (!v) return null;
  if (/^\d{15}$/.test(v) && !isValidIMEI(v)) return "That IMEI is not valid — check the number.";
  return null;
}

export interface StepContext { form?: Form; customer?: { id?: string } | null; customerPending?: boolean }

export function validateServiceStep(stepId: StepId, ctx: StepContext): { ok: boolean; errors: Record<string, string> } {
  const { form = {}, customer = null, customerPending = false } = ctx || {};
  const errors: Record<string, string> = {};
  if (stepId === "customer") {
    if (!validPhone(form.customer_phone)) errors.customer_phone = "Enter the customer's 10-digit phone number.";
    else if (customerPending || !customer) errors.customer_phone = "Finish the customer lookup (or add the new customer) to continue.";
    if (!errors.customer_phone && !txt(form.customer_name)) errors.customer_name = "Customer name is required.";
    if (!txt(form.received_by_name)) errors.received_by_name = "Enter the staff member who received this device.";
  }
  if (stepId === "product") {
    if (!txt(form.device_category)) errors.device_category = "Choose a device category.";
    if (form.device_category === "Other / Custom" && !txt(form.custom_device_category)) errors.custom_device_category = "Enter the custom category.";
    if (!txt(form.product)) errors.product = "Enter the device / product name.";
    const p1 = serialProblem(form.imei1); if (p1) errors.imei1 = p1;
    const p2 = serialProblem(form.imei2); if (p2) errors.imei2 = p2;
    if (!LOCK_TYPES.includes(form.lock_type || "None")) errors.lock_type = "Choose a lock type.";
  }
  if (stepId === "problem") {
    if (!txt(form.issue)) errors.issue = "Describe the problem / complaint.";
  }
  if (stepId === "service") {
    if (form.service_type === "Custom" && !txt(form.custom_service_type)) errors.custom_service_type = "Enter the custom service type.";
    if (form.warranty_type === "Custom" && !txt(form.warranty_custom)) errors.warranty_custom = "Enter the custom warranty.";
    const charge = Number(form.service_charge);
    if (form.service_charge !== "" && form.service_charge != null && (!Number.isFinite(charge) || charge < 0)) errors.service_charge = "Service charge cannot be negative.";
    if (form.has_estimate && !txt(form.estimated_date)) errors.estimated_date = "Pick the expected delivery date.";
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function accessoriesText(selected: string[] = [], custom = ""): string[] {
  const list = [...(selected || [])];
  txt(custom).split(/[,\n]/).map(txt).filter(Boolean).forEach((c) => { if (!list.some((x) => x.toLowerCase() === c.toLowerCase())) list.push(c); });
  return list;
}

export const lockSummary = (form: Form) => (!form.lock_type || form.lock_type === "None" ? "None" : form.lock_type);

/** Review rows. The lock secret itself is never echoed — only that one was provided. */
export function buildReview({ form, items = [], total = 0, branchName = "" }: { form: Form; items?: { name: string; qty: number }[]; total?: number; branchName?: string }) {
  const acc = accessoriesText(form.accessories_selected, form.accessories_custom);
  const serviceType = form.service_type === "Custom" ? txt(form.custom_service_type) || "Custom" : form.service_type;
  const warranty = !form.warranty_type || form.warranty_type === "No warranty" ? "No warranty" : (form.warranty_type === "Custom" ? txt(form.warranty_custom) : form.warranty_type);
  return ([
    ["Customer", txt(form.customer_name)],
    ["Phone", normalizePhone(form.customer_phone) || txt(form.customer_phone)],
    ["Staff Name", txt(form.received_by_name)],
    ["Category", form.device_category === "Other / Custom" ? txt(form.custom_device_category) : txt(form.device_category)],
    ["Device", txt(form.product)],
    ["Brand", txt(form.brand) || "—"],
    ["Model", txt(form.model) || "—"],
    ["IMEI / Serial", txt(form.imei1) || "—"],
    ["Device lock", lockSummary(form) + (form.lock_type && form.lock_type !== "None" && txt(form.lock_value) ? " (provided)" : "")],
    ["Problem", txt(form.issue)],
    ["Service Type", serviceType],
    ["Parts / Items", items.length ? items.map((i) => `${i.name} × ${i.qty}`).join(", ") : "—"],
    ["Accessories", acc.length ? acc.join(", ") : "None"],
    ["Warranty", warranty],
    ["Charges", `₹${(Math.round(Number(total) * 100) / 100).toLocaleString("en-IN")}`],
    ["Branch", branchName || "—"],
  ] as [string, string][]).map(([label, value]) => ({ label, value }));
}

/** Service number — same format as the web app: PREFIX-YYYYMMDD-NNNN. */
export function genServiceNo(prefix: unknown, now = new Date(), rand = Math.floor(Math.random() * 9000) + 1000): string {
  const p = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const pfx = String(prefix || "BR").toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 12) || "BR";
  return `${pfx}-${p}-${rand}`;
}
