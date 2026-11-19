import { connection } from "next/server";
import { readKhata } from "@/lib/api.ts";
import { reply, shopFor } from "@/lib/server.ts";

// GET /api/khata/5 -> outstanding, limit, ledger lines, open promises
export async function GET(req: Request, ctx: RouteContext<"/api/khata/[id]">) {
  await connection();
  const { id } = await ctx.params;
  return reply(() => readKhata(shopFor(req).db, id));
}
