# ethio-receipt-verify (cheki Python SDK)

Free, open-source **Ethiopian bank/wallet receipt verification** for Python.

cheki verifies that a payment receipt is real by fetching it directly from the
bank's own public receipt endpoint — no API keys, no paywalls, no scraping with
Selenium. This SDK mirrors the [cheki](https://github.com/1RB/cheki) project's
other official SDKs (TypeScript, Go, PHP, Dart).

## Two modes

The SDK offers two complementary ways to verify receipts:

| Mode | When to use | How it works |
| --- | --- | --- |
| **API client** (recommended) | Production apps, servers, anything that wants reliability | Calls the hosted cheki REST API, which handles geo-blocking, QR decryption, PDF parsing, and bank-endpoint rotation for you. |
| **Direct verification** (advanced) | Self-hosting, no external dependency, research | Fetches bank endpoints *directly* from your machine. No round-trip to cheki, but geo-blocked banks (telebirr, M-Pesa) will fail outside Ethiopia. |

Both are importable from the top-level package:

```python
from ethio_receipt_verify import ChekiClient, verify, supported_banks
```

---

## Quick start — API client

```python
from ethio_receipt_verify import ChekiClient

cheki = ChekiClient()  # uses https://cheki-pi.vercel.app by default

# CBE requires the receiving account number
result = cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")

if result.is_verified:
    print(f"{result.sender_name} sent {result.amount} {result.currency}")
    print(f"to {result.receiver_name} on {result.date}")
else:
    print(f"Not verified: {result.error}")
```

### Batch verification

Verify up to 50 receipts in a single request:

```python
results = cheki.verify_batch([
    {"bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171"},
    {"bank": "telebirr", "reference": "DET8FJGUJ4"},
    {"bank": "dashen", "reference": "B22WDTI261620001"},
])

print(f"{results.verified}/{results.total} verified")
for r in results.results:
    print(r.reference, r.is_verified, r.error)
```

### Discover supported banks

```python
for bank in cheki.get_banks():
    print(f"{bank.code:<12} {bank.name}  [{bank.status}]")
```

### Health check

```python
health = cheki.get_health()
print(health.status)        # "ok"
for check in health.checks:
    print(f"  {check.name}: {check.status} ({check.latency_ms}ms)")
```

### Context manager

`ChekiClient` reuses a connection pool and can be used as a context manager:

```python
with ChekiClient(timeout=10, max_retries=5) as cheki:
    result = cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")
```

---

## Quick start — Direct verification (advanced)

Direct verification fetches the bank endpoint from *your* machine. It needs no
cheki server but is subject to geo-blocking and bank-side changes.

```python
from ethio_receipt_verify import verify, supported_banks

# CBE needs the full receiving account number
result = verify("cbe", "FT26140P01YB", account_number="1000560536171")

print(result.status)          # VerificationStatus.VERIFIED
print(result.exists)          # True
print(result.amount)          # 20000.0
print(result.sender_name)

# telebirr / M-Pesa only work from Ethiopian IP addresses
print(supported_banks())
```

Direct verification returns a `VerificationResult` (different from the API
client's `ClientVerifyResult`). See the [API reference](#api-reference) below.

---

## Installation

```bash
pip install ethio-receipt-verify
```

From source (development):

```bash
git clone https://github.com/1RB/cheki.git
cd cheki/python
pip install -e ".[dev]"
```

Dependencies: `requests`, `beautifulsoup4`, `pdfplumber` (the latter two are only
needed for direct verification of PDF/HTML receipts).

---

## API reference

### `ChekiClient`

```python
ChekiClient(
    base_url="https://cheki-pi.vercel.app",
    api_key=None,
    timeout=30,
    max_retries=3,
    session=None,
    user_agent=None,
)
```

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `base_url` | `str` | `https://cheki-pi.vercel.app` | cheki API root URL. |
| `api_key` | `str \| None` | `None` | Optional bearer token. The public API does not require one. |
| `timeout` | `float` | `30` | Per-request timeout in seconds. |
| `max_retries` | `int` | `3` | Retries on HTTP 408/429/5xx (in addition to the first attempt). |
| `session` | `requests.Session \| None` | `None` | Reuse a custom session (connection pool, proxies, etc.). |
| `user_agent` | `str \| None` | auto | `User-Agent` header value. |

#### Methods

##### `verify(bank, reference, account_number=None, phone_number=None, qr_data=None) -> ClientVerifyResult`

Verify a single receipt.

##### `verify_batch(receipts) -> ClientBatchResult`

Verify up to 50 receipts. Each receipt is a dict with `bank`, `reference`, and
optional `accountNumber` / `phoneNumber` / `qrData`. Results are returned in
input order with computed `total` / `verified` / `failed` counts.

##### `get_banks() -> list[ClientBankInfo]`

List supported banks/wallets.

##### `get_health() -> ClientHealthStatus`

Check service health (per-bank reachability).

##### `get_receipt_url(bank, reference, account_number=None) -> str`

Build a direct receipt-viewer URL (no network request).

##### `close()`

Close the underlying HTTP session.

### Response types

#### `ClientVerifyResult`

| Field | Type | Notes |
| --- | --- | --- |
| `success` | `bool` | HTTP-level success. |
| `verified` | `bool \| None` | Whether the receipt is legitimate. |
| `bank`, `bank_code`, `reference` | `str \| None` | Identifiers. |
| `source_url` | `str \| None` | Where the receipt was fetched from. |
| `sender_name`, `sender_account` | `str \| None` | Sender details. |
| `receiver_name`, `receiver_account` | `str \| None` | Receiver details. |
| `amount`, `currency` | `float \| None`, `str \| None` | Payment amount. |
| `date` | `str \| None` | Transaction date (as reported by the bank). |
| `branch`, `reason` | `str \| None` | Extra metadata. |
| `duration_ms` | `int \| None` | Server-side processing time. |
| `invoice_number`, `transaction_status` | `str \| None` | Wallet-specific. |
| `settled_amount`, `stamp_duty`, `discount_amount` | `float \| None` | Wallet fees. |
| `service_fee`, `service_fee_vat`, `total_paid` | `float \| None` | Wallet fees. |
| `amount_in_words`, `payment_mode`, `payment_channel` | `str \| None` | Wallet metadata. |
| `bank_account_number`, `bank_account_name` | `str \| None` | Wallet metadata. |
| `error` | `str \| None` | Error message on failure. |
| `fallback_url` | `str \| None` | Direct URL for geo-blocked banks. |
| `index` | `int \| None` | Position within a batch. |
| `raw` | `dict` | The unparsed API payload. |

Helper: `result.is_verified` → `True` when `success` and `verified` are both true.

#### `ClientBatchResult`

`success`, `total`, `verified`, `failed`, `results` (list of
`ClientVerifyResult`), `error`, `raw`.

#### `ClientBankInfo`

`code`, `name`, `swift`, `type`, `status`, `requires_account`,
`account_digits`, `requires_phone`, `endpoint`, `color`, `initials`, `raw`.
Helper: `bank.is_live`.

#### `ClientHealthStatus`

`success`, `status`, `version`, `timestamp`, `checks` (list of
`ClientHealthCheck`), `raw`. Helper: `health.is_ok`.

#### `ClientHealthCheck`

`name`, `status`, `latency_ms`, `raw`.

### Direct verification

#### `verify(bank, reference, **kwargs) -> VerificationResult`

Fetch and parse a receipt directly from the bank endpoint.

- `cbe`, `boa`: pass `account_number=` (full receiving account).
- `cbebirr`: pass `phone_number=` (payer phone, `2519XXXXXXXXX`).

Returns a `VerificationResult` with `status` (`VerificationStatus`), `exists`,
`amount`, `sender_name`, `receiver_name`, `transaction_date`, `source_url`, etc.

#### `supported_banks() -> dict[str, str]`

Map of bank code → human name for the banks with direct verifiers.

---

## Error handling

### API client errors

All API client errors derive from `ChekiClientError`:

```python
from ethio_receipt_verify import (
    ChekiClient, ChekiClientError, ChekiAPIError, ChekiNetworkError, ChekiTimeoutError,
)

cheki = ChekiClient()
try:
    result = cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")
except ChekiTimeoutError as exc:
    print("Request timed out:", exc)
except ChekiNetworkError as exc:
    print("Network error:", exc)
except ChekiAPIError as exc:
    print(f"API error (HTTP {exc.status_code}):", exc.message)
except ChekiClientError as exc:
    print("Client error:", exc)
```

| Error | Meaning |
| --- | --- |
| `ChekiAPIError` | Non-2xx API response. Carries `status_code`, `message`, `body`. |
| `ChekiNetworkError` | Connection failure. |
| `ChekiTimeoutError` | Request timed out (subclass of `ChekiNetworkError`). |

> **Note:** a verification that *finds no receipt* is **not** an error — the API
> returns `success: false` with an `error` message in the `ClientVerifyResult`.
> Exceptions are reserved for transport/server failures.

### Direct verification errors

```python
from ethio_receipt_verify import verify
from ethio_receipt_verify.errors import (
    VerificationError, ReceiptNotFoundError, UpstreamError, UnsupportedBankError,
)
```

| Error | Meaning |
| --- | --- |
| `UnsupportedBankError` | The bank code is not supported. |
| `ReceiptNotFoundError` | The bank returned a "not found" response. |
| `UpstreamError` | The bank endpoint is unreachable or returned an error. |

### Retries

`ChekiClient` automatically retries on HTTP `408`, `429`, and `5xx` using
exponential backoff with full jitter (up to `max_retries` extra attempts). A
`Retry-After` header, when present, is honored. Network and timeout errors are
also retried.

---

## CLI

Install the package to get the `ethio-verify` command:

```bash
# API client (recommended)
ethio-verify cbe FT26140P01YB --account 1000560536171 --api
ethio-verify telebirr DET8FJGUJ4 --api --json

# Direct verification (advanced)
ethio-verify cbe FT26140P01YB --account 1000560536171

# Service health & supported banks (via API)
ethio-verify --health
ethio-verify --list-banks --api
```

### Flags

| Flag | Description |
| --- | --- |
| `bank` | Bank/wallet code (e.g. `cbe`, `telebirr`, `boa`, `mpesa`). |
| `reference` | Transaction reference number. |
| `--account` | Receiving account number (required for cbe, boa). |
| `--phone` | Payer phone number (required for cbebirr). |
| `--qr` | Raw QR payload (Bank of Abyssinia inter-bank receipts). |
| `--api` | Use the hosted cheki REST API instead of direct verification. |
| `--base-url` | cheki API base URL (default: `https://cheki-pi.vercel.app`). |
| `--api-key` | Optional bearer token. |
| `--timeout` | Per-request timeout in seconds (API mode, default: 30). |
| `--json` | Output raw JSON. |
| `--list-banks` | List supported banks and exit. |
| `--health` | Check cheki API health and exit (implies `--api`). |

---

## Configuration

### Custom base URL / self-hosting

```python
cheki = ChekiClient(base_url="https://cheki.my-server.com")
```

### Proxies & custom session

```python
import requests

session = requests.Session()
session.proxies = {"https": "http://proxy.local:8080"}
cheki = ChekiClient(session=session)
```

### Timeouts & retries

```python
cheki = ChekiClient(timeout=10, max_retries=5)
```

---

## Supported banks

cbe, telebirr, boa, mpesa, dashen, zemen, cbebirr, siinqee, kaafiebirr (and
more — run `cheki.get_banks()` or `ethio-verify --list-banks --api` for the
current list). Availability depends on the bank endpoint's status and
geo-restrictions.

---

## License

MIT © [1RB](https://github.com/1RB)
