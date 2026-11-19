// Owner PIN. Stored only as a salted scrypt hash; unlocking gives a 12-hour session token.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const SESSION_MS = 12 * 60 * 60 * 1000;

type PinRow = { pin_hash: string | null; pin_salt: string | null };

function pinRow(db: DatabaseSync): PinRow {
  return db.prepare("SELECT pin_hash, pin_salt FROM shop WHERE id = 1").get() as PinRow;
}

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 32).toString("hex");
}

// True only for the stored PIN. Compared in constant time so timing gives nothing away.
export function verifyPin(db: DatabaseSync, pin: string): boolean {
  const row = pinRow(db);
  if (!row.pin_hash || !row.pin_salt) return false;
  const given = Buffer.from(hashPin(pin, row.pin_salt), "hex");
  return timingSafeEqual(given, Buffer.from(row.pin_hash, "hex"));
}

// Set the first PIN, or change it with the current one. Every open session is locked again.
export function setPin(db: DatabaseSync, pin: string, currentPin?: string): void {
  if (!/^\d{4,6}$/.test(pin)) throw new Error("PIN must be 4 to 6 digits");
  if (pinRow(db).pin_hash && !(currentPin && verifyPin(db, currentPin))) throw new Error("current PIN is wrong");
  const salt = randomBytes(16).toString("hex");
  db.prepare("UPDATE shop SET pin_hash = ?, pin_salt = ? WHERE id = 1").run(hashPin(pin, salt), salt);
  db.exec("DELETE FROM sessions");
}

// A new unlock token, valid for 12 hours. Old expired tokens are cleaned up on the way.
export function createSession(db: DatabaseSync, now: Date): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(now.toISOString());
  db.prepare("INSERT INTO sessions (token, expires_at) VALUES (?, ?)").run(token, new Date(now.getTime() + SESSION_MS).toISOString());
  return token;
}

export function sessionValid(db: DatabaseSync, token: string | null, now: Date): boolean {
  if (!token) return false;
  const row = db.prepare("SELECT expires_at FROM sessions WHERE token = ?").get(token) as { expires_at: string } | undefined;
  return Boolean(row && row.expires_at > now.toISOString());
}

export function endSession(db: DatabaseSync, token: string | null): void {
  if (token) db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

// Owner-only actions: open while no PIN exists, otherwise need a live session.
export function ownerAllowed(db: DatabaseSync, token: string | null, now: Date): boolean {
  return !pinRow(db).pin_hash || sessionValid(db, token, now);
}
