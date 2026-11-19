import { cookies } from "next/headers";
import { getDb, ownerToken, reply } from "@/lib/server.ts";
import { lock, SESSION_COOKIE, unlock } from "@/lib/shop-api.ts";

// POST /api/session {pin} -> unlock for 12 hours (httpOnly cookie)
export async function POST(req: Request) {
  return reply(async () => {
    const token = unlock(getDb(), new Date(), await req.json());
    const secure = new URL(req.url).protocol === "https:";
    (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 12 * 60 * 60, secure });
    return { unlocked: true };
  });
}

// DELETE /api/session -> lock again
export async function DELETE(req: Request) {
  return reply(async () => {
    lock(getDb(), ownerToken(req));
    (await cookies()).delete(SESSION_COOKIE);
    return { unlocked: false };
  });
}
