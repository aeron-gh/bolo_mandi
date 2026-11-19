// Request checks for the profile page: shop details, prices, PIN, unlock and lock.
import type { DatabaseSync } from "node:sqlite";
import { asBody } from "./api.ts";
import { createSession, endSession, ownerAllowed, setPin, verifyPin } from "./auth.ts";
import type { RateCard } from "./billing.ts";
import { getShop, updateRates, updateShop, type Shop } from "./shop.ts";

export const SESSION_COOKIE = "bolo_session";
const MAX_TRIES = 5;
const PAUSE_MS = 5 * 60_000;

// Thrown when an owner-only action arrives without an unlocked session. Routes answer 401.
export class PinRequired extends Error {
  constructor() {
    super("PIN chahiye");
    this.name = "PinRequired";
  }
}

// The session token from a Cookie header, or null. Only 64 hex letters count.
export function tokenFromCookie(header: string | null): string | null {
  const match = header?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([0-9a-f]{64})(?:;|$)`));
  return match ? match[1] : null;
}

export function assertOwner(db: DatabaseSync, token: string | null, now: Date): void {
  if (!ownerAllowed(db, token, now)) throw new PinRequired();
}

function text(b: Record<string, unknown>, key: string): string {
  const value = b[key] ?? "";
  if (typeof value !== "string") throw new Error(`${key} must be text`);
  return value;
}

export function readShop(db: DatabaseSync): Shop {
  return getShop(db);
}

export function saveShop(db: DatabaseSync, token: string | null, now: Date, body: unknown): Shop {
  assertOwner(db, token, now);
  const b = asBody(body);
  return updateShop(db, { shopName: text(b, "shopName"), ownerName: text(b, "ownerName"), phone: text(b, "phone"), address: text(b, "address") });
}

export function savePrices(db: DatabaseSync, token: string | null, now: Date, body: unknown): RateCard {
  assertOwner(db, token, now);
  const b = asBody(body);
  const price = (grade: 1 | 2 | 3) => {
    const value = b[grade];
    if (typeof value !== "number") throw new Error(`price for grade ${grade} must be a number`);
    return value;
  };
  return updateRates(db, { 1: price(1), 2: price(2), 3: price(3) });
}

// First PIN needs nothing; changing it needs an unlocked session and the current PIN.
export function changePin(db: DatabaseSync, token: string | null, now: Date, body: unknown): { hasPin: true } {
  const b = asBody(body);
  if (getShop(db).hasPin) assertOwner(db, token, now);
  setPin(db, text(b, "pin"), b.currentPin === undefined ? undefined : text(b, "currentPin"));
  return { hasPin: true };
}

// Wrong tries per database: after 5, unlocking pauses for 5 minutes.
const tries = new WeakMap<DatabaseSync, { count: number; until: number }>();

export function unlock(db: DatabaseSync, now: Date, body: unknown): string {
  const state = tries.get(db) ?? { count: 0, until: 0 };
  if (now.getTime() < state.until) throw new Error("Bahut galat koshish. 5 minute baad try karein.");
  if (!verifyPin(db, text(asBody(body), "pin"))) {
    const count = state.count + 1;
    tries.set(db, count >= MAX_TRIES ? { count: 0, until: now.getTime() + PAUSE_MS } : { count, until: 0 });
    throw new Error("Galat PIN");
  }
  tries.delete(db);
  return createSession(db, now);
}

export function lock(db: DatabaseSync, token: string | null): void {
  endSession(db, token);
}
