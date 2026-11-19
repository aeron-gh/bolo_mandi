import { addPayment } from "@/lib/khata-api.ts";
import { reply, shopFor } from "@/lib/server.ts";

// POST /api/payments {draftId, customerId, amount, mode?, allowAdvance?} -> vasooli, once per draftId
export async function POST(req: Request) {
  return reply(async () => addPayment(shopFor(req).db, await req.json()));
}
