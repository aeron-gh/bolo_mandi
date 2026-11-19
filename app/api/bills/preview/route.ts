import { getDb, reply, RATES } from "@/lib/server.ts";
import { previewBill } from "@/lib/api.ts";

// POST /api/bills/preview -> numbers and the read-back sentence. Saves nothing.
export async function POST(req: Request) {
  return reply(async () => previewBill(getDb(), RATES, await req.json()));
}
