import { confirmBill } from "@/lib/api.ts";
import { reply, shopFor } from "@/lib/server.ts";
import { getRates } from "@/lib/shop.ts";

// POST /api/bills -> save once per draftId, after the trader said yes
export async function POST(req: Request) {
  return reply(async () => {
    const { db } = shopFor(req);
    return confirmBill(db, getRates(db), await req.json());
  });
}
