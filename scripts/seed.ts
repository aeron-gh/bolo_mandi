// Build a fresh data/bolo.db from data/seed.json.
import { rmSync } from "node:fs";
import { DB_FILE, openDb, readSeed, loadSeed } from "../lib/db.ts";

for (const suffix of ["", "-wal", "-shm"]) rmSync(DB_FILE + suffix, { force: true });

const db = openDb(DB_FILE);
loadSeed(db, readSeed());
console.table(db.prepare("SELECT id, name, credit_limit_paise, outstanding_paise FROM customers").all());
db.close();
