import { describe, it, expect } from "vitest";
import { indiaDateTime, indiaDayLabel } from "../lib/dates.ts";
import { parseRupees } from "../lib/money.ts";

describe("parseRupees (typed amount -> paise)", () => {
  it("reads whole rupees, Indian commas and up to two paise digits", () => {
    expect(parseRupees("1500")).toBe(150000);
    expect(parseRupees(" 1,50,000 ")).toBe(15000000);
    expect(parseRupees("250.5")).toBe(25050);
    expect(parseRupees("0.07")).toBe(7);
  });

  it("gives null for anything that is not a plain amount", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e5", "₹", "12 34"]) expect(parseRupees(bad)).toBeNull();
  });
});

describe("India time for stored UTC times", () => {
  it("shows the India date and time", () => {
    expect(indiaDateTime("2026-11-19 17:45:00")).toBe("19 Nov, 11:15 pm");
    expect(indiaDateTime("2026-11-19 19:00:00")).toBe("20 Nov, 12:30 am");
  });

  it("names a YYYY-MM-DD day", () => {
    expect(indiaDayLabel("2026-11-21")).toBe("21 Nov 2026");
  });
});
