import { previewBill } from "@/lib/api.ts";
import { reply, shopFor } from "@/lib/server.ts";
import { getRates } from "@/lib/shop.ts";

// POST /api/bills/preview -> numbers and the read-back sentence. Saves nothing.
export async function POST(req: Request) {
  return reply(async () => {
    const { db } = shopFor(req);
    return previewBill(db, getRates(db), await req.json());
  });
}
