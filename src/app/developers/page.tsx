"use client";

import { useState } from "react";
import { Nav, Footer } from "@/components/Chrome";
import { Icon, ArrowRight01Icon } from "@/components/Icon";

const codeExamples: Record<string, string> = {
  cURL: `curl -X POST https://cheki-pi.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "bank": "cbe",
    "reference": "FT26140P01YB",
    "accountNumber": "1000560536171"
  }'`,
  JavaScript: `import { Cheki } from "cheki";

const cheki = new Cheki("https://cheki-pi.vercel.app");
const result = await cheki.verify("cbe", "FT26140P01YB", {
  accountNumber: "1000560536171"
});
console.log(result.amount, result.senderName);`,
  Python: `from ethio_receipt_verify import verify

result = verify("cbe", "FT26140P01YB",
  account_number="1000560536171")
print(result.to_dict())`,
};

const sdkCode: Record<string, string> = {
  TypeScript: `npm install cheki

import { Cheki } from "cheki";
const cheki = new Cheki();
const result = await cheki.verify("cbe", "FT...", {
  accountNumber: "1000560536171"
});`,
  Python: `pip install git+https://github.com/1RB/cheki.git#subdirectory=python

from ethio_receipt_verify import verify
result = verify("cbe", "FT...",
  account_number="1000560536171")`,
  CLI: `npx cheki verify cbe FT26140P01YB -a 1000560536171
npx cheki info
npx cheki health`,
};

