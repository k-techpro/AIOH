// Branch registry rules — port of the web app's AuthContext branch helpers (pure).
import { validateGSTIN } from "./gst.ts";
import { isDeletedBranch } from "./listTools.ts";

type Branch = Record<string, any>;
const LEGACY_SLUG_BY_ID: Record<string, string> = { "shop-1": "poonamallee", "shop-2": "kundrathur" };
/** Branches retired from the product: never selectable. */
export const RETIRED_BRANCHES = new Set(["testbench", "shop-test"]);

export const slugOf = (shop: Branch | null | undefined) => shop?.slug || LEGACY_SLUG_BY_ID[shop?.id] || shop?.id || null;
export function slugify(name: unknown): string {
  return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

/** Next sequential shop id (shop-N), never reusing an existing number. */
export function nextShopId(branches: Branch[]): string {
  const max = branches.reduce((m, b) => {
    const n = /^shop-(\d+)$/.exec(String(b.id || ""));
    return n ? Math.max(m, Number(n[1])) : m;
  }, 0);
  return `shop-${max + 1}`;
}

export function branchExists(branches: Branch[], q: { slug?: string; code?: string; prefix?: string }): boolean {
  return branches.some((b) => !isDeletedBranch(b) && (b.status || "active") === "active" && b.active !== false && (
    (q.slug && slugOf(b) === q.slug) ||
    (q.code && String(b.branch_code || "").toUpperCase() === String(q.code).toUpperCase()) ||
    (q.prefix && String(b.invoice_prefix || "").toUpperCase() === String(q.prefix).toUpperCase())));
}

/** Active, non-deleted, non-retired branches — the only ones that appear in selectors. */
export function activeBranches(branches: Branch[]): Branch[] {
  return branches
    .filter((b) => !isDeletedBranch(b))
    .filter((b) => (b.status || "active") === "active" && b.active !== false)
    .filter((b) => !RETIRED_BRANCHES.has(slugOf(b) || "") && !RETIRED_BRANCHES.has(b.id))
    .map((b): Branch => ({ ...b, slug: slugOf(b) }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

export function validateBranchInput(input: Branch, existing: Branch[], opts: { editingId?: string } = {}): string | null {
  const others = existing.filter((b) => b.id !== opts.editingId);
  if (!String(input.name || "").trim()) return "Branch name is required";
  if (!opts.editingId) {
    if (branchExists(others, { slug: slugify(input.slug || input.name) })) return "A branch with a similar name already exists.";
    if (input.branch_code && branchExists(others, { code: input.branch_code })) return `Branch code ${input.branch_code} is already in use.`;
    if (input.invoice_prefix && branchExists(others, { prefix: input.invoice_prefix })) return `Invoice prefix ${input.invoice_prefix} is already in use.`;
  }
  if (input.gst_registered && !validateGSTIN(input.gstin).valid) return "Enter a valid GSTIN for a GST-registered branch.";
  if (input.msme_registered && !String(input.udyam_number || "").trim()) return "Enter the MSME / Udyam Registration Number.";
  if (!opts.editingId && (!/^\d{6}$/.test(String(input.pincode || "")) || !String(input.state || "").trim() || !String(input.district || "").trim() || !String(input.area || "").trim())) return "Enter the 6-digit PIN, state, district, and area / post office.";
  return null;
}
