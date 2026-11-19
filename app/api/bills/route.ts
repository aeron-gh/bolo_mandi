import { getDb, reply } from "@/lib/server.ts";
import { getRates } from "@/lib/shop.ts";
import { confirmBill } from "@/lib/api.ts";

// POST /api/bills -> save once per draftId, after the trader said yes
export async function POST(req: Request) {
  return reply(async () => confirmBill(getDb(), getRates(getDb()), await req.json()));
}
