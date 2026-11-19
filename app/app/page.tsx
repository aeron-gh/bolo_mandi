import type { Metadata } from "next";
import type { DatabaseSync } from "node:sqlite";
import { Counter } from "@/app/_bill/counter.tsx";
import { getAccount, type Customer } from "@/lib/customers.ts";
import { currentShop } from "@/lib/server.ts";
import { getRates, getShop } from "@/lib/shop.ts";

export const metadata: Metadata = { title: "Bolo" };

// "/app?customer=5" from a khata page starts the bill for that customer, if this shop has them.
function linkedCustomer(db: DatabaseSync, raw: string | string[] | undefined): Customer | null {
  const id = typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  try {
    const { name } = getAccount(db, id);
    return { id, name };
  } catch {
    return null;
  }
}

// The counter: voice and touch billing on one shared draft, with this shop's own prices.
export default async function CounterPage({ searchParams }: PageProps<"/app">) {
  const { db, key, mode, user } = await currentShop();
  const { customer } = await searchParams;
  const owner = mode === "demo" ? "" : getShop(db).ownerName || user?.name || "";
  const first = db.prepare("SELECT name FROM customers ORDER BY id LIMIT 1").get() as { name: string } | undefined;
  return (
    <Counter rates={getRates(db)} shopKey={key} startCustomer={linkedCustomer(db, customer)}
      greeting={owner.split(" ")[0]} example={first?.name ?? null} />
  );
}
