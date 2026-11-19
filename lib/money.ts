// All money in the app is whole paise (₹1 = 100 paise).

// Turn rupees into paise, e.g. rs(25000) -> 2500000.
export function rs(rupees: number): number {
  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise)) throw new Error(`bad rupee amount: ${rupees}`);
  return paise;
}

const WHOLE = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const WITH_PAISE = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// For screen and speech only: 15000000 -> "₹1,50,000". Never store this.
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const format = abs % 100 === 0 ? WHOLE : WITH_PAISE;
  return `${sign}₹${format.format(abs / 100)}`;
}

// Typed amount -> paise, with string maths so no float rounding: "1,500" -> 150000, "250.5" -> 25050.
// Anything else (minus, letters, 3+ paise digits) gives null.
export function parseRupees(text: string): number | null {
  const match = text.trim().replace(/,/g, "").match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  const paise = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(paise) ? paise : null;
}
