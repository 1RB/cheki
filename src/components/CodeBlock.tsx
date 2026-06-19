"use client";

import { useState } from "react";

interface CodeBlockProps {
  code: string;
  highlightedHtml: string;
  langLabel: string | null;
}

export function CodeBlock({ code, highlightedHtml, langLabel }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = code;
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
    <div style={{ margin: "14px 0" }}>
      <div className="code-block-header">
        <span className="code-lang-label">{langLabel || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className={`code-copy-btn${copied ? " copied" : ""}`}
          aria-label="Copy code"
        >
          {copied ? "✓ copied" : "copy"}
        </button>
      </div>
      <pre className="code-block" style={{ margin: 0, borderRadius: langLabel ? "0 0 10px 10px" : "10px" }}>
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  );
}
