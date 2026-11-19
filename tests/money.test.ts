import { describe, it, expect } from "vitest";
import { formatRupees } from "../lib/money.ts";

describe("formatRupees", () => {
  it("shows paise as rupees with Indian commas", () => {
    expect(formatRupees(2_500_000)).toBe("₹25,000");
    expect(formatRupees(15_000_000)).toBe("₹1,50,000");
    expect(formatRupees(0)).toBe("₹0");
  });

  it("shows paise only when there are some", () => {
    expect(formatRupees(2_500_050)).toBe("₹25,000.50");
  });

  it("puts the minus sign before ₹ for an advance", () => {
    expect(formatRupees(-750_000)).toBe("-₹7,500");
  });
});
