import type { Metadata } from "next";
import { ratesFromSeed, readSeed } from "@/lib/db.ts";
import { BillScreen } from "@/app/_bill/bill-screen.tsx";
import { AppBar } from "@/app/_site/app-bar.tsx";

export const metadata: Metadata = { title: "Bolo" };

// The counter: voice and touch billing on one shared draft.
export default function CounterPage() {
  const rates = ratesFromSeed(readSeed());
  return (
    <>
      <AppBar />
      <BillScreen rates={rates} />
    </>
  );
}
