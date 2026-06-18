import type { Metadata } from "next";
import { Nav, Footer } from "@/components/Chrome";

export const metadata: Metadata = {
  title: "Developers - cheki API",
  description: "Free Ethiopian receipt verification API. No API key, no signup. Verify CBE, Telebirr, BOA, M-Pesa with one POST request.",
};

export default function DevelopersPage() {
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

        {/* Code examples */}
        <div style={{ marginBottom: "40px" }}>
          <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
            {["cURL", "JavaScript", "Python"].map((lang, i) => (
              <span key={lang} style={{
                padding: "6px 16px", fontSize: "13px", fontWeight: 600, borderRadius: "6px 6px 0 0",
                background: i === 0 ? "var(--ink)" : "var(--surface-alt)", color: i === 0 ? "#fff" : "var(--ink-3)",
                border: "1px solid var(--border)", borderBottom: i === 0 ? "none" : "1px solid var(--border)",
              }}>{lang}</span>
            ))}
          </div>
          <pre style={{
            background: "var(--ink)", color: "#e0e0e0", padding: "24px", borderRadius: "0 8px 8px 8px",
            fontSize: "13px", fontFamily: "var(--mono)", lineHeight: 1.6, overflow: "auto",
          }}>
{`curl -X POST https://cheki.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{
    "bank": "cbe",
    "reference": "FT26140P01YB",
    "accountNumber": "1000560536171"
  }'`}
          </pre>
        </div>

        {/* Response */}
        <div style={{ marginBottom: "40px" }}>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Response</p>
          <pre style={{
            background: "var(--surface-alt)", padding: "24px", borderRadius: "8px",
            fontSize: "13px", fontFamily: "var(--mono)", lineHeight: 1.6, overflow: "auto",
            border: "1px solid var(--border)",
          }}>
{`{
  "success": true,
  "verified": true,
  "bank": "Commercial Bank of Ethiopia",
  "reference": "FT26140P01YB",
  "amount": 20000,
  "currency": "ETB",
  "senderName": "Mr Mohammed Abdulwasi Reshid",
  "receiverName": "SAMI ADIL ZEKARIA",
  "date": "5/20/2026 7:29:00 PM",
  "sourceUrl": "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171"
}`}
          </pre>
        </div>

        {/* Endpoints */}
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>API endpoints</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginBottom: "40px" }}>
          {[
            { method: "POST", path: "/api/verify", desc: "Verify a single receipt. Send bank code, reference, and (for CBE/BOA) account number." },
            { method: "POST", path: "/api/verify/batch", desc: "Verify up to 50 receipts at once. Send an array of receipt objects." },
            { method: "GET", path: "/api/banks", desc: "List all supported banks and their verification status." },
            { method: "GET", path: "/api/health", desc: "Check API health and per-bank endpoint latency." },
            { method: "GET", path: "/api/receipt", desc: "Download the raw receipt file (PDF/HTML) from the bank endpoint." },
          ].map((ep) => (
            <div key={ep.path} style={{
              padding: "20px", borderRadius: "10px", background: "var(--surface)", border: "1px solid var(--border)",
              display: "flex", gap: "16px", alignItems: "start",
            }}>
              <span style={{
                fontSize: "12px", fontWeight: 700, padding: "4px 10px", borderRadius: "4px",
                background: ep.method === "GET" ? "var(--green-light)" : "var(--ink)",
                color: ep.method === "GET" ? "var(--green-dark)" : "#fff", flexShrink: 0,
              }}>{ep.method}</span>
              <div>
                <p style={{ fontSize: "15px", fontFamily: "var(--mono)", fontWeight: 600, marginBottom: "4px" }}>{ep.path}</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)" }}>{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SDK */}
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>SDKs and libraries</h2>
        <div className="grid-2" style={{ gap: "16px", marginBottom: "40px" }}>
          <div style={{ padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>TypeScript SDK</h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "12px" }}>Included in the cheki monorepo at /src/sdk</p>
            <pre style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--ink-2)", background: "var(--surface-alt)", padding: "12px", borderRadius: "6px" }}>
{`import { Cheki } from 'cheki/sdk';
const cheki = new Cheki();
const result = await cheki.verify({
  bank: 'cbe',
  reference: 'FT26140P01YB',
  accountNumber: '1000560536171'
});`}
            </pre>
          </div>
          <div style={{ padding: "24px", borderRadius: "12px", background: "var(--surface)", border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 700, marginBottom: "8px" }}>Python library</h3>
            <p style={{ fontSize: "14px", color: "var(--ink-2)", marginBottom: "12px" }}>Install from the cheki monorepo</p>
            <pre style={{ fontSize: "12px", fontFamily: "var(--mono)", color: "var(--ink-2)", background: "var(--surface-alt)", padding: "12px", borderRadius: "6px" }}>
{`pip install git+https://github.com/1RB/cheki.git#subdirectory=python

from ethio_receipt_verify import verify
result = verify("cbe", "FT26140P01YB",
  account="1000560536171")`}
            </pre>
          </div>
        </div>

        {/* Self-hosting */}
        <h2 style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>Self-hosting with Docker</h2>
        <pre style={{
          background: "var(--ink)", color: "#e0e0e0", padding: "24px", borderRadius: "8px",
          fontSize: "13px", fontFamily: "var(--mono)", lineHeight: 1.6, overflow: "auto", marginBottom: "40px",
        }}>
{`git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d

# API available at http://localhost:3000/api/verify
# Self-hosting on an Ethiopian IP bypasses Telebirr/M-Pesa geo-blocks`}
        </pre>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <a href="/docs" style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600 }}>Full API docs</a>
          <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 600, background: "var(--surface)" }}>GitHub repo</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
