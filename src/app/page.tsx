"use client";

import { useState, useCallback } from "react";
import { banks, type BankCode, type VerifyResult } from "@/lib/banks";

export default function Home() {
  const [bank, setBank] = useState<BankCode>("cbe");
  const [reference, setReference] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedBank = banks.find((b) => b.code === bank)!;
  const needsAccount = "requiresAccount" in selectedBank && selectedBank.requiresAccount;
  const isComingSoon = "comingSoon" in selectedBank && selectedBank.comingSoon;

  const handleVerify = useCallback(async () => {
    if (!reference.trim()) return;
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
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, [bank, reference, accountNumber]);

  const inputStyle: React.CSSProperties = {
    background: "var(--card)",
    border: "2px solid var(--border)",
    borderRadius: 0,
    padding: "12px 16px",
    color: "var(--fg)",
    fontSize: "16px",
    width: "100%",
    fontFamily: "Georgia, serif",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "13px",
    color: "var(--muted)",
    marginBottom: "6px",
    display: "block",
    textTransform: "uppercase",
    letterSpacing: "1px",
  };

  return (
    <main style={{ minHeight: "100vh", maxWidth: "640px", margin: "0 auto", padding: "24px 20px" }}>
      {/* Logo */}
      <header style={{ textAlign: "center", marginBottom: "40px", marginTop: "20px" }}>
        <h1
          style={{
            fontSize: "42px",
            fontWeight: "bold",
            color: "var(--accent)",
            letterSpacing: "2px",
            marginBottom: "8px",
          }}
        >
          cheki
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "15px" }}>
          free ethiopian receipt verification. no signup. no api key. no scam.
        </p>
      </header>

      {/* Verification Form */}
      <section style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={labelStyle}>Bank / Wallet</label>
            <select
              value={bank}
              onChange={(e) => {
                setBank(e.target.value as BankCode);
                setResult(null);
                setError(null);
              }}
              style={inputStyle}
            >
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                  {"comingSoon" in b && b.comingSoon ? " (coming soon)" : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle}>Transaction Reference Number</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
              placeholder="e.g. FT26140P01YB"
              style={inputStyle}
              autoCapitalize="characters"
              spellCheck={false}
            />
          </div>

          {needsAccount && (
            <div>
              <label style={labelStyle}>
                {"accountLabel" in selectedBank ? selectedBank.accountLabel : "Account Number"}
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !loading && handleVerify()}
                placeholder="e.g. 1000560536171"
                style={inputStyle}
                spellCheck={false}
              />
              <p style={{ fontSize: "12px", color: "var(--muted)", marginTop: "6px" }}>
                We only use the last {"accountDigits" in selectedBank ? selectedBank.accountDigits : 8} digits to build the verification URL.
              </p>
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || isComingSoon || !reference.trim()}
            style={{
              background: loading || isComingSoon || !reference.trim() ? "var(--card)" : "var(--accent)",
              border: "2px solid var(--border)",
              borderRadius: 0,
              padding: "14px 24px",
              color: loading || isComingSoon || !reference.trim() ? "var(--muted)" : "#030303",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: loading || isComingSoon || !reference.trim() ? "not-allowed" : "pointer",
              fontFamily: "Georgia, serif",
              textTransform: "uppercase",
              letterSpacing: "1px",
              transition: "background 0.15s",
            }}
          >
            {loading ? "Verifying..." : isComingSoon ? "Coming Soon" : "Verify Receipt"}
          </button>
        </div>
      </section>

      {/* Error */}
      {error && (
        <section
          style={{
            border: "2px solid var(--danger)",
            padding: "16px 20px",
            marginBottom: "24px",
            background: "var(--card)",
          }}
        >
          <p style={{ color: "var(--danger)", fontSize: "15px" }}>{error}</p>
        </section>
      )}

      {/* Result */}
      {result && result.success && (
        <ResultCard result={result} />
      )}

      {/* The Scam */}
      <section style={{ marginTop: "60px", borderTop: "2px solid var(--border)", paddingTop: "32px" }}>
        <h2
          style={{
            fontSize: "22px",
            color: "var(--accent)",
            marginBottom: "16px",
          }}
        >
          the scam
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ color: "var(--fg)", fontSize: "15px", lineHeight: 1.6 }}>
            <strong style={{ color: "var(--accent)" }}>check.et</strong> and{" "}
            <strong style={{ color: "var(--accent)" }}>verify.et</strong> charge you money to
            verify receipts. They sell 200 credits for free, then make you pay.
          </p>
          <p style={{ color: "var(--fg)", fontSize: "15px", lineHeight: 1.6 }}>
            Here is what they do not tell you: the banks already publish these receipts on
            public URLs. Anyone with the transaction reference can access them. No API key needed.
          </p>
          <p style={{ color: "var(--fg)", fontSize: "15px", lineHeight: 1.6 }}>
            They are reselling free data. We are giving it away.
          </p>

          <div
            style={{
              border: "2px solid var(--border)",
              padding: "16px 20px",
              marginTop: "8px",
              background: "var(--card)",
            }}
          >
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>
              what they charge vs what it costs
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <p style={{ fontSize: "15px" }}>
                <span style={{ color: "var(--danger)" }}>check.et</span>: 200 free, then paid plans
              </p>
              <p style={{ fontSize: "15px" }}>
                <span style={{ color: "var(--danger)" }}>verify.et</span>: 200 free/month, then $20-40/month
              </p>
              <p style={{ fontSize: "15px" }}>
                <span style={{ color: "var(--accent)" }}>cheki</span>: free. forever. $0.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section style={{ marginTop: "40px" }}>
        <h2 style={{ fontSize: "22px", color: "var(--accent)", marginBottom: "16px" }}>
          how it works
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <p style={{ color: "var(--fg)", fontSize: "15px", lineHeight: 1.6 }}>
            Each bank publishes receipt verification at a public URL. We just fetch and parse
            the response. Nothing more.
          </p>
          <div
            style={{
              border: "2px solid var(--border)",
              padding: "16px 20px",
              background: "var(--card)",
              fontFamily: "monospace",
              fontSize: "13px",
              color: "var(--muted)",
              overflow: "auto",
            }}
          >
            <p style={{ color: "var(--accent)", marginBottom: "6px" }}>CBE</p>
            <p>apps.cbe.com.et:100/?id=REFERENCE+LAST_8_DIGITS</p>
            <p style={{ color: "var(--accent)", marginTop: "12px", marginBottom: "6px" }}>Telebirr</p>
            <p>transactioninfo.ethiotelecom.et/receipt/REFERENCE</p>
            <p style={{ color: "var(--accent)", marginTop: "12px", marginBottom: "6px" }}>Bank of Abyssinia</p>
            <p>cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=TRX</p>
            <p style={{ color: "var(--accent)", marginTop: "12px", marginBottom: "6px" }}>M-Pesa</p>
            <p>m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=REF</p>
          </div>
          <p style={{ color: "var(--muted)", fontSize: "14px", lineHeight: 1.5 }}>
            These are not private APIs. They are public web endpoints designed by the banks
            for receipt sharing. The paid services hit the exact same URLs.
          </p>
        </div>
      </section>

      {/* Open Source */}
      <section style={{ marginTop: "40px" }}>
        <a
          href="https://github.com/1RB/ethio-receipt-verify"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-block",
            border: "2px solid var(--border)",
            padding: "12px 24px",
            color: "var(--accent)",
            textDecoration: "none",
            fontSize: "15px",
            fontFamily: "Georgia, serif",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          open source on github
        </a>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: "60px", paddingBottom: "40px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>
          cheki is not affiliated with any ethiopian bank or wallet.
        </p>
        <p style={{ color: "var(--muted)", fontSize: "13px", marginTop: "4px" }}>
          This tool only accesses public receipt endpoints. MIT licensed.
        </p>
      </footer>
    </main>
  );
}

