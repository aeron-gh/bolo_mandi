import { addAdjustment } from "@/lib/khata-api.ts";
import { ownerToken, reply, shopFor } from "@/lib/server.ts";

// POST /api/adjustments {draftId, customerId, amount, note} -> owner only, once per draftId
export async function POST(req: Request) {
  return reply(async () => addAdjustment(shopFor(req).db, ownerToken(req), new Date(), await req.json()));
}
