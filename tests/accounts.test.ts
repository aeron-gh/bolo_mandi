import { describe, it, expect, beforeEach } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { createUserSession, endUserSession, googleUser, logIn, openAccounts, signUp, userForSession } from "../lib/accounts.ts";

const NOW = new Date("2026-11-19T06:30:00Z");
const later = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
const RAM = { name: "Ram Lal", email: " Ram@Example.com ", password: "mandi-1234" };
const WRONG = "Wrong email or password";

let db: DatabaseSync;
beforeEach(() => {
  db = openAccounts(":memory:");
});

describe("sign up", () => {
  it("cleans the email and never stores the password itself", () => {
    expect(signUp(db, RAM, NOW)).toEqual({ id: 1, name: "Ram Lal", email: "ram@example.com" });
    const row = db.prepare("SELECT password_hash FROM users").get() as { password_hash: string };
    expect(row.password_hash).not.toContain("mandi-1234");
  });

  it("refuses a bad email, a short password, an empty name and a used email", () => {
    expect(() => signUp(db, { ...RAM, email: "ram@" }, NOW)).toThrow(/email/i);
    expect(() => signUp(db, { ...RAM, password: "short" }, NOW)).toThrow(/8/);
    expect(() => signUp(db, { ...RAM, name: "   " }, NOW)).toThrow(/name/i);
    signUp(db, RAM, NOW);
    expect(() => signUp(db, { ...RAM, email: "RAM@example.com" }, NOW)).toThrow(/already/i);
  });
});

describe("log in", () => {
  it("works with the right password; wrong email and wrong password get the same message", () => {
    signUp(db, RAM, NOW);
    expect(logIn(db, { email: "ram@example.com", password: "mandi-1234" }, NOW)).toMatchObject({ email: "ram@example.com" });
    expect(() => logIn(db, { email: "ram@example.com", password: "nope-nope" }, NOW)).toThrow(WRONG);
    expect(() => logIn(db, { email: "nobody@example.com", password: "mandi-1234" }, NOW)).toThrow(WRONG);
  });

  it("pauses an email for 5 minutes after 5 wrong tries", () => {
    signUp(db, RAM, NOW);
    for (let i = 0; i < 5; i++) expect(() => logIn(db, { email: RAM.email, password: "wrong-pass" }, NOW)).toThrow(WRONG);
    expect(() => logIn(db, { email: RAM.email, password: RAM.password }, later(1))).toThrow(/5 minutes/);
    expect(logIn(db, { email: RAM.email, password: RAM.password }, later(6))).toMatchObject({ name: "Ram Lal" });
  });

  it("a Google-only account has no password to log in with", () => {
    googleUser(db, { sub: "g-1", email: "sita@gmail.com", name: "Sita", emailVerified: true }, NOW);
    expect(() => logIn(db, { email: "sita@gmail.com", password: "anything-1" }, NOW)).toThrow(WRONG);
  });
});

describe("login sessions", () => {
  it("last 30 days and end on logout", () => {
    const user = signUp(db, RAM, NOW);
    const token = createUserSession(db, user.id, NOW);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(userForSession(db, token, later(30 * 24 * 60 - 1))).toEqual(user);
    expect(userForSession(db, token, later(30 * 24 * 60 + 1))).toBeNull();
    const second = createUserSession(db, user.id, NOW);
    endUserSession(db, second);
    expect(userForSession(db, second, NOW)).toBeNull();
    expect(userForSession(db, null, NOW)).toBeNull();
  });
});

describe("Google users", () => {
  const SITA = { sub: "g-1", email: "Sita@Gmail.com", name: "Sita", emailVerified: true };

  it("are created once and found again", () => {
    const first = googleUser(db, SITA, NOW);
    expect(googleUser(db, SITA, later(10))).toEqual(first);
    expect((db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n).toBe(1);
  });

  it("join a password account with the same verified email", () => {
    const ram = signUp(db, RAM, NOW);
    expect(googleUser(db, { sub: "g-2", email: "ram@example.com", name: "Ram G", emailVerified: true }, NOW).id).toBe(ram.id);
    expect(logIn(db, { email: RAM.email, password: RAM.password }, NOW).id).toBe(ram.id);
  });

  it("are refused when Google has not verified the email", () => {
    expect(() => googleUser(db, { ...SITA, emailVerified: false }, NOW)).toThrow(/verified/);
  });
});
