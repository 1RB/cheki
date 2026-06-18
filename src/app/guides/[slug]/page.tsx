import type { Metadata } from "next";
import { guides, getGuide, getRelatedGuides } from "@/lib/guides";
import { banks } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";

export function generateStaticParams() {
  return guides.map((g) => ({ slug: g.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const guide = getGuide(p.slug);
    if (!guide) return { title: "Guide not found" };
    return {
      title: guide.seo.title,
      description: guide.seo.description,
      keywords: guide.seo.keywords,
      openGraph: { title: guide.seo.title, description: guide.seo.description, type: "article" },
    };
  });
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return <div>Guide not found</div>;

  const related = getRelatedGuides(slug);
  const bank = guide.bankCode ? banks.find((b) => b.code === guide.bankCode) : null;

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: guide.title,
    description: guide.description,
    author: { "@type": "Organization", name: "cheki" },
    publisher: { "@type": "Organization", name: "cheki" },
  };

  const faqJsonLd = guide.faq ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: guide.faq.map((f) => ({
      "@type": "Question", name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  } : null;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.app/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "https://cheki.app/guides" },
      { "@type": "ListItem", position: 3, name: guide.title, item: `https://cheki.app/guides/${guide.slug}` },
    ],
  };

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <a href="/guides" style={{ color: "var(--ink-3)" }}>Guides</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>{guide.title.slice(0, 40)}</span>
        </nav>

        <div className="two-col" style={{ gap: "48px" }}>
          <article className="prose" style={{ maxWidth: "720px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              Verification guide
            </p>
            <h1 style={{ fontSize: "clamp(24px, 4vw, 34px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "16px", lineHeight: 1.1 }}>
              {guide.title}
            </h1>
            <p style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: "32px" }}>
              {guide.description}
            </p>

            {guide.content.map((section, i) => (
              <div key={i}>
                <h2>{section.heading}</h2>
                {section.body.map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
                {section.list && (
                  <ul>
                    {section.list.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {guide.faq && guide.faq.length > 0 && (
              <div>
                <h2>Frequently asked questions</h2>
                {guide.faq.map((f, i) => (
                  <details key={i} style={{ marginBottom: "12px", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)" }}>
                    <summary style={{ fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>{f.q}</summary>
                    <p style={{ marginTop: "8px", color: "var(--ink-2)", fontSize: "14px", lineHeight: 1.6 }}>{f.a}</p>
                  </details>
                ))}
              </div>
            )}

            {bank && (
              <div style={{ marginTop: "32px", padding: "20px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <p style={{ fontSize: "13px", color: "var(--ink-2)" }}>Ready to verify a {bank.shortName} transaction?</p>
                <a href="/" style={{ fontSize: "14px", color: "var(--green-dark)", fontWeight: 600, marginTop: "4px", display: "inline-block" }}>Verify now for free</a>
              </div>
            )}

            {related.length > 0 && (
              <div style={{ marginTop: "40px" }}>
                <h2>Related guides</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {related.map((r) => (
                    <a key={r.slug} href={`/guides/${r.slug}`} style={{
                      padding: "16px 20px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)",
                    }}>
                      <p style={{ fontSize: "15px", fontWeight: 600 }}>{r.title}</p>
                      <p style={{ fontSize: "13px", color: "var(--ink-2)", marginTop: "4px" }}>{r.excerpt}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </article>

          <aside>
            <div style={{
              position: "sticky", top: "calc(var(--nav-h) + 24px)", padding: "24px",
              borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px" }}>In this guide</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {guide.content.map((s, i) => (
                  <a key={i} href={`#section-${i}`} style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.4 }}>{s.heading}</a>
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
