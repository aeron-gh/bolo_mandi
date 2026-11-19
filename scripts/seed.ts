// Build a fresh data/bolo.db from data/seed.json.
import { rmSync } from "node:fs";
import path from "node:path";
import { openDb, readSeed, loadSeed } from "../lib/db.ts";

const file = path.join(process.cwd(), "data", "bolo.db");
for (const suffix of ["", "-wal", "-shm"]) rmSync(file + suffix, { force: true });

const db = openDb(file);
loadSeed(db, readSeed());
console.table(db.prepare("SELECT id, name, credit_limit_paise, outstanding_paise FROM customers").all());
db.close();
