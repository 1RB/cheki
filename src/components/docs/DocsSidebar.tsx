"use client";

import { useState, useEffect } from "react";

interface DocsSection {
  id: string;
  label: string;
  group?: string;
}

interface DocsSidebarProps {
  sections: DocsSection[];
}

export function DocsSidebar({ sections }: DocsSidebarProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [sections]);

  // Group sections
  const groups: Record<string, DocsSection[]> = {};
  for (const s of sections) {
    const g = s.group || "Reference";
    if (!groups[g]) groups[g] = [];
    groups[g].push(s);
  }
  const groupOrder = ["Getting Started", "Endpoints", "SDKs", "Reference"];

  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "12px",
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <p
        style={{
          fontSize: "12px",
          fontWeight: 700,
          color: "var(--ink)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "14px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <span
          style={{
            width: "4px",
            height: "16px",
            background: "var(--green)",
            borderRadius: "2px",
            display: "inline-block",
          }}
        />
        API Reference
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {groupOrder.map((group) => {
          const items = groups[group];
          if (!items || items.length === 0) return null;
          return (
            <div key={group}>
              <p
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: "6px",
                  paddingLeft: "12px",
                }}
              >
                {group}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                {items.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className={
                      activeSection === s.id
                        ? "docs-nav-link active"
                        : "docs-nav-link"
                    }
                    style={{
                      fontSize: "13px",
                      lineHeight: 1.4,
                      padding: "6px 12px",
                      borderRadius: "6px",
                      transition: "all 0.15s",
                      color:
                        activeSection === s.id
                          ? "var(--green-dark)"
                          : "var(--ink-2)",
                      background:
                        activeSection === s.id
                          ? "var(--green-light)"
                          : "transparent",
                      fontWeight: activeSection === s.id ? 600 : 400,
                      borderLeft:
                        activeSection === s.id
                          ? "2px solid var(--green)"
                          : "2px solid transparent",
                    }}
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
