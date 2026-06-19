"use client";

import { useState, useEffect } from "react";
import { Nav, Footer } from "@/components/Chrome";
import { Icon, ArrowRight01Icon } from "@/components/Icon";

const sections = [
  { id: "base-url", label: "Base URL" },
  { id: "verify", label: "POST /api/verify" },
  { id: "batch", label: "POST /api/verify/batch" },
  { id: "banks", label: "GET /api/banks" },
  { id: "health", label: "GET /api/health" },
  { id: "receipt", label: "GET /api/receipt" },
  { id: "typescript", label: "TypeScript" },
  { id: "python", label: "Python" },
  { id: "dart", label: "Dart / Flutter" },
  { id: "php", label: "PHP" },
  { id: "go", label: "Go" },
  { id: "cli", label: "CLI" },
  { id: "curl", label: "cURL" },
  { id: "errors", label: "Errors" },
  { id: "self-host", label: "Self-hosting" },
];

export default function DocsPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState("base-url");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" }
    );
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const Code = ({ code, id }: { code: string; id: string }) => (
    <div style={{ position: "relative", marginBottom: "20px" }}>
      <pre className="code-block" style={{ margin: 0 }}>
        <code>{code}</code>
      </pre>
      <button onClick={() => copy(code, id)} style={{
        position: "absolute", top: "10px", right: "10px",
        padding: "5px 12px", fontSize: "12px", fontWeight: 500,
        background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
        borderRadius: "6px", color: copied === id ? "var(--green)" : "rgba(255,255,255,0.6)",
        cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--sans)",
      }}>
        {copied === id ? "Copied" : "Copy"}
      </button>
    </div>
  );

  const EndpointHeader = ({ method, path, desc }: { method: string; path: string; desc: string }) => (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px", flexWrap: "wrap" }}>
        <span style={{
          padding: "4px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 700,
          fontFamily: "var(--mono)",
          background: method === "GET" ? "var(--green-light)" : "#ede9fe",
          color: method === "GET" ? "var(--green-dark)" : "#6d28d9",
        }}>{method}</span>
        <code style={{ fontSize: "16px", fontFamily: "var(--mono)", color: "var(--ink)", wordBreak: "break-all", minWidth: 0, fontWeight: 600 }}>{path}</code>
      </div>
      <p style={{ color: "var(--ink-2)", fontSize: "14px", marginBottom: "16px", lineHeight: 1.5 }}>{desc}</p>
    </div>
  );

  const SectionTitle = ({ id, children }: { id: string; children: React.ReactNode }) => (
    <h2 id={id} style={{
      fontSize: "22px", fontWeight: 800, color: "var(--ink)",
      marginTop: "48px", marginBottom: "16px", letterSpacing: "-0.01em",
      scrollMarginTop: "80px",
      display: "flex", alignItems: "center", gap: "10px",
    }}>
      <span style={{ width: "4px", height: "22px", background: "var(--green)", borderRadius: "2px", flexShrink: 0 }} />
      {children}
    </h2>
  );

  return (
    <>
      <Nav />
      <div style={{ minHeight: "100vh" }}>
        <div className="container" style={{ paddingTop: "40px", paddingBottom: "48px" }}>
          {/* Breadcrumb */}
          <nav style={{ fontSize: "13px", color: "var(--ink-3)", marginBottom: "20px" }}>
            <a href="/" style={{ color: "var(--ink-3)" }}>Home</a>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: "var(--ink)" }}>API Docs</span>
          </nav>

          <div className="docs-layout" style={{ display: "grid", gridTemplateColumns: "1fr", gap: "32px" }}>
            {/* Sidebar nav */}
            <aside className="docs-sidebar">
              <div style={{
                padding: "20px", borderRadius: "12px",
                background: "var(--surface)", border: "1px solid var(--border)",
              }}>
                <p style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ width: "4px", height: "16px", background: "var(--green)", borderRadius: "2px", display: "inline-block" }} />
                  API Reference
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  {sections.map((s) => (
                    <a key={s.id} href={`#${s.id}`}
                      className={activeSection === s.id ? "docs-nav-link active" : "docs-nav-link"}
                      style={{
                        fontSize: "13px", lineHeight: 1.4, padding: "6px 12px",
                        borderRadius: "6px", transition: "all 0.15s",
                        color: activeSection === s.id ? "var(--green-dark)" : "var(--ink-2)",
                        background: activeSection === s.id ? "var(--green-light)" : "transparent",
                        fontWeight: activeSection === s.id ? 600 : 400,
                        borderLeft: activeSection === s.id ? "2px solid var(--green)" : "2px solid transparent",
                      }}>{s.label}</a>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main content */}
            <main className="docs-main" style={{ minWidth: 0 }}>
              <h1 style={{ fontSize: "clamp(28px, 5vw, 36px)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: "8px" }}>
                API Documentation
              </h1>
              <p style={{ color: "var(--ink-2)", fontSize: "16px", marginBottom: "8px" }}>
                Free REST API. No auth. No rate limit. No scam.
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "32px" }}>
                {["No API key", "No signup", "No rate limit", "MIT licensed"].map((tag) => (
                  <span key={tag} style={{ fontSize: "12px", fontWeight: 600, padding: "4px 12px", borderRadius: "20px", background: "var(--green-light)", color: "var(--green-dark)" }}>{tag}</span>
                ))}
              </div>

              <SectionTitle id="base-url">Base URL</SectionTitle>
              <Code code="https://cheki-pi.vercel.app" id="base" />

              <SectionTitle id="verify">POST /api/verify</SectionTitle>
              <EndpointHeader method="POST" path="/api/verify" desc="Verify a single receipt. Send bank code, reference, and (for CBE/BOA) account number. For BOA inter-bank transfers, send the QR payload in qrData instead." />
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-3)", marginBottom: "8px" }}>Request body (CBE)</p>
              <Code code={`{
  "bank": "cbe",
  "reference": "FT26140P01YB",
  "accountNumber": "1000560536171"
}`} id="verify_req" />
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-3)", marginBottom: "8px" }}>Request body (BOA QR code)</p>
              <Code code={`{
  "bank": "boa",
  "qrData": "3cHRaxVjn/pySp..."
}`} id="verify_qr_req" />
              <p style={{ fontSize: "13px", fontWeight: 600, color: "var(--ink-3)", marginBottom: "8px" }}>Response (200)</p>
              <Code code={`{
  "success": true,
  "verified": true,
  "bank": "Commercial Bank of Ethiopia",
  "reference": "FT26140P01YB",
  "senderName": "Mr Mohammed Abdulwasi Reshid",
  "senderAccount": "1****1685",
  "receiverName": "SAMI ADIL ZEKARIA",
  "receiverAccount": "1****6171",
  "amount": 20000,
  "currency": "ETB",
  "date": "5/20/2026 7:29:00 PM",
  "branch": "MEKANISA MICHAEL BRANC",
  "durationMs": 7782,
  "sourceUrl": "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171"
}`} id="verify_resp" />

              <SectionTitle id="batch">POST /api/verify/batch</SectionTitle>
              <EndpointHeader method="POST" path="/api/verify/batch" desc="Verify up to 50 receipts in parallel. Send an array of receipt objects." />
              <Code code={`{
  "receipts": [
    { "bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171" },
    { "bank": "telebirr", "reference": "DET8FJGUJ4" }
  ]
}`} id="batch_req" />

              <SectionTitle id="banks">GET /api/banks</SectionTitle>
              <EndpointHeader method="GET" path="/api/banks" desc="List all supported banks with metadata." />

              <SectionTitle id="health">GET /api/health</SectionTitle>
              <EndpointHeader method="GET" path="/api/health" desc="Check if each bank endpoint is reachable. Includes latency." />

              <SectionTitle id="receipt">GET /api/receipt</SectionTitle>
              <EndpointHeader method="GET" path="/api/receipt?bank=cbe&reference=FT...&account=..." desc="Download the original receipt file (PDF/HTML) from the bank endpoint." />

              <SectionTitle id="typescript">TypeScript / JavaScript</SectionTitle>
              <Code code={`npm install cheki-verify

import { Cheki } from "cheki";

const cheki = new Cheki();

const result = await cheki.verify("cbe", "FT26140P01YB", {
  accountNumber: "1000560536171"
});

console.log(result.verified);   // true
console.log(result.senderName);
console.log(result.amount);

const batch = await cheki.verifyBatch([
  { bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" },
  { bank: "telebirr", reference: "DET8FJGUJ4" }
]);

const { banks } = await cheki.getBanks();
const health = await cheki.getHealth();`} id="sdk" />

              <SectionTitle id="python">Python</SectionTitle>
              <Code code={`pip install ethio-receipt-verify

from ethio_receipt_verify import verify

result = verify("cbe", "FT26140P01YB", account_number="1000560536171")
print(result.status)        # VerificationStatus.VERIFIED
print(result.amount)
print(result.payer_name)

# CLI also available
# ethio-verify cbe FT26140P01YB -a 1000560536171`} id="py" />

              <SectionTitle id="dart">Dart / Flutter</SectionTitle>
              <Code code={`# pubspec.yaml
# dependencies:
#   cheki: ^0.1.0

import 'package:cheki/cheki.dart';

final client = ChekiClient();

final result = await client.verify(
  bank: 'cbe',
  reference: 'FT26140P01YB',
  accountNumber: '1000560536171',
);

print(result.verified);
print(result.senderName);
print(result.amount);

final batch = await client.verifyBatch([
  VerifyRequest(bank: 'cbe', reference: 'FT26140P01YB', accountNumber: '1000560536171'),
  VerifyRequest(bank: 'telebirr', reference: 'DET8FJGUJ4'),
]);

client.close();`} id="dart" />

              <SectionTitle id="php">PHP</SectionTitle>
              <Code code={`composer require cheki/cheki

use Cheki\\ChekiClient;

$client = new ChekiClient();

$result = $client->verify('cbe', 'FT26140P01YB', [
    'accountNumber' => '1000560536171',
]);

echo $result->verified ? 'verified' : 'not verified';
echo $result->senderName;
echo $result->amount;

$batch = $client->verifyBatch([
    ['bank' => 'cbe', 'reference' => 'FT26140P01YB', 'accountNumber' => '1000560536171'],
    ['bank' => 'telebirr', 'reference' => 'DET8FJGUJ4'],
]);

$banks = $client->getBanks();
$health = $client->getHealth();`} id="php" />

              <SectionTitle id="go">Go</SectionTitle>
              <Code code={`go get github.com/1RB/cheki/sdks/go

import cheki "github.com/1RB/cheki/sdks/go"

client := cheki.NewClient()

result, err := client.Verify(ctx, &cheki.VerifyOptions{
    Bank:          "cbe",
    Reference:     "FT26140P01YB",
    AccountNumber: "1000560536171",
})

fmt.Println(result.Verified)
fmt.Println(result.SenderName)
fmt.Println(result.Amount)

batch, err := client.VerifyBatch(ctx, []cheki.VerifyOptions{
    {Bank: "cbe", Reference: "FT26140P01YB", AccountNumber: "1000560536171"},
    {Bank: "telebirr", Reference: "DET8FJGUJ4"},
})

banks, err := client.GetBanks(ctx)
health, err := client.GetHealth(ctx)`} id="go" />

              <SectionTitle id="cli">CLI</SectionTitle>
              <Code code={`npx cheki info
npx cheki verify cbe FT26140P01YB -a 1000560536171
npx cheki verify telebirr CHQ0FJ403O
npx cheki verify-qr boa 3cHRaxVjn/pySp...
npx cheki health`} id="cli" />

              <SectionTitle id="curl">cURL</SectionTitle>
              <Code code={`curl -X POST https://cheki-pi.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'`} id="curl" />

              <SectionTitle id="errors">Errors</SectionTitle>
              <Code code={`{
  "success": false,
  "error": "Receipt not found. Check the reference number.",
  "bank": "Commercial Bank of Ethiopia",
  "reference": "INVALID123"
}`} id="error" />
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
                {[
                  { code: "400", desc: "Missing input or malformed reference" },
                  { code: "404", desc: "Bank not supported or receipt not found" },
                  { code: "422", desc: "Endpoint reachable but could not parse receipt" },
                  { code: "502", desc: "Bank endpoint unreachable or geo-blocked" },
                  { code: "500", desc: "Internal server error" },
                ].map((e) => (
                  <div key={e.code} style={{ display: "flex", gap: "12px", alignItems: "center", padding: "10px 14px", borderRadius: "8px", background: "var(--surface-alt)", border: "1px solid var(--border)" }}>
                    <span style={{ fontFamily: "var(--mono)", fontSize: "13px", fontWeight: 700, color: e.code.startsWith("4") ? "var(--amber)" : "var(--red)", minWidth: "36px" }}>{e.code}</span>
                    <span style={{ fontSize: "13px", color: "var(--ink-2)" }}>{e.desc}</span>
                  </div>
                ))}
              </div>

              <SectionTitle id="self-host">Self-hosting with Docker</SectionTitle>
              <Code code={`git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d

# API at http://localhost:3000/api/verify
# Self-hosting on an Ethiopian IP bypasses geo-blocks`} id="docker" />

              <div style={{ marginTop: "40px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <a href="/developers" style={{ padding: "12px 24px", borderRadius: "8px", background: "var(--green)", color: "#fff", fontSize: "14px", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Developer guide <Icon icon={ArrowRight01Icon} size={14} color="#fff" />
                </a>
                <a href="https://github.com/1RB/cheki" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 600, background: "var(--surface)" }}>GitHub repo</a>
                <a href="https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md" target="_blank" rel="noopener" style={{ padding: "12px 24px", borderRadius: "8px", border: "1px solid var(--border)", color: "var(--ink)", fontSize: "14px", fontWeight: 600, background: "var(--surface)" }}>Contributing</a>
              </div>
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
