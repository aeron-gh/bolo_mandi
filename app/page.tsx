import Image from "next/image";
import { ratesFromSeed, readSeed } from "@/lib/db.ts";
import { BillScreen } from "./_bill/bill-screen.tsx";

export default function Home() {
  const rates = ratesFromSeed(readSeed());
  return (
    <>
      <header className="flex items-center gap-3 border-b border-rule px-4 py-3 sm:px-8">
        <Image src="/logo.png" alt="Mandi Plus" width={757} height={203} preload className="h-10 w-auto" />
        <span className="text-xl font-semibold text-brand">Bolo</span>
      </header>
      <BillScreen rates={rates} />
    </>
  );
}
