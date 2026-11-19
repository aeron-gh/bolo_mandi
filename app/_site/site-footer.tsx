import { FOOTER_LINKS } from "./links.ts";
import { Wordmark } from "./wordmark.tsx";

// Black footer like mandiplus.com. Company pages open the real ones there. No year: it would be a render-time date.
export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-inner">
        <div className="footer-top">
          <div>
            <Wordmark onDark />
            <p>Bolo: mandi bills, by voice.</p>
          </div>
          <nav className="footer-links" aria-label="MandiPlus">
            {FOOTER_LINKS.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">{link.label}</a>
            ))}
          </nav>
        </div>
        <p className="footer-note">Bolo understands Hindi and Hinglish. It works best in Chrome.</p>
      </div>
    </footer>
  );
}
