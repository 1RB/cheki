# cheki Python SDK

Python client for the [cheki](https://cheki.et) receipt verification API: verify Ethiopian bank and wallet receipts (live: CBE, Telebirr, BOA, M-Pesa (beta), Dashen, Awash, Siinqee, eBirr, ZamZam (beta), CBE Birr (beta); `get_banks()` lists the current set). Python 3.10+.

From the hosted API at cheki.et, Telebirr and M-Pesa come back as a 502 with `fallback_url` (the official receipt page), because they block cloud servers. Send the user there to check the amount and receiver; direct checks return once a local relay is live.

Website: [cheki.et](https://cheki.et) · API reference: [cheki.et/docs](https://cheki.et/docs) · Integration guide and every SDK: [cheki.et/developers](https://cheki.et/developers) · Supported banks: [cheki.et/banks](https://cheki.et/banks)

```bash
pip install cheki            # the API client: needs only requests
pip install 'cheki[direct]'  # only for the deprecated direct mode (adds beautifulsoup4, pdfplumber)
```

## Quick start

```python
from cheki import ChekiClient

with ChekiClient() as cheki:  # https://cheki.et, 65 s per attempt, at most 1 retry
    # CBE: the receipt link (or just its Receipt ID) from the CBE app. No account number needed.
    result = cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01")

    if result.is_verified:
        print(f"{result.sender_name} sent {result.amount} {result.currency}")
    elif result.decoded_only:
        print("Decoded from a QR code, NOT confirmed with the bank")
    elif result.is_rate_limited:
        print(f"Rate limited, retry in {result.retry_after} s")
    else:
        print(f"Not verified ({result.http_status}): {result.error}")
        # result.fallback_url is set for geo-blocked banks; result.checked_url
        # on a 422 is the bank page cheki asked
```

### `is_verified` is the only success signal

`verify()` returns a `ClientVerifyResult` for API errors too (it does not raise for a 4xx/5xx). `success` only means the request was processed: a BOA QR code that BOA could not confirm comes back with `success=True, verified=False, decoded_only=True`, and a QR code can be forged. `/api/parse` results (`parsed=True`) are never verified either.

QR-only (BOA): `cheki.verify("boa", "", qr_data="KPHO0k4YlK/5s6...")`.

### Batch (max 20)

```python
batch = cheki.verify_batch([
    {"bank": "cbe", "reference": "https://mbreciept.cbe.com.et/fHCxExampleRcpt01"},
    {"bank": "telebirr", "reference": "DET0SAMPLE"},
    {"bank": "boa", "qr_data": "KPHO0k4YlK/5s6..."},
])
print(f"{batch.verified}/{batch.total} verified, {batch.failed} not, {batch.cached} from cache")
for r in batch.results:
    print(r.index, r.is_verified, r.http_status, r.error)
```

More than 20 receipts (or none, or an item without `bank`) raises `ValueError` without a request. Each receipt also counts against the per-IP verify limit (30 per minute), and a batch is never retried after a 5xx or network error, so send long lists in chunks of `RECOMMENDED_BATCH_CHUNK` (15):

```python
from cheki import RECOMMENDED_BATCH_CHUNK

for i in range(0, len(receipts), RECOMMENDED_BATCH_CHUNK):
    batch = cheki.verify_batch(receipts[i:i + RECOMMENDED_BATCH_CHUNK])
```

A failed item has `http_status` and `error`, plus `fallback_url` when the server sends one for a geo-blocked bank, or `checked_url` (the bank page cheki asked) on a 422. Results carry `order_id` when the receipt has one (CBE Birr).

### Banks and health

```python
for bank in cheki.get_banks():
    print(bank.id, bank.name, bank.type, bank.status, bank.beta)   # bank.code is an alias of bank.id; beta: M-Pesa, ZamZam

health = cheki.get_health()   # cached up to 5 minutes server-side
print(health.status, health.checked_at, health.cached)
for b in health.banks:        # health.checks is a deprecated alias
    print(b.id, b.status, b.latency_ms)
```

### Receipt download links

```python
cheki.get_receipt_url("cbe", "fHCxExampleRcpt01")
# https://cheki.et/api/receipt?bank=cbe&reference=fHCxExampleRcpt01
```

Only `cbe`, `zemen`, `dashen` and `zamzam`; anything else raises `ValueError`, and so does a ZamZam receipt id that is not digits only. CBE, Dashen and ZamZam links redirect to the bank's own receipt page; Zemen (and older CBE receipts) are served as the bank's PDF. A CBE FT reference or Dashen FT Ref typed in lowercase or with spaces is sent the way the bank prints it (`ft26 sample01` becomes `FT26SAMPLE01`); a CBE Receipt ID keeps its case. `verify` sends the reference as given and the server does the same.

### Older receipts

Older CBE receipts that only show an FT reference still work as a legacy format: pass the receiving account (at least the last 8 digits). CBE's older receipt service is often unreachable, so prefer the receipt link when you have it.

```python
cheki.verify("cbe", "FT26SAMPLE01", account_number="1000000006171")
cheki.get_receipt_url("cbe", "FT26SAMPLE01", account_number="1000000006171")  # the bank's PDF
```

## Errors

`get_banks()` and `get_health()` raise on failure; `verify()` and `verify_batch()` put the error on the result.

| Error | Meaning |
| --- | --- |
| `ChekiAPIError` | Non-2xx response: `status_code`, `message` (the server's text), `body`. |
| `ChekiRateLimitError` | 429, with `retry_after` seconds. Subclass of `ChekiAPIError`. |
| `ChekiPayloadTooLargeError` | 413. Subclass of `ChekiAPIError`. |
| `ChekiNetworkError` | Connection failure. |
| `ChekiTimeoutError` | An attempt timed out (subclass of `ChekiNetworkError`). |

## Timeouts and retries

- **65 s per attempt** (`timeout=`). The server may spend up to 60 s on a slow bank.
- **At most one retry** (`max_retries` is clamped to 0..1), and only where it is safe (the same rule in every cheki SDK):
  - `GET` (banks, health): a network error or a 5xx.
  - verify: a network error, or a 429/503 whose `Retry-After` is at most 60 s.
  - batch: only a 429/503 with a short `Retry-After`. Never a network error or a 5xx: a 504 means the batch ran out of server time, and replaying it would hit every bank again and charge every receipt against the rate limit.
  - Never: timeouts, other 4xx, a geo-blocked bank (502 with `fallbackUrl`), or any error the server marks `retryable: false`. A 500/502/504 on verify is not retried either: the server already ran the check, with its own 2 attempts per bank.
- The retry waits for `Retry-After`; a network-error retry waits 1-2 s. Timeouts are never retried (the server may still be working on the request).
- The server tries each bank at most 2 times, so one call reaches the bank at most **4 times**.
- `ChekiClient(session=...)` reuses your `requests.Session` without changing it: the `User-Agent` and `Authorization` headers go on each request, so your API key is never sent to other hosts that session talks to, and `close()` leaves your session open.

## CLI

`pip install cheki` installs `cheki-verify`, which uses the hosted API:

```bash
cheki-verify cbe https://mbreciept.cbe.com.et/fHCxExampleRcpt01
cheki-verify telebirr DET0SAMPLE --json
cheki-verify boa --qr 'KPHO0k4YlK/5s6...'
cheki-verify --health
cheki-verify --list-banks
```

It exits 0 only when the bank confirmed the receipt. `--api` is accepted and ignored (it is the default).

## Direct verification (deprecated)

`from cheki import verify` needs `pip install 'cheki[direct]'` (without it, it raises `DirectModeUnavailableError`). It fetches bank endpoints from your own machine with Python parsers that have drifted from the server's: they lack its host allowlist and ReDoS fixes and do not support eBirr/Siinqee. CBE (Receipt ID first, FT reference + account for older receipts) and Dashen (receipts.dashenbanksc.com) follow the current formats. It is kept only so existing code keeps working:

- it emits a `DeprecationWarning`;
- it rejects references that are not plain receipt numbers (no `/ ? # & %`, `..` or spaces);
- it verifies TLS for every bank (1.5.0 removed the Awash exception, which let anyone on the network path forge an Awash receipt);
- it applies a fail-closed port of the server's gate (positive amount, the requested reference unless it is an opaque share token such as CBE's Receipt ID, a payer or receiver, no failed/pending status), so a response that does not pass is `FAILED`, not `VERIFIED`;
- `cheki-verify --direct` uses it (with a warning).

It will be removed in the next major version. If you cannot use the hosted API, self-host the cheki server (see the repo's Docker setup) and point `ChekiClient(base_url=...)` at it.

## Development

```bash
pip install -e ".[dev]"
ruff check . && mypy && pytest
```

`tests/test_contract.py` decodes the shared fixtures in `../sdks/fixtures/api-contract.json`, which the repo's `tests/contract` suite checks against the real route handlers.

## License

MIT © [1RB](https://github.com/1RB)
