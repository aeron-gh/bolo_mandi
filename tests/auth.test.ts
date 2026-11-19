import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "../lib/db.ts";
import { createSession, endSession, ownerAllowed, sessionValid, setPin, verifyPin } from "../lib/auth.ts";
import { getShop } from "../lib/shop.ts";

const NOW = new Date("2026-11-19T06:30:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

let db: DatabaseSync;
beforeEach(() => {
  db = openDb(":memory:");
});

describe("owner PIN", () => {
  it("with no PIN set, owner actions are open", () => {
    expect(ownerAllowed(db, null, NOW)).toBe(true);
  });

  it("must be 4 to 6 digits", () => {
    for (const pin of ["123", "1234567", "12a4", ""]) expect(() => setPin(db, pin)).toThrow(/PIN/);
  });

  it("is checked: right PIN yes, wrong PIN no", () => {
    setPin(db, "2580");
    expect(verifyPin(db, "2580")).toBe(true);
    expect(verifyPin(db, "0000")).toBe(false);
    expect(getShop(db).hasPin).toBe(true);
  });

  it("can only be changed with the current PIN", () => {
    setPin(db, "2580");
    expect(() => setPin(db, "1111")).toThrow(/current/);
    expect(() => setPin(db, "1111", "0000")).toThrow(/current/);
    setPin(db, "1111", "2580");
    expect(verifyPin(db, "1111")).toBe(true);
  });

  it("is never stored as the PIN itself", () => {
    setPin(db, "2580");
    const row = db.prepare("SELECT pin_hash, pin_salt FROM shop").get() as { pin_hash: string; pin_salt: string };
    expect(row.pin_hash).not.toContain("2580");
    expect(row.pin_salt).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("sessions", () => {
  it("with a PIN set, only a valid session is allowed", () => {
    setPin(db, "2580");
    expect(ownerAllowed(db, null, NOW)).toBe(false);
    expect(ownerAllowed(db, "junk", NOW)).toBe(false);
    const token = createSession(db, NOW);
    expect(ownerAllowed(db, token, NOW)).toBe(true);
  });

  it("expire after 12 hours", () => {
    const token = createSession(db, NOW);
    expect(sessionValid(db, token, later(12 * 60 - 1))).toBe(true);
    expect(sessionValid(db, token, later(12 * 60 + 1))).toBe(false);
  });

  it("end when the owner locks, and when the PIN changes", () => {
    setPin(db, "2580");
    const first = createSession(db, NOW);
    endSession(db, first);
    expect(sessionValid(db, first, NOW)).toBe(false);
    const second = createSession(db, NOW);
    setPin(db, "1111", "2580");
    expect(sessionValid(db, second, NOW)).toBe(false);
  });
});
