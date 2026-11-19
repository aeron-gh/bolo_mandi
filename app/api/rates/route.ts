import { getDb, ownerToken, reply } from "@/lib/server.ts";
import { savePrices } from "@/lib/shop-api.ts";

// PUT /api/rates {1,2,3 in paise} -> new price list, owner only once a PIN exists
export async function PUT(req: Request) {
  return reply(async () => savePrices(getDb(), ownerToken(req), new Date(), await req.json()));
}
