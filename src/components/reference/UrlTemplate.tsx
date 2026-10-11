"use client";

/**
 * An endpoint template as one copyable line. Placeholders ({REFERENCE}) are
 * set apart by weight and a soft ground. Rendered on the server like any
 * client component, so the URL is in the HTML for crawlers and no-JS readers;
 * only the copy button needs JavaScript.
 */
import { useState } from "react";

export function UrlTemplate({ template }: { template: string }) {
  const [copied, setCopied] = useState(false);
  const parts = template.split(/(\{[^{}]+\})/g).filter(Boolean);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div className="ep-url">
      <code>
        {parts.map((p, i) => (/^\{[^{}]+\}$/.test(p) ? <span key={i} className="ep-ph">{p}</span> : <span key={i}>{p}</span>))}
      </code>
      <button type="button" className="ep-copy" onClick={copy} aria-label={copied ? "Copied" : "Copy URL template"}>
        {copied ? "Copied" : "Copy"}
      </button>
      <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
    </div>
  );
}
