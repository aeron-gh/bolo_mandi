import { voiceBill } from "@/lib/api.ts";
import { getDb, reply } from "@/lib/server.ts";
import { getRates } from "@/lib/shop.ts";

export async function POST(req: Request) {
  return reply(async () => voiceBill(getDb(), getRates(getDb()), await req.json()));
}
