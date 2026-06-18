"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { banks, detectBank, type BankCode, type VerifyResult } from "@/lib/banks";
import { Nav, Footer } from "@/components/Chrome";

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
  const needsAccount = selectedBank.requiresAccount;
  const needsPhone = selectedBank.requiresPhone;
  const isDisabled = selectedBank.status === "soon";
  const isGeoBlocked = selectedBank.geoBlocked;

  useEffect(() => {
    try {
      const h = localStorage.getItem("cheki_history");
      if (h) setHistory(JSON.parse(h).slice(0, 5));
    } catch {}
  }, []);

  useEffect(() => {
    if (!reference) return;
    const detected = detectBank(reference);
    if (detected && detected !== bank) setBank(detected as BankCode);
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
        body: JSON.stringify({ bank, reference: reference.trim(), accountNumber: accountNumber.trim() || undefined }),
      });
      const data: VerifyResult = await resp.json();
      if (!data.success) {
        setError(data.error || "Verification failed.");
        setResult(data);
      } else {
        setResult(data);
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

  useEffect(() => {
    if (result && result.success && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [result]);

  const copyResult = () => {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const liveBanks = banks.filter((b) => b.status === "live");
  const soonBanks = banks.filter((b) => b.status === "soon");

  return (
    <>
      <Nav />
      <main>
        {/* Hero + Verify Form */}
        <section className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
          <div className="grid-2" style={{ alignItems: "start", gap: "48px" }}>
            {/* Left: Hero copy */}
            <div>
              <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "12px" }}>
                Free and open source
              </p>
              <h1 style={{
                fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 800, letterSpacing: "-0.03em",
                lineHeight: 1.05, color: "var(--ink)", marginBottom: "16px",
              }}>
                Verify any Ethiopian receipt.
                <br />
                <span style={{ color: "var(--green)" }}>Free. Forever.</span>
              </h1>
              <p style={{ color: "var(--ink-2)", fontSize: "18px", lineHeight: 1.5, maxWidth: "440px", marginBottom: "24px" }}>
                No signup. No API key. No scam. The banks publish receipts on public URLs. We just parse them.
              </p>
              <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", marginBottom: "20px" }}>
                {[
                  { label: "Banks supported", value: `${banks.length}` },
                  { label: "Cost", value: "0 ETB" },
                  { label: "API key required", value: "No" },
                ].map((s) => (
                  <div key={s.label}>
                    <p style={{ fontSize: "24px", fontWeight: 800, color: "var(--ink)" }}>{s.value}</p>
                    <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>{s.label}</p>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a href="/docs" style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 500, background: "var(--surface)" }}>API Docs</a>
                <a href="/guides" style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 500, background: "var(--surface)" }}>Guides</a>
                <a href="/compare" style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 500, background: "var(--surface)" }}>vs check.et</a>
              </div>
            </div>

            {/* Right: Verify form */}
            <div style={{
              background: "var(--surface)", borderRadius: "12px", padding: "24px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px var(--border)",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>Bank</label>
                  <select
                    value={bank}
                    onChange={(e) => { setBank(e.target.value as BankCode); setResult(null); setError(null); }}
                    style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", cursor: "pointer" }}
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
                    padding: "12px 16px", borderRadius: "8px", background: "var(--amber-light)", border: "1px solid #fde68a",
                    display: "flex", gap: "10px", alignItems: "flex-start",
                  }}>
                    <span style={{ fontSize: "16px", flexShrink: 0 }}>{"⚠"}</span>
                    <p style={{ fontSize: "13px", color: "#92400e", lineHeight: 1.5 }}>
                      This bank blocks requests from outside Ethiopia. <a href="https://github.com/1RB/cheki#self-hosting" target="_blank" rel="noopener" style={{ color: "#92400e", fontWeight: 600, textDecoration: "underline" }}>Self-host with Docker</a> or use the <a href="https://github.com/1RB/cheki/tree/main/python" target="_blank" rel="noopener" style={{ color: "#92400e", fontWeight: 600, textDecoration: "underline" }}>Python library</a> from an Ethiopian network.
                    </p>
                  </div>
                )}

                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>Receipt reference number</label>
                  <input
                    type="text" value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
                    placeholder="e.g. FT26140P01YB"
                    style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }}
                    spellCheck={false} autoCapitalize="characters"
                  />
                  {reference && detectBank(reference) && (
                    <p style={{ fontSize: "12px", color: "var(--green)", marginTop: "6px", fontWeight: 500 }}>
                      Detected: {banks.find((b) => b.code === detectBank(reference))?.name}
                    </p>
                  )}
                </div>

                {needsAccount && (
                  <div className="fade-in">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>
                      {selectedBank.accountLabel || "Account number"}
                    </label>
                    <input
                      type="text" value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
                      placeholder={`Last ${selectedBank.accountDigits} digits minimum`}
                      style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }}
                      spellCheck={false}
                    />
                  </div>
                )}

                {needsPhone && (
                  <div className="fade-in">
                    <label style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-2)", marginBottom: "6px", display: "block" }}>Payer phone number</label>
                    <input
                      type="text" value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="2519XXXXXXXXX"
                      style={{ width: "100%", padding: "12px 16px", fontSize: "15px", border: "1px solid var(--border)", borderRadius: "8px", background: "var(--surface)", color: "var(--ink)", fontFamily: "var(--mono)" }}
                      spellCheck={false}
                    />
                  </div>
                )}

                <button
                  onClick={handleVerify}
                  disabled={loading || isDisabled || !reference.trim()}
                  style={{
                    width: "100%", padding: "14px 24px", fontSize: "15px", fontWeight: 600,
                    border: "none", borderRadius: "8px",
                    background: loading || isDisabled || !reference.trim() ? "var(--border)" : "var(--green)",
                    color: loading || isDisabled || !reference.trim() ? "var(--ink-3)" : "#fff",
                    cursor: loading || isDisabled || !reference.trim() ? "not-allowed" : "pointer",
                    transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "48px",
                  }}
                >
                  {loading ? (
                    <><span className="spin" style={{ width: "16px", height: "16px", border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block" }} />Verifying...</>
                  ) : isDisabled ? "In Development" : "Verify Receipt"}
                </button>
              </div>

              {history.length > 0 && !result && !loading && (
                <div style={{ marginTop: "16px" }}>
                  <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Recent checks</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {history.map((h, i) => (
                      <button key={i} onClick={() => { setReference(h.ref); setBank(h.bank as BankCode); }} style={{
                        padding: "6px 12px", fontSize: "13px", fontFamily: "var(--mono)", border: "1px solid var(--border)", borderRadius: "20px", background: "var(--surface)", color: "var(--ink-2)", cursor: "pointer",
                      }}>{h.ref}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Result */}
        {result && result.success && (
          <section className="container-narrow" style={{ marginBottom: "40px" }}>
            <div ref={resultRef}>
              <ReceiptCard result={result} copied={copied} onCopy={copyResult} />
            </div>
          </section>
        )}

        {/* Error / Fallback */}
        {error && (
          <section className="container-narrow" style={{ marginBottom: "40px" }}>
            <div className="fade-up" style={{
              padding: "16px 20px", borderRadius: "8px",
              background: result?.fallbackUrl ? "var(--amber-light)" : "var(--red-light)",
              border: `1px solid ${result?.fallbackUrl ? "#fde68a" : "#fecaca"}`,
            }}>
              <p style={{ color: result?.fallbackUrl ? "#92400e" : "var(--red)", fontSize: "14px", fontWeight: 500, marginBottom: result?.fallbackUrl ? "12px" : 0 }}>{error}</p>
              {result?.fallbackUrl && (
                <a href={result.fallbackUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", padding: "8px 16px", borderRadius: "6px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>Open Receipt</a>
              )}
            </div>
          </section>
        )}

        {/* How it works */}
        <section className="container" style={{ paddingTop: "48px", marginTop: "48px" }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "12px" }}>
            The banks publish receipts on public URLs
          </h2>
          <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "600px", marginBottom: "32px", lineHeight: 1.5 }}>
            Every Ethiopian bank and mobile wallet publishes transaction receipts at a publicly accessible URL. No authentication required. cheki fetches these URLs, parses the response, and returns clean JSON. That is all check.et and verify.et do too, except they charge you for it.
          </p>
          <div className="grid-2" style={{ gap: "16px" }}>
            {banks.filter((b) => b.status === "live").map((b) => (
              <div key={b.code} style={{
                padding: "20px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: b.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "13px" }}>
                      {b.shortName.slice(0, 3)}
                    </div>
                    <div>
                      <p style={{ fontSize: "15px", fontWeight: 600 }}>{b.shortName}</p>
                      <p style={{ fontSize: "12px", color: "var(--ink-3)" }}>{b.type === "mobile" ? "Mobile wallet" : "Bank"}</p>
                    </div>
                  </div>
                  <span style={{
                    fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "4px",
                    background: b.geoBlocked ? "var(--amber-light)" : "var(--green-light)",
                    color: b.geoBlocked ? "#92400e" : "var(--green-dark)",
                  }}>{b.geoBlocked ? "Ethiopia only" : "Works globally"}</span>
                </div>
                <p style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--ink-3)", wordBreak: "break-all" }}>{b.endpointFormat}</p>
                <a href={`/banks/${b.code}`} style={{ fontSize: "13px", color: "var(--green-dark)", fontWeight: 600, marginTop: "8px", display: "inline-block" }}>Learn more</a>
              </div>
            ))}
          </div>
        </section>

        {/* The Scam / Comparison */}
        <section className="container" style={{ marginTop: "64px" }}>
          <div style={{
            padding: "40px", borderRadius: "16px", background: "var(--red-light)", border: "1px solid #fecaca",
          }}>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>The paid services</p>
            <h2 style={{ fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 800, color: "var(--red)", marginBottom: "16px", letterSpacing: "-0.02em" }}>
              check.et and verify.et charge you for free data
            </h2>
            <p style={{ color: "#7f1d1d", fontSize: "16px", lineHeight: 1.6, marginBottom: "24px", maxWidth: "640px" }}>
              These services verify receipts by hitting the exact same public bank URLs cheki uses. They resell the response with a markup. You pay for data that is already free. verify.et even blocks AI crawlers in its robots.txt to prevent you from discovering this.
            </p>
            <div className="grid-3" style={{ gap: "16px" }}>
              <div style={{ padding: "20px", borderRadius: "10px", background: "#fff", border: "1px solid #fecaca" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>check.et</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "4px" }}>200 free, then paid</p>
                <p style={{ fontSize: "28px", fontWeight: 800, color: "var(--red)" }}>499<span style={{ fontSize: "14px", fontWeight: 500 }}> ETB/mo</span></p>
                <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>or 4,990 ETB/yr</p>
              </div>
              <div style={{ padding: "20px", borderRadius: "10px", background: "#fff", border: "1px solid #fecaca" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--red)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>verify.et</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "4px" }}>200 free, then paid</p>
                <p style={{ fontSize: "28px", fontWeight: 800, color: "var(--red)" }}>$20<span style={{ fontSize: "14px", fontWeight: 500 }}>+/mo</span></p>
                <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>blocks AI crawlers</p>
              </div>
              <div style={{ padding: "20px", borderRadius: "10px", background: "#fff", border: "1px solid var(--green-light)" }}>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>cheki</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "4px" }}>unlimited, forever</p>
                <p style={{ fontSize: "28px", fontWeight: 800, color: "var(--green)" }}>0<span style={{ fontSize: "14px", fontWeight: 500 }}> ETB</span></p>
                <p style={{ fontSize: "12px", color: "var(--ink-3)", marginTop: "4px" }}>open source, MIT</p>
              </div>
            </div>
            <a href="/compare" style={{ display: "inline-block", marginTop: "20px", padding: "10px 20px", borderRadius: "8px", background: "var(--ink)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>Full comparison</a>
          </div>
        </section>

        {/* Features */}
        <section className="container" style={{ marginTop: "64px" }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "32px" }}>
            Everything you need, nothing you don&apos;t
          </h2>
          <div className="grid-3" style={{ gap: "20px" }}>
            {[
              { icon: "⚡", title: "1-3 second verification", body: "Fetch receipts from bank endpoints in real time. Fast enough for checkout counters." },
              { icon: "🔑", title: "No API key, no signup", body: "Start verifying immediately. No account, no business plan, no credit limit." },
              { icon: "📦", title: "Batch verification", body: "Verify up to 50 receipts in a single API call. Perfect for end-of-day reconciliation." },
              { icon: "🐍", title: "Python library", body: "Install the Python package for server-side verification from Ethiopian networks." },
              { icon: "🐳", title: "Self-host with Docker", body: "Run cheki on your own infrastructure. Bypass geo-blocks with an Ethiopian IP." },
              { icon: "📋", title: "Structured JSON", body: "Every bank returns the same response shape. Write the integration once." },
              { icon: "🔍", title: "Auto-detect bank", body: "Paste a reference and cheki identifies the bank from the format. No manual selection." },
              { icon: "📖", title: "Open source", body: "MIT licensed. Read the code, contribute, fork it. No black box." },
              { icon: "🌐", title: "REST API", body: "Free REST API with documentation. cURL, JavaScript, Python examples included." },
            ].map((f) => (
              <div key={f.title} style={{ padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <span style={{ fontSize: "28px", display: "block", marginBottom: "12px" }}>{f.icon}</span>
                <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>{f.title}</h3>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.5 }}>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Supported Banks */}
        <section className="container" style={{ marginTop: "64px" }}>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "12px" }}>
            {banks.length} banks and wallets supported
          </h2>
          <p style={{ color: "var(--ink-2)", fontSize: "16px", marginBottom: "24px" }}>
            {liveBanks.length} live now, {soonBanks.length} in development. All use public endpoints.
          </p>
          <div className="grid-4" style={{ gap: "12px" }}>
            {banks.map((b) => (
              <a key={b.code} href={`/banks/${b.code}`} style={{
                padding: "16px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)",
                display: "flex", alignItems: "center", gap: "12px", transition: "all 0.15s",
              }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "8px", background: b.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "14px", flexShrink: 0 }}>
                  {b.shortName.slice(0, 3)}
                </div>
                <div>
                  <p style={{ fontSize: "14px", fontWeight: 600 }}>{b.shortName}</p>
                  <p style={{ fontSize: "11px", color: b.status === "live" ? "var(--green)" : "var(--ink-3)" }}>
                    {b.status === "live" ? "Live" : "In development"}
                  </p>
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* OSS Branding */}
        <section className="container" style={{ marginTop: "64px" }}>
          <div style={{
            padding: "40px", borderRadius: "16px", background: "var(--ink)", color: "#fff",
          }}>
            <div className="grid-2" style={{ alignItems: "center", gap: "32px" }}>
              <div>
                <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "8px" }}>Open source</p>
                <h2 style={{ fontSize: "clamp(22px, 4vw, 28px)", fontWeight: 800, marginBottom: "16px", letterSpacing: "-0.02em" }}>
                  Built by the community, for the community
                </h2>
                <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.7)", lineHeight: 1.6, marginBottom: "24px" }}>
                  cheki is MIT licensed and lives on GitHub. No company owns it. No one can shut it down. If a bank changes their endpoint, anyone can submit a fix. If a new bank launches, anyone can add support.
                </p>
                <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>Star on GitHub</a>
                  <a href="https://github.com/1RB/cheki/blob/main/README.md#contributing" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.2)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>Contribute</a>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {[
                  { label: "License", value: "MIT" },
                  { label: "Language", value: "TypeScript + Python" },
                  { label: "Framework", value: "Next.js 16" },
                  { label: "Self-hosting", value: "Docker included" },
                  { label: "SDK", value: "TypeScript + Python" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                    <span style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>{item.label}</span>
                    <span style={{ fontSize: "14px", fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </>
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
      borderRadius: "12px", overflow: "hidden", background: "var(--receipt-bg)", border: "1px solid var(--dotted)",
      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
    }}>
      <div style={{ padding: "20px 24px", borderBottom: "2px dotted var(--dotted)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "var(--green)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)" }}>receipt verified</span>
        </div>
        <button onClick={onCopy} style={{ padding: "6px 14px", fontSize: "12px", fontWeight: 500, border: "1px solid var(--border)", borderRadius: "6px", background: "var(--surface)", color: copied ? "var(--green)" : "var(--ink-2)", cursor: "pointer" }}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
      <div style={{ padding: "8px 24px" }}>
        {visibleRows.map((row, i) => (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "12px 0" }}>
              <span style={{ fontSize: "13px", color: "var(--ink-3)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.03em", flexShrink: 0 }}>{row.label}</span>
              <span style={{ fontSize: "15px", color: "var(--ink)", textAlign: "right", fontFamily: row.mono ? "var(--mono)" : "var(--sans)", fontWeight: row.mono ? 500 : 400, wordBreak: "break-word" }}>{row.value}</span>
            </div>
            {i < visibleRows.length - 1 && <hr className="dotted-line" />}
          </div>
        ))}
      </div>
      {result.sourceUrl && (
        <div style={{ padding: "16px 24px", borderTop: "2px dotted var(--dotted)", background: "rgba(0,0,0,0.02)" }}>
          <p style={{ fontSize: "11px", color: "var(--ink-3)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Source (public bank endpoint)</p>
          <p style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--ink-2)", wordBreak: "break-all" }}>{result.sourceUrl}</p>
        </div>
      )}
    </section>
  );
}
