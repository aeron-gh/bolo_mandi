// Turns raw request bodies into checked calls to the business functions.
// Routes stay thin; everything here is unit tested.
import type { DatabaseSync } from "node:sqlite";
import {
  calculateBill, splitPayment, checkCreditLimit, saveBill,
  type BillLine, type CreditStatus, type Grade, type ItemInput, type RateCard, type SaveResult,
} from "./billing.ts";
import { addCustomer, findCustomer, getAccount, loadCustomers, type Account, type Customer, type CustomerMatch } from "./customers.ts";
import { dueDate, getKhata, type Khata } from "./ledger.ts";
import { formatRupees } from "./money.ts";
import { readBackText } from "./readback.ts";
import { spokenName } from "./spoken-name.ts";
import {
  advanceQuestion, askDue, askPaymentAmount, askPromiseAmount, notFound, paymentQuestion, promiseQuestion, whoIsIt, type Say,
} from "./talk.ts";
import { interpretVoice, type BillEntries, type FollowUp, type LedgerTurn, type VoiceTurn } from "./voice.ts";

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

export function asBody(body: unknown): Body {
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
  if (overpaidBy > 0) say = `${formatRupees(overpaidBy)} more than the bill was paid. Give it back or keep it as advance?`;
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

type VoiceQuestion = Extract<VoiceTurn, { kind: "question" }>;
type VoiceAnswer = { kind: "answer"; text: string; speech: string; needsName?: true };
// A ledger task Bolo has heard and checked; it is saved only after the owner says yes.
export type LedgerTask =
  | { action: "payment"; customerId: number; name: string; amount: number; mode: "cash" | "upi" | null; allowAdvance: boolean }
  | { action: "promise"; customerId: number; name: string; amount: number; due: string };
export type VoiceTask = { kind: "task"; task: LedgerTask | null } & Say;
export type VoiceBillResult = (Exclude<VoiceTurn, VoiceQuestion | LedgerTurn> & { match?: CustomerMatch }) | VoiceAnswer | VoiceTask;

// Find the customer and say the task back. Anything missing becomes a question, never a guess.
function ledgerTask(db: DatabaseSync, turn: LedgerTurn, now: Date): VoiceTask {
  const ask = (say: Say): VoiceTask => ({ kind: "task", task: null, ...say });
  const heard = spokenName(turn.name);
  const match = searchCustomers(db, heard);
  if (match.kind === "ambiguous") return ask(whoIsIt(heard, match.options.map(({ name }) => name)));
  if (match.kind !== "found") return ask(notFound(heard));
  const { id, name, outstanding } = getAccount(db, match.customer.id);
  if (turn.amount === null) return ask(turn.kind === "payment" ? askPaymentAmount(name) : askPromiseAmount(name));
  if (turn.kind === "promise") {
    if (!turn.due) return ask(askDue(name));
    const due = dueDate(turn.due, now);
    const task: LedgerTask = { action: "promise", customerId: id, name, amount: turn.amount, due };
    return { kind: "task", task, ...promiseQuestion({ name, amount: turn.amount, dueWord: turn.due, dueDate: due }) };
  }
  const extra = turn.amount - Math.max(0, outstanding);
  const say = extra > 0
    ? advanceQuestion({ name, before: outstanding, extra })
    : paymentQuestion({ name, amount: turn.amount, mode: turn.mode, before: outstanding, after: outstanding - turn.amount });
  const task: LedgerTask = { action: "payment", customerId: id, name, amount: turn.amount, mode: turn.mode, allowAdvance: extra > 0 };
  return { kind: "task", task, ...say };
}

function answerVoice(db: DatabaseSync, turn: VoiceQuestion, customerId: unknown): VoiceAnswer {
  const answer = (text: string, speech: string, needsName?: true): VoiceAnswer => ({ kind: "answer", text, speech, needsName });
  const rupees = (paise: number) => `${formatRupees(paise).slice(1)} रुपये`;
  if (turn.query === "sales") {
    const day = db.prepare(`
      SELECT count(*) AS bills, coalesce(sum(total_paise), 0) AS total,
        coalesce(sum(cash_paise), 0) AS cash, coalesce(sum(upi_paise), 0) AS upi,
        coalesce(sum(udhaar_paise), 0) AS udhaar
      FROM bills
      WHERE date(created_at, '+05:30') = date('now', '+05:30')
    `).get() as { bills: number; total: number; cash: number; upi: number; udhaar: number };
    if (!day.bills) return answer("No bills saved yet today.", "आज अभी तक कोई बिल नहीं कटा है।");
    const split = [
      day.cash && `cash ${formatRupees(day.cash)}`,
      day.upi && `UPI ${formatRupees(day.upi)}`,
      day.udhaar && `credit ${formatRupees(day.udhaar)}`,
    ].filter(Boolean).join(", ");
    return answer(
      `Today's sales: ${formatRupees(day.total)} from ${day.bills} ${day.bills === 1 ? "bill" : "bills"}. Paid as ${split}.`,
      `आज ${rupees(day.total)} की बिक्री हुई।`,
    );
  }
  if (turn.query === "salesScope") {
    return answer("I can tell you today's total sales. Ask “Aaj kitni sale hui?” or “today sale”.", "मैं आज की कुल बिक्री बता सकता हूँ। पूछें, आज कितनी बिक्री हुई?");
  }
  if (turn.query === "topDebt") {
    const top = db.prepare("SELECT name, outstanding_paise AS outstanding FROM customers WHERE outstanding_paise > 0 ORDER BY outstanding_paise DESC, name LIMIT 1")
      .get() as { name: string; outstanding: number } | undefined;
    return top
      ? answer(`${top.name} owes the most: ${formatRupees(top.outstanding)}.`, `सबसे ज़्यादा उधार ${top.name} का है, ${rupees(top.outstanding)}।`)
      : answer("No customer owes anything.", "किसी ग्राहक का उधार बाकी नहीं है।");
  }
  if (turn.query !== "khata") throw new Error("unknown voice question");
  const match = turn.name ? searchCustomers(db, spokenName(turn.name)) : null;
  if (match?.kind === "ambiguous") {
    const names = match.options.map(({ name }) => name).join(", ");
    return answer(`Which customer? ${names}. Please say the full name.`, `कौन सा ग्राहक? ${names}। पूरा नाम बताइए।`, true);
  }
  if (match && match.kind !== "found") return answer("Customer not found. Please say the full name.", "ग्राहक का नाम नहीं मिला। पूरा नाम बताइए।", true);
  const id = match?.customer.id ?? customerId;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) {
    return answer("Whose account should I tell you? Please say the name.", "किसका हिसाब बताऊँ? नाम बोलें।", true);
  }
  const account = getAccount(db, id);
  const balance = formatRupees(Math.abs(account.outstanding));
  return answer(
    account.outstanding < 0
      ? `${account.name} has ${balance} in advance. Credit limit ${formatRupees(account.creditLimit)}.`
      : `${account.name} owes ${balance}. Credit limit ${formatRupees(account.creditLimit)}.`,
    `${account.name} का ${account.outstanding < 0 ? "एडवांस" : "उधार"} ${rupees(Math.abs(account.outstanding))} है। क्रेडिट लिमिट ${rupees(account.creditLimit)} है।`,
  );
}

