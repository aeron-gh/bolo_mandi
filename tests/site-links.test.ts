import { describe, it, expect } from "vitest";
import { FOOTER_LINKS, MANDIPLUS_PRODUCTS } from "../app/_site/links.ts";

describe("MandiPlus links", () => {
  it("footer has the five company pages, in mandiplus.com order", () => {
    expect(FOOTER_LINKS.map((l) => l.label)).toEqual(["Products", "Service charges", "Support", "Privacy", "Terms"]);
  });

  it("every company link goes to the real mandiplus.com, never a page we made", () => {
    for (const link of [...FOOTER_LINKS.map((l) => l.href), MANDIPLUS_PRODUCTS]) {
      expect(link).toMatch(/^https:\/\/www\.mandiplus\.com\/[a-z-]+$/);
    }
  });
});
