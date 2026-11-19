// Turns raw request bodies into checked calls to the business functions.
// Routes stay thin; everything here is unit tested.
import type { DatabaseSync } from "node:sqlite";
import {
  calculateBill, splitPayment, checkCreditLimit, saveBill,
  type BillLine, type CreditStatus, type Grade, type ItemInput, type RateCard, type SaveResult,
} from "./billing.ts";
import { addCustomer, findCustomer, getAccount, loadCustomers, type Account, type Customer, type CustomerMatch } from "./customers.ts";
import { getKhata, type Khata } from "./ledger.ts";
import { formatRupees } from "./money.ts";
import { readBackText } from "./readback.ts";
import { spokenName } from "./spoken-name.ts";
import { interpretVoice, type BillEntries, type VoiceTurn } from "./voice.ts";

type BillRequest = { customerId: number; items: ItemInput[]; cash: number; upi: number };

export type BillPreview = {
  customer: Account;
  lines: BillLine[];
  total: number;
  cash: number;
  upi: number;
  udhaar: number;
  newOutstanding: number;
  creditLeft: number;
  credit: CreditStatus;
  overBy: number;
  overpaidBy: number;
  say: string;
};

type Body = Record<string, unknown>;

function asBody(body: unknown): Body {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new Error("body must be a JSON object");
  return body as Body;
}

function asItem(raw: unknown): ItemInput {
  const it = asBody(raw);
  if (it.grade !== 1 && it.grade !== 2 && it.grade !== 3) throw new Error(`bad grade: ${it.grade}`);
  if (it.unit !== undefined && it.unit !== "piece" && it.unit !== "crate") throw new Error(`bad unit: ${it.unit}`);
  const item: ItemInput = { grade: it.grade as Grade, qty: it.qty as number };
  if (it.rate !== undefined) item.rate = it.rate as number;
  if (it.unit !== undefined) item.unit = it.unit;
  return item;
}

// Shape checks only; amounts are checked again by the billing functions.
function parseBill(raw: unknown): BillRequest {
  const b = asBody(raw);
  if (!Number.isSafeInteger(b.customerId)) throw new Error("customerId must be a whole number");
  if (!Array.isArray(b.items)) throw new Error("items must be a list");
  return {
    customerId: b.customerId as number,
    items: b.items.map(asItem),
    cash: (b.cash as number | undefined) ?? 0,
    upi: (b.upi as number | undefined) ?? 0,
  };
}

// Prices, payment split, credit check and the sentence to say. Saves nothing.
export function previewBill(db: DatabaseSync, rates: RateCard, body: unknown): BillPreview {
  const req = parseBill(body);
  const customer = getAccount(db, req.customerId);
  const bill = calculateBill(req.items, rates);
  const split = splitPayment(bill.total, req.cash, req.upi);
  const udhaar = split.ok ? split.udhaar : 0;
  const overpaidBy = split.ok ? 0 : split.extra;
  const credit = checkCreditLimit(customer.outstanding, udhaar, customer.creditLimit);
  const numbers = {
    total: bill.total, cash: req.cash, upi: req.upi, udhaar,
    newOutstanding: credit.newOutstanding, credit: credit.status, overBy: credit.overBy,
  };
  let say = "";
  if (overpaidBy > 0) say = `${formatRupees(overpaidBy)} zyada mila hai. Wapas dena hai ya advance rakhna hai?`;
  else if (req.items.length > 0) say = readBackText({ customerName: customer.name, ...numbers });
  return { customer, lines: bill.lines, ...numbers, creditLeft: credit.creditLeft, overpaidBy, say };
}

// The trader said yes: save once per draftId.
export function confirmBill(db: DatabaseSync, rates: RateCard, body: unknown): SaveResult {
  const b = asBody(body);
  if (typeof b.draftId !== "string" || !b.draftId) throw new Error("draftId is required");
  const req = parseBill(b);
  return saveBill(db, { ...req, draftId: b.draftId, allowOverLimit: b.allowOverLimit === true }, rates);
}

export function searchCustomers(db: DatabaseSync, q: string | null): CustomerMatch {
  return findCustomer(q ?? "", loadCustomers(db));
}

export type VoiceBillResult = VoiceTurn & { match?: CustomerMatch };

// Interpret and look up a name in one request. The voice endpoint never writes.
export function voiceBill(db: DatabaseSync, rates: RateCard, body: unknown): VoiceBillResult {
  const raw = asBody(body);
  if (typeof raw.words !== "string" || raw.words.length > 2000) throw new Error("unclear voice input");
  const { items, cash, upi }: BillEntries = parseBill({ ...raw, customerId: 0 });
  const turn = interpretVoice(raw.words, { items, cash, upi }, rates, raw.needsCustomer === true);
  if (turn.kind !== "edit" || !turn.name) return turn;
  const name = spokenName(turn.name);
  return { ...turn, name, match: searchCustomers(db, name) };
}

// Only called after the trader said "haan, add karo".
export function createCustomer(db: DatabaseSync, body: unknown): Customer {
  const b = asBody(body);
  if (typeof b.name !== "string") throw new Error("name is required");
  return addCustomer(db, b.name);
}

export function readKhata(db: DatabaseSync, id: string): Khata {
  if (!/^\d+$/.test(id)) throw new Error(`bad id: ${id}`);
  return getKhata(db, Number(id));
}
