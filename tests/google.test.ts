import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { checkIdToken, exchangeCode, googleAuthUrl, googleConfig, pkcePair } from "../lib/google.ts";

const CFG = { clientId: "abc.apps.googleusercontent.com", clientSecret: "s3cret", redirectUri: "http://localhost:3000/api/auth/google/callback" };
const NOW = new Date("2026-11-19T06:30:00Z");
const SEC = Math.floor(NOW.getTime() / 1000);
const GOOD = { iss: "https://accounts.google.com", aud: CFG.clientId, exp: SEC + 600, sub: "1234", email: "sita@gmail.com", email_verified: true, name: "Sita", nonce: "n-1" };
const CHECK = { clientId: CFG.clientId, nonce: "n-1", now: NOW };

// A token shaped like Google's: header.payload.signature, each base64url.
function jwt(payload: object): string {
  const part = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  return `${part({ alg: "RS256" })}.${part(payload)}.signature`;
}

describe("googleConfig", () => {
  it("needs the client id, secret and app address", () => {
    expect(googleConfig({})).toBeNull();
    expect(googleConfig({ GOOGLE_CLIENT_ID: "a", GOOGLE_CLIENT_SECRET: "b", APP_ORIGIN: "http://localhost:3000/" })).toEqual({
      clientId: "a", clientSecret: "b", redirectUri: "http://localhost:3000/api/auth/google/callback",
    });
  });
});

describe("PKCE and the sign-in link", () => {
  it("challenge is the base64url SHA-256 of a long random verifier", () => {
    const { verifier, challenge } = pkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43,128}$/);
    expect(challenge).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(pkcePair().verifier).not.toBe(verifier);
  });

  it("asks Google for openid, email, profile with S256, state and nonce", () => {
    const url = new URL(googleAuthUrl(CFG, { state: "st", challenge: "ch", nonce: "n-1" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(url.searchParams)).toMatchObject({
      client_id: CFG.clientId, redirect_uri: CFG.redirectUri, response_type: "code", scope: "openid email profile",
      state: "st", code_challenge: "ch", code_challenge_method: "S256", nonce: "n-1",
    });
  });
});

describe("checkIdToken", () => {
  it("accepts a good token", () => {
    expect(checkIdToken(jwt(GOOD), CHECK)).toEqual({ sub: "1234", email: "sita@gmail.com", name: "Sita", emailVerified: true });
  });

  it.each([
    ["a wrong issuer", { iss: "https://evil.example" }],
    ["another app's token", { aud: "someone-else" }],
    ["an expired token", { exp: SEC - 1 }],
    ["a different nonce", { nonce: "n-2" }],
  ])("rejects %s", (_, change) => {
    expect(() => checkIdToken(jwt({ ...GOOD, ...change }), CHECK)).toThrow();
  });

  it("rejects junk", () => {
    expect(() => checkIdToken("not-a-token", CHECK)).toThrow();
  });
});

describe("exchangeCode", () => {
  it("sends the code with the PKCE verifier and returns the ID token", async () => {
    let sent: { url: string; body: URLSearchParams } | null = null;
    const fakeGoogle = async (url: string, init?: RequestInit) => {
      sent = { url, body: new URLSearchParams(String(init?.body)) };
      return new Response(JSON.stringify({ id_token: "tok" }), { status: 200 });
    };
    expect(await exchangeCode(CFG, "code-1", "ver-1", fakeGoogle)).toBe("tok");
    expect(sent!.url).toBe("https://oauth2.googleapis.com/token");
    expect(Object.fromEntries(sent!.body)).toMatchObject({
      code: "code-1", code_verifier: "ver-1", client_id: CFG.clientId, client_secret: "s3cret",
      redirect_uri: CFG.redirectUri, grant_type: "authorization_code",
    });
  });

  it("throws when Google refuses", async () => {
    const refuse = async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
    await expect(exchangeCode(CFG, "c", "v", refuse)).rejects.toThrow(/Google/);
  });
});
