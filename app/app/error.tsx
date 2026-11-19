"use client";
// When a page inside the app fails: say so plainly and offer to try again. Saved bills are never lost here.
import Link from "next/link";

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="page">
      <div className="empty-state" role="alert">
        <h2>This page didn&apos;t open</h2>
        <p>Couldn&apos;t reach the internet or the server. Bills already saved are safe.</p>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 14 }}>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>Try again</button>
          <Link href="/app" className="btn btn-outline">Go to the counter</Link>
        </div>
      </div>
    </main>
  );
}
