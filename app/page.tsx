import Image from "next/image";
import { ratesFromSeed, readSeed } from "@/lib/db.ts";
import { BillScreen } from "./_bill/bill-screen.tsx";

export default function Home() {
  const rates = ratesFromSeed(readSeed());
  return (
    <>
      {/* items-baseline: an image's baseline is its bottom edge, which is the wordmark's baseline. */}
      <header className="flex items-baseline gap-2 border-b border-line px-4 py-3 sm:px-6">
        <Image src="/wordmark.png" alt="Mandi Plus" width={733} height={115} preload className="h-6 w-auto" />
        <span className="text-[1.625rem] font-semibold leading-none">Bolo</span>
      </header>
      <BillScreen rates={rates} />
    </>
  );
}
