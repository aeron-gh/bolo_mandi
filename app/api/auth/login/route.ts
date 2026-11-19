import { cookies } from "next/headers";
import { createUserSession, logIn } from "@/lib/accounts.ts";
import { asBody } from "@/lib/api.ts";
import { accountsDb, blockCrossSite, reply, setLoginCookies } from "@/lib/server.ts";
import { textField } from "@/lib/shop-api.ts";

// POST /api/auth/login {email, password}
export async function POST(req: Request) {
  return reply(async () => {
    blockCrossSite(req);
    const b = asBody(await req.json());
    const now = new Date();
    const user = logIn(accountsDb(), { email: textField(b, "email"), password: textField(b, "password") }, now);
    setLoginCookies(await cookies(), req, createUserSession(accountsDb(), user.id, now));
    return { user };
  });
}
