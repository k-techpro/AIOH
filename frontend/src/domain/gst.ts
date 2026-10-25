// GSTIN structure + checksum validation — port of web lib/gst.js.
const CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export function validateGSTIN(input: unknown): { valid: boolean; reason?: string; gstin?: string } {
  const gstin = String(input || "").trim().toUpperCase();
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) return { valid: false, reason: "GSTIN must match the 15-character GST structure." };
  const stateCode = Number(gstin.slice(0, 2));
  if (stateCode < 1 || stateCode > 38) return { valid: false, reason: "Invalid GST state code." };
  let factor = 1, sum = 0;
  for (let i = 0; i < 14; i += 1) { const product = CHARS.indexOf(gstin[i]) * factor; factor = factor === 2 ? 1 : 2; sum += Math.floor(product / 36) + (product % 36); }
  const expected = CHARS[(36 - (sum % 36)) % 36];
  return expected === gstin[14] ? { valid: true, gstin } : { valid: false, reason: `Invalid checksum (expected ${expected}).` };
}
