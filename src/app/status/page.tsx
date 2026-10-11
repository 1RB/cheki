import type { Metadata } from "next";
import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { BankLogoByName } from "@/components/BankLogo";
import { StatusDot } from "@/components/StatusDot";
import { RelativeTime } from "@/components/RelativeTime";
import { Chevron } from "@/components/reference/Chevron";
import { StaleNote } from "@/components/reference/StaleNote";
import { getEndpointRows } from "@/lib/manifest/endpoints";
import { primaryFormat } from "@/lib/manifest/formats";
import { getBankHealth, healthStatusFor, statusFile } from "@/lib/status-data";
import { bankState, legacyHealth, measuredFrom, stateMeaning, summarize, type BankState } from "@/lib/status-view";
import { formatAbsolute, parseTimestamp } from "@/lib/time/relative";
import "@/components/reference/reference.css";

export const metadata: Metadata = {
  title: "Endpoint Status: Ethiopian Bank Receipt Checks",
  description: "Can you check a receipt for your bank right now? A daily health check of every bank receipt endpoint cheki uses: working, down, or only reachable from Ethiopian networks. Endpoint health only; it never verifies a receipt.",
  alternates: { canonical: "/status" },
};

/** English absolute time, computed once on the server so hydration matches. */
function abs(iso: string | undefined): string | undefined {
  const p = parseTimestamp(iso);
  return p ? formatAbsolute(p, "en") : undefined;
}

const ORDER: BankState[] = ["down", "geo", "working"];

/** What to do instead, when the state calls for it. */
function workaround(state: BankState, label: string): React.ReactNode {
  if (state === "geo") {
    return (
      <p className="st-tip">
        <strong>If a check can&apos;t reach {label}:</strong> the checker offers paste-first. Open the receipt on {label}&apos;s own page, copy its text and paste it back. Pasted text is read, not confirmed by the bank.
      </p>
    );
  }
  if (state === "down") {
    return (
      <p className="st-tip">
        <strong>Until it&apos;s back:</strong> open the receipt link from {label}&apos;s SMS yourself and compare the amount, the receiver and the date before you hand over goods.
      </p>
    );
  }
  return null;
}

