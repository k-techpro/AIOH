// Canonical phone identity — identical to the web app's lib/retailFinance.js, so a
// customer typed as 9876543210 / +91 9876543210 / 919876543210 / 98765 43210 /
// 98765-43210 resolves to the SAME customer on web and mobile.
export function normalizePhone(value: unknown): string {
  let p = String(value || "").replace(/\D/g, "");
  if (p.length === 14 && p.startsWith("0091")) p = p.slice(4);
  if (p.length === 12 && p.startsWith("91")) p = p.slice(2);
  if (p.length === 11 && p.startsWith("0")) p = p.slice(1);
  return p;
}
export const validPhone = (value: unknown): boolean => /^\d{10}$/.test(normalizePhone(value));

/** Stored phone variants a legacy record may carry (matches web lookupCustomer). */
export function phoneVariants(raw: unknown): string[] {
  const p = normalizePhone(raw);
  return [...new Set([String(raw ?? "").trim(), p, `+91${p}`, `91${p}`, `+91 ${p}`, `+91 ${p.slice(0, 5)} ${p.slice(5)}`, `${p.slice(0, 5)} ${p.slice(5)}`, `${p.slice(0, 5)}-${p.slice(5)}`])];
}

/** Deterministic customer document id: serialises concurrent creation per branch+phone. */
export const customerDocId = (shopId: string, phone: unknown): string => `${shopId}_phone_${normalizePhone(phone)}`;
