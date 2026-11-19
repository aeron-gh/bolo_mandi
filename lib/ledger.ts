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
  id: number;
  kind: "opening" | "bill" | "payment" | "adjustment";
  mode: Mode | null;
  note: string | null;
  amount: number;
  balanceAfter: number;
  billId: number | null;
  createdAt: string;
};

export type OpenPromise = { id: number; amount: number; dueDate: string; overdue: boolean };

export type Khata = {
  customer: Customer;
  phone: string;
  outstanding: number;
  creditLimit: number;
  creditLeft: number;
  entries: KhataLine[];
  openPromises: OpenPromise[];
};

// Everything needed to speak, show or print one customer's khata.
// A promise is overdue once its date has passed in India.
export function getKhata(db: DatabaseSync, customerId: number, now = new Date()): Khata {
  const account = getAccount(db, customerId);
  const { phone } = db.prepare("SELECT COALESCE(phone, '') AS phone FROM customers WHERE id = ?").get(customerId) as { phone: string };
  const entries = db
    .prepare(
      `SELECT id, kind, mode, note, amount_paise AS amount, balance_after_paise AS balanceAfter,
              bill_id AS billId, created_at AS createdAt
       FROM ledger_entries WHERE customer_id = ? ORDER BY id`,
    )
    .all(customerId) as KhataLine[];
  const today = indiaToday(now);
  const openPromises = (db
    .prepare(
      `SELECT id, amount_paise AS amount, due_date AS dueDate
       FROM promises WHERE customer_id = ? AND status = 'open' ORDER BY due_date, id`,
    )
    .all(customerId) as Omit<OpenPromise, "overdue">[])
    .map((p) => ({ ...p, overdue: p.dueDate < today }));
  return {
    customer: { id: account.id, name: account.name },
    phone,
    outstanding: account.outstanding,
    creditLimit: account.creditLimit,
    creditLeft: checkCreditLimit(account.outstanding, 0, account.creditLimit).creditLeft,
    entries,
    openPromises,
  };
}

export type AdjustmentDraft = { draftId: string; customerId: number; amount: number; note: string };
export type AdjustmentResult = { entryId: number; duplicate: boolean; amount: number; note: string; newOutstanding: number };

type AdjustmentRow = { id: number; kind: string; amount_paise: number; note: string | null; balance_after_paise: number };

// Fix a mistake with a new line that says why. Past lines are never edited or deleted.
// Plus means the customer owes more; minus means less.
export function recordAdjustment(db: DatabaseSync, a: AdjustmentDraft): AdjustmentResult {
  if (!Number.isSafeInteger(a.amount) || a.amount === 0) throw new Error(`bad amount: ${a.amount}`);
  const note = a.note.trim().replace(/\s+/g, " ");
  if (!note) throw new Error("note chahiye: kyun badla?");
  if (note.length > 120) throw new Error("note bahut lamba hai (120 akshar tak)");
  return inTransaction(db, () => {
    const existing = db.prepare("SELECT id, kind, amount_paise, note, balance_after_paise FROM ledger_entries WHERE draft_id = ?")
      .get(a.draftId) as AdjustmentRow | undefined;
    if (existing) {
      if (existing.kind !== "adjustment") throw new Error("draft id already used");
      return { entryId: existing.id, duplicate: true, amount: existing.amount_paise, note: existing.note ?? "", newOutstanding: existing.balance_after_paise };
    }
    const account = getAccount(db, a.customerId);
    const balance = account.outstanding + a.amount;
    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO ledger_entries (customer_id, draft_id, kind, note, amount_paise, balance_after_paise)
         VALUES (?, ?, 'adjustment', ?, ?, ?)`,
      )
      .run(account.id, a.draftId, note, a.amount, balance);
    db.prepare("UPDATE customers SET outstanding_paise = ? WHERE id = ?").run(balance, account.id);
    return { entryId: Number(lastInsertRowid), duplicate: false, amount: a.amount, note, newOutstanding: balance };
  });
}

export type PromiseStatus = "kept" | "broken";

// A promise is marked once: kept or broken. It never changes the outstanding.
export function setPromiseStatus(db: DatabaseSync, promiseId: number, status: PromiseStatus): { id: number; status: PromiseStatus } {
  const row = db.prepare("SELECT status FROM promises WHERE id = ?").get(promiseId) as { status: string } | undefined;
  if (!row) throw new Error(`unknown promise: ${promiseId}`);
  if (row.status !== "open") throw new Error("sirf open vaada badla ja sakta hai");
  db.prepare("UPDATE promises SET status = ? WHERE id = ? AND status = 'open'").run(status, promiseId);
  return { id: promiseId, status };
}
