import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createSession, setPin } from "../lib/auth.ts";
import { getAccount } from "../lib/customers.ts";
import { loadSeed, openDb, readSeed } from "../lib/db.ts";
import { addAdjustment, addPayment, addPromise, markPromise, newCustomer, saveCustomer } from "../lib/khata-api.ts";
import { getKhata } from "../lib/ledger.ts";
import { rs } from "../lib/money.ts";
import { PinRequired } from "../lib/shop-api.ts";

const NOW = new Date("2026-11-19T06:30:00Z");
const A = "a".repeat(32);
const B = "b".repeat(32);
let db: DatabaseSync;
const id = (name: string) => (db.prepare("SELECT id FROM customers WHERE name = ?").get(name) as { id: number }).id;
const count = (sql: string) => (db.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get() as { n: number }).n;

beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, readSeed());
});

describe("saveCustomer", () => {
  it("anyone can fix a name or phone, but a new limit needs the owner once a PIN is set", () => {
    setPin(db, "1234");
    const vikas = String(id("Vikas"));
    expect(saveCustomer(db, null, NOW, vikas, { name: "Vikas Kumar", phone: "9876543210", creditLimit: rs(50000) }))
      .toMatchObject({ name: "Vikas Kumar" });
    expect(() => saveCustomer(db, null, NOW, vikas, { name: "Vikas Kumar", phone: "", creditLimit: rs(90000) })).toThrow(PinRequired);
    expect(getAccount(db, Number(vikas)).creditLimit).toBe(rs(50000));
    const token = createSession(db, NOW);
    expect(saveCustomer(db, token, NOW, vikas, { name: "Vikas Kumar", phone: "", creditLimit: rs(90000) }))
      .toMatchObject({ creditLimit: rs(90000) });
  });

  it("refuses a bad id or a limit that is not a number", () => {
    expect(() => saveCustomer(db, null, NOW, "abc", { name: "X" })).toThrow(/bad id/);
    expect(() => saveCustomer(db, null, NOW, String(id("Vikas")), { name: "Vikas", creditLimit: "lots" })).toThrow(/limit/);
  });
});

describe("newCustomer", () => {
  it("starts at ₹0 limit without asking; a bigger limit needs the owner once a PIN is set", () => {
    setPin(db, "1234");
    expect(newCustomer(db, null, NOW, { name: "ramesh", phone: "9876543210" })).toMatchObject({ name: "Ramesh" });
    expect(getAccount(db, id("Ramesh")).creditLimit).toBe(0);
    expect(() => newCustomer(db, null, NOW, { name: "Suresh", creditLimit: rs(20000) })).toThrow(PinRequired);
    expect(count("customers WHERE name = 'Suresh'")).toBe(0);
  });
});

describe("addPayment (vasooli)", () => {
  it("writes once per draft id and keeps 'mode not said' as null", () => {
    const manat = id("Manat");
    const body = { draftId: A, customerId: manat, amount: rs(2500) };
    expect(addPayment(db, body)).toMatchObject({ status: "saved", duplicate: false, mode: null, newOutstanding: rs(10000) });
    expect(addPayment(db, body)).toMatchObject({ duplicate: true, newOutstanding: rs(10000) });
    expect(count("ledger_entries WHERE kind = 'payment'")).toBe(1);
  });

  it("asks before taking more than is owed, unless the owner said advance", () => {
    const vikas = id("Vikas");
    expect(addPayment(db, { draftId: A, customerId: vikas, amount: rs(10000), mode: "cash" })).toMatchObject({ status: "needs_answer", extra: rs(2000) });
    expect(addPayment(db, { draftId: A, customerId: vikas, amount: rs(10000), mode: "cash", allowAdvance: true }))
      .toMatchObject({ status: "saved", newOutstanding: -rs(2000) });
  });

  it("refuses a bad mode or draft id", () => {
    expect(() => addPayment(db, { draftId: A, customerId: id("Manat"), amount: rs(100), mode: "cheque" })).toThrow(/mode/);
    expect(() => addPayment(db, { draftId: "x", customerId: id("Manat"), amount: rs(100) })).toThrow(/draft/);
  });
});

describe("addAdjustment (sudhaar)", () => {
  it("needs a note and a non-zero amount, moves the balance and writes once", () => {
    const manat = id("Manat");
    expect(() => addAdjustment(db, null, NOW, { draftId: A, customerId: manat, amount: rs(500), note: "  " })).toThrow(/note/);
    expect(() => addAdjustment(db, null, NOW, { draftId: A, customerId: manat, amount: 0, note: "galti" })).toThrow(/amount/);
    const body = { draftId: A, customerId: manat, amount: -rs(500), note: "Pichle bill mein 500 zyada lage" };
    expect(addAdjustment(db, null, NOW, body)).toMatchObject({ duplicate: false, newOutstanding: rs(12000) });
    expect(addAdjustment(db, null, NOW, body)).toMatchObject({ duplicate: true, newOutstanding: rs(12000) });
    expect(addAdjustment(db, null, NOW, { ...body, draftId: B, amount: rs(300) })).toMatchObject({ newOutstanding: rs(12300) });
    expect(getAccount(db, manat).outstanding).toBe(rs(12300));
  });

  it("needs the owner once a PIN is set", () => {
    setPin(db, "1234");
    expect(() => addAdjustment(db, null, NOW, { draftId: A, customerId: id("Manat"), amount: rs(100), note: "x" })).toThrow(PinRequired);
    expect(count("ledger_entries WHERE kind = 'adjustment'")).toBe(0);
  });
});

describe("promises", () => {
  it("are written once, then marked kept or broken, but never changed after that", () => {
    const manat = id("Manat");
    const saved = addPromise(db, { draftId: A, customerId: manat, amount: rs(5000), due: "kal" }, NOW);
    expect(addPromise(db, { draftId: A, customerId: manat, amount: rs(5000), due: "kal" }, NOW).promiseId).toBe(saved.promiseId);
    expect(markPromise(db, String(saved.promiseId), { status: "kept" })).toEqual({ id: saved.promiseId, status: "kept" });
    expect(() => markPromise(db, String(saved.promiseId), { status: "broken" })).toThrow(/open/);
    expect(() => markPromise(db, String(saved.promiseId), { status: "maybe" })).toThrow(/status/);
    expect(getAccount(db, manat).outstanding).toBe(rs(12500));
  });
});

describe("getKhata", () => {
  it("shows adjustment notes, line ids and which promises are overdue in India time", () => {
    const manat = id("Manat");
    addAdjustment(db, null, NOW, { draftId: A, customerId: manat, amount: -rs(500), note: "Rate galat laga" });
    addPromise(db, { draftId: B, customerId: manat, amount: rs(1000), due: "aaj" }, NOW);
    const later = new Date("2026-11-20T19:00:00Z"); // 21 Nov, 00:30 in India
    const khata = getKhata(db, manat, later);
    expect(khata.entries.at(-1)).toMatchObject({ kind: "adjustment", note: "Rate galat laga", amount: -rs(500) });
    expect(typeof khata.entries[0].id).toBe("number");
    expect(khata.openPromises).toMatchObject([{ amount: rs(1000), dueDate: "2026-11-19", overdue: true }]);
    expect(getKhata(db, manat, NOW).openPromises[0].overdue).toBe(false);
  });
});
