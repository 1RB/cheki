import type { Metadata } from "next";
import { articles } from "@/lib/guides";
import { Nav, Footer } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Payment Verification Guides and Articles | cheki",
  description: "Original guides on Ethiopian receipt verification, payment fraud prevention, API integration, self-hosting, and open source fintech. Free, practical, no paywall.",
};

const categoryLabels: Record<string, string> = {
  bank: "Bank guides",
  fraud: "Fraud prevention",
  business: "Business",
  api: "API & developers",
  comparison: "Comparisons",
  technical: "Technical deep dives",
  "open-source": "Open source",
};

const categoryOrder = ["bank", "comparison", "fraud", "api", "technical", "open-source", "business"];

export default function GuidesPage() {
  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "40px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>Guides</span>
        </nav>
        <h1 style={{ fontSize: "clamp(26px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "12px" }}>
          Guides and articles
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "16px", maxWidth: "600px", marginBottom: "40px" }}>
          Original, practical guides on Ethiopian receipt verification, payment fraud, API integration, and open source fintech. No paywall, no fluff.
        </p>

        {categoryOrder.map((cat) => {
          const catArticles = articles.filter((a) => a.category === cat);
          if (catArticles.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px", color: "var(--ink)" }}>{categoryLabels[cat] || cat}</h2>
              <div className="grid-2" style={{ gap: "16px" }}>
                {catArticles.map((a) => (
                  <a key={a.slug} href={`/guides/${a.slug}`} style={{
                    padding: "20px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
                    display: "flex", flexDirection: "column", gap: "8px",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        {a.category.replace("-", " ")}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--ink-3)" }}>{a.readTime}</span>
                    </div>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, lineHeight: 1.3 }}>{a.title}</h3>
                    <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>{a.excerpt}</p>
                    <p style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600, marginTop: "auto" }}>Read article →</p>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </main>
      <Footer />
    </>
  );
}
