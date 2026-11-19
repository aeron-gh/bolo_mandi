// Numbered, one-way table upgrades. Each runs once, inside a transaction, and never drops shop data.
// PRAGMA user_version remembers how many have run.
import type { DatabaseSync } from "node:sqlite";
import { inTransaction, ratesFromSeed, readSeed } from "./db.ts";

const MIGRATIONS: ((db: DatabaseSync) => void)[] = [
  // 1: the shop's own details, always exactly one row.
  (db) => db.exec(`
    CREATE TABLE shop (
      id         INTEGER PRIMARY KEY CHECK (id = 1),
      shop_name  TEXT NOT NULL DEFAULT '',
      owner_name TEXT NOT NULL DEFAULT '',
      phone      TEXT NOT NULL DEFAULT '',
      address    TEXT NOT NULL DEFAULT '',
      pin_hash   TEXT,
      pin_salt   TEXT
    ) STRICT;
    INSERT INTO shop (id) VALUES (1);`),

  // 2: price per grade, starting from the data sheet.
  (db) => {
    db.exec("CREATE TABLE rates (grade INTEGER PRIMARY KEY CHECK (grade IN (1, 2, 3)), rate_paise INTEGER NOT NULL CHECK (rate_paise > 0)) STRICT;");
    const seed = ratesFromSeed(readSeed());
    const add = db.prepare("INSERT INTO rates (grade, rate_paise) VALUES (?, ?)");
    for (const grade of [1, 2, 3] as const) add.run(grade, seed[grade]);
  },

  // 3: khata allows adjustment lines with a note. SQLite needs a rebuild to change a CHECK rule.
  (db) => db.exec(`
    CREATE TABLE ledger_entries_new (
      id                  INTEGER PRIMARY KEY,
      customer_id         INTEGER NOT NULL REFERENCES customers(id),
      bill_id             INTEGER REFERENCES bills(id),
      draft_id            TEXT    UNIQUE,
      kind                TEXT    NOT NULL CHECK (kind IN ('opening', 'bill', 'payment', 'adjustment')),
      mode                TEXT    CHECK (mode IN ('cash', 'upi')),
      amount_paise        INTEGER NOT NULL,
      balance_after_paise INTEGER NOT NULL,
      note                TEXT,
      created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
    ) STRICT;
    INSERT INTO ledger_entries_new (id, customer_id, bill_id, draft_id, kind, mode, amount_paise, balance_after_paise, created_at)
      SELECT id, customer_id, bill_id, draft_id, kind, mode, amount_paise, balance_after_paise, created_at FROM ledger_entries;
    DROP TABLE ledger_entries;
    ALTER TABLE ledger_entries_new RENAME TO ledger_entries;`),

  // 4: PIN unlock sessions.
  (db) => db.exec("CREATE TABLE sessions (token TEXT PRIMARY KEY, expires_at TEXT NOT NULL) STRICT;"),

  // 5: fast history by day and khata by customer.
  (db) => db.exec(`
    CREATE INDEX bills_by_time ON bills (created_at);
    CREATE INDEX bills_by_customer ON bills (customer_id, id);
    CREATE INDEX ledger_by_customer ON ledger_entries (customer_id, id);
    CREATE INDEX promises_by_customer ON promises (customer_id, status);`),
];

export const SCHEMA_VERSION = MIGRATIONS.length;

function currentVersion(db: DatabaseSync): number {
  return (db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version;
}

// Run every migration the database has not seen yet; returns the new version.
export function migrate(db: DatabaseSync): number {
  for (let version = currentVersion(db); version < MIGRATIONS.length; version++) {
    inTransaction(db, () => {
      MIGRATIONS[version](db);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return currentVersion(db);
}
