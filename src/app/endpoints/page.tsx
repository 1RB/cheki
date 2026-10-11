import type { Metadata } from "next";
import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { CodeBlock } from "@/components/CodeBlock";
import { StatusPill } from "@/components/StatusPill";
import { changelogFor, getEndpointRows, REPO_URL, REPORT_CHANGE_URL, type EndpointRow } from "@/lib/manifest/endpoints";
import { primaryFormat, secondaryFormats, templateHost } from "@/lib/manifest/formats";
import type { ReceiptFormat } from "@/lib/core/types";
import { formatCheckedAt, getBankHealth, healthStatusFor, statusFile } from "@/lib/status-data";

const TITLE = "Ethiopian Bank Receipt Endpoints: Reference for Developers";
const DESCRIPTION =
  "Every public receipt endpoint cheki uses, generated from its bank manifest: current format first, legacy formats, where to find each placeholder, unknown-reference error shapes, gotchas, and a dated changelog.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/endpoints" },
  openGraph: {
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki - verify Ethiopian receipts for free" }],
    title: TITLE,
    description: DESCRIPTION,
    type: "article",
    url: "https://cheki.et/endpoints",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function responseTypeLabel({ bank, doc }: EndpointRow): string {
  if (doc.responseTypeLabel) return doc.responseTypeLabel;
  return bank.responseType === "pdf" ? "PDF" : bank.responseType === "json" ? "JSON" : "HTML";
}

function hasEndpoint({ bank }: EndpointRow): boolean {
  return /^https?:\/\//i.test(bank.endpointFormat ?? bank.endpoint);
}

const h3: React.CSSProperties = { fontSize: "13px", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "22px 0 8px" };
const small: React.CSSProperties = { fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.6 };
const tag: React.CSSProperties = { display: "inline-block", fontSize: "11px", fontWeight: 600, padding: "1px 8px", borderRadius: "4px", background: "var(--amber-light)", color: "var(--amber-text)", marginLeft: "6px" };


const fmtLabel = (rt: ReceiptFormat["responseType"]) => (rt === "pdf" ? "PDF" : rt === "json" ? "JSON" : "HTML");

function FormatSummary({ f, bankId }: { f: ReceiptFormat; bankId: string }) {
  const health = getBankHealth(`${bankId}:${f.id}`);
  const template = f.link ?? f.endpoint;
  return (
    <li style={{ ...small, marginBottom: "12px" }}>
      <strong>{f.label}</strong>
      <span style={tag}>{f.status === "current" ? "Newer, not supported yet" : f.status === "legacy" ? "Legacy" : "Deprecated"}</span>
      {f.confidence === "inferred" && <span style={tag}>Inferred</span>}
      <br />
      {template ? <code style={{ wordBreak: "break-all" }}>{template}</code> : <>Host: <code>{(f.linkHosts ?? []).join(", ")}</code></>}
      {f.endpoint && f.link && templateHost(f.endpoint) !== templateHost(f.link) && <> (cheki fetches <code style={{ wordBreak: "break-all" }}>{f.endpoint}</code>)</>}
      <br />
      Needs: {f.inputs.map((i) => i.label).join(" + ")}. Response: {fmtLabel(f.responseType)}.
      {f.since ? ` Since ${f.since}.` : ""}
      {f.deprecatedAt ? ` Retired ${f.deprecatedAt}.` : ""}
      {f.replacedBy ? ` Replaced by the current format.` : ""}
      {f.status === "legacy" && f.parser ? " cheki still checks it." : f.status === "deprecated" ? " cheki never fetches it; links are read for their reference only." : !f.parser ? " cheki does not read it yet." : ""}
      {f.notes ? <> {f.notes}</> : null}
      <br />
      <span style={{ color: "var(--ink-3)" }}>Evidence: {f.evidence}</span>
      {health && <><br />Last check: {health.detail} ({formatCheckedAt(health.checkedAt)})</>}
    </li>
  );
}

function EndpointCard({ row }: { row: EndpointRow }) {
  const { bank, doc } = row;
  const template = bank.endpointFormat ?? bank.endpoint;
  const live = bank.status === "live";
  const hasBankPage = !doc.aliasOf;
  const current = primaryFormat(bank);
  const others = secondaryFormats(bank);
  const older = others.filter((f) => f.status !== "current");
  const newerUnsupported = others.filter((f) => f.status === "current");
  const changelog = changelogFor(row);
  return (
    <article
      id={bank.id}
      style={{ padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)", marginBottom: "20px", scrollMarginTop: "calc(var(--nav-h) + 16px)" }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <h2 style={{ fontSize: "22px", fontWeight: 800, letterSpacing: "-0.02em" }}>
          <a href={`#${bank.id}`} style={{ color: "var(--ink)" }}>{doc.label}</a>
        </h2>
        <span style={{ fontSize: "14px", color: "var(--ink-3)" }}>{bank.name}</span>
        <span style={{ marginLeft: "auto" }}><StatusPill status={healthStatusFor(bank)} /></span>
      </header>

      {!live && hasBankPage && (
        <p style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "var(--surface-alt)", ...small }}>
          <strong>In development, help us.</strong> A real receipt link is what we need to finish this one.{" "}
          <Link href={`/banks/${bank.id}#contribute`} style={{ color: "var(--green-dark)", fontWeight: 600 }}>Send one privately</Link>.
        </p>
      )}

      <h3 style={h3}>{older.length > 0 ? "Current format" : "Template URL"}</h3>
      {current && older.length > 0 && <p style={{ ...small, marginBottom: "8px" }}><strong>{current.label}</strong>. {current.notes}</p>}
      {hasEndpoint(row) ? (
        <CodeBlock code={template} highlightedHtml={escapeHtml(template)} langLabel="url" />
      ) : (
        <p style={small}>No public receipt endpoint is known yet.</p>
      )}
      {current?.endpoint && current.link && templateHost(current.endpoint) !== templateHost(current.link) && (
        <p style={{ ...small, marginTop: "8px" }}>cheki reads it from <code style={{ wordBreak: "break-all" }}>{current.endpoint}</code>.</p>
      )}

      {doc.placeholders.length > 0 && (
        <>
          <h3 style={h3}>Placeholders</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Placeholder</th><th>What it is</th><th>Where to find it</th><th>Length and pattern</th><th>Traps</th></tr>
              </thead>
              <tbody>
                {doc.placeholders.map((p) => (
                  <tr key={p.name}>
                    <td><code>{p.name}</code>{p.confirmed === false && <span style={tag}>Unconfirmed</span>}</td>
                    <td>{p.what}</td>
                    <td>{p.whereToFind}</td>
                    <td>{p.format}</td>
                    <td>{p.traps ?? "None known"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {doc.redactedExample && (
        <>
          <h3 style={h3}>Redacted example</h3>
          <p style={small}><code style={{ wordBreak: "break-all" }}>{doc.redactedExample}</code></p>
        </>
      )}

      <h3 style={h3}>Response</h3>
      <p style={small}>
        <strong>{responseTypeLabel(row)}</strong>
        {doc.fieldsParsed.length > 0 ? (
          <>. Fields parsed: {doc.fieldsParsed.map((f, i) => <span key={f}>{i > 0 ? ", " : ""}<code>{f}</code></span>)}</>
        ) : (
          <>. No parser yet.</>
        )}
      </p>

      <h3 style={h3}>Unknown-reference error shape</h3>
      <p style={small}>{doc.unknownRef}</p>

      <h3 style={h3}>Gotchas</h3>
      <ul style={{ paddingLeft: "20px", margin: 0, listStyle: "disc" }}>
        {bank.geoBlocked && <li style={small}>Geo-restricted: only Ethiopian IP addresses get an answer. CI runners abroad mark it as not checked.</li>}
        {doc.gotchas.map((g, i) => <li key={i} style={small}>{g}</li>)}
      </ul>

      {older.length > 0 && (
        <>
          <h3 style={h3}>Legacy formats</h3>
          <p style={{ ...small, marginBottom: "8px" }}>Older receipts. Most receipts use the current format above.</p>
          <ul style={{ paddingLeft: "20px", margin: 0, listStyle: "disc" }}>
            {older.map((f) => <FormatSummary key={f.id} f={f} bankId={bank.id} />)}
          </ul>
          {(doc.legacy ?? []).map((l) => (
            <div key={l.formatId} style={{ marginTop: "12px" }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Placeholder (legacy)</th><th>What it is</th><th>Where to find it</th><th>Length and pattern</th><th>Traps</th></tr>
                  </thead>
                  <tbody>
                    {l.placeholders.map((p) => (
                      <tr key={p.name}><td><code>{p.name}</code></td><td>{p.what}</td><td>{p.whereToFind}</td><td>{p.format}</td><td>{p.traps ?? "None known"}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {l.redactedExample && <p style={small}>Redacted example: <code style={{ wordBreak: "break-all" }}>{l.redactedExample}</code></p>}
              <p style={small}>Unknown reference: {l.unknownRef}</p>
            </div>
          ))}
        </>
      )}

      {newerUnsupported.length > 0 && (
        <>
          <h3 style={h3}>{current ? "Also reported (not supported yet)" : "Reported receipt host (not supported yet)"}</h3>
          <ul style={{ paddingLeft: "20px", margin: 0, listStyle: "disc" }}>
            {newerUnsupported.map((f) => <FormatSummary key={f.id} f={f} bankId={bank.id} />)}
          </ul>
        </>
      )}

      <h3 style={h3}>Changelog</h3>
      {changelog.length > 0 ? (
        <ul style={{ paddingLeft: "20px", margin: 0, listStyle: "disc" }}>
          {changelog.map((c, i) => (
            <li key={i} style={small}><time dateTime={c.date} style={{ fontWeight: 600 }}>{c.date}</time>: {c.note}</li>
          ))}
        </ul>
      ) : (
        <p style={small}>No changes recorded.</p>
      )}

      <p style={{ display: "flex", gap: "16px", flexWrap: "wrap", marginTop: "20px", fontSize: "14px" }}>
        {doc.parserSource && (
          <a href={`${REPO_URL}/blob/main/${doc.parserSource}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-dark)", fontWeight: 600 }}>Parser source</a>
        )}
        {doc.fixture && (
          <a href={`${REPO_URL}/${doc.fixture.includes(".") ? "blob" : "tree"}/main/${doc.fixture}`} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-dark)", fontWeight: 600 }}>Fixture</a>
        )}
        <a href={REPORT_CHANGE_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-dark)", fontWeight: 600 }}>Report a change</a>
        {hasBankPage && <Link href={`/banks/${bank.id}`} style={{ color: "var(--ink-2)" }}>{doc.label} page</Link>}
      </p>
    </article>
  );
}

export default function EndpointsPage() {
  // Parser aliases (cbe-new) are documented on their bank's card.
  const rows = getEndpointRows().filter((r) => !r.doc.aliasOf);

  const techArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: TITLE,
    description: DESCRIPTION,
    url: "https://cheki.et/endpoints",
    dateModified: statusFile.generatedAt,
    proficiencyLevel: "Expert",
    inLanguage: "en",
    author: { "@type": "Organization", name: "cheki", url: "https://cheki.et" },
    publisher: { "@type": "Organization", name: "cheki", url: "https://cheki.et" },
    about: rows.map((r) => ({ "@type": "Thing", name: r.bank.name })),
  };

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }} />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <Link href="/" style={{ color: "var(--ink-3)" }}>Home</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <Link href="/docs" style={{ color: "var(--ink-3)" }}>Docs</Link>
          <span style={{ margin: "0 6px" }}>/</span>
          <span style={{ color: "var(--ink)" }}>Endpoints</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "12px" }}>
          Bank receipt endpoints
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", lineHeight: 1.6, maxWidth: "720px", marginBottom: "12px" }}>
          The public receipt URLs cheki reads, one card per bank. This page is generated from the same manifest the verifier uses, so it changes when the code changes.
        </p>
        <p style={{ ...small, marginBottom: "32px" }}>
          The daily health check for each endpoint is on the <Link href="/status" style={{ color: "var(--green-dark)" }}>status page</Link> (<code>GET /api/health</code> gives a reachability snapshot, cached for 5 minutes). Only live banks are verified; in-development banks are documented here but cheki does not check their receipts yet. To call cheki instead of the banks, see the <Link href="/docs" style={{ color: "var(--green-dark)" }}>API docs</Link>: requests are rate limited per IP (verify 30 per minute, batch 5 per minute with up to 20 receipts each) and over the limit you get a 429 with a Retry-After header.
        </p>

        <section aria-labelledby="status-table" style={{ marginBottom: "40px" }}>
          <h2 id="status-table" style={{ fontSize: "20px", fontWeight: 800, marginBottom: "8px" }}>Status</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Bank</th><th>Status</th><th>Input needed</th><th>Response type</th><th>Geo-restricted</th><th>Recorded</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.bank.id}>
                    <td><a href={`#${r.bank.id}`} style={{ color: "var(--green-dark)", fontWeight: 600 }}>{r.doc.label}</a></td>
                    <td><StatusPill status={healthStatusFor(r.bank)} /></td>
                    <td>{r.doc.inputNeeded}</td>
                    <td>{responseTypeLabel(r)}</td>
                    <td>{r.bank.geoBlocked ? "Yes, Ethiopia only" : "No"}</td>
                    <td>{formatCheckedAt(getBankHealth(r.bank.id)?.checkedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {rows.map((r) => <EndpointCard key={r.bank.id} row={r} />)}

        <section aria-labelledby="research" className="prose" style={{ marginTop: "48px", maxWidth: "760px" }}>
          <h2 id="research">How to research a new bank</h2>
          <ol>
            <li>Make a small payment to yourself and open the bank&apos;s share or download option on the receipt. Note the link it gives you, or scan the QR code with any reader to get its text.</li>
            <li>Find the variable parts of the link: which segment is the reference, and whether an account suffix, phone number or token is needed. Compare two receipts to see what changes.</li>
            <li>Send a fake reference in the same shape and record the status code, content type and body. That is the unknown-reference shape the health check will watch.</li>
            <li>Check whether the endpoint answers from outside Ethiopia. If not, mark it geo-blocked in the manifest.</li>
            <li>Run <code>npm run probe -- &lt;your link&gt;</code> locally to see what the current detector and parsers make of it, without sending the receipt to anyone.</li>
            <li>Open a <a href={REPORT_CHANGE_URL} target="_blank" rel="noopener noreferrer">bank request</a> with the host and a redacted pattern only. Never paste a full receipt link in a public issue. If you are happy to share the real link, use the private box on the bank&apos;s page.</li>
            <li>To write the parser yourself, follow <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md#adding-or-fixing-a-bank`} target="_blank" rel="noopener noreferrer">Adding or fixing a bank</a>: a manifest entry, a parser, a redacted fixture and a test.</li>
          </ol>
        </section>
      </main>
      <Footer />
    </>
  );
}
