# cheki PHP SDK

PHP client for the [cheki](https://cheki.et) receipt verification API: verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen, M-Pesa, Awash, Zemen, CBE Birr, Siinqee and eBirr. Needs PHP 8.0+ with `ext-curl` and `ext-json` (the tests run on 8.1 and 8.3).

```bash
composer require cheki/cheki
```

## Quick start

```php
use Cheki\ChekiClient;

$client = new ChekiClient(); // 65 s per attempt, at most 1 retry

$result = $client->verify('cbe', 'FT26140P01YB', '1000560536171');

if ($result->isVerified()) {
    echo "{$result->senderName} sent {$result->amount} {$result->currency}";
} elseif ($result->decodedOnly) {
    echo 'Decoded from a QR code, NOT confirmed with the bank';
} elseif ($result->isRateLimited()) {
    echo "Rate limited, retry in {$result->retryAfter} s";
} else {
    echo "Not verified ({$result->httpStatus}): {$result->error}";
    // $result->fallbackUrl is set for geo-blocked banks
}
```

`verify()` and `verifyBatch()` never throw for API answers: errors come back on the result (`success` false, `error`, `httpStatus`, `retryAfter`, `fallbackUrl`). `getBanks()` and `getHealth()` throw `Cheki\ChekiException` when the request fails.

### `isVerified()` is the only success signal

`success` only means the request was processed. A BOA QR code that BOA could not confirm comes back with `success` true, `verified` false and `decodedOnly` true. A QR code can be forged.

Signature: `verify(string $bank, string $reference, ?string $accountNumber = null, ?string $phoneNumber = null, ?string $qrData = null)`. QR-only: `$client->verify('boa', '', null, null, $qrPayload)`.

### Batch (max 20)

```php
$batch = $client->verifyBatch([
    ['bank' => 'cbe', 'reference' => 'FT26140P01YB', 'accountNumber' => '1000560536171'],
    ['bank' => 'telebirr', 'reference' => 'CHQ0FJ403O'],
    ['bank' => 'boa', 'qrData' => '3cHRaxVjn/pySp...'],
]);

echo "{$batch->verified}/{$batch->total} verified, {$batch->failed} not, {$batch->cached} from cache\n";
foreach ($batch->results as $r) {
    echo $r->index, ': ', $r->isVerified() ? 'verified' : "not verified ({$r->httpStatus}) {$r->error}", "\n";
}
```

More than 20 receipts (or none) throws `InvalidArgumentException` without a request. Each receipt also counts against the per-IP verify limit (30 per minute).

### Banks and health

```php
foreach ($client->getBanks() as $bank) {
    echo "{$bank->id} {$bank->name} {$bank->type} {$bank->status}\n"; // $bank->code is a deprecated alias of $bank->id
}

$health = $client->getHealth(); // cached up to 5 minutes server-side
foreach ($health->banks as $b) {
    echo "{$b->id}: {$b->status} ({$b->latencyMs} ms)\n";
}
```

### Receipt download links

```php
$url = $client->getReceiptUrl('cbe', 'FT26140P01YB', '1000560536171');
```

Only `cbe` (account required, at least the last 8 digits), `zemen` and `dashen`; anything else throws `InvalidArgumentException`.

## Timeouts and retries

- **65 s per attempt** (`VerifyOptions::DEFAULT_TIMEOUT`), 10 s to connect. The server may spend up to 60 s.
- **No retries on 4xx** (except 429) and **none on timeouts**.
- **At most one retry** on a network error, 5xx or 429, after `Retry-After` when sent (up to 60 s), otherwise 1-2 s. `withMaxRetries(0)` disables it.
- The server tries each bank at most 2 times, so one call reaches the bank at most **4 times** (a batch: 4 per receipt).
- Redirects are not followed.

```php
use Cheki\VerifyOptions;

$client = new ChekiClient(
    (new VerifyOptions())->withBaseUrl('https://cheki.et')->withTimeout(65)->withMaxRetries(1)
);
```

## Breaking changes in this version

- `Bank::$id` is the bank id (`$code` kept as an alias); `responseType`, `sslVerify`, `notes` removed (the API never sent them).
- `HealthStatus` has `status`, `checkedAt`, `cached` and `banks` (`BankHealth[]`); `success`, `version`, `timestamp`, `checks` removed.
- Amounts and fees are `?float` (were strings).
- `VerifyResult` gains `decodedOnly`, `parsed`, `cached`, `fallbackUrl`, `retryAfter`, `index`; its constructor is now `(success, verified, error, httpStatus)`.
- `getBanks()` / `getHealth()` throw `ChekiException` instead of returning `[]` / an "unreachable" object.
- `verifyBatch()` enforces 20 receipts and now sends `qrData`.
- Timeout 30 → 65 s; retries 3 → 1.

## Tests

```bash
phpunit        # decodes ../fixtures/api-contract.json, the shared API contract
```
