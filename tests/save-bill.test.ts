import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { rs } from "../lib/money.ts";
import { openDb, readSeed, loadSeed, ratesFromSeed } from "../lib/db.ts";
import { saveBill, type Draft, type ItemInput } from "../lib/billing.ts";

const seed = readSeed();
const RATES = ratesFromSeed(seed);
const B01: ItemInput[] = [{ grade: 1, qty: 10 }, { grade: 2, qty: 5 }, { grade: 3, qty: 10 }];

let db: DatabaseSync;

// fresh in-memory database with seed data for every test
beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, seed);
});

type CustomerRow = { id: number; outstanding_paise: number; credit_limit_paise: number };

function customer(name: string): CustomerRow {
  return db.prepare("SELECT * FROM customers WHERE name = ?").get(name) as CustomerRow;
}

function count(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

function draft(name: string, items: ItemInput[], extra: Partial<Draft> = {}): Draft {
  return { draftId: crypto.randomUUID(), customerId: customer(name).id, items, ...extra };
}

describe("seed", () => {
  it("loads 10 customers with money in paise", () => {
    expect(count("customers")).toBe(10);
    expect(customer("Manat")).toMatchObject({
      credit_limit_paise: rs(100000), outstanding_paise: rs(12500),
    });
    expect(RATES).toEqual({ 1: rs(1500), 2: rs(1200), 3: rs(400) });
  });
});

describe("saveBill", () => {
  it("B01: saves bill and items, Manat now owes ₹33,500", () => {
    const result = saveBill(db, draft("Manat", B01, { cash: rs(4000) }), RATES);
    expect(result).toMatchObject({
      status: "saved", duplicate: false, total: rs(25000), cash: rs(4000), upi: 0,
      udhaar: rs(21000), newOutstanding: rs(33500), overLimit: false,
    });
    expect(customer("Manat").outstanding_paise).toBe(rs(33500));
    expect(count("bill_items")).toBe(3);
  });

  it("ledger entries add up to the outstanding", () => {
    saveBill(db, draft("Manat", B01, { cash: rs(4000) }), RATES);
    const { sum } = db
      .prepare("SELECT SUM(amount_paise) AS sum FROM ledger_entries WHERE customer_id = ?")
      .get(customer("Manat").id) as { sum: number };
    expect(sum).toBe(rs(33500));
  });

  it("same draft_id twice makes only one bill", () => {
    const d = draft("Manat", B01, { cash: rs(4000) });
    const first = saveBill(db, d, RATES);
    const second = saveBill(db, d, RATES);
    if (first.status !== "saved") throw new Error("first save failed");
    expect(second).toMatchObject({ status: "saved", duplicate: true, billId: first.billId });
    expect(count("bills")).toBe(1);
    expect(customer("Manat").outstanding_paise).toBe(rs(33500));
  });

  it("a retry returns the saved bill even if the limit is now crossed", () => {
    const d = draft("Vikas", [{ grade: 3, qty: 100 }]);
    expect(saveBill(db, d, RATES)).toMatchObject({ status: "saved", newOutstanding: rs(48000) });
    expect(saveBill(db, d, RATES)).toMatchObject({ status: "saved", duplicate: true });
    expect(count("bills")).toBe(1);
  });

  it("C02: over limit is not saved without the trader's yes", () => {
    const result = saveBill(db, draft("Vikas", [{ grade: 2, qty: 40 }]), RATES);
    expect(result).toEqual({
      status: "needs_answer", reason: "over_limit", overBy: rs(6000), newOutstanding: rs(56000),
    });
    expect(count("bills")).toBe(0);
    expect(customer("Vikas").outstanding_paise).toBe(rs(8000));
  });

  it("C05: trader says yes, bill is saved with over_limit set", () => {
    const d = draft("Vikas", [{ grade: 2, qty: 40 }], { allowOverLimit: true });
    expect(saveBill(db, d, RATES)).toMatchObject({
      status: "saved", overLimit: true, newOutstanding: rs(56000),
    });
  });

  it("P03: paying more than the bill is not saved", () => {
    const result = saveBill(db, draft("Sameer", [{ grade: 2, qty: 2 }], { cash: rs(5000) }), RATES);
    expect(result).toEqual({ status: "needs_answer", reason: "overpaid", extra: rs(2600) });
    expect(count("bills")).toBe(0);
  });

  it("never bills an unknown customer", () => {
    const d: Draft = { draftId: "x", customerId: 9999, items: B01 };
    expect(() => saveBill(db, d, RATES)).toThrow(/unknown customer/);
    expect(count("bills")).toBe(0);
  });
});
