import type { Metadata } from "next";
import { banks, getBank } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";

export function generateStaticParams() {
  return banks.map((b) => ({ code: b.code }));
}

export function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const bank = getBank(p.code);
    if (!bank) return { title: "Bank not found" };
    return {
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
        url: `https://chekiapp.vercel.app/banks/${bank.code}`,
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

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: bank.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://chekiapp.vercel.app/" },
      { "@type": "ListItem", position: 2, name: "Banks", item: "https://chekiapp.vercel.app/banks" },
      { "@type": "ListItem", position: 3, name: bank.shortName, item: `https://chekiapp.vercel.app/banks/${bank.code}` },
    ],
  };

  const otherBanks = banks.filter((b) => b.code !== bank.code);

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
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
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {bank.type === "mobile" ? "Mobile wallet" : bank.type === "wallet" ? "Wallet" : "Bank verification"}
            </p>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.02em" }}>
              Verify {bank.name} Transactions
            </h1>
          </div>
        </div>

        <p style={{ color: "var(--ink-2)", fontSize: "17px", lineHeight: 1.6, maxWidth: "680px", marginBottom: "32px" }}>
          {bank.description}
        </p>

        <div style={{ display: "flex", gap: "12px", marginBottom: "40px", flexWrap: "wrap" }}>
          <a href={`/#verify`} style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>
            Verify {bank.shortName} now
          </a>
          <span style={{
            padding: "12px 16px", borderRadius: "8px", border: "1px solid var(--border)", fontSize: "14px", fontWeight: 500,
            color: bank.status === "live" ? "var(--green-dark)" : "var(--ink-3)", background: "var(--surface)",
          }}>
            {bank.status === "live" ? "Live and working" : "In development"}
          </span>
          {bank.geoBlocked && (
            <span style={{ padding: "12px 16px", borderRadius: "8px", border: "1px solid #fde68a", fontSize: "14px", fontWeight: 500, color: "#92400e", background: "var(--amber-light)" }}>
              Ethiopia only
            </span>
          )}
        </div>

        <div className="two-col" style={{ gap: "48px" }}>
          <div className="prose">
            <h2>Required information</h2>
            <ul>
              {bank.requiresAccount ? (
                <li><strong>Transaction reference</strong> (required) - e.g. {bank.referenceExample}</li>
              ) : (
                <li><strong>Transaction reference</strong> (required) - e.g. {bank.referenceExample}</li>
              )}
              {bank.requiresAccount && (
                <li><strong>{bank.accountLabel || "Account number"}</strong> (required) - last {bank.accountDigits} digits minimum</li>
              )}
              {bank.requiresPhone && (
                <li><strong>Payer phone number</strong> (required) - format: 2519XXXXXXXXX</li>
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
            <p><code>POST https://chekiapp.vercel.app/api/verify</code></p>
            <p>Request body: <code>{`{ "bank": "${bank.code}", "reference": "${bank.referenceExample}"${bank.requiresAccount ? `, "accountNumber": "1000XXXXXXX"` : ""} }`}</code></p>
            <p>See the <a href="/docs">API documentation</a> for full details.</p>

            <h2>Frequently asked questions</h2>
            {bank.faq.map((f, i) => (
              <details key={i} style={{ marginBottom: "12px", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)" }}>
                <summary style={{ fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>{f.q}</summary>
                <p style={{ marginTop: "8px", color: "var(--ink-2)", fontSize: "14px", lineHeight: 1.6 }}>{f.a}</p>
              </details>
            ))}
          </div>

          <aside>
            <div style={{
              position: "sticky", top: "calc(var(--nav-h) + 24px)", padding: "24px",
              borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px" }}>Other supported providers</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {otherBanks.map((b) => (
                  <a key={b.code} href={`/banks/${b.code}`} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 12px", borderRadius: "8px", transition: "all 0.15s" }}>
                    <div style={{ width: "28px", height: "28px", borderRadius: "6px", background: b.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "11px", flexShrink: 0 }}>
                      {b.shortName.slice(0, 3)}
                    </div>
                    <span style={{ fontSize: "14px", fontWeight: 500, color: "var(--ink-2)" }}>{b.shortName}</span>
                    {b.status === "soon" && <span style={{ fontSize: "10px", color: "var(--ink-3)" }}>soon</span>}
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
