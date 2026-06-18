import type { Metadata } from "next";
import { articles, getArticle, getRelatedArticles, type ContentBlock } from "@/lib/guides";
import { Nav, Footer } from "@/components/Chrome";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const article = getArticle(p.slug);
    if (!article) return { title: "Article not found" };
    return {
      title: article.seo.title,
      description: article.seo.description,
      keywords: article.seo.keywords,
      openGraph: { title: article.seo.title, description: article.seo.description, type: "article", publishedTime: article.date },
      twitter: { card: "summary_large_image", title: article.seo.title, description: article.seo.description },
    };
  });
}

const calloutStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  info: { bg: "#eff6ff", border: "#bfdbfe", text: "#1e40af", icon: "ℹ" },
  warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e", icon: "⚠" },
  tip: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", icon: "💡" },
  success: { bg: "#f0fdf4", border: "#bbf7d0", text: "#166534", icon: "✓" },
  danger: { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", icon: "✕" },
  quote: { bg: "#f5f2ec", border: "#d4d0c8", text: "#555", icon: "❝" },
};

function renderBlock(block: ContentBlock, key: number) {
  switch (block.type) {
    case "heading":
      return <h2 key={key} id={`section-${key}`}>{block.text}</h2>;

    case "text":
      return <p key={key}>{block.text}</p>;

    case "list":
      return (
        <ul key={key}>
          {block.items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
      );

    case "ordered":
      return (
        <ol key={key} style={{ paddingLeft: "20px", marginBottom: "16px" }}>
          {block.items.map((item, i) => <li key={i} style={{ marginBottom: "6px" }}>{item}</li>)}
        </ol>
      );

    case "code":
      return (
        <pre key={key} style={{
          background: "var(--ink)", color: "#e0e0e0", padding: "16px 20px",
          borderRadius: "8px", fontSize: "13px", fontFamily: "var(--mono)",
          lineHeight: 1.6, overflow: "auto", margin: "12px 0",
        }}>
          <code>{block.code}</code>
        </pre>
      );

    case "callout": {
      const s = calloutStyles[block.variant] || calloutStyles.info;
      return (
        <div key={key} style={{
          background: s.bg, border: `1px solid ${s.border}`, borderRadius: "8px",
          padding: "14px 16px", margin: "16px 0", display: "flex", gap: "10px", alignItems: "flex-start",
        }}>
          <span style={{ fontSize: "16px", flexShrink: 0, color: s.text }}>{s.icon}</span>
          <div>
            {block.title && <p style={{ fontWeight: 700, fontSize: "14px", color: s.text, marginBottom: "4px" }}>{block.title}</p>}
            <p style={{ fontSize: "14px", color: s.text, lineHeight: 1.6 }}>{block.text}</p>
          </div>
        </div>
      );
    }

    case "table":
      return (
        <div key={key} style={{ overflowX: "auto", margin: "16px 0" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px", background: "var(--surface)", borderRadius: "8px", overflow: "hidden" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                {block.headers.map((h, i) => (
                  <th key={i} style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "13px", color: "var(--ink)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "transparent" : "var(--surface-alt)" }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: "10px 14px", color: j === 0 ? "var(--ink)" : "var(--ink-2)", fontWeight: j === 0 ? 600 : 400, fontSize: "13px" }}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "quote":
      return (
        <blockquote key={key} style={{
          borderLeft: "3px solid var(--green)", paddingLeft: "16px",
          margin: "16px 0", fontSize: "16px", fontStyle: "italic", color: "var(--ink-2)",
        }}>
          {block.text}
          {block.cite && <cite style={{ display: "block", fontSize: "13px", marginTop: "4px", color: "var(--ink-3)" }}>— {block.cite}</cite>}
        </blockquote>
      );

    case "steps":
      return (
        <div key={key} style={{ display: "flex", flexDirection: "column", gap: "12px", margin: "16px 0" }}>
          {block.items.map((step, i) => (
            <div key={i} style={{
              display: "flex", gap: "14px", padding: "16px", borderRadius: "10px",
              background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <div style={{
                width: "28px", height: "28px", borderRadius: "50%", background: "var(--green)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "13px", flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>{step.title}</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      );

    case "divider":
      return <hr key={key} style={{ border: "none", borderTop: "1px solid var(--border)", margin: "24px 0" }} />;

    default:
      return null;
  }
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return <div>Article not found</div>;

  const related = getRelatedArticles(slug);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    author: { "@type": "Organization", name: "cheki" },
    publisher: { "@type": "Organization", name: "cheki" },
  };

  const faqJsonLd = article.faq ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: article.faq.map((f) => ({
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
      { "@type": "ListItem", position: 3, name: article.title, item: `https://cheki.app/guides/${article.slug}` },
    ],
  };

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <main className="container" style={{ paddingTop: "40px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <a href="/guides" style={{ color: "var(--ink-3)" }}>Guides</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>{article.title.slice(0, 40)}{article.title.length > 40 ? "..." : ""}</span>
        </nav>

        <div className="two-col" style={{ gap: "40px" }}>
          <article className="prose" style={{ maxWidth: "720px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              {article.category.replace("-", " ")} · {article.readTime} read
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "12px", lineHeight: 1.15 }}>
              {article.title}
            </h1>
            <p style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: "28px" }}>
              {article.description}
            </p>

            {article.content.map((block, i) => renderBlock(block, i))}

            {article.faq && article.faq.length > 0 && (
              <div>
                <h2>Frequently asked questions</h2>
                {article.faq.map((f, i) => (
                  <details key={i} style={{ marginBottom: "12px", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)" }}>
                    <summary style={{ fontWeight: 600, fontSize: "15px", cursor: "pointer" }}>{f.q}</summary>
                    <p style={{ marginTop: "8px", color: "var(--ink-2)", fontSize: "14px", lineHeight: 1.6 }}>{f.a}</p>
                  </details>
                ))}
              </div>
            )}

            {related.length > 0 && (
              <div style={{ marginTop: "40px" }}>
                <h2>Related articles</h2>
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
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "16px" }}>In this article</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {article.content.map((b, i) => b.type === "heading" ? (
                  <a key={i} href={`#section-${i}`} style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.4 }}>{b.text}</a>
                ) : null)}
              </div>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
