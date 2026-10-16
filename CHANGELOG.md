# Changelog

Every cheki SDK ships the same version: npm `cheki-verify` (and `@1rb/cheki-verify` on GitHub Packages), PyPI `cheki`, Packagist `cheki/cheki`, pub.dev `cheki` and the Go module `github.com/1RB/cheki/sdks/go` (tag `sdks/go/vX.Y.Z`). The Dart package keeps its own copy in `sdks/dart/CHANGELOG.md` for pub.dev.

## Unreleased

**CBE Birr (still in development)**
- A real contributed receipt came back from `cbepay1.cbe.com.et` as the same empty "Auto Receipt" page an unknown receipt number gets, when fetched from outside Ethiopia. When CBE Birr goes live, that page is reported as "could not confirm" (502 with `fallbackUrl`, the receipt link), never as not found.
- Phone numbers are sent as `251XXXXXXXXX` (the form CBE Birr's own links use); `09…`, `07…` and `+251…` are accepted. Receipt numbers are 10 or 11 letters and digits.
- Fix: an 11-character receipt number lost its first character in the PDF layout, so the gate would have rejected a real receipt.
- Python direct mode: CBE Birr no longer reports any HTTP 200 as verified (an empty page passed), no longer crashes with a duplicate `timeout` argument, URL-encodes the receipt number and phone, and no longer keeps the response body in `raw`.

## 1.5.0

The first registry release of the SDK rework: npm, PyPI and Packagist 1.4.1 were built from June 2026 code, so everything listed under 1.4.1 below reaches those registries now.

**Safer retries (all SDKs, one shared rule).** At most one retry, and only where it is safe:
- `GET` (banks, health): a network error or a 5xx.
- `POST /api/verify`: a network error, or a 429/503 with a `Retry-After` of at most 60 s.
- `POST /api/verify/batch`: only a 429/503 with a short `Retry-After`. A batch is never replayed after a 5xx (a 504 means it ran out of server time) or a network error, because the replay hit every bank again and charged every receipt against the rate limit.
- Never: timeouts, other 4xx, a geo-blocked bank (502 with `fallbackUrl`, which used to cost an extra ~9 s for the same answer), or an error marked `retryable: false`. A 429 without `Retry-After` is no longer retried.
- `sdks/fixtures/api-contract.json` gained `retryCases`, which every SDK's tests run.

**Fixes**
- Dart: responses are decoded as UTF-8 from the bytes, and `http` must be 1.4.0+ (older `http` decoded `application/json` without a charset as latin1, garbling Amharic names and messages). The Dart SDK constraint is now `>=3.4.0`, as `http` 1.4.0 requires.
- Python: direct mode no longer turns off TLS verification for Awash (Awash serves a complete, publicly trusted chain), so nobody on the network path can forge an Awash receipt.
- Python: a `requests.Session` you pass in is no longer modified. The `User-Agent` and API key go on each request, so the key never leaks to other hosts the session calls, and `close()` leaves your session open.
- Python: batch `index` is the position in the response even if a malformed item is skipped, and an item without `bank` raises `ValueError` (it raised `KeyError`).
- PHP: cURL is limited to HTTP(S); `curl_close()` calls removed (deprecated in PHP 8.5).

**Added**
- `beta` on banks in Python, Go, PHP and Dart (TypeScript always sets it now): true for M-Pesa and ZamZam.
- `orderId` / `order_id` / `OrderID` on results (CBE Birr receipts).
- Batch error items keep `fallbackUrl` when the server sends one.
- `getReceiptUrl` rejects a ZamZam receipt id that is not digits only, as the server does.
- `RECOMMENDED_BATCH_CHUNK` (15) in every SDK; the docs explain chunking long lists.

**Packaging**
- Python: the API client depends on `requests>=2.33.0` and `urllib3>=2.8.0` only. `beautifulsoup4` and `pdfplumber` moved to the `cheki[direct]` extra for the deprecated direct mode (`pdfplumber>=0.11.9`, `pdfminer.six>=20251230`); without it direct mode raises `DirectModeUnavailableError`. The wheel ships `LICENSE` (SPDX `license = "MIT"`). Python 3.14 is tested.
- PHP: requires PHP 8.1+; CI tests 8.1, 8.3 and 8.4. The Packagist package contains only the SDK (`.gitattributes` export-ignore), and the root `composer.json` matches `sdks/php/composer.json`.
- TypeScript: `engines.node` is `>=20`.
- Go: CI tests the `go 1.21` floor and the current release.
- Dart: pubspec description within pub.dev's 60 to 180 characters.

**Release pipeline**
- `scripts/bump-version.sh --files-only X.Y.Z` (release PR) and `--tag-only X.Y.Z` (tag the merged main); it also updates the Go install pin and checks this changelog.
- `publish.yml` fails when a registry already has the version (except on a re-run), checks the wheel and the Packagist dist, and ends with a job that polls every registry until it serves the release from the tagged commit (`scripts/check-registries.mjs`).

## 1.4.1

Repository code (Go and pub.dev shipped it; npm, PyPI and Packagist got it in 1.5.0): banks identified by `id` (`code` kept as an alias), health and batch models that match the API, typed 429 and 413 errors, a 65 s timeout and at most one retry, a client-side limit of 20 receipts per batch, `getReceiptUrl`, decoded-only BOA QR results that never count as verified, Python 3.10+, and the deprecated Python direct mode behind a fail-closed gate.
