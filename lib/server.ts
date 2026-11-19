// Helpers for API routes only: one shared database, the owner's session, JSON replies.
import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { DB_FILE, openDb, loadSeed, readSeed } from "./db.ts";
import { PinRequired, tokenFromCookie } from "./shop-api.ts";

// Survives hot reload in dev, so we never open the file twice.
const cache = globalThis as typeof globalThis & { boloDb?: DatabaseSync };

// Open the database once (upgrading its tables); load the data sheet on the very first run.
export function getDb(): DatabaseSync {
  if (!cache.boloDb) {
    const db = openDb(DB_FILE);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
    if (n === 0) loadSeed(db, readSeed());
    cache.boloDb = db;
  }
  return cache.boloDb;
}

// The owner's unlock token from the request's cookies, if any.
export function ownerToken(req: Request): string | null {
  return tokenFromCookie(req.headers.get("cookie"));
}

// Run the work; a missing PIN becomes 401, any other error a 400 with a short message.
export async function reply(work: () => unknown): Promise<Response> {
  try {
    return Response.json(await work());
  } catch (error) {
    if (error instanceof PinRequired) return Response.json({ error: "pin_required" }, { status: 401 });
    const message = error instanceof Error ? error.message : "something went wrong";
    return Response.json({ error: message }, { status: 400 });
  }
}
