import type { Metadata } from "next";
import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { getEndpointRows } from "@/lib/manifest/endpoints";
import { formatCheckedAt, getBankHealth, healthStatusFor, statusFile } from "@/lib/status-data";
import type { HealthStatus } from "@/lib/health";

export const metadata: Metadata = {
  title: "Endpoint Status: Ethiopian Bank Receipt Checks",
  description: "Daily health check of every bank receipt endpoint cheki uses: which are live, in development, degraded, or not checked from CI. Endpoint health only; it never verifies a receipt.",
  alternates: { canonical: "/status" },
};

const ORDER: HealthStatus[] = ["degraded", "live", "not-checked", "in-development"];

export default function StatusPage() {
  const rows = getEndpointRows().map((r) => ({ ...r, health: getBankHealth(r.bank.id), status: healthStatusFor(r.bank) }));
  const counts = ORDER.map((s) => ({ s, n: rows.filter((r) => r.status === s).length })).filter((c) => c.n > 0);
  const sorted = [...rows].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status));

  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <Link href="/" style={{ color: "var(--ink-3)" }}>Home</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "var(--ink)" }}>Status</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "12px" }}>
          Endpoint status
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", lineHeight: 1.6, maxWidth: "720px", marginBottom: "8px" }}>
          Once a day, CI sends each bank a fake reference and checks that the error comes back in the shape we expect. A changed shape usually means the bank moved its endpoint.
        </p>
        <p style={{ color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.6, maxWidth: "720px", marginBottom: "8px" }}>
          This is about the endpoints, not about any receipt. <strong>Live</strong> means cheki checks receipts for that bank and its endpoint answered as expected; a receipt only counts as verified when the bank&apos;s own record confirms it. <strong>In development</strong> banks are not checked by cheki yet, whatever their endpoint does. For a fresher reachability snapshot, <code>GET /api/health</code> probes the live banks (cached for 5 minutes).
        </p>
        <p style={{ fontSize: "14px", color: "var(--ink-3)", marginBottom: "24px" }}>
          Last recorded {formatCheckedAt(statusFile.generatedAt)} from {statusFile.runner}. CI runs daily and only records a new snapshot when a result changes.{" "}
          {!statusFile.checkedGeoRestricted && "Geo-restricted endpoints only answer Ethiopian IPs, so CI does not check them. "}
          Raw data: <a href="/status.json" style={{ color: "var(--green-dark)" }}>status.json</a>. Details per bank: <Link href="/endpoints" style={{ color: "var(--green-dark)" }}>endpoint reference</Link>.
        </p>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "24px" }}>
          {counts.map((c) => (
            <span key={c.s} style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "var(--ink-2)" }}>
              <StatusPill status={c.s} /> {c.n}
            </span>
          ))}
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Bank</th><th>Status</th><th>What we saw</th><th>Unknown-reference response</th><th>Recorded</th></tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.bank.id}>
                  <td><Link href={`/endpoints#${r.bank.id}`} style={{ color: "var(--green-dark)", fontWeight: 600 }}>{r.doc.label}</Link></td>
                  <td><StatusPill status={r.status} /></td>
                  <td>{r.health?.detail ?? `${statusLabel(r.status)}. Not checked yet.`}</td>
                  <td>{r.health?.observed ? <code style={{ wordBreak: "break-word" }}>{r.health.observed}</code> : "None"}</td>
                  <td>{formatCheckedAt(r.health?.checkedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <Footer />
    </>
  );
}
