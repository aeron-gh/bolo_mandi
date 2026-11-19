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
  | { type: "cancel" };

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
  }
}
