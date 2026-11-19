import { cookies } from "next/headers";
import { endUserSession } from "@/lib/accounts.ts";
import { accountsDb, blockCrossSite, clearLoginCookies, reply, USER_COOKIE } from "@/lib/server.ts";
import { cookieValue } from "@/lib/shops.ts";

// POST /api/auth/logout -> end this device's login (and leave demo mode)
export async function POST(req: Request) {
  return reply(async () => {
    blockCrossSite(req);
    endUserSession(accountsDb(), cookieValue(req.headers.get("cookie"), USER_COOKIE));
    clearLoginCookies(await cookies());
    return { loggedOut: true };
  });
}
