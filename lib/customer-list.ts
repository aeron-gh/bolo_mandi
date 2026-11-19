// The customers page: search, sort and the "near the limit" filter.
// Separate from customers.ts because it needs billing.ts, which already imports customers.ts.
import type { DatabaseSync } from "node:sqlite";
import { checkCreditLimit, type CreditStatus } from "./billing.ts";

export type CustomerRow = { id: number; name: string; phone: string; outstanding: number; creditLimit: number; credit: CreditStatus };
export type ListOptions = { q?: string; sort?: "credit" | "name"; filter?: "all" | "credit" | "limit" };

// Part of a name in any case, or 3+ digits of a phone number.
function matches(row: CustomerRow, q: string): boolean {
  const text = q.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");
  return row.name.toLowerCase().includes(text) || (digits.length >= 3 && row.phone.includes(digits));
}

export function listCustomers(db: DatabaseSync, options: ListOptions): CustomerRow[] {
  const rows = (db
    .prepare("SELECT id, name, COALESCE(phone, '') AS phone, outstanding_paise AS outstanding, credit_limit_paise AS creditLimit FROM customers")
    .all() as Omit<CustomerRow, "credit">[])
    .map((row) => ({ ...row, credit: checkCreditLimit(row.outstanding, 0, row.creditLimit).status }));
  const q = options.q?.trim() ?? "";
  const shown = rows.filter((row) =>
    (!q || matches(row, q)) &&
    (options.filter !== "credit" || row.outstanding > 0) &&
    (options.filter !== "limit" || row.credit !== "ok"));
  const byName = (a: CustomerRow, b: CustomerRow) => a.name.localeCompare(b.name, "en");
  return shown.sort(options.sort === "name" ? byName : (a, b) => b.outstanding - a.outstanding || byName(a, b));
}