function ResultCard({ result }: { result: VerifyResult }) {
  if (!result.verified) return null;

  const rows: { label: string; value: string | undefined }[] = [
    { label: "Bank", value: result.bank },
    { label: "Reference", value: result.reference },
    { label: "Status", value: "Verified" },
    { label: "Amount", value: result.amount ? `${result.amount.toLocaleString()} ${result.currency || "ETB"}` : undefined },
    { label: "Sender", value: result.senderName },
    { label: "Sender Account", value: result.senderAccount },
    { label: "Receiver", value: result.receiverName },
    { label: "Receiver Account", value: result.receiverAccount },
    { label: "Date", value: result.date },
    { label: "Branch", value: result.branch },
    { label: "Reason", value: result.reason },
  ];

  const visibleRows = rows.filter((r) => r.value);

  return (
    <section
      style={{
        border: "2px solid var(--border)",
        padding: "24px",
        marginBottom: "24px",
        background: "var(--card)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            width: "12px",
            height: "12px",
            background: "var(--accent)",
            borderRadius: 0,
          }}
        />
        <h2 style={{ fontSize: "20px", color: "var(--accent)" }}>receipt verified</h2>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
        {visibleRows.map((row, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              padding: "10px 0",
              borderBottom: i < visibleRows.length - 1 ? "1px solid #1a1a1a" : "none",
              gap: "16px",
            }}
          >
            <span
              style={{
                color: "var(--muted)",
                fontSize: "13px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                flexShrink: 0,
                paddingTop: "2px",
              }}
            >
              {row.label}
            </span>
            <span
              style={{
                color: "var(--fg)",
                fontSize: "15px",
                textAlign: "right",
                wordBreak: "break-word",
              }}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      {result.sourceUrl && (
        <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #1a1a1a" }}>
          <p style={{ fontSize: "12px", color: "var(--muted)", marginBottom: "4px" }}>
            Source (public bank endpoint):
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "var(--accent)",
              fontFamily: "monospace",
              wordBreak: "break-all",
            }}
          >
            {result.sourceUrl}
          </p>
        </div>
      )}
    </section>
  );
}
