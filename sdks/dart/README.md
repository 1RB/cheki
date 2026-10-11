# cheki Dart SDK

Dart client for the [cheki](https://cheki.et) receipt verification API: verify Ethiopian bank transfer receipts from CBE, Telebirr, BOA, Dashen, M-Pesa (beta: not yet confirmed with a real receipt), Awash, Siinqee and eBirr (the live banks; `getBanks()` lists the current set). No `dart:io` import, so it also builds for Flutter web (the hosted API sends no CORS headers on these routes, so browser calls still need your own backend).

## Install

Not on pub.dev yet (`dart pub add cheki` does not work). Use a git dependency:

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

More than 20 receipts (or none) throws `ChekiValidationException` without a request. Each receipt also counts against the per-IP verify limit (30 per minute).

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

Only `cbe`, `zemen` and `dashen`; anything else throws `ChekiValidationException`. CBE and Dashen links redirect to the bank's own receipt page; Zemen (and older CBE receipts) are served as the bank's PDF.

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
- **No retries on 4xx** (except 429) and **none on timeouts**.
- **At most one retry** on a network error, 5xx or 429, after `Retry-After` when sent (up to 60 s), otherwise 1-2 s. `ChekiClient(maxRetries: 0)` disables it.
- The server tries each bank at most 2 times, so one call reaches the bank at most **4 times** (a batch: 4 per receipt).

## Tests

```bash
dart pub get && dart analyze && dart test   # decodes ../fixtures/api-contract.json
```
