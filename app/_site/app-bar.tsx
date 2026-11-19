import Link from "next/link";
import { Wordmark } from "./wordmark.tsx";

// Slim top bar for the counter, in the MandiPlus app style. The owner label is a display-only demo.
export function AppBar() {
  return (
    <header className="app-bar">
      <div className="app-bar-row">
        <div className="flex min-w-0 items-center">
          <Link href="/" aria-label="MandiPlus Bolo home"><Wordmark /></Link>
          <span className="app-name">Bolo</span>
        </div>
        <div className="app-links">
          <Link href="/help" className="app-link-help">Help</Link>
          <div className="owner-profile">
            <span aria-hidden className="owner-avatar">AM</span>
            <div><strong>Aarav Mehta</strong><small>Demo owner</small></div>
          </div>
        </div>
      </div>
    </header>
  );
}
