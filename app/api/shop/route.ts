import { connection } from "next/server";
import { ownerToken, reply, shopFor } from "@/lib/server.ts";
import { readShop, saveShop } from "@/lib/shop-api.ts";

// GET /api/shop -> shop details (never the PIN)
export async function GET(req: Request) {
  await connection();
  return reply(() => readShop(shopFor(req).db));
}

// PUT /api/shop -> owner only once a PIN exists
export async function PUT(req: Request) {
  return reply(async () => saveShop(shopFor(req).db, ownerToken(req), new Date(), await req.json()));
}
