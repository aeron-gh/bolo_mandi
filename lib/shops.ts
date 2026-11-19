// Where data lives: one SQLite file per account, the shared demo shop, and the logins.
// Set BOLO_DATA_DIR to the server's persistent disk; it defaults to ./data.
import path from "node:path";

export const DATA_DIR = process.env.BOLO_DATA_DIR || path.join(process.cwd(), "data");
export const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.db");
export const DEMO_FILE = path.join(DATA_DIR, "demo.db");

// Only a positive whole user id can name a file, so a request can never point at another path.
export function shopFile(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error(`bad user id: ${userId}`);
  return path.join(DATA_DIR, "shops", `${userId}.db`);
}

// A cookie's value from a Cookie header, or null.
export function cookieValue(header: string | null, name: string): string | null {
  for (const part of (header ?? "").split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

// True when a browser sent this request from another website (blocks "log in as me" tricks).
// Sec-Fetch-Site is the browser's own answer; Origin is the fallback for older browsers.
export function crossSite(headers: Headers, appOrigin?: string): boolean {
  const site = headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = headers.get("origin");
  if (!origin) return false;
  const ours = appOrigin ? new URL(appOrigin).host : headers.get("x-forwarded-host") ?? headers.get("host");
  try {
    return new URL(origin).host !== ours;
  } catch {
    return true;
  }
}
