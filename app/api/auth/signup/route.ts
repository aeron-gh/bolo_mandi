import { cookies } from "next/headers";
import { createUserSession, signUp } from "@/lib/accounts.ts";
import { asBody } from "@/lib/api.ts";
import { accountsDb, blockCrossSite, reply, setLoginCookies, userShopDb } from "@/lib/server.ts";
import { textField } from "@/lib/shop-api.ts";
import { prefillShop } from "@/lib/shop.ts";

// POST /api/auth/signup {name, email, password, shopName} -> new account with its own empty shop
export async function POST(req: Request) {
  return reply(async () => {
    blockCrossSite(req);
    const b = asBody(await req.json());
    const now = new Date();
    const user = signUp(accountsDb(), { name: textField(b, "name"), email: textField(b, "email"), password: textField(b, "password") }, now);
    prefillShop(userShopDb(user.id), { ownerName: user.name, shopName: textField(b, "shopName") });
    setLoginCookies(await cookies(), req, createUserSession(accountsDb(), user.id, now));
    return { user };
  });
}
