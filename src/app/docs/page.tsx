import Link from "next/link";
import { Nav, Footer } from "@/components/Chrome";
import { CodeBlock } from "@/components/CodeBlock";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsTabs } from "@/components/docs/DocsTabs";
import { highlightCode } from "@/lib/highlight";
import { Icon, ArrowRight01Icon } from "@/components/Icon";
import { liveProviders } from "@/lib/bank-counts";
import { BouncyAccordion } from "@/components/motion/bouncy-accordion";
import { docsFaqs, faqPageJsonLd } from "@/lib/api-faq";

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
  { id: "bank-endpoints", label: "Bank endpoints", group: "Reference" },
  { id: "self-host", label: "Self-hosting", group: "Reference" },
  { id: "faq", label: "FAQ", group: "Reference" },
];

const sdkExamples = [
  {
    lang: "TypeScript",
    shikiLang: "typescript",
    code: `npm install cheki-verify

import { Cheki, isVerified, ChekiAPIError, ChekiRateLimitError } from "cheki-verify";

const cheki = new Cheki(); // 65 s timeout, at most 1 retry

try {
  const result = await cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01");
  // Older receipt with only an FT reference (legacy format):
  // await cheki.verify("cbe", "FT26140P01YB", { accountNumber: "1000560536171" });
  // verified is the only success signal (a decoded-only BOA QR is success: true, verified: false)
  if (isVerified(result)) console.log(result.amount, result.senderName);
} catch (err) {
  if (err instanceof ChekiRateLimitError) console.log("retry in", err.retryAfterSeconds, "s");
  else if (err instanceof ChekiAPIError) console.log(err.statusCode, err.serverMessage, err.fallbackUrl);
}

// Max 20 receipts per batch (checked before sending)
const batch = await cheki.verifyBatch([
  { bank: "cbe", reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01" },
  { bank: "telebirr", reference: "DET8FJGUJ4" },
]);
console.log(batch.verified, batch.failed, batch.total);

const { banks } = await cheki.getBanks();   // banks[i].id
const health = await cheki.getHealth();     // health.banks[i].status`,
  },
  {
    lang: "Python",
    shikiLang: "python",
    code: `pip install cheki

from cheki import ChekiClient

with ChekiClient() as cheki:  # 65 s timeout, at most 1 retry
    result = cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01")
    # Older receipt, FT reference only (legacy): cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")
    if result.is_verified:  # the only success signal
        print(result.amount, result.sender_name)
    elif result.is_rate_limited:
        print("retry in", result.retry_after, "s")
    else:
        print(result.http_status, result.error, result.fallback_url)

    batch = cheki.verify_batch([  # max 20
        {"bank": "cbe", "reference": "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"},
        {"bank": "telebirr", "reference": "DET8FJGUJ4"},
    ])
    print(batch.verified, batch.failed, batch.total)

# CLI (uses the API): cheki-verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01`,
  },
  {
    lang: "Go",
    shikiLang: "go",
    code: `go get github.com/1RB/cheki/sdks/go

import cheki "github.com/1RB/cheki/sdks/go"

client := cheki.NewClient() // 65 s timeout, at most 1 retry

result, err := client.Verify(ctx, cheki.VerifyOptions{
    Bank:      "cbe",
    Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
    // Older receipt, FT reference only (legacy): Reference: "FT26140P01YB", AccountNumber: "1000560536171"
})
var apiErr *cheki.APIError
switch {
case errors.Is(err, cheki.ErrRateLimited) && errors.As(err, &apiErr):
    fmt.Println("retry in", apiErr.RetryAfter)
case errors.As(err, &apiErr):
    fmt.Println(apiErr.StatusCode, apiErr.Message, apiErr.FallbackURL)
case err == nil && result.IsVerified(): // the only success signal
    fmt.Println(result.Amount, result.SenderName)
}

batch, err := client.VerifyBatch(ctx, []cheki.VerifyOptions{ // max 20
    {Bank: "cbe", Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"},
    {Bank: "telebirr", Reference: "DET8FJGUJ4"},
})

banks, err := client.GetBanks(ctx)   // banks[i].ID
health, err := client.GetHealth(ctx) // health.Banks[i].Status`,
  },
  {
    lang: "Dart",
    shikiLang: "bash",
    code: `// pubspec.yaml (not on pub.dev yet; use a git dependency)
// dependencies:
//   cheki:
//     git: { url: https://github.com/1RB/cheki.git, path: sdks/dart }

import 'package:cheki/cheki.dart';

final client = ChekiClient(); // 65 s timeout, at most 1 retry

try {
  final result = await client.verify(
    bank: 'cbe',
    reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01',
    // Older receipt, FT reference only (legacy): reference: 'FT26140P01YB', accountNumber: '1000560536171'
  );
  if (result.isVerified) print(result.amount); // the only success signal
} on ChekiRateLimitException catch (e) {
  print('retry in \${e.retryAfter}');
} on ChekiException catch (e) {
  print('\${e.statusCode} \${e.message} \${e.fallbackUrl}');
}

final batch = await client.verifyBatch(const [ // max 20
  BatchReceipt(bank: 'cbe', reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01'),
  BatchReceipt(bank: 'telebirr', reference: 'DET8FJGUJ4'),
]);

client.close();`,
  },
  {
    lang: "PHP",
    shikiLang: "php",
    code: `composer require cheki/cheki

use Cheki\\ChekiClient;

$client = new ChekiClient(); // 65 s timeout, at most 1 retry

$result = $client->verify('cbe', 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01');
// Older receipt, FT reference only (legacy): $client->verify('cbe', 'FT26140P01YB', '1000560536171');

if ($result->isVerified()) {          // the only success signal
    echo $result->senderName, ' ', $result->amount;
} elseif ($result->isRateLimited()) {
    echo 'retry in ', $result->retryAfter, ' s';
} else {
    echo $result->httpStatus, ' ', $result->error;
}

$batch = $client->verifyBatch([       // max 20
    ['bank' => 'cbe', 'reference' => 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01'],
    ['bank' => 'telebirr', 'reference' => 'DET8FJGUJ4'],
]);

$banks = $client->getBanks();   // $banks[0]->id
$health = $client->getHealth(); // $health->banks[0]->status`,
  },
  {
    lang: "cURL",
    shikiLang: "bash",
    code: `curl -X POST https://cheki.et/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"https://mbreciept.cbe.com.et/fHCxExampleRcpt01"}'`,
  },
  {
    lang: "CLI",
    shikiLang: "bash",
    code: `# The CLI runs from a clone of the repo. (The npm package named "cheki"
# is an unrelated project, so "npx cheki" does not run this CLI.)
git clone https://github.com/1RB/cheki.git && cd cheki && npm install
npm run cli -- info
npm run cli -- verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01
npm run cli -- verify cbe FT26140P01YB -a 1000560536171   # older FT receipt (legacy)
npm run cli -- verify telebirr CHQ0FJ403O
npm run cli -- verify-qr boa 3cHRaxVjn/pySp...
npm run cli -- health

# Or, through the hosted API: pip install cheki && cheki-verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01`,
  },
];

