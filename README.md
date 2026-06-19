# cheki

**Free, open-source Ethiopian bank receipt verification. No signup. No API key. No scam.**

cheki verifies Ethiopian bank and mobile money receipts by fetching public bank endpoints. The data is free. The code is MIT licensed. No one should charge you for accessing public bank data.

## Why?

check.et charges 499 ETB/month. verify.et charges $20-40/month. Both verify receipts by hitting the same public bank URLs cheki uses for free. cheki exposes this and provides the same service for free, forever.

## Supported banks

| Bank | Code | Status | Requires account | Geo-blocked |
|------|------|--------|-----------------|-------------|
| Commercial Bank of Ethiopia | `cbe` | Live | Yes (last 8 digits) | No |
| Telebirr (Ethio Telecom) | `telebirr` | Live | No | Yes (Ethiopia only) |
| Bank of Abyssinia | `boa` | Live | Yes (last 5 digits) | No |
| M-Pesa Ethiopia | `mpesa` | Live | No | Yes (Ethiopia only) |
| Dashen Bank | `dashen` | Live | No | No |
| Awash Bank | `awash` | In development | No | No |
| Zemen Bank | `zemen` | Live | No | No |
| CBE Birr | `cbebirr` | Live | Phone required | No |
| Siinqee Bank | `siinqee` | Live | No | No |

## SDKs

cheki ships SDKs in 5 languages. All wrap the same REST API with idiomatic patterns, typed errors, retry with exponential backoff, and timeout support.

| Language | Install | Package | Registry |
|----------|---------|---------|----------|
| **TypeScript** | `npm install cheki-verify` | `cheki-verify` | [npm](https://www.npmjs.com/package/cheki-verify) |
| **Python** | `pip install cheki` | `cheki` | [PyPI](https://pypi.org/project/cheki/) |
| **Go** | `go get github.com/1RB/cheki/sdks/go` | `github.com/1RB/cheki/sdks/go` | [Go modules](https://pkg.go.dev/github.com/1RB/cheki/sdks/go) |
| **Dart** | `dart pub add cheki` | `cheki` | [pub.dev](https://pub.dev) |
| **PHP** | `composer require cheki/cheki` | `cheki/cheki` | [Packagist](https://packagist.org/packages/cheki/cheki) |

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

Visit https://chekiapp.vercel.app. No signup required.

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

- **Web UI**: receipt aesthetic, auto-detect bank from reference format
- **REST API**: free, no API key, no rate limit
- **Batch verification**: up to 50 receipts at once
- **5 SDKs**: TypeScript, Python, Go, Dart, PHP
- **Docker**: self-hosting with docker-compose
- **SEO**: bank-specific pages, guides, sitemap, structured data
- **AI-friendly**: llms.txt, allows all AI crawlers in robots.txt

## How it works

Each Ethiopian bank publishes transaction receipts at public URLs:

1. **CBE**: `https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8_DIGITS}` → PDF
2. **Telebirr**: `https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}` → HTML
3. **BOA**: `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{LAST_5_DIGITS}` → JSON
4. **M-Pesa**: `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}` → JSON

cheki fetches these URLs, parses the response, and returns structured JSON.

## Project structure

```
src/
  app/
    page.tsx              # Homepage with verify widget
    banks/
      page.tsx            # Bank listing
      [code]/page.tsx     # Individual bank pages (SSG)
    guides/
      page.tsx            # Guide listing
      [slug]/page.tsx     # Individual guide pages (SSG)
    developers/page.tsx   # Developer/API page
    compare/page.tsx      # Comparison with check.et/verify.et
    docs/page.tsx         # API documentation
    api/
      verify/route.ts     # POST /api/verify
      verify/batch/route.ts # POST /api/verify/batch
      banks/route.ts      # GET /api/banks
      health/route.ts     # GET /api/health
      receipt/route.ts    # GET /api/receipt
    sitemap.ts            # Dynamic sitemap
    robots.ts             # robots.txt (allows AI crawlers)
  lib/
    banks.ts              # Bank data and detection
    guides.ts             # Guide articles data
  components/
    Chrome.tsx            # Nav and Footer
sdks/
  typescript/             # TypeScript SDK (npm: cheki-verify)
  go/                     # Go SDK (go get)
  dart/                   # Dart SDK (pub.dev)
  php/                    # PHP SDK (Packagist)
python/                   # Python SDK (PyPI: cheki)
Dockerfile
docker-compose.yml
public/llms.txt           # LLM-friendly content summary
```

## Adding a bank

cheki uses a hexagonal architecture: each bank has a **parser** (adapter) that knows how to fetch and parse that bank's receipt format. The verifier (core) is bank-agnostic and dispatches based on the bank code.

### Architecture

```
src/lib/
  core/types.ts          # ParserPort interface, ParsedReceipt, Receipt types
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
  readonly responseType = "pdf" as const;  // "pdf" | "html" | "json"
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
  "responseType": "pdf",
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
| `type` | yes | `"bank"` or `"wallet"` |
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

- **JSON** banks (BOA, M-Pesa, CBE new): parse the JSON body in `parse()`, extract fields with standard property access
- **HTML** banks (Telebirr): fetch returns HTML, extract fields with regex or string slicing. Use `unpdf` or `cheerio` if needed
- **PDF** banks (CBE, Dashen, Zemen): `parse()` should return `{ verified: false }` since PDF text extraction is async. Implement a `static parsePdfText(text: string): ParsedReceipt` method instead. The verifier calls `unpdf` to extract text, then calls your parser's `parsePdfText`

### Need help?

- [Contribution guide](https://chekiapp.vercel.app/guides/contribute-new-bank): three ways to contribute without writing code
- [Open an issue](https://github.com/1RB/cheki/issues) with a receipt screenshot or reference and we'll help reverse-engineer the endpoint
- Share a receipt reference and bank name, and we'll write the parser for you

## License

MIT

## Disclaimer

cheki is not affiliated with any Ethiopian bank or wallet. It uses publicly accessible receipt endpoints. All data comes from official bank systems.
