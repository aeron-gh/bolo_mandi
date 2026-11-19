// Rebuild the shared demo shop (data/demo.db) from data/seed.json. Real account shops are never touched.
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { loadSeed, openDb, readSeed } from "../lib/db.ts";
import { DEMO_FILE } from "../lib/shops.ts";

mkdirSync(path.dirname(DEMO_FILE), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) rmSync(DEMO_FILE + suffix, { force: true });

const db = openDb(DEMO_FILE);
loadSeed(db, readSeed());
console.table(db.prepare("SELECT id, name, credit_limit_paise, outstanding_paise FROM customers").all());
db.close();
