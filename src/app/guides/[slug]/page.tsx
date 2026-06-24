import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { articles, getArticle, getRelatedArticles, type ContentBlock } from "@/lib/guides";
import { Nav, Footer } from "@/components/Chrome";
import { CodeBlock } from "@/components/CodeBlock";
import { highlightCode, getLangLabel } from "@/lib/highlight";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";

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
      alternates: {
        canonical: `/guides/${article.slug}`,
      },
      openGraph: {
        title: article.seo.title,
        description: article.seo.description,
        type: "article",
        publishedTime: article.date,
        url: `https://chekiapp.vercel.app/guides/${article.slug}`,
      },
      twitter: {
        card: "summary_large_image",
        title: article.seo.title,
        description: article.seo.description,
      },
    };
  });
}

const calloutStyles: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  info: { bg: "color-mix(in srgb, var(--green) 6%, var(--surface))", border: "color-mix(in srgb, var(--green) 20%, transparent)", text: "var(--green-dark)", icon: "ℹ" },
  warning: { bg: "var(--amber-light)", border: "color-mix(in srgb, var(--amber) 25%, transparent)", text: "var(--amber)", icon: "⚠" },
  tip: { bg: "var(--green-light)", border: "color-mix(in srgb, var(--green) 20%, transparent)", text: "var(--green-dark)", icon: "💡" },
  success: { bg: "var(--green-light)", border: "color-mix(in srgb, var(--green) 20%, transparent)", text: "var(--green-dark)", icon: "✓" },
  danger: { bg: "var(--red-light)", border: "color-mix(in srgb, var(--red) 20%, transparent)", text: "var(--red)", icon: "✕" },
  quote: { bg: "var(--surface-alt)", border: "var(--border)", text: "var(--ink-2)", icon: "❝" },
};

