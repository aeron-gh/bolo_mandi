import { describe, it, expect } from "vitest";
import { rs } from "../lib/money.ts";
import { newDraft, newDraftId, billReducer, whatIsMissing, type BillDraft, type Action } from "../lib/draft.ts";
import { readBackText, type ReadBackInput } from "../lib/readback.ts";

const MANAT = { id: 1, name: "Manat" };
const ANIL = { id: 10, name: "Anil" };

// run several actions one after another
function run(...actions: Action[]): BillDraft {
  return actions.reduce(billReducer, newDraft());
}

describe("newDraftId", () => {
  it("gives a fresh 32-letter id every time", () => {
    const a = newDraftId();
    expect(a).toMatch(/^[0-9a-f]{32}$/);
    expect(newDraftId()).not.toBe(a);
  });
});

describe("billReducer", () => {
  it("starts as an empty DRAFT with no id yet", () => {
    expect(newDraft()).toEqual({
      draftId: null, state: "DRAFT", customer: null, items: [], cash: 0, upi: 0, billId: null,
    });
  });

  it("the first read back gives the bill its id; later read backs keep it", () => {
    const d = run(
      { type: "setCustomer", customer: MANAT },
      { type: "addItem", item: { grade: 2, qty: 5 } },
      { type: "readBack", draftId: "first" },
      { type: "updateItem", index: 0, changes: { qty: 8 } },
      { type: "readBack", draftId: "second" },
    );
    expect(d).toMatchObject({ state: "AWAITING_CONFIRM", draftId: "first" });
  });

  it("R01: changing qty keeps one line with the new qty", () => {
    const d = run(
      { type: "setCustomer", customer: MANAT },
      { type: "addItem", item: { grade: 1, qty: 10 } },
      { type: "updateItem", index: 0, changes: { qty: 12 } },
    );
    expect(d.items).toEqual([{ grade: 1, qty: 12 }]);
  });

  it("R02: changing grade 2 to grade 1", () => {
    const d = run(
      { type: "addItem", item: { grade: 2, qty: 10 } },
      { type: "updateItem", index: 0, changes: { grade: 1 } },
    );
    expect(d.items).toEqual([{ grade: 1, qty: 10 }]);
  });

  it("R03: removing a line", () => {
    const d = run(
      { type: "addItem", item: { grade: 3, qty: 20 } },
      { type: "addItem", item: { grade: 1, qty: 5 } },
      { type: "removeItem", index: 0 },
    );
    expect(d.items).toEqual([{ grade: 1, qty: 5 }]);
  });

  it("R04: cancel ends the bill and nothing more can change", () => {
    const d = run(
      { type: "setCustomer", customer: MANAT },
      { type: "addItem", item: { grade: 2, qty: 10 } },
      { type: "cancel" },
      { type: "addItem", item: { grade: 1, qty: 1 } },
    );
    expect(d.state).toBe("CANCELLED");
    expect(d.items).toHaveLength(1);
  });

  it("R05: changing the customer keeps the items", () => {
    const d = run(
      { type: "setCustomer", customer: { id: 6, name: "Imran" } },
      { type: "addItem", item: { grade: 1, qty: 10 } },
      { type: "setCustomer", customer: ANIL },
    );
    expect(d.customer).toEqual(ANIL);
    expect(d.items).toEqual([{ grade: 1, qty: 10 }]);
  });

  it("read back moves DRAFT to AWAITING_CONFIRM", () => {
    const d = run(
      { type: "setCustomer", customer: MANAT },
      { type: "addItem", item: { grade: 2, qty: 5 } },
      { type: "readBack", draftId: "d1" },
    );
    expect(d.state).toBe("AWAITING_CONFIRM");
  });

  it("R06: a change during read back goes back to DRAFT, a new read back is needed", () => {
    const reading = run(
      { type: "setCustomer", customer: MANAT },
      { type: "addItem", item: { grade: 2, qty: 5 } },
      { type: "readBack", draftId: "d1" },
    );
    const changed = billReducer(reading, { type: "updateItem", index: 0, changes: { qty: 8 } });
    expect(changed.state).toBe("DRAFT");
    expect(billReducer(changed, { type: "readBack", draftId: "d1" }).state).toBe("AWAITING_CONFIRM");
  });

  it("payment can be set and changed", () => {
    const d = run({ type: "setPayment", cash: rs(4000) }, { type: "setPayment", upi: rs(1000) });
    expect([d.cash, d.upi]).toEqual([rs(4000), rs(1000)]);
  });

  it("cannot read back without a customer and at least one item", () => {
    expect(whatIsMissing(newDraft())).toBe("customer");
    const noItems = run({ type: "setCustomer", customer: MANAT });
    expect(whatIsMissing(noItems)).toBe("items");
    expect(billReducer(noItems, { type: "readBack", draftId: "d1" }).state).toBe("DRAFT");
  });

  it("saved only from AWAITING_CONFIRM, never straight from DRAFT", () => {
    const draft = run({ type: "setCustomer", customer: MANAT }, { type: "addItem", item: { grade: 1, qty: 1 } });
    expect(billReducer(draft, { type: "saved", billId: 7 }).state).toBe("DRAFT");
    const saved = billReducer(billReducer(draft, { type: "readBack", draftId: "d1" }), { type: "saved", billId: 7 });
    expect(saved).toMatchObject({ state: "SAVED", billId: 7 });
  });

  it("a wrong line number changes nothing", () => {
    const d = run({ type: "addItem", item: { grade: 1, qty: 1 } });
    expect(billReducer(d, { type: "removeItem", index: 5 })).toBe(d);
  });
});

