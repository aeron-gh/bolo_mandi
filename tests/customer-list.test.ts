import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { listCustomers } from "../lib/customer-list.ts";
import { getAccount, updateCustomer } from "../lib/customers.ts";
import { loadSeed, openDb, readSeed } from "../lib/db.ts";
import { rs } from "../lib/money.ts";

let db: DatabaseSync;
const id = (name: string) => (db.prepare("SELECT id FROM customers WHERE name = ?").get(name) as { id: number }).id;

beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, readSeed());
});

describe("listCustomers", () => {
  it("puts the biggest udhaar first by default", () => {
    const names = listCustomers(db, {}).map((c) => c.name);
    expect(names.slice(0, 3)).toEqual(["Deepak", "Imran", "Rahul"]);
    expect(names.at(-1)).toBe("Sameer");
  });

  it("can sort by name", () => {
    expect(listCustomers(db, { sort: "name" }).map((c) => c.name).slice(0, 4)).toEqual(["Afzal Ahmed", "Afzal Khan", "Afzal Traders", "Anil"]);
  });

  it("finds by part of a name, any case, or by phone digits", () => {
    expect(listCustomers(db, { q: "AFZAL" }).map((c) => c.name).sort()).toEqual(["Afzal Ahmed", "Afzal Khan", "Afzal Traders"]);
    updateCustomer(db, id("Vikas"), { phone: "98765 43210" });
    expect(listCustomers(db, { q: "98765" }).map((c) => c.name)).toEqual(["Vikas"]);
  });

  it("filters to customers who owe, or who are near or over their limit", () => {
    expect(listCustomers(db, { filter: "credit" })).toHaveLength(9);
    db.prepare("UPDATE customers SET outstanding_paise = ? WHERE name = 'Vikas'").run(rs(46000));
    db.prepare("UPDATE customers SET outstanding_paise = ? WHERE name = 'Anil'").run(rs(80000));
    const near = listCustomers(db, { filter: "limit" });
    expect(near.map((c) => [c.name, c.credit])).toEqual([["Anil", "over"], ["Vikas", "near"]]);
  });

  it("gives each row what the list shows", () => {
    expect(listCustomers(db, { q: "manat" })[0]).toEqual({
      id: id("Manat"), name: "Manat", phone: "", outstanding: rs(12500), creditLimit: rs(100000), credit: "ok",
    });
  });
});

describe("updateCustomer", () => {
  it("changes name, phone and limit", () => {
    const vikas = id("Vikas");
    updateCustomer(db, vikas, { name: "  Vikas   Kumar ", phone: "+91 98765-43210", creditLimit: rs(60000) });
    expect(getAccount(db, vikas)).toMatchObject({ name: "Vikas Kumar", creditLimit: rs(60000) });
    expect(listCustomers(db, { q: "vikas" })[0].phone).toBe("9876543210");
  });

  it("refuses a name another customer already has, or an empty one", () => {
    expect(() => updateCustomer(db, id("Vikas"), { name: "afzal khan" })).toThrow(/already exists/);
    expect(() => updateCustomer(db, id("Vikas"), { name: "   " })).toThrow(/name/);
    expect(updateCustomer(db, id("Vikas"), { name: "vikas" }).name).toBe("vikas");
  });

  it("refuses a bad phone and a limit that is not whole rupees", () => {
    expect(() => updateCustomer(db, id("Vikas"), { phone: "12345" })).toThrow(/phone/);
    for (const bad of [-100, rs(500) + 50, 1.5]) {
      expect(() => updateCustomer(db, id("Vikas"), { creditLimit: bad })).toThrow(/limit/);
    }
  });

  it("refuses an unknown customer", () => {
    expect(() => updateCustomer(db, 9999, { name: "X" })).toThrow(/unknown customer/);
  });
});
