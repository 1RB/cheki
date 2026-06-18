"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { banks, detectBank, type BankCode, type VerifyResult } from "@/lib/banks";

export default function Home() {
  const [bank, setBank] = useState<BankCode>("cbe");
  const [reference, setReference] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<{ bank: string; ref: string; date: string }[]>([]);
  const resultRef = useRef<HTMLDivElement>(null);

  const selectedBank = banks.find((b) => b.code === bank)!;
  const needsAccount = "requiresAccount" in selectedBank && selectedBank.requiresAccount;
  const needsPhone = "requiresPhone" in selectedBank && selectedBank.requiresPhone;
  const isDisabled = selectedBank.status === "soon";
  const isGeoBlocked = "geoBlocked" in selectedBank && selectedBank.geoBlocked;

  // load history from localStorage
  useEffect(() => {
    try {
      const h = localStorage.getItem("cheki_history");
      if (h) setHistory(JSON.parse(h).slice(0, 5));
    } catch {}
  }, []);

  // auto-detect bank from reference format
  useEffect(() => {
    if (!reference) return;
    const detected = detectBank(reference);
    if (detected && detected !== bank) {
      setBank(detected as BankCode);
    }
  }, [reference]);

  const handleVerify = useCallback(async () => {
    if (!reference.trim() || isDisabled) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bank,
          reference: reference.trim(),
          accountNumber: accountNumber.trim() || undefined,
        }),
      });
      const data: VerifyResult = await resp.json();
      if (!data.success) {
        setError(data.error || "Verification failed.");
      } else {
        setResult(data);
        // save to history
        const entry = { bank, ref: reference.trim(), date: new Date().toISOString() };
        const newHistory = [entry, ...history.filter((h) => h.ref !== reference.trim())].slice(0, 5);
        setHistory(newHistory);
        try { localStorage.setItem("cheki_history", JSON.stringify(newHistory)); } catch {}
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, [bank, reference, accountNumber, isDisabled, history]);

  // scroll to result when it appears
  useEffect(() => {
    if (result && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* Nav */}
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 24px", maxWidth: "640px", margin: "0 auto",
      }}>
        <span style={{ fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em", color: "var(--ink)" }}>
          cheki
        </span>
        <div style={{ display: "flex", gap: "20px" }}>
          <a href="/docs" style={{ color: "var(--ink-2)", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>API</a>
          <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ color: "var(--ink-2)", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>GitHub</a>
        </div>
      </nav>

      <main style={{ maxWidth: "640px", margin: "0 auto", padding: "0 24px 80px" }}>
        {/* Hero */}
        <section style={{ textAlign: "center", padding: "48px 0 32px" }}>
          <h1 style={{
            fontSize: "clamp(28px, 7vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em",
            lineHeight: 1.1, color: "var(--ink)", marginBottom: "12px",
          }}>
            verify any ethiopian receipt.
            <br />
            <span style={{ color: "var(--green)" }}>free. forever.</span>
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "440px", margin: "0 auto", lineHeight: 1.5 }}>
            No signup. No API key. No scam. The banks publish receipts on public URLs. We just parse them.
          </p>
        </section>

        {/* Form */}
        <section style={{
          background: "var(--surface)", borderRadius: "12px", padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px var(--border)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Bank selector */}
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>
                Bank
              </label>
              <select
                value={bank}
                onChange={(e) => { setBank(e.target.value as BankCode); setResult(null); setError(null); }}
                style={{
                  width: "100%", padding: "12px 16px", fontSize: "15px",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  background: "var(--surface)", color: "var(--ink)",
                  cursor: "pointer", transition: "border-color 0.15s",
                }}
              >
                {banks.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}{b.status === "soon" ? " (in development)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {isGeoBlocked && (
              <div className="fade-in" style={{
                padding: "12px 16px", borderRadius: "8px",
                background: "#fffbeb", border: "1px solid #fde68a",
                display: "flex", gap: "10px", alignItems: "flex-start",
              }}>
                <span style={{ fontSize: "16px", flexShrink: 0 }}>⚠️</span>
                <div>
                  <p style={{ fontSize: "13px", color: "#92400e", lineHeight: 1.5 }}>
                    This bank blocks requests from outside Ethiopia. Verification may fail from our hosted server.
                    <br />
                    <a href="https://github.com/1RB/cheki#self-hosting" target="_blank" rel="noopener" style={{ color: "#92400e", fontWeight: 600, textDecoration: "underline" }}>
                      Self-host with Docker
                    </a>
                    {" "}or use the{" "}
                    <a href="https://github.com/1RB/cheki/tree/main/python" target="_blank" rel="noopener" style={{ color: "#92400e", fontWeight: 600, textDecoration: "underline" }}>
                      Python library
                    </a>
                    {" "}from an Ethiopian network for reliable results.
                  </p>
                </div>
              </div>
            )}

            {/* Reference */}
            <div>
              <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>
                Receipt reference number
              </label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
                placeholder="e.g. FT26140P01YB"
                style={{
                  width: "100%", padding: "12px 16px", fontSize: "15px",
                  border: "1px solid var(--border)", borderRadius: "8px",
                  background: "var(--surface)", color: "var(--ink)",
                  fontFamily: "var(--mono)", transition: "border-color 0.15s",
                }}
                spellCheck={false}
                autoCapitalize="characters"
              />
              {reference && detectBank(reference) && (
                <p style={{ fontSize: "12px", color: "var(--green)", marginTop: "6px", fontWeight: 500 }}>
                  Detected: {banks.find((b) => b.code === detectBank(reference))?.name}
                </p>
              )}
            </div>

            {/* Account (conditional) */}
            {needsAccount && (
              <div className="fade-in">
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>
                  {"accountLabel" in selectedBank ? selectedBank.accountLabel : "Account number"}
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
                  placeholder={"accountDigits" in selectedBank ? `Last ${selectedBank.accountDigits} digits minimum` : "Account number"}
                  style={{
                    width: "100%", padding: "12px 16px", fontSize: "15px",
                    border: "1px solid var(--border)", borderRadius: "8px",
                    background: "var(--surface)", color: "var(--ink)",
                    fontFamily: "var(--mono)",
                  }}
                  spellCheck={false}
                />
              </div>
            )}

            {/* Phone (conditional - CBE Birr) */}
            {needsPhone && (
              <div className="fade-in">
                <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>
                  Payer phone number
                </label>
                <input
                  type="text"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  placeholder="2519XXXXXXXXX"
                  style={{
                    width: "100%", padding: "12px 16px", fontSize: "15px",
                    border: "1px solid var(--border)", borderRadius: "8px",
                    background: "var(--surface)", color: "var(--ink)",
                    fontFamily: "var(--mono)",
                  }}
                  spellCheck={false}
                />
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleVerify}
              disabled={loading || isDisabled || !reference.trim()}
              style={{
                width: "100%", padding: "14px 24px", fontSize: "15px", fontWeight: 600,
                border: "none", borderRadius: "8px",
                background: loading || isDisabled || !reference.trim() ? "var(--border)" : "var(--green)",
                color: loading || isDisabled || !reference.trim() ? "var(--ink-3)" : "#fff",
                cursor: loading || isDisabled || !reference.trim() ? "not-allowed" : "pointer",
                transition: "all 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                minHeight: "48px",
              }}
            >
              {loading ? (
                <>
                  <span className="spin" style={{
                    width: "16px", height: "16px",
                    border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff",
                    borderRadius: "50%", display: "inline-block",
                  }} />
                  Verifying...
                </>
              ) : isDisabled ? (
                "In Development"
              ) : (
                "Verify Receipt"
              )}
            </button>
          </div>
        </section>

        {/* History */}
        {history.length > 0 && !result && !loading && (
          <section style={{ marginTop: "20px" }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px" }}>
              Recent checks
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => { setReference(h.ref); setBank(h.bank as BankCode); }}
                  style={{
                    padding: "6px 12px", fontSize: "13px", fontFamily: "var(--mono)",
                    border: "1px solid var(--border)", borderRadius: "20px",
                    background: "var(--surface)", color: "var(--ink-2)",
                    cursor: "pointer", transition: "all 0.15s",
                  }}
                >
                  {h.ref}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Error */}
        {error && (
          <section className="fade-up" style={{
            marginTop: "20px", padding: "16px 20px", borderRadius: "8px",
            background: result?.fallbackUrl ? "#fffbeb" : "var(--red-light)",
            border: `1px solid ${result?.fallbackUrl ? "#fde68a" : "#fecaca"}`,
          }}>
            <p style={{ color: result?.fallbackUrl ? "#92400e" : "var(--red)", fontSize: "14px", fontWeight: 500, marginBottom: result?.fallbackUrl ? "12px" : 0 }}>
              {error}
            </p>
            {result?.fallbackUrl && (
              <a
                href={result.fallbackUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block", padding: "8px 16px", borderRadius: "6px",
                  background: "var(--green)", color: "#fff",
                  fontSize: "14px", fontWeight: 600, textDecoration: "none",
                }}
              >
                Open Receipt
              </a>
            )}
          </section>
        )}

        {/* Result */}
        {result && result.success && (
          <div ref={resultRef}>
            <ReceiptCard result={result} copied={copied} onCopy={copyResult} />
          </div>
        )}

        {/* The Scam */}
        <section style={{ marginTop: "64px" }}>
          <div style={{
            padding: "32px 24px", borderRadius: "12px",
            background: "var(--red-light)", border: "1px solid #fecaca",
          }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--red)", marginBottom: "16px" }}>
              check.et and verify.et are charging you for free data
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ color: "#7f1d1d", fontSize: "15px", lineHeight: 1.6 }}>
                These services verify receipts by hitting the same public bank URLs we do.
                They resell the response with a markup. You pay for data that is already free.
              </p>

              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px",
                marginTop: "8px",
              }}>
                <div style={{
                  padding: "16px", borderRadius: "8px", background: "#fff",
                  border: "1px solid #fecaca",
                }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                    check.et
                  </p>
                  <p style={{ fontSize: "14px", color: "var(--ink-2)" }}>200 free, then paid</p>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--red)", marginTop: "4px" }}>
                    ?? ETB
                  </p>
                </div>
                <div style={{
                  padding: "16px", borderRadius: "8px", background: "#fff",
                  border: "1px solid var(--green-light)",
                }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>
                    cheki
                  </p>
                  <p style={{ fontSize: "14px", color: "var(--ink-2)" }}>unlimited, forever</p>
                  <p style={{ fontSize: "20px", fontWeight: 700, color: "var(--green)", marginTop: "4px" }}>
                    0 ETB
                  </p>
                </div>
              </div>

              <p style={{ color: "#7f1d1d", fontSize: "13px", lineHeight: 1.5, marginTop: "4px" }}>
                verify.et charges $20-40/month after 200 free verifications. The data comes from the exact same public endpoints cheki uses for free.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section style={{ marginTop: "48px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", marginBottom: "16px" }}>
            how it works
          </h2>
          <p style={{ color: "var(--ink-2)", fontSize: "15px", lineHeight: 1.6, marginBottom: "20px" }}>
            Each bank publishes receipts at a public URL. We fetch that URL, parse the response, and show you the result. That is it. No private APIs, no scraped data, no magic.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {[
              { bank: "CBE", url: "apps.cbe.com.et:100/?id=REF + last 8 digits", status: "works globally" },
              { bank: "BOA", url: "cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=TRX", status: "works globally" },
              { bank: "Telebirr", url: "transactioninfo.ethiotelecom.et/receipt/REF", status: "Ethiopia only" },
              { bank: "M-Pesa", url: "m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=REF", status: "Ethiopia only" },
            ].map((item) => (
              <div key={item.bank} style={{
                padding: "14px 16px", borderRadius: "8px",
                background: "var(--surface-alt)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>
                    {item.bank}
                  </p>
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "4px",
                    background: item.status === "works globally" ? "var(--green-light)" : "#fffbeb",
                    color: item.status === "works globally" ? "var(--green-dark)" : "#92400e",
                  }}>
                    {item.status}
                  </span>
                </div>
                <p style={{ fontSize: "13px", fontFamily: "var(--mono)", color: "var(--ink-3)" }}>
                  {item.url}
                </p>
              </div>
            ))}
          </div>
          <p style={{ color: "var(--ink-3)", fontSize: "13px", lineHeight: 1.5, marginTop: "16px" }}>
            Telebirr and M-Pesa block requests from cloud servers. Self-host cheki on an Ethiopian network or use the Python library for these banks. CBE and BOA work from anywhere.
          </p>
        </section>

        {/* Links */}
        <section style={{ marginTop: "48px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <a href="/docs" style={{
            padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)",
            color: "var(--ink)", textDecoration: "none", fontSize: "14px", fontWeight: 500,
            background: "var(--surface)", transition: "all 0.15s",
          }}>
            API Docs
          </a>
          <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{
            padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)",
            color: "var(--ink)", textDecoration: "none", fontSize: "14px", fontWeight: 500,
            background: "var(--surface)", transition: "all 0.15s",
          }}>
            Source Code
          </a>
          <a href="https://github.com/1RB/cheki/tree/main/python" target="_blank" rel="noopener" style={{
            padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)",
            color: "var(--ink)", textDecoration: "none", fontSize: "14px", fontWeight: 500,
            background: "var(--surface)", transition: "all 0.15s",
          }}>
            Python Library
          </a>
        </section>

        {/* Footer */}
        <footer style={{ marginTop: "48px", paddingTop: "24px", borderTop: "1px solid var(--border)" }}>
          <p style={{ color: "var(--ink-3)", fontSize: "13px", textAlign: "center" }}>
            cheki is not affiliated with any ethiopian bank or wallet. MIT licensed.
          </p>
        </footer>
      </main>
    </div>
  );
}

