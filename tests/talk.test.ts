import { describe, it, expect } from "vitest";
import { rs } from "../lib/money.ts";
import { orList, paymentDone, promiseDone } from "../lib/talk.ts";

describe("what Bolo says after saving", () => {
  it("vasooli: the new udhaar, a settled account, or the advance", () => {
    expect(paymentDone({ name: "Manat", after: rs(7500) }).text).toBe("Recorded. Manat's credit is now ₹7,500.");
    expect(paymentDone({ name: "Manat", after: 0 }).text).toBe("Recorded. Manat's account is settled.");
    expect(paymentDone({ name: "Vikas", after: -rs(2000) }).text).toBe("Recorded. Vikas has ₹2,000 in advance.");
  });

  it("vaada: saved, and the udhaar is unchanged until money comes", () => {
    expect(promiseDone()).toEqual({
      text: "Promise recorded. Tell me when the money comes and I'll record the payment.",
      speech: "वादा लिख लिया। पैसे आएँ तो बता देना, वसूली लिख दूँगा।",
    });
  });

  it("joins choices the way people say them", () => {
    expect(orList(["Afzal Khan", "Afzal Ahmed", "Afzal Traders"])).toBe("Afzal Khan, Afzal Ahmed or Afzal Traders");
    expect(orList(["A", "B"])).toBe("A or B");
  });
});
