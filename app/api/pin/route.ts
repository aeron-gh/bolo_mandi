import { getDb, ownerToken, reply } from "@/lib/server.ts";
import { changePin } from "@/lib/shop-api.ts";

// POST /api/pin {pin, currentPin?} -> set the first PIN or change it
export async function POST(req: Request) {
  return reply(async () => changePin(getDb(), ownerToken(req), new Date(), await req.json()));
}
