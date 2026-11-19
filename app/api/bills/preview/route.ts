import { getDb, reply } from "@/lib/server.ts";
import { getRates } from "@/lib/shop.ts";
import { previewBill } from "@/lib/api.ts";

// POST /api/bills/preview -> numbers and the read-back sentence. Saves nothing.
export async function POST(req: Request) {
  return reply(async () => previewBill(getDb(), getRates(getDb()), await req.json()));
}
