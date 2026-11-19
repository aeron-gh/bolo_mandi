// Helpers for API routes and server pages: whose shop a request is for, cookies, JSON replies.
import "server-only";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { openAccounts, userForSession, type User } from "./accounts.ts";
import { loadSeed, openDb, readSeed } from "./db.ts";
import { PinRequired, tokenFromCookie } from "./shop-api.ts";
import { ACCOUNTS_FILE, cookieValue, crossSite, DEMO_FILE, shopFile } from "./shops.ts";

export const USER_COOKIE = "bolo_user";
export const DEMO_COOKIE = "bolo_demo";

export type ShopContext = { db: DatabaseSync; mode: "user" | "demo"; user: User | null; key: string };

// Thrown when no login and no demo choice came with the request. Routes answer 401.
export class LoginRequired extends Error {
  constructor() {
    super("login_required");
    this.name = "LoginRequired";
  }
}

// Open handles survive hot reload in dev, so each file is opened once.
const cache = globalThis as typeof globalThis & { boloShops?: Map<string, DatabaseSync>; boloAccounts?: DatabaseSync };

function openFile(file: string): DatabaseSync {
  mkdirSync(path.dirname(file), { recursive: true });
  return openDb(file);
}

function shopDb(file: string, seedIfEmpty: boolean): DatabaseSync {
  cache.boloShops ??= new Map();
  let db = cache.boloShops.get(file);
  if (!db) {
    db = openFile(file);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
    if (seedIfEmpty && n === 0) loadSeed(db, readSeed());
    cache.boloShops.set(file, db);
  }
  return db;
}

export function accountsDb(): DatabaseSync {
  if (!cache.boloAccounts) {
    mkdirSync(path.dirname(ACCOUNTS_FILE), { recursive: true });
    cache.boloAccounts = openAccounts(ACCOUNTS_FILE);
  }
  return cache.boloAccounts;
}

// A user's own shop: empty at first (no sample customers), prices from the data sheet.
export function userShopDb(userId: number): DatabaseSync {
  return shopDb(shopFile(userId), false);
}

// Start the demo shop again from the data sheet.
export function resetDemo(): void {
  cache.boloShops?.get(DEMO_FILE)?.close();
  cache.boloShops?.delete(DEMO_FILE);
  for (const suffix of ["", "-wal", "-shm"]) rmSync(DEMO_FILE + suffix, { force: true });
  shopDb(DEMO_FILE, true);
}

function contextFrom(read: (name: string) => string | null): ShopContext | null {
  const token = read(USER_COOKIE);
  const user = token && /^[0-9a-f]{64}$/.test(token) ? userForSession(accountsDb(), token, new Date()) : null;
  if (user) return { db: userShopDb(user.id), mode: "user", user, key: `u${user.id}` };
  if (read(DEMO_COOKIE) === "1") return { db: shopDb(DEMO_FILE, true), mode: "demo", user: null, key: "demo" };
  return null;
}

// The shop for an API request, or 401.
export function shopFor(req: Request): ShopContext {
  const header = req.headers.get("cookie");
  const context = contextFrom((name) => cookieValue(header, name));
  if (!context) throw new LoginRequired();
  return context;
}

// The shop for a server page; without a login or demo choice, go to /login.
export async function currentShop(): Promise<ShopContext> {
  const context = await signedInShop();
  if (!context) redirect("/login");
  return context;
}

export async function signedInShop(): Promise<ShopContext | null> {
  // The login check reads the clock, so it must run per request, never while prerendering.
  await connection();
  const store = await cookies();
  return contextFrom((name) => store.get(name)?.value ?? null);
}

// The owner's PIN unlock token from the request's cookies, if any.
export function ownerToken(req: Request): string | null {
  return tokenFromCookie(req.headers.get("cookie"));
}

// Cookie settings: httpOnly, same-site, secure on https only (so localhost still works).
export function cookieOptions(req: Request, maxAgeSeconds: number) {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: maxAgeSeconds, secure: new URL(req.url).protocol === "https:" };
}

// Run the work; missing login or PIN become 401, any other error a 400 with a short message.
export async function reply(work: () => unknown): Promise<Response> {
  try {
    return Response.json(await work());
  } catch (error) {
    if (error instanceof LoginRequired) return Response.json({ error: "login_required" }, { status: 401 });
    if (error instanceof PinRequired) return Response.json({ error: "pin_required" }, { status: 401 });
    const message = error instanceof Error ? error.message : "something went wrong";
    return Response.json({ error: message }, { status: 400 });
  }
}

// The address people open (APP_ORIGIN behind a proxy), for redirects.
export function appOrigin(req: Request): string {
  return process.env.APP_ORIGIN || new URL(req.url).origin;
}

type CookieJar = {
  set(name: string, value: string, options: ReturnType<typeof cookieOptions>): unknown;
  delete(name: string): unknown;
};

// Signed in: keep the login 30 days, leave demo mode, and start with owner actions locked.
export function setLoginCookies(jar: CookieJar, req: Request, token: string): void {
  jar.set(USER_COOKIE, token, cookieOptions(req, 30 * 24 * 60 * 60));
  jar.delete(DEMO_COOKIE);
  jar.delete("bolo_session");
}

export function clearLoginCookies(jar: CookieJar): void {
  for (const name of [USER_COOKIE, DEMO_COOKIE, "bolo_session"]) jar.delete(name);
}

// Login, signup, demo and logout must come from our own pages, never a form on another website.
export function blockCrossSite(req: Request): void {
  if (crossSite(req.headers, process.env.APP_ORIGIN)) throw new Error("Yeh request doosri website se aayi hai");
}
