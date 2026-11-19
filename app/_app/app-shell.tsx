import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/app/_site/wordmark.tsx";
import { NavLinks } from "./nav-links.tsx";

// "Ram Fruit Co" -> "RF"; one word -> its first two letters.
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "B";
  const letters = words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0];
  return letters.toUpperCase();
}

type Props = { title: string; subtitle: string; demo: boolean; children: ReactNode };

// Sidebar on wide screens; top bar and bottom tabs on phones and tablets. The avatar opens the profile.
export function AppShell({ title, subtitle, demo, children }: Props) {
  const avatar = <span aria-hidden className="owner-avatar">{initials(title)}</span>;
  return (
    <div className="shell">
      <aside className="shell-side">
        <Link href="/app" className="shell-brand" aria-label="MandiPlus Bolo counter"><Wordmark /><span className="shell-app">Bolo</span></Link>
        <nav className="shell-nav" aria-label="App"><NavLinks /></nav>
        {demo && (
          <div className="demo-card">
            <strong>Demo shop</strong>
            <p>Shared by everyone. Data can be reset at any time.</p>
            <Link href="/signup" className="btn btn-primary btn-sm">Create your account</Link>
          </div>
        )}
        <Link href="/app/profile" className="shell-owner">
          {avatar}
          <span><strong>{title}</strong><small>{subtitle}</small></span>
        </Link>
      </aside>
      <header className="shell-top">
        <span className="shell-top-brand">
          <Link href="/app" aria-label="MandiPlus Bolo counter"><Wordmark /><span className="shell-app">Bolo</span></Link>
          {demo && <Link href="/signup" className="demo-chip">Demo</Link>}
        </span>
        <Link href="/app/profile" className="shell-owner" aria-label={`Profile: ${title}`}>{avatar}</Link>
      </header>
      <div className="shell-main">{children}</div>
      <nav className="shell-tabs" aria-label="App"><NavLinks /></nav>
    </div>
  );
}