export default function StatusPage() {
  const from = measuredFrom(statusFile.runner);
  // One row per bank (its current format); parser aliases are folded into their bank.
  const rows = getEndpointRows()
    .filter((r) => !r.doc.aliasOf)
    .map((r) => {
      const health = getBankHealth(r.bank.id);
      const state = bankState(r.bank, healthStatusFor(r.bank));
      return { ...r, health, state, format: primaryFormat(r.bank)?.label };
    });
  const live = rows.filter((r) => r.state !== "unsupported").sort((a, b) => ORDER.indexOf(a.state) - ORDER.indexOf(b.state));
  const dev = rows.filter((r) => r.state === "unsupported");
  const sum = summarize(rows.map((r) => r.state));
  const down = live.filter((r) => r.state === "down").map((r) => r.doc.label);
  const geo = live.filter((r) => r.state === "geo").map((r) => r.doc.label);
  // Names never break inside themselves ("M-Pesa" at its hyphen).
  const names = (list: string[]) =>
    list.flatMap((n, i) => [i === 0 ? null : i === list.length - 1 ? " and " : ", ", <span key={n} className="st-nowrap">{n}</span>]);
  const sub = (
    <>
      {down.length > 0 ? <>{names(down)} {down.length === 1 ? "is" : "are"} down. </> : sum.live > 0 ? "Every bank we can reach answered as expected. " : null}
      {geo.length > 0 ? <>{names(geo)} only answer{geo.length === 1 ? "s" : ""} Ethiopian networks, so we can&apos;t see {geo.length === 1 ? "it" : "them"} from here.</> : null}
    </>
  );

  return (
    <>
      <Nav />
      <main className="container ref st">
        <nav aria-label="Breadcrumb" className="ref-crumbs">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Status</span>
        </nav>
        <h1 className="ref-h1">Bank status</h1>

        {live.length === 0 ? (
          <p className="st-empty">No status has been recorded yet. The daily check writes it to <a href="/status.json" className="ref-link">status.json</a>.</p>
        ) : (
          <>
            <p className="st-answer" data-tone={sum.tone}>
              <span className="st-answer-dot" aria-hidden="true" />
              <span>{sum.working} of {sum.live} banks working</span>
            </p>
            <p className="st-sub">{sub}</p>
            <p className="st-meta">Measured daily from {from}, outside Ethiopia.</p>
            <p className="st-meta st-when">
              Last change <RelativeTime value={statusFile.generatedAt} absolute={abs(statusFile.generatedAt)} />
              <StaleNote generatedAt={statusFile.generatedAt} />
            </p>

            <ul className="st-list" aria-label="Banks cheki checks">
              {live.map((r) => {
                const label = r.doc.label;
                const older = legacyHealth(statusFile.banks, r.bank.id);
                return (
                  <li key={r.bank.id} id={r.bank.id}>
                    <details className="st-row">
                      <summary>
                        <BankLogoByName code={r.bank.id} size={28} />
                        <span className="st-name">
                          <span className="st-bank">{label}</span>
                          {r.format && <span className="st-format">{r.format}</span>}
                        </span>
                        <StatusDot state={r.state} />
                        <Chevron />
                      </summary>
                      <div className="st-body ref-disclose">
                        <p>{stateMeaning(r.state, label, from)}</p>
                        {workaround(r.state, label)}
                        <dl className="st-facts">
                          {r.health?.detail && (
                            <div><dt>What we saw</dt><dd>{r.health.detail}</dd></div>
                          )}
                          {r.health?.observed && (
                            <div><dt>Unknown-reference response</dt><dd className="st-observed">{r.health.observed}</dd></div>
                          )}
                          <div>
                            <dt>Recorded</dt>
                            <dd>{r.health?.checkedAt ? <RelativeTime value={r.health.checkedAt} absolute={abs(r.health.checkedAt)} /> : "Not checked yet"}</dd>
                          </div>
                          {older.map((h) => {
                            const fid = h.id.split(":")[1];
                            const f = r.bank.formats?.find((x) => x.id === fid);
                            const s: BankState = h.status === "degraded" ? "down" : h.status === "not-checked" ? "geo" : "working";
                            return (
                              <div key={h.id}>
                                <dt>Older receipts</dt>
                                <dd>{f?.label ?? fid}: <StatusDot state={s} quiet /></dd>
                              </div>
                            );
                          })}
                        </dl>
                        <p className="st-links">
                          <Link href={`/banks/${r.bank.id}`} prefetch={false}>Check a {label} receipt</Link>
                          <Link href={`/endpoints#${r.bank.id}`} prefetch={false}>{label} endpoint reference</Link>
                        </p>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {dev.length > 0 && (
          <details className="st-more">
            <summary>
              <span>Not supported yet <span className="st-more-count">· {dev.length} banks</span></span>
              <Chevron />
            </summary>
            <div className="ref-disclose">
              <ul className="st-dev">
                {dev.map((r) => (
                  <li key={r.bank.id} id={r.bank.id}>
                    <Link href={`/endpoints#${r.bank.id}`} prefetch={false} className="st-dev-link">
                      <span>{r.doc.label}</span>
                      <span>{/^https?:\/\//i.test(r.bank.endpointFormat ?? r.bank.endpoint) ? "Endpoint known" : "No endpoint yet"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        )}

        <section className="st-method" aria-labelledby="how-measured">
          <h2 id="how-measured" className="ref-h2">How this is measured</h2>
          <p>
            Once a day, CI sends each bank a fake reference and checks that the error comes back in the shape we expect. A changed shape usually means the bank moved its endpoint. The check runs from {from}, outside Ethiopia, so banks that only answer Ethiopian networks show as geo-restricted rather than working or down.
          </p>
          <p>
            This is about the endpoints, not about any receipt. <strong>Working</strong> means cheki checks receipts for that bank and its endpoint answered as expected; a receipt only counts as verified when the bank&apos;s own record confirms it. <strong>In development</strong> banks are not checked by cheki yet, whatever their endpoint does.
          </p>
          <p>
            CI records a new snapshot only when a result changes, so &ldquo;last change&rdquo; can be days old on a quiet week. There is no uptime history yet: each snapshot replaces the last. For a fresher reachability snapshot, <code>GET /api/health</code> probes the live banks (cached for 5 minutes).
          </p>
          <p>
            Raw data: <a href="/status.json" className="ref-link">status.json</a>. Placeholders, error shapes and changelogs per bank: <Link href="/endpoints" className="ref-link">endpoint reference</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}

