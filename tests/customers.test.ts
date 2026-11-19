import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { rs } from "../lib/money.ts";
import { openDb, readSeed, loadSeed, ratesFromSeed } from "../lib/db.ts";
import { saveBill } from "../lib/billing.ts";
import {
  cleanName, soundKey, editDistance, findCustomer, loadCustomers, addCustomer,
  type Customer, type CustomerMatch,
} from "../lib/customers.ts";

const seed = readSeed();
const RATES = ratesFromSeed(seed);

let db: DatabaseSync;
let customers: Customer[];

// fresh in-memory database with seed data for every test
beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, seed);
  customers = loadCustomers(db);
});

type Row = { credit_limit_paise: number; outstanding_paise: number };

function row(id: number): Row {
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(id) as Row;
}

function options(match: CustomerMatch): Customer[] {
  if (match.kind !== "ambiguous") throw new Error(`expected ambiguous, got ${match.kind}`);
  return match.options;
}

function found(match: CustomerMatch): Customer {
  if (match.kind !== "found") throw new Error(`expected found, got ${match.kind}`);
  return match.customer;
}

const names = (list: Customer[]) => list.map((c) => c.name).sort();

describe("cleanName", () => {
  it("drops case, dots and words like bhai or wala", () => {
    expect(cleanName("  Afzal BHAI  ")).toBe("afzal");
    expect(cleanName("Afzal Ahmed.")).toBe("afzal ahmed");
    expect(cleanName("Ahmed wala")).toBe("ahmed");
  });
});

describe("soundKey", () => {
  it.each([
    ["Afjal", "Afzal"],   // z -> j
    ["Dipak", "Deepak"],  // ee -> i
    ["Rahool", "Rahul"],  // oo -> u
    ["Vikash", "Vikas"],  // sh -> s
    ["Mannat", "Manat"],  // double letters -> one
    ["Kan", "Khan"],      // kh -> k
    ["Firoz", "Phiroz"],  // ph -> f
    ["Wikas", "Vikas"],   // w -> v
    ["Kasim", "Qasim"],   // q -> k
  ])("%s sounds like %s", (a, b) => {
    expect(soundKey(a)).toBe(soundKey(b));
  });
});

describe("editDistance", () => {
  it("counts single-letter changes", () => {
    expect(editDistance("afzal", "afzal")).toBe(0);
    expect(editDistance("anil", "amil")).toBe(1);
    expect(editDistance("kitten", "sitting")).toBe(3);
  });
});

describe("findCustomer", () => {
  it("N01: 'Afzal' asks which one, with all three options", () => {
    expect(names(options(findCustomer("Afzal", customers)))).toEqual([
      "Afzal Ahmed", "Afzal Khan", "Afzal Traders",
    ]);
  });

  it("N03: 'Afzal Khan' is found with no question", () => {
    expect(findCustomer("Afzal Khan", customers)).toMatchObject({
      kind: "found", fuzzy: false, customer: { name: "Afzal Khan" },
    });
  });

  it("N04: 'Afjal Traders' finds Afzal Traders as a fuzzy match", () => {
    expect(findCustomer("Afjal Traders", customers)).toMatchObject({
      kind: "found", fuzzy: true, customer: { name: "Afzal Traders" },
    });
  });

  it("N05: 'Ramesh' is not found", () => {
    expect(findCustomer("Ramesh", customers)).toEqual({ kind: "not_found", query: "ramesh" });
  });

  it("N06: 'Afzal bhai' still asks which Afzal", () => {
    expect(options(findCustomer("Afzal bhai", customers))).toHaveLength(3);
  });

  it("finds a name said with another spelling", () => {
    for (const [said, real] of [["Dipak", "Deepak"], ["Vikash", "Vikas"], ["Samir", "Sameer"], ["Imram", "Imran"]]) {
      expect(findCustomer(said, customers)).toMatchObject({ kind: "found", fuzzy: true, customer: { name: real } });
    }
  });

  it("a name two letters away is new, not a guess (Amit is not Anil)", () => {
    for (const said of ["Amit", "Sunil"]) {
      expect(findCustomer(said, customers).kind).toBe("not_found");
    }
  });

  it("exact name wins over a longer name that contains it", () => {
    addCustomer(db, "Rahul Traders");
    expect(findCustomer("Rahul", loadCustomers(db))).toMatchObject({
      kind: "found", fuzzy: false, customer: { name: "Rahul" },
    });
  });

  it("filler words, empty text or Hindi script are unclear, never a new customer", () => {
    for (const said of ["bhai ji", "", "अफ़ज़ल"]) {
      expect(findCustomer(said, customers)).toEqual({ kind: "unclear" });
    }
  });

  it("answering 'which Afzal?' searches only the options", () => {
    const afzals = options(findCustomer("Afzal", customers));
    expect(found(findCustomer("Ahmed wala", afzals)).name).toBe("Afzal Ahmed");
    expect(found(findCustomer("Traders", afzals)).name).toBe("Afzal Traders");
    expect(findCustomer("Manat", afzals).kind).toBe("not_found");
  });
});

describe("billing after a name search", () => {
  it("N02: 'Afzal' then 'Afzal Ahmed.' saves the bill, ₹35,000 owed, ₹1,15,000 left", () => {
    const afzals = options(findCustomer("Afzal", customers));
    const ahmed = found(findCustomer("Afzal Ahmed.", afzals));
    const result = saveBill(db, { draftId: "n02", customerId: ahmed.id, items: [{ grade: 1, qty: 10 }] }, RATES);
    expect(result).toMatchObject({ status: "saved", total: rs(15000), newOutstanding: rs(35000) });
    const after = row(ahmed.id);
    expect(after.credit_limit_paise - after.outstanding_paise).toBe(rs(115000));
  });

  it("N04: 5 grade 2 to 'Afjal Traders' takes him to ₹81,000", () => {
    const traders = found(findCustomer("Afjal Traders", customers));
    const result = saveBill(db, { draftId: "n04", customerId: traders.id, items: [{ grade: 2, qty: 5 }] }, RATES);
    expect(result).toMatchObject({ status: "saved", total: rs(6000), newOutstanding: rs(81000) });
  });
});

describe("addCustomer", () => {
  it("adds a new customer with ₹0 limit, ₹0 owed and an opening ledger line", () => {
    const ramesh = addCustomer(db, "  ramesh  ");
    expect(ramesh.name).toBe("Ramesh");
    expect(row(ramesh.id)).toMatchObject({ credit_limit_paise: 0, outstanding_paise: 0 });
    const { n } = db
      .prepare("SELECT COUNT(*) AS n FROM ledger_entries WHERE customer_id = ?")
      .get(ramesh.id) as { n: number };
    expect(n).toBe(1);
    expect(findCustomer("Ramesh", loadCustomers(db))).toMatchObject({ kind: "found", customer: { id: ramesh.id } });
  });

  it("refuses a name that already exists, in any case", () => {
    expect(() => addCustomer(db, "manat")).toThrow(/already exists/);
  });

  it("refuses a name made only of filler words", () => {
    expect(() => addCustomer(db, " bhai ")).toThrow(/empty name/);
  });

  it("new customer's first udhaar bill needs the trader's yes", () => {
    const ramesh = addCustomer(db, "Ramesh");
    const result = saveBill(db, { draftId: "r1", customerId: ramesh.id, items: [{ grade: 1, qty: 10 }] }, RATES);
    expect(result).toMatchObject({ status: "needs_answer", reason: "over_limit", overBy: rs(15000) });
  });
});
