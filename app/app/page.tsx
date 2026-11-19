import type { Metadata } from "next";
import { BillScreen } from "@/app/_bill/bill-screen.tsx";
import { AppBar } from "@/app/_site/app-bar.tsx";
import { currentShop } from "@/lib/server.ts";
import { getRates } from "@/lib/shop.ts";

export const metadata: Metadata = { title: "Bolo" };
// Each visit reads the signed-in shop, so the counter is never prerendered.
export const instant = false;

// The counter: voice and touch billing on one shared draft, with this shop's own prices.
export default async function CounterPage() {
  const { db } = await currentShop();
  return (
    <>
      <AppBar />
      <BillScreen rates={getRates(db)} />
    </>
  );
}
