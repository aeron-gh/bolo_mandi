// Helpers for API routes only: one shared database, the price list, JSON replies.
import "server-only";
import type { DatabaseSync } from "node:sqlite";
import { DB_FILE, openDb, loadSeed, readSeed, ratesFromSeed } from "./db.ts";

// Survives hot reload in dev, so we never open the file twice.
const cache = globalThis as typeof globalThis & { boloDb?: DatabaseSync };

// Open the database once; load the data sheet on the very first run.
export function getDb(): DatabaseSync {
  if (!cache.boloDb) {
    const db = openDb(DB_FILE);
    const { n } = db.prepare("SELECT COUNT(*) AS n FROM customers").get() as { n: number };
    if (n === 0) loadSeed(db, readSeed());
    cache.boloDb = db;
  }
  return cache.boloDb;
}

export const RATES = ratesFromSeed(readSeed());

// Run the work; any error becomes a 400 with a short message.
export async function reply(work: () => unknown): Promise<Response> {
  try {
    return Response.json(await work());
  } catch (error) {
    const message = error instanceof Error ? error.message : "something went wrong";
    return Response.json({ error: message }, { status: 400 });
  }
}
