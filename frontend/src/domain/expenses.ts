// Expense payment-method classification + aggregation — port of the web app's lib/expenses.js + the Expenses
// page's payload, so an expense entered on mobile reads identically in web reports.
export const EXPENSE_PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Other"];
export const EXPENSE_TYPES = [
  "Rent", "Salary", "Utilities", "Electricity", "Purchase / Stock", "Marketing",
  "Maintenance", "Transport", "Office Supplies", "Taxes & Fees", "Bank Charges", "General", "Other",
];

export function methodBucket(raw: unknown): "cash" | "upi" | "card" | "bank" | "other" {
  const m = String(raw || "").toLowerCase().trim();
  if (!m) return "other";
  if (m.includes("cash")) return "cash";
  if (m.includes("upi") || m.includes("gpay") || m.includes("google pay") || m.includes("phonepe") || m.includes("paytm")) return "upi";
  if (m.includes("card") || m.includes("credit") || m.includes("debit")) return "card";
  if (m.includes("bank") || m.includes("neft") || m.includes("rtgs") || m.includes("imps") || m.includes("transfer") || m.includes("cheque") || m.includes("check")) return "bank";
  return "other";
}

type R = Record<string, any>;
export function summarizeExpenses(list: R[]) {
  const totals = { cash: 0, upi: 0, card: 0, bank: 0, grand: 0, count: list.length };
  const byType: Record<string, number> = {};
  for (const e of list) {
    const amount = Number(e.amount) || 0;
    const b = methodBucket(e.payment_method || e.method);
    if (b === "cash") totals.cash += amount; else if (b === "upi") totals.upi += amount; else if (b === "card") totals.card += amount; else totals.bank += amount;
    totals.grand += amount;
    const t = e.expense_type || e.category || "Other";
    byType[t] = (byType[t] || 0) + amount;
  }
  return { totals, byType };
}

const tsToMs = (v: any): number => (typeof v === "number" ? v : v?.toMillis ? v.toMillis() : Date.parse(v || "") || 0);
export function recordDateMs(row: R): number {
  for (const f of ["date", "createdAt", "created_at"]) { const ms = tsToMs(row[f]); if (ms) return ms; }
  return 0;
}

export interface ExpenseForm { date: string; expense_type: string; custom_expense_type: string; description: string; amount: string; payment_method: string; paidTo: string; remarks: string }
export const blankExpenseForm = (): ExpenseForm => ({ date: new Date().toISOString().slice(0, 10), expense_type: "General", custom_expense_type: "", description: "", amount: "", payment_method: "Cash", paidTo: "", remarks: "" });

export function validateExpense(f: ExpenseForm): string | null {
  if (!f.description.trim()) return "Enter a description";
  if (f.expense_type === "Other" && !f.custom_expense_type.trim()) return "Enter the custom expense type";
  const amount = Number(f.amount);
  if (!Number.isFinite(amount) || amount <= 0) return "Enter a valid amount";
  return null;
}

/** Canonical web payload (legacy mirrors `category` / `method` / `note` / `paid_to` kept populated). */
export function buildExpensePayload(f: ExpenseForm, enteredBy: string | null) {
  const amount = Number(f.amount);
  const day = new Date(f.date || Date.now());
  return {
    date: (Number.isFinite(day.getTime()) ? day : new Date()).toISOString(),
    expense_type: f.expense_type, custom_expense_type: f.expense_type === "Other" ? f.custom_expense_type.trim() : null,
    category: f.expense_type, title: f.description.trim().slice(0, 80), description: f.description.trim(), amount,
    payment_method: f.payment_method, method: f.payment_method,
    paidTo: f.paidTo.trim() || null, paid_to: f.paidTo.trim() || null, remarks: f.remarks.trim() || null, note: f.remarks.trim() || null,
    entered_by: enteredBy,
  };
}
