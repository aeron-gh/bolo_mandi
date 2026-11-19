import { describe, it, expect } from "vitest";
import { rs } from "../lib/money.ts";
import { calculateBill, splitPayment, checkCreditLimit } from "../lib/billing.ts";

// price list from the data sheet, in paise
const RATES = { 1: rs(1500), 2: rs(1200), 3: rs(400) };

describe("rs", () => {
  it("turns rupees into paise", () => {
    expect(rs(25000)).toBe(2_500_000);
  });
});

describe("calculateBill", () => {
  it("B01: 10 grade 1 + 5 grade 2 + 10 grade 3 is ₹25,000", () => {
    const bill = calculateBill(
      [{ grade: 1, qty: 10 }, { grade: 2, qty: 5 }, { grade: 3, qty: 10 }],
      RATES,
    );
    expect(bill.total).toBe(rs(25000));
    expect(bill.lines.map((l) => l.amount)).toEqual([rs(15000), rs(6000), rs(4000)]);
    expect(bill.lines.every((l) => !l.rateOverride)).toBe(true);
  });

  it("B08: spoken rate wins and is marked as override", () => {
    const bill = calculateBill([{ grade: 1, qty: 10, rate: rs(1400) }], RATES);
    expect(bill.total).toBe(rs(14000));
    expect(bill.lines[0]).toMatchObject({ rate: rs(1400), rateOverride: true });
  });

  it("unit is piece by default and crate is kept", () => {
    const bill = calculateBill(
      [{ grade: 1, qty: 80, rate: rs(1200), unit: "crate" }, { grade: 2, qty: 1 }],
      RATES,
    );
    expect(bill.lines.map((l) => l.unit)).toEqual(["crate", "piece"]);
  });

  it("refuses a zero or broken quantity", () => {
    expect(() => calculateBill([{ grade: 1, qty: 0 }], RATES)).toThrow();
    expect(() => calculateBill([{ grade: 1, qty: 2.5 }], RATES)).toThrow();
  });
});

describe("splitPayment", () => {
  it("B01: ₹4,000 cash on ₹25,000 leaves ₹21,000 udhaar", () => {
    expect(splitPayment(rs(25000), rs(4000), 0)).toEqual({
      ok: true, cash: rs(4000), upi: 0, udhaar: rs(21000),
    });
  });

  it("B02: no payment said means the full bill is udhaar", () => {
    expect(splitPayment(rs(24000))).toEqual({ ok: true, cash: 0, upi: 0, udhaar: rs(24000) });
  });

  it("P01: cash and UPI together, rest is udhaar", () => {
    expect(splitPayment(rs(48000), rs(10000), rs(20000))).toMatchObject({ udhaar: rs(18000) });
  });

  it("P03: paying more than the bill is not allowed, asks about the extra", () => {
    expect(splitPayment(rs(2400), rs(5000), 0)).toEqual({ ok: false, extra: rs(2600) });
  });

  it("refuses a negative payment", () => {
    expect(() => splitPayment(rs(1000), -1, 0)).toThrow();
  });
});

describe("checkCreditLimit", () => {
  it("B01: Manat goes to ₹33,500, ₹66,500 left, ok", () => {
    expect(checkCreditLimit(rs(12500), rs(21000), rs(100000))).toEqual({
      status: "ok", newOutstanding: rs(33500), creditLeft: rs(66500), overBy: 0,
    });
  });

  it("C01: Vikas at 96% is near the limit", () => {
    expect(checkCreditLimit(rs(8000), rs(40000), rs(50000))).toMatchObject({
      status: "near", newOutstanding: rs(48000), creditLeft: rs(2000),
    });
  });

  it("C02: Vikas goes over by ₹6,000", () => {
    expect(checkCreditLimit(rs(8000), rs(48000), rs(50000))).toMatchObject({
      status: "over", newOutstanding: rs(56000), creditLeft: 0, overBy: rs(6000),
    });
  });

  it("exactly 90% is still ok", () => {
    expect(checkCreditLimit(0, rs(45000), rs(50000)).status).toBe("ok");
  });

  it("exactly at the limit is near, not over", () => {
    expect(checkCreditLimit(0, rs(50000), rs(50000)).status).toBe("near");
  });
});
