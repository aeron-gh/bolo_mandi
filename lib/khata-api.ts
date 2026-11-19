// Request checks for the khata pages: edit a customer, vasooli, promises and adjustments.
import type { DatabaseSync } from "node:sqlite";
import { asBody } from "./api.ts";
import { addCustomer, checkLimit, getAccount, updateCustomer, type Account, type Customer } from "./customers.ts";
import { recordAdjustment, recordPayment, recordPromise, setPromiseStatus, type AdjustmentResult, type PaymentResult, type PromiseResult } from "./ledger.ts";
import { cleanPhone } from "./shop.ts";
import { assertOwner, textField } from "./shop-api.ts";

type Body = Record<string, unknown>;

function wholeId(raw: string): number {
  if (!/^\d+$/.test(raw)) throw new Error(`bad id: ${raw}`);
  return Number(raw);
}

// Every write a double tap could repeat carries a 32-letter draft id from the browser.
function draftId(b: Body): string {
  const value = b.draftId;
  if (typeof value !== "string" || !/^[0-9a-f]{32}$/.test(value)) throw new Error("bad draft id");
  return value;
}

function customerId(b: Body): number {
  const value = b.customerId;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error("bad customer id");
  return value;
}

function paise(b: Body, key: string): number {
  const value = b[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) throw new Error(`${key} must be whole paise`);
  return value;
}

function optionalLimit(b: Body): number | undefined {
  if (b.creditLimit === undefined) return undefined;
  if (typeof b.creditLimit !== "number") throw new Error("credit limit must be a number");
  return b.creditLimit;
}

const optionalText = (b: Body, key: string) => (b[key] === undefined ? undefined : textField(b, key));

// Name and phone are everyday fixes; changing the credit limit needs the owner.
export function saveCustomer(db: DatabaseSync, token: string | null, now: Date, id: string, body: unknown): Account {
  const b = asBody(body);
  const cid = wholeId(id);
  const limit = optionalLimit(b);
  if (limit !== undefined && limit !== getAccount(db, cid).creditLimit) assertOwner(db, token, now);
  return updateCustomer(db, cid, { name: optionalText(b, "name"), phone: optionalText(b, "phone"), creditLimit: limit });
}

// A new customer starts at ₹0 limit; a bigger limit needs the owner. Everything is checked before saving.
export function newCustomer(db: DatabaseSync, token: string | null, now: Date, body: unknown): Customer {
  const b = asBody(body);
  const limit = checkLimit(optionalLimit(b) ?? 0);
  const phone = cleanPhone(optionalText(b, "phone") ?? "");
  if (limit > 0) assertOwner(db, token, now);
  const customer = addCustomer(db, textField(b, "name"), limit);
  if (phone) db.prepare("UPDATE customers SET phone = ? WHERE id = ?").run(phone, customer.id);
  return customer;
}

export function addPayment(db: DatabaseSync, body: unknown): PaymentResult {
  const b = asBody(body);
  const mode = b.mode ?? null;
  if (mode !== null && mode !== "cash" && mode !== "upi") throw new Error("mode must be cash, upi or not said");
  return recordPayment(db, {
    draftId: draftId(b), customerId: customerId(b), amount: paise(b, "amount"),
    mode: mode ?? undefined, allowAdvance: b.allowAdvance === true,
  });
}

export function addPromise(db: DatabaseSync, body: unknown, now: Date): PromiseResult {
  const b = asBody(body);
  return recordPromise(db, { draftId: draftId(b), customerId: customerId(b), amount: paise(b, "amount"), due: textField(b, "due"), now });
}

export function markPromise(db: DatabaseSync, id: string, body: unknown): { id: number; status: "kept" | "broken" } {
  const status = asBody(body).status;
  if (status !== "kept" && status !== "broken") throw new Error("status must be kept or broken");
  return setPromiseStatus(db, wholeId(id), status);
}

// Adjustments change what someone owes, so only the owner may add them.
export function addAdjustment(db: DatabaseSync, token: string | null, now: Date, body: unknown): AdjustmentResult {
  assertOwner(db, token, now);
  const b = asBody(body);
  return recordAdjustment(db, { draftId: draftId(b), customerId: customerId(b), amount: paise(b, "amount"), note: textField(b, "note") });
}
