# Contributing to cheki

Thanks for helping build the best Ethiopian receipt verification tool. Here's everything you need to get started.

## Quick setup

```bash
git clone https://github.com/1RB/cheki
cd cheki
npm install
npm test        # 66 tests should pass
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
  mpesa.ts                       M-Pesa JSON
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

### 1. Add to the manifest

Add an entry to `src/lib/manifest/banks.json`:

```json
{
  "id": "yourbank",
  "name": "Your Bank",
  "swift": "YOURSWIFT",
  "type": "bank",
  "status": "live",
  "parser": "yourbank",
  "responseType": "html",
  "requiresAccount": false,
  "requiresPhone": false,
  "endpoint": "https://receipt.yourbank.com/receipt/{ref}",
  "sslVerify": true,
  "color": "#FF0000",
  "initials": "YB"
}
```

### 2. Create the parser

Create `src/lib/parsers/yourbank.ts`:

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
    return `https://receipt.yourbank.com/receipt/${ref}`;
  }

  parse(data: string | Buffer, _contentType: string): ParsedReceipt {
    const html = data.toString();
    if (!html.includes("Your Bank Receipt")) {
      return { verified: false };
    }
    // Extract fields from the HTML/JSON/PDF
    return {
      verified: true,
      senderName: /* extract */,
      amount: /* extract */,
      currency: "ETB",
      // ...
    };
  }
}
```

### 3. Register the parser

Add to `src/lib/parsers/index.ts`:

```typescript
import { YourBankParser } from "./yourbank";
registerParser(new YourBankParser());
```

### 4. Write tests

Create `tests/parsers/yourbank.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { YourBankParser } from "@/lib/parsers/yourbank";

describe("YourBankParser", () => {
  it("builds correct URL", () => { /* ... */ });
  it("parses valid receipt", () => { /* ... */ });
  it("returns verified=false for invalid", () => { /* ... */ });
});
```

### 5. Run tests

```bash
npm test
```

## Running the CLI

```bash
npm run cli -- info
npm run cli -- verify cbe FT26140P01YB -a 1000560536171
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
