import type { Metadata } from "next";
import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { StatusDot } from "@/components/StatusDot";
import { RelativeTime } from "@/components/RelativeTime";
import { Chevron } from "@/components/reference/Chevron";
import { UrlTemplate } from "@/components/reference/UrlTemplate";
import { BankJump } from "@/components/reference/BankJump";
import { changelogFor, getEndpointRows, REPO_URL, REPORT_CHANGE_URL, THIRD_PARTY_PROVIDER_LIST, type EndpointRow, type PlaceholderDoc } from "@/lib/manifest/endpoints";
import { primaryFormat, secondaryFormats, templateHost } from "@/lib/manifest/formats";
import type { ReceiptFormat } from "@/lib/core/types";
import { getBankHealth, healthStatusFor, statusFile } from "@/lib/status-data";
import { bankState, STATE_LABEL, type BankState } from "@/lib/status-view";
import { formatAbsolute, parseTimestamp } from "@/lib/time/relative";
import { MAINTAINER_PERSON, PUBLISHER } from "@/lib/site-schema";
import "@/components/reference/reference.css";

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

/** What each normalised field means (the same names for every bank). */
const FIELD_MEANING: Record<string, string> = {
  senderName: "Payer's name",
  senderAccount: "Payer's account or phone (often masked)",
  receiverName: "Receiver's name",
  receiverAccount: "Receiver's account or phone (often masked)",
  amount: "Amount transferred",
  currency: "Currency, ETB",
  date: "Transaction time as the bank prints it",
  reference: "The bank's own reference",
  reason: "Payment reason or narrative",
  transactionStatus: "Status as the bank reports it",
  invoiceNumber: "Invoice number",
  orderId: "Order ID",
  branch: "Branch",
  paymentMode: "Payment mode",
  paymentChannel: "Channel (app, USSD, agent)",
  serviceFee: "Service fee",
  serviceFeeVat: "VAT on the service fee",
  totalPaid: "Total paid, fees included",
};

function responseTypeLabel({ bank, doc }: EndpointRow): string {
  if (doc.responseTypeLabel) return doc.responseTypeLabel;
  return fmtLabel(bank.responseType);
}

function hasEndpoint({ bank }: EndpointRow): boolean {
  return /^https?:\/\//i.test(bank.endpointFormat ?? bank.endpoint);
}

function abs(iso: string | undefined): string | undefined {
  const p = parseTimestamp(iso);
  return p ? formatAbsolute(p, "en") : undefined;
}

function fmtLabel(rt: ReceiptFormat["responseType"]): string {
  if (rt === "pdf-in-json") return "PDF inside JSON (base64)";
  return rt === "pdf" ? "PDF" : rt === "json" ? "JSON" : "HTML";
}

function stateOf(row: EndpointRow): BankState {
  return bankState(row.bank, healthStatusFor(row.bank));
}

function Placeholders({ items }: { items: PlaceholderDoc[] }) {
  return (
    <div className="ep-phs">
      {items.map((p) => (
        <div key={p.name} className="ep-ph-item">
          <div className="ep-ph-name">
            <code>{p.name}</code>
            {p.confirmed === false && <span className="ep-flag">Unconfirmed</span>}
          </div>
          <div>
            <p className="ep-ph-what">{p.what}</p>
            <dl className="ep-ph-facts">
              <div><dt>Where to find it</dt><dd>{p.whereToFind}</dd></div>
              <div><dt>Length and pattern</dt><dd>{p.format}</dd></div>
              <div><dt>Traps</dt><dd>{p.traps ?? "None known"}</dd></div>
            </dl>
          </div>
        </div>
      ))}
    </div>
  );
}

function FormatSummary({ f, bankId }: { f: ReceiptFormat; bankId: string }) {
  const health = getBankHealth(`${bankId}:${f.id}`);
  const template = f.link ?? f.endpoint;
  const tag = f.status === "current" ? "Newer, not supported yet" : f.status === "legacy" ? "Still checked" : "Retired";
  return (
    <div className="ep-format">
      <p className="ep-format-title">
        {f.label}
        <span className="ep-format-tag">{tag}{f.confidence === "inferred" ? " · inferred" : ""}</span>
      </p>
      <p>
        {template ? <code>{template}</code> : <>Host: <code>{(f.linkHosts ?? []).join(", ")}</code></>}
        {f.endpoint && f.link && templateHost(f.endpoint) !== templateHost(f.link) && <> (cheki fetches <code>{f.endpoint}</code>)</>}
      </p>
      <p>
        Needs: {f.inputs.map((i) => i.label).join(" + ")}. Response: {fmtLabel(f.responseType)}.
        {f.since ? ` Since ${f.since}.` : ""}
        {f.deprecatedAt ? ` Retired ${f.deprecatedAt}.` : ""}
        {f.replacedBy ? " Replaced by the current format." : ""}
        {f.status === "legacy" && f.parser ? " cheki still checks it." : f.status === "deprecated" ? " cheki never fetches it; links are read for their reference only." : !f.parser ? " cheki does not read it yet." : ""}
        {f.notes ? <> {f.notes}</> : null}
      </p>
      <p>Evidence: {f.evidence}</p>
      {health && <p>Last check: {health.detail} (<RelativeTime value={health.checkedAt} absolute={abs(health.checkedAt)} />)</p>}
    </div>
  );
}

