// The bill on screen and its states. Pure: old draft + action -> new draft.
// Screen buttons and voice tools send the same actions, so both behave the same.
// Safe for the browser: only type imports from server files.
import type { ItemInput } from "./billing.ts";
import type { Customer } from "./customers.ts";

export type BillState = "DRAFT" | "AWAITING_CONFIRM" | "SAVED" | "CANCELLED";

export type BillDraft = {
  draftId: string | null; // set at the first read back, kept after that
  state: BillState;
  customer: Customer | null;
  items: ItemInput[];
  cash: number;
  upi: number;
  billId: number | null;
};

export type Action =
  | { type: "setCustomer"; customer: Customer }
  | { type: "voiceEdit"; customer: Customer | null; items: ItemInput[]; cash: number; upi: number }
  | { type: "addItem"; item: ItemInput }
  | { type: "updateItem"; index: number; changes: Partial<ItemInput> }
  | { type: "removeItem"; index: number }
  | { type: "setPayment"; cash?: number; upi?: number }
  | { type: "readBack"; draftId: string }
  | { type: "reviewAgain" }
  | { type: "saved"; billId: number }
  | { type: "cancel" }
  | { type: "revert"; to: BillDraft };

// Random id from getRandomValues; randomUUID fails on plain http over Wi-Fi.
// Call it in a click handler, never while rendering.
export function newDraftId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function newDraft(): BillDraft {
  return { draftId: null, state: "DRAFT", customer: null, items: [], cash: 0, upi: 0, billId: null };
}

// What still has to be asked before Bolo can read the bill back.
export function whatIsMissing(draft: BillDraft): "customer" | "items" | null {
  if (!draft.customer) return "customer";
  if (draft.items.length === 0) return "items";
  return null;
}

// Apply an edit. Any edit during read back sends the bill back to DRAFT.
function edit(draft: BillDraft, changes: Partial<BillDraft>): BillDraft {
  return { ...draft, ...changes, state: "DRAFT" };
}

export function billReducer(draft: BillDraft, action: Action): BillDraft {
  if (draft.state === "SAVED" || draft.state === "CANCELLED") return draft;
  const items = draft.items;
  switch (action.type) {
    case "setCustomer":
      return edit(draft, { customer: action.customer });
    case "voiceEdit":
      return edit(draft, { customer: action.customer, items: action.items, cash: action.cash, upi: action.upi });
    case "addItem":
      return edit(draft, { items: [...items, action.item] });
    case "updateItem":
      if (!items[action.index]) return draft;
      return edit(draft, { items: items.map((it, i) => (i === action.index ? { ...it, ...action.changes } : it)) });
    case "removeItem":
      if (!items[action.index]) return draft;
      return edit(draft, { items: items.filter((_, i) => i !== action.index) });
    case "setPayment":
      return edit(draft, { cash: action.cash ?? draft.cash, upi: action.upi ?? draft.upi });
    case "readBack":
      if (whatIsMissing(draft)) return draft;
      return { ...draft, state: "AWAITING_CONFIRM", draftId: draft.draftId ?? action.draftId };
    case "reviewAgain":
      return edit(draft, {});
    case "saved":
      return draft.state === "AWAITING_CONFIRM" ? { ...draft, state: "SAVED", billId: action.billId } : draft;
    case "cancel":
      return { ...draft, state: "CANCELLED" };
    case "revert":
      // Undo is an edit too: the bill goes back to kaccha and must be read back again.
      return edit(draft, { customer: action.to.customer, items: action.to.items, cash: action.to.cash, upi: action.to.upi });
  }
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isPaise = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const isPositive = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;

// One saved bill line, checked field by field; null if anything is off.
function readItem(v: unknown): ItemInput | null {
  if (!isObject(v)) return null;
  const { grade, qty, rate, unit } = v;
  if ((grade !== 1 && grade !== 2 && grade !== 3) || !isPositive(qty)) return null;
  if (rate !== undefined && !isPositive(rate)) return null;
  if (unit !== undefined && unit !== "piece" && unit !== "crate") return null;
  return { grade, qty, ...(rate !== undefined && { rate }), ...(unit !== undefined && { unit }) };
}

// A bill left open on this device. Finished, empty or broken bills give null.
// A bill that was waiting for "haan" comes back as DRAFT, so it is read back again before saving.
export function restoreDraft(saved: unknown): BillDraft | null {
  if (!isObject(saved) || (saved.state !== "DRAFT" && saved.state !== "AWAITING_CONFIRM")) return null;
  const { draftId, customer, items, cash, upi } = saved;
  if (draftId !== null && (typeof draftId !== "string" || !/^[0-9a-f]{32}$/.test(draftId))) return null;
  if (customer !== null && !(isObject(customer) && isPositive(customer.id) && typeof customer.name === "string")) return null;
  if (!Array.isArray(items) || !isPaise(cash) || !isPaise(upi)) return null;
  const lines = items.map(readItem);
  if (lines.some((line) => line === null)) return null;
  if (customer === null && lines.length === 0) return null;
  return {
    draftId, state: "DRAFT", billId: null, cash, upi, items: lines as ItemInput[],
    customer: customer === null ? null : { id: customer.id as number, name: customer.name as string },
  };
}

export type StartNote = "restored" | "customer" | null;

// What the counter shows first: an open bill wins; else the customer from the link; else empty.
export function startDraft(saved: unknown, customer: Customer | null): { draft: BillDraft; note: StartNote } {
  const open = restoreDraft(saved);
  if (open) return { draft: open, note: "restored" };
  if (customer) return { draft: { ...newDraft(), customer }, note: "customer" };
  return { draft: newDraft(), note: null };
}

// What voice treats as the bill in progress. A saved or cancelled bill is closed, so its lines
// must not count: otherwise "Manat ne 5000 diye" right after a sale is read as that sale's payment.
export function openEntries(draft: BillDraft): { items: ItemInput[]; cash: number; upi: number } {
  if (draft.state === "SAVED" || draft.state === "CANCELLED") return { items: [], cash: 0, upi: 0 };
  return { items: draft.items, cash: draft.cash, upi: draft.upi };
}

export type QuickPayment = "cash" | "half" | "upi" | "credit";

// The quick payment buttons. "Half cash" is half the total rounded down to the paisa.
export function paymentFor(choice: QuickPayment, total: number): { cash: number; upi: number } {
  if (choice === "cash") return { cash: total, upi: 0 };
  if (choice === "half") return { cash: Math.floor(total / 2), upi: 0 };
  if (choice === "upi") return { cash: 0, upi: total };
  return { cash: 0, upi: 0 };
}

const sameLine = (a: ItemInput | undefined, b: ItemInput) =>
  a !== undefined && a.grade === b.grade && a.qty === b.qty && a.rate === b.rate && (a.unit ?? "piece") === (b.unit ?? "piece");

// Positions of lines that are new or different after a change, so the screen can point at them.
export function changedLines(before: ItemInput[], after: ItemInput[]): number[] {
  return after.flatMap((line, i) => (sameLine(before[i], line) ? [] : [i]));
}

// How full the credit limit is, as a whole percent from 0 to 100. A ₹0 limit is full once anything is owed.
export function limitShare(newOutstanding: number, limit: number): number {
  if (newOutstanding <= 0) return 0;
  if (limit <= 0) return 100;
  return Math.min(100, Math.floor((newOutstanding * 100) / limit));
}
