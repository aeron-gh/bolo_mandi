"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/app/_bill/icons.tsx";

const TABS = [
  { href: "/app", label: "Bill", icon: "receipt" },
  { href: "/app/customers", label: "Ledger", icon: "book" },
  { href: "/app/history", label: "History", icon: "clock" },
  { href: "/app/profile", label: "Profile", icon: "person" },
] as const;

// The four places a shop owner goes. The current one is marked for screen readers too.
export function NavLinks() {
  const path = usePathname();
  return (
    <>
      {TABS.map((tab) => {
        const active = tab.href === "/app" ? path === "/app" : path.startsWith(tab.href);
        return (
          <Link key={tab.href} href={tab.href} className="nav-item" aria-current={active ? "page" : undefined}>
            <Icon name={tab.icon} />
            {tab.label}
          </Link>
        );
      })}
    </>
  );
}
