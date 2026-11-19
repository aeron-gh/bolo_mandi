import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { rs } from "../lib/money.ts";
import { openDb, readSeed, loadSeed, ratesFromSeed } from "../lib/db.ts";
import { previewBill, confirmBill, searchCustomers, createCustomer, readKhata } from "../lib/api.ts";

const RATES = ratesFromSeed(readSeed());
// seed order: 1 Manat, 8 Vikas, 9 Sameer
const MANAT = 1, VIKAS = 8, SAMEER = 9;
const B01 = { customerId: MANAT, items: [{ grade: 1, qty: 10 }, { grade: 2, qty: 5 }, { grade: 3, qty: 10 }], cash: rs(4000) };

let db: DatabaseSync;

beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, readSeed());
});

function count(table: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
}

describe("previewBill", () => {
  it("B01: numbers and the sentence Bolo will say, nothing saved", () => {
    const p = previewBill(db, RATES, B01);
    expect(p).toMatchObject({
      total: rs(25000), cash: rs(4000), upi: 0, udhaar: rs(21000),
      newOutstanding: rs(33500), creditLeft: rs(66500), credit: "ok", overpaidBy: 0,
      customer: { name: "Manat", outstanding: rs(12500), creditLimit: rs(100000) },
    });
    expect(p.say).toBe(
      "Manat's bill is ₹25,000. ₹4,000 cash received, ₹21,000 goes on credit. " +
        "Manat's total credit is now ₹33,500. Save the bill?",
    );
    expect(count("bills")).toBe(0);
  });

  it("P03: paying more than the bill asks wapas or advance", () => {
    const p = previewBill(db, RATES, { customerId: SAMEER, items: [{ grade: 2, qty: 2 }], cash: rs(5000) });
    expect(p).toMatchObject({ total: rs(2400), overpaidBy: rs(2600), udhaar: 0 });
    expect(p.say).toBe("₹2,600 more than the bill was paid. Give it back or keep it as advance?");
  });

  it("C02: over the limit shows how much and asks again", () => {
    const p = previewBill(db, RATES, { customerId: VIKAS, items: [{ grade: 2, qty: 40 }] });
    expect(p).toMatchObject({ credit: "over", overBy: rs(6000), newOutstanding: rs(56000) });
    expect(p.say).toMatch(/Save the bill anyway\?$/);
  });

  it("R06: Manat 8 grade 2 comes to ₹9,600, new udhaar ₹22,100", () => {
    const p = previewBill(db, RATES, { customerId: MANAT, items: [{ grade: 2, qty: 8 }] });
    expect(p).toMatchObject({ total: rs(9600), newOutstanding: rs(22100) });
  });

  it("B08: a typed rate is marked as override", () => {
    const p = previewBill(db, RATES, { customerId: 5, items: [{ grade: 1, qty: 10, rate: rs(1400) }] });
    expect(p.lines[0]).toMatchObject({ rate: rs(1400), rateOverride: true });
  });

  it("with no items yet it shows the customer and says nothing", () => {
    const p = previewBill(db, RATES, { customerId: MANAT, items: [] });
    expect(p).toMatchObject({ total: 0, say: "", customer: { outstanding: rs(12500) } });
  });

  it("refuses broken requests with a clear message", () => {
    expect(() => previewBill(db, RATES, "hello")).toThrow(/body/);
    expect(() => previewBill(db, RATES, { items: [] })).toThrow(/customerId/);
    expect(() => previewBill(db, RATES, { customerId: MANAT, items: [{ grade: 4, qty: 1 }] })).toThrow(/grade/);
    expect(() => previewBill(db, RATES, { customerId: MANAT, items: "x" })).toThrow(/items/);
    expect(() => previewBill(db, RATES, { customerId: 999, items: [] })).toThrow(/unknown customer/);
  });
});

describe("confirmBill", () => {
  it("saves once even if confirmed twice", () => {
    const body = { ...B01, draftId: "abc" };
    expect(confirmBill(db, RATES, body)).toMatchObject({ status: "saved", duplicate: false, newOutstanding: rs(33500) });
    expect(confirmBill(db, RATES, body)).toMatchObject({ status: "saved", duplicate: true });
    expect(count("bills")).toBe(1);
  });

  it("C05: over limit saves only with the trader's yes", () => {
    const body = { customerId: VIKAS, items: [{ grade: 2, qty: 40 }], draftId: "c05" };
    expect(confirmBill(db, RATES, body)).toMatchObject({ status: "needs_answer", reason: "over_limit" });
    expect(confirmBill(db, RATES, { ...body, allowOverLimit: true })).toMatchObject({ status: "saved", overLimit: true });
  });

  it("needs a draftId", () => {
    expect(() => confirmBill(db, RATES, B01)).toThrow(/draftId/);
  });
});

describe("customers and khata", () => {
  it("search returns what findCustomer decides", () => {
    expect(searchCustomers(db, "Afzal").kind).toBe("ambiguous");
    expect(searchCustomers(db, null).kind).toBe("unclear");
  });

  it("creates a new customer from a name", () => {
    expect(createCustomer(db, { name: "Ramesh" })).toMatchObject({ name: "Ramesh" });
    expect(() => createCustomer(db, {})).toThrow(/name/);
  });

  it("reads a khata by id from the URL", () => {
    expect(readKhata(db, String(SAMEER))).toMatchObject({ customer: { name: "Sameer" }, outstanding: 0 });
    expect(() => readKhata(db, "abc")).toThrow(/bad id/);
  });
});
