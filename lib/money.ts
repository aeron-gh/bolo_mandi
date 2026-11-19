// All money in the app is whole paise (₹1 = 100 paise).

// Turn rupees into paise, e.g. rs(25000) -> 2500000.
export function rs(rupees: number): number {
  const paise = Math.round(rupees * 100);
  if (!Number.isSafeInteger(paise)) throw new Error(`bad rupee amount: ${rupees}`);
  return paise;
}
