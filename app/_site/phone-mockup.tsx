import { SiteIcon } from "./site-icons.tsx";

// A Bolo bill drawn in HTML inside a phone frame. Seed numbers: Manat owes ₹12,500 before this bill.
export function PhoneMockup() {
  return (
    <div className="phone" role="img" aria-label="Bolo screen: Manat's bill ₹15,000, ₹4,000 cash, ₹11,000 on credit">
      <div className="phone-screen" aria-hidden>
        <p className="phone-said">Manat ko 10 piece grade 1, 4 hazaar cash</p>
        <div className="phone-card">
          <p className="font-display text-lg font-semibold">Manat</p>
          <div className="phone-row"><span>Grade 1 · 10 × ₹1,500</span><span>₹15,000</span></div>
          <div className="phone-row"><span>Cash</span><span>₹4,000</span></div>
          <div className="phone-row"><span>On credit</span><span>₹11,000</span></div>
          <div className="phone-total"><span>Total</span><strong>₹15,000</strong></div>
          <p className="mt-2 text-xs text-muted">New credit total ₹23,500. Save the bill?</p>
        </div>
        <div className="phone-mic"><SiteIcon name="mic" className="size-7" /></div>
      </div>
    </div>
  );
}