/** Batch response: only verified: true counts as verified; errors carry the status a single verify would return. */
const BATCH_RESPONSE_EXAMPLE = {
  success: true,
  results: [
    { success: true, verified: true, bank: "Commercial Bank of Ethiopia", bankCode: "cbe", reference: "FT26140P01YB", amount: 20000, currency: "ETB", sourceUrl: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01", durationMs: 7782, cached: false },
    { success: false, error: "[Telebirr] Receipt not found. Check the reference number.", status: 422 },
  ],
  cached: 0,
  total: 2,
  verified: 1,
  failed: 1,
};

const verifyParams = [
  { name: "bank", type: "string", required: "Yes (unless URL)", desc: `Bank id (the id field from GET /api/banks). Live: ${liveProviders.map((b) => b.id).join(", ")}` },
  { name: "reference", type: "string", required: "Yes (unless qrData)", desc: "Receipt link, Receipt ID or transaction reference, in the bank's current format (e.g. a CBE mbreciept.cbe.com.et link, a Dashen FT Ref, a Telebirr transaction number, a ZamZam receipt.zamzambank.com.et link). A bare ZamZam receipt id needs bank \"zamzam\"" },
  { name: "accountNumber", type: "string", required: "BOA (typed reference); older CBE FT receipts", desc: "BOA: the last 5 digits of the account on the receipt, not needed when you send a BOA slip link that ends with them. Last 8 digits only for an older CBE receipt that shows just an FT reference (legacy format); a CBE Receipt ID or link needs none" },
  { name: "qrData", type: "string", required: "BOA or Telebirr QR", desc: "Raw QR payload: a BOA inter-bank receipt QR (bank \"boa\"), or the Payment QR Code on a Telebirr receipt (bank \"telebirr\" or empty), whose transaction number is checked exactly like a typed one. A QR alone is never proof of payment." },
  { name: "phoneNumber", type: "string", required: "CBE Birr", desc: "Payer phone number, format: 2519XXXXXXXXX" },
];

const batchParams = [
  { name: "receipts", type: "array", required: "Yes", desc: "Array of receipt objects (same fields as verify). Max 20." },
];

const errorCodes = [
  { code: "400", name: "Bad Request", desc: "Missing required fields or malformed reference number" },
  { code: "404", name: "Not Found", desc: "Bank not supported: unknown id, or still in development" },
  { code: "422", name: "Unprocessable", desc: "Receipt not found at the bank, or the bank's response failed verification (no amount, wrong reference, failed or pending status)" },
  { code: "413", name: "Payload Too Large", desc: "Request body is over the limit (16 KB verify, 64 KB batch, 256 KB parse, 10 MB ocr)" },
  { code: "429", name: "Too Many Requests", desc: "Per-IP rate limit reached. Wait the number of seconds in the Retry-After header, then retry." },
  { code: "502", name: "Bad Gateway", desc: "Bank endpoint is unreachable, geo-blocked, or timed out. Geo-blocked banks include a fallbackUrl to open in a browser." },
  { code: "500", name: "Server Error", desc: "Internal server error. Check /api/health for endpoint status." },
];

const responseFields = [
  { name: "success", type: "boolean", desc: "Whether the request succeeded (not whether the receipt is real)" },
  { name: "verified", type: "boolean", desc: "Whether the receipt was found and matches the bank's records. The only field that means the payment is confirmed." },
  { name: "decodedOnly", type: "boolean", desc: "BOA QR only: decoded from the QR but the bank could not be reached. Always paired with verified: false. Not proof of payment." },
  { name: "parsed", type: "boolean", desc: "/api/parse only: read from content you supplied, never checked with the bank. Always paired with verified: false." },
  { name: "bank", type: "string", desc: "Full bank name" },
  { name: "bankCode", type: "string", desc: "Bank id (e.g. cbe)" },
  { name: "cached", type: "boolean", desc: "Served from cheki's receipt cache (verified receipts only). durationMs is absent when true." },
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
      {children}
    </h2>
  );
}

