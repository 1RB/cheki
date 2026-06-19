import { Nav, Footer } from "@/components/Chrome";
import { CodeBlock } from "@/components/CodeBlock";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsTabs } from "@/components/docs/DocsTabs";
import { highlightCode, getLangLabel } from "@/lib/highlight";
import { Icon, ArrowRight01Icon } from "@/components/Icon";

const sections = [
  { id: "overview", label: "Overview", group: "Getting Started" },
  { id: "quickstart", label: "Quick Start", group: "Getting Started" },
  { id: "verify", label: "POST /api/verify", group: "Endpoints" },
  { id: "batch", label: "POST /api/verify/batch", group: "Endpoints" },
  { id: "banks", label: "GET /api/banks", group: "Endpoints" },
  { id: "health", label: "GET /api/health", group: "Endpoints" },
  { id: "receipt", label: "GET /api/receipt", group: "Endpoints" },
  { id: "sdks", label: "SDKs", group: "SDKs" },
  { id: "errors", label: "Error Codes", group: "Reference" },
  { id: "self-host", label: "Self-hosting", group: "Reference" },
];

const sdkExamples = [
  {
    lang: "TypeScript",
    shikiLang: "typescript",
    code: `npm install cheki-verify

import { Cheki } from "cheki-verify";

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
const health = await cheki.getHealth();`,
  },
  {
    lang: "Python",
    shikiLang: "python",
    code: `pip install cheki

from cheki import verify

result = verify("cbe", "FT26140P01YB", account_number="1000560536171")
print(result.status)        # VerificationStatus.VERIFIED
print(result.amount)
print(result.payer_name)

# CLI also available
# cheki-verify cbe FT26140P01YB -a 1000560536171`,
  },
  {
    lang: "Go",
    shikiLang: "go",
    code: `go get github.com/1RB/cheki/sdks/go

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
health, err := client.GetHealth(ctx)`,
  },
  {
    lang: "Dart",
    shikiLang: "bash",
    code: `# pubspec.yaml
# dependencies:
#   cheki: ^1.1.0

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

client.close();`,
  },
  {
    lang: "PHP",
    shikiLang: "php",
    code: `composer require cheki/cheki

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
$health = $client->getHealth();`,
  },
  {
    lang: "cURL",
    shikiLang: "bash",
    code: `curl -X POST https://chekiapp.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'`,
  },
  {
    lang: "CLI",
    shikiLang: "bash",
    code: `npx cheki info
npx cheki verify cbe FT26140P01YB -a 1000560536171
npx cheki verify telebirr CHQ0FJ403O
npx cheki verify-qr boa 3cHRaxVjn/pySp...
npx cheki health`,
  },
];

const verifyParams = [
  { name: "bank", type: "string", required: "Yes (unless URL)", desc: "Bank code: cbe, telebirr, boa, mpesa, dashen, zemen, cbebirr, siinqee" },
  { name: "reference", type: "string", required: "Yes", desc: "Transaction reference number (e.g. FT26140P01YB) or receipt URL" },
  { name: "accountNumber", type: "string", required: "CBE, BOA", desc: "Last 8 digits for CBE, last 5 for BOA" },
  { name: "qrData", type: "string", required: "BOA QR", desc: "Raw QR payload for BOA inter-bank transfers" },
  { name: "phone", type: "string", required: "CBE Birr", desc: "Payer phone number, format: 2519XXXXXXXXX" },
];

const batchParams = [
  { name: "receipts", type: "array", required: "Yes", desc: "Array of receipt objects (same fields as verify). Max 50." },
];

const errorCodes = [
  { code: "400", name: "Bad Request", desc: "Missing required fields or malformed reference number" },
  { code: "404", name: "Not Found", desc: "Bank code not recognized or receipt not found at the bank endpoint" },
  { code: "422", name: "Unprocessable", desc: "Bank endpoint returned data but it could not be parsed" },
  { code: "502", name: "Bad Gateway", desc: "Bank endpoint is unreachable, geo-blocked, or timed out" },
  { code: "500", name: "Server Error", desc: "Internal server error. Check /api/health for endpoint status." },
];