/** Auto-link URLs and code references in text content */
function renderRichText(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  // Competitor domains where we don't want to pass link equity
  const competitorDomains = ["check.et", "verify.et", "qbirr.com", "tinaverify.com", "tally.com.et"];
  const isCompetitor = (url: string) => competitorDomains.some(d => url.includes(d));
  // Split on URLs, inline code (backticks), and bold (**text**)
  const parts = text.split(
    /(\bhttps?:\/\/[^\s<]+|\b[a-z]+\.et\b|\b[a-z]+\.com\.et\b|`[^`]+`|\*\*[^*]+\*\*)/gi
  );

  parts.forEach((part, i) => {
    if (/^https?:\/\//.test(part)) {
      // URL - truncate display if long
      const display = part.length > 50 ? part.slice(0, 47) + "..." : part;
      nodes.push(
        <a
          key={i}
          href={part}
          target="_blank"
          rel={isCompetitor(part) ? "noopener noreferrer nofollow" : "noopener noreferrer"}
          style={{ color: "var(--green)", textDecoration: "none", borderBottom: "1px solid var(--green-light)" }}
        >
          {display}
        </a>
      );
    } else if (/^[a-z]+\.et$/i.test(part) || /^[a-z]+\.com\.et$/i.test(part)) {
      // Domain reference like check.et, verify.et - link to it
      const href = `https://${part}`;
      nodes.push(
        <a
          key={i}
          href={href}
          target="_blank"
          rel={isCompetitor(part) ? "noopener noreferrer nofollow" : "noopener noreferrer"}
          style={{ color: "var(--green)", textDecoration: "none", fontWeight: 500 }}
        >
          {part}
        </a>
      );
    } else if (/^`[^`]+`$/.test(part)) {
      // Inline code
      nodes.push(
        <code
          key={i}
          style={{
            fontFamily: "var(--mono)",
            fontSize: "13px",
            background: "var(--surface-alt)",
            padding: "1px 5px",
            borderRadius: "4px",
            color: "var(--green-dark)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    } else if (/^\*\*[^*]+\*\*$/.test(part)) {
      // Bold
      nodes.push(<strong key={i}>{part.slice(2, -2)}</strong>);
    } else if (part) {
      nodes.push(part);
    }
  });

  return nodes;
}

async function renderBlock(block: ContentBlock, key: number): Promise<React.ReactNode> {
  switch (block.type) {
    case "heading":
      return <h2 key={key} id={`section-${key}`}>{block.text}</h2>;

    case "text":
      return <p key={key}>{renderRichText(block.text)}</p>;

    case "list":
      return (
        <ul key={key}>
          {block.items.map((item, i) => <li key={i}>{renderRichText(item)}</li>)}
        </ul>
      );

    case "ordered":
      return (
        <ol key={key} style={{ paddingLeft: "20px", marginBottom: "16px" }}>
          {block.items.map((item, i) => <li key={i} style={{ marginBottom: "6px" }}>{renderRichText(item)}</li>)}
        </ol>
      );

    case "code": {
      const langLabel = getLangLabel(block.lang);
      const highlighted = await highlightCode(block.code, block.lang);
      return (
        <CodeBlock key={key} code={block.code} highlightedHtml={highlighted} langLabel={langLabel} />
      );
    }

    case "callout": {
      const s = calloutStyles[block.variant] || calloutStyles.info;
      return (
        <div key={key} style={{
          background: s.bg, border: `1px solid ${s.border}`, borderRadius: "8px",
          padding: "14px 16px", margin: "16px 0", display: "flex", gap: "10px", alignItems: "flex-start",
        }}>
          <span style={{ fontSize: "16px", flexShrink: 0, color: s.text }}>{s.icon}</span>
          <div>
            {block.title && <p style={{ fontWeight: 700, fontSize: "14px", color: s.text, marginBottom: "4px" }}>{renderRichText(block.title)}</p>}
            <p style={{ fontSize: "14px", color: s.text, lineHeight: 1.6 }}>{renderRichText(block.text)}</p>
          </div>
        </div>
      );
    }

    case "table":
      return (
        <div className="table-wrap" key={key}>
          <table>
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
          {block.cite && <cite style={{ display: "block", fontSize: "13px", marginTop: "4px", color: "var(--ink-3)" }}>- {block.cite}</cite>}
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
                color: "var(--bg)", fontWeight: 700, fontSize: "13px", flexShrink: 0,
              }}>{i + 1}</div>
              <div>
                <p style={{ fontWeight: 600, fontSize: "15px", marginBottom: "4px" }}>{renderRichText(step.title)}</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>{renderRichText(step.text)}</p>
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
  if (!article) notFound();

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
      { "@type": "ListItem", position: 1, name: "Home", item: "https://chekiapp.vercel.app/" },
      { "@type": "ListItem", position: 2, name: "Guides", item: "https://chekiapp.vercel.app/guides" },
      { "@type": "ListItem", position: 3, name: article.title, item: `https://chekiapp.vercel.app/guides/${article.slug}` },
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
          {/* TOC sidebar - appears above article on mobile, right side on desktop */}
          <aside className="toc-sidebar" style={{ order: 1 }}>
            <div className="toc-card" style={{
              padding: "20px",
              borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
            }}>
              <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "4px", height: "16px", background: "var(--green)", borderRadius: "2px", display: "inline-block" }} />
                In this article
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {article.content.map((b, i) => b.type === "heading" ? (
                  <a key={i} href={`#section-${i}`} style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.4, padding: "4px 0", borderLeft: "2px solid transparent", paddingLeft: "10px", transition: "all 0.15s" }} className="toc-link">{b.text}</a>
                ) : null)}
              </div>
            </div>
          </aside>

          <article className="prose" style={{ maxWidth: "720px", order: 2, minWidth: 0, overflowWrap: "break-word" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
              {article.category.replace("-", " ")} · {article.readTime} read
            </p>
            <h1 style={{ fontSize: "28px", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "12px", lineHeight: 1.15 }}>
              {article.title}
            </h1>
            <p style={{ fontSize: "17px", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: "28px" }}>
              {article.description}
            </p>

            {await Promise.all(article.content.map((block, i) => renderBlock(block, i)))}

            {article.faq && article.faq.length > 0 && (
              <div>
                <h2>Frequently asked questions</h2>
                <BouncyAccordion
                  items={article.faq.map((f, i) => ({
                    id: `faq-${i}`,
                    title: f.q,
                    description: renderRichText(f.a),
                  }))}
                />
              </div>
            )}

            {/* GitHub edit link */}
            <div style={{ marginTop: "32px", paddingTop: "24px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              <a
                href={`https://github.com/1RB/cheki/blob/main/src/lib/guides.ts`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "13px", color: "var(--ink-3)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.16.58.67.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z"/></svg>
                Edit this article on GitHub
              </a>
              <a
                href={`https://github.com/1RB/cheki/issues/new?labels=content&title=Feedback+on:+${encodeURIComponent(article.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: "13px", color: "var(--ink-3)", textDecoration: "none" }}
              >
                Report an issue →
              </a>
            </div>

            {related.length > 0 && (
              <div style={{ marginTop: "48px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
                  <span style={{ width: "4px", height: "22px", background: "var(--green)", borderRadius: "2px" }} />
                  <h2 style={{ fontSize: "20px", fontWeight: 800, margin: 0, letterSpacing: "-0.01em" }}>Continue reading</h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {related.map((r) => (
                    <a key={r.slug} href={`/guides/${r.slug}`} style={{
                      padding: "18px 22px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px",
                      transition: "all 0.15s", textDecoration: "none",
                    }} className="related-card">
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: "15px", fontWeight: 700, marginBottom: "4px", color: "var(--ink)" }}>{r.title}</p>
                        <p style={{ fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.5, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{r.excerpt}</p>
                      </div>
                      <span style={{ flexShrink: 0, width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)", fontSize: "16px", fontWeight: 700, transition: "all 0.15s" }} className="related-arrow">{"\u2192"}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </main>
      <Footer />
    </>
  );
}
