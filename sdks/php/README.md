# cheki PHP SDK

PHP client for the [cheki](https://cheki.et) receipt verification API: verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen, M-Pesa (beta: not yet confirmed with a real receipt), Awash, Siinqee, eBirr, ZamZam (beta: one receipt shape confirmed so far) and CBE Birr (beta: two real receipts confirmed so far) (the live banks; `getBanks()` lists the current set). Needs PHP 8.1+ with `ext-curl` and `ext-json` (the tests run on 8.1, 8.3 and 8.4).

Website: [cheki.et](https://cheki.et) · API reference: [cheki.et/docs](https://cheki.et/docs) · Integration guide and every SDK: [cheki.et/developers](https://cheki.et/developers) · Supported banks: [cheki.et/banks](https://cheki.et/banks)

```bash
composer require cheki/cheki
```

## Quick start

```php
use Cheki\ChekiClient;

$client = new ChekiClient(); // 65 s per attempt, at most 1 retry

// CBE: the receipt link (or just its Receipt ID) from the CBE app. No account number needed.
$result = $client->verify('cbe', 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01');

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

`verify()` and `verifyBatch()` never throw for API answers: errors come back on the result (`success` false, `error`, `httpStatus`, `retryAfter`, `fallbackUrl`, and `checkedUrl` on a 422: the bank page cheki asked). `getBanks()` and `getHealth()` throw `Cheki\ChekiException` when the request fails.

### `isVerified()` is the only success signal

`success` only means the request was processed. A BOA QR code that BOA could not confirm comes back with `success` true, `verified` false and `decodedOnly` true. A QR code can be forged.

Signature: `verify(string $bank, string $reference, ?string $accountNumber = null, ?string $phoneNumber = null, ?string $qrData = null)`. QR-only: `$client->verify('boa', '', null, null, $qrPayload)`. A CBE Birr receipt QR carries the receipt number and payer phone: `$client->verify('cbebirr', '', null, null, $scannedText)`.

### Batch (max 20)

```php
$batch = $client->verifyBatch([
    ['bank' => 'cbe', 'reference' => 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01'],
    ['bank' => 'telebirr', 'reference' => 'CHQ0SAMPLE'],
    ['bank' => 'boa', 'qrData' => 'KPHO0k4YlK/5s6...'],
]);

echo "{$batch->verified}/{$batch->total} verified, {$batch->failed} not, {$batch->cached} from cache\n";
foreach ($batch->results as $r) {
    echo $r->index, ': ', $r->isVerified() ? 'verified' : "not verified ({$r->httpStatus}) {$r->error}", "\n";
}
```

More than 20 receipts (or none) throws `InvalidArgumentException` without a request. Each receipt also counts against the per-IP verify limit (30 per minute), and a batch is never retried after a 5xx or network error, so send long lists in chunks of `ChekiClient::RECOMMENDED_BATCH_CHUNK` (15):

```php
foreach (array_chunk($receipts, ChekiClient::RECOMMENDED_BATCH_CHUNK) as $chunk) {
    $batch = $client->verifyBatch($chunk);
}
```

A failed item has `httpStatus` and `error`, plus `fallbackUrl` when the server sends one for a geo-blocked bank, or `checkedUrl` (the bank page cheki asked) on a 422. Results carry `orderId` when the receipt has one (CBE Birr), and `Bank::$beta` is true for M-Pesa, ZamZam and CBE Birr.

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
$url = $client->getReceiptUrl('cbe', 'fHCxExampleRcpt01');
// https://cheki.et/api/receipt?bank=cbe&reference=fHCxExampleRcpt01
```

Only `cbe`, `zemen`, `dashen` and `zamzam`; anything else throws `InvalidArgumentException`, and so does a ZamZam receipt id that is not digits only. CBE, Dashen and ZamZam links redirect to the bank's own receipt page; Zemen (and older CBE receipts) are served as the bank's PDF.

### Older receipts

Older CBE receipts that only show an FT reference still work as a legacy format: pass the receiving account (at least the last 8 digits). CBE's older receipt service is often unreachable, so prefer the receipt link when you have it.

```php
$result = $client->verify('cbe', 'FT26SAMPLE01', '1000000006171');
$url = $client->getReceiptUrl('cbe', 'FT26SAMPLE01', '1000000006171'); // the bank's PDF
```

## Timeouts and retries

- **65 s per attempt** (`VerifyOptions::DEFAULT_TIMEOUT`), 10 s to connect. The server may spend up to 60 s.
- **At most one retry** (`withMaxRetries(0)` disables it), and only where it is safe (the same rule in every cheki SDK):
  - `GET` (banks, health): a network error or a 5xx.
  - verify: a network error, or a 429/503 whose `Retry-After` is at most 60 s.
  - batch: only a 429/503 with a short `Retry-After`. Never a network error or a 5xx: a 504 means the batch ran out of server time, and replaying it would hit every bank again and charge every receipt against the rate limit.
  - Never: timeouts, other 4xx, a geo-blocked bank (502 with `fallbackUrl`), or any error the server marks `retryable: false`. A 500/502/504 on verify is not retried either: the server already ran the check, with its own 2 attempts per bank.
- The retry waits for `Retry-After`; a network-error retry waits 1-2 s.
- cURL is limited to HTTP and HTTPS.
- The server tries each bank at most 2 times, so one call reaches the bank at most **4 times**.
- Redirects are not followed.

```php
use Cheki\VerifyOptions;

$client = new ChekiClient(
    (new VerifyOptions())->withBaseUrl('https://cheki.et')->withTimeout(65)->withMaxRetries(1)
);
```

## Changes in 1.5.0

- Requires PHP 8.1+ (8.0 is end-of-life and was never tested).
- Retries only where safe (see above): a 5xx on `verify()` or `verifyBatch()` and the geo-block 502 are no longer retried.
- `VerifyResult::$orderId`, `Bank::$beta`, batch items keep `fallbackUrl`; `getReceiptUrl('zamzam', ...)` needs a numeric id.
- The Packagist package now contains only the SDK (`sdks/php/src`), not the whole repository.

## Breaking changes in 1.4.1 (repo) / 1.5.0 (Packagist)

Packagist's 1.4.1 was built from an older commit, so these reach Packagist users in 1.5.0:

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
