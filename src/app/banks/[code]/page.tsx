import type { Metadata } from "next";
import Link from "next/link";
import { banks, getBank } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { brandTileBg } from "@/lib/utils";
import { VerifyPanel } from "@/components/verify/VerifyPanel";
import { ContributeBox } from "@/components/ContributeBox";
import { getEndpointDoc } from "@/lib/manifest/endpoints";
import { formatNeeds, primaryFormat, secondaryFormats } from "@/lib/manifest/formats";
import { contributeLeadMode } from "@/lib/contribute";
import { bankPageContent, hasGeoSection, receiptTypeLabel, requiredInfoIntro } from "@/lib/bank-page-content";
import { articles } from "@/lib/guides";
import { BANK_HEADING } from "@/lib/seo-redirects";
import { withArticle } from "@/lib/indefinite-article";

export function generateStaticParams() {
  return banks.map((b) => ({ code: b.code }));
}

export function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const bank = getBank(p.code);
    if (!bank) return { title: "Bank not found" };
    const isLive = bank.status === "live";
    return {
      // Providers still in development have no working checker yet. Keep them
      // out of the index until they ship (spam policy: pages must do what they
      // claim), but let crawlers follow their links.
      ...(isLive ? {} : { robots: { index: false, follow: true } }),
      title: bank.seo.title,
      description: bank.seo.description,
      keywords: bank.seo.keywords,
      alternates: {
        canonical: `/banks/${bank.code}`,
      },
      openGraph: {
        title: bank.seo.title,
        description: bank.seo.description,
        type: "article",
        url: `https://cheki.et/banks/${bank.code}`,
      },
      twitter: {
        card: "summary_large_image",
        title: bank.seo.title,
        description: bank.seo.description,
      },
    };
  });
}