function Disclosure({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <details className="ep-more">
      <summary>
        <span>{title}</span>
        {meta && <span className="ep-more-meta">{meta}</span>}
        <Chevron />
      </summary>
      <div className="ref-disclose">{children}</div>
    </details>
  );
}

function EndpointPanel({ row }: { row: EndpointRow }) {
  const { bank, doc } = row;
  const template = bank.endpointFormat ?? bank.endpoint;
  const live = bank.status === "live";
  const hasBankPage = !doc.aliasOf;
  const current = primaryFormat(bank);
  const others = secondaryFormats(bank);
  const older = others.filter((f) => f.status !== "current");
  const newerUnsupported = others.filter((f) => f.status === "current");
  const changelog = changelogFor(row);
  const health = getBankHealth(bank.id);
  const gotchas = [
    ...(bank.geoBlocked ? ["Geo-restricted: only Ethiopian IP addresses get an answer. CI runners abroad mark it as not checked."] : []),
    ...doc.gotchas,
  ];
  return (
    <article id={bank.id} className="ep-panel" aria-labelledby={`${bank.id}-title`}>
      <header className="ep-head">
        <h2 id={`${bank.id}-title`}><a href={`#${bank.id}`}>{doc.label}</a></h2>
        <span className="ep-fullname">{bank.name}</span>
        {bank.beta && <span className="ep-flag">Beta</span>}
        <StatusDot state={stateOf(row)} />
      </header>

      {live && bank.beta && bank.betaNote && (
        <p className="ep-dev">
          <strong>Beta.</strong> {bank.betaNote.replace(/^Beta:\s*/, "")}
        </p>
      )}

      {!live && hasBankPage && (
        <p className="ep-dev">
          <strong>In development, help us.</strong> A real receipt link is what we need to finish this one.{" "}
          <Link href={`/banks/${bank.id}#contribute`} prefetch={false} className="ref-link">Send one privately</Link>.
        </p>
      )}

      <h3 className="ep-h3">{older.length > 0 ? "Current format" : "Template URL"}</h3>
      {current && older.length > 0 && <p className="ep-note" style={{ marginBottom: 8 }}><strong>{current.label}</strong>. {current.notes}</p>}
      {hasEndpoint(row) ? <UrlTemplate template={template} /> : <p className="ep-note">No public receipt endpoint is known yet.</p>}
      {current?.endpoint && current.link && templateHost(current.endpoint) !== templateHost(current.link) && (
        <p className="ep-note" style={{ marginTop: 8 }}>cheki reads it from <code>{current.endpoint}</code>.</p>
      )}
      {doc.redactedExample && <p className="ep-note" style={{ marginTop: 8 }}>Redacted example: <code>{doc.redactedExample}</code></p>}

      {doc.placeholders.length > 0 && (
        <>
          <h3 className="ep-h3">Placeholders</h3>
          <Placeholders items={doc.placeholders} />
        </>
      )}

      <h3 className="ep-h3">Gotchas</h3>
      <ul className="ep-gotchas">
        {gotchas.map((g, i) => <li key={i}>{g}</li>)}
      </ul>

      <div className="ep-more-list">
        <Disclosure title="Response and fields" meta={`${responseTypeLabel(row)}${doc.fieldsParsed.length ? ` · ${doc.fieldsParsed.length} fields` : ""}`}>
          {doc.fieldsParsed.length > 0 ? (
            <div className="table-wrap" style={{ margin: 0 }}>
              <table className="ep-table">
                <thead><tr><th scope="col">Field</th><th scope="col">Meaning</th></tr></thead>
                <tbody>
                  {doc.fieldsParsed.map((f) => (
                    <tr key={f}><td><code>{f}</code></td><td>{FIELD_MEANING[f] ?? "Bank-specific field"}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="ep-note">{responseTypeLabel(row)}. No parser yet.</p>
          )}
        </Disclosure>

        <Disclosure title="Unknown-reference error shape">
          <p className="ep-note">{doc.unknownRef}</p>
          {health?.observed && <p className="ep-note">Last seen: <code>{health.observed}</code></p>}
        </Disclosure>

        {older.length > 0 && (
          <Disclosure title="Older receipts" meta={`${older.length} format${older.length === 1 ? "" : "s"}`}>
            {older.map((f) => <FormatSummary key={f.id} f={f} bankId={bank.id} />)}
            {(doc.legacy ?? []).map((l) => (
              <div key={l.formatId} style={{ marginTop: 8 }}>
                <Placeholders items={l.placeholders} />
                {l.redactedExample && <p className="ep-note" style={{ marginTop: 8 }}>Redacted example: <code>{l.redactedExample}</code></p>}
                <p className="ep-note" style={{ marginTop: 6 }}>Unknown reference: {l.unknownRef}</p>
              </div>
            ))}
          </Disclosure>
        )}

        {newerUnsupported.length > 0 && (
          <Disclosure title={current ? "Also reported, not supported yet" : "Reported receipt host, not supported yet"} meta={`${newerUnsupported.length}`}>
            {newerUnsupported.map((f) => <FormatSummary key={f.id} f={f} bankId={bank.id} />)}
          </Disclosure>
        )}

        <Disclosure title="Changelog" meta={changelog.length > 0 ? `${changelog.length} ${changelog.length === 1 ? "change" : "changes"}` : "None yet"}>
          {changelog.length > 0 ? (
            <ol className="ep-timeline">
              {changelog.map((c, i) => (
                <li key={i}>
                  <RelativeTime value={c.date} absolute={abs(c.date)} />
                  {c.note}
                </li>
              ))}
            </ol>
          ) : (
            <p className="ep-note">No changes recorded.</p>
          )}
        </Disclosure>
      </div>

      <p className="ep-links">
        {doc.parserSource && <a href={`${REPO_URL}/blob/main/${doc.parserSource}`} target="_blank" rel="noopener noreferrer">Parser source</a>}
        {doc.fixture && <a href={`${REPO_URL}/${doc.fixture.includes(".") ? "blob" : "tree"}/main/${doc.fixture}`} target="_blank" rel="noopener noreferrer">Fixture</a>}
        <a href={REPORT_CHANGE_URL} target="_blank" rel="noopener noreferrer">Report a change</a>
        {hasBankPage && <Link href={`/banks/${bank.id}`} prefetch={false}>{doc.label} page</Link>}
      </p>
    </article>
  );
}

/** A bank with no known endpoint: one short row, anchor kept. */
function Stub({ row }: { row: EndpointRow }) {
  const { bank, doc } = row;
  const reported = secondaryFormats(bank).filter((f) => f.status === "current");
  return (
    <li id={bank.id} className="ep-stub">
      <div className="ep-stub-head">
        <h3>{doc.label}</h3>
        <span className="ep-fullname">{bank.name}</span>
      </div>
      {doc.gotchas.map((g, i) => <p key={i}>{g}</p>)}
      {reported.map((f) => (
        <p key={f.id}>Reported host: <code>{f.link ?? f.endpoint ?? (f.linkHosts ?? []).join(", ")}</code>. {f.evidence}</p>
      ))}
      <p className="ep-links">
        <Link href={`/banks/${bank.id}#contribute`} prefetch={false}>Send a receipt link privately</Link>
        <a href={REPORT_CHANGE_URL} target="_blank" rel="noopener noreferrer">Open a bank request</a>
      </p>
    </li>
  );
}

export default function EndpointsPage() {
  // Parser aliases (cbe-new) are documented on their bank's panel.
  const rows = getEndpointRows().filter((r) => !r.doc.aliasOf);
  const withEndpoint = rows.filter(hasEndpoint);
  const liveRows = withEndpoint.filter((r) => r.bank.status === "live");
  const devRows = withEndpoint.filter((r) => r.bank.status !== "live");
  const stubs = rows.filter((r) => !hasEndpoint(r));

  const techArticleJsonLd = {
    "@context": "https://schema.org",
    "@type": "TechArticle",
    headline: TITLE,
    description: DESCRIPTION,
    url: "https://cheki.et/endpoints",
    dateModified: statusFile.generatedAt,
    proficiencyLevel: "Expert",
    inLanguage: "en",
    author: MAINTAINER_PERSON,
    publisher: PUBLISHER,
    about: rows.map((r) => ({ "@type": "Thing", name: r.bank.name })),
  };

  const navGroups = [
    { label: "Checked by cheki", rows: liveRows },
    { label: "In development", rows: devRows },
  ];

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(techArticleJsonLd) }} />
      <main className="container ref">
        <nav aria-label="Breadcrumb" className="ref-crumbs">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link href="/docs">Docs</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Endpoints</span>
        </nav>
        <div className="ep-intro">
          <h1 className="ref-h1">Ethiopian bank receipt endpoints</h1>
          <p className="ref-small">
            Only live banks are verified; in-development banks are documented here but cheki does not check their receipts yet. Daily endpoint health is on the <Link href="/status">status page</Link> (<code>GET /api/health</code> gives a reachability snapshot, cached for 5 minutes).
          </p>
          <p className="ref-small">
            Calling cheki instead of the banks? See the <Link href="/docs">API docs</Link>. Requests are rate limited per IP (verify 30 per minute, batch 5 per minute with up to 20 receipts each); over the limit you get a 429 with a Retry-After header.
          </p>
          <p className="ref-small">
            Formats marked inferred rest on another public source, mostly the <a href={THIRD_PARTY_PROVIDER_LIST} target="_blank" rel="noopener noreferrer">links.et provider list</a>, rather than a receipt cheki has checked itself.
          </p>
        </div>

        <div className="ep-layout">
          <BankJump
            groups={[
              ...navGroups.map((g) => ({ label: g.label, banks: g.rows.map((r) => ({ id: r.bank.id, label: r.doc.label, state: STATE_LABEL[stateOf(r)] })) })),
              { label: "No endpoint yet", banks: stubs.map((r) => ({ id: r.bank.id, label: r.doc.label, state: "No endpoint" })) },
            ]}
          />
          <nav className="ep-nav" aria-label="Banks">
            {navGroups.map((g) => (
              <div key={g.label} className="ep-nav-group">
                <p className="ep-nav-title">{g.label}</p>
                <ul>
                  {g.rows.map((r) => {
                    const s = stateOf(r);
                    return (
                      <li key={r.bank.id}>
                        <a href={`#${r.bank.id}`} className="sd" data-tone={s === "working" ? "green" : s === "down" ? "red" : s === "geo" ? "amber" : "neutral"}>
                          <span className="sd-dot" aria-hidden="true" />
                          <span>{r.doc.label}</span>
                          <span className="sr-only">, {STATE_LABEL[s]}</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {stubs.length > 0 && (
              <div className="ep-nav-group">
                <ul>
                  <li><a href="#no-endpoint" className="ep-nav-more">No endpoint yet · {stubs.length}</a></li>
                </ul>
              </div>
            )}
          </nav>

          <div className="ep-main">
            {withEndpoint.map((r) => <EndpointPanel key={r.bank.id} row={r} />)}

            {stubs.length > 0 && (
              <section className="ep-panel" id="no-endpoint" aria-labelledby="no-endpoint-title">
                <h2 id="no-endpoint-title" className="ref-h2">No public endpoint yet</h2>
                <p className="ep-note" style={{ marginTop: 6 }}>We have not found a public receipt link for these banks. A shared receipt link or QR code is the fastest way to find one.</p>
                <ul className="ep-stubs">
                  {stubs.map((r) => <Stub key={r.bank.id} row={r} />)}
                </ul>
              </section>
            )}

            <section aria-labelledby="research" className="ep-research">
              <h2 id="research" className="ref-h2">How to research a new bank</h2>
              <ol className="ep-steps">
                <li>Make a small payment to yourself and open the bank&apos;s share or download option on the receipt. Note the link it gives you, or scan the QR code with any reader to get its text.</li>
                <li>Find the variable parts of the link: which segment is the reference, and whether an account suffix, phone number or token is needed. Compare two receipts to see what changes.</li>
                <li>Send a fake reference in the same shape and record the status code, content type and body. That is the unknown-reference shape the health check will watch.</li>
                <li>Check whether the endpoint answers from outside Ethiopia. If not, mark it geo-blocked in the manifest.</li>
                <li>Run <code>npm run probe -- &lt;your link&gt;</code> locally to see what the current detector and parsers make of it, without sending the receipt to anyone.</li>
                <li>Open a <a href={REPORT_CHANGE_URL} target="_blank" rel="noopener noreferrer" className="ref-link">bank request</a> with the host and a redacted pattern only. Never paste a full receipt link in a public issue. If you are happy to share the real link, use the private box on the bank&apos;s page.</li>
                <li>To write the parser yourself, follow <a href={`${REPO_URL}/blob/main/CONTRIBUTING.md#adding-or-fixing-a-bank`} target="_blank" rel="noopener noreferrer" className="ref-link">Adding or fixing a bank</a>: a manifest entry, a parser, a redacted fixture and a test.</li>
              </ol>
            </section>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
