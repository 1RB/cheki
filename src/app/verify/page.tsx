import type { Metadata } from "next";
import { allSeoPages, type SeoPage } from "@/lib/seo-pages";
import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Verify guides",
  description:
    "Every cheki verify guide in one place: check a CBE, Telebirr, BOA or M-Pesa receipt, spot a fake, read the receipt format, or integrate the free API.",
  alternates: {
    canonical: "/verify",
  },
  openGraph: {
    title: "Verify guides | cheki",
    description:
      "Every cheki verify guide in one place — bank checks, fraud red flags, receipt formats, and the free API.",
    type: "website",
    url: "https://cheki.et/verify",
  },
};

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.et/" },
    { "@type": "ListItem", position: 2, name: "Verify guides", item: "https://cheki.et/verify" },
  ],
};

const groups: { intent: SeoPage["intent"]; label: string; blurb: string }[] = [
  {
    intent: "transactional",
    label: "Verify a payment",
    blurb: "Paste a reference number and check it against the bank's own endpoint.",
  },
  {
    intent: "informational",
    label: "Understand the receipt",
    blurb: "Formats, field mappings, and the red flags that separate a real receipt from an edited one.",
  },
  {
    intent: "commercial",
    label: "API, SDKs and business",
    blurb: "Integrate verification into a product, or see how cheki compares with the paid services.",
  },
  {
    intent: "navigational",
    label: "More",
    blurb: "Everything else worth reading.",
  },
];

export default function VerifyIndex() {
  const grouped = groups
    .map((g) => ({ ...g, pages: allSeoPages.filter((p) => p.intent === g.intent) }))
    .filter((g) => g.pages.length > 0);

  return (
    <>
      <Nav />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <main style={{ paddingTop: "40px", paddingBottom: "48px" }}>
        <div className="container" style={{ marginBottom: "32px" }}>
          <nav aria-label="Breadcrumb" style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
            <Link href="/" style={{ color: "var(--ink-3)" }}>Home</Link>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: "var(--ink)" }}>Verify guides</span>
          </nav>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "10px" }}>
            Verify guides
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "60ch", lineHeight: 1.5 }}>
            How to check any Ethiopian payment, in depth — one page per bank, per fraud pattern,
            and per API surface. All of it free, none of it gated.
          </p>
        </div>

        {grouped.map((g) => (
          <section key={g.intent} className="container" style={{ marginBottom: "40px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.01em", marginBottom: "4px" }}>{g.label}</h2>
            <p style={{ fontSize: "14px", color: "var(--ink-3)", marginBottom: "14px", maxWidth: "60ch" }}>{g.blurb}</p>
            <ul style={{ listStyle: "none", display: "grid", gap: "8px" }}>
              {g.pages.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/verify/${p.slug}`}
                    style={{
                      display: "block",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "1px solid var(--border)",
                      background: "var(--surface)",
                      textDecoration: "none",
                    }}
                  >
                    <span style={{ display: "block", fontSize: "15px", fontWeight: 600, color: "var(--ink)" }}>{p.h1}</span>
                    <span style={{ display: "block", fontSize: "13px", color: "var(--ink-2)", lineHeight: 1.55, marginTop: "4px", maxWidth: "72ch" }}>{p.metaDescription}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <section className="container" style={{ marginTop: "8px" }}>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", maxWidth: "60ch", lineHeight: 1.6 }}>
            Want the short version?{" "}
            <Link href="/" style={{ color: "var(--green-dark)", fontWeight: 600 }}>Verify a receipt on the homepage</Link>
            , or read the{" "}
            <Link href="/guides" style={{ color: "var(--green-dark)", fontWeight: 600 }}>step-by-step guides</Link>.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
