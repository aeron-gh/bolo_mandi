// SQLite setup using Node's built-in node:sqlite. Money columns are paise.
import { DatabaseSync } from "node:sqlite";
import seedJson from "../data/seed.json" with { type: "json" };
import { rs } from "./money.ts";
import { migrate } from "./migrations.ts";
import type { Grade, RateCard } from "./billing.ts";

export type Seed = {
  customers: { name: string; credit_limit: number; outstanding: number }[];
  products: { name: string; grade: number; rate: number }[];
};

// Version 0 of the tables: what the app made before migrations existed. lib/migrations.ts builds on it.
// STRICT tables refuse wrong types, so a float can never sit in a paise column.
export const BASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id                 INTEGER PRIMARY KEY,
  name               TEXT    NOT NULL UNIQUE,
  phone              TEXT,
  credit_limit_paise INTEGER NOT NULL CHECK (credit_limit_paise >= 0),
  outstanding_paise  INTEGER NOT NULL DEFAULT 0
) STRICT;

CREATE TABLE IF NOT EXISTS bills (
  id                      INTEGER PRIMARY KEY,
  draft_id                TEXT    NOT NULL UNIQUE,
  customer_id             INTEGER NOT NULL REFERENCES customers(id),
  total_paise             INTEGER NOT NULL,
  cash_paise              INTEGER NOT NULL DEFAULT 0,
  upi_paise               INTEGER NOT NULL DEFAULT 0,
  udhaar_paise            INTEGER NOT NULL,
  outstanding_after_paise INTEGER NOT NULL,
  over_limit              INTEGER NOT NULL DEFAULT 0,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE IF NOT EXISTS bill_items (
  id            INTEGER PRIMARY KEY,
  bill_id       INTEGER NOT NULL REFERENCES bills(id),
  grade         INTEGER NOT NULL CHECK (grade IN (1, 2, 3)),
  qty           INTEGER NOT NULL CHECK (qty > 0),
  unit          TEXT    NOT NULL DEFAULT 'piece',
  rate_paise    INTEGER NOT NULL,
  rate_override INTEGER NOT NULL DEFAULT 0,
  amount_paise  INTEGER NOT NULL
) STRICT;

CREATE TABLE IF NOT EXISTS ledger_entries (
  id                  INTEGER PRIMARY KEY,
  customer_id         INTEGER NOT NULL REFERENCES customers(id),
  bill_id             INTEGER REFERENCES bills(id),
  draft_id            TEXT    UNIQUE,
  kind                TEXT    NOT NULL CHECK (kind IN ('opening', 'bill', 'payment')),
  mode                TEXT    CHECK (mode IN ('cash', 'upi')),
  amount_paise        INTEGER NOT NULL,
  balance_after_paise INTEGER NOT NULL,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
) STRICT;

CREATE TABLE IF NOT EXISTS promises (
  id           INTEGER PRIMARY KEY,
  draft_id     TEXT    NOT NULL UNIQUE,
  customer_id  INTEGER NOT NULL REFERENCES customers(id),
  amount_paise INTEGER NOT NULL CHECK (amount_paise > 0),
  due_date     TEXT    NOT NULL,
  status       TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'kept', 'broken')),
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
) STRICT;
`;

// Open (or create) the database and bring its tables up to the latest version, keeping all data.
export function openDb(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(BASE_SCHEMA);
  migrate(db);
  return db;
}

// Run fn inside one transaction; any error undoes everything.
export function inTransaction<T>(db: DatabaseSync, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

// The data sheet, bundled at build time so no file path is read at run time.
export function readSeed(): Seed {
  return seedJson as Seed;
}

// Insert seed customers in paise, each with an opening ledger line.
export function loadSeed(db: DatabaseSync, seed: Seed): void {
  const addCustomer = db.prepare(
    "INSERT INTO customers (name, credit_limit_paise, outstanding_paise) VALUES (?, ?, ?)",
  );
  const addOpening = db.prepare(
    "INSERT INTO ledger_entries (customer_id, kind, amount_paise, balance_after_paise) VALUES (?, 'opening', ?, ?)",
  );
  inTransaction(db, () => {
    for (const c of seed.customers) {
      const outstanding = rs(c.outstanding);
      const { lastInsertRowid } = addCustomer.run(c.name, rs(c.credit_limit), outstanding);
      addOpening.run(lastInsertRowid, outstanding, outstanding);
    }
  });
}

// Build the grade -> paise price list from the seed.
export function ratesFromSeed(seed: Seed): RateCard {
  const rate = (grade: Grade) => {
    const product = seed.products.find((p) => p.grade === grade);
    if (!product) throw new Error(`no rate for grade ${grade}`);
    return rs(product.rate);
  };
  return { 1: rate(1), 2: rate(2), 3: rate(3) };
}
