"use client";

import { Icon } from "@/app/_bill/icons.tsx";

// The browser's own print box; the print stylesheet keeps only the receipt.
export function PrintButton() {
  return (
    <button type="button" className="btn btn-outline" onClick={() => window.print()}>
      <Icon name="print" /> Print
    </button>
  );
}