const responseFields = [
  { name: "success", type: "boolean", desc: "Whether the request succeeded (not whether the receipt is real)" },
  { name: "verified", type: "boolean", desc: "Whether the receipt was found and matches the bank's records" },
  { name: "bank", type: "string", desc: "Full bank name" },
  { name: "reference", type: "string", desc: "Transaction reference number" },
  { name: "senderName", type: "string", desc: "Name of the account that sent the payment" },
  { name: "senderAccount", type: "string", desc: "Masked sender account number" },
  { name: "receiverName", type: "string", desc: "Name of the account that received the payment" },
  { name: "receiverAccount", type: "string", desc: "Masked receiver account number" },
  { name: "amount", type: "number", desc: "Transfer amount in ETB" },
  { name: "currency", type: "string", desc: "Currency code (always ETB for domestic)" },
  { name: "date", type: "string", desc: "Transaction date and time" },
  { name: "sourceUrl", type: "string", desc: "The bank endpoint URL cheki fetched the data from" },
  { name: "durationMs", type: "number", desc: "Time spent fetching from the bank endpoint, in milliseconds" },
];

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      style={{
        fontSize: "22px",
        fontWeight: 800,
        color: "var(--ink)",
        marginTop: "48px",
        marginBottom: "16px",
        letterSpacing: "-0.01em",
        scrollMarginTop: "80px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
      }}
    >
      <span
        style={{
          width: "4px",
          height: "22px",
          background: "var(--green)",
          borderRadius: "2px",
          flexShrink: 0,
        }}
      />
      {children}
    </h2>
  );
}

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 700,
        fontFamily: "var(--mono)",
        background: method === "GET" ? "var(--green-light)" : "#ede9fe",
        color: method === "GET" ? "var(--green-dark)" : "#6d28d9",
        flexShrink: 0,
      }}
    >
      {method}
    </span>
  );
}

function EndpointHeader({
  method,
  path,
  desc,
}: {
  method: string;
  path: string;
  desc: string;
}) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          marginBottom: "8px",
          flexWrap: "wrap",
        }}
      >
        <MethodBadge method={method} />
        <code
          style={{
            fontSize: "16px",
            fontFamily: "var(--mono)",
            color: "var(--ink)",
            wordBreak: "break-all",
            minWidth: 0,
            fontWeight: 600,
          }}
        >
          {path}
        </code>
      </div>
      <p
        style={{
          color: "var(--ink-2)",
          fontSize: "14px",
          marginBottom: "16px",
          lineHeight: 1.5,
        }}
      >
        {desc}
      </p>
    </div>
  );
}