// Interpret and look up a name in one request. The voice endpoint never writes.
export function voiceBill(db: DatabaseSync, rates: RateCard, body: unknown, now = new Date()): VoiceBillResult {
  const raw = asBody(body);
  if (typeof raw.words !== "string" || raw.words.length > 2000) throw new Error("unclear voice input");
  const { items, cash, upi }: BillEntries = parseBill({ ...raw, customerId: 0 });
  let followUp: FollowUp | undefined;
  if (raw.followUp != null) {
    const asked = asBody(raw.followUp);
    if (asked.kind === "grade" && typeof asked.qty === "number" && Number.isSafeInteger(asked.qty)
      && asked.qty > 0 && (asked.unit === "piece" || asked.unit === "crate")) {
      followUp = { kind: "grade", qty: asked.qty, unit: asked.unit };
    } else if (asked.kind === "payment" && (asked.mode === "cash" || asked.mode === "upi" || asked.mode === undefined)) {
      followUp = { kind: "payment", mode: asked.mode };
    }
  }
  const turn = interpretVoice(raw.words, { items, cash, upi }, rates, raw.needsCustomer === true, followUp, raw.accountQuestion === true);
  if (turn.kind === "payment" || turn.kind === "promise") return ledgerTask(db, turn, now);
  if (turn.kind === "question") return answerVoice(db, turn, raw.customerId);
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
