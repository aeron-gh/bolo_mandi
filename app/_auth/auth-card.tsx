import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/app/_site/wordmark.tsx";
import { DemoButton } from "./auth-form.tsx";

// Google's "G" mark for the sign-in button.
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.2C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
      <path fill="#FBBC05" d="M10.6 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.2A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l8-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.7-6c-2.2 1.5-5 2.3-8.2 2.3-6.2 0-11.5-4.1-13.4-9.8l-8 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

type Props = { title: string; lead: string; google: boolean; error?: string; children: ReactNode; footer: ReactNode };

// The shared frame of /login and /signup: form, Google, demo, and the link to the other page.
export function AuthCard({ title, lead, google, error, children, footer }: Props) {
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" aria-label="MandiPlus Bolo home" className="auth-brand"><Wordmark /></Link>
        <div>
          <h1>{title}</h1>
          <p className="auth-lead">{lead}</p>
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
        {google && (
          <a className="btn btn-outline btn-block" href="/api/auth/google/start">
            <GoogleMark /> Google se aage badhein
          </a>
        )}
        {google && <p className="auth-or">ya email se</p>}
        {children}
        <p className="auth-or">ya</p>
        <DemoButton />
        <p className="auth-note">Demo dukaan sabke liye ek hai, sample customers ke saath. Apna asli hisaab account mein rakhein.</p>
        <p className="auth-switch">{footer}</p>
      </div>
    </main>
  );
}
