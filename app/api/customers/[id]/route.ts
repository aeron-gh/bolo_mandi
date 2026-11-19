import { saveCustomer } from "@/lib/khata-api.ts";
import { ownerToken, reply, shopFor } from "@/lib/server.ts";

// PATCH /api/customers/5 {name?, phone?, creditLimit?} -> a new limit needs the owner
export async function PATCH(req: Request, ctx: RouteContext<"/api/customers/[id]">) {
  const { id } = await ctx.params;
  return reply(async () => saveCustomer(shopFor(req).db, ownerToken(req), new Date(), id, await req.json()));
}
