import Link from "next/link";

// A bill or customer that does not exist in this shop.
export default function AppNotFound() {
  return (
    <main className="page">
      <div className="empty-state">
        <h2>Yeh is dukaan mein nahi mila</h2>
        <p>Shayad link purana hai, ya yeh kisi aur dukaan ka hai.</p>
        <div className="btn-row" style={{ justifyContent: "center", marginTop: 14 }}>
          <Link href="/app/customers" className="btn btn-outline">Khata</Link>
          <Link href="/app/history" className="btn btn-outline">History</Link>
        </div>
      </div>
    </main>
  );
}
