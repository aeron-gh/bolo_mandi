import { connection, type NextRequest } from "next/server";
import { getDb, reply } from "@/lib/server.ts";
import { createCustomer, searchCustomers } from "@/lib/api.ts";

// GET /api/customers?q=Afzal -> found, ambiguous, not_found or unclear
export async function GET(req: NextRequest) {
  await connection();
  return reply(() => searchCustomers(getDb(), req.nextUrl.searchParams.get("q")));
}

// POST /api/customers {name} -> only after the trader said "haan, add karo"
export async function POST(req: Request) {
  return reply(async () => createCustomer(getDb(), await req.json()));
}
