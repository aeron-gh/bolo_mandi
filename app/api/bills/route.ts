import { getDb, reply, RATES } from "@/lib/server.ts";
import { confirmBill } from "@/lib/api.ts";

// POST /api/bills -> save once per draftId, after the trader said yes
export async function POST(req: Request) {
  return reply(async () => confirmBill(getDb(), RATES, await req.json()));
}