export default function DevelopersPage() {
  const [activeLang, setActiveLang] = useState("cURL");
  const [activeSdk, setActiveSdk] = useState("TypeScript");

  const endpoints = [
    { method: "POST", path: "/api/verify", desc: "Verify a single receipt. Send bank code, reference, and (for CBE/BOA) account number." },
    { method: "POST", path: "/api/verify/batch", desc: "Verify up to 50 receipts at once. Send an array of receipt objects." },
    { method: "GET", path: "/api/banks", desc: "List all supported banks and their verification status." },
    { method: "GET", path: "/api/health", desc: "Check API health and per-bank endpoint latency." },
    { method: "GET", path: "/api/receipt", desc: "Download the raw receipt file (PDF/HTML) from the bank endpoint." },
  ];

  return (
    <>
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "16px" }}>
          Verify any Ethiopian payment with one POST
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "600px", marginBottom: "32px" }}>
          No API key. No signup. No rate limit. The cheki API is free and open source. Just POST to /api/verify.
        </p>

        {/* Code examples with interactive tabs */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", gap: "0", marginBottom: "0", overflowX: "auto" }}>
            {Object.keys(codeExamples).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                style={{
                  padding: "8px 18px", fontSize: "13px", fontWeight: 600, borderRadius: "8px 8px 0 0",
                  background: activeLang === lang ? "var(--code-bg)" : "var(--surface-alt)",
                  color: activeLang === lang ? "#fff" : "var(--ink-3)",
                  border: "1px solid var(--border)", borderBottom: activeLang === lang ? "none" : "1px solid var(--border)",
                  cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >{lang}</button>
            ))}
          </div>
          <pre style={{
            background: "var(--code-bg)", color: "var(--code-text)", padding: "20px 24px", borderRadius: "0 8px 8px 8px",
            fontSize: "13px", fontFamily: "var(--mono)", lineHeight: 1.6, overflow: "auto", margin: 0,
            border: "1px solid var(--border)", borderTop: activeLang === "cURL" ? "1px solid var(--border)" : "none",
          }}>
            <code>{codeExamples[activeLang]}</code>
          </pre>
        </div>

        {/* Response */}
        <div style={{ marginBottom: "40px" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Response</p>
          <pre style={{
            background: "var(--surface-alt)", padding: "20px 24px", borderRadius: "8px",
            fontSize: "13px", fontFamily: "var(--mono)", lineHeight: 1.6, overflow: "auto",
            border: "1px solid var(--border)", margin: 0,
          }}>
            <code>{`{
  "success": true,
  "verified": true,
  "bank": "Commercial Bank of Ethiopia",
  "reference": "FT26140P01YB",
  "amount": 20000,
  "currency": "ETB",
  "senderName": "Mr Mohammed Abdulwasi Reshid",
  "receiverName": "SAMI ADIL ZEKARIA",
  "date": "5/20/2026 7:29:00 PM",
  "durationMs": 7782,
  "sourceUrl": "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171"
}`}</code>
          </pre>
        </div>

        {/* Endpoints */}
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>API endpoints</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "40px" }}>
          {endpoints.map((ep) => (
            <div key={ep.path} style={{
              padding: "18px 20px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)",
              display: "flex", gap: "14px", alignItems: "start",
            }}>
              <span style={{
                fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "4px",
                background: ep.method === "GET" ? "var(--green-light)" : "var(--ink)",
                color: ep.method === "GET" ? "var(--green-dark)" : "#fff", flexShrink: 0,
              }}>{ep.method}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontFamily: "var(--mono)", fontWeight: 600, marginBottom: "4px", wordBreak: "break-all" }}>{ep.path}</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)" }}>{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SDKs with interactive tabs */}
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>SDKs and libraries</h2>
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", gap: "0", marginBottom: "0", overflowX: "auto" }}>
            {Object.keys(sdkCode).map((lang) => (
              <button
                key={lang}
                onClick={() => setActiveSdk(lang)}
                style={{
                  padding: "8px 18px", fontSize: "13px", fontWeight: 600, borderRadius: "8px 8px 0 0",
                  background: activeSdk === lang ? "var(--surface)" : "var(--surface-alt)",
                  color: activeSdk === lang ? "var(--ink)" : "var(--ink-3)",
                  border: "1px solid var(--border)", borderBottom: activeSdk === lang ? "none" : "1px solid var(--border)",
                  cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
                }}
              >{lang}</button>
            ))}
          </div>
          <pre style={{
            background: activeSdk === "TypeScript" ? "var(--code-bg)" : "var(--surface-alt)",
            color: activeSdk === "TypeScript" ? "var(--code-text)" : "var(--ink-2)",
            padding: "20px 24px", borderRadius: "0 8px 8px 8px",
            fontSize: "13px", fontFamily: "var(--mono)", lineHeight: 1.6, overflow: "auto", margin: 0,
            border: "1px solid var(--border)",
          }}>
            <code>{sdkCode[activeSdk]}</code>
          </pre>
        </div>

        {/* Self-hosting */}
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>Self-hosting with Docker</h2>
        <pre style={{
          background: "var(--code-bg)", color: "var(--code-text)", padding: "20px 24px", borderRadius: "8px",
          fontSize: "13px", fontFamily: "var(--mono)", lineHeight: 1.6, overflow: "auto", marginBottom: "40px", margin: 0,
        }}>
          <code>{`git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d

# API available at http://localhost:3000/api/verify
# Self-hosting on an Ethiopian IP bypasses Telebirr/M-Pesa geo-blocks`}</code>
        </pre>

        {/* Architecture highlight */}
        <div style={{
          padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)",
          marginBottom: "40px",
        }}>
          <h2 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "14px" }}>Clean architecture</h2>
          <p style={{ fontSize: "14px", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: "16px" }}>
            cheki v1.0 uses hexagonal architecture (ports &amp; adapters). The core domain has zero runtime dependencies.
            Bank parsers are pluggable plugins. Configuration lives in a single JSON manifest.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
            {["Result types", "66 tests", "Pluggable parsers", "Manifest-driven", "CLI tool", "CONTRIBUTING.md"].map((tag) => (
              <span key={tag} style={{
                fontSize: "12px", fontWeight: 600, padding: "5px 12px", borderRadius: "20px",
                background: "var(--green-light)", color: "var(--green-dark)",
              }}>{tag}</span>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <a href="/docs" style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            Full API docs <Icon icon={ArrowRight01Icon} size={14} color="#fff" />
          </a>
          <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 600, background: "var(--surface)" }}>GitHub repo</a>
          <a href="https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 600, background: "var(--surface)" }}>Contributing guide</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
