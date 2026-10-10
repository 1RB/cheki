"use client";

/**
 * Inline receipt checker for a single provider, rendered at the top of each
 * /banks/[code] page. The form markup is server-rendered (client components
 * still SSR their initial HTML), so search engines and no-JS visitors see a
 * real tool on the landing page instead of a link to one.
 *
 * Deliberately small: reference + (account | phone) -> POST /api/verify.
 * Photo/QR/batch/fallback flows stay on the homepage checker, linked below.
 */
import { useState } from "react";
import Link from "next/link";
import type { VerifyResult } from "@/lib/banks";

interface Props {
  code: string;
  shortName: string;
  referenceExample: string;
  requiresAccount: boolean;
  accountLabel?: string;
  accountDigits?: number;
  requiresPhone?: boolean;
}

export function BankChecker({
  code,
  shortName,
  referenceExample,
  requiresAccount,
  accountLabel,
  accountDigits,
  requiresPhone,
}: Props) {
  const [reference, setReference] = useState("");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsExtra = requiresAccount || requiresPhone;
  const extraLabel = requiresPhone
    ? "Payer phone number"
    : accountLabel || `Receiving account (last ${accountDigits ?? 8} digits)`;
  const extraPlaceholder = requiresPhone ? "2519XXXXXXXX" : "e.g. 60536171";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank: code,
          reference: reference.trim(),
          ...(requiresPhone
            ? { phoneNumber: extra.trim() || undefined }
            : { accountNumber: extra.trim() || undefined }),
        }),
      });
      const data: VerifyResult = await resp.json();
      setResult(data);
      if (!data.success) setError(data.error || "Verification failed.");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  const field: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: "8px",
    border: "1px solid var(--border)", background: "var(--bg)", color: "var(--ink)",
    fontSize: "15px",
  };
  const label: React.CSSProperties = {
    display: "block", fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px",
  };

  return (
    <section
      id="check"
      aria-label={`${shortName} receipt checker`}
      style={{
        padding: "24px", borderRadius: "12px", background: "var(--surface)",
        border: "1px solid var(--border)", marginBottom: "40px", maxWidth: "680px",
      }}
    >
      <form onSubmit={onSubmit}>
        <div style={{ marginBottom: "14px" }}>
          <label htmlFor="cheki-ref" style={label}>{shortName} transaction reference or receipt link</label>
          <input
            id="cheki-ref"
            name="reference"
            style={field}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={referenceExample ? `e.g. ${referenceExample}` : "Transaction reference"}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        {needsExtra && (
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="cheki-extra" style={label}>{extraLabel}</label>
            <input
              id="cheki-extra"
              name={requiresPhone ? "phone" : "account"}
              style={field}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={extraPlaceholder}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%", padding: "13px 24px", borderRadius: "8px", border: "none",
            background: "var(--green-cta)", color: "var(--green-cta-fg)",
            fontSize: "15px", fontWeight: 600, cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Checking..." : `Check ${shortName} receipt`}
        </button>
        <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "10px" }}>
          Free, no signup. Checked against {shortName}&apos;s own receipt record.{" "}
          <Link href="/#verify" style={{ color: "var(--green-dark)" }}>Scan a QR code or photo instead</Link>
        </p>
      </form>

      {error && (
        <p role="alert" style={{ marginTop: "16px", padding: "12px 14px", borderRadius: "8px", background: "var(--amber-light)", color: "var(--amber-text)", fontSize: "14px" }}>
          {error}
          {result?.fallbackUrl && (
            <> {" "}<a href={result.fallbackUrl} target="_blank" rel="noopener noreferrer">Open the official receipt</a></>
          )}
        </p>
      )}

      {result?.success && (
        <dl
          aria-live="polite"
          style={{
            marginTop: "16px", padding: "16px", borderRadius: "8px", background: "var(--green-light)",
            display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: "14px",
          }}
        >
          <dt style={{ fontWeight: 600 }}>Status</dt>
          <dd style={{ margin: 0, color: "var(--green-dark)", fontWeight: 700 }}>Found in {shortName}&apos;s records</dd>
          {result.amount != null && (<><dt style={{ fontWeight: 600 }}>Amount</dt><dd style={{ margin: 0 }}>{result.amount.toLocaleString()} {result.currency || "ETB"}</dd></>)}
          {result.senderName && (<><dt style={{ fontWeight: 600 }}>From</dt><dd style={{ margin: 0 }}>{result.senderName}</dd></>)}
          {result.receiverName && (<><dt style={{ fontWeight: 600 }}>To</dt><dd style={{ margin: 0 }}>{result.receiverName}</dd></>)}
          {result.date && (<><dt style={{ fontWeight: 600 }}>Date</dt><dd style={{ margin: 0 }}>{result.date}</dd></>)}
          {result.reference && (<><dt style={{ fontWeight: 600 }}>Reference</dt><dd style={{ margin: 0 }}><code>{result.reference}</code></dd></>)}
          {result.sourceUrl && (<><dt style={{ fontWeight: 600 }}>Source</dt><dd style={{ margin: 0 }}><a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Official receipt</a></dd></>)}
        </dl>
      )}
    </section>
  );
}
