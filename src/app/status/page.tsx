import type { Metadata } from "next";
import { Nav, Footer } from "@/components/Chrome";
import { StatusPill, statusLabel } from "@/components/StatusPill";
import { getEndpointRows } from "@/lib/manifest/endpoints";
import { formatCheckedAt, getBankHealth, healthStatusFor, statusFile } from "@/lib/status-data";
import type { HealthStatus } from "@/lib/health";

export const metadata: Metadata = {
  title: "Endpoint Status: Ethiopian Bank Receipt Checks",
  description: "Daily health check of every bank receipt endpoint cheki uses: which are live, in development, degraded, or not checked from CI.",
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
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "var(--ink)" }}>Status</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "12px" }}>
          Endpoint status
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", lineHeight: 1.6, maxWidth: "720px", marginBottom: "8px" }}>
          Once a day, CI sends each bank a fake reference and checks that the error comes back in the shape we expect. A changed shape usually means the bank moved its endpoint.
        </p>
        <p style={{ fontSize: "14px", color: "var(--ink-3)", marginBottom: "24px" }}>
          Last checked {formatCheckedAt(statusFile.generatedAt)} from {statusFile.runner}.{" "}
          {!statusFile.checkedGeoRestricted && "Geo-restricted endpoints only answer Ethiopian IPs, so CI does not check them. "}
          Raw data: <a href="/status.json" style={{ color: "var(--green-dark)" }}>status.json</a>. Details per bank: <a href="/endpoints" style={{ color: "var(--green-dark)" }}>endpoint reference</a>.
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
              <tr><th>Bank</th><th>Status</th><th>What we saw</th><th>Unknown-reference response</th><th>Last checked</th></tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.bank.id}>
                  <td><a href={`/endpoints#${r.bank.id}`} style={{ color: "var(--green-dark)", fontWeight: 600 }}>{r.doc.label}</a></td>
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
