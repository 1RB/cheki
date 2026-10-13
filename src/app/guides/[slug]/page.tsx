import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { articles, getArticle, getRelatedArticles, type ContentBlock } from "@/lib/guides";
import { Nav, Footer } from "@/components/Chrome";
import { CodeBlock } from "@/components/CodeBlock";
import { highlightCode, getLangLabel } from "@/lib/highlight";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { T } from "@/components/home/T";
import { formatGuideDate, oneLine } from "@/lib/guides-index";
import { guideArticleJsonLd, guideMetadata, jsonLdScript, SITE } from "@/lib/guides-seo";
import "@/components/guides/guides.css";

export function generateStaticParams() {
  return articles.map((a) => ({ slug: a.slug }));
}

export function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  return params.then((p) => {
    const article = getArticle(p.slug);
    return article ? guideMetadata(article) : { title: "Article not found" };
  });
}

/** Callouts carry colour only as an 8px dot, and only when they warn. */
const calloutTone: Record<string, "warning" | "danger" | undefined> = { warning: "warning", danger: "danger" };

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
        >
          {part}
        </a>
      );
    } else if (/^`[^`]+`$/.test(part)) {
      // Inline code
      nodes.push(
        <code key={i} className="ga-code">
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

/** A heading's anchor: its stable id when it has one, else its position. */
function headingId(block: Extract<ContentBlock, { type: "heading" }>, index: number): string {
  return block.id ?? `section-${index}`;
}

async function renderBlock(block: ContentBlock, key: number): Promise<React.ReactNode> {
  switch (block.type) {
    case "heading":
      return <h2 key={key} id={headingId(block, key)}>{block.text}</h2>;

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
      const tone = calloutTone[block.variant];
      const dot = tone ? <span className="ga-dot" aria-hidden="true" /> : null;
      return (
        <aside key={key} className="ga-callout" data-tone={tone}>
          {block.title ? (
            <p className="ga-callout-title">{dot}<span>{renderRichText(block.title)}</span></p>
          ) : null}
          <p>{!block.title && dot ? <>{dot} </> : null}{renderRichText(block.text)}</p>
        </aside>
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
        <blockquote key={key} className="ga-quote">
          {block.text}
          {block.cite && <cite>{block.cite}</cite>}
        </blockquote>
      );

    case "steps":
      return (
        <ol key={key} className="ga-steps" role="list">
          {block.items.map((step, i) => (
            <li key={i}>
              <span className="ga-step-n">{i + 1}.</span>
              <div>
                <p className="ga-step-title">{renderRichText(step.title)}</p>
                <p className="ga-step-text">{renderRichText(step.text)}</p>
              </div>
            </li>
          ))}
        </ol>
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
  const toc = article.content.flatMap((b, i) => (b.type === "heading" ? [{ id: headingId(b, i), text: b.text }] : []));

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
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE}/guides` },
      { "@type": "ListItem", position: 3, name: article.title, item: `${SITE}/guides/${article.slug}` },
    ],
  };

  const tocList = (
    <ol className="ga-toc-list" role="list">
      {toc.map((h) => (
        <li key={h.id}><a href={`#${h.id}`}>{h.text}</a></li>
      ))}
    </ol>
  );

  return (
    <div className="guides-scope">
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(guideArticleJsonLd(article)) }} />
      {faqJsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(faqJsonLd) }} />}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }} />
      <main className="container ga">
        <nav aria-label="Breadcrumb">
          <ol className="ga-crumb" role="list">
            <li><Link href="/" prefetch={false}>Home</Link></li>
            <li><Link href="/guides" prefetch={false}><T k="guides.title" /></Link></li>
            <li aria-current="page">{article.title.length > 40 ? `${article.title.slice(0, 40).trimEnd()}...` : article.title}</li>
          </ol>
        </nav>

        <div className="ga-grid">
          <article>
            <h1 className="ga-title">{article.title}</h1>
            <p className="ga-desc">{article.description}</p>
            <p className="ga-meta">
              <span><T k="guides.read" vars={{ time: article.readTime }} /></span>
              <span>
                <time dateTime={article.updated}><T k="guides.updated" vars={{ date: formatGuideDate(article.updated) }} /></time>
              </span>
              {article.updated !== article.date && (
                <span>
                  <time dateTime={article.date}><T k="guides.published" vars={{ date: formatGuideDate(article.date) }} /></time>
                </span>
              )}
            </p>

            {toc.length > 0 && (
              <details className="ga-toc-m">
                <summary>
                  <T k="guides.toc" />
                  <span className="ga-toc-count">{toc.length}</span>
                </summary>
                {tocList}
              </details>
            )}

            <div className="prose ga-prose">
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

              <div className="ga-foot">
                <a href="https://github.com/1RB/cheki/blob/main/src/lib/guides.ts" target="_blank" rel="noopener noreferrer">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.09.66-.22.66-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.89 1.52 2.34 1.08 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02.8-.22 1.65-.33 2.5-.33.85 0 1.7.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.85V21c0 .27.16.58.67.48A10 10 0 0 0 22 12c0-5.52-4.48-10-10-10z"/></svg>
                  <T k="guides.edit" />
                </a>
                <a
                  href={`https://github.com/1RB/cheki/issues/new?labels=content&title=Feedback+on:+${encodeURIComponent(article.title)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <T k="guides.report" />
                </a>
              </div>

              {related.length > 0 && (
                <section className="ga-related" aria-labelledby="ga-related">
                  <h2 id="ga-related"><T k="guides.related" /></h2>
                  <ul className="gx-rows" role="list">
                    {related.map((r) => (
                      <li key={r.slug}>
                        <Link href={`/guides/${r.slug}`} prefetch={false} className="gx-row">
                          <span className="gx-row-title">{r.title}</span>
                          <span className="gx-row-excerpt">{oneLine(r.excerpt)}</span>
                          <span className="gx-row-meta">
                            <span><T k="guides.read" vars={{ time: r.readTime }} /></span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </article>

          {toc.length > 0 && (
            <aside className="ga-toc-d" aria-labelledby="ga-toc-title">
              <p id="ga-toc-title" className="ga-toc-title"><T k="guides.toc" /></p>
              {tocList}
            </aside>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
