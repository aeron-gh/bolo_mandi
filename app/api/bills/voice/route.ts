import { voiceBill } from "@/lib/api.ts";
import { reply, shopFor } from "@/lib/server.ts";
import { getRates } from "@/lib/shop.ts";

// POST /api/bills/voice -> what the spoken words mean for the bill. Saves nothing.
export async function POST(req: Request) {
  return reply(async () => {
    const { db } = shopFor(req);
    return voiceBill(db, getRates(db), await req.json(), new Date());
  });
}
