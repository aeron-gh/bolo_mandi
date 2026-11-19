// Bill maths. Every amount here is whole paise. No floats, no LLM.
import type { DatabaseSync } from "node:sqlite";
import { inTransaction } from "./db.ts";
import { getAccount, type Account } from "./customers.ts";

export type Grade = 1 | 2 | 3;
export type Unit = "piece" | "crate";
export type RateCard = Record<Grade, number>;

export type ItemInput = { grade: Grade; qty: number; rate?: number; unit?: Unit };
export type BillLine = {
  grade: Grade;
  qty: number;
  unit: Unit;
  rate: number;
  rateOverride: boolean;
  amount: number;
};

export type Split =
  | { ok: true; cash: number; upi: number; udhaar: number }
  | { ok: false; extra: number };

export type CreditStatus = "ok" | "near" | "over";
export type CreditCheck = {
  status: CreditStatus;
  newOutstanding: number;
  creditLeft: number;
  overBy: number;
};

// Throw if a number is not a whole amount we can trust.
function assertWhole(value: number, label: string, min: number): void {
  if (!Number.isSafeInteger(value) || value < min) throw new Error(`bad ${label}: ${value}`);
}

// Price each line; a spoken rate beats the price list.
export function calculateBill(items: ItemInput[], rates: RateCard) {
  const lines: BillLine[] = items.map((item) => {
    assertWhole(item.qty, "qty", 1);
    const rateOverride = item.rate !== undefined;
    const rate = item.rate ?? rates[item.grade];
    assertWhole(rate, "rate", 1);
    const unit = item.unit ?? "piece";
    return { grade: item.grade, qty: item.qty, unit, rate, rateOverride, amount: rate * item.qty };
  });
  const total = lines.reduce((sum, line) => sum + line.amount, 0);
  return { lines, total };
}

// Cash and UPI are paid now; whatever is left is udhaar.
export function splitPayment(total: number, cash = 0, upi = 0): Split {
  assertWhole(cash, "cash", 0);
  assertWhole(upi, "upi", 0);
  const paid = cash + upi;
  if (paid > total) return { ok: false, extra: paid - total };
  return { ok: true, cash, upi, udhaar: total - paid };
}

// Near = above 90% of limit, over = above limit.
export function checkCreditLimit(outstanding: number, udhaar: number, limit: number): CreditCheck {
  const newOutstanding = outstanding + udhaar;
  const overBy = Math.max(0, newOutstanding - limit);
  const creditLeft = Math.max(0, limit - newOutstanding);
  let status: CreditStatus = "ok";
  if (newOutstanding > limit) status = "over";
  else if (newOutstanding * 10 > limit * 9) status = "near";
  return { status, newOutstanding, creditLeft, overBy };
}

// ---------- saving a bill ----------

export type Draft = {
  draftId: string;
  customerId: number;
  items: ItemInput[];
  cash?: number;
  upi?: number;
  allowOverLimit?: boolean;
};

export type SaveResult =
  | {
      status: "saved";
      billId: number;
      duplicate: boolean;
      total: number;
      cash: number;
      upi: number;
      udhaar: number;
      newOutstanding: number;
      overLimit: boolean;
    }
  | { status: "needs_answer"; reason: "overpaid"; extra: number }
  | { status: "needs_answer"; reason: "over_limit"; overBy: number; newOutstanding: number };

type BillRow = {
  id: number;
  total_paise: number;
  cash_paise: number;
  upi_paise: number;
  udhaar_paise: number;
  outstanding_after_paise: number;
  over_limit: number;
};
type Paid = { cash: number; upi: number; udhaar: number };

// Turn a stored bill row into a result for the caller.
function toResult(row: BillRow, duplicate: boolean): SaveResult {
  return {
    status: "saved",
    billId: row.id,
    duplicate,
    total: row.total_paise,
    cash: row.cash_paise,
    upi: row.upi_paise,
    udhaar: row.udhaar_paise,
    newOutstanding: row.outstanding_after_paise,
    overLimit: row.over_limit === 1,
  };
}

// Look up one stored bill by its id or draft_id.
function findBill(db: DatabaseSync, column: "id" | "draft_id", value: number | string) {
  return db.prepare(`SELECT * FROM bills WHERE ${column} = ?`).get(value) as BillRow | undefined;
}

// Write the bill and its lines; returns the new bill id.
function insertBill(db: DatabaseSync, draft: Draft, lines: BillLine[], paid: Paid, credit: CreditCheck): number {
  const total = paid.cash + paid.upi + paid.udhaar;
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO bills (draft_id, customer_id, total_paise, cash_paise, upi_paise,
         udhaar_paise, outstanding_after_paise, over_limit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(draft.draftId, draft.customerId, total, paid.cash, paid.upi, paid.udhaar,
      credit.newOutstanding, credit.status === "over" ? 1 : 0);
  const billId = Number(lastInsertRowid);
  const addLine = db.prepare(
    `INSERT INTO bill_items (bill_id, grade, qty, unit, rate_paise, rate_override, amount_paise)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const l of lines) addLine.run(billId, l.grade, l.qty, l.unit, l.rate, l.rateOverride ? 1 : 0, l.amount);
  return billId;
}

// Khata lines: goods given (+), then cash and UPI received (-).
function writeLedger(db: DatabaseSync, customer: Account, billId: number, paid: Paid): number {
  const add = db.prepare(
    `INSERT INTO ledger_entries (customer_id, bill_id, kind, mode, amount_paise, balance_after_paise)
     VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const total = paid.cash + paid.upi + paid.udhaar;
  let balance = customer.outstanding + total;
  add.run(customer.id, billId, "bill", null, total, balance);
  for (const mode of ["cash", "upi"] as const) {
    if (paid[mode] === 0) continue;
    balance -= paid[mode];
    add.run(customer.id, billId, "payment", mode, -paid[mode], balance);
  }
  db.prepare("UPDATE customers SET outstanding_paise = ? WHERE id = ?").run(balance, customer.id);
  return balance;
}

// Save a confirmed draft once. Same draft_id again returns the first bill.
export function saveBill(db: DatabaseSync, draft: Draft, rates: RateCard): SaveResult {
  if (draft.items.length === 0) throw new Error("no items in bill");
  return inTransaction(db, () => {
    const existing = findBill(db, "draft_id", draft.draftId);
    if (existing) return toResult(existing, true);

    const customer = getAccount(db, draft.customerId);
    const bill = calculateBill(draft.items, rates);
    const split = splitPayment(bill.total, draft.cash, draft.upi);
    if (!split.ok) return { status: "needs_answer", reason: "overpaid", extra: split.extra };

    const credit = checkCreditLimit(customer.outstanding, split.udhaar, customer.creditLimit);
    if (credit.status === "over" && !draft.allowOverLimit) {
      return { status: "needs_answer", reason: "over_limit", overBy: credit.overBy, newOutstanding: credit.newOutstanding };
    }

    const billId = insertBill(db, draft, bill.lines, split, credit);
    const balance = writeLedger(db, customer, billId, split);
    if (balance !== credit.newOutstanding) throw new Error("ledger does not match bill maths");
    return toResult(findBill(db, "id", billId)!, false);
  });
}
