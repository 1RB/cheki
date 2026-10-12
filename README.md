# cheki

**Free, open-source Ethiopian bank receipt verification. No signup. No API key. No scam.**

[![CI](https://img.shields.io/github/actions/workflow/status/1RB/cheki/ci.yml?branch=main&style=flat&label=CI&logo=github)](https://github.com/1RB/cheki/actions/workflows/ci.yml)
[![Publish](https://img.shields.io/github/actions/workflow/status/1RB/cheki/publish.yml?style=flat&label=Publish&logo=github)](https://github.com/1RB/cheki/actions/workflows/publish.yml)
[![npm](https://img.shields.io/npm/v/cheki-verify?style=flat&label=npm&logo=npm&color=CB383D)](https://www.npmjs.com/package/cheki-verify)
[![PyPI](https://img.shields.io/pypi/v/cheki?style=flat&label=PyPI&logo=pypi&color=3775A9)](https://pypi.org/project/cheki/)
[![Packagist](https://img.shields.io/packagist/v/cheki/cheki?style=flat&label=Packagist&logo=packagist&logoColor=fff&color=F2848E)](https://packagist.org/packages/cheki/cheki)
[![GitHub Packages](https://img.shields.io/badge/%401RB-cheki--verify-blue?style=flat&logo=github)](https://github.com/1RB/cheki/pkgs/npm/cheki-verify)
[![Go Reference](https://pkg.go.dev/badge/github.com/1RB/cheki/sdks/go.svg)](https://pkg.go.dev/github.com/1RB/cheki/sdks/go)
[![License: MIT](https://img.shields.io/github/license/1RB/cheki?style=flat&label=License&color=2ddb6a)](https://github.com/1RB/cheki/blob/main/LICENSE)
[![Stars](https://img.shields.io/github/stars/1RB/cheki?style=flat&label=Stars&logo=github)](https://github.com/1RB/cheki/stargazers)
[![Issues](https://img.shields.io/github/issues/1RB/cheki?style=flat&label=Issues&logo=github)](https://github.com/1RB/cheki/issues)
[![Tests](https://img.shields.io/badge/tests-122%20vitest-2ddb6a?style=flat&logo=vitest&logoColor=fff)](https://github.com/1RB/cheki/blob/main/src/lib/parsers/__tests__)
[![Banks](https://img.shields.io/badge/banks-9%20live%20%E2%80%A2%2022%20researching-2ddb6a?style=flat)](https://cheki.et/banks)
[![Website](https://img.shields.io/website?style=flat&label=cheki.et&url=https%3A%2F%2Fcheki.et&logo=vercel&logoColor=fff)](https://cheki.et)

cheki verifies Ethiopian bank and mobile money receipts by fetching public bank endpoints. The data is free. The code is MIT licensed. No one should charge you for accessing public bank data.

## Why?

check.et charges 499 ETB/month or 4,990 ETB/year after 200 one-time free verifications, and verify.et's API plans run 500-3,000 ETB/month (prices as listed on each site on 12 October 2026). Both verify receipts by hitting the same public bank URLs cheki uses for free. cheki exposes this and provides the same service for free: no signup and no API key, with per-IP rate limits on the hosted API (verify 30/min, batch 5/min); self-host for more.

## Supported banks

**9 live banks** · 22 in research

| Bank | Code | Type | Status | Current input | Geo-blocked |
|------|------|------|--------|---------------|-------------|
| Commercial Bank of Ethiopia | `cbe` | Bank | ✅ Live | Receipt ID or mbreciept.cbe.com.et link (older FT receipts: + last 8 account digits) | No |
| Telebirr (Ethio Telecom) | `telebirr` | Mobile money | ✅ Live | Transaction number, or the receipt's Payment QR Code | Yes (Ethiopia only) |
| Bank of Abyssinia | `boa` | Bank | ✅ Live | Slip link, reference + last 5 digits of the account on the receipt, or the receipt QR | No |
| M-Pesa Ethiopia | `mpesa` | Mobile money | ✅ Live (beta) | Transaction number | Yes (Ethiopia only) |
| Dashen Bank | `dashen` | Bank | ✅ Live | FT Ref (16 characters) | No |
| Awash Bank | `awash` | Bank | ✅ Live | Share link from the SMS | No |
| Siinqee Bank | `siinqee` | Bank | ✅ Live | eBirr receipt link | No |
| eBirr | `ebirr` | Mobile money | ✅ Live | Receipt link (tenant/token) | No |
| ZamZam Bank | `zamzam` | Bank | ✅ Live (beta) | Receipt link (receipt.zamzambank.com.et/receipt/…) or its numeric id | No |

Every bank lists its receipt formats in `src/lib/manifest/banks.json`, current first. Older formats keep working (an older CBE receipt with only an FT reference still verifies with the last 8 digits of the receiving account; old Dashen Super App links are read for their FT Ref), but the UI, docs and SDKs lead with the current one. `GET /api/banks` returns each bank's `formats`, and [/endpoints](https://cheki.et/endpoints) shows them with a dated changelog.

### In research (22)

Zemen Bank and CBE Birr (parsers exist, waiting on a confirmed real receipt), Nib, Wegagen, Ahadu, KAAFI, Abay, Addis International, Amhara, Berhan, Bunna, Enat, Global Bank Ethiopia, Lion International, Oromia International, Hibret, Hijra, Shabelle, Goh Betoch, Tsedey, Gadaa, Rammis.

Want to help? See [contributing a new bank](#adding-a-bank) below or [open an issue](https://github.com/1RB/cheki/issues).

## SDKs

cheki ships SDKs in 5 languages. All wrap the same REST API and are tested against one shared set of response fixtures (`sdks/fixtures/api-contract.json`), which CI also checks against the route handlers.

What every SDK does the same way:

- **`verified` is the only success signal.** A 200 response can still be unverified: a BOA QR code the bank could not confirm comes back as `success: true, verified: false, decodedOnly: true`. Each SDK has a helper (`isVerified()`, `is_verified`, `IsVerified()`).
- **QR codes go in `qrData`:** a BOA inter-bank receipt QR (bank `boa`) or the Payment QR Code on a Telebirr receipt (bank `telebirr`). The server reads the reference out of the QR and checks it with the bank; a QR on its own never verifies.
- **Banks are identified by `id`** (`code` is kept as a deprecated alias).
- **Batch: at most 20 receipts**, checked before sending. The response has `results`, `total`, `verified`, `failed` and `cached`; `failed` includes decoded-only QR results.
- **Typed errors** for 429 (with the `Retry-After` seconds) and 413, and the server's `error` text and `fallbackUrl` (geo-blocked banks) on every API error.
- **Timeouts and retries:** each attempt waits up to 65 s (the server may take up to 60 s). A 4xx (other than 429) or a timeout is never retried. A network error, 5xx or 429 is retried at most once, after `Retry-After` when the server sends one (up to 60 s). The server itself makes at most 2 attempts per bank fetch, so one SDK call reaches a bank at most **4** times (a batch: 4 per receipt).
- **`getReceiptUrl`** builds `/api/receipt` links for CBE, Dashen, Zemen and ZamZam only, and rejects anything else. A CBE Receipt ID needs no account; an older CBE FT reference (legacy) needs the receiving account. `/api/receipt` redirects to the bank's own page for HTML receipts (CBE Receipt ID, Dashen) and returns the PDF for PDF ones.

| Language | Install | Package | Registry |
|----------|---------|---------|----------|
| **TypeScript** | `npm install cheki-verify` | [`cheki-verify`](https://www.npmjs.com/package/cheki-verify) | npm · [GitHub Packages](https://github.com/1RB/cheki/pkgs/npm/cheki-verify) |
| **Python** | `pip install cheki` | [`cheki`](https://pypi.org/project/cheki/) | PyPI |
| **Go** | `go get github.com/1RB/cheki/sdks/go` | `github.com/1RB/cheki/sdks/go` | [Go modules](https://pkg.go.dev/github.com/1RB/cheki/sdks/go) |
| **Dart** | git dependency (see [sdks/dart](sdks/dart/README.md)) | `cheki` | pub.dev (not published yet) |
| **PHP** | `composer require cheki/cheki` | [`cheki/cheki`](https://packagist.org/packages/cheki/cheki) | Packagist |

### TypeScript

```bash
npm install cheki-verify
```

```ts
import { Cheki, isVerified } from "cheki-verify";

const cheki = new Cheki();
const result = await cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01");
// Older FT-only CBE receipt (legacy): cheki.verify("cbe", "FT26140P01YB", { accountNumber: "1000560536171" })
if (isVerified(result)) console.log(result.amount, result.senderName);
```

Non-2xx responses throw `ChekiAPIError` (`ChekiRateLimitError` for 429, `ChekiPayloadTooLargeError` for 413). Call it from a server: the hosted API does not send CORS headers on these routes.

### Python

```bash
pip install cheki
```

```python
from cheki import ChekiClient

cheki = ChekiClient()
result = cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01")
    # Older receipt, FT reference only (legacy): cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")
print(result.is_verified, result.amount, result.sender_name)
```

`verify()` returns a result for API errors too: check `result.http_status`, `result.error`, and `result.is_rate_limited` / `result.retry_after`. Python 3.10+.

The old direct mode (`from cheki import verify`, which fetches banks from your machine) is **deprecated**: its parsers lack the server's verification gate and hardening. It now warns, rejects unsafe references, applies a fail-closed gate, and will be removed in the next major version. Self-host the server instead if you cannot use the hosted API.

### Go

```bash
go get github.com/1RB/cheki/sdks/go
```

```go
client := cheki.NewClient()
result, err := client.Verify(ctx, cheki.VerifyOptions{
    Bank:      "cbe",
    Reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01",
    // Older receipt, FT reference only (legacy): Reference: "FT26140P01YB", AccountNumber: "1000560536171"
})
if err == nil && result.IsVerified() {
    fmt.Println(result.Amount, result.SenderName)
}
// errors.Is(err, cheki.ErrRateLimited); errors.As(err, &apiErr) for StatusCode, Message, RetryAfter, FallbackURL
```

### Dart

```dart
final client = ChekiClient();
final result = await client.verify(
  bank: 'cbe',
  reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01',
);
print(result.isVerified);
client.close();
```

### PHP

```php
$client = new ChekiClient();
$result = $client->verify('cbe', 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01');
// Older receipt, FT reference only (legacy): $client->verify('cbe', 'FT26140P01YB', '1000560536171');
if ($result->isVerified()) {
    echo "$result->senderName sent $result->amount $result->currency";
} elseif ($result->isRateLimited()) {
    echo "retry in {$result->retryAfter} s";
}
```

## Quick start

### Web UI

Visit [cheki.et](https://cheki.et). No signup required.

### CLI

The CLI runs from a clone of this repo. Do not use `npx cheki`: the npm package named `cheki` is an unrelated project, and this repo's root package is private.

```bash
git clone https://github.com/1RB/cheki.git && cd cheki && npm install
npm run cli -- verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01
npm run cli -- verify cbe FT26140P01YB -a 1000560536171   # older FT receipt (legacy)
npm run cli -- verify telebirr CHQ0FJ403O
npm run cli -- health
```

Or use the Python CLI, which calls the hosted API: `pip install cheki`, then `cheki-verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01`.

### API

```bash
curl -X POST https://cheki.et/api/verify \
  -H "Content-Type: application/json" \
  -d '{"bank":"cbe","reference":"https://mbreciept.cbe.com.et/fHCxExampleRcpt01"}'
```

### Self-hosting

```bash
git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d
```

Self-hosting on an Ethiopian IP bypasses Telebirr/M-Pesa geo-blocks.

## Features

- **Web UI**: receipt aesthetic, auto-detect bank from reference format, Light / Dark / System theme
- **REST API**: free, no API key, per-IP rate limits (verify 30/min, batch 5/min, parse and ocr 20/min each, per instance; 429 with Retry-After), batch verification up to 20 receipts
- **CLI**: verify receipts from the terminal (`npm run cli -- verify ...` in a clone, or `cheki-verify` from `pip install cheki`)
- **5 SDKs**: TypeScript, Python, Go, Dart, PHP with typed errors and retry
- **9 live banks**: CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Siinqee, eBirr, ZamZam (M-Pesa and ZamZam in beta; Zemen and CBE Birr are in development)
- **Docker**: self-hosting with docker-compose
- **SEO**: bank-specific pages, task-grouped guides, sitemap with per-guide lastmod, structured data (Article, ItemList, FAQ, Breadcrumb)
- **AI-friendly**: `llms.txt`, allows all AI crawlers in `robots.txt`
- **122 tests**: full parser coverage with vitest

## How it works

Each Ethiopian bank publishes transaction receipts at public URLs:

1. **CBE**: Receipt ID from `https://mbreciept.cbe.com.et/{RECEIPT_ID}`, read through `https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{RECEIPT_ID}` → JSON. Legacy: `https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8_DIGITS}` → PDF (older receipts, host often unreachable)
2. **Telebirr**: `https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}` → HTML
3. **BOA**: `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{LAST_5_DIGITS}` → JSON
4. **M-Pesa**: `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}` → JSON envelope `{responseCode, responseDescription, base64Data}` whose `base64Data` is the receipt PDF (`pdf-in-json`). Geo-blocked and not probed: the shape is inferred from five other open-source verifiers, cheki's tests use a synthetic receipt, and M-Pesa is **beta** until a real receipt verifies
5. **Awash**: share link from Awash mobile app → HTML
6. **Dashen**: `https://receipts.dashenbanksc.com/receipt/{FT_REF}` → HTML (unknown refs: HTTP 400)
7. **Zemen** (in development): PDF receipt URL → PDF
8. **CBE Birr** (in development): reference + payer phone → PDF (inferred; a miss returns an HTML shell)
9. **Siinqee**: eBirr receipt URL → HTML (links.et reports a newer Siinqee host, receipts.siinqeebank.com:871, not supported yet)
10. **eBirr**: receipt URL → HTML (covers Nib, Wegagen, Ahadu, KAAFI)
11. **ZamZam** (beta): receipt id from `https://receipt.zamzambank.com.et/receipt/{RECEIPT_ID}`, read through `https://receipt-backend.zamzambank.com.et/api/v1/invoice/{RECEIPT_ID}` → JSON (`null` for an unknown id). That service expects an HTTP Basic credential hardcoded in ZamZam's own public receipt web app, the same precedent as BOA's public QR key; cheki sends it from the parser and never returns it. The record carries the full account number, which cheki masks (first digit and last 4) before any output or cache. Payer/receiver sides are inferred from its debit/credit flag.

cheki fetches these URLs, parses the response (PDF/HTML/JSON), and returns structured JSON.

## Project structure

```
src/
  app/
    page.tsx                # Homepage with verify widget
    banks/
      page.tsx              # Bank listing
      [code]/page.tsx       # Individual bank pages (SSG)
    verify/
      [slug]/page.tsx       # Per-bank verify pages (SSG)
    guides/
      page.tsx              # Guide index, grouped by task (server component)
      [slug]/page.tsx       # Individual guide pages (SSG)
    developers/page.tsx     # Developer/API page
    compare/page.tsx        # Comparison with check.et/verify.et
    docs/page.tsx           # API documentation
    api/
      verify/route.ts       # POST /api/verify
      verify/batch/route.ts # POST /api/verify/batch
      banks/route.ts        # GET /api/banks
      health/route.ts       # GET /api/health
      receipt/route.ts      # GET /api/receipt
      ocr/route.ts          # POST /api/ocr (image receipt parsing)
      parse/route.ts        # POST /api/parse
    sitemap.ts              # Dynamic sitemap
    robots.ts               # robots.txt (allows AI crawlers)
    manifest.ts             # Web manifest
  cli/
    index.ts                # CLI entry point (npm run cli)
  lib/
    banks.ts                # Bank data and reference detection
    guides.ts               # Guide articles data (content blocks, updated dates)
    guides-index.ts         # /guides grouping and order
    guides-seo.ts           # Article / ItemList JSON-LD and guide metadata
    guides-facts.ts         # Competitor facts and rate-limit copy used by the guides
    ease.ts                 # Custom easing functions
    highlight.ts            # Syntax highlighting
    verify/
      verdict.ts            # presentVerdict(): the one place a result gets a colour
      detect.ts             # Live input detection (link, reference, BOA QR, Telebirr QR)
      history.ts            # Recent checks: verified only, no names
      client.ts             # /api/verify and /api/parse calls (429/413/offline)
      summary.ts            # Copy/share text
    core/
      types.ts              # ParserPort interface, ParsedReceipt, Receipt types
      verifier.ts           # Bank-agnostic verifier
    parsers/
      base.ts               # BaseParser abstract class
      registry.ts           # registerParser(), getParser(), isBankSupported()
      index.ts              # Auto-registers all parsers
      cbe.ts                # One file per bank
      telebirr.ts
      boa.ts
      mpesa.ts
      dashen.ts
      awash.ts
      zemen.ts
      cbebirr.ts
      siinqee.ts
      ebirr.ts
    manifest/
      banks.json            # Bank metadata: endpoint, type, status, requirements
    adapters/
      url-detector.ts       # Auto-detect bank from receipt URL
  components/
    Chrome.tsx              # Nav (modal mobile menu) and Footer
    HomePage.tsx            # Homepage (server component)
    BankLogo.tsx            # Bank logo/initials component
    CodeBlock.tsx           # Syntax-highlighted code blocks
    ContributeBox.tsx       # "Help us add <bank>" box for banks not live yet
    Icon.tsx                # Icon component
    StatusDot.tsx           # Bank status: an 8px dot and a word
    RelativeTime.tsx        # "11 Oct 2026, 14:32 · 3 hours ago" (shared minute clock)
    segmented-control.tsx   # Shared radiogroup segmented control (theme + language)
    language-switcher.tsx   # English / አማርኛ (header + menu)
    theme-control.tsx       # Light / Dark / System (header + menu)
    verify/
      VerifyPanel.tsx       # The receipt checker (homepage; locked to one bank on /banks/[code])
      VerifyInput.tsx       # One smart input with live bank detection
      VerdictCard.tsx       # The verdict; colours come only from presentVerdict()
      VerdictSkeleton.tsx   # Placeholder the verdict lands in (no layout shift)
      RecentChecks.tsx      # Bank-confirmed checks on this device, no names
      GeoFallback.tsx       # Telebirr / M-Pesa: open in your browser, paste back (lazy)
      CameraScanner.tsx     # QR camera (lazy)
      BatchPanel.tsx        # Several screenshots at once (lazy)
    home/                   # Homepage pieces (agent prompt, client text)
    docs/
      DocsSidebar.tsx       # Docs navigation sidebar
      DocsTabs.tsx          # Docs tab navigation
    motion/
      bouncy-accordion.tsx  # Accordion with spring physics
      command-palette.tsx   # Cmd+K command palette (lazy)
      glitch-404.tsx        # Glitch effect 404
sdks/
  fixtures/                 # Shared API contract fixtures every SDK test decodes
  typescript/               # TypeScript SDK (npm: cheki-verify, GH Packages: @1rb/cheki-verify)
  go/                       # Go SDK (go get)
  dart/                     # Dart SDK (not on pub.dev yet)
  php/                      # PHP SDK (Packagist)
python/                     # Python SDK (PyPI: cheki)
Dockerfile
docker-compose.yml
public/llms.txt             # LLM-friendly content summary
scripts/
  bump-version.sh           # Bump version across all packages + tag + push
  sync-package-metadata.sh  # Check package metadata sync
  pre-commit-version-check.sh  # Pre-commit hook for version alignment
```

## Adding a bank

cheki uses a hexagonal architecture: each bank has a **parser** (adapter) that knows how to fetch and parse that bank's receipt format. The verifier (core) is bank-agnostic and dispatches based on the bank code.

### Architecture

```
src/lib/
  core/types.ts          # ParserPort interface, ParsedReceipt, Receipt types
  core/verifier.ts       # Bank-agnostic verifier
  parsers/
    base.ts              # BaseParser abstract class
    registry.ts          # registerParser(), getParser(), isBankSupported()
    index.ts             # Auto-registers all parsers (import to activate)
    cbe.ts               # One file per bank
    dashen.ts
    ...
  manifest/
    banks.json           # Bank metadata: endpoint, type, status, requirements
  banks.ts               # Bank detection from reference format, UI metadata
```

### Step-by-step

1. **Fork and branch**

```bash
git clone https://github.com/1RB/cheki.git
cd cheki
git checkout -b feature/add-awash
```

2. **Create the parser**

Create `src/lib/parsers/awash.ts`. Extend `BaseParser` and implement the abstract properties and methods:

```ts
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class AwashParser extends BaseParser {
  readonly bankId = "awash";
  readonly bankName = "Awash Bank";
  readonly responseType = "html" as const;  // "pdf" | "html" | "json"
  readonly requiresAccount = false;
  readonly accountDigits = undefined;
  readonly requiresPhone = false;

  buildUrl(ref: string, account?: string, phone?: string): string {
    return `https://awashpay.awashbank.com:8225/-${ref}`;
  }

  parse(data: string | Buffer, contentType: string): ParsedReceipt {
    // For JSON responses: parse and extract fields
    // For HTML responses: regex/slice the receipt fields
    // For PDF responses: return { verified: false } and implement
    //   a static parsePdfText() method (verifier handles PDF extraction)
    // ...
  }
}
```

The `ParsedReceipt` type supports these fields (all optional except `verified`):

| Field | Type | Description |
|-------|------|-------------|
| `verified` | `boolean` | Whether the receipt was found and parsed |
| `senderName` | `string` | Sender's full name |
| `senderAccount` | `string` | Sender's account number |
| `receiverName` | `string` | Receiver's full name |
| `receiverAccount` | `string` | Receiver's account number |
| `amount` | `number` | Transfer amount |
| `currency` | `string` | Currency code (usually `"ETB"`) |
| `date` | `string` | Transaction date |
| `reference` | `string` | Transaction reference |
| `branch` | `string` | Bank branch |
| `reason` | `string` | Failure reason if not verified |
| `invoiceNumber` | `string` | Invoice number (Telebirr/wallets) |
| `transactionStatus` | `string` | Status string from the bank |
| `settledAmount` | `number` | Settled amount (may differ from amount) |
| `stampDuty` | `number` | Stamp duty fee |
| `serviceFee` | `number` | Service charge |
| `serviceFeeVat` | `number` | VAT on service charge |
| `totalPaid` | `number` | Total amount paid including fees |
| `amountInWords` | `string` | Amount written in words |
| `paymentMode` | `string` | Payment mode (e.g. `"account-transfer"`) |
| `paymentChannel` | `string` | Channel (e.g. `"mobile-banking"`) |

3. **Register the parser**

Add an import and `registerParser()` call in `src/lib/parsers/index.ts`:

```ts
import { AwashParser } from "./awash";
// ...
registerParser(new AwashParser());
```

4. **Add bank metadata**

Add an entry to `src/lib/manifest/banks.json`:

```json
{
  "id": "awash",
  "name": "Awash Bank",
  "swift": "AWAUETAA",
  "type": "bank",
  "status": "live",
  "parser": "awash",
  "responseType": "html",
  "requiresAccount": false,
  "requiresPhone": false,
  "endpoint": "https://awashpay.awashbank.com:8225/-{ref}",
  "sslVerify": true,
  "color": "#E63946",
  "initials": "AW",
  "notes": "Receives share link from Awash mobile app."
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Lowercase bank code used in API calls |
| `name` | yes | Full bank name |
| `swift` | no | SWIFT/BIC code |
| `type` | yes | `"bank"`, `"wallet"`, or `"mobile"` |
| `status` | yes | `"live"` or `"in-development"` |
| `parser` | yes | Must match the parser's `bankId` |
| `responseType` | yes | `"pdf"`, `"html"`, or `"json"` |
| `requiresAccount` | yes | Whether verification needs an account number |
| `accountDigits` | no | How many digits are needed (e.g. CBE needs 8) |
| `requiresPhone` | yes | Whether verification needs a phone number |
| `endpoint` | yes | URL template. Use `{ref}`, `{account}`, `{phone}` placeholders |
| `sslVerify` | yes | Set to `false` for banks with self-signed certs (e.g. CBE) |
| `headers` | no | Custom headers required by the bank's API |
| `color` | yes | Brand color for UI (hex) |
| `initials` | yes | Short initials for UI badges |
| `notes` | no | Integration notes, geo-blocking warnings, etc. |

5. **Add bank detection (optional)**

If the bank has a recognizable reference format, add a pattern to `src/lib/banks.ts` so cheki can auto-detect the bank from the reference alone:

```ts
{
  id: "awash",
  pattern: /^AW\d{10,}$/i,
  // ...
}
```

6. **Test with a real receipt**

```bash
# Run the test suite
npm test

# Test against the live API
curl -X POST http://localhost:3000/api/verify \
  -H "Content-Type: application/json" \
  -d '{"bank":"awash","reference":"YOUR_REAL_REFERENCE"}'
```

If the bank is geo-blocked, test from an Ethiopian IP or a self-hosted instance.

7. **Submit a PR**

Include the reference number you tested with (or note that you tested from an Ethiopian IP if geo-blocked).

### Response type notes

- **JSON** banks (BOA): parse the JSON body in `parse()`, extract fields with standard property access
- **PDF-in-JSON** (M-Pesa): the JSON body is an envelope whose field holds a base64 PDF. Validate the base64, cap the decoded size at `MAX_PDF_BYTES`, then extract text like a PDF bank (see `MpesaParser.parseEnvelope`)
- **HTML** banks (Telebirr, Awash, Dashen, CBE Birr, Siinqee, eBirr): fetch returns HTML, extract fields with regex or string slicing. Use `cheerio` if needed
- **PDF** banks (CBE, Zemen; Dashen for legacy PDFs only): `parse()` should return `{ verified: false }` since PDF text extraction is async. Implement a `static parsePdfText(text: string): ParsedReceipt` method instead. The verifier calls `unpdf` to extract text, then calls your parser's `parsePdfText`

### Need help?

- [Contribution guide](https://cheki.et/guides/contribute-new-bank): three ways to contribute without writing code
- [Open an issue](https://github.com/1RB/cheki/issues) with a receipt screenshot or reference and we'll help reverse-engineer the endpoint
- Share a receipt reference and bank name, and we'll write the parser for you

## Releasing

Deploying the site is separate from versioning: only `main` deploys to cheki.et. The deploy checklist, the smoke test (`npm run smoke -- <base-url>`) and rollback steps are in [docs/RELEASING.md](docs/RELEASING.md).

Version bumps are automated. All package versions (web, TypeScript SDK, Python SDK, Dart SDK, PHP SDK) stay in sync.

```bash
# Bump to a new version: updates all packages, commits, tags, and pushes
./scripts/bump-version.sh 1.4.2
```

This triggers the publish workflow which publishes to npm, GitHub Packages, PyPI, and Packagist simultaneously.

## Contributing

Contributions are welcome. See [CONTRIBUTING](https://cheki.et/guides/contribute-new-bank) for the full guide.

- **Add a bank**: follow the [step-by-step guide](#adding-a-bank) above, or [open an issue](https://github.com/1RB/cheki/issues) with a receipt reference and we'll write the parser
- **Report a bug**: [open an issue](https://github.com/1RB/cheki/issues) with the bank, reference number, and what you expected vs what happened
- **Improve docs**: PRs welcome for guides, API docs, or SDK README improvements
- **Spread the word**: star the repo, share cheki.et, tell anyone paying for receipt verification

### Contributors

[![Contributors](https://img.shields.io/github/contributors/1RB/cheki?style=flat&logo=github&color=2ddb6a)](https://github.com/1RB/cheki/graphs/contributors)

## Stargazers

[![Stargazers](https://img.shields.io/github/stars/1RB/cheki?style=social)](https://github.com/1RB/cheki/stargazers)

## License

MIT

## Disclaimer

cheki is not affiliated with any Ethiopian bank or wallet. It uses publicly accessible receipt endpoints. All data comes from official bank systems.
