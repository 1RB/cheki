# Contributing to cheki

Thanks for helping build the best Ethiopian receipt verification tool. Here's everything you need to get started.

## Quick setup

```bash
git clone https://github.com/1RB/cheki
cd cheki
npm install
npm test        # all tests should pass
npm run dev     # start dev server at localhost:3000
```

## Architecture (60-second overview)

```
src/lib/manifest/banks.json    ← the moat. one entry per bank: id, endpoint, parser, ssl
       ↓
src/lib/manifest/loader.ts     ← loads JSON, provides typed access, fuzzy bank suggestions
       ↓
src/lib/core/types.ts          ← Result<T,E>, Receipt, ChekiError, ParserPort (interfaces)
src/lib/core/verifier.ts       ← Verifier orchestrator (pure logic, no I/O)
       ↓
src/lib/parsers/               ← one file per bank. each extends BaseParser
  base.ts                        shared HTTP client with retries, geo-block handling
  cbe.ts                         CBE PDF + new JSON API
  telebirr.ts                    Telebirr HTML
  boa.ts                         BOA JSON
  mpesa.ts                       M-Pesa JSON envelope with a base64 PDF (pdf-in-json, beta)
  registry.ts                    plugin registry (register/get/isSupported)
  index.ts                       auto-registers all parsers
       ↓
src/lib/adapters/
  url-detector.ts                detects bank + reference from receipt URLs
       ↓
src/app/api/verify/route.ts   ← thin handler: parse body → verifier.verify() → respond
src/cli/index.ts              ← CLI: cheki verify <bank> <ref>
```

**Key insight:** `banks.json` is the single source of truth. When a bank rotates its URL, patch the JSON. No code change needed.

## Design principles

### Result types, not exceptions

cheki uses discriminated union Result types (inspired by Matt Pocock / Total TypeScript) instead of throwing exceptions:

```typescript
type Result<T, E = ChekiError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

This forces callers to handle errors and makes the error surface visible in types.

### Hexagonal architecture (ports & adapters)

- **Core** (`lib/core/`): domain types, Receipt entity, Verifier. Zero runtime dependencies.
- **Parsers** (`lib/parsers/`): implement `ParserPort` interface. Each bank is a plugin.
- **Adapters** (`lib/adapters/`): URL detection, input normalization.
- **Driving adapters**: API routes and CLI call the Verifier.

Dependencies always point inward. Core depends on nothing. Parsers depend on core. API routes depend on core + parsers.

### Error hierarchy (discriminated unions)

```typescript
type ChekiError =
  | { kind: "BANK_NOT_SUPPORTED"; bank: string; suggestion?: string }
  | { kind: "REF_ERROR"; bank: string; message: string }
  | { kind: "ENDPOINT_ERROR"; bank: string; message: string; fallbackUrl?: string }
  | { kind: "EXTRACTION_ERROR"; bank: string; message: string }
  | { kind: "MISSING_INPUT"; field: string; message: string }
  | { kind: "INTERNAL_ERROR"; message: string };
