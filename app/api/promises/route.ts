import { addPromise } from "@/lib/khata-api.ts";
import { reply, shopFor } from "@/lib/server.ts";

// POST /api/promises {draftId, customerId, amount, due} -> a payment promise, once per draftId
export async function POST(req: Request) {
  return reply(async () => addPromise(shopFor(req).db, await req.json(), new Date()));
}
