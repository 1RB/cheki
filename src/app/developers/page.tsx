"use client";

import { useState } from "react";
import { Nav, Footer } from "@/components/Chrome";
import { Icon, ArrowRight01Icon } from "@/components/Icon";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { developersFaqs, faqPageJsonLd } from "@/lib/api-faq";

const h3Style = { fontSize: "17px", fontWeight: 700, marginBottom: "8px", scrollMarginTop: "80px" } as const;
const proseStyle = { fontSize: "15px", color: "var(--ink-2)", lineHeight: 1.6, maxWidth: "68ch", marginBottom: "12px" } as const;

const codeExamples: Record<string, string> = {
  cURL: `curl -X POST https://cheki.et/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{
    "bank": "cbe",
    "reference": "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"
  }'
# Older CBE receipt with only an FT reference (legacy format):
#   -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'`,
  JavaScript: `import { Cheki, isVerified } from "cheki-verify";

const cheki = new Cheki("https://cheki.et");
const result = await cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01");
// Older FT-only receipt (legacy): cheki.verify("cbe", "FT26140P01YB", { accountNumber: "1000560536171" })
// verified is the only success signal
if (isVerified(result)) console.log(result.amount, result.senderName);`,
  Python: `from cheki import ChekiClient

result = ChekiClient().verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01")
# Older FT-only receipt (legacy): verify("cbe", "FT26140P01YB", account_number="1000560536171")
if result.is_verified:  # the only success signal
    print(result.amount, result.sender_name)`,
};

const sdkCode: Record<string, string> = {
  TypeScript: `npm install cheki-verify

import { Cheki, isVerified } from "cheki-verify";
const cheki = new Cheki();
const result = await cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01");
isVerified(result); // true only when the bank confirmed it`,
  Python: `pip install cheki

from cheki import ChekiClient
result = ChekiClient().verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01")
result.is_verified  # True only when the bank confirmed it`,
  CLI: `# From a clone of the repo ("npx cheki" is an unrelated npm package)
git clone https://github.com/1RB/cheki.git && cd cheki && npm install
npm run cli -- verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01
npm run cli -- verify cbe FT26140P01YB -a 1000560536171   # older FT receipt (legacy)
npm run cli -- info
npm run cli -- health`,
};

export default function DevelopersPage() {
  const [activeLang, setActiveLang] = useState("cURL");
  const [activeSdk, setActiveSdk] = useState("TypeScript");

  const endpoints = [
    { method: "POST", path: "/api/verify", desc: "Verify a single receipt. Send the bank code and the receipt link or reference in its current format. BOA, and older CBE FT-only receipts, also need the account number." },
    { method: "POST", path: "/api/verify/batch", desc: "Verify up to 20 receipts at once. Send an array of receipt objects." },
    { method: "GET", path: "/api/banks", desc: "List all supported banks and their verification status." },
    { method: "GET", path: "/api/health", desc: "Check API health and per-bank endpoint latency." },
    { method: "GET", path: "/api/receipt", desc: "Open the bank's own receipt: CBE, Dashen, Zemen and ZamZam only (an older CBE FT reference also needs the account)." },
  ];

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.et/" },
      { "@type": "ListItem", position: 2, name: "Developers", item: "https://cheki.et/developers" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(developersFaqs)) }} />
      <Nav />
      <main className="container" style={{ paddingTop: "48px", paddingBottom: "48px" }}>
        <h1 style={{ fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "16px" }}>
          Verify any Ethiopian payment with one POST
        </h1>
        <p style={{ color: "var(--ink-2)", fontSize: "17px", maxWidth: "600px", marginBottom: "32px" }}>
          No API key. No signup. The cheki API is free and open source. Just POST to /api/verify. Requests are rate limited per IP: verify 30 per minute, batch 5 per minute, parse and ocr 20 per minute each, counted per server instance. Over the limit you get a 429 with a Retry-After header.
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
                  cursor: "pointer", transition: "background-color 0.15s, color 0.15s, border-color 0.15s, transform 0.15s", whiteSpace: "nowrap",
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
  "durationMs": 1240,
  "sourceUrl": "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"
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
                color: ep.method === "GET" ? "var(--green-dark)" : "var(--bg)", flexShrink: 0,
              }}>{ep.method}</span>
              <div style={{ minWidth: 0 }}>
                <p style={{ fontSize: "14px", fontFamily: "var(--mono)", fontWeight: 600, marginBottom: "4px", overflowWrap: "anywhere" }}>{ep.path}</p>
                <p style={{ fontSize: "14px", color: "var(--ink-2)", maxWidth: "60ch" }}>{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* SDKs with interactive tabs */}
        <h2 id="sdks" style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px", scrollMarginTop: "80px" }}>SDKs and libraries</h2>
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
                  cursor: "pointer", transition: "background-color 0.15s, color 0.15s, border-color 0.15s, transform 0.15s", whiteSpace: "nowrap",
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

        <div style={{ marginBottom: "40px" }}>
          <h3 id="typescript-sdk" style={h3Style}>TypeScript SDK for receipt verification</h3>
          <p style={proseStyle}>
            npm install cheki-verify. A typed client for the REST API with verify, verifyBatch (up to 20 receipts), getBanks, getHealth and getReceiptUrl. It has no runtime dependencies (native fetch, Node.js 20+), waits up to 65 seconds per attempt and retries at most once, only where it is safe (never a verify or batch the server answered with a 5xx). Treat a receipt as paid only when isVerified(result) is true: a 200 can still be unverified, such as a BOA QR code BOA could not confirm.
          </p>
          <h3 id="python-library" style={{ ...h3Style, marginTop: "24px" }}>Python library for receipt verification</h3>
          <p style={proseStyle}>
            pip install cheki (Python 3.10+). ChekiClient calls the cheki API, which fetches and parses the receipt and applies the verification gate on the server; it has verify, verify_batch, get_banks, get_health and get_receipt_url. verify returns a result instead of raising, so check result.is_verified, the only success signal. The package also installs the cheki-verify command, which exits 0 only when the receipt is verified.
          </p>
          <p style={proseStyle}>
            Go, PHP and Dart SDKs follow the same API contract: <a href="https://github.com/1RB/cheki/tree/main/sdks" target="_blank" rel="noopener noreferrer">all SDKs on GitHub</a>.
          </p>
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

        {/* Visible FAQ: the FAQPage JSON-LD above is built from the same list. */}
        <h2 id="faq" style={{ fontSize: "24px", fontWeight: 800, marginBottom: "20px" }}>SDK questions</h2>
        <div style={{ marginBottom: "40px" }}>
          <BouncyAccordion items={developersFaqs.map((f, i) => ({ id: `faq-${i}`, title: f.q, description: f.a }))} />
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <a href="/docs" style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--green-cta)", color: "var(--green-cta-fg)", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
            Full API docs <Icon icon={ArrowRight01Icon} size={14} color="var(--green-cta-fg)" />
          </a>
          <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 600, background: "var(--surface)" }}>GitHub repo</a>
          <a href="https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 600, background: "var(--surface)" }}>Contributing guide</a>
        </div>
      </main>
      <Footer />
    </>
  );
}
