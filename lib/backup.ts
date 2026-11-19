// Backups of a shop's database: one per India day, the newest 14 kept, plus an owner download.
import { existsSync, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { backup, type DatabaseSync } from "node:sqlite";
import { indiaDay } from "./history.ts";

const DAILY = /^\d{4}-\d{2}-\d{2}\.db$/;

// Copy the live database to a file. Written to a temp name, then renamed, so a half copy never looks finished.
export async function backupTo(db: DatabaseSync, file: string): Promise<void> {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.partial`;
  rmSync(temp, { force: true });
  await backup(db, temp);
  renameSync(temp, file);
}

// Today's backup if there is none yet; returns its path, or null when it already exists.
export async function dailyBackup(db: DatabaseSync, dir: string, now: Date): Promise<string | null> {
  const file = path.join(dir, `${indiaDay(now)}.db`);
  if (existsSync(file)) return null;
  await backupTo(db, file);
  pruneBackups(dir, 14);
  return file;
}

// Delete all but the newest dated backups; other files are left alone. Returns what was deleted.
export function pruneBackups(dir: string, keep: number): string[] {
  const old = readdirSync(dir).filter((name) => DAILY.test(name)).sort().slice(0, -keep);
  for (const name of old) rmSync(path.join(dir, name), { force: true });
  return old;
}
