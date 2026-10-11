# cheki Python SDK

Python client for the [cheki](https://cheki.et) receipt verification API: verify Ethiopian bank and wallet receipts (CBE, Telebirr, BOA, M-Pesa, Dashen, Awash, Zemen, CBE Birr, Siinqee, eBirr). Python 3.10+.

```bash
pip install cheki
```

## Quick start

```python
from cheki import ChekiClient

with ChekiClient() as cheki:  # https://cheki.et, 65 s per attempt, at most 1 retry
    result = cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")

    if result.is_verified:
        print(f"{result.sender_name} sent {result.amount} {result.currency}")
    elif result.decoded_only:
        print("Decoded from a QR code, NOT confirmed with the bank")
    elif result.is_rate_limited:
        print(f"Rate limited, retry in {result.retry_after} s")
    else:
        print(f"Not verified ({result.http_status}): {result.error}")
        # result.fallback_url is set for geo-blocked banks
```

### `is_verified` is the only success signal

`verify()` returns a `ClientVerifyResult` for API errors too (it does not raise for a 4xx/5xx). `success` only means the request was processed: a BOA QR code that BOA could not confirm comes back with `success=True, verified=False, decoded_only=True`, and a QR code can be forged. `/api/parse` results (`parsed=True`) are never verified either.

QR-only (BOA): `cheki.verify("boa", "", qr_data="3cHRaxVjn/pySp...")`.

### Batch (max 20)

```python
batch = cheki.verify_batch([
    {"bank": "cbe", "reference": "FT26140P01YB", "accountNumber": "1000560536171"},
    {"bank": "telebirr", "reference": "DET8FJGUJ4"},
    {"bank": "boa", "qr_data": "3cHRaxVjn/pySp..."},
])
print(f"{batch.verified}/{batch.total} verified, {batch.failed} not, {batch.cached} from cache")
for r in batch.results:
    print(r.index, r.is_verified, r.http_status, r.error)
```

More than 20 receipts (or none) raises `ValueError` without a request. Each receipt also counts against the per-IP verify limit (30 per minute).

### Banks and health

```python
for bank in cheki.get_banks():
    print(bank.id, bank.name, bank.type, bank.status)   # bank.code is an alias of bank.id

health = cheki.get_health()   # cached up to 5 minutes server-side
print(health.status, health.checked_at, health.cached)
for b in health.banks:        # health.checks is a deprecated alias
    print(b.id, b.status, b.latency_ms)
```

### Receipt download links

```python
cheki.get_receipt_url("cbe", "FT26140P01YB", account_number="1000560536171")
```

Only `cbe` (account required, at least the last 8 digits), `zemen` and `dashen`; anything else raises `ValueError`.

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
- **No retries on 4xx** (except 429) and **none on timeouts** (the server may still be working on the request).
- **At most one retry** (`max_retries` is clamped to 0..1) on a network error, 5xx or 429, after `Retry-After` when sent (up to 60 s), otherwise 1-2 s.
- The server tries each bank at most 2 times, so one call reaches the bank at most **4 times** (a batch: 4 per receipt).

## CLI

`pip install cheki` installs `cheki-verify`, which uses the hosted API:

```bash
cheki-verify cbe FT26140P01YB --account 1000560536171
cheki-verify telebirr DET8FJGUJ4 --json
cheki-verify boa --qr '3cHRaxVjn/pySp...'
cheki-verify --health
cheki-verify --list-banks
```

It exits 0 only when the bank confirmed the receipt. `--api` is accepted and ignored (it is the default).

## Direct verification (deprecated)

`from cheki import verify` fetches bank endpoints from your own machine with Python parsers that have drifted from the server's: they lack its shared verification gate, host allowlist and ReDoS fixes, use an old Dashen host, and do not support eBirr/Siinqee. It is kept only so existing code keeps working:

- it emits a `DeprecationWarning`;
- it rejects references that are not plain receipt numbers (no `/ ? # & %`, `..` or spaces);
- it applies a fail-closed port of the server's gate (positive amount, a payer or receiver, no failed/pending status), so a response that does not pass is `FAILED`, not `VERIFIED`;
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
