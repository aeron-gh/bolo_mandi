import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "../lib/db.ts";
import { rs } from "../lib/money.ts";
import { cleanPhone, getRates, getShop, updateRates, updateShop } from "../lib/shop.ts";

let db: DatabaseSync;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("shop details", () => {
  it("start empty with no PIN", () => {
    expect(getShop(db)).toEqual({ shopName: "", ownerName: "", phone: "", address: "", hasPin: false });
  });

  it("are saved trimmed, with the phone as 10 digits", () => {
    const shop = updateShop(db, { shopName: "  Ram  Fruit Co ", ownerName: "Ram Lal", phone: "+91 98765-43210", address: "APMC Yard, Shed 4" });
    expect(shop).toEqual({ shopName: "Ram Fruit Co", ownerName: "Ram Lal", phone: "9876543210", address: "APMC Yard, Shed 4", hasPin: false });
    expect(getShop(db)).toEqual(shop);
  });

  it("refuse a phone that is not a mobile number", () => {
    for (const phone of ["12345", "1234567890", "98765432100"]) {
      expect(() => updateShop(db, { shopName: "A", ownerName: "B", phone, address: "" })).toThrow(/phone/);
    }
  });

  it("refuse names longer than 60 letters", () => {
    expect(() => updateShop(db, { shopName: "x".repeat(61), ownerName: "B", phone: "", address: "" })).toThrow(/too long/);
  });
});

describe("cleanPhone", () => {
  it("keeps empty, strips 0 / +91 / spaces", () => {
    expect(cleanPhone("")).toBe("");
    expect(cleanPhone("09876543210")).toBe("9876543210");
    expect(cleanPhone("91 98765 43210")).toBe("9876543210");
  });
});

describe("price list", () => {
  it("starts as the data sheet prices", () => {
    expect(getRates(db)).toEqual({ 1: rs(1500), 2: rs(1200), 3: rs(400) });
  });

  it("can be changed and is read back", () => {
    updateRates(db, { 1: rs(1600), 2: rs(1200), 3: rs(450) });
    expect(getRates(db)).toEqual({ 1: rs(1600), 2: rs(1200), 3: rs(450) });
  });

  it("refuses zero, paise and prices above ₹1,00,000", () => {
    for (const bad of [0, rs(1500) + 50, rs(100001)]) {
      expect(() => updateRates(db, { 1: bad, 2: rs(1200), 3: rs(400) })).toThrow(/price/);
    }
    expect(getRates(db)).toEqual({ 1: rs(1500), 2: rs(1200), 3: rs(400) });
  });
});
