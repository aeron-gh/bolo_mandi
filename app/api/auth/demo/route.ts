import { cookies } from "next/headers";
import { endUserSession } from "@/lib/accounts.ts";
import { accountsDb, blockCrossSite, clearLoginCookies, cookieOptions, DEMO_COOKIE, reply, USER_COOKIE } from "@/lib/server.ts";
import { cookieValue } from "@/lib/shops.ts";

// POST /api/auth/demo -> skip login and use the shared demo shop
export async function POST(req: Request) {
  return reply(async () => {
    blockCrossSite(req);
    endUserSession(accountsDb(), cookieValue(req.headers.get("cookie"), USER_COOKIE));
    const jar = await cookies();
    clearLoginCookies(jar);
    jar.set(DEMO_COOKIE, "1", cookieOptions(req, 30 * 24 * 60 * 60));
    return { demo: true };
  });
}