/** An h3 under an endpoint section. */
function SubTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} style={{ fontSize: "16px", fontWeight: 700, color: "var(--ink)", marginTop: "24px", marginBottom: "8px", scrollMarginTop: "80px" }}>
      {children}
    </h3>
  );
}

const prose = { fontSize: "15px", color: "var(--ink-2)", lineHeight: 1.6, marginBottom: "16px", maxWidth: "60ch" } as const;
const proseList = { ...prose, paddingLeft: "20px" } as const;

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      style={{
        padding: "4px 12px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: 700,
        fontFamily: "var(--mono)",
        background: method === "GET" ? "var(--green-light)" : "color-mix(in srgb, var(--ink) 8%, var(--surface))",
        color: method === "GET" ? "var(--green-dark)" : "var(--ink-2)",
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
            overflowWrap: "anywhere",
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
          maxWidth: "60ch",
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
  const baseUrlHtml = await highlightCode("https://cheki.et", "plaintext");
  const verifyReqHtml = await highlightCode(
    JSON.stringify(
      {
        bank: "cbe",
        reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
      },
      null,
      2
    ),
    "json"
  );
  const verifyLegacyReqHtml = await highlightCode(
    JSON.stringify({ bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" }, null, 2),
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
        durationMs: 1240,
        sourceUrl: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
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
          { bank: "cbe", reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01" },
          { bank: "telebirr", reference: "DET8FJGUJ4" },
        ],
      },
      null,
      2
    ),
    "json"
  );
  const batchRespHtml = await highlightCode(
    JSON.stringify(BATCH_RESPONSE_EXAMPLE, null, 2),
    "json"
  );
  const banksRespHtml = await highlightCode(
    JSON.stringify(
      {
        banks: [
          {
            id: "cbe",
            name: "Commercial Bank of Ethiopia",
            swift: "CBETETAA",
            type: "bank",
            status: "live",
            requiresAccount: false,
            accountDigits: 8,
            endpoint: "https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{ref}",
            color: "#502878",
            initials: "CBE",
            formats: [
              { id: "cbe-receipt-id", status: "current", label: "Receipt ID or mbreciept.cbe.com.et link", inputs: ["receiptId"], responseType: "json", supported: true, confidence: "verified" },
              { id: "cbe-ft-pdf", status: "legacy", label: "FT reference + last 8 digits of the receiving account", inputs: ["reference", "account"], accountDigits: 8, responseType: "pdf", supported: true, confidence: "inferred" },
            ],
          },
          {
            id: "telebirr",
            name: "Telebirr",
            type: "mobile",
            status: "live",
            requiresAccount: false,
            endpoint: "https://transactioninfo.ethiotelecom.et/receipt/{ref}",
            color: "#00A0DC",
            initials: "TB",
          },
        ],
      },
      null,
      2
    ),
    "json"
  );
  const healthRespHtml = await highlightCode(
    JSON.stringify(
      {
        status: "ok",
        checkedAt: "2026-10-11T09:00:00.000Z",
        banks: [
          { id: "cbe", name: "Commercial Bank of Ethiopia", status: "reachable", latencyMs: 340 },
          { id: "telebirr", name: "Telebirr", status: "geo-blocked", latencyMs: 5004 },
          { id: "nib", name: "Nib International Bank", status: "in-development", latencyMs: 0 },
        ],
        cached: false,
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
        error: "[Commercial Bank of Ethiopia] Receipt not found. Check the reference number.",
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
    `curl -X POST https://cheki.et/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"https://mbreciept.cbe.com.et/fHCxExampleRcpt01"}'`,
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
        sourceUrl: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
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

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://cheki.et/" },
      { "@type": "ListItem", position: 2, name: "API Docs", item: "https://cheki.et/docs" },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />
      <Nav />
      <div style={{ minHeight: "100vh" }}>
        <div
          className="container"
          style={{ paddingTop: "40px", paddingBottom: "48px" }}
        >
          {/* Breadcrumb */}
          <nav
            aria-label="Breadcrumb"
            style={{
              fontSize: "13px",
              color: "var(--ink-3)",
              marginBottom: "20px",
            }}
          >
            <Link href="/" style={{ color: "var(--ink-3)" }}>
              Home
            </Link>
            <span style={{ margin: "0 6px" }}>/</span>
            <span style={{ color: "var(--ink)" }}>API Docs</span>
          </nav>

          <div
            className="docs-layout"
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
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
                One POST request returns the full receipt.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  marginBottom: "32px",
                }}
              >
                {["No API key", "No signup", "MIT licensed"].map(
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
                  maxWidth: "60ch",
                }}
              >
                The cheki API verifies Ethiopian bank and mobile money receipts by
                fetching public bank endpoints. No authentication is required. No
                API key. Requests are rate limited per IP: verify 30 per minute, batch
                5 per minute, parse and ocr 20 per minute each, counted per server
                instance. Over the limit you get a 429 with a Retry-After header. Just POST to{" "}
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
                code="https://cheki.et"
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
                code={`curl -X POST https://cheki.et/api/verify \\
  -H "Content-Type: application/json" \\
  -d '{"bank":"cbe","reference":"https://mbreciept.cbe.com.et/fHCxExampleRcpt01"}'`}
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
                    sourceUrl: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
                  },
                  null,
                  2
                )}
                highlightedHtml={quickstartRespHtml}
                langLabel="json"
              />

              {/* POST /api/verify */}
              <SectionTitle id="verify">POST /api/verify: receipt verification API</SectionTitle>
              <EndpointHeader
                method="POST"
                path="/api/verify"
                desc="Verify a single receipt. Send the bank code and the receipt link or reference in the bank's current format (a CBE mbreciept link needs no account number). BOA, and older CBE receipts with only an FT reference, also need the account number. For BOA inter-bank transfers, send the QR payload in qrData instead. A Telebirr receipt QR also goes in qrData: cheki reads the transaction number out of it and checks that number with Telebirr."
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
                Request body (CBE, current format: receipt link or Receipt ID)
              </p>
              <CodeBlock
                code={JSON.stringify(
                  {
                    bank: "cbe",
                    reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
                  },
                  null,
                  2
                )}
                highlightedHtml={verifyReqHtml}
                langLabel="json"
              />
              <details style={{ margin: "8px 0 16px", fontSize: "14px", color: "var(--ink-2)" }}>
                <summary style={{ cursor: "pointer", fontWeight: 600 }}>Older receipt? (legacy formats)</summary>
                <p style={{ margin: "8px 0" }}>
                  A CBE receipt that shows only an FT reference uses the legacy format: send the FT reference and the receiving account (cheki uses the last 8 digits). CBE&apos;s older receipt host is often unreachable, so prefer the receipt link when you have it. Old Dashen Super App links still work: cheki reads the FT Ref from them. Each bank&apos;s formats, current first, are in <code>GET /api/banks</code> and on the <a href="/endpoints">endpoint reference</a>.
                </p>
                <CodeBlock
                  code={JSON.stringify({ bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" }, null, 2)}
                  highlightedHtml={verifyLegacyReqHtml}
                  langLabel="json"
                />
              </details>
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
                    durationMs: 1240,
                    sourceUrl: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
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
              <SectionTitle id="batch">POST /api/verify/batch: batch receipt verification</SectionTitle>
              <EndpointHeader
                method="POST"
                path="/api/verify/batch"
                desc="Verify up to 20 receipts per call (5 at a time). Send an array of receipt objects with the same fields as the single verify endpoint."
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
                      { bank: "cbe", reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01" },
                      { bank: "telebirr", reference: "DET8FJGUJ4" },
                    ],
                  },
                  null,
                  2
                )}
                highlightedHtml={batchReqHtml}
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
                Response (200). verified counts only verified: true items; failed is everything else, including decoded-only QR results.
              </p>
              <CodeBlock
                code={JSON.stringify(BATCH_RESPONSE_EXAMPLE, null, 2)}
                highlightedHtml={batchRespHtml}
                langLabel="json"
              />
              <SubTitle id="batch-use-cases">When to use batch verification</SubTitle>
              <ul style={proseList}>
                <li>End-of-day reconciliation: check every incoming transfer of the day in a few calls.</li>
                <li>Online orders: check the pending payment receipts before you ship.</li>
                <li>Delivery: check the cash-on-delivery transfers collected on a route.</li>
              </ul>

              {/* GET /api/banks */}
              <SectionTitle id="banks">GET /api/banks: list supported banks</SectionTitle>
              <EndpointHeader
                method="GET"
                path="/api/banks"
                desc="List all supported banks with metadata: id (the value to send as bank), name, type (bank, mobile or wallet), status, endpoint, and whether an account (accountDigits) or phone (requiresPhone) is needed. requiresPhone, swift and accountDigits are omitted when not set."
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
                    banks: [
                      {
                        id: "cbe",
                        name: "Commercial Bank of Ethiopia",
                        swift: "CBETETAA",
                        type: "bank",
                        status: "live",
                        requiresAccount: false,
                        accountDigits: 8,
                        endpoint: "https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{ref}",
                        color: "#502878",
                        initials: "CBE",
                        formats: [
                          { id: "cbe-receipt-id", status: "current", label: "Receipt ID or mbreciept.cbe.com.et link", inputs: ["receiptId"], responseType: "json", supported: true, confidence: "verified" },
                          { id: "cbe-ft-pdf", status: "legacy", label: "FT reference + last 8 digits of the receiving account", inputs: ["reference", "account"], accountDigits: 8, responseType: "pdf", supported: true, confidence: "inferred" },
                        ],
                      },
                      {
                        id: "telebirr",
                        name: "Telebirr",
                        type: "mobile",
                        status: "live",
                        requiresAccount: false,
                        endpoint: "https://transactioninfo.ethiotelecom.et/receipt/{ref}",
                        color: "#00A0DC",
                        initials: "TB",
                      },
                    ],
                  },
                  null,
                  2
                )}
                highlightedHtml={banksRespHtml}
                langLabel="json"
              />
              <SubTitle id="bank-picker">Building a bank picker</SubTitle>
              <p style={prose}>
                Show the banks with status live, and use requiresAccount, accountDigits and requiresPhone to decide which extra field to ask for. Only live banks can be verified; the others answer 404 from /api/verify. With a receipt link instead of a reference you can skip the picker: send the link as the reference and cheki detects the bank.
              </p>

              {/* GET /api/health */}
              <SectionTitle id="health">GET /api/health: bank endpoint health check</SectionTitle>
              <EndpointHeader
                method="GET"
                path="/api/health"
                desc="Check if each bank endpoint is reachable: status (reachable, unreachable, geo-blocked, no-parser, in-development) and latency per bank. Results are cached for up to 5 minutes (cached: true), so this never hammers the banks."
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
                    checkedAt: "2026-10-11T09:00:00.000Z",
                    banks: [
                      { id: "cbe", name: "Commercial Bank of Ethiopia", status: "reachable", latencyMs: 340 },
                      { id: "telebirr", name: "Telebirr", status: "geo-blocked", latencyMs: 5004 },
                      { id: "nib", name: "Nib International Bank", status: "in-development", latencyMs: 0 },
                    ],
                    cached: false,
                  },
                  null,
                  2
                )}
                highlightedHtml={healthRespHtml}
                langLabel="json"
              />
              <SubTitle id="health-patterns">Using the health check</SubTitle>
              <ul style={proseList}>
                <li>Before a batch, skip the banks that are unreachable right now.</li>
                <li>Show bank status on your dashboard, refreshed at most every 5 minutes.</li>
                <li>Fall back to a manual check when a bank is geo-blocked from your server.</li>
              </ul>

              {/* GET /api/receipt */}
              <SectionTitle id="receipt">GET /api/receipt</SectionTitle>
              <EndpointHeader
                method="GET"
                path="/api/receipt?bank=cbe&reference={Receipt ID}"
                desc="Open the bank's own copy of a receipt. Supported: cbe, dashen, zemen, zamzam. CBE Receipt ID, Dashen FT Ref and ZamZam receipt id (current formats, HTML at the bank): a 302 redirect to the bank's own receipt page, so bank HTML is never served from cheki. Older CBE FT reference (legacy, add account with at least the last 8 digits) and Zemen: the bank's PDF, returned only if it is a PDF (application/pdf, attachment). Reference and account are validated like /api/verify. Errors are JSON with 400, 404 or 502, and the verify rate limit (429) applies."
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
                SDKs are available in 5 languages. All wrap the same REST API and
                share one contract (sdks/fixtures/api-contract.json): bank id, the
                verified, decodedOnly and parsed fields, batch counts, typed 429 (with
                Retry-After) and 413 errors, and a client-side limit of 20 receipts per
                batch. Each attempt waits up to 65 seconds (the server may take up to 60).
                They never retry a 4xx or a timeout, and retry at most once on a
                network error, 5xx or 429 (after Retry-After). The server makes at most
                2 attempts per bank fetch, so one SDK call reaches a bank at most 4 times.
              </p>
              <DocsTabs tabs={sdkTabs} />

              {/* Errors */}
              <SectionTitle id="errors">Error Codes</SectionTitle>
              <CodeBlock
                code={JSON.stringify(
                  {
                    success: false,
                    error: "[Commercial Bank of Ethiopia] Receipt not found. Check the reference number.",
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
                        <td style={{ padding: "10px 14px", fontFamily: "var(--mono)", fontSize: "13px", fontWeight: 700, color: e.code.startsWith("4") ? "var(--amber-text)" : "var(--red-text)" }}>{e.code}</td>
                        <td style={{ padding: "10px 14px", fontSize: "13px", fontWeight: 600, color: "var(--ink)" }}>{e.name}</td>
                        <td style={{ padding: "10px 14px", fontSize: "13px", color: "var(--ink-2)" }}>{e.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Bank endpoints */}
              <SectionTitle id="bank-endpoints">Bank endpoints</SectionTitle>
              <p style={{ fontSize: "15px", color: "var(--ink-2)", lineHeight: 1.7, marginBottom: "12px" }}>
                The <Link href="/endpoints" style={{ color: "var(--green-dark)", fontWeight: 600 }}>endpoint reference</Link> lists every bank receipt URL cheki reads, with placeholders, unknown-reference error shapes and a dated changelog. It is generated from the manifest. Daily health checks are on the <Link href="/status" style={{ color: "var(--green-dark)", fontWeight: 600 }}>status page</Link>.
              </p>

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

              {/* FAQ: the FAQPage JSON-LD is built from the same list */}
              <SectionTitle id="faq">API questions</SectionTitle>
              <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageJsonLd(docsFaqs)) }} />
              <BouncyAccordion items={docsFaqs.map((f, i) => ({ id: `faq-${i}`, title: f.q, description: f.a }))} />

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
                    background: "var(--green-cta)",
                    color: "var(--green-cta-fg)",
                    fontSize: "14px",
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  Developer guide{" "}
                  <Icon icon={ArrowRight01Icon} size={14} color="var(--green-cta-fg)" />
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
