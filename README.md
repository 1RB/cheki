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
[![Banks](https://img.shields.io/badge/banks-10%20live%20%E2%80%A2%2021%20researching-2ddb6a?style=flat)](https://chekiapp.vercel.app/banks)
[![Website](https://img.shields.io/website?style=flat&label=chekiapp.vercel.app&url=https%3A%2F%2Fchekiapp.vercel.app&logo=vercel&logoColor=fff)](https://chekiapp.vercel.app)

cheki verifies Ethiopian bank and mobile money receipts by fetching public bank endpoints. The data is free. The code is MIT licensed. No one should charge you for accessing public bank data.

## Why?

check.et charges 499 ETB/month. verify.et charges $20-40/month. Both verify receipts by hitting the same public bank URLs cheki uses for free. cheki exposes this and provides the same service for free, forever.

## Supported banks

**10 live banks** · 21 in research

| Bank | Code | Type | Status | Requires account | Geo-blocked |
|------|------|------|--------|------------------|-------------|
| Commercial Bank of Ethiopia | `cbe` | Bank | ✅ Live | Yes (last 8 digits) | No |
| Telebirr (Ethio Telecom) | `telebirr` | Mobile money | ✅ Live | No | Yes (Ethiopia only) |
| Bank of Abyssinia | `boa` | Bank | ✅ Live | Yes (last 5 digits) | No |
| M-Pesa Ethiopia | `mpesa` | Mobile money | ✅ Live | No | Yes (Ethiopia only) |
| Dashen Bank | `dashen` | Bank | ✅ Live | No | No |
| Awash Bank | `awash` | Bank | ✅ Live | No | No |
| Zemen Bank | `zemen` | Bank | ✅ Live | No | No |
| CBE Birr | `cbebirr` | Wallet | ✅ Live | Phone required | No |
| Siinqee Bank | `siinqee` | Bank | ✅ Live | No | No |
| eBirr | `ebirr` | Mobile money | ✅ Live | No | No |

### In research (21)

Nib, Wegagen, Ahadu, KAAFI, Abay, Addis International, Amhara, Berhan, Bunna, Enat, Global Bank Ethiopia, Lion International, Oromia International, Hibret, ZamZam, Hijra, Shabelle, Goh Betoch, Tsedey, Gadaa, Rammis.

Want to help? See [contributing a new bank](#adding-a-bank) below or [open an issue](https://github.com/1RB/cheki/issues).

## SDKs

cheki ships SDKs in 5 languages. All wrap the same REST API with idiomatic patterns, typed errors, retry with exponential backoff, and timeout support.

| Language | Install | Package | Registry |
|----------|---------|---------|----------|
| **TypeScript** | `npm install cheki-verify` | [`cheki-verify`](https://www.npmjs.com/package/cheki-verify) | npm · [GitHub Packages](https://github.com/1RB/cheki/pkgs/npm/cheki-verify) |
| **Python** | `pip install cheki` | [`cheki`](https://pypi.org/project/cheki/) | PyPI |
| **Go** | `go get github.com/1RB/cheki/sdks/go` | `github.com/1RB/cheki/sdks/go` | [Go modules](https://pkg.go.dev/github.com/1RB/cheki/sdks/go) |
| **Dart** | *Coming soon* | `cheki` | pub.dev (pending) |
| **PHP** | `composer require cheki/cheki` | [`cheki/cheki`](https://packagist.org/packages/cheki/cheki) | Packagist |

### TypeScript

```bash
npm install cheki-verify
```

```ts
import { Cheki } from "cheki-verify";

const cheki = new Cheki();
const result = await cheki.verify("cbe", "FT26140P01YB", {
  accountNumber: "1000560536171",
});
console.log(result.verified, result.amount, result.senderName);
```

### Python

```bash
pip install cheki
```

```python
from cheki import ChekiClient

cheki = ChekiClient()
result = cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")
print(result.is_verified, result.amount, result.sender_name)
```

Also includes direct verification (no API server needed):

```python
from cheki import verify

result = verify("cbe", "FT26140P01YB", account_number="1000560536171")
```

### Go

```bash
go get github.com/1RB/cheki/sdks/go
```

```go
client := cheki.NewClient()
result, err := client.Verify(ctx, cheki.VerifyOptions{
    Bank:      "cbe",
    Reference: "FT26140P01YB",
    AccountNumber: "1000560536171",
})
```

### Dart

```dart
final client = ChekiClient();
final result = await client.verify(
  bank: 'cbe',
  reference: 'FT26140P01YB',
  accountNumber: '1000560536171',
);
client.close();
```

### PHP

```php
$client = new ChekiClient();
$result = $client->verify('cbe', 'FT26140P01YB', '1000560536171');
if ($result->isVerified()) {
    echo "$result->senderName sent $result->amount $result->currency";
}
```

## Quick start

### Web UI

Visit [chekiapp.vercel.app](https://chekiapp.vercel.app). No signup required.

### CLI

```bash
npx cheki verify cbe FT26140P01YB --account 1000560536171
```

### API

```bash
curl -X POST https://chekiapp.vercel.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'
```

### Self-hosting

```bash
git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d
```

Self-hosting on an Ethiopian IP bypasses Telebirr/M-Pesa geo-blocks.

## Features

- **Web UI**: receipt aesthetic, auto-detect bank from reference format, dark mode
- **REST API**: free, no API key, no rate limit, batch verification up to 50 receipts
- **CLI**: verify receipts from the terminal (`npx cheki verify`)
- **5 SDKs**: TypeScript, Python, Go, Dart, PHP — all with typed errors and retry
- **10 live banks**: CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee, eBirr
- **Docker**: self-hosting with docker-compose
- **SEO**: bank-specific pages, guides, sitemap, structured data
- **AI-friendly**: `llms.txt`, allows all AI crawlers in `robots.txt`
- **122 tests**: full parser coverage with vitest

## How it works

Each Ethiopian bank publishes transaction receipts at public URLs:

1. **CBE**: `https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8_DIGITS}` → PDF
2. **Telebirr**: `https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}` → HTML
3. **BOA**: `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{LAST_5_DIGITS}` → JSON
4. **M-Pesa**: `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}` → JSON
5. **Awash**: share link from Awash mobile app → HTML
6. **Dashen**: PDF receipt URL → PDF
7. **Zemen**: PDF receipt URL → PDF
8. **CBE Birr**: phone + reference → HTML
9. **Siinqee**: receipt URL → HTML
10. **eBirr**: receipt URL → HTML (covers Nib, Wegagen, Ahadu, KAAFI)

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
      page.tsx              # Guide listing
      [slug]/page.tsx       # Individual guide pages (SSG)
    developers/page.tsx     # Developer/API page
    compare/page.tsx        # Comparison with check.et/verify.et
    docs/page.tsx           # API documentation
    api/
      verify/route.ts       # POST /api/verify
      verify/batch/route.ts # POST /api/verify/batch
      verify-geo/route.ts   # POST /api/verify-geo (geo-aware)
      banks/route.ts        # GET /api/banks
      health/route.ts       # GET /api/health
      receipt/route.ts      # GET /api/receipt
      ocr/route.ts          # POST /api/ocr (image receipt parsing)
      parse/route.ts        # POST /api/parse
    sitemap.ts              # Dynamic sitemap
    robots.ts               # robots.txt (allows AI crawlers)
    manifest.ts             # Web manifest
  cli/
    index.ts                # CLI entry point (npx cheki)
  lib/
    banks.ts                # Bank data and reference detection
    guides.ts               # Guide articles data
    ease.ts                 # Custom easing functions
    highlight.ts            # Syntax highlighting
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
    Chrome.tsx              # Nav and Footer
    BankSelector.tsx        # Bank dropdown selector
    BankLogo.tsx            # Bank logo/initials component
    CodeBlock.tsx           # Syntax-highlighted code blocks
    Icon.tsx                # Icon component
    language-switcher.tsx   # i18n language switcher
    docs/
      DocsSidebar.tsx       # Docs navigation sidebar
      DocsTabs.tsx          # Docs tab navigation
    motion/
      animated-badge.tsx    # Spring-animated badge
      bouncy-accordion.tsx  # Accordion with spring physics
      command-palette.tsx   # Cmd+K command palette
      glitch-404.tsx        # Glitch effect 404
      magnetic-button.tsx   # Cursor-pull magnetic button (beUI)
      not-found-404.tsx     # 404 page component
      number-ticker.tsx     # Animated number counter
      stateful-button.tsx   # Multi-state button
      swipeable-list.tsx    # Swipe-to-delete mobile list
      tabs.tsx              # Animated underline tabs
      theme-toggle.tsx      # Dark/light toggle (bare icon)
      tilt-card.tsx         # 3D tilt card
      toast-stack.tsx       # Toast notifications
sdks/
  typescript/               # TypeScript SDK (npm: cheki-verify, GH Packages: @1RB/cheki-verify)
  go/                       # Go SDK (go get)
  dart/                     # Dart SDK (pub.dev)
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

- **JSON** banks (BOA, M-Pesa): parse the JSON body in `parse()`, extract fields with standard property access
- **HTML** banks (Telebirr, Awash, CBE Birr, Siinqee, eBirr): fetch returns HTML, extract fields with regex or string slicing. Use `cheerio` if needed
- **PDF** banks (CBE, Dashen, Zemen): `parse()` should return `{ verified: false }` since PDF text extraction is async. Implement a `static parsePdfText(text: string): ParsedReceipt` method instead. The verifier calls `unpdf` to extract text, then calls your parser's `parsePdfText`

### Need help?

- [Contribution guide](https://chekiapp.vercel.app/guides/contribute-new-bank): three ways to contribute without writing code
- [Open an issue](https://github.com/1RB/cheki/issues) with a receipt screenshot or reference and we'll help reverse-engineer the endpoint
- Share a receipt reference and bank name, and we'll write the parser for you

## Releasing

Version bumps are automated. All package versions (web, TypeScript SDK, Python SDK, Dart SDK, PHP SDK) stay in sync.

```bash
# Bump to a new version — updates all packages, commits, tags, and pushes
./scripts/bump-version.sh 1.4.2
```

This triggers the publish workflow which publishes to npm, GitHub Packages, PyPI, and Packagist simultaneously.

## Contributing

Contributions are welcome. See [CONTRIBUTING](https://chekiapp.vercel.app/guides/contribute-new-bank) for the full guide.

- **Add a bank**: follow the [step-by-step guide](#adding-a-bank) above, or [open an issue](https://github.com/1RB/cheki/issues) with a receipt reference and we'll write the parser
- **Report a bug**: [open an issue](https://github.com/1RB/cheki/issues) with the bank, reference number, and what you expected vs what happened
- **Improve docs**: PRs welcome for guides, API docs, or SDK README improvements
- **Spread the word**: star the repo, share chekiapp.vercel.app, tell anyone paying for receipt verification

### Contributors

[![Contributors](https://img.shields.io/github/contributors/1RB/cheki?style=flat&logo=github&color=2ddb6a)](https://github.com/1RB/cheki/graphs/contributors)

## Stargazers

[![Stargazers](https://img.shields.io/github/stars/1RB/cheki?style=social)](https://github.com/1RB/cheki/stargazers)

## License

MIT

## Disclaimer

cheki is not affiliated with any Ethiopian bank or wallet. It uses publicly accessible receipt endpoints. All data comes from official bank systems.
