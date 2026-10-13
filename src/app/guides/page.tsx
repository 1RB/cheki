import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { banks } from "@/lib/banks";
import { withArticle } from "@/lib/indefinite-article";
import { T } from "@/components/home/T";
import { GuidesSearch } from "@/components/guides/GuidesSearch";
import { formatGuideDate, guideSearchText, guideSections, oneLine, orderedGuides } from "@/lib/guides-index";
import { guidesItemListJsonLd, jsonLdScript, SITE } from "@/lib/guides-seo";
import "@/components/guides/guides.css";

/**
 * The guides index. A server component: every row is in the HTML, grouped by
 * the job the reader came to do. Search is the one client island.
 */
export default function GuidesPage() {
  const sections = guideSections();
  // "Verify a receipt" leads with the bank pages: each one is the checker and
  // the step-by-step how-to for that bank (the old how-to guides 301 there).
  const bankRows = banks.filter((b) => b.status === "live");
  const total = sections.reduce((n, s) => n + s.guides.length, 0) + bankRows.length;

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE}/` },
      { "@type": "ListItem", position: 2, name: "Guides", item: `${SITE}/guides` },
    ],
  };

  return (
    <div className="guides-scope">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdScript(guidesItemListJsonLd(orderedGuides())) }} />
      <Nav />
      <main className="container gx">
        <header>
          <h1 className="gx-title"><T k="guides.title" /></h1>
          <p className="gx-lede"><T k="guides.lede" /></p>
        </header>

        <GuidesSearch listId="guides-list" total={total} />

        <div id="guides-list" className="gx-list">
          {sections.map((s) => (
            <section key={s.id} className="gx-section" aria-labelledby={`gx-${s.id}`} data-guide-section={s.id}>
              <div className="gx-section-head">
                <h2 id={`gx-${s.id}`} className="gx-h2"><T k={`guides.sections.${s.id}.title`} /></h2>
                <p className="gx-blurb"><T k={`guides.sections.${s.id}.blurb`} /></p>
              </div>
              <ul className="gx-rows" role="list">
                {s.id === "verify" &&
                  bankRows.map((b) => (
                    <li key={`bank-${b.code}`} data-guide-row data-bank-row data-search={`${b.shortName} ${b.name} receipt check verify how to`.toLowerCase()}>
                      <Link href={`/banks/${b.code}`} prefetch={false} className="gx-row">
                        <span className="gx-row-title">How to verify {withArticle(b.shortName)} receipt</span>
                        <span className="gx-row-excerpt">{oneLine(b.seo.description)}</span>
                      </Link>
                    </li>
                  ))}
                {s.guides.map((a) => (
                  <li key={a.slug} data-guide-row data-search={guideSearchText(a)}>
                    <Link href={`/guides/${a.slug}`} prefetch={false} className="gx-row">
                      <span className="gx-row-title">{a.title}</span>
                      <span className="gx-row-excerpt">{oneLine(a.excerpt)}</span>
                      <span className="gx-row-meta">
                        <span><T k="guides.read" vars={{ time: a.readTime }} /></span>
                        <span>
                          <time dateTime={a.updated}><T k="guides.updated" vars={{ date: formatGuideDate(a.updated) }} /></time>
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
}
