"use client";

/**
 * "Help us add <Bank>" box, shown where the BankChecker would sit on the page
 * of a provider that is still in development. Sends a receipt link (or a
 * reference plus phone/account) to POST /api/contribute, which forwards it
 * privately to the maintainers. Nothing is stored on cheki.
 */
import { useState } from "react";

interface Props {
  code: string;
  shortName: string;
  requiresAccount?: boolean;
  requiresPhone?: boolean;
  accountLabel?: string;
  /** Ask for the full share link first (e.g. Zemen, where the bare reference format is unconfirmed). */
  preferLink?: boolean;
  linkExample?: string;
}

const CONTRIBUTING_URL = "https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md#adding-or-fixing-a-bank";

export function ContributeBox({ code, shortName, requiresAccount, requiresPhone, accountLabel, preferLink, linkExample }: Props) {
  const [link, setLink] = useState("");
  const [reference, setReference] = useState("");
  const [second, setSecond] = useState("");
  const [credit, setCredit] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needsSecond = Boolean(requiresAccount || requiresPhone);
  const secondLabel = requiresPhone ? "Payer phone number" : accountLabel || "Receiving account number";
  const hasLink = link.trim().length > 0;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!hasLink && !reference.trim()) {
      setError("Paste the receipt link, or enter the reference.");
      return;
    }
    if (!hasLink && needsSecond && !second.trim()) {
      setError(`Add the ${secondLabel.toLowerCase()}, or paste the full receipt link.`);
      return;
    }
    if (!consent) {
      setError("Tick the box to confirm the receipt is yours to share.");
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch("/api/contribute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank: code,
          ...(hasLink ? { link: link.trim() } : { reference: reference.trim() }),
          phoneOrAccount: second.trim() || undefined,
          credit: credit.trim() || undefined,
          consent,
          website,
        }),
      });
      const data: { success: boolean; error?: string; message?: string } = await resp.json();
      if (!data.success) {
        setError(data.error || "Something went wrong. Nothing was saved.");
      } else {
        setDone(data.message || "Thanks. Your receipt was sent privately to the maintainers.");
        setLink("");
        setReference("");
        setSecond("");
      }
    } catch {
      setError("Network error. Nothing was saved. Try again.");
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
  const hint: React.CSSProperties = { fontSize: "12px", color: "var(--ink-3)", marginTop: "6px", lineHeight: 1.5 };

  return (
    <section
      id="contribute"
      aria-labelledby="contribute-title"
      style={{
        padding: "24px", borderRadius: "12px", background: "var(--surface)",
        border: "1px solid var(--border)", marginBottom: "40px", maxWidth: "680px",
      }}
    >
      <h2 id="contribute-title" style={{ fontSize: "20px", fontWeight: 800, letterSpacing: "-0.01em", marginBottom: "8px" }}>
        Help us add {shortName}
      </h2>
      <p style={{ color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.6, marginBottom: "16px" }}>
        {shortName} checks are not live yet. One real receipt link is enough for us to build and test the parser.
      </p>
      <p style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--green-light)", color: "var(--ink)", fontSize: "14px", lineHeight: 1.6, marginBottom: "18px" }}>
        <strong>Your link stays private.</strong> It goes straight to the maintainers, is used only to build the {shortName} parser, and is deleted afterwards. It is never published or stored on cheki. Please do not paste receipt links in public GitHub issues.
      </p>

      {done ? (
        <p role="status" style={{ padding: "12px 14px", borderRadius: "8px", background: "var(--green-light)", color: "var(--green-dark)", fontSize: "14px", fontWeight: 600 }}>
          {done} {credit.trim() ? `We will credit ${credit.trim()} when ${shortName} goes live.` : ""}
        </p>
      ) : (
        <form onSubmit={onSubmit} noValidate>
          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="contrib-link" style={label}>
              {shortName} receipt share link{preferLink ? " (preferred)" : ""}
            </label>
            <input
              id="contrib-link"
              name="link"
              type="url"
              style={field}
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder={linkExample ? `e.g. ${linkExample}` : "https://..."}
              autoComplete="off"
              spellCheck={false}
            />
            {preferLink && (
              <p style={hint}>Paste the whole link from the share button. A bare reference may not be enough for {shortName} yet.</p>
            )}
          </div>

          {!hasLink && (
            <>
              <p style={{ fontSize: "13px", color: "var(--ink-3)", margin: "0 0 14px" }}>No link? Enter the reference instead.</p>
              <div style={{ marginBottom: "14px" }}>
                <label htmlFor="contrib-ref" style={label}>Transaction reference</label>
                <input
                  id="contrib-ref"
                  name="reference"
                  style={field}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <div style={{ marginBottom: "14px" }}>
                <label htmlFor="contrib-second" style={label}>
                  {needsSecond ? secondLabel : "Phone or account number (optional)"}
                </label>
                <input
                  id="contrib-second"
                  name="phoneOrAccount"
                  style={field}
                  value={second}
                  onChange={(e) => setSecond(e.target.value)}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={requiresPhone ? "2519XXXXXXXX" : ""}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: "14px" }}>
            <label htmlFor="contrib-credit" style={label}>Your name or handle for credit (optional)</label>
            <input
              id="contrib-credit"
              name="credit"
              style={field}
              value={credit}
              onChange={(e) => setCredit(e.target.value)}
              maxLength={60}
              autoComplete="nickname"
              placeholder="e.g. @yourhandle"
            />
            <p style={hint}>We credit contributors by name when the bank goes live. Leave it blank to stay anonymous.</p>
          </div>

          {/* Honeypot for bots. Hidden from people and screen readers. */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: "1px", height: "1px", overflow: "hidden" }}>
            <label htmlFor="contrib-website">Website</label>
            <input id="contrib-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>

          <label htmlFor="contrib-consent" style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5, marginBottom: "16px", cursor: "pointer" }}>
            <input
              id="contrib-consent"
              name="consent"
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              required
              style={{ marginTop: "3px", width: "16px", height: "16px", flexShrink: 0 }}
            />
            <span>This receipt is mine to share: I sent or received this payment, and I agree to send it to the cheki maintainers to build the parser.</span>
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: "13px 24px", borderRadius: "8px", border: "none",
              background: "var(--green-cta)", color: "var(--green-cta-fg)",
              fontSize: "15px", fontWeight: 600, cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Sending..." : "Send privately"}
          </button>
          <p style={hint}>
            Rather not share it? <a href={CONTRIBUTING_URL} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green-dark)" }}>Test your receipt on your own machine</a> with <code>npm run probe</code> and send us only the redacted output.
          </p>
        </form>
      )}

      {error && (
        <p role="alert" style={{ marginTop: "16px", padding: "12px 14px", borderRadius: "8px", background: "var(--amber-light)", color: "var(--amber-text)", fontSize: "14px" }}>
          {error}
        </p>
      )}
    </section>
  );
}
