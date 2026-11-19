import { voiceBill } from "@/lib/api.ts";
import { getDb, reply, RATES } from "@/lib/server.ts";

export async function POST(req: Request) {
  return reply(async () => voiceBill(getDb(), RATES, await req.json()));
}
