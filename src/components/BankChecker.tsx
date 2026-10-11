"use client";

/**
 * Inline receipt checker for a single provider, rendered at the top of each
 * /banks/[code] page. The form markup is server-rendered (client components
 * still SSR their initial HTML), so search engines and no-JS visitors see a
 * real tool on the landing page instead of a link to one.
 *
 * Deliberately small: reference + (account | phone) -> POST /api/verify.
 * Photo/QR/batch/fallback flows stay on the homepage checker, linked below.
 *
 * Format-aware: the field leads with the bank's current format (the first
 * supported entry of its manifest `formats`). Older formats sit in a collapsed "Older receipt?" note;
 * typing an older reference (a CBE FT reference) opens it and asks for the
 * field that format needs.
 */
import { useState } from "react";
import Link from "next/link";
import { verificationState, type VerifyResult } from "@/lib/banks";
import { readVerifyResponse } from "@/lib/verify-response";
import type { ReceiptFormat } from "@/lib/core/types";
import { formatAccountDigits, formatNeeds, matchesFormat, primaryFormat, secondaryFormats, supportedFormats } from "@/lib/manifest/formats";

interface Props {
  code: string;
  shortName: string;
  referenceExample: string;
  requiresAccount: boolean;
  accountLabel?: string;
  accountDigits?: number;
  requiresPhone?: boolean;
  /** Manifest formats, current first. */
  formats?: ReceiptFormat[];
}