describe("readBackText", () => {
  const B01: ReadBackInput = {
    customerName: "Manat", total: rs(25000), cash: rs(4000), upi: 0, udhaar: rs(21000),
    newOutstanding: rs(33500), credit: "ok", overBy: 0,
  };

  it("B01: says the data sheet sentence", () => {
    expect(readBackText(B01)).toBe(
      "Manat ka bill ₹25,000 hua. ₹4,000 cash receive hua aur ₹21,000 udhaar mein gaya. " +
        "Manat ka total udhaar ab ₹33,500 hai. Bill kaat doon?",
    );
  });

  it("B02: says clearly when the full bill is udhaar", () => {
    const text = readBackText({ ...B01, customerName: "Sameer", total: rs(24000), cash: 0, udhaar: rs(24000), newOutstanding: rs(24000) });
    expect(text).toContain("Poora ₹24,000 udhaar mein gaya.");
  });

  it("B05: full cash says no udhaar part", () => {
    const text = readBackText({ ...B01, customerName: "Anil", total: rs(9600), cash: rs(9600), udhaar: 0, newOutstanding: rs(22000) });
    expect(text).toContain("₹9,600 cash receive hua.");
    expect(text).not.toContain("udhaar mein gaya");
  });

  it("P01: cash and UPI together", () => {
    const text = readBackText({ ...B01, cash: rs(10000), upi: rs(20000), udhaar: rs(18000) });
    expect(text).toContain("₹10,000 cash aur ₹20,000 UPI receive hua aur ₹18,000 udhaar mein gaya.");
  });

  it("C01: warns near the limit", () => {
    expect(readBackText({ ...B01, credit: "near" })).toContain("Limit ke paas hai. Bill kaat doon?");
  });

  it("C02: over the limit says by how much and asks again", () => {
    const text = readBackText({ ...B01, credit: "over", overBy: rs(6000) });
    expect(text).toContain("Limit se ₹6,000 upar hai. Phir bhi kaat doon?");
  });

  it("an advance left after the bill is said as advance", () => {
    expect(readBackText({ ...B01, newOutstanding: -rs(5900) })).toContain("Manat ka ₹5,900 advance jama hai.");
  });
});
