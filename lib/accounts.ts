// Logins: users with an email + password and/or Google, and their 30-day sessions. Lives in data/accounts.db.
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { cleanText } from "./shop.ts";

export type User = { id: number; name: string; email: string };
export type GoogleProfile = { sub: string; email: string; name: string; emailVerified: boolean };

const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const WRONG = "Wrong email or password";
const MAX_TRIES = 5;
const PAUSE_MS = 5 * 60_000;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  google_sub    TEXT UNIQUE,
  created_at    TEXT NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS user_sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
) STRICT;`;

type UserRow = User & { password_hash: string | null; password_salt: string | null; google_sub: string | null };

export function openAccounts(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  if (file !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  return db;
}

function cleanEmail(raw: string): string {
  const email = raw.trim().toLowerCase();
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error("Please enter a valid email");
  return email;
}

function hashPassword(password: string, salt: string): string {
  return scryptSync(password, salt, 64).toString("hex");
}

function byEmail(db: DatabaseSync, email: string): UserRow | undefined {
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
}

const publicUser = (row: User): User => ({ id: row.id, name: row.name, email: row.email });

export function signUp(db: DatabaseSync, input: { name: string; email: string; password: string }, now: Date): User {
  const name = cleanText(input.name, "name", 60);
  if (!name) throw new Error("Please enter your name");
  const email = cleanEmail(input.email);
  if (input.password.length < 8) throw new Error("Password must be at least 8 characters");
  if (input.password.length > 200) throw new Error("password too long");
  if (byEmail(db, email)) throw new Error("An account with this email already exists");
  const salt = randomBytes(16).toString("hex");
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (email, name, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(email, name, hashPassword(input.password, salt), salt, now.toISOString());
  return { id: Number(lastInsertRowid), name, email };
}

// Wrong tries per email, per accounts database: 5 wrong → 5-minute pause.
const tries = new WeakMap<DatabaseSync, Map<string, { count: number; until: number }>>();

function triesFor(db: DatabaseSync): Map<string, { count: number; until: number }> {
  if (!tries.has(db)) tries.set(db, new Map());
  return tries.get(db)!;
}

// The same message for a wrong email and a wrong password, so nobody can test which emails exist.
export function logIn(db: DatabaseSync, input: { email: string; password: string }, now: Date): User {
  const email = input.email.trim().toLowerCase();
  const state = triesFor(db).get(email) ?? { count: 0, until: 0 };
  if (now.getTime() < state.until) throw new Error("Too many wrong tries. Try again in 5 minutes.");
  const row = byEmail(db, email);
  const given = hashPassword(input.password, row?.password_salt ?? "0".repeat(32));
  const ok = Boolean(row?.password_hash) && timingSafeEqual(Buffer.from(given, "hex"), Buffer.from(row!.password_hash!, "hex"));
  if (!ok) {
    const count = state.count + 1;
    triesFor(db).set(email, count >= MAX_TRIES ? { count: 0, until: now.getTime() + PAUSE_MS } : { count, until: 0 });
    throw new Error(WRONG);
  }
  triesFor(db).delete(email);
  return publicUser(row!);
}

export function createUserSession(db: DatabaseSync, userId: number, now: Date): string {
  const token = randomBytes(32).toString("hex");
  db.prepare("DELETE FROM user_sessions WHERE expires_at <= ?").run(now.toISOString());
  db.prepare("INSERT INTO user_sessions (token, user_id, expires_at) VALUES (?, ?, ?)")
    .run(token, userId, new Date(now.getTime() + SESSION_MS).toISOString());
  return token;
}

export function userForSession(db: DatabaseSync, token: string | null, now: Date): User | null {
  if (!token) return null;
  const row = db
    .prepare("SELECT u.id, u.name, u.email FROM user_sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?")
    .get(token, now.toISOString()) as User | undefined;
  return row ? publicUser(row) : null;
}

export function endUserSession(db: DatabaseSync, token: string | null): void {
  if (token) db.prepare("DELETE FROM user_sessions WHERE token = ?").run(token);
}

// Google sign-in: same Google account → same user; a same-email password account is joined.
export function googleUser(db: DatabaseSync, profile: GoogleProfile, now: Date): User {
  if (!profile.emailVerified) throw new Error("This Google email is not verified");
  const email = cleanEmail(profile.email);
  const known = db.prepare("SELECT * FROM users WHERE google_sub = ?").get(profile.sub) as UserRow | undefined;
  if (known) return publicUser(known);
  const sameEmail = byEmail(db, email);
  if (sameEmail) {
    db.prepare("UPDATE users SET google_sub = ? WHERE id = ?").run(profile.sub, sameEmail.id);
    return publicUser(sameEmail);
  }
  const name = cleanText(profile.name, "name", 60) || email.split("@")[0];
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (email, name, google_sub, created_at) VALUES (?, ?, ?, ?)")
    .run(email, name, profile.sub, now.toISOString());
  return { id: Number(lastInsertRowid), name, email };
}