export function BankChecker({
  code,
  shortName,
  referenceExample,
  requiresAccount,
  accountLabel,
  accountDigits,
  requiresPhone,
  formats = [],
}: Props) {
  const [reference, setReference] = useState("");
  const [extra, setExtra] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bankFormats = { formats };
  const primary = primaryFormat(bankFormats);
  // Older formats only: a newer format cheki cannot read yet is documented on /endpoints, not offered here.
  const older = secondaryFormats(bankFormats).filter((f) => f.status !== "current");
  const trimmed = reference.trim();
  // A full receipt link already identifies the receipt (account suffix or
  // token included), so the second field is only required for bare references.
  const isLink = /^https?:\/\//i.test(trimmed);
  // The format this input belongs to: the first supported one whose pattern
  // matches, else the primary (current) one.
  const active =
    (trimmed && !isLink ? supportedFormats(bankFormats).find((f) => matchesFormat(f, trimmed)) : undefined) ?? primary;
  const activeIsOlder = Boolean(active && primary && active !== primary);
  const [olderOpen, setOlderOpen] = useState(false);
  const showOlder = olderOpen || activeIsOlder;

  const wantsAccount = active ? formatNeeds(active, "account") : requiresAccount;
  const wantsPhone = active ? formatNeeds(active, "phone") : Boolean(requiresPhone);
  const needsExtra = wantsAccount || wantsPhone;
  const digits = formatAccountDigits(active) ?? accountDigits;
  const extraRequired = Boolean(needsExtra) && !isLink;
  const extraLabel = wantsPhone
    ? "Payer phone number"
    : activeIsOlder
      ? `Receiving account (last ${digits ?? 8} digits)`
      : accountLabel || `Receiving account (last ${digits ?? 8} digits)`;
  const extraPlaceholder = wantsPhone ? "2519XXXXXXXX" : `Last ${digits ?? 8} digits`;
  const mainLabel = primary?.inputs[0]?.label
    ? `${shortName} ${primary.inputs[0].label}`
    : `${shortName} transaction reference or receipt link`;
  const mainExample = primary?.inputs[0]?.example || referenceExample;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reference.trim()) return;
    if (extraRequired) {
      const typed = extra.replace(/\D/g, "");
      if (wantsPhone && !/^(251|0)?9\d{8}$/.test(typed)) {
        setResult(null);
        setError(`Enter the payer's phone number (2519XXXXXXXX). ${shortName} needs it to find the receipt.`);
        return;
      }
      if (!wantsPhone && typed.length < (digits ?? 5)) {
        setResult(null);
        setError(`Enter at least the last ${digits ?? 5} digits of the receiving account. ${shortName} needs them to find the receipt.`);
        return;
      }
    }
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
          ...(wantsPhone
            ? { phoneNumber: extra.trim() || undefined }
            : wantsAccount
              ? { accountNumber: extra.trim() || undefined }
              : {}),
        }),
      });
      // 429 (per-IP limit), 413 and non-JSON answers come back as
      // success: false with a readable message.
      const data: VerifyResult = await readVerifyResponse(resp);
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
  const amberBox: React.CSSProperties = {
    marginTop: "16px", padding: "12px 14px", borderRadius: "8px",
    background: "var(--amber-light)", color: "var(--amber-text)", fontSize: "14px",
  };
  const state = verificationState(result);
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
          <label htmlFor="cheki-ref" style={label}>{mainLabel}</label>
          <input
            id="cheki-ref"
            name="reference"
            style={field}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder={mainExample ? `e.g. ${mainExample}` : "Transaction reference"}
            autoComplete="off"
            spellCheck={false}
            required
          />
        </div>
        {needsExtra && (
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="cheki-extra" style={label}>
              {extraLabel}{!extraRequired && isLink ? " (optional with a receipt link)" : ""}
            </label>
            <input
              id="cheki-extra"
              name={wantsPhone ? "phone" : "account"}
              style={field}
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder={extraPlaceholder}
              inputMode="numeric"
              autoComplete="off"
              required={extraRequired}
            />
          </div>
        )}
        {older.length > 0 && (
          <details
            open={showOlder}
            onToggle={(e) => setOlderOpen((e.currentTarget as HTMLDetailsElement).open)}
            style={{ marginBottom: "14px", fontSize: "13px", color: "var(--ink-2)" }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>Older receipt?</summary>
            <ul style={{ margin: "8px 0 0", paddingLeft: "18px", lineHeight: 1.6 }}>
              {older.map((f) => (
                <li key={f.id}>
                  {f.status === "deprecated"
                    ? `Old ${f.label}s still work: paste the link and cheki checks the receipt on ${shortName}'s current receipt page.`
                    : f.parser
                      ? `${f.label}: type ${f.inputs[0]?.example ? `it (e.g. ${f.inputs[0].example})` : "it"} in the field above${formatNeeds(f, "account") ? " and add the account digits" : ""}. This uses ${shortName}'s older receipt service, which may not answer.`
                      : `${f.label}: not supported yet.`}
                </li>
              ))}
            </ul>
          </details>
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
          <Link href="/#verify" prefetch={false} style={{ color: "var(--green-dark)" }}>Scan a QR code or photo instead</Link>
        </p>
      </form>

      {error && (
        <p role="alert" style={{ marginTop: "16px", padding: "12px 14px", borderRadius: "8px", background: "var(--amber-light)", color: "var(--amber-text)", fontSize: "14px" }}>
          {error}
          {result?.fallbackUrl && /^https:\/\//i.test(result.fallbackUrl) && (
            <> {" "}<a href={result.fallbackUrl} target="_blank" rel="noopener noreferrer">Open the official receipt</a></>
          )}
        </p>
      )}

      {/* Only verificationState() === "verified" is green. decodedOnly and
          parsed are amber; anything else that came back as success is still
          "not verified". */}
      {state === "decodedOnly" && (
        <p role="alert" style={amberBox}>
          <strong>Not confirmed with {shortName}.</strong> The details were decoded from the QR code, but {shortName}&apos;s own record could not be reached. Do not release goods on this receipt yet.
        </p>
      )}

      {state === "parsed" && (
        <p role="alert" style={amberBox}>
          <strong>Not checked with {shortName}.</strong> These details were read from text you supplied, not from {shortName}&apos;s record.
        </p>
      )}

      {result?.success && state === "none" && (
        <p role="alert" style={amberBox}>
          <strong>Not verified.</strong> {shortName} returned a response, but it did not confirm this receipt. Do not release goods on this receipt yet.
        </p>
      )}

      {result && state !== "none" && (
        <dl
          aria-live="polite"
          style={{
            marginTop: "16px", padding: "16px", borderRadius: "8px",
            background: state === "verified" ? "var(--green-light)" : "var(--amber-light)",
            display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: "14px",
          }}
        >
          <dt style={{ fontWeight: 600 }}>Status</dt>
          <dd style={{ margin: 0, color: state === "verified" ? "var(--green-dark)" : "var(--amber-text)", fontWeight: 700 }}>
            {state === "verified"
              ? `Verified: found in ${shortName}'s records`
              : state === "decodedOnly"
                ? "Decoded from QR, not confirmed with the bank"
                : "Parsed from your text, not checked"}
          </dd>
          {result.amount != null && (<><dt style={{ fontWeight: 600 }}>Amount</dt><dd style={{ margin: 0 }}>{result.amount.toLocaleString()} {result.currency || "ETB"}</dd></>)}
          {result.senderName && (<><dt style={{ fontWeight: 600 }}>From</dt><dd style={{ margin: 0 }}>{result.senderName}</dd></>)}
          {result.receiverName && (<><dt style={{ fontWeight: 600 }}>To</dt><dd style={{ margin: 0 }}>{result.receiverName}</dd></>)}
          {result.date && (<><dt style={{ fontWeight: 600 }}>Date</dt><dd style={{ margin: 0 }}>{result.date}</dd></>)}
          {result.reference && (<><dt style={{ fontWeight: 600 }}>Reference</dt><dd style={{ margin: 0 }}><code>{result.reference}</code></dd></>)}
          {state === "verified" && result.sourceUrl && /^https:\/\//i.test(result.sourceUrl) && (<><dt style={{ fontWeight: 600 }}>Source</dt><dd style={{ margin: 0 }}><a href={result.sourceUrl} target="_blank" rel="noopener noreferrer">Official receipt</a></dd></>)}
        </dl>
      )}
    </section>
  );
}
