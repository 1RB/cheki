# cheki

> TypeScript SDK for the [cheki](https://chekiapp.vercel.app) receipt verification API.

Verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen, M-Pesa, and more, with zero runtime dependencies.

---

## Features

- **Full type safety**: every API field is typed, including transaction details, fees, and metadata.
- **Typed error hierarchy**: `ChekiError` → `ChekiAPIError`, `ChekiNetworkError`, `ChekiTimeoutError`.
- **Automatic retry** with exponential backoff + jitter on transient failures (429, 5xx, network errors).
- **Per-request timeout** via `AbortController`: configurable globally and per-call.
- **Per-call overrides**: override timeout, retries, and pass an external `AbortSignal` on any method.
- **Dual ESM/CJS**: works with both `import` and `require`.
- **Zero dependencies**: uses the global `fetch` API (Node.js ≥ 18 or any modern browser).

---

## Installation

```bash
npm install cheki-verify
```

```bash
yarn add cheki-verify
```

```bash
pnpm add cheki-verify
```

---

## Quick Start

```typescript
import { Cheki } from "cheki-verify";

const cheki = new Cheki(); // uses the public API by default

// Verify a single receipt
const result = await cheki.verify("cbe", "FT26140P01YB", {
  accountNumber: "1000560536171",
});

console.log(result.verified);   // true | false
console.log(result.amount);      // 1500
console.log(result.currency);    // "ETB"
console.log(result.senderName);  // "ABEL TESHOME"
```

### Batch Verification

```typescript
const batch = await cheki.verifyBatch([
  { bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" },
  { bank: "telebirr", reference: "TB123456", phoneNumber: "0912345678" },
]);

console.log(`Verified: ${batch.verified}/${batch.total}`);
for (const r of batch.results) {
  console.log(`[${r.index}] ${r.bank} ${r.reference}: ${r.verified}`);
}
```

### List Supported Banks

```typescript
const { banks } = await cheki.getBanks();
for (const bank of banks) {
  console.log(`${bank.code}\t${bank.name}\t${bank.status}\t${bank.type}`);
}
```

### Health Check

```typescript
const health = await cheki.getHealth();
console.log(health.status);   // "ok" | "degraded" | "down"
console.log(health.version);
```

---

## Configuration

Pass a configuration object (or a base URL string) to the `Cheki` constructor:

```typescript
const cheki = new Cheki({
  baseUrl: "https://chekiapp.vercel.app",
  timeoutMs: 10_000,
  maxRetries: 5,
  apiKey: "sk_live_...",
  defaultHeaders: { "X-Custom-Header": "value" },
  userAgent: "my-app/2.0.0",
});
```

| Option | Type | Default | Description |
|---|---|---|---|
| `baseUrl` | `string` | `"https://chekiapp.vercel.app"` | Base URL of the cheki API. |
| `timeoutMs` | `number` | `30000` | Default request timeout in milliseconds. |
| `maxRetries` | `number` | `3` | Default maximum retry attempts for transient failures. |
| `apiKey` | `string` | `undefined` | Optional API key sent as `Bearer` token in the `Authorization` header. |
| `defaultHeaders` | `Record<string, string>` | `{}` | Extra headers merged into every request. Can override built-in headers. |
| `userAgent` | `string` | `"cheki-sdk-typescript/1.0.0"` | `User-Agent` header value. |

You can also pass just a URL string:

```typescript
const cheki = new Cheki("https://chekiapp.vercel.app");
```

### Per-Call Overrides

Every method that performs a network request accepts an optional `RequestOptions` argument:

```typescript
import { Cheki, ChekiTimeoutError } from "cheki-verify";

const cheki = new Cheki();

// Override timeout and retries for this call only
const result = await cheki.verify(
  "cbe",
  "FT26140P01YB",
  { accountNumber: "1000560536171" },
  { timeoutMs: 5_000, retries: 1 },
);

// Use an AbortController to cancel a request
const controller = new AbortController();
setTimeout(() => controller.abort(), 2_000);

try {
  await cheki.getBanks({ signal: controller.signal });
} catch (err) {
  if (err instanceof ChekiTimeoutError) {
    console.log("Cancelled or timed out");
  }
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `timeoutMs` | `number` | Client default | Timeout for this call in milliseconds. |
| `retries` | `number` | Client default | Max retry attempts for this call. |
| `signal` | `AbortSignal` | `undefined` | External abort signal to cancel the request. |

---

## API Reference

### `cheki.verify(bank, reference, options?, requestOptions?)`

Verify a single receipt.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `bank` | `string` | Yes | Bank code (e.g. `"cbe"`, `"telebirr"`). |
| `reference` | `string` | Yes | Transaction reference number. |
| `options` | `VerifyOptions` | No | `{ accountNumber?, phoneNumber?, qrData? }` |
| `requestOptions` | `RequestOptions` | No | Per-call overrides. |

**Returns:** `Promise<VerifyResult>`

### `cheki.verifyBatch(receipts, requestOptions?)`

Verify multiple receipts in one request.

| Parameter | Type | Required | Description |
|---|---|---|---|
| `receipts` | `Receipt[]` | Yes | Array of receipts to verify. |
| `requestOptions` | `RequestOptions` | No | Per-call overrides. |

**Returns:** `Promise<BatchResult>`

### `cheki.getBanks(requestOptions?)`

List all supported banks and wallets.

**Returns:** `Promise<BankListResponse>` (`{ success, count, banks: BankInfo[] }`)

### `cheki.getHealth(requestOptions?)`

Check the service health.

**Returns:** `Promise<HealthStatus>` (`{ success, status, version, timestamp, checks }`)

### `cheki.getReceiptUrl(bank, reference, accountNumber?)`

Build the URL for viewing a receipt in the cheki web interface. This is a pure helper. No network request is made.

**Returns:** `string`

---

## Types

### `VerifyResult`

| Field | Type | Required | Description |
|---|---|---|---|
| `success` | `boolean` | Yes | Whether the request was processed. |
| `verified` | `boolean` | Yes | Whether the receipt was verified. |
| `bank` | `string` | Yes | Bank name. |
| `bankCode` | `string` | Yes | Bank code. |
| `reference` | `string` | Yes | Transaction reference. |
| `sourceUrl` | `string` | Yes | Source URL of the receipt. |
| `senderName` | `string` | No | Sender's name. |
| `senderAccount` | `string` | No | Sender's account. |
| `receiverName` | `string` | No | Receiver's name. |
| `receiverAccount` | `string` | No | Receiver's account. |
| `amount` | `number` | No | Transaction amount. |
| `currency` | `string` | No | Currency code. |
| `date` | `string` | No | Transaction date (ISO 8601). |
| `branch` | `string` | No | Bank branch. |
| `reason` | `string` | No | Failure reason. |
| `durationMs` | `number` | No | Server processing time (ms). |
| `invoiceNumber` | `string` | No | Invoice number. |
| `transactionStatus` | `string` | No | Transaction status. |
| `settledAmount` | `number` | No | Settled amount. |
| `stampDuty` | `number` | No | Stamp duty. |
| `discountAmount` | `number` | No | Discount amount. |
| `serviceFee` | `number` | No | Service fee. |
| `serviceFeeVat` | `number` | No | VAT on service fee. |
| `totalPaid` | `number` | No | Total paid. |
| `amountInWords` | `string` | No | Amount in words. |
| `paymentMode` | `string` | No | Payment mode. |
| `paymentChannel` | `string` | No | Payment channel. |
| `bankAccountNumber` | `string` | No | Bank account number. |
| `bankAccountName` | `string` | No | Bank account name. |
| `error` | `string` | No | Error message. |

### `BankInfo`

| Field | Type | Required | Description |
|---|---|---|---|
| `code` | `string` | Yes | Bank code. |
| `name` | `string` | Yes | Bank name. |
| `status` | `"live" \| "in-development"` | Yes | Integration status. |
| `type` | `"bank" \| "wallet"` | Yes | Institution type. |
| `requiresAccount` | `boolean` | Yes | Whether account number is required. |
| `accountDigits` | `number` | No | Expected account number digit count. |
| `requiresPhone` | `boolean` | Yes | Whether phone number is required. |
| `responseType` | `string` | Yes | Expected response type. |
| `endpoint` | `string` | Yes | Bank API endpoint. |
| `sslVerify` | `boolean` | Yes | Whether SSL verification is enabled. |
| `notes` | `string` | No | Additional notes. |
| `color` | `string` | Yes | Brand color. |
| `initials` | `string` | Yes | Bank initials. |

### `HealthStatus`

| Field | Type | Required | Description |
|---|---|---|---|
| `success` | `boolean` | Yes | Whether health check succeeded. |
| `status` | `"ok" \| "degraded" \| "down"` | Yes | Overall status. |
| `version` | `string` | Yes | API version. |
| `timestamp` | `string` | Yes | Check timestamp (ISO 8601). |
| `checks` | `HealthCheck[]` | Yes | Component checks. |

### `BatchResult`

| Field | Type | Required | Description |
|---|---|---|---|
| `success` | `boolean` | Yes | Whether batch succeeded. |
| `total` | `number` | Yes | Total receipts. |
| `verified` | `number` | Yes | Verified count. |
| `failed` | `number` | Yes | Failed count. |
| `results` | `(VerifyResult & { index: number })[]` | Yes | Per-receipt results. |

---

## Error Handling

The SDK throws a typed error hierarchy. All errors extend `ChekiError`, so you can catch all SDK errors with a single `instanceof` check.

```
ChekiError                   ← base class (all SDK errors)
├── ChekiAPIError            ← non-2xx HTTP response (includes statusCode, body, endpoint)
├── ChekiNetworkError        ← network failure (DNS, connection refused, TLS, caller abort)
└── ChekiTimeoutError        ← request exceeded timeout (includes timeoutMs)
```

### Example

```typescript
import {
  Cheki,
  ChekiError,
  ChekiAPIError,
  ChekiNetworkError,
  ChekiTimeoutError,
} from "cheki-verify";

const cheki = new Cheki({ timeoutMs: 10_000 });

try {
  const result = await cheki.verify("cbe", "FT26140P01YB", {
    accountNumber: "1000560536171",
  });
  console.log(result);
} catch (err) {
  if (err instanceof ChekiAPIError) {
    // The API returned a non-2xx status code
    console.error(`API error ${err.statusCode}:`, err.body);
    console.error(`Endpoint: ${err.endpoint}`);
  } else if (err instanceof ChekiTimeoutError) {
    // The request timed out
    console.error(`Timed out after ${err.timeoutMs}ms`);
  } else if (err instanceof ChekiNetworkError) {
    // Network-level failure (DNS, connection, TLS, or caller abort)
    console.error("Network error:", err.message);
    if (err.cause) console.error("Cause:", err.cause);
  } else if (err instanceof ChekiError) {
    // Catch-all for any other SDK error
    console.error("cheki error:", err.message);
  } else {
    // Non-SDK error (unexpected)
    throw err;
  }
}
```

### Error Properties

| Error | Key Properties |
|---|---|
| `ChekiError` | `name`, `message` |
| `ChekiAPIError` | `statusCode: number`, `body: unknown`, `endpoint: string` |
| `ChekiNetworkError` | `cause?: Error` |
| `ChekiTimeoutError` | `timeoutMs: number` |

---

## Retry Logic

The SDK automatically retries transient failures with exponential backoff and jitter.

**Retried conditions:**
- HTTP `429 Too Many Requests`
- HTTP `500`, `502`, `503`, `504` (server errors)
- Network errors (connection refused, DNS failure, TLS error, etc.)

**Not retried:**
- HTTP `4xx` client errors (except `429`). These are thrown immediately.

**Backoff algorithm:**

```
capped = min(500ms × 2^attempt, 5000ms)
delay  = capped / 2 + random(0, capped / 2)    ← equal jitter
```

| Attempt | Base Delay | Jitter Range | Max Delay |
|---------|-----------|-------------|-----------|
| 0 | 500 ms | 250–500 ms | 500 ms |
| 1 | 1000 ms | 500–1000 ms | 1000 ms |
| 2 | 2000 ms | 1000–2000 ms | 2000 ms |
| 3 | 4000 ms | 2000–4000 ms | 4000 ms |
| 4+ | 5000 ms (capped) | 2500–5000 ms | 5000 ms |

Configure the maximum number of retries via `maxRetries` (client default) or `retries` (per-call override).

---

## Timeout

Every request is guarded by an `AbortController` with the configured `timeoutMs`. If the request does not complete within the timeout, it is aborted and a `ChekiTimeoutError` is thrown.

```typescript
// Global default
const cheki = new Cheki({ timeoutMs: 15_000 });

// Per-call override
await cheki.verify("cbe", "FT26140P01YB", {}, { timeoutMs: 5_000 });
```

You can also pass an external `AbortSignal` to cancel a request programmatically:

```typescript
const controller = new AbortController();

// Cancel after 3 seconds
setTimeout(() => controller.abort(), 3_000);

await cheki.getBanks({ signal: controller.signal });
```

---

## Dual ESM / CommonJS

The package ships with both ESM and CJS entry points:

```typescript
// ESM
import { Cheki } from "cheki-verify";
```

```javascript
// CommonJS
const { Cheki } = require("cheki-verify");
```

The `exports` field in `package.json` routes automatically based on the consumer's module system.

---

## Requirements

- **Node.js** ≥ 18 (for the global `fetch` API)
- **TypeScript** ≥ 4.7 (for `module`/`exports` resolution)
- Any modern browser with `fetch` support

---

## License

MIT © [1RB](https://github.com/1RB)
