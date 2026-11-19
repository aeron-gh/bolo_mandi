import Link from "next/link";
import { MANDIPLUS_PRODUCTS } from "./links.ts";
import { SiteIcon } from "./site-icons.tsx";
import { Wordmark } from "./wordmark.tsx";

type Page = "bolo" | "help";

// Desktop shows the links in a row; phones get a no-JavaScript <details> menu with the same links.
export function SiteHeader({ current }: { current: Page }) {
  const links = (
    <>
      <Link href="/" aria-current={current === "bolo" ? "page" : undefined}>Bolo</Link>
      <Link href="/help" aria-current={current === "help" ? "page" : undefined}>Help</Link>
      <a href={MANDIPLUS_PRODUCTS} target="_blank" rel="noopener noreferrer">Products</a>
      <Link href="/app" className="btn btn-primary btn-sm">Open Bolo</Link>
    </>
  );
  return (
    <header className="site-header">
      <div className="site-inner site-header-row">
        <Link href="/" aria-label="MandiPlus Bolo"><Wordmark /></Link>
        <nav className="site-nav" aria-label="Main">{links}</nav>
        <details className="site-menu">
          <summary aria-label="Menu"><SiteIcon name="menu" /></summary>
          <nav className="site-menu-panel" aria-label="Menu">{links}</nav>
        </details>
      </div>
    </header>
  );
}
