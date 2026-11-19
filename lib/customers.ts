// Customer search. Never guess: one match is found, more than one means ask.
import type { DatabaseSync } from "node:sqlite";
import { inTransaction } from "./db.ts";
import { cleanPhone } from "./shop.ts";

export type Customer = { id: number; name: string };

export type CustomerMatch =
  | { kind: "found"; customer: Customer; fuzzy: boolean }
  | { kind: "ambiguous"; options: Customer[] }
  | { kind: "not_found"; query: string }
  | { kind: "unclear" };

// Spoken words that are never part of a name.
const FILLER = new Set([
  "bhai", "bhaiya", "ji", "seth", "sethji", "sahab", "saab", "sahib", "shri",
  "wala", "wale", "wali", "ko", "ka", "ke", "ki", "ne", "se",
]);

// Fold common Hindi spelling differences into one form. Order matters.
const SOUND_RULES: [RegExp, string][] = [
  [/ph/g, "f"],
  [/([kgtdbj])h/g, "$1"], // kh -> k, bh -> b, ...
  [/sh/g, "s"],
  [/z/g, "j"],
  [/w/g, "v"],
  [/q/g, "k"],
  [/ee/g, "i"],
  [/oo/g, "u"],
  [/(.)\1+/g, "$1"], // nn -> n, aa -> a
];

// Lowercase, keep English letters only, drop filler words.
export function cleanName(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER.has(word))
    .join(" ");
}

// How a name sounds, so Afjal and Afzal look the same.
export function soundKey(text: string): string {
  return SOUND_RULES.reduce((s, [rule, to]) => s.replace(rule, to), cleanName(text));
}

// Number of single-letter changes to turn a into b (Levenshtein).
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const swap = prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      cur.push(Math.min(prev[j] + 1, cur[j - 1] + 1, swap));
    }
    prev = cur;
  }
  return prev[b.length];
}

// Two words sound the same, or differ by one letter if long enough.
function closeSound(a: string, b: string): boolean {
  const [x, y] = [soundKey(a), soundKey(b)];
  return x === y || (Math.min(x.length, y.length) >= 4 && editDistance(x, y) <= 1);
}

// Every spoken word must match some word of the name.
function everyWord(query: string, name: string, same: (a: string, b: string) => boolean): boolean {
  const nameWords = cleanName(name).split(" ");
  return query.split(" ").every((q) => nameWords.some((n) => same(q, n)));
}

// One hit is found; several hits must be asked about.
function pick(list: Customer[], fuzzy: boolean): CustomerMatch {
  return list.length === 1
    ? { kind: "found", customer: list[0], fuzzy }
    : { kind: "ambiguous", options: list };
}

// Search: exact name, then all words, then sound-alike. First step with hits wins.
export function findCustomer(text: string, customers: Customer[]): CustomerMatch {
  const query = cleanName(text);
  if (!query) return { kind: "unclear" };

  const exact = customers.filter((c) => cleanName(c.name) === query);
  if (exact.length > 0) return pick(exact, false);

  const byWords = customers.filter((c) => everyWord(query, c.name, (a, b) => a === b));
  if (byWords.length > 0) return pick(byWords, false);

  const bySound = customers.filter((c) => everyWord(query, c.name, closeSound));
  if (bySound.length > 0) return pick(bySound, true);

  return { kind: "not_found", query };
}

// All customers, oldest first.
export function loadCustomers(db: DatabaseSync): Customer[] {
  return db.prepare("SELECT id, name FROM customers ORDER BY id").all() as Customer[];
}

export type Account = Customer & { outstanding: number; creditLimit: number };

// One customer's money position. Unknown id throws, so nothing is saved for them.
export function getAccount(db: DatabaseSync, id: number): Account {
  const account = db
    .prepare(
      "SELECT id, name, outstanding_paise AS outstanding, credit_limit_paise AS creditLimit FROM customers WHERE id = ?",
    )
    .get(id) as Account | undefined;
  if (!account) throw new Error(`unknown customer: ${id}`);
  return account;
}

// "ramesh  kumar" -> "Ramesh Kumar"
function displayName(text: string): string {
  return text.trim().split(/\s+/).map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

// Add a customer only after the trader says yes. New customers start at ₹0 limit.
export function addCustomer(db: DatabaseSync, text: string, creditLimit = 0): Customer {
  if (!cleanName(text)) throw new Error("empty name");
  const name = displayName(text);
  return inTransaction(db, () => {
    const key = cleanName(name);
    if (loadCustomers(db).some((c) => cleanName(c.name) === key)) {
      throw new Error(`customer already exists: ${name}`);
    }
    const { lastInsertRowid } = db
      .prepare("INSERT INTO customers (name, credit_limit_paise, outstanding_paise) VALUES (?, ?, 0)")
      .run(name, creditLimit);
    const id = Number(lastInsertRowid);
    db.prepare(
      "INSERT INTO ledger_entries (customer_id, kind, amount_paise, balance_after_paise) VALUES (?, 'opening', 0, 0)",
    ).run(id);
    return { id, name };
  });
}

const MAX_LIMIT = 1_000_000_000; // ₹1 crore in paise

// A credit limit is whole rupees, from ₹0 to ₹1 crore.
export function checkLimit(paise: number): number {
  if (!Number.isSafeInteger(paise) || paise < 0 || paise > MAX_LIMIT || paise % 100 !== 0) {
    throw new Error("Credit limit must be whole rupees, from ₹0 to ₹1 crore");
  }
  return paise;
}

export type CustomerEdit = { name?: string; phone?: string; creditLimit?: number };

// Fix a name, phone or limit. Two customers can never share a name, so search stays unambiguous.
export function updateCustomer(db: DatabaseSync, id: number, edit: CustomerEdit): Account {
  return inTransaction(db, () => {
    const current = getAccount(db, id);
    const name = edit.name === undefined ? current.name : edit.name.trim().replace(/\s+/g, " ");
    if (!cleanName(name)) throw new Error("Please enter a name");
    if (name.length > 60) throw new Error("Name is too long (60 characters max)");
    const key = cleanName(name);
    if (loadCustomers(db).some((c) => c.id !== id && cleanName(c.name) === key)) {
      throw new Error("A customer with this name already exists");
    }
    const limit = edit.creditLimit === undefined ? current.creditLimit : checkLimit(edit.creditLimit);
    db.prepare("UPDATE customers SET name = ?, credit_limit_paise = ? WHERE id = ?").run(name, limit, id);
    if (edit.phone !== undefined) {
      db.prepare("UPDATE customers SET phone = ? WHERE id = ?").run(cleanPhone(edit.phone) || null, id);
    }
    return getAccount(db, id);
  });
}
