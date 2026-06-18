import type { Metadata } from "next";
import { guides } from "@/lib/guides";
import { Nav, Footer } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Payment Verification Guides for Ethiopia | cheki",
  description: "Step-by-step tutorials for CBE, Telebirr, Dashen, Awash, BOA, Zemen, CBE Birr, M-Pesa, fraud prevention, and business workflows.",
};

const categoryLabels: Record<string, string> = {
  bank: "Bank guides",
  fraud: "Fraud prevention",
  business: "Business",
  api: "API integration",
  comparison: "Comparisons",
};

export default function GuidesPage() {
  const categories = Object.keys(categoryLabels);
  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
          <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
          <span style={{ margin: "0 6px"}}>/</span>
          <span style={{ color: "var(--ink)" }}>Guides</span>
        </nav>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "12px" }}>
          Ethiopian payment verification guides
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "600px", marginBottom: "40px" }}>
          Step-by-step tutorials for CBE, Telebirr, Dashen, Awash, BOA, Zemen, CBE Birr, M-Pesa, fraud prevention, and business workflows.
        </p>

        {categories.map((cat) => {
          const catGuides = guides.filter((g) => g.category === cat);
          if (catGuides.length === 0) return null;
          return (
            <div key={cat} style={{ marginBottom: "40px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>{categoryLabels[cat]}</h2>
              <div className="grid-2" style={{ gap: "16px" }}>
                {catGuides.map((g) => (
                  <a key={g.slug} href={`/guides/${g.slug}`} style={{
                    padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
                  }}>
                    <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px", lineHeight: 1.3 }}>{g.title}</h3>
                    <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>{g.excerpt}</p>
                    <p style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600, marginTop: "12px" }}>Read guide</p>
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
