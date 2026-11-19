import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { confirmBill, previewBill, voiceBill } from "../lib/api.ts";
import { loadSeed, openDb, ratesFromSeed, readSeed } from "../lib/db.ts";
import { rs } from "../lib/money.ts";
import { hindiReadBack } from "../lib/readback.ts";
import type { BillEntries } from "../lib/voice.ts";

const seed = readSeed();
const rates = ratesFromSeed(seed);
const empty: BillEntries = { items: [], cash: 0, upi: 0 };
let db: DatabaseSync;

beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, seed);
});
afterEach(() => db.close());

function say(words: string, entries = empty) {
  return voiceBill(db, rates, { ...entries, words, needsCustomer: true });
}

describe("voice billing", () => {
  it("answers a Hindi account question without editing the active draft", () => {
    const entries = { ...empty, items: [{ grade: 2 as const, qty: 10 }] };
    expect(voiceBill(db, rates, { ...entries, customerId: 8, words: "विकास का हिसाब बताओ।" })).toMatchObject({
      kind: "answer", text: expect.stringContaining("₹8,000"),
    });
    expect(entries.items).toEqual([{ grade: 2, qty: 10 }]);
    expect(db.prepare("SELECT COUNT(*) AS n FROM bills").get()).toMatchObject({ n: 0 });
  });

  it("accepts a full customer name after asking which account to read", () => {
    expect(say("Afzal ka hisaab batao")).toMatchObject({ kind: "answer", needsName: true });
    expect(voiceBill(db, rates, { ...empty, words: "Afzal Ahmed", customerId: 8, accountQuestion: true })).toMatchObject({
      kind: "answer", text: expect.stringContaining("Afzal Ahmed ka udhaar ₹20,000"),
    });
  });

  it.each([
    "today sale", "आज कितनी बिक्री हुई?", "aaj ki sale", "What are today’s sales?",
    "आज की टोटल सेल बताओ।", "how much did we sell today?", "sales today",
    "टुडे सेल", "Aaj sale kitni hui hai?", "Aaj ki bikri bata do",
  ])("gives a natural no-bills reply for %s", (words) => {
    expect(say(words)).toMatchObject({
      kind: "answer", text: "Aaj abhi tak koi bill nahi kata hai.", speech: "आज अभी तक कोई बिल नहीं कटा है।",
    });
  });

  it("reports saved bills for the Indian trading day, excluding draft items and other dates", () => {
    for (const draftId of ["prior", "midnight", "later", "next"]) {
      expect(confirmBill(db, rates, {
        draftId, customerId: 1, items: [{ grade: 1, qty: 1 }], cash: rs(500), upi: 0,
      })).toMatchObject({ status: "saved" });
    }
    const stamp = db.prepare("UPDATE bills SET created_at = datetime('now', '+05:30', 'start of day', '-05:30', ?) WHERE draft_id = ?");
    stamp.run("-1 second", "prior");
    stamp.run("+0 seconds", "midnight");
    stamp.run("+12 hours", "later");
    stamp.run("+1 day", "next");
    const turn = voiceBill(db, rates, { words: "today sale", items: [{ grade: 3, qty: 99 }], cash: 0, upi: 0,
      followUp: { kind: "grade", qty: 5, unit: "piece" }, accountQuestion: true });
    expect(turn).toMatchObject({ kind: "answer", text: "Aaj ₹3,000 ki sale hui. 2 bill. Cash ₹1,000, Udhaar ₹2,000.",
      speech: "आज 3,000 रुपये की बिक्री हुई।" });
  });

  it.each(["yesterday's sales", "Vikas ki aaj ki sale", "kal ki sale batao"])("clarifies the available report for %s", (words) => {
    expect(say(words)).toMatchObject({ kind: "answer", text: expect.stringContaining("aaj ki kul sale") });
  });

  it("distinguishes a conversational yes from an explicit instruction to save", () => {
    expect(say("हाँ")).toEqual({ kind: "confirm", assentOnly: true });
    expect(say("haan, bill kaat do")).toEqual({ kind: "confirm" });
  });

  it("recognizes a request to read the bill again in Hindi", () => {
    expect(say("फिर से पढ़ो")).toEqual({ kind: "review" });
  });

  it("reads highest outstanding balance from the ledger data", () => {
    expect(say("सबसे ज़्यादा उधार किसका है?")).toMatchObject({ kind: "answer", text: expect.stringContaining("Deepak ka hai, ₹3,50,000") });
  });

  it.each([
    "Manat ko 10 piece grade 1, 5 piece grade 2 aur 10 piece grade 3 de dena. 4,000 cash diya hai, baaki udhaar likh de.",
    "मनत को दस पीस ग्रेड एक, पाँच पीस ग्रेड दो और १० पीस ग्रेड तीन दे देना। ४,००० कैश दिया है, बाकी उधार लिख दो।",
  ])("B01: builds the same bill in either script (%s)", (words) => {
    const result = say(words);
    expect(result).toMatchObject({ kind: "edit", match: { kind: "found", customer: { id: 1 } } });
    if (result.kind !== "edit") throw new Error("expected bill entries");
    expect(previewBill(db, rates, { ...result.entries, customerId: 1 }))
      .toMatchObject({ total: rs(25000), cash: rs(4000), upi: 0, udhaar: rs(21000) });
  });

  it("P01: reads a mixed cash and UPI split", () => {
    expect(say("Deepak ka bill: 40 grade 2. 10 hazaar cash, UPI se 20 hazaar aaya, baaki khate mein."))
      .toMatchObject({ kind: "edit", entries: { cash: rs(10000), upi: rs(20000) } });
  });

  it("P04: applies a half payment to the corrected price", () => {
    expect(say("Manat ko 4 grade 3, rate 500 laga de, aadha cash aadha udhaar."))
      .toMatchObject({ kind: "edit", entries: { items: [{ grade: 3, qty: 4, rate: rs(500) }], cash: rs(1000), upi: 0 } });
  });

  it("N02: holds items while the trader disambiguates a spoken name", () => {
    const first = say("अफ़ज़ल को 10 ग्रेड 1 दे दो।");
    expect(first).toMatchObject({ kind: "edit", match: { kind: "ambiguous" } });
    if (first.kind !== "edit") throw new Error("expected bill entries");
    expect(say("अफ़ज़ल अहमद।", first.entries)).toMatchObject({
      kind: "edit", match: { kind: "found", customer: { name: "Afzal Ahmed" } },
      entries: { items: [{ grade: 1, qty: 10 }] },
    });
    expect(db.prepare("SELECT COUNT(*) AS n FROM bills").get()).toMatchObject({ n: 0 });
  });

  it("R02 and R06: corrects grade and quantity without adding a second line", () => {
    const entries: BillEntries = { ...empty, items: [{ grade: 2, qty: 5 }] };
    expect(say("ग्रेड दो नहीं, ग्रेड एक कर।", entries))
      .toMatchObject({ kind: "edit", entries: { items: [{ grade: 1, qty: 5 }] } });
    expect(say("Ruk, 8 piece.", entries))
      .toMatchObject({ kind: "edit", entries: { items: [{ grade: 2, qty: 8 }] } });
  });

  it("returns a credit warning and recognizes a separate confirmation without saving", () => {
    const turn = say("विकास को चालीस ग्रेड दो।");
    if (turn.kind !== "edit") throw new Error("expected bill entries");
    const preview = previewBill(db, rates, { ...turn.entries, customerId: 8 });
    expect(preview.credit).toBe("over");
    expect(hindiReadBack({ ...preview, customerName: "Vikas" })).toMatch(/6,000 रुपये ऊपर है। फिर भी बिल काट दूँ\?$/);
    expect(say("हाँ पता है, काट दो।", turn.entries)).toEqual({ kind: "confirm" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM bills").get()).toMatchObject({ n: 0 });
  });

  it("asks for clarification instead of partially applying an unclear turn", () => {
    expect(say("Vikas ko 5 grade 3, kuch paise diye hain.")).toMatchObject({
      kind: "edit", entries: { items: [{ grade: 3, qty: 5 }] }, followUp: { kind: "payment" },
    });
    expect(say("Rahul ko 10 grade 1, haan kaat do.")).toEqual({ kind: "repeat", reason: "unclear" });
    expect(say("Deepak ko 10 grade 2, rehne do, cancel kar.")).toEqual({ kind: "cancel" });
    expect(say("bill cancel karo")).toEqual({ kind: "cancel" });
  });

  it("keeps the piece count and accepts a grade in the next turn", () => {
    const first = say("Vikaas ko das piece.");
    expect(first).toMatchObject({ kind: "edit", followUp: { kind: "grade", qty: 10, unit: "piece" } });
    if (first.kind !== "edit") throw new Error("expected a follow-up");
    expect(voiceBill(db, rates, { ...first.entries, words: "Do number", followUp: first.followUp })).toMatchObject({
      kind: "edit", entries: { items: [{ grade: 2, qty: 10 }] }, followUp: null,
    });
  });

  it("keeps the bill when asking for a cash amount", () => {
    const first = say("Vikas ko 10 grade 2, cash diya.");
    expect(first).toMatchObject({ kind: "edit", followUp: { kind: "payment", mode: "cash" } });
    if (first.kind !== "edit") throw new Error("expected a follow-up");
    expect(voiceBill(db, rates, { ...first.entries, words: "das hazaar", followUp: first.followUp })).toMatchObject({
      kind: "edit", entries: { items: [{ grade: 2, qty: 10 }], cash: rs(10000) }, followUp: null,
    });
  });

  it("handles a transcript with no pause between an item and its payment", () => {
    expect(say("Vikaas ko das grade do das hazaar cash")).toMatchObject({
      kind: "edit", entries: { items: [{ grade: 2, qty: 10 }], cash: rs(10000) },
    });
  });

  it("drops repeated recognition artifacts before customer search", () => {
    expect(say("प्रॉ प्रॉ प्रॉ प्रॉ प्रॉ प्रॉ")).toEqual({ kind: "repeat", reason: "unclear" });
    expect(say("apruvuvuvuvuvuvuvuvuvuvuvuvuvuvuvuvuvu")).toEqual({ kind: "repeat", reason: "unclear" });
  });
});
