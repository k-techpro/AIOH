// Product category registry helpers — port of web lib/categories.js.
export const BASE_CATEGORIES = ["Smartphones", "Mobile Accessories", "Laptops", "Tablets", "Audio", "Wearables", "Chargers & Cables", "Power Banks", "Covers & Cases", "Screen Guards", "Home Appliances"];
export const CUSTOM_CATEGORY_SENTINEL = "Custom";
export const normalizeCategoryName = (name: unknown) => String(name || "").trim().replace(/\s+/g, " ").toLowerCase();

type Cat = { name?: string; normalized_name?: string; active?: boolean };
export function buildCategoryOptions(registry: Cat[] = [], extra?: string | null): string[] {
  const seen = new Map<string, string>();
  BASE_CATEGORIES.forEach((n) => seen.set(normalizeCategoryName(n), n));
  registry.filter((c) => c && c.active !== false && c.name).forEach((c) => {
    const key = c.normalized_name || normalizeCategoryName(c.name);
    if (!seen.has(key)) seen.set(key, c.name as string);
  });
  if (extra && extra.trim() && normalizeCategoryName(extra) !== normalizeCategoryName(CUSTOM_CATEGORY_SENTINEL)) {
    const key = normalizeCategoryName(extra);
    if (!seen.has(key)) seen.set(key, extra);
  }
  return [...seen.values()];
}
export function resolveCategoryName(typed: string, registry: Cat[] = []): { name: string; existing: boolean } {
  const key = normalizeCategoryName(typed);
  const base = BASE_CATEGORIES.find((n) => normalizeCategoryName(n) === key);
  if (base) return { name: base, existing: true };
  const hit = registry.find((c) => (c.normalized_name || normalizeCategoryName(c.name)) === key && c.active !== false);
  if (hit) return { name: hit.name as string, existing: true };
  return { name: String(typed || "").trim(), existing: false };
}
