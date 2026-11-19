import { connection, type NextRequest } from "next/server";
import { searchCustomers } from "@/lib/api.ts";
import { newCustomer } from "@/lib/khata-api.ts";
import { ownerToken, reply, shopFor } from "@/lib/server.ts";

// GET /api/customers?q=Afzal -> found, ambiguous, not_found or unclear
export async function GET(req: NextRequest) {
  await connection();
  return reply(() => searchCustomers(shopFor(req).db, req.nextUrl.searchParams.get("q")));
}

// POST /api/customers {name, phone?, creditLimit?} -> only after the trader said "haan, add karo".
// A limit above ₹0 needs the owner.
export async function POST(req: Request) {
  return reply(async () => newCustomer(shopFor(req).db, ownerToken(req), new Date(), await req.json()));
}
