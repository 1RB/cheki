# Changelog

## 1.5.0

- Responses are decoded as UTF-8 from the bytes, and `http` must be 1.4.0 or newer (older versions decoded `application/json` without a charset as latin1, garbling Amharic names and messages). Requires Dart 3.4+, as `http` 1.4.0 does.
- Retries only where safe, the same rule as every cheki SDK: `GET` on a network error or 5xx; `verify` on a network error or a 429/503 with a `Retry-After` of at most 60 s; `verifyBatch` only on a 429/503 with a short `Retry-After`. A geo-blocked 502, a 5xx on a POST, a timeout and an error marked `retryable: false` are never retried.
- `BankInfo.beta` (true for M-Pesa and ZamZam), `VerifyResult.orderId` (CBE Birr) and `VerifyResult.fallbackUrl` on failed batch items.
- `getReceiptUrl('zamzam', ...)` rejects an id that is not digits only.
- `ChekiClient.recommendedBatchChunk` (15) for long lists.
- Shorter pubspec description (pub.dev's 60 to 180 characters).

## 1.4.1

- First release on pub.dev. Versions match the other cheki SDKs (npm `cheki-verify`, PyPI `cheki`, Packagist `cheki/cheki`, Go `github.com/1RB/cheki/sdks/go`).
- `ChekiClient` for the hosted API at https://cheki.et: `verify`, `verifyBatch` (max 20), `getBanks`, `getHealth` and `getReceiptUrl`.
- 65 s per attempt and at most one retry (network error, 5xx or 429, honouring `Retry-After`); typed exceptions for rate limits and API errors.
- `isVerified` is the only success signal: it is true only when the bank confirmed the receipt.
- No `dart:io` import, so it also builds for Flutter web.
