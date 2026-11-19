import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { rs } from "../lib/money.ts";
import { openDb, readSeed, loadSeed, ratesFromSeed } from "../lib/db.ts";
import { saveBill } from "../lib/billing.ts";
import { findCustomer, loadCustomers } from "../lib/customers.ts";
import { recordPayment, recordPromise, dueDate, getKhata } from "../lib/ledger.ts";

const seed = readSeed();
const RATES = ratesFromSeed(seed);

// 12:00 noon in India on 19 Nov 2026
const NOON_IST = new Date("2026-11-19T06:30:00Z");
// 4:00 AM in India on 20 Nov 2026, but still 19 Nov in UTC
const EARLY_IST = new Date("2026-11-19T22:30:00Z");

let db: DatabaseSync;

// fresh in-memory database with seed data for every test
beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, seed);
});

function id(name: string): number {
  const match = findCustomer(name, loadCustomers(db));
  if (match.kind !== "found") throw new Error(`no customer ${name}`);
  return match.customer.id;
}

function owed(name: string): number {
  return (db.prepare("SELECT outstanding_paise AS o FROM customers WHERE id = ?").get(id(name)) as { o: number }).o;
}

function count(sql: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM ${sql}`).get() as { n: number }).n;
}

describe("recordPayment", () => {
  it("V01: Rahul pays ₹25,000 cash, now owes ₹60,000", () => {
    const result = recordPayment(db, { draftId: "v01", customerId: id("Rahul"), amount: rs(25000), mode: "cash" });
    expect(result).toMatchObject({
      status: "saved", duplicate: false, amount: rs(25000), mode: "cash", newOutstanding: rs(60000),
    });
    expect(owed("Rahul")).toBe(rs(60000));
  });

  it("V02: Imran pays ₹50,000 UPI, now owes ₹70,000", () => {
    const result = recordPayment(db, { draftId: "v02", customerId: id("Imran"), amount: rs(50000), mode: "upi" });
    expect(result).toMatchObject({ status: "saved", mode: "upi", newOutstanding: rs(70000) });
  });

  it("V04: Deepak pays ₹3,50,000 with no mode said, saved as not said", () => {
    const result = recordPayment(db, { draftId: "v04", customerId: id("Deepak"), amount: rs(350000) });
    expect(result).toMatchObject({ status: "saved", mode: null, newOutstanding: 0 });
  });

  it("V05: Manat pays ₹20,000 but owes ₹12,500, so ask about ₹7,500", () => {
    const result = recordPayment(db, { draftId: "v05", customerId: id("Manat"), amount: rs(20000) });
    expect(result).toEqual({ status: "needs_answer", reason: "more_than_outstanding", extra: rs(7500) });
    expect(owed("Manat")).toBe(rs(12500));
    expect(count("ledger_entries WHERE kind = 'payment'")).toBe(0);
  });

  it("V05: trader says advance, Manat goes to -₹7,500", () => {
    const result = recordPayment(db, {
      draftId: "v05", customerId: id("Manat"), amount: rs(20000), allowAdvance: true,
    });
    expect(result).toMatchObject({ status: "saved", newOutstanding: -rs(7500) });
  });

  it("a customer already in advance: any payment is extra", () => {
    recordPayment(db, { draftId: "a1", customerId: id("Manat"), amount: rs(20000), allowAdvance: true });
    const result = recordPayment(db, { draftId: "a2", customerId: id("Manat"), amount: rs(1000) });
    expect(result).toEqual({ status: "needs_answer", reason: "more_than_outstanding", extra: rs(1000) });
  });

  it("an advance is used up by the next udhaar bill", () => {
    recordPayment(db, { draftId: "adv", customerId: id("Manat"), amount: rs(20000), allowAdvance: true });
    const bill = saveBill(db, { draftId: "b", customerId: id("Manat"), items: [{ grade: 2, qty: 10 }] }, RATES);
    expect(bill).toMatchObject({ status: "saved", udhaar: rs(12000), newOutstanding: rs(4500) });
  });

  it("same draft_id twice lowers the balance only once", () => {
    const draft = { draftId: "twice", customerId: id("Rahul"), amount: rs(25000), mode: "cash" as const };
    const first = recordPayment(db, draft);
    const second = recordPayment(db, draft);
    if (first.status !== "saved") throw new Error("first payment failed");
    expect(second).toMatchObject({ status: "saved", duplicate: true, entryId: first.entryId });
    expect(owed("Rahul")).toBe(rs(60000));
  });

  it("refuses zero, negative or broken amounts", () => {
    for (const amount of [0, -100, 10.5]) {
      expect(() => recordPayment(db, { draftId: "x", customerId: id("Rahul"), amount })).toThrow(/bad amount/);
    }
  });

  it("never records a payment for an unknown customer", () => {
    expect(() => recordPayment(db, { draftId: "x", customerId: 9999, amount: rs(10) })).toThrow(/unknown customer/);
  });

  it("ledger lines still add up to outstanding after a bill and a payment", () => {
    const manat = id("Manat");
    saveBill(db, { draftId: "b01", customerId: manat, items: [{ grade: 1, qty: 10 }], cash: rs(4000) }, RATES);
    recordPayment(db, { draftId: "p", customerId: manat, amount: rs(5000), mode: "upi" });
    const { sum } = db
      .prepare("SELECT SUM(amount_paise) AS sum FROM ledger_entries WHERE customer_id = ?")
      .get(manat) as { sum: number };
    expect(sum).toBe(owed("Manat"));
  });
});

describe("dueDate", () => {
  it("aaj, kal, parso count from today in India", () => {
    expect(dueDate("aaj", NOON_IST)).toBe("2026-11-19");
    expect(dueDate("kal", NOON_IST)).toBe("2026-11-20");
    expect(dueDate("Parso", NOON_IST)).toBe("2026-11-21");
    expect(dueDate("tomorrow", NOON_IST)).toBe("2026-11-20");
  });

  it("at 4 AM in India, kal counts from India's date, not UTC's", () => {
    expect(dueDate("kal", EARLY_IST)).toBe("2026-11-21");
  });

  it("crosses the end of the month", () => {
    expect(dueDate("kal", new Date("2026-11-30T06:30:00Z"))).toBe("2026-12-01");
  });

  it("keeps a real date and refuses a fake one", () => {
    expect(dueDate("2026-12-05", NOON_IST)).toBe("2026-12-05");
    expect(() => dueDate("2026-02-30", NOON_IST)).toThrow(/unclear date/);
  });

  it("unknown words are unclear, so Bolo asks", () => {
    expect(() => dueDate("agle hafte", NOON_IST)).toThrow(/unclear date/);
  });
});

describe("recordPromise", () => {
  it("V03: Afzal Khan will pay ₹25,000 kal, outstanding stays ₹45,000", () => {
    const result = recordPromise(db, {
      draftId: "v03", customerId: id("Afzal Khan"), amount: rs(25000), due: "kal", now: NOON_IST,
    });
    expect(result).toMatchObject({ status: "saved", duplicate: false, amount: rs(25000), dueDate: "2026-11-20" });
    expect(owed("Afzal Khan")).toBe(rs(45000));
  });

  it("same draft_id twice saves one promise", () => {
    const draft = { draftId: "p", customerId: id("Afzal Khan"), amount: rs(25000), due: "kal", now: NOON_IST };
    recordPromise(db, draft);
    expect(recordPromise(db, draft)).toMatchObject({ duplicate: true });
    expect(count("promises")).toBe(1);
  });

  it("an unclear date saves nothing", () => {
    const draft = { draftId: "p", customerId: id("Afzal Khan"), amount: rs(25000), due: "jaldi" };
    expect(() => recordPromise(db, draft)).toThrow(/unclear date/);
    expect(count("promises")).toBe(0);
  });
});

describe("getKhata", () => {
  it("L03: Sameer owes ₹0 with a ₹1,50,000 limit", () => {
    expect(getKhata(db, id("Sameer"))).toMatchObject({
      customer: { name: "Sameer" }, outstanding: 0, creditLimit: rs(150000), creditLeft: rs(150000),
    });
  });

  it("shows every line in order and the open promises", () => {
    const manat = id("Manat");
    saveBill(db, { draftId: "b01", customerId: manat, items: [{ grade: 1, qty: 10 }], cash: rs(4000) }, RATES);
    recordPayment(db, { draftId: "p", customerId: manat, amount: rs(5000), mode: "upi" });
    recordPromise(db, { draftId: "pr", customerId: manat, amount: rs(10000), due: "kal", now: NOON_IST });

    const khata = getKhata(db, manat);
    expect(khata.entries.map((e) => e.kind)).toEqual(["opening", "bill", "payment", "payment"]);
    expect(khata.entries.at(-1)?.balanceAfter).toBe(khata.outstanding);
    expect(khata.outstanding).toBe(rs(18500)); // 12,500 + 15,000 bill - 4,000 cash - 5,000 UPI
    expect(khata.openPromises).toMatchObject([{ amount: rs(10000), dueDate: "2026-11-20" }]);
  });

  it("never reads the khata of an unknown customer", () => {
    expect(() => getKhata(db, 9999)).toThrow(/unknown customer/);
  });
});
