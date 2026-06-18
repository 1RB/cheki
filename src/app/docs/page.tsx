"use client";

import { useState } from "react";
import { Nav, Footer } from "@/components/Chrome";

export default function DocsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const Code = ({ code, id }: { code: string; id: string }) => (
    <div style={{ position: "relative", marginBottom: "16px" }}>
      <pre style={{
        background: "#1a1a1a", color: "#e0e0e0", padding: "16px 20px",
        borderRadius: "8px", overflow: "auto", fontSize: "13px",
        fontFamily: "var(--mono)", lineHeight: 1.6, margin: 0,
      }}>
        {code}
      </pre>
      <button onClick={() => copy(code, id)} style={{
        position: "absolute", top: "8px", right: "8px",
        padding: "4px 10px", fontSize: "12px",
        background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: "4px", color: copied === id ? "var(--green)" : "#aaa",
        cursor: "pointer",
      }}>
        {copied === id ? "Copied" : "Copy"}
      </button>
    </div>
  );

  const Endpoint = ({ method, path, desc }: { method: string; path: string; desc: string }) => (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px", flexWrap: "wrap" }}>
        <span style={{
          padding: "3px 10px", borderRadius: "4px", fontSize: "12px", fontWeight: 700,
          fontFamily: "var(--mono)",
          background: method === "GET" ? "var(--green-light)" : "#ede9fe",
          color: method === "GET" ? "var(--green-dark)" : "#6d28d9",
        }}>
          {method}
        </span>
        <code style={{ fontSize: "15px", fontFamily: "var(--mono)", color: "var(--ink)", wordBreak: "break-all", minWidth: 0 }}>
          {path}
        </code>
      </div>
      <p style={{ color: "var(--ink-2)", fontSize: "14px", marginBottom: "12px" }}>{desc}</p>
    </div>
  );

  const H2 = ({ children }: { children: React.ReactNode }) => (
    <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--ink)", marginTop: "32px", marginBottom: "12px" }}>
      {children}
    </h2>
  );

  return (
    <>
    <Nav />
    <div style={{ minHeight: "100vh" }}>
      <nav style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "16px 24px", maxWidth: "640px", margin: "0 auto",
      }}>
        <a href="/" style={{ fontWeight: 800, fontSize: "20px", letterSpacing: "-0.02em", color: "var(--ink)", textDecoration: "none" }}>
          cheki
        </a>
        <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ color: "var(--ink-2)", textDecoration: "none", fontSize: "14px", fontWeight: 500 }}>
          GitHub
        </a>
      </nav>

      <main style={{ maxWidth: "640px", margin: "0 auto", padding: "0 24px 80px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--ink)", marginBottom: "8px", marginTop: "32px" }}>
          API Documentation
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "16px", marginBottom: "32px" }}>
          Free REST API. No auth. No rate limit. No scam.
        </p>

        <H2>Base URL</H2>
        <Code code="https://cheki-pi.vercel.app" id="base" />

        <H2>Endpoints</H2>

        <Endpoint method="POST" path="/api/verify" desc="Verify a single receipt." />
        <Code code={`{
  "bank": "cbe",
  "reference": "FT26140P01YB",
  "accountNumber": "1000560536171"
}`} id="verify_req" />
        <Code code={`{
  "success": true,
  "bank": "Commercial Bank of Ethiopia",
  "reference": "FT26140P01YB",
  "verified": true,
  "senderName": "Mr Mohammed Abdulwasi Reshid",
  "senderAccount": "1****1685",
  "receiverName": "SAMI ADIL ZEKARIA",
  "receiverAccount": "1****6171",
  "amount": 20000,
  "currency": "ETB",
  "date": "5/20/2026 7:29:00 PM",
  "branch": "MEKANISA MICHAEL BRANC",
  "sourceUrl": "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171"
}`} id="verify_resp" />

        <Endpoint method="POST" path="/api/verify/batch" desc="Verify up to 50 receipts in parallel." />
        <Code code={`{
  "receipts": [
    { "bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171" },
    { "bank": "telebirr", "reference": "DET8FJGUJ4" }
  ]
}`} id="batch_req" />

        <Endpoint method="GET" path="/api/banks" desc="List all supported banks with metadata." />

        <Endpoint method="GET" path="/api/health" desc="Check if each bank endpoint is reachable. Includes latency." />

        <Endpoint method="GET" path="/api/receipt?bank=cbe&reference=FT...&account=..." desc="Download the original receipt PDF from the bank." />

        <H2>TypeScript SDK</H2>
        <Code code={`import { Cheki } from "cheki";

const cheki = new Cheki("https://cheki-pi.vercel.app");

const result = await cheki.verify("cbe", "FT26140P01YB", {
  accountNumber: "1000560536171"
});

const batch = await cheki.verifyBatch([
  { bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" },
  { bank: "telebirr", reference: "DET8FJGUJ4" }
]);

const { banks } = await cheki.getBanks();
const health = await cheki.getHealth();`} id="sdk" />

        <H2>Python</H2>
        <Code code={`pip install git+https://github.com/1RB/cheki.git#subdirectory=python

from ethio_receipt_verify import verify

result = verify("cbe", "FT26140P01YB", account_number="1000560536171")
print(result.to_dict())`} id="py" />

        <H2>cURL</H2>
        <Code code={`curl -X POST https://cheki-pi.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'`} id="curl" />

        <H2>Errors</H2>
        <Code code={`{
  "success": false,
  "error": "Receipt not found. Check the reference number.",
  "bank": "Commercial Bank of Ethiopia",
  "reference": "INVALID123"
}`} id="error" />

        <div style={{ marginTop: "40px", display: "flex", gap: "12px" }}>
          <a href="/" style={{
            padding: "10px 20px", borderRadius: "8px", border: "1px solid var(--border)",
            color: "var(--ink)", textDecoration: "none", fontSize: "14px", fontWeight: 500,
            background: "var(--surface)",
          }}>Back to cheki</a>
        </div>
      </main>
    </div>
    <Footer />
    </>
  );
}
