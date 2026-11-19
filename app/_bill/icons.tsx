// Plain line icons in SVG. No emoji, no icon library.
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function KeyboardIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
    </svg>
  );
}

const paths = {
  sound: "M3 10v4m4-8v12m5-16v20m5-16v12m4-8v4",
  chat: "M20 12a8 8 0 0 1-8 8H5l-3 2 1-6a8 8 0 1 1 17-4Z",
  receipt: "M5 3l2 1.5L9.5 3 12 4.5 14.5 3 17 4.5 19 3v18l-2-1.5-2.5 1.5-2.5-1.5L9.5 21 7 19.5 5 21V3Zm4 5h6m-6 4h6m-6 4h3",
  person: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2",
  chart: "M4 19V5m0 14h16M8 15l4-5 3 2 5-7",
  arrow: "m8 16 8-8M8 8h8v8",
  send: "M12 19V5m-6 6 6-6 6 6",
  book: "M12 5v15M3 4c4-1 7-1 9 1 2-2 5-2 9-1v14c-4-1-7-1-9 1-2-2-5-2-9-1V4Z",
  chevron: "m9 18 6-6-6-6",
  speaker: "m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14",
};

export function Icon({ name, className = "size-5" }: IconProps & { name: keyof typeof paths }) {
  return <svg {...base} strokeWidth={1.65} className={className}><path d={paths[name]} /></svg>;
}