function ReceiptCard({ result, copied, onCopy }: { result: VerifyResult; copied: boolean; onCopy: () => void }) {
  if (!result.verified) return null;

  const rows: { label: string; value: string | undefined; mono?: boolean }[] = [
    { label: "Bank", value: result.bank },
    { label: "Reference", value: result.reference, mono: true },
    { label: "Status", value: "Verified" },
    { label: "Amount", value: result.amount ? `${result.amount.toLocaleString()} ${result.currency || "ETB"}` : undefined, mono: true },
    { label: "Sender", value: result.senderName },
    { label: "Sender Account", value: result.senderAccount, mono: true },
    { label: "Receiver", value: result.receiverName },
    { label: "Receiver Account", value: result.receiverAccount, mono: true },
    { label: "Date", value: result.date, mono: true },
    { label: "Branch", value: result.branch },
    { label: "Reason", value: result.reason },
  ];

  const visibleRows = rows.filter((r) => r.value);

  return (
    <section className="fade-up" style={{
      marginTop: "24px", borderRadius: "12px", overflow: "hidden",
      background: "var(--receipt-bg)", border: "1px solid var(--dotted)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px", borderBottom: "2px dotted var(--dotted)",
        display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "24px", height: "24px", borderRadius: "50%",
            background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 7l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>
            receipt verified
          </span>
        </div>
        <button
          onClick={onCopy}
          style={{
            padding: "6px 14px", fontSize: "12px", fontWeight: 500,
            border: "1px solid var(--border)", borderRadius: "6px",
            background: "var(--surface)", color: copied ? "var(--green)" : "var(--ink-2)",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>

      {/* Receipt body */}
      <div style={{ padding: "8px 24px" }}>
        {visibleRows.map((row, i) => (
          <div key={i}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              padding: "12px 0",
            }}>
              <span style={{
                fontSize: "13px", color: "var(--ink-3)", fontWeight: 500,
                textTransform: "uppercase", letterSpacing: "0.03em", flexShrink: 0,
              }}>
                {row.label}
              </span>
              <span style={{
                fontSize: "15px", color: "var(--ink)", textAlign: "right",
                fontFamily: row.mono ? "var(--mono)" : "var(--sans)",
                fontWeight: row.mono ? 500 : 400, wordBreak: "break-word",
              }}>
                {row.value}
              </span>
            </div>
            {i < visibleRows.length - 1 && <hr className="dotted-line" />}
          </div>
        ))}
      </div>

      {/* Source URL */}
      {result.sourceUrl && (
        <div style={{
          padding: "16px 24px", borderTop: "2px dotted var(--dotted)",
          background: "rgba(0,0,0,0.02)",
        }}>
          <p style={{ fontSize: "11px", color: "var(--ink-3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Source (public bank endpoint)
          </p>
          <p style={{
            fontSize: "12px", fontFamily: "var(--mono)", color: "var(--ink-2)",
            wordBreak: "break-all",
          }}>
            {result.sourceUrl}
          </p>
        </div>
      )}
    </section>
  );
}
