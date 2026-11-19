import { connection } from "next/server";
import { getDb, reply } from "@/lib/server.ts";
import { readKhata } from "@/lib/api.ts";

// GET /api/khata/5 -> outstanding, limit, ledger lines, open promises
export async function GET(_req: Request, ctx: RouteContext<"/api/khata/[id]">) {
  await connection();
  const { id } = await ctx.params;
  return reply(() => readKhata(getDb(), id));
}
