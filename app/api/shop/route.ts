import { connection } from "next/server";
import { getDb, ownerToken, reply } from "@/lib/server.ts";
import { readShop, saveShop } from "@/lib/shop-api.ts";

// GET /api/shop -> shop details (never the PIN)
export async function GET() {
  await connection();
  return reply(() => readShop(getDb()));
}

// PUT /api/shop -> owner only once a PIN exists
export async function PUT(req: Request) {
  return reply(async () => saveShop(getDb(), ownerToken(req), new Date(), await req.json()));
}
