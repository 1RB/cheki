import type { Metadata } from "next";
import { banks } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Supported Banks and Wallets | cheki",
  description: "All Ethiopian banks and mobile wallets supported by cheki for free receipt verification. CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee.",
};

export default function BanksPage() {
  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>Banks</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "12px" }}>
          Supported banks and wallets
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "600px", marginBottom: "40px" }}>
          cheki supports {banks.length} Ethiopian banks and mobile wallets. All use public receipt endpoints. No authentication, no API key, no charge.
        </p>
        <div className="grid-3" style={{ gap: "20px" }}>
          {banks.map((b) => (
            <a key={b.code} href={`/banks/${b.code}`} style={{
              padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
              display: "flex", flexDirection: "column", gap: "12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: b.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "15px" }}>
                  {b.shortName.slice(0, 3)}
                </div>
                <div>
                  <p style={{ fontSize: "16px", fontWeight: 700 }}>{b.shortName}</p>
                  <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>{b.type === "mobile" ? "Mobile wallet" : b.type === "wallet" ? "Wallet" : "Bank"}</p>
                </div>
                <span style={{
                  marginLeft: "auto", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px",
                  background: b.status === "live" ? "var(--green-light)" : "var(--surface-alt)",
                  color: b.status === "live" ? "var(--green-dark)" : "var(--ink-3)",
                }}>{b.status === "live" ? "Live" : "Soon"}</span>
              </div>
              <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>
                {b.description.slice(0, 120)}...
              </p>
              <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--ink-3)" }}>
                {b.requiresAccount && <span>Account required</span>}
                {b.geoBlocked && <span>Ethiopia only</span>}
                {!b.requiresAccount && !b.geoBlocked && <span>Reference only</span>}
              </div>
            </a>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
