import { describe, it, expect } from "vitest";
import { cookieValue, crossSite, DEMO_FILE, secureCookies, shopFile } from "../lib/shops.ts";

describe("shop files", () => {
  it("each account gets its own file under shops/", () => {
    expect(shopFile(12)).toMatch(/[/\\]shops[/\\]12\.db$/);
    expect(DEMO_FILE).toMatch(/demo\.db$/);
  });

  it("refuse ids that could point anywhere else", () => {
    for (const id of [0, -1, 1.5, Number.NaN]) expect(() => shopFile(id)).toThrow(/bad user id/);
  });
});

describe("cookieValue", () => {
  it("reads one cookie among many and returns null when absent", () => {
    expect(cookieValue("a=1; bolo_user=abc; bolo_demo=1", "bolo_user")).toBe("abc");
    expect(cookieValue("a=1", "bolo_demo")).toBeNull();
    expect(cookieValue(null, "bolo_demo")).toBeNull();
  });
});

describe("crossSite", () => {
  const h = (init: Record<string, string>) => new Headers(init);

  it("lets our own pages through", () => {
    expect(crossSite(h({ "sec-fetch-site": "same-origin", host: "bolo.in" }))).toBe(false);
    expect(crossSite(h({ origin: "https://bolo.in", host: "bolo.in" }))).toBe(false);
    expect(crossSite(h({ host: "bolo.in" }))).toBe(false);
  });

  it("blocks a form posted from another website", () => {
    expect(crossSite(h({ "sec-fetch-site": "cross-site", host: "bolo.in" }))).toBe(true);
    expect(crossSite(h({ origin: "https://evil.example", host: "bolo.in" }))).toBe(true);
    expect(crossSite(h({ origin: "null", host: "bolo.in" }))).toBe(true);
  });

  it("uses APP_ORIGIN behind a proxy", () => {
    expect(crossSite(h({ origin: "https://bolo.in", host: "127.0.0.1:3000" }), "https://bolo.in")).toBe(false);
    expect(crossSite(h({ origin: "https://evil.example", host: "127.0.0.1:3000" }), "https://bolo.in")).toBe(true);
  });
});

describe("secureCookies", () => {
  it("marks cookies https-only on https, including behind a proxy that talks plain http to the app", () => {
    expect(secureCookies("https://bolo.in/api/auth/login")).toBe(true);
    expect(secureCookies("http://127.0.0.1:3000/api/auth/login", "https://bolo.in")).toBe(true);
  });

  it("keeps plain http working on a laptop", () => {
    expect(secureCookies("http://localhost:3000/api/auth/login")).toBe(false);
    expect(secureCookies("http://localhost:3000/api/auth/login", "http://localhost:3000")).toBe(false);
  });
});
