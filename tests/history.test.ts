import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { saveBill, type ItemInput } from "../lib/billing.ts";
import { loadSeed, openDb, ratesFromSeed, readSeed } from "../lib/db.ts";
import { dayTotals, getBill, indiaDay, listBills, receiptText, whatsappLink } from "../lib/history.ts";
import { rs } from "../lib/money.ts";
import { updateShop } from "../lib/shop.ts";

const seed = readSeed();
const RATES = ratesFromSeed(seed);
let db: DatabaseSync;
let n = 0;
const id = (name: string) => (db.prepare("SELECT id FROM customers WHERE name = ?").get(name) as { id: number }).id;

// Save a bill, then move its time (UTC, as stored) to test India days.
function bill(name: string, items: ItemInput[], pay: { cash?: number; upi?: number }, utc: string): number {
  const draftId = (++n).toString(16).padStart(32, "0");
  const result = saveBill(db, { draftId, customerId: id(name), items, ...pay }, RATES);
  if (result.status !== "saved") throw new Error("not saved");
  db.prepare("UPDATE bills SET created_at = ? WHERE id = ?").run(utc, result.billId);
  return result.billId;
}

beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, seed);
  n = 0;
});

describe("indiaDay", () => {
  it("is the date in India, which changes at 18:30 UTC", () => {
    expect(indiaDay(new Date("2026-11-19T18:15:00Z"))).toBe("2026-11-19");
    expect(indiaDay(new Date("2026-11-19T18:45:00Z"))).toBe("2026-11-20");
  });
});

describe("bills by India day", () => {
  it("a bill at 23:00 India time stays on that day; 00:15 is the next day", () => {
    const late = bill("Manat", [{ grade: 1, qty: 10 }], {}, "2026-11-19 17:30:00");
    const early = bill("Vikas", [{ grade: 2, qty: 5 }], {}, "2026-11-19 18:45:00");
    expect(listBills(db, { day: "2026-11-19" }).map((b) => b.id)).toEqual([late]);
    expect(listBills(db, { day: "2026-11-20" }).map((b) => b.id)).toEqual([early]);
    expect(listBills(db, { day: "2026-11-20" })[0]).toMatchObject({ customerName: "Vikas", total: rs(6000), day: "2026-11-20" });
  });

  it("day totals match the bills, and an empty day is all zero", () => {
    bill("Manat", [{ grade: 1, qty: 10 }], { cash: rs(4000) }, "2026-11-19 05:00:00");
    bill("Vikas", [{ grade: 3, qty: 10 }], { upi: rs(1000) }, "2026-11-19 09:00:00");
    expect(dayTotals(db, "2026-11-19")).toEqual({
      day: "2026-11-19", bills: 2, total: rs(19000), cash: rs(4000), upi: rs(1000), udhaar: rs(14000),
    });
    expect(dayTotals(db, "2026-11-18")).toEqual({ day: "2026-11-18", bills: 0, total: 0, cash: 0, upi: 0, udhaar: 0 });
  });

  it("filters by customer, newest first", () => {
    const first = bill("Manat", [{ grade: 1, qty: 1 }], {}, "2026-11-18 05:00:00");
    bill("Vikas", [{ grade: 1, qty: 1 }], {}, "2026-11-18 06:00:00");
    const second = bill("Manat", [{ grade: 1, qty: 2 }], {}, "2026-11-19 05:00:00");
    expect(listBills(db, { customerId: id("Manat") }).map((b) => b.id)).toEqual([second, first]);
  });
});

describe("one bill", () => {
  it("lists its items and what the customer owed after it", () => {
    const billId = bill("Manat", [{ grade: 1, qty: 10 }, { grade: 2, qty: 5, rate: rs(1300) }], { cash: rs(4000) }, "2026-11-19 17:30:00");
    expect(getBill(db, billId)).toMatchObject({
      id: billId, customerName: "Manat", total: rs(21500), cash: rs(4000), udhaar: rs(17500), outstandingAfter: rs(30000),
      items: [
        { grade: 1, qty: 10, unit: "piece", rate: rs(1500), rateOverride: false, amount: rs(15000) },
        { grade: 2, qty: 5, unit: "piece", rate: rs(1300), rateOverride: true, amount: rs(6500) },
      ],
    });
    expect(getBill(db, 9999)).toBeNull();
  });

  it("makes a plain-text receipt with the shop, items, totals and the new udhaar", () => {
    updateShop(db, { shopName: "Ram Fruit Co", ownerName: "Ram Lal", phone: "9876543210", address: "APMC Yard, Shed 4" });
    const billId = bill("Manat", [{ grade: 1, qty: 10 }], { cash: rs(4000) }, "2026-11-19 17:30:00");
    const text = receiptText(getBill(db, billId)!, { shopName: "Ram Fruit Co", phone: "9876543210", address: "APMC Yard, Shed 4" });
    for (const line of [
      "*Ram Fruit Co*", "APMC Yard, Shed 4", "Mobile 9876543210", `Bill ${billId}, 19 Nov, 11:00 pm`, "Customer: Manat",
      "Grade 1: 10 piece x ₹1,500 = ₹15,000", "Total: ₹15,000", "Cash: ₹4,000", "Udhaar: ₹11,000", "Kul udhaar ab: ₹23,500",
    ]) expect(text).toContain(line);
    expect(text).not.toContain("UPI");
  });

  it("opens WhatsApp with the text, to the customer's number when known", () => {
    expect(whatsappLink("Bill 1", "9876543210")).toBe("https://wa.me/919876543210?text=Bill%201");
    expect(whatsappLink("Bill 1", "")).toBe("https://wa.me/?text=Bill%201");
  });
});
