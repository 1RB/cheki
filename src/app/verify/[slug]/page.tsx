import type { Metadata } from "next";
import { seoPages, getSeoPage, getRelatedSeoPages } from "@/lib/seo-pages";
import { Nav, Footer } from "@/components/Chrome";
import { BankLogoByName } from "@/components/BankLogo";
import { Icon, ArrowRight01Icon, CheckmarkCircle01Icon, Alert01Icon } from "@/components/Icon";

export function generateStaticParams() {
  return seoPages.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const page = getSeoPage(p.slug);
    if (!page) return { title: "Page not found" };
    return {
      title: page.title,
      description: page.metaDescription,
      keywords: page.keywords,
      openGraph: {
        title: page.title,
        description: page.metaDescription,
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: page.title,
        description: page.metaDescription,
      },
    };
  });
}

export default function SeoPage({ params }: { params: Promise<{ slug: string }> }) {
  return params.then((p) => {
    const page = getSeoPage(p.slug);
    if (!page) return <div>Page not found</div>;

    const related = getRelatedSeoPages(p.slug);

    const faqJsonLd = {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    };

    const breadcrumbJsonLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.app/" },
        { "@type": "ListItem", position: 2, name: page.h1, item: `https://cheki.app/verify/${page.slug}` },
      ],
    };

    return (
      <>
        <Nav />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

        <main className="container" style={{ paddingTop: "40px", paddingBottom: "48px" }}>
          <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
            <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: "var(--ink)" }}>{page.h1.slice(0, 40)}{page.h1.length > 40 ? "..." : ""}</span>
          </nav>

          <div className="two-col" style={{ gap: "40px" }}>
            <article className="prose" style={{ maxWidth: "720px", minWidth: 0, overflowWrap: "break-word" }}>
              {/* Hero */}
              <div style={{ marginBottom: "32px" }}>
                {page.bankCode && (
                  <div style={{ marginBottom: "16px" }}>
                    <BankLogoByName code={page.bankCode} size={40} />
                  </div>
                )}
                <h1 style={{ fontSize: "clamp(26px, 5vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "12px", lineHeight: 1.15 }}>
                  {page.h1}
                </h1>
                <p style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "20px" }}>
                  {page.metaDescription.split(". ")[0]}.
                </p>
                <a href={page.cta.href} style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "12px 24px", borderRadius: "8px",
                  background: "var(--green)", color: "#fff",
                  fontSize: "15px", fontWeight: 600,
                }}>
                  {page.cta.text} <Icon icon={ArrowRight01Icon} size={16} color="#fff" />
                </a>
              </div>

              {/* Sections */}
              {page.sections.map((section, i) => (
                <div key={i}>
                  <h2 id={`section-${i}`} style={{ scrollMarginTop: "80px" }}>{section.heading}</h2>
                  {section.body && <p>{section.body}</p>}
                  {section.bullets && (
                    <ul>
                      {section.bullets.map((b, j) => <li key={j}>{b}</li>)}
                    </ul>
                  )}
                </div>
              ))}

              {/* FAQ */}
              <div style={{ marginTop: "48px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ width: "4px", height: "22px", background: "var(--green)", borderRadius: "2px" }} />
                  <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Frequently asked questions</h2>
                </div>
                {page.faq.map((f, i) => (
                  <details key={i} style={{ marginBottom: "10px" }}>
                    <summary>{f.q}</summary>
                    <p style={{ marginTop: "8px", color: "var(--ink-2)", fontSize: "14px", lineHeight: 1.6 }}>{f.a}</p>
                  </details>
                ))}
              </div>

              {/* CTA */}
              <div style={{
                marginTop: "40px", padding: "24px", borderRadius: "12px",
                background: "var(--green-light)", border: "1px solid var(--green-light)",
                textAlign: "center",
              }}>
                <p style={{ fontSize: "16px", fontWeight: 600, color: "var(--green-dark)", marginBottom: "12px" }}>{page.cta.text}</p>
                <a href={page.cta.href} style={{
                  display: "inline-flex", alignItems: "center", gap: "8px",
                  padding: "12px 32px", borderRadius: "8px",
                  background: "var(--green)", color: "#fff",
                  fontSize: "15px", fontWeight: 600,
                }}>
                  Open cheki <Icon icon={ArrowRight01Icon} size={16} color="#fff" />
                </a>
              </div>

              {/* Related */}
              {related.length > 0 && (
                <div style={{ marginTop: "48px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                    <span style={{ width: "4px", height: "22px", background: "var(--green)", borderRadius: "2px" }} />
                    <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Related guides</h2>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    {related.map((r) => (
                      <a key={r.slug} href={`/verify/${r.slug}`} className="related-card" style={{
                        padding: "18px 22px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
                        display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px",
                        transition: "all 0.15s", textDecoration: "none",
                      }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px", color: "var(--ink)" }}>{r.h1}</p>
                          <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5 }}>{r.metaDescription.split(".")[0]}</p>
                        </div>
                        <span className="related-arrow" style={{
                          flexShrink: 0, width: "36px", height: "36px", borderRadius: "50%",
                          border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--green)", fontSize: "16px", fontWeight: 700, transition: "all 0.15s",
                        }}>{"\u2192"}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </article>

            {/* TOC sidebar */}
            <aside className="toc-sidebar" style={{ order: 1 }}>
              <div className="toc-card" style={{
                position: "sticky", top: "calc(var(--nav-h) + 24px)", padding: "20px",
                borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "4px", height: "16px", background: "var(--green)", borderRadius: "2px", display: "inline-block" }} />
                  On this page
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {page.sections.map((s, i) => (
                    <a key={i} href={`#section-${i}`} className="toc-link" style={{
                      fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.4,
                      padding: "4px 0", borderLeft: "2px solid transparent", paddingLeft: "10px", transition: "all 0.15s",
                    }}>{s.heading}</a>
                  ))}
                  <a href="#faq" className="toc-link" style={{
                    fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.4,
                    padding: "4px 0", borderLeft: "2px solid transparent", paddingLeft: "10px", transition: "all 0.15s",
                  }}>FAQ</a>
                </div>
              </div>
            </aside>
          </div>
        </main>
        <Footer />
      </>
    );
  });
}
