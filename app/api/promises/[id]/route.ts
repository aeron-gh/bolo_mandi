import { markPromise } from "@/lib/khata-api.ts";
import { reply, shopFor } from "@/lib/server.ts";

// PATCH /api/promises/3 {status: "kept" | "broken"}
export async function PATCH(req: Request, ctx: RouteContext<"/api/promises/[id]">) {
  const { id } = await ctx.params;
  return reply(async () => markPromise(shopFor(req).db, id, await req.json()));
}