function ParamTable({
  params,
}: {
  params: { name: string; type: string; required: string; desc: string }[];
}) {
  return (
    <div className="table-wrap" style={{ marginBottom: "20px" }}>
      <table>
        <thead>
          <tr style={{ borderBottom: "2px solid var(--border)" }}>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Parameter</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Type</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Required</th>
            <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr
              key={p.name}
              style={{
                borderBottom: "1px solid var(--border)",
                background: i % 2 === 0 ? "transparent" : "var(--surface-alt)",
              }}
            >
              <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: "13px", fontWeight: 600, color: "var(--green-dark)" }}>{p.name}</td>
              <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: "13px", color: "var(--ink-2)" }}>{p.type}</td>
              <td style={{ padding: "10px 14px", fontSize: "13px", color: "var(--ink-2)" }}>{p.required}</td>
              <td style={{ padding: "10px 14px", fontSize: "13px", color: "var(--ink-2)" }}>{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function DocsPage() {
  // Pre-highlight all SDK examples with Shiki
  const highlightedSdks = await Promise.all(
    sdkExamples.map((ex) => highlightCode(ex.code, ex.shikiLang))
  );

  // Pre-highlight all standalone code blocks
  const baseUrlHtml = await highlightCode("https://chekiapp.vercel.app", "plaintext");
  const verifyReqHtml = await highlightCode(
    JSON.stringify(
      {
        bank: "cbe",
        reference: "FT26140P01YB",
        accountNumber: "1000560536171",
      },
      null,
      2
    ),
    "json"
  );
  const verifyQrReqHtml = await highlightCode(
    JSON.stringify({ bank: "boa", qrData: "3cHRaxVjn/pySp..." }, null, 2),
    "json"
  );
  const verifyRespHtml = await highlightCode(
    JSON.stringify(
      {
        success: true,
        verified: true,
        bank: "Commercial Bank of Ethiopia",
        reference: "FT26140P01YB",
        senderName: "Mr Mohammed Abdulwasi Reshid",
        senderAccount: "1****1685",
        receiverName: "SAMI ADIL ZEKARIA",
        receiverAccount: "1****6171",
        amount: 20000,
        currency: "ETB",
        date: "5/20/2026 7:29:00 PM",
        branch: "MEKANISA MICHAEL BRANC",
        durationMs: 7782,
        sourceUrl: "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171",
      },
      null,
      2
    ),
    "json"
  );
  const batchReqHtml = await highlightCode(
    JSON.stringify(
      {
        receipts: [
          { bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" },
          { bank: "telebirr", reference: "DET8FJGUJ4" },
        ],
      },
      null,
      2
    ),
    "json"
  );
  const banksRespHtml = await highlightCode(
    JSON.stringify(
      [
        {
          code: "cbe",
          name: "Commercial Bank of Ethiopia",
          type: "bank",
          status: "live",
          requiresAccount: true,
          accountDigits: 8,
        },
        {
          code: "telebirr",
          name: "Telebirr",
          type: "wallet",
          status: "live",
          requiresAccount: false,
        },
      ],
      null,
      2
    ),
    "json"
  );
  const healthRespHtml = await highlightCode(
    JSON.stringify(
      {
        status: "ok",
        banks: {
          cbe: { status: "up", latencyMs: 340 },
          telebirr: { status: "geo-blocked", latencyMs: null },
          boa: { status: "up", latencyMs: 180 },
        },
      },
      null,
      2
    ),
    "json"
  );
  const errorRespHtml = await highlightCode(
    JSON.stringify(
      {
        success: false,
        error: "Receipt not found. Check the reference number.",
        bank: "Commercial Bank of Ethiopia",
        reference: "INVALID123",
      },
      null,
      2
    ),
    "json"
  );
  const dockerHtml = await highlightCode(
    `git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d

# API at http://localhost:3000/api/verify
# Self-hosting on an Ethiopian IP bypasses geo-blocks`,
    "bash"
  );
  const quickstartHtml = await highlightCode(
    `curl -X POST https://chekiapp.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'`,
    "bash"
  );
  const quickstartRespHtml = await highlightCode(
    JSON.stringify(
      {
        success: true,
        verified: true,
        bank: "Commercial Bank of Ethiopia",
        reference: "FT26140P01YB",
        amount: 20000,
        currency: "ETB",
        senderName: "Mr Mohammed Abdulwasi Reshid",
        receiverName: "SAMI ADIL ZEKARIA",
        date: "5/20/2026 7:29:00 PM",
        sourceUrl: "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171",
      },
      null,
      2
    ),
    "json"
  );

  const sdkTabs = sdkExamples.map((ex, i) => ({
    lang: ex.lang,
    highlightedHtml: highlightedSdks[i],
    rawCode: ex.code,
  }));

  return (
    <>
      <Nav />
      <div style={{ minHeight: "100vh" }}>
        <div
          className="container"
          style={{ paddingTop: "40px", paddingBottom: "48px" }}
        >
          {/* Breadcrumb */}
          <nav
            style={{
              fontSize: "13px",
              color: "var(--ink-3)",
              marginBottom: "20px",
            }}
          >
            <a href="/" style={{ color: "var(--ink-3)" }}>
              Home
            </a>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: "var(--ink)" }}>API Docs</span>
          </nav>

          <div
            className="docs-layout"
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: "32px",
            }}
          >
            {/* Sidebar nav */}
            <aside className="docs-sidebar">
              <DocsSidebar sections={sections} />
            </aside>

            {/* Main content */}
            <main className="docs-main" style={{ minWidth: 0 }}>
              <h1
                style={{
                  fontSize: "clamp(28px, 5vw, 36px)",
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  marginBottom: "8px",
                }}
              >
                API Documentation
              </h1>
              <p
                style={{
                  color: "var(--ink-2)",
                  fontSize: "16px",
                  marginBottom: "8px",
                }}
              >
                Free REST API. No auth. No rate limit. No scam.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "32px",
                }}
              >
                {["No API key", "No signup", "No rate limit", "MIT licensed"].map(
                  (tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        padding: "4px 12px",
                        borderRadius: "20px",
                        background: "var(--green-light)",
                        color: "var(--green-dark)",
                      }}
                    >
                      {tag}
                    </span>
                  )
                )}
              </div>

              {/* Overview */}
              <SectionTitle id="overview">Overview</SectionTitle>
              <p
                style={{
                  fontSize: "15px",
                  color: "var(--ink-2)",
                  lineHeight: 1.6,
                  marginBottom: "16px",
                }}
              >
                The cheki API verifies Ethiopian bank and mobile money receipts by
                fetching public bank endpoints. No authentication is required. No
                API key. No rate limit. Just POST to{" "}
                <code
                  style={{
                    fontFamily: "var(--mono)",
                    fontSize: "13px",
                    background: "var(--surface-alt)",
                    padding: "1px 5px",
                    borderRadius: "4px",
                    color: "var(--green-dark)",
                  }}
                >
                  /api/verify
                </code>{" "}
                with a bank code and reference number.
              </p>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Base URL
              </p>
              <CodeBlock
                code="https://chekiapp.vercel.app"
                highlightedHtml={baseUrlHtml}
                langLabel="url"
              />

              {/* Quick Start */}
              <SectionTitle id="quickstart">Quick Start</SectionTitle>
              <p
                style={{
                  fontSize: "15px",
                  color: "var(--ink-2)",
                  lineHeight: 1.6,
                  marginBottom: "16px",
                }}
              >
                Verify a CBE receipt with one cURL call:
              </p>
              <CodeBlock
                code={`curl -X POST https://chekiapp.vercel.app/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'`}
                highlightedHtml={quickstartHtml}
                langLabel="bash"
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Response
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    success: true,
                    verified: true,
                    bank: "Commercial Bank of Ethiopia",
                    reference: "FT26140P01YB",
                    amount: 20000,
                    currency: "ETB",
                    senderName: "Mr Mohammed Abdulwasi Reshid",
                    receiverName: "SAMI ADIL ZEKARIA",
                    date: "5/20/2026 7:29:00 PM",
                    sourceUrl:
                      "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171",
                  },
                  null,
                  2
                )}
                highlightedHtml={quickstartRespHtml}
                langLabel="json"
              />

              {/* POST /api/verify */}
              <SectionTitle id="verify">POST /api/verify</SectionTitle>
              <EndpointHeader
                method="POST"
                path="/api/verify"
                desc="Verify a single receipt. Send bank code, reference, and (for CBE/BOA) account number. For BOA inter-bank transfers, send the QR payload in qrData instead."
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Parameters
              </p>
              <ParamTable params={verifyParams} />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Request body (CBE)
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    bank: "cbe",
                    reference: "FT26140P01YB",
                    accountNumber: "1000560536171",
                  },
                  null,
                  2
                )}
                highlightedHtml={verifyReqHtml}
                langLabel="json"
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Request body (BOA QR code)
              </p>
              <CodeBlock
                code={JSON.stringify(
                  { bank: "boa", qrData: "3cHRaxVjn/pySp..." },
                  null,
                  2
                )}
                highlightedHtml={verifyQrReqHtml}
                langLabel="json"
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Response (200)
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    success: true,
                    verified: true,
                    bank: "Commercial Bank of Ethiopia",
                    reference: "FT26140P01YB",
                    senderName: "Mr Mohammed Abdulwasi Reshid",
                    senderAccount: "1****1685",
                    receiverName: "SAMI ADIL ZEKARIA",
                    receiverAccount: "1****6171",
                    amount: 20000,
                    currency: "ETB",
                    date: "5/20/2026 7:29:00 PM",
                    branch: "MEKANISA MICHAEL BRANC",
                    durationMs: 7782,
                    sourceUrl:
                      "https://apps.cbe.com.et:100/?id=FT26140P01YB60536171",
                  },
                  null,
                  2
                )}
                highlightedHtml={verifyRespHtml}
                langLabel="json"
              />
              <details
                style={{
                  marginBottom: "20px",
                  padding: "12px 16px",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  background: "var(--surface)",
                }}
              >
                <summary
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer",
                    color: "var(--ink)",
                  }}
                >
                  Response fields
                </summary>
                <div style={{ marginTop: "12px" }}>
                  <ParamTable
                    params={responseFields.map((f) => ({
                      name: f.name,
                      type: f.type,
                      required: "",
                      desc: f.desc,
                    }))}
                  />
                </div>
              </details>

              {/* POST /api/verify/batch */}
              <SectionTitle id="batch">POST /api/verify/batch</SectionTitle>
              <EndpointHeader
                method="POST"
                path="/api/verify/batch"
                desc="Verify up to 50 receipts in parallel. Send an array of receipt objects with the same fields as the single verify endpoint."
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Parameters
              </p>
              <ParamTable params={batchParams} />
              <CodeBlock
                code={JSON.stringify(
                  {
                    receipts: [
                      {
                        bank: "cbe",
                        reference: "FT26140P01YB",
                        accountNumber: "1000560536171",
                      },
                      { bank: "telebirr", reference: "DET8FJGUJ4" },
                    ],
                  },
                  null,
                  2
                )}
                highlightedHtml={batchReqHtml}
                langLabel="json"
              />

              {/* GET /api/banks */}
              <SectionTitle id="banks">GET /api/banks</SectionTitle>
              <EndpointHeader
                method="GET"
                path="/api/banks"
                desc="List all supported banks with metadata: code, name, type, status, endpoint, and verification requirements."
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Response (200)
              </p>
              <CodeBlock
                code={JSON.stringify(
                  [
                    {
                      code: "cbe",
                      name: "Commercial Bank of Ethiopia",
                      type: "bank",
                      status: "live",
                      requiresAccount: true,
                      accountDigits: 8,
                    },
                    {
                      code: "telebirr",
                      name: "Telebirr",
                      type: "wallet",
                      status: "live",
                      requiresAccount: false,
                    },
                  ],
                  null,
                  2
                )}
                highlightedHtml={banksRespHtml}
                langLabel="json"
              />

              {/* GET /api/health */}
              <SectionTitle id="health">GET /api/health</SectionTitle>
              <EndpointHeader
                method="GET"
                path="/api/health"
                desc="Check if each bank endpoint is reachable. Reports status and latency per bank. Useful for monitoring and debugging."
              />
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--ink-3)",
                  marginBottom: "8px",
                }}
              >
                Response (200)
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    status: "ok",
                    banks: {
                      cbe: { status: "up", latencyMs: 340 },
                      telebirr: { status: "geo-blocked", latencyMs: null },
                      boa: { status: "up", latencyMs: 180 },
                    },
                  },
                  null,
                  2
                )}
                highlightedHtml={healthRespHtml}
                langLabel="json"
              />

              {/* GET /api/receipt */}
              <SectionTitle id="receipt">GET /api/receipt</SectionTitle>
              <EndpointHeader
                method="GET"
                path="/api/receipt?bank=cbe&reference=FT...&account=..."
                desc="Download the original receipt file (PDF or HTML) from the bank endpoint. Returns the raw file with the appropriate Content-Type header."
              />

              {/* SDKs */}
              <SectionTitle id="sdks">SDKs</SectionTitle>
              <p
                style={{
                  fontSize: "15px",
                  color: "var(--ink-2)",
                  lineHeight: 1.6,
                  marginBottom: "16px",
                }}
              >
                SDKs are available in 5 languages. All wrap the same REST API with
                typed errors, retry with exponential backoff, and timeout support.
              </p>
              <DocsTabs tabs={sdkTabs} />

              {/* Errors */}
              <SectionTitle id="errors">Error Codes</SectionTitle>
              <CodeBlock
                code={JSON.stringify(
                  {
                    success: false,
                    error: "Receipt not found. Check the reference number.",
                    bank: "Commercial Bank of Ethiopia",
                    reference: "INVALID123",
                  },
                  null,
                  2
                )}
                highlightedHtml={errorRespHtml}
                langLabel="json"
              />
              <div
                className="table-wrap"
                style={{ marginBottom: "20px" }}
              >
                <table>
                  <thead>
                    <tr style={{ borderBottom: "2px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Status</th>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Name</th>
                      <th style={{ textAlign: "left", padding: "10px 14px", fontWeight: 700, fontSize: "12px", color: "var(--ink)", textTransform: "uppercase", letterSpacing: "0.04em" }}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorCodes.map((e, i) => (
                      <tr
                        key={e.code}
                        style={{
                          borderBottom: "1px solid var(--border)",
                          background: i % 2 === 0 ? "transparent" : "var(--surface-alt)",
                        }}
                      >
                        <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: "13px", fontWeight: 700, color: e.code.startsWith("4") ? "var(--amber)" : "var(--red)" }}>{e.code}</td>
                        <td style={{ padding: "10px 14px", fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{e.name}</td>
                        <td style={{ padding: "10px 14px", fontSize: "13px", color: "var(--ink-2)" }}>{e.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Self-hosting */}
              <SectionTitle id="self-host">Self-hosting with Docker</SectionTitle>
              <CodeBlock
                code={`git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d

# API at http://localhost:3000/api/verify
# Self-hosting on an Ethiopian IP bypasses geo-blocks`}
                highlightedHtml={dockerHtml}
                langLabel="bash"
              />

              {/* Footer links */}
              <div
                style={{
                  marginTop: "40px",
                  display: "flex",
                  gap: "12px",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href="/developers"
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    background: "var(--green)",
                    color: "#fff",
                    fontSize: "14px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  Developer guide{" "}
                  <Icon icon={ArrowRight01Icon} size={14} color="#fff" />
                </a>
                <a
                  href="https://github.com/1RB/cheki"
                  target="_blank"
                  rel="noopener"
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    fontSize: "14px",
                    fontWeight: 600,
                    background: "var(--surface)",
                  }}
                >
                  GitHub repo
                </a>
                <a
                  href="https://github.com/1RB/cheki/blob/main/CONTRIBUTING.md"
                  target="_blank"
                  rel="noopener"
                  style={{
                    padding: "12px 24px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    color: "var(--ink)",
                    fontSize: "14px",
                    fontWeight: 600,
                    background: "var(--surface)",
                  }}
                >
                  Contributing
                </a>
              </div>
            </main>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}
