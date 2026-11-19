import { describe, it, expect } from "vitest";
import { rs } from "../lib/money.ts";
import { orList, paymentDone, promiseDone } from "../lib/talk.ts";

describe("what Bolo says after saving", () => {
  it("vasooli: the new udhaar, a settled account, or the advance", () => {
    expect(paymentDone({ name: "Manat", after: rs(7500) }).text).toBe("Likh liya. Manat ka udhaar ab ₹7,500 hai.");
    expect(paymentDone({ name: "Manat", after: 0 }).text).toBe("Likh liya. Manat ka hisaab barabar ho gaya.");
    expect(paymentDone({ name: "Vikas", after: -rs(2000) }).text).toBe("Likh liya. Vikas ka ₹2,000 advance jama hai.");
  });

  it("vaada: saved, and the udhaar is unchanged until money comes", () => {
    expect(promiseDone()).toEqual({
      text: "Vaada likh liya. Paise aayen to bata dena, vasooli likh dunga.",
      speech: "वादा लिख लिया। पैसे आएँ तो बता देना, वसूली लिख दूँगा।",
    });
  });

  it("joins choices the way people say them", () => {
    expect(orList(["Afzal Khan", "Afzal Ahmed", "Afzal Traders"])).toBe("Afzal Khan, Afzal Ahmed ya Afzal Traders");
    expect(orList(["A", "B"])).toBe("A ya B");
  });
});
