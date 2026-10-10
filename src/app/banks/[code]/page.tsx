import type { Metadata } from "next";
import { banks, getBank } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { brandTileBg } from "@/lib/utils";
import { BankChecker } from "@/components/BankChecker";
import { ContributeBox } from "@/components/ContributeBox";
import { getEndpointDoc } from "@/lib/manifest/endpoints";
import { getMergedPagesForBank, getBankTopicPages, stripBrandSuffix } from "@/lib/seo-pages";

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

  // Content from the per-bank /verify pages that now 301 here. Sections whose
  // heading this page already covers are skipped; FAQs are de-duplicated by
  // question so the visible list and the FAQPage JSON-LD stay identical.
  const merged = isLive ? getMergedPagesForBank(bank.code) : [];
  const seenHeadings = new Set<string>(
    [
      "Required information",
      "Reference number format",
      `How to verify ${bank.shortName} with cheki`,
      `How ${bank.shortName} receipt verification works`,
      `Who uses ${bank.shortName} verification`,
      `Verifying ${bank.shortName} via API`,
    ].map((h) => h.toLowerCase()),
  );
  const mergedSections = merged
    .flatMap((p) => p.sections)
    .filter((sec) => {
      const key = sec.heading.toLowerCase();
      if (seenHeadings.has(key)) return false;
      seenHeadings.add(key);
      return true;
    });
  const seenQ = new Set<string>();
  const allFaq = [...bank.faq, ...merged.flatMap((p) => p.faq)].filter((f) => {
    const key = f.q.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (seenQ.has(key)) return false;
    seenQ.add(key);
    return true;
  });
  const topicPages = isLive ? getBankTopicPages(bank.code) : [];

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
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <a href="/banks" style={{ color: "var(--ink-3)" }}>Banks</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>{bank.shortName}</span>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
          <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: bank.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "18px" }}>
            {bank.shortName.slice(0, 3)}
          </div>
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green-dark)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {bank.type === "mobile" ? "Mobile wallet" : bank.type === "wallet" ? "Wallet" : "Bank verification"}
            </p>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
              {bank.shortName} Receipt Check
            </h1>
          </div>
        </div>

        <p style={{ color: "var(--ink-2)", fontSize: "17px", lineHeight: 1.6, maxWidth: "680px", marginBottom: "32px" }}>
          {bank.description}
        </p>

        {isLive && (
          <BankChecker
            code={bank.code}
            shortName={bank.shortName}
            referenceExample={bank.referenceExample}
            requiresAccount={bank.requiresAccount}
            accountLabel={bank.accountLabel}
            accountDigits={bank.accountDigits}
            requiresPhone={bank.requiresPhone}
          />
        )}

        {!isLive && (
          <ContributeBox
            code={bank.code}
            shortName={bank.shortName}
            requiresAccount={bank.requiresAccount}
            requiresPhone={bank.requiresPhone}
            accountLabel={bank.accountLabel}
            preferLink={endpointDoc?.preferLink}
            linkExample={endpointDoc?.redactedExample}
          />
        )}

        <div style={{ display: "flex", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
          <span style={{
            padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "14px", fontWeight: 500,
            color: bank.status === "live" ? "var(--green-dark)" : "var(--ink-3)", background: "var(--surface)",
          }}>
            {bank.status === "live" ? "Live and working" : "In development"}
          </span>
          {bank.geoBlocked && (
            <span style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid color-mix(in srgb, var(--amber) 30%, transparent)", fontSize: "14px", fontWeight: 500, color: "var(--amber-text)", background: "var(--amber-light)" }}>
              Ethiopia only
            </span>
          )}
        </div>

        <div className="two-col" style={{ gap: "48px" }}>
          <div className="prose">
            <h2>Required information</h2>
            <ul>
              {bank.requiresAccount ? (
                <li><strong>Transaction reference</strong> (required), e.g. {bank.referenceExample}</li>
              ) : (
                <li><strong>Transaction reference</strong> (required), e.g. {bank.referenceExample}</li>
              )}
              {bank.requiresAccount && (
                <li><strong>{bank.accountLabel || "Account number"}</strong> (required), last {bank.accountDigits} digits minimum</li>
              )}
              {bank.requiresPhone && (
                <li><strong>Payer phone number</strong> (required), format: 2519XXXXXXXXX</li>
              )}
            </ul>

            <h2>Reference number format</h2>
            <p>{bank.referenceFormat}</p>
            <p>Example: <code>{bank.referenceExample}</code></p>

            <h2>How to verify {bank.shortName} with cheki</h2>
            <ol style={{ paddingLeft: "20px" }}>
              {bank.howToVerify.map((step, i) => (
                <li key={i} style={{ marginBottom: "8px", color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.7 }}>{step}</li>
              ))}
            </ol>

            <h2>How {bank.shortName} receipt verification works</h2>
            <p>The {bank.shortName} receipt endpoint is: <code>{bank.endpointFormat}</code></p>
            <p>Placeholders, error shapes and gotchas are in the <a href={`/endpoints#${bank.code}`}>{bank.shortName} endpoint reference</a>.</p>
            <p>This is a public URL that returns a {bank.responseType === "pdf" ? "PDF document" : bank.responseType === "json" ? "JSON response" : "HTML page"} containing the official transaction data. No authentication is required.</p>
            {bank.geoBlocked && (
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
            <p>Request body: <code>{`{ "bank": "${bank.code}", "reference": "${bank.referenceExample}"${bank.requiresAccount ? `, "accountNumber": "1000XXXXXXX"` : ""} }`}</code></p>
            <p>See the <a href="/docs">API documentation</a> for full details.</p>

            {mergedSections.map((sec, i) => (
              <div key={`merged-${i}`}>
                <h2>{sec.heading}</h2>
                {sec.body && <p>{sec.body}</p>}
                {sec.bullets && (
                  <ul>
                    {sec.bullets.map((b, j) => <li key={j}>{b}</li>)}
                  </ul>
                )}
              </div>
            ))}

            {topicPages.length > 0 && (
              <>
                <h2>More about {bank.shortName} receipts</h2>
                <ul>
                  {topicPages.map((tp) => (
                    <li key={tp.slug}><a href={`/verify/${tp.slug}`}>{stripBrandSuffix(tp.h1)}</a></li>
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
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px" }}>Other supported providers</p>
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
