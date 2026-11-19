import Link from "next/link";

// A bill or customer that does not exist in this shop.
export default function AppNotFound() {
  return (
    <main className="page">
      <div className="empty-state">
        <h2>Not found in this shop</h2>
        <p>The link may be old, or it may belong to another shop.</p>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 14 }}>
          <Link href="/app/customers" className="btn btn-outline">Ledger</Link>
          <Link href="/app/history" className="btn btn-outline">History</Link>
        </div>
      </div>
    </main>
  );
}
