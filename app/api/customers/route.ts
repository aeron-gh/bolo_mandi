import { connection, type NextRequest } from "next/server";
import { createCustomer, searchCustomers } from "@/lib/api.ts";
import { reply, shopFor } from "@/lib/server.ts";

// GET /api/customers?q=Afzal -> found, ambiguous, not_found or unclear
export async function GET(req: NextRequest) {
  await connection();
  return reply(() => searchCustomers(shopFor(req).db, req.nextUrl.searchParams.get("q")));
}

// POST /api/customers {name} -> only after the trader said "haan, add karo"
export async function POST(req: Request) {
  return reply(async () => createCustomer(shopFor(req).db, await req.json()));
}
