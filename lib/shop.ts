// The shop's own details and price list. The owner edits these from the profile page.
import type { DatabaseSync } from "node:sqlite";
import type { Grade, RateCard } from "./billing.ts";
import { rs } from "./money.ts";

export type Shop = { shopName: string; ownerName: string; phone: string; address: string; hasPin: boolean };
export type ShopInput = { shopName: string; ownerName: string; phone: string; address: string };

const GRADES: Grade[] = [1, 2, 3];
const MAX_PRICE = rs(100000);

// Indian mobile as 10 digits; empty stays empty. Accepts spaces, dashes, 0 or +91 in front.
export function cleanPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  if (digits === "") return "";
  if (!/^[6-9]\d{9}$/.test(digits)) throw new Error("phone must be a 10-digit mobile number");
  return digits;
}

// Trim, squeeze spaces, and cap the length.
export function cleanText(raw: string, label: string, max: number): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text.length > max) throw new Error(`${label} too long (max ${max})`);
  return text;
}

type ShopRow = { shop_name: string; owner_name: string; phone: string; address: string; pin_hash: string | null };

export function getShop(db: DatabaseSync): Shop {
  const row = db.prepare("SELECT shop_name, owner_name, phone, address, pin_hash FROM shop WHERE id = 1").get() as ShopRow;
  return { shopName: row.shop_name, ownerName: row.owner_name, phone: row.phone, address: row.address, hasPin: row.pin_hash !== null };
}

export function updateShop(db: DatabaseSync, input: ShopInput): Shop {
  const shopName = cleanText(input.shopName, "shop name", 60);
  const ownerName = cleanText(input.ownerName, "owner name", 60);
  const address = cleanText(input.address, "address", 160);
  const phone = cleanPhone(input.phone);
  db.prepare("UPDATE shop SET shop_name = ?, owner_name = ?, phone = ?, address = ? WHERE id = 1").run(shopName, ownerName, phone, address);
  return getShop(db);
}

export function getRates(db: DatabaseSync): RateCard {
  const rows = db.prepare("SELECT grade, rate_paise FROM rates").all() as { grade: Grade; rate_paise: number }[];
  const rate = (grade: Grade) => {
    const row = rows.find((r) => r.grade === grade);
    if (!row) throw new Error(`no price for grade ${grade}`);
    return row.rate_paise;
  };
  return { 1: rate(1), 2: rate(2), 3: rate(3) };
}

// Whole rupees only, from ₹1 to ₹1,00,000 per piece.
export function updateRates(db: DatabaseSync, rates: RateCard): RateCard {
  for (const grade of GRADES) {
    const paise = rates[grade];
    if (!Number.isSafeInteger(paise) || paise < rs(1) || paise > MAX_PRICE || paise % 100 !== 0) {
      throw new Error(`price for grade ${grade} must be whole rupees from ₹1 to ₹1,00,000`);
    }
  }
  const save = db.prepare("UPDATE rates SET rate_paise = ? WHERE grade = ?");
  for (const grade of GRADES) save.run(rates[grade], grade);
  return getRates(db);
}
