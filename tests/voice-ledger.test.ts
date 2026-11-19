import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { voiceBill } from "../lib/api.ts";
import { loadSeed, openDb, ratesFromSeed, readSeed } from "../lib/db.ts";
import { rs } from "../lib/money.ts";
import { interpretVoice, type BillEntries } from "../lib/voice.ts";

const seed = readSeed();
const rates = ratesFromSeed(seed);
const empty: BillEntries = { items: [], cash: 0, upi: 0 };
const billOpen: BillEntries = { items: [{ grade: 1, qty: 10 }], cash: 0, upi: 0 };
const NOW = new Date("2026-11-19T06:30:00Z");
const hear = (words: string, current = empty) => interpretVoice(words, current, rates, false);

let db: DatabaseSync;
beforeEach(() => {
  db = openDb(":memory:");
  loadSeed(db, seed);
});
afterEach(() => db.close());
const ask = (words: string, current = empty) => voiceBill(db, rates, { ...current, words, needsCustomer: true }, NOW);

describe("hearing vasooli", () => {
  it.each([
    ["Manat ne 5000 cash diye", { name: "manat", amount: rs(5000), mode: "cash" }],
    ["Manat se das hazaar ki vasooli hui, UPI mein", { name: "manat", amount: rs(10000), mode: "upi" }],
    ["Afzal Khan ne 2500 diye", { name: "afzal khan", amount: rs(2500), mode: null }],
    ["मनत ने पाँच हज़ार कैश दिए", { name: "मनत", amount: rs(5000), mode: "cash" }],
    ["Manat ne kuch paise diye", { name: "manat", amount: null, mode: null }],
  ])("%s", (words, expected) => {
    expect(hear(words)).toEqual({ kind: "payment", ...expected });
  });

  it("during an open bill, plain 'diye' stays with the bill; 'vasooli' is still vasooli", () => {
    expect(hear("Manat ne 5000 cash diye", billOpen).kind).not.toBe("payment");
    expect(hear("Manat ki 5000 vasooli", billOpen)).toEqual({ kind: "payment", name: "manat", amount: rs(5000), mode: null });
  });
});

describe("hearing a vaada", () => {
  it.each([
    ["Manat kal 5000 dega", { name: "manat", amount: rs(5000), due: "kal" }],
    ["Rahul parso 25 hazaar dega", { name: "rahul", amount: rs(25000), due: "parso" }],
    ["Imran 10 hazaar dega", { name: "imran", amount: rs(10000), due: null }],
    ["Vikas ne aaj 2000 dene ka vaada kiya", { name: "vikas", amount: rs(2000), due: "aaj" }],
  ])("%s", (words, expected) => {
    expect(hear(words)).toEqual({ kind: "promise", ...expected });
  });
});

describe("other sentences keep their meaning", () => {
  it("bills, questions and a plain no are not ledger entries", () => {
    expect(hear("Vikas ko das piece do number").kind).toBe("edit");
    expect(hear("Vikas ka hisaab batao")).toMatchObject({ kind: "question", query: "khata" });
    expect(hear("nahi")).toEqual({ kind: "deny" });
    expect(hear("Manat ne 5000 ka maal liya").kind).not.toBe("payment");
  });
});

describe("Bolo says the task back and waits for haan", () => {
  it("vasooli: names the money and the new udhaar", () => {
    expect(ask("Manat ne 5000 cash diye")).toEqual({
      kind: "task",
      task: { action: "payment", customerId: 1, name: "Manat", amount: rs(5000), mode: "cash", allowAdvance: false },
      text: "Manat paid ₹5,000 in cash. Credit goes from ₹12,500 to ₹7,500. Shall I record it?",
      speech: "Manat से 5,000 रुपये कैश मिले। उधार 7,500 रुपये हो जाएगा। लिख दूँ?",
    });
  });

  it("vasooli with no mode says so instead of guessing cash", () => {
    expect(ask("Manat ne 2000 diye")).toMatchObject({
      task: { mode: null }, text: "Manat paid ₹2,000 (cash or UPI not said). Credit goes from ₹12,500 to ₹10,500. Shall I record it?",
    });
  });

  it("more than is owed asks about advance first", () => {
    expect(ask("Vikas ne 10 hazaar UPI diye")).toMatchObject({
      task: { action: "payment", amount: rs(10000), allowAdvance: true },
      text: "Vikas owes ₹8,000, so this is ₹2,000 more. Keep the extra as advance?",
    });
  });

  it("vaada: names the India date and leaves the udhaar alone", () => {
    expect(ask("Manat kal 5000 dega")).toEqual({
      kind: "task",
      task: { action: "promise", customerId: 1, name: "Manat", amount: rs(5000), due: "2026-11-20" },
      text: "Manat will pay ₹5,000 tomorrow, 20 Nov. Record the promise?",
      speech: "Manat 5,000 रुपये कल तक देगा। वादा लिख दूँ?",
    });
  });

  it("asks for what is missing instead of guessing", () => {
    expect(ask("Manat ne kuch paise diye")).toMatchObject({ kind: "task", task: null, text: "How much did Manat pay? Say it all at once, like “Manat ne 5000 cash diye”." });
    expect(ask("Imran 10 hazaar dega")).toMatchObject({ kind: "task", task: null, text: "When will Imran pay: today, tomorrow or the day after? Please say the whole sentence again." });
    expect(ask("Afzal ne 500 diye")).toMatchObject({ kind: "task", task: null, text: expect.stringMatching(/^Which Afzal\? .*Afzal Khan.* Please say the full name\.$/) });
    expect(ask("Zorawar ne 500 diye")).toMatchObject({ kind: "task", task: null, text: "No customer called “Zorawar”. Please say the name again." });
  });
});
