import { NextResponse, type NextRequest } from "next/server";
import { createUserSession, googleUser } from "@/lib/accounts.ts";
import { checkIdToken, exchangeCode, googleConfig } from "@/lib/google.ts";
import { accountsDb, appOrigin, setLoginCookies, userShopDb } from "@/lib/server.ts";
import { prefillShop } from "@/lib/shop.ts";

// GET /api/auth/google/callback?code&state -> check everything, sign in, go to the counter
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const fail = (why: string) => NextResponse.redirect(new URL(`/login?error=${why}`, origin));
  const cfg = googleConfig(process.env);
  if (!cfg) return fail("google_off");
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const [saved, verifier, nonce] = ["g_state", "g_verifier", "g_nonce"].map((name) => req.cookies.get(name)?.value);
  if (!code || !state || !saved || state !== saved || !verifier || !nonce) return fail("google");
  try {
    const now = new Date();
    const profile = checkIdToken(await exchangeCode(cfg, code, verifier), { clientId: cfg.clientId, nonce, now });
    const user = googleUser(accountsDb(), profile, now);
    prefillShop(userShopDb(user.id), { ownerName: user.name, shopName: "" });
    const res = NextResponse.redirect(new URL("/app", origin));
    setLoginCookies(res.cookies, req, createUserSession(accountsDb(), user.id, now));
    for (const name of ["g_state", "g_verifier", "g_nonce"]) res.cookies.set(name, "", { path: "/api/auth/google", maxAge: 0 });
    return res;
  } catch {
    return fail("google");
  }
}
