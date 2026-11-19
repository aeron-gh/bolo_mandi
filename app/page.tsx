import { ratesFromSeed, readSeed } from "@/lib/db.ts";
import { BillScreen } from "./_bill/bill-screen.tsx";
import { Icon } from "./_bill/icons.tsx";

export default function Home() {
  const rates = ratesFromSeed(readSeed());
  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <span aria-hidden className="brand-symbol"><Icon name="sound" /></span>
            <span>Bolo</span>
            <span className="brand-parent">MandiPlus</span>
          </div>
          <div className="owner-profile">
            <span aria-hidden className="owner-avatar">AM</span>
            <div><strong>Aarav Mehta</strong><small>Demo owner</small></div>
          </div>
        </div>
      </header>
      <BillScreen rates={rates} />
    </>
  );
}
