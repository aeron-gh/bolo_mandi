"use client";
// The counter needs the bill left open on this device, which only the browser knows, so it renders there.
import dynamic from "next/dynamic";

export const Counter = dynamic(() => import("./bill-screen.tsx").then((m) => m.BillScreen), {
  ssr: false,
  loading: () => <div className="counter-loading" role="status">Counter khul raha hai…</div>,
});
