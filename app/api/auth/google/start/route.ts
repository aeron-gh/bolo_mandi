import { NextResponse } from "next/server";
import { googleAuthUrl, googleConfig, pkcePair, randomToken } from "@/lib/google.ts";
import { appOrigin, cookieOptions } from "@/lib/server.ts";

// GET /api/auth/google/start -> off to Google, remembering state, nonce and the PKCE verifier for 10 minutes
export async function GET(req: Request) {
  const cfg = googleConfig(process.env);
  if (!cfg) return NextResponse.redirect(new URL("/login?error=google_off", appOrigin(req)));
  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = pkcePair();
  const res = NextResponse.redirect(googleAuthUrl(cfg, { state, challenge, nonce }));
  const options = { ...cookieOptions(req, 600), path: "/api/auth/google" };
  res.cookies.set("g_state", state, options);
  res.cookies.set("g_verifier", verifier, options);
  res.cookies.set("g_nonce", nonce, options);
  return res;
}
