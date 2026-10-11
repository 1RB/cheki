# cheki-verify

> TypeScript SDK for the [cheki](https://cheki.et) receipt verification API.

Verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen, M-Pesa (beta: not yet confirmed with a real receipt), Awash, Siinqee and eBirr (the live banks; `getBanks()` lists the current set). Zero runtime dependencies (uses the global `fetch`, Node.js ≥ 18).

> **Server-side only.** The hosted API does not send CORS headers on `/api/verify`, `/api/verify/batch`, `/api/banks` or `/api/health`, so browsers block these calls. Call cheki from your backend.

## Install

```bash
npm install cheki-verify
```

## Quick start

```ts
import { Cheki, isVerified } from "cheki-verify";

const cheki = new Cheki(); // https://cheki.et, 65 s timeout, at most 1 retry

// CBE: the receipt link (or just its Receipt ID) from the CBE app. No account number needed.
const result = await cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01");

if (isVerified(result)) {
  console.log(result.amount, result.currency, result.senderName);
}
```

Each bank's receipt formats come current first in `getBanks()` (lead with the first `supported` one in `b.formats`); see [Older receipts](#older-receipts) for legacy formats.

### `verified` is the only success signal

A `200` response does not always mean the payment is confirmed:

| Response | Meaning |
|---|---|
| `verified: true` | The bank confirmed the receipt. |
| `success: true, verified: false, decodedOnly: true` | BOA QR code decoded, but BOA could not be reached. A QR code can be forged; do not release goods on this. |
| `parsed: true` (from `/api/parse`) | Read from text the caller supplied. Never checked with the bank. |

Use `isVerified(result)` rather than `result.success`.

### BOA QR codes

```ts
const r = await cheki.verify("boa", "", { qrData: "3cHRaxVjn/pySp..." });
```

### Batch (max 20)

```ts
const batch = await cheki.verifyBatch([
  { bank: "cbe", reference: "https://mbreciept.cbe.com.et/fHCxExampleRcpt01" },
  { bank: "telebirr", reference: "CHQ0FJ403O" },
]);

console.log(`${batch.verified}/${batch.total} verified, ${batch.failed} not, ${batch.cached} from cache`);
for (const item of batch.results) {
  if (item.success) console.log(item.index, isVerified(item), item.amount);
  else console.log(item.index, item.status, item.error); // e.g. 422 "Receipt not found"
}
```

More than 20 receipts (or none) throws `ChekiValidationError` before any request. Each receipt also counts against the per-IP verify limit (30 per minute).

### Banks and health

```ts
const { banks } = await cheki.getBanks();
for (const b of banks) console.log(b.id, b.name, b.type, b.status, b.requiresAccount, b.accountDigits);
// b.code is a deprecated alias of b.id
// b.formats: the bank's receipt formats, current first (status "current" | "legacy" | "deprecated")
console.log(banks.find((b) => b.id === "cbe")?.formats.find((f) => f.supported)?.label); // "Receipt ID or mbreciept.cbe.com.et link"

const health = await cheki.getHealth(); // cached up to 5 minutes server-side
console.log(health.status, health.checkedAt, health.cached);
for (const b of health.banks) console.log(b.id, b.status, b.latencyMs); // reachable | unreachable | geo-blocked | ...
```

### Receipt download links

```ts
cheki.getReceiptUrl("cbe", "fHCxExampleRcpt01");
// https://cheki.et/api/receipt?bank=cbe&reference=fHCxExampleRcpt01 (redirects to CBE's own receipt page)
cheki.getReceiptUrl("dashen", "B22WDTI2619100WH");
// https://cheki.et/api/receipt?bank=dashen&reference=B22WDTI2619100WH (redirects to Dashen's own receipt page)
```

Only `cbe`, `zemen` and `dashen` are supported; anything else throws `ChekiValidationError`. CBE and Dashen links redirect to the bank's own page; Zemen (and older CBE receipts) are served as the bank's PDF.

### Older receipts

Older CBE receipts that only show an FT reference still work as a legacy format: pass the receiving account (at least the last 8 digits). CBE's older receipt service is often unreachable, so prefer the receipt link when you have it.

```ts
await cheki.verify("cbe", "FT26140P01YB", { accountNumber: "1000560536171" });
cheki.getReceiptUrl("cbe", "FT26140P01YB", "1000560536171"); // the bank's PDF
```

## Errors

| Class | When |
|---|---|
| `ChekiAPIError` | Any non-2xx. `statusCode`, `serverMessage` (the API's `error` text, also in `message`), `fallbackUrl` (geo-blocked banks), `body`. |
| `ChekiRateLimitError` | 429. `retryAfterSeconds` from the `Retry-After` header. |
| `ChekiPayloadTooLargeError` | 413 (verify body > 16 KB, batch > 64 KB). |
| `ChekiValidationError` | Rejected before sending (batch size, receipt URL input). |
| `ChekiNetworkError` | DNS, connection or TLS failure, or your `AbortSignal` fired. |
| `ChekiTimeoutError` | An attempt took longer than `timeoutMs`. |

Status codes: 400 bad input, 404 unsupported bank, 413 too large, 422 receipt not found or failed verification, 429 rate limited, 502 bank unreachable or geo-blocked, 500 internal error.

## Timeouts and retries

- Each attempt waits up to **65 s** (`DEFAULT_TIMEOUT_MS`). The server may spend up to 60 s on a slow bank (older CBE PDFs).
- **No retries on 4xx** (except 429) and **none on timeouts** (the server may still be working on the request).
- **At most one retry** (`MAX_RETRIES = 1`) on a network error, 5xx or 429. The retry waits for `Retry-After` when the server sends one (up to 60 s; a longer wait is thrown as `ChekiRateLimitError` instead), otherwise 1-2 s.
- The server tries each bank at most 2 times, so one `verify()` reaches the bank at most **4 times** (a batch: 4 per receipt). Worst-case wall time is about 2 × 65 s plus the retry wait.

```ts
const cheki = new Cheki({
  baseUrl: "https://cheki.et",
  timeoutMs: 65_000,   // per attempt
  maxRetries: 1,       // 0 or 1; larger values are capped at 1
  defaultHeaders: { "X-Request-Source": "my-app" },
});

await cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01", {}, { timeoutMs: 30_000, retries: 0, signal });
```

## Not covered

`/api/parse` and `/api/ocr` have no SDK methods; call them with `fetch`. Results from `/api/parse` are never verified.

## Contract tests

The SDK's tests (`tests/sdk/typescript-sdk.test.ts` in the repo root) decode the shared fixtures in `sdks/fixtures/api-contract.json`, which `tests/contract/sdk-fixtures.test.ts` checks against the real route handlers.

Build: `npm install && npm run build` (writes the committed `index.js` and `index.d.ts`; CI fails if they are out of date).

## License

MIT
