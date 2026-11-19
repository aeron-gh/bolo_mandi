import Image from "next/image";
import { ratesFromSeed, readSeed } from "@/lib/db.ts";
import { BillScreen } from "./_bill/bill-screen.tsx";

export default function Home() {
  const rates = ratesFromSeed(readSeed());
  return (
    <>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-4 sm:gap-3 sm:px-6">
          <Image src="/wordmark.png" alt="Mandi Plus" width={733} height={115} preload className="h-5 w-auto sm:h-6" />
          <span className="border-l border-line pl-3 text-2xl font-semibold leading-none text-coconut">Bolo</span>
          <div className="ml-auto text-right text-xs leading-tight text-[#52627b] lg:hidden">
            <p className="font-semibold text-[#253953]">Aarav Mehta</p>
            <p>Demo owner</p>
          </div>
        </div>
      </header>
      <BillScreen rates={rates} />
    </>
  );
}