export default async function BankPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const bank = getBank(code);
  if (!bank) return <div>Bank not found</div>;
  const isLive = bank.status === "live";
  const endpointDoc = getEndpointDoc(bank.code);
  // Lead with the current format; older ones (legacy, deprecated) go in a collapsed note.
  const primary = primaryFormat(bank);
  const olderFormats = secondaryFormats(bank).filter((f) => f.status !== "current");

  // Extra sections and FAQs: the content of the per-bank pages that now 301
  // here (src/lib/seo-redirects.ts). FAQs are de-duplicated by question so the
  // visible list and the FAQPage JSON-LD stay identical.
  const content = bankPageContent(bank);
  const { sections: extraSections, faq: allFaq } = content;
  // Telebirr and M-Pesa explain geo-blocking in their own section; the short
  // note under "How X receipt verification works" is for the others.
  const geoNote = bank.geoBlocked && !hasGeoSection(content);
  const reqIntro = requiredInfoIntro(bank);
  // Guides that go deeper on this bank, plus the two cross-bank references.
  const relatedGuides = isLive
    ? articles.filter((a) => a.bankCode === bank.code || a.slug === "payment-fraud-ethiopia" || a.slug === "ethiopian-bank-receipt-formats")
    : [];

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: allFaq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.et/" },
      { "@type": "ListItem", position: 2, name: "Banks", item: "https://cheki.et/banks" },
      { "@type": "ListItem", position: 3, name: bank.shortName, item: `https://cheki.et/banks/${bank.code}` },
    ],
  };

  const otherBanks = banks.filter((b) => b.code !== bank.code && b.status === "live");

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <Link href="/" style={{ color: "var(--ink-3)" }}>Home</Link>
          <span style={{ margin: "0 6px"}}>/</span>
          <Link href="/banks" style={{ color: "var(--ink-3)" }}>Banks</Link>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>{bank.shortName}</span>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div aria-hidden="true" style={{ width: "48px", height: "48px", borderRadius: "12px", background: brandTileBg(bank.color), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "18px" }}>
            {bank.shortName.slice(0, 3)}
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 500, color: "var(--ink-3)" }}>
              {bank.type === "mobile" ? "Mobile wallet" : bank.type === "wallet" ? "Wallet" : "Bank verification"}
            </p>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
              {bank.shortName} Receipt Check
            </h1>
          </div>
        </div>

        {isLive && (
          <section id="check" aria-label={`${bank.shortName} receipt checker`} className="bank-check">
            <VerifyPanel lockedBank={bank.code} />
            <p className="bank-check-foot">
              Free, no signup. Checked against {bank.shortName}&apos;s own receipt record
              {bank.geoBlocked ? ", which only answers Ethiopian networks" : ""}.
            </p>
          </section>
        )}

        <p style={{ color: "var(--ink-2)", fontSize: "17px", lineHeight: 1.6, maxWidth: "680px", marginBottom: "32px" }}>
          {bank.description}
        </p>

        {!isLive && (
          <ContributeBox
            code={bank.code}
            shortName={bank.shortName}
            requiresAccount={bank.requiresAccount}
            requiresPhone={bank.requiresPhone}
            accountLabel={bank.accountLabel}
            preferLink={endpointDoc?.preferLink}
            linkExample={endpointDoc?.redactedExample}
            lead={contributeLeadMode(bank.code)}
          />
        )}

        <div style={{ display: "flex", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
          <span style={{
            padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "14px", fontWeight: 500,
            color: bank.status === "live" ? "var(--green-dark)" : "var(--ink-3)", background: "var(--surface)",
          }}>
            {bank.status === "live" ? (bank.geoBlocked ? "Live on Ethiopian networks" : "Live and working") : "In development"}
          </span>
          {bank.geoBlocked && (
            <span style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)", fontSize: "14px", fontWeight: 500, color: "var(--amber-text)", background: "var(--amber-light)" }}>
              Ethiopia only
            </span>
          )}
        </div>

        <div className="two-col" style={{ gap: "48px" }}>
          <div className="prose">
            <h2 id={BANK_HEADING.requiredInfo.id}>{BANK_HEADING.requiredInfo.text(bank.shortName)}</h2>
            {primary ? (
              <ul>
                {primary.inputs.map((i) => (
                  <li key={i.name}>
                    <strong>{i.label}</strong> (required)
                    {i.digits ? `, last ${i.digits} digits minimum` : i.example ? <>, e.g. <code>{i.example}</code></> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <ul>
                <li><strong>Transaction reference</strong> (required), e.g. {bank.referenceExample}</li>
                {bank.requiresAccount && (
                  <li><strong>{bank.accountLabel || "Account number"}</strong> (required), last {bank.accountDigits} digits minimum</li>
                )}
                {bank.requiresPhone && (
                  <li><strong>Payer phone number</strong> (required), e.g. 09XXXXXXXX or 2519XXXXXXXX</li>
                )}
              </ul>
            )}
            {reqIntro && <p>{reqIntro}</p>}
            {olderFormats.length > 0 && (
              <details>
                <summary>Older receipt?</summary>
                <ul>
                  {olderFormats.map((f) => (
                    <li key={f.id}>
                      <strong>{f.label}</strong> ({f.status}
                      {f.deprecatedAt ? `, retired ${f.deprecatedAt}` : ""}).{" "}
                      {f.status === "deprecated"
                        ? "Old links are still recognised: cheki reads the reference from them and checks it on the current receipt page."
                        : `Needs ${f.inputs.map((i) => (i.digits ? `${i.label.toLowerCase()}` : i.label)).join(" and ")}. ${f.notes ?? ""}`}
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <h2>Reference number format</h2>
            <p>{bank.referenceFormat}</p>
            <p>Example: <code>{bank.referenceExample}</code></p>

            <h2 id={BANK_HEADING.howToVerify.id}>{BANK_HEADING.howToVerify.text(bank.shortName)}</h2>
            <ol style={{ paddingLeft: "20px" }}>
              {bank.howToVerify.map((step, i) => (
                <li key={i} style={{ marginBottom: "8px", color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.7 }}>{step}</li>
              ))}
            </ol>

            <h2>How {bank.shortName} receipt verification works</h2>
            <p>The {bank.shortName} receipt endpoint is: <code>{bank.endpointFormat}</code>{olderFormats.length > 0 ? " (current format)" : ""}</p>
            <p>Placeholders, error shapes and gotchas are in the <Link href={`/endpoints#${bank.code}`}>{bank.shortName} endpoint reference</Link>.</p>
            <p>This is a public URL that returns {withArticle(receiptTypeLabel(bank))} containing the official transaction data. {bank.endpointAuth ?? "No authentication is required."}</p>
            {geoNote && (
              <p><strong>Note:</strong> This endpoint is geo-blocked to Ethiopian IP addresses. If cheki&apos;s server cannot reach it, use the fallback URL or self-host on an Ethiopian network.</p>
            )}

            <h2>Who uses {bank.shortName} verification</h2>
            <ul>
              {bank.useCases.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>

            <h2>Verifying {bank.shortName} via API</h2>
            <p>cheki provides a free REST API for {bank.shortName} verification:</p>
            <p><code>POST https://cheki.et/api/verify</code></p>
            <p>Request body: <code>{`{ "bank": "${bank.code}", "reference": "${primary?.inputs[0]?.example ?? bank.referenceExample}"${bank.requiresAccount ? `, "accountNumber": "1000XXXXXXX"` : ""} }`}</code></p>
            {olderFormats.some((f) => f.parser && f.status === "legacy" && formatNeeds(f, "account")) && (
              <p>
                Older receipt (legacy format):{" "}
                {olderFormats
                  .filter((f) => f.parser && f.status === "legacy")
                  .map((f) => (
                    <code key={f.id}>{`{ "bank": "${bank.code}", "reference": "${f.inputs[0]?.example ?? "REFERENCE"}"${formatNeeds(f, "account") ? `, "accountNumber": "1000XXXXXXX"` : ""} }`}</code>
                  ))}
              </p>
            )}
            <p>See the <Link href="/docs">API documentation</Link> for full details.</p>

            {extraSections.map((sec) => (
              <div key={sec.heading}>
                <h2 id={sec.id}>{sec.heading}</h2>
                {sec.body && <p>{sec.body}</p>}
                {sec.steps && (
                  // Preflight strips list markers: steps are numbered, bullets get discs.
                  <ol style={{ paddingLeft: "20px", listStyle: "decimal" }}>
                    {sec.steps.map((step, j) => <li key={j}>{step}</li>)}
                  </ol>
                )}
                {sec.bullets && (
                  <ul style={{ listStyle: "disc" }}>
                    {sec.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
                {sec.link && <p><Link href={sec.link.href}>{sec.link.text}</Link></p>}
              </div>
            ))}

            {relatedGuides.length > 0 && (
              <>
                <h2>More about {bank.shortName} receipts</h2>
                <ul>
                  {relatedGuides.map((g) => (
                    <li key={g.slug}><Link href={`/guides/${g.slug}`}>{g.title}</Link></li>
                  ))}
                </ul>
              </>
            )}

            <h2>Frequently asked questions</h2>
            <BouncyAccordion
              items={allFaq.map((f, i) => ({
                id: `faq-${i}`,
                title: f.q,
                description: f.a,
              }))}
            />
          </div>

          <aside>
            <div className="sticky-desktop" style={{
              top: "calc(var(--nav-h) + 24px)", padding: "24px",
              borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)", marginBottom: "16px" }}>Other supported providers</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {otherBanks.map((b) => (
                  <a key={b.code} href={`/banks/${b.code}`} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", transition: "background-color 0.15s, color 0.15s, border-color 0.15s, transform 0.15s" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: brandTileBg(b.color), display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "11px", flexShrink: 0 }}>
                      {b.shortName.slice(0, 3)}
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--ink-2)" }}>{b.shortName}</span>
                    {b.status === "soon" && <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>soon</span>}
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
