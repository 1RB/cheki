"use client";

import { useState, useMemo } from "react";
import { articles } from "@/lib/guides";
import { Nav, Footer } from "@/components/Chrome";

const categoryLabels: Record<string, string> = {
  bank: "Banks",
  fraud: "Fraud",
  business: "Business",
  api: "API",
  comparison: "Comparisons",
  technical: "Technical",
  "open-source": "Open Source",
};

const categoryColors: Record<string, string> = {
  bank: "#2563eb",
  fraud: "#dc2626",
  business: "#7c3aed",
  api: "#059669",
  comparison: "#d97706",
  technical: "#0891b2",
  "open-source": "#db2777",
};

export default function GuidesPage() {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    articles.forEach((a) => tags.add(a.category));
    return Array.from(tags);
  }, []);

  const filtered = useMemo(() => {
    return articles.filter((a) => {
      const matchesTag = !activeTag || a.category === activeTag;
      const q = query.toLowerCase().trim();
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return matchesTag && matchesQuery;
    });
  }, [query, activeTag]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => b.date.localeCompare(a.date));
  }, [filtered]);

  return (
    <>
      <Nav />
      <main style={{ paddingTop: "40px", paddingBottom: "48px" }}>
        {/* Header */}
        <div className="container" style={{ marginBottom: "32px" }}>
          <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
            <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
            <span style={{ margin: "0 6px"}}>/</span>
            <span style={{ color: "var(--ink)" }}>Guides</span>
          </nav>
          <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "10px" }}>
            Guides and articles
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "560px", lineHeight: 1.5 }}>
            Practical guides on Ethiopian receipt verification, payment fraud, API integration, and open source fintech. No paywall, no fluff.
          </p>
        </div>

        {/* Search + Tags */}
        <div className="container" style={{ marginBottom: "28px" }}>
          {/* Search bar */}
          <div style={{
            position: "relative",
            marginBottom: "16px",
          }}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                position: "absolute",
                left: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--ink-3)",
                pointerEvents: "none",
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search articles..."
              style={{
                width: "100%",
                padding: "12px 16px 12px 44px",
                fontSize: "15px",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                background: "var(--surface)",
                color: "var(--ink)",
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--green)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                style={{
                  position: "absolute",
                  right: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-3)",
                  padding: "4px",
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Tag pills */}
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveTag(null)}
              style={{
                padding: "6px 14px",
                fontSize: "13px",
                fontWeight: 600,
                border: `1px solid ${!activeTag ? "var(--green)" : "var(--border)"}`,
                borderRadius: "20px",
                background: !activeTag ? "var(--green-light)" : "var(--surface)",
                color: !activeTag ? "var(--green-dark)" : "var(--ink-2)",
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              All ({articles.length})
            </button>
            {allTags.map((tag) => {
              const count = articles.filter((a) => a.category === tag).length;
              const isActive = activeTag === tag;
              const color = categoryColors[tag] || "var(--ink)";
              return (
                <button
                  key={tag}
                  onClick={() => setActiveTag(isActive ? null : tag)}
                  style={{
                    padding: "6px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    border: `1px solid ${isActive ? color : "var(--border)"}`,
                    borderRadius: "20px",
                    background: isActive ? `${color}15` : "var(--surface)",
                    color: isActive ? color : "var(--ink-2)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                  {categoryLabels[tag] || tag} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <div className="container">
          {sorted.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <p style={{ fontSize: "16px", color: "var(--ink-3)", marginBottom: "8px" }}>No articles found</p>
              <p style={{ fontSize: "14px", color: "var(--ink-3)" }}>
                Try a different search or{" "}
                <button onClick={() => { setQuery(""); setActiveTag(null); }} style={{ color: "var(--green)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  clear filters
                </button>
              </p>
            </div>
          )}

          {/* Article grid — masonry-style with varying card sizes */}
          {sorted.length > 0 && (
            <>
              <p style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "16px" }}>
                {sorted.length} {sorted.length === 1 ? "article" : "articles"}
                {activeTag && ` in ${categoryLabels[activeTag]}`}
                {query && ` matching "${query}"`}
              </p>
              <div className="guides-grid">
                {sorted.map((a, i) => {
                  const color = categoryColors[a.category] || "var(--green)";
                  const isFeatured = i === 0 && !query && !activeTag;

                  return (
                    <a
                      key={a.slug}
                      href={`/guides/${a.slug}`}
                      className={isFeatured ? "guide-card-featured" : "guide-card"}
                      style={{
                        padding: isFeatured ? "28px" : "20px",
                        borderRadius: "14px",
                        background: "var(--surface)",
                        border: `1px solid ${isFeatured ? `${color}40` : "var(--border)"}`,
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                        textDecoration: "none",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      {/* Color accent bar */}
                      <div style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: "3px",
                        background: color,
                        opacity: 0.8,
                      }} />

                      {/* Category + read time */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: 700,
                          color: color,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                        }}>
                          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color }} />
                          {categoryLabels[a.category] || a.category}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--ink-3)", fontFamily: "var(--mono)" }}>{a.readTime}</span>
                      </div>

                      {/* Title */}
                      <h3 style={{
                        fontSize: isFeatured ? "22px" : "16px",
                        fontWeight: 700,
                        lineHeight: 1.3,
                        color: "var(--ink)",
                        margin: 0,
                      }}>
                        {a.title}
                      </h3>

                      {/* Excerpt */}
                      <p style={{
                        fontSize: isFeatured ? "15px" : "13px",
                        color: "var(--ink-2)",
                        lineHeight: 1.5,
                        flex: 1,
                        margin: 0,
                      }}>
                        {a.excerpt}
                      </p>

                      {/* Footer: date + read link */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        paddingTop: "8px",
                        borderTop: "1px solid var(--border)",
                      }}>
                        <span style={{ fontSize: "12px", color: "var(--ink-3)" }}>
                          {new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span style={{
                          fontSize: "13px",
                          color: "var(--green-dark)",
                          fontWeight: 600,
                        }}>
                          Read →
                        </span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
