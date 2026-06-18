"use client";

import { useState } from "react";

export default function DocsPage() {
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const codeBlock = (code: string, id: string) => (
    <div style={{ position: "relative", marginBottom: "16px" }}>
      <pre
        style={{
          background: "var(--card)",
          border: "2px solid var(--border)",
          padding: "16px 20px",
          overflow: "auto",
          fontSize: "13px",
          fontFamily: "monospace",
          color: "var(--fg)",
          margin: 0,
        }}
      >
        {code}
      </pre>
      <button
        onClick={() => copyToClipboard(code, id)}
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          background: "var(--bg)",
          border: "2px solid var(--border)",
          color: copied === id ? "var(--accent)" : "var(--muted)",
          padding: "4px 10px",
          fontSize: "12px",
          fontFamily: "Georgia, serif",
          cursor: "pointer",
        }}
      >
        {copied === id ? "copied" : "copy"}
      </button>
    </div>
  );

  const sectionTitle: React.CSSProperties = {
    fontSize: "22px",
    color: "var(--accent)",
    marginBottom: "12px",
    marginTop: "32px",
  };

  const endpointStyle: React.CSSProperties = {
    fontSize: "16px",
    fontFamily: "monospace",
    color: "var(--fg)",
    marginBottom: "6px",
  };

  const methodBadge = (method: string, color: string) => ({
    display: "inline-block",
    background: color,
    color: "#030303",
    padding: "2px 8px",
    fontSize: "12px",
    fontWeight: "bold",
    fontFamily: "monospace",
    marginRight: "8px",
  });

  return (
    <main style={{ minHeight: "100vh", maxWidth: "640px", margin: "0 auto", padding: "24px 20px" }}>
      <header style={{ textAlign: "center", marginBottom: "32px", marginTop: "20px" }}>
        <h1 style={{ fontSize: "32px", fontWeight: "bold", color: "var(--accent)", letterSpacing: "2px" }}>
          api docs
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "15px", marginTop: "8px" }}>
          free rest api. no auth. no rate limit (yet). no scam.
        </p>
      </header>

      <section>
        <h2 style={sectionTitle}>base url</h2>
        {codeBlock("https://cheki-pi.vercel.app", "baseurl")}
      </section>

      <section>
        <h2 style={sectionTitle}>verify a receipt</h2>
        <div style={endpointStyle}>
          <span style={methodBadge("POST", "var(--accent)")}>POST</span>
          /api/verify
        </div>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px" }}>
          Verify a single receipt. Returns parsed fields from the bank&apos;s public endpoint.
        </p>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "6px" }}>request body:</p>
        {codeBlock(`{
  "bank": "cbe",
  "reference": "FT26140P01YB",
  "accountNumber": "1000560536171"
}`, "verify_req")}
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "6px" }}>response:</p>
        {codeBlock(`{
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
}`, "verify_resp")}
      </section>

      <section>
        <h2 style={sectionTitle}>batch verify</h2>
        <div style={endpointStyle}>
          <span style={methodBadge("POST", "var(--accent)")}>POST</span>
          /api/verify/batch
        </div>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px" }}>
          Verify up to 50 receipts in one request. All processed in parallel.
        </p>
        {codeBlock(`{
  "receipts": [
    { "bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171" },
    { "bank": "cbe", "reference": "FT25211G11JQ", "accountNumber": "21827223" }
  ]
}`, "batch_req")}
      </section>

      <section>
        <h2 style={sectionTitle}>list banks</h2>
        <div style={endpointStyle}>
          <span style={methodBadge("GET", "var(--accent)")}>GET</span>
          /api/banks
        </div>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px" }}>
          Returns all supported banks with metadata (status, required fields, endpoint pattern).
        </p>
      </section>

      <section>
        <h2 style={sectionTitle}>health check</h2>
        <div style={endpointStyle}>
          <span style={methodBadge("GET", "var(--accent)")}>GET</span>
          /api/health
        </div>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px" }}>
          Checks if each bank endpoint is reachable from our servers. Includes latency.
        </p>
      </section>

      <section>
        <h2 style={sectionTitle}>download receipt</h2>
        <div style={endpointStyle}>
          <span style={methodBadge("GET", "var(--accent)")}>GET</span>
          /api/receipt?bank=cbe&amp;reference=FT26140P01YB&amp;account=1000560536171
        </div>
        <p style={{ color: "var(--muted)", fontSize: "14px", marginBottom: "12px" }}>
          Downloads the original receipt PDF directly from the bank. Supported: cbe, zemen, dashen.
        </p>
      </section>

      <section>
        <h2 style={sectionTitle}>typescript sdk</h2>
        {codeBlock(`import { Cheki } from "cheki";

const cheki = new Cheki("https://cheki-pi.vercel.app");

// verify one
const result = await cheki.verify("cbe", "FT26140P01YB", {
  accountNumber: "1000560536171"
});
console.log(result.verified); // true

// batch verify
const batch = await cheki.verifyBatch([
  { bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" },
  { bank: "boa", reference: "AB123456789", accountNumber: "100000006171" }
]);

// list banks
const { banks } = await cheki.getBanks();

// health check
const health = await cheki.getHealth();`, "ts_sdk")}
      </section>

      <section>
        <h2 style={sectionTitle}>python library</h2>
        {codeBlock(`pip install git+https://github.com/1RB/cheki.git#subdirectory=python

from ethio_receipt_verify import verify

result = verify("cbe", "FT26140P01YB", account_number="1000560536171")
print(result.to_dict())`, "py_lib")}
      </section>

      <section>
        <h2 style={sectionTitle}>curl</h2>
        {codeBlock(`curl -X POST https://cheki-pi.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'`, "curl")}
      </section>

      <section>
        <h2 style={sectionTitle}>error handling</h2>
        <p style={{ color: "var(--fg)", fontSize: "15px", marginBottom: "12px", lineHeight: 1.6 }}>
          Errors return a non-200 status code with a JSON body:
        </p>
        {codeBlock(`{
  "success": false,
  "error": "Receipt not found. Check the reference number.",
  "bank": "Commercial Bank of Ethiopia",
  "reference": "INVALID123"
}`, "error_resp")}
      </section>

      <section style={{ marginTop: "40px", display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <a
          href="/"
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
          back to cheki
        </a>
        <a
          href="https://github.com/1RB/cheki"
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
          github
        </a>
      </section>

      <footer style={{ marginTop: "40px", paddingBottom: "40px", textAlign: "center" }}>
        <p style={{ color: "var(--muted)", fontSize: "13px" }}>
          cheki api v0.2.0. free. forever.
        </p>
      </footer>
    </main>
  );
}
