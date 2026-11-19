import { ownerToken, reply, shopFor } from "@/lib/server.ts";
import { changePin } from "@/lib/shop-api.ts";

// POST /api/pin {pin, currentPin?} -> set the first PIN or change it. Not in the shared demo shop.
export async function POST(req: Request) {
  return reply(async () => {
    const shop = shopFor(req);
    if (shop.mode === "demo") throw new Error("The demo shop has no PIN. Create your own account to set one.");
    return changePin(shop.db, ownerToken(req), new Date(), await req.json());
  });
}
