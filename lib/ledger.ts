// Khata: vasooli (payments), payment promises and reading a customer's ledger.
import type { DatabaseSync } from "node:sqlite";
import { inTransaction } from "./db.ts";
import { getAccount, type Customer } from "./customers.ts";
import { checkCreditLimit } from "./billing.ts";

export type Mode = "cash" | "upi";

export type PaymentDraft = {
  draftId: string;
  customerId: number;
  amount: number;
  mode?: Mode;
  allowAdvance?: boolean;
};

export type PaymentResult =
  | { status: "saved"; entryId: number; duplicate: boolean; amount: number; mode: Mode | null; newOutstanding: number }
  | { status: "needs_answer"; reason: "more_than_outstanding"; extra: number };

export type PromiseDraft = { draftId: string; customerId: number; amount: number; due: string; now?: Date };
export type PromiseResult = { status: "saved"; promiseId: number; duplicate: boolean; amount: number; dueDate: string };

type EntryRow = { id: number; amount_paise: number; mode: Mode | null; balance_after_paise: number };
type PromiseRow = { id: number; amount_paise: number; due_date: string };

// Money from voice must be a whole, positive number of paise.
function assertAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error(`bad amount: ${amount}`);
}

function paymentResult(row: EntryRow, duplicate: boolean): PaymentResult {
  return {
    status: "saved",
    entryId: row.id,
    duplicate,
    amount: -row.amount_paise,
    mode: row.mode,
    newOutstanding: row.balance_after_paise,
  };
}

// Vasooli: lowers what the customer owes. More than owed needs the trader's answer.
export function recordPayment(db: DatabaseSync, p: PaymentDraft): PaymentResult {
  assertAmount(p.amount);
  return inTransaction(db, () => {
    const existing = db.prepare("SELECT * FROM ledger_entries WHERE draft_id = ?").get(p.draftId) as EntryRow | undefined;
    if (existing) return paymentResult(existing, true);

    const account = getAccount(db, p.customerId);
    const extra = p.amount - Math.max(0, account.outstanding);
    if (extra > 0 && !p.allowAdvance) return { status: "needs_answer", reason: "more_than_outstanding", extra };

    const balance = account.outstanding - p.amount;
    const mode = p.mode ?? null;
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO ledger_entries (customer_id, draft_id, kind, mode, amount_paise, balance_after_paise)
         VALUES (?, ?, 'payment', ?, ?, ?)`,
      )
      .run(account.id, p.draftId, mode, -p.amount, balance);
    db.prepare("UPDATE customers SET outstanding_paise = ? WHERE id = ?").run(balance, account.id);
    return paymentResult({ id: Number(lastInsertRowid), amount_paise: -p.amount, mode, balance_after_paise: balance }, false);
  });
}

const DAY_OFFSET: Record<string, number> = { aaj: 0, today: 0, kal: 1, tomorrow: 1, parso: 2, parson: 2 };

// Today's date in India as YYYY-MM-DD, whatever time zone the server is in.
function indiaToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}

// Move a YYYY-MM-DD date by some days.
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Spoken day -> date. In a promise, "kal" always means tomorrow.
export function dueDate(when: string, now = new Date()): string {
  const word = when.trim().toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(word) && addDays(word, 0) === word) return word;
  const offset = DAY_OFFSET[word];
  if (offset === undefined) throw new Error(`unclear date: ${when}`);
  return addDays(indiaToday(now), offset);
}

function promiseResult(row: PromiseRow, duplicate: boolean): PromiseResult {
  return { status: "saved", promiseId: row.id, duplicate, amount: row.amount_paise, dueDate: row.due_date };
}

// "Kal 25 hazaar dega": saved as a promise. It never changes the outstanding.
export function recordPromise(db: DatabaseSync, p: PromiseDraft): PromiseResult {
  assertAmount(p.amount);
  const due = dueDate(p.due, p.now);
  return inTransaction(db, () => {
    const existing = db.prepare("SELECT * FROM promises WHERE draft_id = ?").get(p.draftId) as PromiseRow | undefined;
    if (existing) return promiseResult(existing, true);

    const account = getAccount(db, p.customerId);
    const { lastInsertRowid } = db
      .prepare("INSERT INTO promises (draft_id, customer_id, amount_paise, due_date) VALUES (?, ?, ?, ?)")
      .run(p.draftId, account.id, p.amount, due);
    return promiseResult({ id: Number(lastInsertRowid), amount_paise: p.amount, due_date: due }, false);
  });
}

export type KhataLine = {
  kind: "opening" | "bill" | "payment";
  mode: Mode | null;
  amount: number;
  balanceAfter: number;
  billId: number | null;
  createdAt: string;
};

export type Khata = {
  customer: Customer;
  outstanding: number;
  creditLimit: number;
  creditLeft: number;
  entries: KhataLine[];
  openPromises: { amount: number; dueDate: string }[];
};

// Everything needed to speak, show or print one customer's khata.
export function getKhata(db: DatabaseSync, customerId: number): Khata {
  const account = getAccount(db, customerId);
  const entries = db
    .prepare(
      `SELECT kind, mode, amount_paise AS amount, balance_after_paise AS balanceAfter,
              bill_id AS billId, created_at AS createdAt
       FROM ledger_entries WHERE customer_id = ? ORDER BY id`,
    )
    .all(customerId) as KhataLine[];
  const openPromises = db
    .prepare(
      `SELECT amount_paise AS amount, due_date AS dueDate
       FROM promises WHERE customer_id = ? AND status = 'open' ORDER BY due_date, id`,
    )
    .all(customerId) as Khata["openPromises"];
  return {
    customer: { id: account.id, name: account.name },
    outstanding: account.outstanding,
    creditLimit: account.creditLimit,
    creditLeft: checkCreditLimit(account.outstanding, 0, account.creditLimit).creditLeft,
    entries,
    openPromises,
  };
}
