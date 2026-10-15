/**
 * /about, /privacy and /contact: one prose layout in the guides' type scale
 * (src/components/guides/guides.css), content from src/lib/trust-pages.ts.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { T } from "@/components/home/T";
import { formatGuideDate } from "@/lib/guides-index";
import { jsonLdScript, SITE } from "@/lib/guides-seo";
import { ORGANIZATION_ID } from "@/lib/site-schema";
import type { Inline, TrustPage } from "@/lib/trust-pages";
import "@/components/guides/guides.css";

const PAGE_TYPE: Record<TrustPage["path"], string> = {
  "/about": "AboutPage",
  "/privacy": "WebPage",
  "/contact": "ContactPage",
};

export function trustPageMetadata(p: TrustPage): Metadata {
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: {
      title: p.title,
      description: p.description,
      type: "website",
      url: `${SITE}${p.path}`,
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "cheki.et" }],
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.description },
  };
}

export function trustPageJsonLd(p: TrustPage) {
  return [
    {
      "@context": "https://schema.org",
      "@type": PAGE_TYPE[p.path],
      "@id": `${SITE}${p.path}`,
      url: `${SITE}${p.path}`,
      name: p.heading,
      description: p.description,
      dateModified: p.updated,
      inLanguage: "en",
      isPartOf: { "@type": "WebSite", url: `${SITE}/` },
      about: { "@id": ORGANIZATION_ID },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: p.heading, item: `${SITE}${p.path}` },
      ],
    },
  ];
}

function Rich({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((x, i) => {
        if (typeof x === "string") return <span key={i}>{x}</span>;
        if (x.href.startsWith("/")) {
          return <Link key={i} href={x.href} prefetch={false}>{x.text}</Link>;
        }
        return <a key={i} href={x.href} target="_blank" rel="noopener noreferrer">{x.text}</a>;
      })}
    </>
  );
}

export function TrustPageView({ page }: { page: TrustPage }) {
  return (
    <div className="guides-scope">
      <Nav />
      {trustPageJsonLd(page).map((ld, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(ld) }} />
      ))}
      <main className="container ga">
        <nav aria-label="Breadcrumb">
          <ol className="ga-crumb" role="list">
            <li><Link href="/" prefetch={false}>Home</Link></li>
            <li aria-current="page">{page.heading}</li>
          </ol>
        </nav>
        <article className="trust-article">
          <h1 className="ga-title">{page.heading}</h1>
          <p className="ga-desc"><Rich parts={page.intro} /></p>
          <p className="ga-meta">
            <span>
              <time dateTime={page.updated}><T k="guides.updated" vars={{ date: formatGuideDate(page.updated) }} /></time>
            </span>
          </p>
          <div className="prose ga-prose">
            {page.sections.map((s) => (
              <section key={s.id} aria-labelledby={s.id}>
                <h2 id={s.id}>{s.heading}</h2>
                {s.paragraphs?.map((p, i) => <p key={i}><Rich parts={p} /></p>)}
                {s.bullets && (
                  <ul>
                    {s.bullets.map((b, i) => <li key={i}><Rich parts={b} /></li>)}
                  </ul>
                )}
              </section>
            ))}
          </div>
        </article>
      </main>
      <Footer />
    </div>
  );
}
