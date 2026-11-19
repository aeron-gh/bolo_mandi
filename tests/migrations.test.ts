import { describe, it, expect } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { BASE_SCHEMA, openDb, readSeed, loadSeed, ratesFromSeed } from "../lib/db.ts";
import { migrate, SCHEMA_VERSION } from "../lib/migrations.ts";
import { saveBill } from "../lib/billing.ts";
import { recordPayment } from "../lib/ledger.ts";
import { rs } from "../lib/money.ts";

function version(db: DatabaseSync): number {
  return (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
}

// Everything a shop would cry about losing.
function snapshot(db: DatabaseSync) {
  return {
    customers: db.prepare("SELECT id, name, credit_limit_paise, outstanding_paise FROM customers ORDER BY id").all(),
    bills: db.prepare("SELECT * FROM bills ORDER BY id").all(),
    items: db.prepare("SELECT * FROM bill_items ORDER BY id").all(),
    ledger: db
      .prepare("SELECT id, customer_id, bill_id, draft_id, kind, mode, amount_paise, balance_after_paise, created_at FROM ledger_entries ORDER BY id")
      .all(),
  };
}

// A database shaped exactly like the app made it before migrations existed.
function todaysShop(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(BASE_SCHEMA);
  loadSeed(db, readSeed());
  saveBill(db, { draftId: "old-bill", customerId: 1, items: [{ grade: 1, qty: 10 }], cash: rs(4000) }, ratesFromSeed(readSeed()));
  recordPayment(db, { draftId: "old-pay", customerId: 5, amount: rs(25000), mode: "cash" });
  return db;
}

describe("migrate", () => {
  it("a fresh database reaches the latest version", () => {
    expect(version(openDb(":memory:"))).toBe(SCHEMA_VERSION);
  });

  it("upgrading today's database keeps every customer, bill, item and khata line", () => {
    const db = todaysShop();
    const before = snapshot(db);
    expect(version(db)).toBe(0);
    migrate(db);
    expect(version(db)).toBe(SCHEMA_VERSION);
    expect(snapshot(db)).toEqual(before);
  });

  it("adjustment lines with a note are refused before the upgrade and allowed after", () => {
    const db = todaysShop();
    const add = "INSERT INTO ledger_entries (customer_id, kind, amount_paise, balance_after_paise) VALUES (1, 'adjustment', 100, 100)";
    expect(() => db.exec(add)).toThrow();
    migrate(db);
    db.prepare("INSERT INTO ledger_entries (customer_id, kind, amount_paise, balance_after_paise, note) VALUES (1, 'adjustment', 100, 100, 'galti')").run();
  });

  it("running it again changes nothing", () => {
    const db = openDb(":memory:");
    const before = snapshot(db);
    expect(migrate(db)).toBe(SCHEMA_VERSION);
    expect(snapshot(db)).toEqual(before);
  });
});
