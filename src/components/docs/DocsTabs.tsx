"use client";

import { useState } from "react";

interface TabContent {
  lang: string;
  highlightedHtml: string;
  rawCode: string;
}

interface DocsTabsProps {
  tabs: TabContent[];
}

export function DocsTabs({ tabs }: DocsTabsProps) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(tabs[active].rawCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = tabs[active].rawCode;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
      document.body.removeChild(ta);
    }
  };

  return (
    <div style={{ marginBottom: "20px" }}>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: "0",
          marginBottom: "0",
          overflowX: "auto",
          scrollbarWidth: "thin",
        }}
      >
        {tabs.map((tab, i) => (
          <button
            key={tab.lang}
            type="button"
            onClick={() => setActive(i)}
            style={{
              padding: "8px 16px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "8px 8px 0 0",
              background:
                active === i ? "var(--code-bg)" : "var(--surface-alt)",
              color: active === i ? "#fff" : "var(--ink-3)",
              border: "1px solid var(--border)",
              borderBottom: active === i ? "none" : "1px solid var(--border)",
              cursor: "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              fontFamily: "var(--sans)",
            }}
          >
            {tab.lang}
          </button>
        ))}
      </div>
      {/* Code content */}
      <div
        style={{
          position: "relative",
          background: "var(--code-bg)",
          borderRadius: "0 8px 8px 8px",
          border: "1px solid var(--border)",
        }}
      >
        <button
          type="button"
          onClick={handleCopy}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            padding: "5px 12px",
            fontSize: "12px",
            fontWeight: 500,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "6px",
            color: copied ? "var(--green)" : "rgba(255,255,255,0.6)",
            cursor: "pointer",
            transition: "all 0.15s",
            fontFamily: "var(--sans)",
            zIndex: 1,
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <pre
          className="code-block"
          style={{
            margin: 0,
            padding: "18px 20px",
            fontSize: "13px",
            lineHeight: 1.6,
            overflow: "auto",
          }}
        >
          <code
            dangerouslySetInnerHTML={{ __html: tabs[active].highlightedHtml }}
          />
        </pre>
      </div>
    </div>
  );
}
