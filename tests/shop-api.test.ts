import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { loadSeed, openDb, readSeed } from "../lib/db.ts";
import { rs } from "../lib/money.ts";
import { ownerAllowed } from "../lib/auth.ts";
import { getRates } from "../lib/shop.ts";
import { previewBill } from "../lib/api.ts";
import { changePin, lock, PinRequired, readShop, savePrices, saveShop, tokenFromCookie, unlock } from "../lib/shop-api.ts";

const NOW = new Date("2026-11-19T06:30:00Z");
const after = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const SHOP = { shopName: "Ram Fruit Co", ownerName: "Ram Lal", phone: "9876543210", address: "APMC Yard" };

let db: DatabaseSync;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("tokenFromCookie", () => {
  it("finds the session among other cookies, and ignores junk", () => {
    const token = "a".repeat(64);
    expect(tokenFromCookie(`theme=dark; bolo_session=${token}; x=1`)).toBe(token);
    expect(tokenFromCookie("bolo_session=short")).toBeNull();
    expect(tokenFromCookie(null)).toBeNull();
  });
});

describe("profile API", () => {
  it("saves shop details freely until a PIN exists", () => {
    expect(saveShop(db, null, NOW, SHOP)).toMatchObject({ ...SHOP, hasPin: false });
    expect(readShop(db).ownerName).toBe("Ram Lal");
  });

  it("with a PIN, changes need an unlocked session", () => {
    changePin(db, null, NOW, { pin: "2580" });
    expect(() => saveShop(db, null, NOW, SHOP)).toThrow(PinRequired);
    expect(() => savePrices(db, null, NOW, { 1: rs(1600), 2: rs(1200), 3: rs(400) })).toThrow(PinRequired);
    const token = unlock(db, NOW, { pin: "2580" });
    expect(saveShop(db, token, NOW, SHOP)).toMatchObject({ shopName: "Ram Fruit Co", hasPin: true });
  });

  it("new prices are used by the very next bill preview", () => {
    loadSeed(db, readSeed());
    savePrices(db, null, NOW, { 1: rs(1600), 2: rs(1200), 3: rs(400) });
    const p = previewBill(db, getRates(db), { customerId: 1, items: [{ grade: 1, qty: 10 }] });
    expect(p.total).toBe(rs(16000));
  });

  it("refuses prices that are not numbers", () => {
    expect(() => savePrices(db, null, NOW, { 1: "1600", 2: rs(1200), 3: rs(400) })).toThrow(/price/);
  });

  it("changing the PIN needs the current PIN", () => {
    changePin(db, null, NOW, { pin: "2580" });
    const token = unlock(db, NOW, { pin: "2580" });
    expect(() => changePin(db, token, NOW, { pin: "1111", currentPin: "0000" })).toThrow(/current/);
    changePin(db, token, NOW, { pin: "1111", currentPin: "2580" });
    expect(() => unlock(db, NOW, { pin: "2580" })).toThrow(/galat/i);
  });
});

describe("unlock and lock", () => {
  beforeEach(() => {
    changePin(db, null, NOW, { pin: "2580" });
  });

  it("gives a working session for the right PIN only", () => {
    expect(() => unlock(db, NOW, { pin: "0000" })).toThrow(/galat/i);
    const token = unlock(db, NOW, { pin: "2580" });
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(ownerAllowed(db, token, NOW)).toBe(true);
    lock(db, token);
    expect(ownerAllowed(db, token, NOW)).toBe(false);
  });

  it("pauses for 5 minutes after 5 wrong tries, even for the right PIN", () => {
    for (let i = 0; i < 5; i++) expect(() => unlock(db, NOW, { pin: "0000" })).toThrow(/galat/i);
    expect(() => unlock(db, after(1), { pin: "2580" })).toThrow(/5 minute/);
    expect(unlock(db, after(6), { pin: "2580" })).toMatch(/^[0-9a-f]{64}$/);
  });
});