```

Each error maps to a specific HTTP status code. Exhaustive switch checking catches all cases at compile time.

## Adding a new bank

See [Adding or fixing a bank](#adding-or-fixing-a-bank) below for the full checklist: probe, manifest entry, parser, redacted fixture, test, and flipping the bank to live.

## Adding or fixing a bank

Most bank work is one of three jobs: a new bank, a bank that moved its endpoint, or a parser that misreads a receipt. All three follow the same steps. The [endpoint reference](https://cheki.et/endpoints) shows what we already know about every bank, and the [status page](https://cheki.et/status) shows which endpoints changed shape.

### Never commit an unredacted receipt

A receipt link is a bearer token: anyone who opens it sees the payment, the names and the accounts. So:

- Never paste a full receipt link, QR content, name, phone number or account number in an issue, PR, commit or test.
- Use the [bank request form](https://github.com/1RB/cheki/issues/new?template=bank-request.yml) with the host and a redacted pattern (`share.zemenbank.com/rt/XXXXXXXXXXXXXXXXXXXXXXXX/pdf`).
- To share a real link with the maintainers, use the private "Help us add" box on the bank's page at cheki.et. It goes to a private chat, is used only to build the parser, and is deleted afterwards.
- Fixtures in `tests/fixtures/` must be redacted before they are committed (see below). Reviewers will close PRs that contain real receipt data.

### 1. Probe your own receipt locally

`npm run probe` runs the same URL detector, parsers and Verifier as cheki.et, on your machine. Nothing is sent anywhere except to the bank itself.

```bash
npm run probe -- "https://receipts.dashenbanksc.com/receipt/B22WDTI2619100WH"
npm run probe -- dashen B22WDTI2619100WH
npm run probe -- cbe FT26140P01YB 60536171          # third argument: account or phone
npm run probe -- cbebirr CHK0000001 --phone 2519XXXXXXXX
npm run probe -- <link> --raw                       # also print the first 2,000 characters of the body
npm run probe -- <link> --redact                    # mask names, accounts and phones before you share output
```

It prints what the detector made of the link, the request URL, the raw response metadata (HTTP status, content type, size, whether it is a PDF), the parser result, and the full Verifier result for live banks. If you open an issue, paste only `--redact` output.

### 2. The manifest entry

Every bank is one entry in `src/lib/manifest/banks.json`. That file is the single source of truth: the verifier, the bank pages, `/endpoints` and the health check all read it.

```json
{
  "id": "yourbank",
  "name": "Your Bank",
  "shortName": "YourBank",
  "type": "bank",
  "status": "in-development",
  "parser": "yourbank",
  "responseType": "html",
  "requiresAccount": false,
  "requiresPhone": false,
  "endpoint": "https://receipt.yourbank.com/receipt/{ref}",
  "endpointFormat": "https://receipt.yourbank.com/receipt/{REFERENCE}",
  "sslVerify": true,
  "geoBlocked": false,
  "color": "#0A5C36",
  "initials": "YB",
  "notes": "What a fake reference returns, and when you checked.",
  "referenceFormat": "Where the reference is on the receipt, its length and pattern",
  "referenceExample": "YB12345678"
}
```

A bank that has more than one way to look a receipt up also lists them in `formats`, **current first**, plus a dated `endpointHistory`. The verifier picks a format from the shape of the input alone (`refPattern` and the fields supplied, see `src/lib/manifest/formats.ts`), so a receipt costs exactly one bank request; there is no "try the new host, then the old one" cascade. The host allowlist, `GET /api/banks`, `GET /api/receipt`, the checker field and the bank page all read `formats`:

```json
"formats": [
  {
    "id": "yourbank-share-link",
    "status": "current",
    "label": "Receipt link",
    "parser": "yourbank",
    "endpoint": "https://receipt.yourbank.com/r/{ref}",
    "link": "https://receipt.yourbank.com/r/{ref}",
    "linkHosts": ["receipt.yourbank.com"],
    "inputs": [{ "name": "reference", "label": "Receipt ID", "example": "AB12CD34EF" }],
    "refPattern": { "source": "^[A-Za-z0-9]{10}$", "flags": "" },
    "responseType": "html",
    "receiptPage": "redirect",
    "since": "2026-10",
    "confidence": "verified",
    "evidence": "What cheki observed, where and when (or the outside source, with confidence inferred)."
  }
],
"endpointHistory": [
  { "date": "2026-10-11", "formatId": "yourbank-share-link", "change": "What changed.", "source": "cheki probe" }
]
```

A receipt QR that only names the reference (Telebirr's Payment QR Code) is an **input-only** format: no `parser`, no `endpoint`, `"inputs": [{ "name": "qr", ... }]` and `"via": "<the format it is checked through>"`. It is never fetched and never proof of payment: the decoder reads the reference out of it (on the device for uploads and the camera, from `qrData` in the API) and the check runs exactly as if the reference had been typed. Keep such decoders in `src/lib/qr/` with hard size caps, no backtracking regexes, an integrity check where the format has one, and synthetic test fixtures only (see `src/lib/qr/telebirr.ts` and [docs/telebirr-qr.md](docs/telebirr-qr.md)). Never use the amount or names a QR claims.

`confidence` is `verified` only for what cheki itself observed (a real receipt, or a probe). Anything taken from another site (links.et, another app's source code) is `inferred`, says so in `evidence`, and is never described as live in copy.

Keep `status` as `in-development` until the parser has passed against a real receipt. In-development banks are noindexed, and their page shows the private submission box instead of the checker.

`responseType` is `pdf`, `html`, `json`, or `pdf-in-json` (a JSON envelope whose field holds the receipt as a base64 PDF, like M-Pesa's `{responseCode, responseDescription, base64Data}`). For `pdf-in-json`, validate the base64 strictly, check its length before decoding, keep the decoded PDF under `MAX_PDF_BYTES` (5 MB), check the `%PDF-` header, and only then extract text.

A bank that is already `live` but whose parser was rebuilt from outside evidence (other verifiers' source code, never a real receipt) gets `"beta": true` and a `betaNote` in banks.json. Copy and `/api/banks` label it beta. Remove both, and set the format's `confidence` to `verified`, only after a real (redacted) receipt passes the parser. M-Pesa is in this state as of 2026-10-11.

Then add the bank to `src/lib/manifest/endpoints.ts`: placeholders (what each is, where to find it, length and pattern, traps), a redacted example, the fields the parser returns, the unknown-reference error shape, gotchas, a dated changelog line, and a `probe` with a fake reference and the expected status, content type and body text. `tests/manifest/endpoints.test.ts` fails if a manifest bank has no entry there.

### 3. The parser

Copy this template to `src/lib/parsers/yourbank.ts` and register it in `src/lib/parsers/index.ts`:

```typescript
import { BaseParser } from "./base";
import type { ParsedReceipt } from "../core/types";

