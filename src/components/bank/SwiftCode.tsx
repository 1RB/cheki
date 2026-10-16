"use client";

/**
 * A bank's head-office SWIFT/BIC as reference info: the code (monospace, it
 * is an ID), one copy action, how far it was checked, and when and where. The
 * code and sources are server-rendered; only the copy button needs JS.
 */
import { useEffect, useRef, useState } from "react";
import type { BankSwift } from "@/lib/core/types";
import { formatCheckedAt, swiftRegistryNote, swiftSourceLabel } from "@/lib/swift";
import "./swift-code.css";

export function SwiftCode({ swift, bankShortName }: { swift: BankSwift; bankShortName: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(swift.bic);
    } catch {
      // Clipboard blocked: the code stays selectable (user-select: all).
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="swift-ref">
      <div className="swift-ref-row">
        <code className="swift-ref-bic">{swift.bic}</code>
        <button type="button" className="swift-ref-copy" onClick={copy} aria-label={`Copy SWIFT code ${swift.bic}`}>
          {copied ? "Copied" : "Copy"}
        </button>
        <span className="sr-only" aria-live="polite">{copied ? `${swift.bic} copied` : ""}</span>
      </div>
      <p className="swift-ref-meta">
        {swiftRegistryNote(swift)}. Last checked {formatCheckedAt(swift.checkedAt)} against{" "}
        {swift.sources.map((url, i) => (
          <span key={url}>
            {i > 0 ? (i === swift.sources.length - 1 ? " and " : ", ") : ""}
            <a href={url} rel="noopener noreferrer nofollow" target="_blank">{swiftSourceLabel(url, bankShortName)}</a>
          </span>
        ))}
        .
      </p>
    </div>
  );
}
