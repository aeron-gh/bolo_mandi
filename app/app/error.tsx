"use client";
// When a page inside the app fails: say so plainly and offer to try again. Saved bills are never lost here.
import Link from "next/link";

export default function AppError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <main className="page">
      <div className="empty-state" role="alert">
        <h2>Yeh page abhi nahi khula</h2>
        <p>Internet ya server se baat nahi hui. Jo bill kat chuke hain, woh surakshit hain.</p>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 14 }}>
          <button type="button" className="btn btn-primary" onClick={() => retry()}>Phir se try karo</button>
          <Link href="/app" className="btn btn-outline">Counter par jao</Link>
        </div>
      </div>
    </main>
  );
}
