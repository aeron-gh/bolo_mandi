// Google login without a library: OAuth 2.0 authorization code flow with PKCE (Google OpenID Connect docs).
import { createHash, randomBytes } from "node:crypto";
import type { GoogleProfile } from "./accounts.ts";

export type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string };
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

// Read settings from the environment; null hides the Google button.
export function googleConfig(env: Record<string, string | undefined>): GoogleConfig | null {
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, APP_ORIGIN: origin } = env;
  if (!clientId || !clientSecret || !origin) return null;
  return { clientId, clientSecret, redirectUri: new URL("/api/auth/google/callback", origin).toString() };
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

// PKCE: Google only hands out the token to whoever holds the verifier behind this challenge.
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomToken();
  return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
}

export function googleAuthUrl(cfg: GoogleConfig, p: { state: string; challenge: string; nonce: string }): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: p.state,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
    nonce: p.nonce,
    prompt: "select_account",
  }).toString();
  return url.toString();
}

// Swap the one-time code (plus the PKCE verifier) for Google's ID token, server to server.
export async function exchangeCode(cfg: GoogleConfig, code: string, verifier: string, fetchFn: FetchFn = fetch): Promise<string> {
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, code_verifier: verifier, client_id: cfg.clientId, client_secret: cfg.clientSecret,
      redirect_uri: cfg.redirectUri, grant_type: "authorization_code",
    }).toString(),
  });
  const data = (await res.json().catch(() => ({}))) as { id_token?: unknown };
  if (!res.ok || typeof data.id_token !== "string") throw new Error("Google login fail hua");
  return data.id_token;
}

// Check the ID token's claims. Its signature is not checked because it came straight from Google's
// token endpoint over TLS, which OpenID Connect Core 3.1.3.7 allows in place of a signature check.
export function checkIdToken(idToken: string, expect: { clientId: string; nonce: string; now: Date }): GoogleProfile {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Google token sahi nahi hai");
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("Google token sahi nahi hai");
  }
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!ISSUERS.includes(String(claims.iss))) throw new Error("Google token: wrong issuer");
  if (!aud.includes(expect.clientId)) throw new Error("Google token: wrong audience");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= expect.now.getTime()) throw new Error("Google token: expired");
  if (claims.nonce !== expect.nonce) throw new Error("Google token: wrong nonce");
  if (typeof claims.sub !== "string" || typeof claims.email !== "string") throw new Error("Google token: missing account");
  return { sub: claims.sub, email: claims.email, name: typeof claims.name === "string" ? claims.name : "", emailVerified: claims.email_verified === true };
}
