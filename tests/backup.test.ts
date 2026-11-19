import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { backupTo, dailyBackup, pruneBackups } from "../lib/backup.ts";
import { saveBill } from "../lib/billing.ts";
import { loadSeed, openDb, ratesFromSeed, readSeed } from "../lib/db.ts";

const seed = readSeed();
let db: DatabaseSync;
let dir: string;
const count = (d: DatabaseSync, table: string) => (d.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, seed);
  saveBill(db, { draftId: "a".repeat(32), customerId: 1, items: [{ grade: 1, qty: 10 }] }, ratesFromSeed(seed));
  dir = mkdtempSync(path.join(tmpdir(), "bolo-backup-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("backups", () => {
  it("a backup file opens with the same customers, bills and khata lines", async () => {
    const file = path.join(dir, "copy.db");
    await backupTo(db, file);
    const copy = new DatabaseSync(file, { readOnly: true });
    for (const table of ["customers", "bills", "bill_items", "ledger_entries"]) expect(count(copy, table)).toBe(count(db, table));
    copy.close();
    expect(readdirSync(dir)).toEqual(["copy.db"]);
  });

  it("the daily backup is made once per India day", async () => {
    const evening = new Date("2026-11-19T17:00:00Z"); // 22:30 in India, 19 Nov
    expect(await dailyBackup(db, dir, evening)).toBe(path.join(dir, "2026-11-19.db"));
    expect(await dailyBackup(db, dir, new Date("2026-11-19T18:00:00Z"))).toBeNull();
    expect(await dailyBackup(db, dir, new Date("2026-11-19T18:45:00Z"))).toBe(path.join(dir, "2026-11-20.db"));
    expect(readdirSync(dir).sort()).toEqual(["2026-11-19.db", "2026-11-20.db"]);
  });

  it("pruning keeps the newest 14 and leaves other files alone", () => {
    for (let day = 1; day <= 16; day++) writeFileSync(path.join(dir, `2026-11-${String(day).padStart(2, "0")}.db`), "x");
    writeFileSync(path.join(dir, "notes.txt"), "keep me");
    expect(pruneBackups(dir, 14)).toEqual(["2026-11-01.db", "2026-11-02.db"]);
    const left = readdirSync(dir).sort();
    expect(left).toHaveLength(15);
    expect(left[0]).toBe("2026-11-03.db");
    expect(left).toContain("notes.txt");
  });
});
