# Changelog

Every cheki SDK ships the same version: npm `cheki-verify` (and `@1rb/cheki-verify` on GitHub Packages), PyPI `cheki`, Packagist `cheki/cheki`, pub.dev `cheki` and the Go module `github.com/1RB/cheki/sdks/go` (tag `sdks/go/vX.Y.Z`). The Dart package keeps its own copy in `sdks/dart/CHANGELOG.md` for pub.dev.

## Unreleased

**Search fixes from the October Search Console review**
- A path with a capital letter (`/Guides`, which Google had indexed as a 404) now answers one 301 to its lowercase form, query kept (`src/proxy.ts`). API, assets and files are untouched.
- eBirr page: a USSD code section per partner (Nib *617#/*635#, COOPay-Ebirr *841#, Kaafi and Wegagen *602#) and FAQs for the dial code and receipt.ebirr.com. "ebirr code" was the page's top query with no clicks.
- CBE page: an FAQ confirming mbreciept.cbe.com.et (spelled "reciept") is CBE's own receipt address.
- Fraud guide: section 6 is now "Fake Telebirr receipts and SMS spoofing" and covers edited screenshots as well as fake SMS, so the page answers "fake telebirr receipt" again.
- README: the heading names the product ("Ethiopian bank receipt verifier") and the banks it checks, which become the GitHub page's heading and description text.

## 1.6.0

SDKs: every SDK reads `checkedUrl` (the bank page cheki asked) on a 422 and on failed batch items; see "BOA receipts filed under the payer's account" below. The rest of this entry shipped to cheki.et as it merged.

**Batch check results built for end-of-day reconciliation**
- Several screenshots at once now read like a ledger: the confirmed total on top (bank-confirmed amounts only), then a numbered line per screenshot with its verdict, reference and amount in one right-aligned column.
- A receipt that appears twice is red ("Same receipt as #1") and counted once.
- Rows open in place: the reference (with copy), payer, receiver, paid date, bank, a downscaled preview made only when opened, and the bank's page. Unavailable or rate-limited rows can be retried.
- Images wait their turn ("Waiting") and are scanned one at a time. Reading the text of a screenshot without a QR (OCR) is slow, so it is offered per row or for all of them, not run by default.
- "Show N that need a look" filters to the rows to chase.
- Copy summary (in the screen's own words) and Download CSV. The CSV carries amounts and names only for bank-confirmed first copies, and defuses cells that would run as spreadsheet formulas.
- Screen readers hear the batch once, when it finishes.

**BOA receipts filed under the payer's account**
- BOA files some receipts under the source account's last 5 digits instead of the receiver's (seen on an Apollo app transfer). A BOA QR carries both accounts, so when BOA answers "Invalid reference number" under the receiver and the QR's source account is full (not masked), cheki asks once more under it. An unreadable BOA answer is unconfirmed, never a "no", and triggers no retry. BOA still decides, and its amount must still match the QR.
- A typed BOA lookup that finds nothing now says to try the source account's last 5 digits.
- A 422 from `/api/verify` and a failed batch item now carry `checkedUrl` (https only), the bank page cheki asked, so anyone can see the bank's own answer. The verify card links it as "Bank's answer". Every SDK reads it: `checkedUrl` (TypeScript `ChekiAPIError` and batch items, PHP and Dart), `checked_url` (Python), `CheckedURL` (Go `APIError` and batch items).

**CBE Birr is live (beta)**
- Verified on 2026-10-16 against two real receipts (a wallet transfer and a transfer to a bank account). A matching receipt number and payer phone return the receipt as a one-page PDF, also from outside Ethiopia, so CBE Birr is not geo-blocked. Live banks: 9 → 10; `beta` is true for M-Pesa, ZamZam and CBE Birr.
- Fields read: payer name and wallet number, receiver name and account, amount, service charge, VAT, total paid, date (Addis Ababa time, no offset), status, receipt number, order ID, amount in words, payment reason and payment channel. The PDF prints both phone numbers in full; cheki masks them (`09****1234`).
- The empty "Auto Receipt" page means the receipt number and phone don't match (the earlier contributed receipt was such a pair). It stays "could not confirm" (502 with `fallbackUrl`, the receipt link), never not found, and now says to check both.
- Fix: the real PDF draws its values in a different order from their labels, so flowed text read the payment reason and channel wrongly. The PDF is now read as positioned rows. Real rows also put spaces between the receipt number, date and amount, wrapped long names onto a second row, and print "VAT Registration No" above the VAT amount; all three are handled.
- Phone numbers are sent as `251XXXXXXXXX` (the form CBE Birr's own links use); `09…`, `07…` and `+251…` are accepted. Receipt numbers are 10 or 11 letters and digits.
- Fix: an 11-character receipt number lost its first character in the PDF layout, so the gate would have rejected a real receipt.
- Python direct mode: reads the CBE Birr receipt PDF (phones masked) and runs it through the gate; an empty page is never verified. It no longer crashes with a duplicate `timeout` argument and URL-encodes the receipt number and phone.
- CBE Birr receipt QR: the QR at the bottom right of the receipt is the receipt's own link (`cbepay1.cbe.com.et/aureceipt?TID=…&PH=…`), so a scan or upload fills both the receipt number and the payer phone. It works in the web scanner and photo upload, in `/api/ocr` (which now also returns `phoneNumber`), as `qrData` in `/api/verify` with bank `cbebirr` or no bank, and in `cheki verify-qr <qr-data>`. The pair in the QR wins over a typed phone, and a CBE Birr QR sent with another bank is reported, not re-routed. Like every QR it is only an input.
- Verify panel: a CBE Birr link without a phone opens the phone field, and `07…` (Safaricom) numbers are accepted there as on the server.
- CLI: `cheki verify cbebirr <receipt number> -p <payer phone>` is in the help, `cheki verify-qr` takes the bank as optional, and `cheki info` marks beta banks and the phone requirement.
- Tests use a synthetic PDF with the real layout (`tests/fixtures/cbebirr/synthetic-receipt.ts`); no real receipt data is committed.

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
