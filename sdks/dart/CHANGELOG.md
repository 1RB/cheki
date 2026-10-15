# Changelog

## 1.4.1

- First release on pub.dev. Versions match the other cheki SDKs (npm `cheki-verify`, PyPI `cheki`, Packagist `cheki/cheki`, Go `github.com/1RB/cheki/sdks/go`).
- `ChekiClient` for the hosted API at https://cheki.et: `verify`, `verifyBatch` (max 20), `getBanks`, `getHealth` and `getReceiptUrl`.
- 65 s per attempt and at most one retry (network error, 5xx or 429, honouring `Retry-After`); typed exceptions for rate limits and API errors.
- `isVerified` is the only success signal: it is true only when the bank confirmed the receipt.
- No `dart:io` import, so it also builds for Flutter web.