export class YourBankParser extends BaseParser {
  readonly bankId = "yourbank";
  readonly bankName = "Your Bank";
  readonly responseType = "html" as const;
  readonly requiresAccount = false;
  readonly accountDigits?: number = undefined;
  readonly requiresPhone = false;

  buildUrl(ref: string): string {
    return `https://receipt.yourbank.com/receipt/${encodeURIComponent(ref)}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const html = data.toString();
    // Return verified: false for the unknown-reference shape and anything else
    // that is not clearly a receipt. Never guess.
    if (!html.includes("Transaction Reference")) return { verified: false };
    return {
      verified: true,
      senderName: /* ... */ undefined,
      receiverName: /* ... */ undefined,
      amount: /* ... */ undefined,
      currency: "ETB",
      reference: /* ... */ undefined,
    };
  }
}
```

PDF receipts: keep `parse` returning `{ verified: false }` and add static `extractPdfText` (via `unpdf`) and `parsePdfText` methods, then add the bank to `parseResponse()` in `src/lib/core/verifier.ts` (see Zemen, Dashen or CBE Birr). If a bank can answer with either PDF or HTML, set `readonly binaryResponse = true` so the body is read as bytes (it then gets the 5 MB PDF cap instead of 2 MB).

Rules every parser follows (tests enforce them):

- **Fetching is done for you.** `BaseParser.fetchReceipt` goes through `safeFetch`: the host must be on the allowlist on every redirect hop, the body is capped, and only network errors and 5xx are retried (4xx never). The allowlist is built from the manifest `endpoint`, so a new host is allowed by its manifest entry; never fetch a URL the user supplied, only one rebuilt from the reference.
- **Unknown references.** 404 means "not found". If the bank answers an unknown reference with another status (Dashen uses 400), override `notFoundStatuses` so it maps to not-found instead of an error or a retry.
- **`verified: true` is not the last word.** After your parser, a shared gate (`src/lib/core/gate.ts`) requires a positive amount, at least one party, a reference that matches the one requested, and a status that is not a failure. Return the bank's own reference and status so the gate can check them.
- **Linear-time parsing only.** Parsers also run on pasted text, so use `removeScriptsAndStyles` / `TAG_RE` from `src/lib/core/html.ts` and `parseMoney` from `src/lib/core/money.ts` instead of `/<[^>]+>/`, lazy `<script>...</script>` or unbounded number regexes. `tests/security/redos.test.ts` runs every parser on 100k-character pathological input.
- **References** are validated by `normalizeReference` (no `/ # ? & %`, `..` or whitespace) and must be `encodeURIComponent`-ed in `buildUrl`.

### 4. A redacted fixture and a test

Save the real response once, locally, with `npm run probe -- <link> --raw`. Then redact it before it goes anywhere near git:

- Replace every person and business name with an invented one (`ABEBE TEST KEBEDE`, `TEST MERCHANT PLC`).
- Replace account and phone digits with `X` except the last 4 (`1000XXXXX5678`, `2519XXXX1234`).
- Replace the reference, receipt number and any token with a fake of the same length and shape.
- Keep the labels, layout, whitespace and markup exactly as they are. That is what the parser depends on.
- Change the amount and date to other plausible values.

Put HTML or JSON fixtures in `tests/fixtures/<bank>/`. For PDFs, commit the extracted text as a string in the test rather than the PDF itself (see `tests/parsers/cbebirr.test.ts`). Then test the parse:

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { YourBankParser } from "@/lib/parsers/yourbank";

const fixture = (name: string) => readFileSync(resolve(__dirname, "../fixtures/yourbank", name), "utf8");

describe("YourBankParser", () => {
  it("parses a redacted receipt", () => {
    const r = new YourBankParser().parse(fixture("transfer.html"), "text/html");
    expect(r.verified).toBe(true);
    expect(r.receiverName).toBe("TEST MERCHANT PLC");
    expect(r.amount).toBe(1500);
  });

  it("rejects the unknown-reference response", () => {
    expect(new YourBankParser().parse('{"message":"Transaction not found"}', "application/json").verified).toBe(false);
  });
});
```

### 5. Flip it to live

When the parser passes on a real receipt (yours, or one sent through the private box): set `"status": "live"` in `banks.json`, add a changelog line in `endpoints.ts`, update the live count in `tests/manifest/loader.test.ts`, and run `npm test`, `npx tsc --noEmit` and `npx next build`. Credit the contributor by name in the PR unless they asked to stay anonymous.

### When a bank switches formats

Banks move receipts to new hosts and new reference shapes (CBE's FT reference + account PDF gave way to the Receipt ID link; Dashen moved from receipt.dashensuperapp.com to receipts.dashenbanksc.com). Record the switch as data, keep older receipts working, and lead with the new format everywhere:

1. **Add the new format at the head of `formats`** in `banks.json` with `"status": "current"`, its `endpoint`, `link`, `inputs`, a `refPattern` that tells it apart from the older format by shape, `since`, `confidence` and `evidence`. Update the bank's top-level `endpoint`, `endpointFormat`, `requiresAccount`, `referenceFormat`, `referenceExample`, `description` and `faq` to describe the current format.
2. **Mark the old format** `"status": "legacy"` (the bank still answers: cheki keeps fetching it and its host stays allowlisted) or `"status": "deprecated"` (the bank stopped answering: no `parser`, its host leaves the allowlist, old links are only read for their reference). Add `replacedBy`, and `deprecatedAt` when you know it. Give a legacy format a `missingHint` for the case where its reference arrives without a field it needs.
3. **Add an `endpointHistory` entry** with the date, the format id, what changed and the source (`cheki probe`, a commit, or the outside URL). `/endpoints` shows it as the bank's changelog.
4. **Write the parser and a redacted fixture** for the new format (steps 3 and 4 above), and register it. If the new receipt's lookup key is a share token rather than the printed reference, add the parser id to `REFERENCE_IS_OPAQUE_TOKEN` in `src/lib/core/gate.ts` (and to `_REFERENCE_IS_OPAQUE_TOKEN` in `python/cheki/registry.py`), with a test that a mismatched reference still fails for the other banks.
5. **Update the contract fixture** `sdks/fixtures/api-contract.json` (`banks` formats and `receiptUrlCases`) and run every SDK's tests (see [Changing an API response](#changing-an-api-response)). Update the SDK READMEs so the first example uses the new format and the old one sits under "Older receipts".
6. **The health check follows automatically**: the bank's probe uses the primary (current) format's parser unless `probe.parser` says otherwise. Update `probe.expect` in `endpoints.ts` to the new host's unknown-reference answer, and move the old probe into the bank's `legacy` list so it is still checked as its own `<bank>:<formatId>` row (a legacy row going down never fails `--strict`).
7. **Copy derives from the manifest** where it can: the checker field, the bank page's format note, `/endpoints` and `/api/banks` read `formats`. Hand-written copy does not, so grep for the old host and the old reference example (`src/lib/seo-pages.ts`, `src/lib/guides.ts`, `src/app/docs`, `public/llms.txt`, `README.md`, the SDK READMEs and examples) and make sure none of it leads with the old format.

Then run `npx vitest run` (`tests/manifest/formats.test.ts` checks the ordering, the allowlist and the selection), `npx tsc --noEmit` and `npx next build`.

### Endpoint health checks

`.github/workflows/endpoint-health.yml` runs `npm run health-check` daily. It sends each bank a known-fake reference, compares the answer with the `probe.expect` in `endpoints.ts`, and writes `public/status.json`. A changed shape shows as "degraded" on `/status`. GitHub runners are outside Ethiopia, so geo-restricted endpoints (Telebirr, M-Pesa) are recorded as "not checked from CI". Run it yourself with `npm run health-check -- --dry-run`, or `CHEKI_CHECK_GEO=1 npm run health-check -- --dry-run` from an Ethiopian network.

## Running the CLI

```bash
npm run cli -- info
npm run cli -- verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01
npm run cli -- verify cbe FT26140P01YB -a 1000560536171   # older FT receipt (legacy)
npm run cli -- verify telebirr CHQ0FJ403O
npm run cli -- health
```

## Testing

```bash
npm test              # run all tests
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

Tests are in `tests/` and cover:
- URL detection (all bank URL formats)
- Manifest loading and validation
- Parser logic for every live bank
- Error type mapping
- Parser registry
- Security hardening (`tests/security`)
- The SDK contract (`tests/contract`): `sdks/fixtures/api-contract.json` must match what the route handlers send

### Smoke test and deploys

`npm run smoke` checks a running site: the main pages, `/api/health`, that a bad `/api/verify` request gets a clean 4xx (never "verified"), and that an old `/verify` URL 301s. It defaults to `http://localhost:3000` (`npx next build && npx next start`); pass another base URL to check a deployment:

```bash
npm run smoke -- https://cheki.et
```

Only `main` deploys (see `vercel.json`). How to ship a stack of PRs in one deploy, and how to roll back, is in [docs/RELEASING.md](docs/RELEASING.md).

### Changing an API response

Every SDK decodes `sdks/fixtures/api-contract.json` in its tests. If you change what a route returns, update that file in the same PR; `tests/contract/sdk-fixtures.test.ts` fails until you do. Then run each SDK's tests:

```bash
npx vitest run tests/contract tests/sdk                 # contract + TypeScript SDK
(cd sdks/typescript && npm install && npm run build)    # rebuild the committed index.js / index.d.ts
(cd sdks/go && go vet ./... && go test ./...)
(cd sdks/php && phpunit)
(cd sdks/dart && dart pub get && dart analyze && dart test)
(cd python && pip install -e ".[dev]" && ruff check . && mypy && pytest)
```

## Project structure

```
cheki/
├── src/
│   ├── lib/
│   │   ├── core/          # domain types, Result, errors, Verifier
│   │   ├── manifest/      # banks.json + loader
│   │   ├── parsers/       # BaseParser, registry, one file per bank
│   │   ├── adapters/      # URL detector
│   │   └── index.ts       # public API barrel
│   ├── app/
│   │   ├── api/           # thin API route handlers
│   │   ├── guides/        # SEO blog articles
│   │   ├── banks/         # bank-specific pages
│   │   ├── compare/       # comparison page
│   │   └── ...            # home, docs, etc.
│   ├── components/        # React components (Nav, Footer, BankLogo, Icon)
│   └── cli/               # CLI tool (npm run cli)
├── tests/                 # vitest test suite (tests/contract checks the SDK fixtures against the routes)
├── sdks/                  # TypeScript, Go, PHP and Dart SDKs; sdks/fixtures is the shared API contract
├── python/                # Python SDK (API client; direct mode is deprecated)
├── Dockerfile             # self-hosting
└── docker-compose.yml
```

## License

MIT. See [LICENSE](LICENSE).
