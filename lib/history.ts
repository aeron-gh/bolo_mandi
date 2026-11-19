// History: bills by India day, one bill's details, and the receipt text for print and WhatsApp.
// Times are stored in UTC; the India day is the UTC time plus 5 hours 30 minutes.
import type { DatabaseSync } from "node:sqlite";
import type { Grade, Unit } from "./billing.ts";
import { indiaDateTime } from "./dates.ts";
import { formatRupees as r } from "./money.ts";

const INDIA_DAY = "date(b.created_at, '+330 minutes')";

export type BillSummary = {
  id: number; customerId: number; customerName: string;
  total: number; cash: number; upi: number; udhaar: number; createdAt: string; day: string;
};
export type BillLine = { grade: Grade; qty: number; unit: Unit; rate: number; rateOverride: boolean; amount: number };
export type BillDetail = BillSummary & { customerPhone: string; outstandingAfter: number; overLimit: boolean; items: BillLine[] };
export type DayTotals = { day: string; bills: number; total: number; cash: number; upi: number; udhaar: number };
export type ReceiptShop = { shopName: string; phone: string; address: string };

// Today's date in India as YYYY-MM-DD, whatever time zone the server runs in.
export function indiaDay(now: Date): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

const SUMMARY = `SELECT b.id, b.customer_id AS customerId, c.name AS customerName, b.total_paise AS total,
  b.cash_paise AS cash, b.upi_paise AS upi, b.udhaar_paise AS udhaar, b.created_at AS createdAt, ${INDIA_DAY} AS day
  FROM bills b JOIN customers c ON c.id = b.customer_id`;

// Newest first; optionally one India day and/or one customer.
export function listBills(db: DatabaseSync, filter: { day?: string; customerId?: number; limit?: number }): BillSummary[] {
  const where: string[] = [];
  const args: (string | number)[] = [];
  if (filter.day) {
    where.push(`${INDIA_DAY} = ?`);
    args.push(filter.day);
  }
  if (filter.customerId) {
    where.push("b.customer_id = ?");
    args.push(filter.customerId);
  }
  const sql = `${SUMMARY}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY b.created_at DESC, b.id DESC LIMIT ?`;
  return db.prepare(sql).all(...args, filter.limit ?? 300) as BillSummary[];
}

export function dayTotals(db: DatabaseSync, day: string): DayTotals {
  const row = db.prepare(`
    SELECT count(*) AS bills, coalesce(sum(total_paise), 0) AS total, coalesce(sum(cash_paise), 0) AS cash,
      coalesce(sum(upi_paise), 0) AS upi, coalesce(sum(udhaar_paise), 0) AS udhaar
    FROM bills b WHERE ${INDIA_DAY} = ?`).get(day) as Omit<DayTotals, "day">;
  return { day, ...row };
}

export function getBill(db: DatabaseSync, id: number): BillDetail | null {
  const bill = db.prepare(`
    SELECT b.id, b.customer_id AS customerId, c.name AS customerName, COALESCE(c.phone, '') AS customerPhone,
      b.total_paise AS total, b.cash_paise AS cash, b.upi_paise AS upi, b.udhaar_paise AS udhaar,
      b.outstanding_after_paise AS outstandingAfter, b.over_limit AS overLimit, b.created_at AS createdAt, ${INDIA_DAY} AS day
    FROM bills b JOIN customers c ON c.id = b.customer_id WHERE b.id = ?`).get(id) as (Omit<BillDetail, "items" | "overLimit"> & { overLimit: number }) | undefined;
  if (!bill) return null;
  const items = (db.prepare(`
    SELECT grade, qty, unit, rate_paise AS rate, rate_override AS rateOverride, amount_paise AS amount
    FROM bill_items WHERE bill_id = ? ORDER BY id`).all(id) as (Omit<BillLine, "rateOverride"> & { rateOverride: number })[])
    .map((line) => ({ ...line, rateOverride: line.rateOverride === 1 }));
  return { ...bill, overLimit: bill.overLimit === 1, items };
}

// Plain text that reads well on paper and in WhatsApp (*bold* shop name). Zero payments are skipped.
export function receiptText(bill: BillDetail, shop: ReceiptShop): string {
  const head = [shop.shopName && `*${shop.shopName}*`, shop.address, shop.phone && `Mobile ${shop.phone}`].filter(Boolean) as string[];
  const lines = [...head, ...(head.length ? [""] : [])];
  lines.push(`Bill ${bill.id}, ${indiaDateTime(bill.createdAt)}`, `Customer: ${bill.customerName}`, "");
  for (const item of bill.items) lines.push(`Grade ${item.grade}: ${item.qty} ${item.unit} x ${r(item.rate)} = ${r(item.amount)}`);
  lines.push("", `Total: ${r(bill.total)}`);
  if (bill.cash) lines.push(`Cash: ${r(bill.cash)}`);
  if (bill.upi) lines.push(`UPI: ${r(bill.upi)}`);
  if (bill.udhaar) lines.push(`On credit: ${r(bill.udhaar)}`);
  lines.push(bill.outstandingAfter < 0 ? `Advance: ${r(-bill.outstandingAfter)}` : `Total credit now: ${r(bill.outstandingAfter)}`);
  lines.push("", "Thank you!");
  return lines.join("\n");
}

// wa.me opens WhatsApp with the text ready; the owner still presses Send.
export function whatsappLink(text: string, phone: string): string {
  return `https://wa.me/${phone ? `91${phone}` : ""}?text=${encodeURIComponent(text)}`;
}
