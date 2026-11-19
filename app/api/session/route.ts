import { cookies } from "next/headers";
import { cookieOptions, ownerToken, reply, shopFor } from "@/lib/server.ts";
import { lock, SESSION_COOKIE, unlock } from "@/lib/shop-api.ts";

// POST /api/session {pin} -> unlock owner actions for 12 hours (httpOnly cookie)
export async function POST(req: Request) {
  return reply(async () => {
    const token = unlock(shopFor(req).db, new Date(), await req.json());
    (await cookies()).set(SESSION_COOKIE, token, cookieOptions(req, 12 * 60 * 60));
    return { unlocked: true };
  });
}

// DELETE /api/session -> lock owner actions again
export async function DELETE(req: Request) {
  return reply(async () => {
    lock(shopFor(req).db, ownerToken(req));
    (await cookies()).delete(SESSION_COOKIE);
    return { unlocked: false };
  });
}
