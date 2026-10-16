# cheki Dart SDK

Dart client for the [cheki](https://cheki.et) receipt verification API: verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen, M-Pesa (beta: not yet confirmed with a real receipt), Awash, Siinqee, eBirr, ZamZam (beta: one receipt shape confirmed so far) and CBE Birr (beta: two real receipts confirmed so far) (the live banks; `getBanks()` lists the current set). No `dart:io` import, so it also builds for Flutter web (the hosted API sends no CORS headers on these routes, so browser calls still need your own backend).

Website: [cheki.et](https://cheki.et) · API reference: [cheki.et/docs](https://cheki.et/docs) · Integration guide and every SDK: [cheki.et/developers](https://cheki.et/developers) · Supported banks: [cheki.et/banks](https://cheki.et/banks)

## Install

From [pub.dev](https://pub.dev/packages/cheki):

```bash
dart pub add cheki      # or: flutter pub add cheki
```

To track unreleased changes on `main`, use a git dependency instead:

```yaml
dependencies:
  cheki:
    git:
      url: https://github.com/1RB/cheki.git
      path: sdks/dart
```

## Quick start

```dart
import 'package:cheki/cheki.dart';

final client = ChekiClient(); // 65 s per attempt, at most 1 retry

try {
  final result = await client.verify(
    bank: 'cbe',
    // CBE: the receipt link (or just its Receipt ID) from the CBE app. No account number needed.
    reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01',
  );
  if (result.isVerified) {
    print('${result.senderName} sent ${result.amount} ${result.currency}');
  } else if (result.decodedOnly) {
    print('Decoded from a QR code, NOT confirmed with the bank');
  }
} on ChekiRateLimitException catch (e) {
  print('Rate limited, retry in ${e.retryAfter}');
} on ChekiException catch (e) {
  print('${e.statusCode}: ${e.message} ${e.fallbackUrl ?? ''}');
} finally {
  client.close();
}
```

### `isVerified` is the only success signal

`verify` returns for HTTP 200, and a 200 can be unverified: a BOA QR code BOA could not confirm comes back with `success: true, verified: false, decodedOnly: true`. A QR code can be forged.

QR-only (BOA): `client.verify(bank: 'boa', qrData: '3cHRaxVjn/pySp...')`.

### Batch (max 20)

```dart
final batch = await client.verifyBatch(const [
  BatchReceipt(bank: 'cbe', reference: 'https://mbreciept.cbe.com.et/fHCxExampleRcpt01'),
  BatchReceipt(bank: 'telebirr', reference: 'CHQ0FJ403O'),
]);
print('${batch.verified}/${batch.total} verified, ${batch.failed} not, ${batch.cached} cached');
for (final r in batch.results) {
  print('${r.index}: ${r.isVerified ? 'verified' : 'not verified (${r.status}) ${r.error ?? ''}'}');
}
```

More than 20 receipts (or none) throws `ChekiValidationException` without a request. Each receipt also counts against the per-IP verify limit (30 per minute), and a batch is never retried after a 5xx or network error, so send long lists in chunks of `ChekiClient.recommendedBatchChunk` (15). A failed item has `status` and `error`, plus `fallbackUrl` when the server sends one for a geo-blocked bank. Results carry `orderId` when the receipt has one (CBE Birr), and `BankInfo.beta` is true for M-Pesa, ZamZam and CBE Birr.

### Banks and health

```dart
for (final b in await client.getBanks()) {
  print('${b.id} ${b.name} ${b.type} ${b.status}'); // b.code is a deprecated alias of b.id
}
final health = await client.getHealth(); // cached up to 5 minutes server-side
for (final b in health.banks) {
  print('${b.id}: ${b.status} (${b.latencyMs} ms)');
}
```

### Receipt download links

```dart
client.getReceiptUrl('cbe', 'fHCxExampleRcpt01');
// https://cheki.et/api/receipt?bank=cbe&reference=fHCxExampleRcpt01
```

Only `cbe`, `zemen`, `dashen` and `zamzam`; anything else throws `ChekiValidationException`, and so does a ZamZam receipt id that is not digits only. CBE, Dashen and ZamZam links redirect to the bank's own receipt page; Zemen (and older CBE receipts) are served as the bank's PDF.

### Older receipts

Older CBE receipts that only show an FT reference still work as a legacy format: pass the receiving account (at least the last 8 digits). CBE's older receipt service is often unreachable, so prefer the receipt link when you have it.

```dart
await client.verify(bank: 'cbe', reference: 'FT26140P01YB', accountNumber: '1000560536171');
client.getReceiptUrl('cbe', 'FT26140P01YB', '1000560536171'); // the bank's PDF
```

## Errors

`ChekiException` (`message` is the server's text, `statusCode`, `path`, `fallbackUrl`), with `ChekiRateLimitException` (429, `retryAfter`), `ChekiPayloadTooLargeException` (413), `ChekiTimeoutException` and `ChekiValidationException`.

## Timeouts and retries

- **65 s per attempt** (`ChekiClient.defaultTimeout`). The server may spend up to 60 s.
- **At most one retry** (`ChekiClient(maxRetries: 0)` disables it), and only where it is safe (the same rule in every cheki SDK):
  - `GET` (banks, health): a network error or a 5xx.
  - verify: a network error, or a 429/503 whose `Retry-After` is at most 60 s.
  - batch: only a 429/503 with a short `Retry-After`. Never a network error or a 5xx: a 504 means the batch ran out of server time, and replaying it would hit every bank again and charge every receipt against the rate limit.
  - Never: timeouts, other 4xx, a geo-blocked bank (502 with `fallbackUrl`), or any error the server marks `retryable: false`. A 500/502/504 on verify is not retried either: the server already ran the check, with its own 2 attempts per bank.
- The retry waits for `Retry-After`; a network-error retry waits 1-2 s.
- The server tries each bank at most 2 times, so one call reaches the bank at most **4 times**.
- Responses are decoded as UTF-8 whatever the `content-type` says (needs `http` 1.4.0+, which the pubspec requires), so Amharic names and messages arrive intact.

## Tests

```bash
dart pub get && dart analyze && dart test   # decodes ../fixtures/api-contract.json
```
