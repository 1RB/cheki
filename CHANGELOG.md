# Changelog

Every cheki SDK ships the same version: npm `cheki-verify` (and `@1rb/cheki-verify` on GitHub Packages), PyPI `cheki`, Packagist `cheki/cheki`, pub.dev `cheki` and the Go module `github.com/1RB/cheki/sdks/go` (tag `sdks/go/vX.Y.Z`). The Dart package keeps its own copy in `sdks/dart/CHANGELOG.md` for pub.dev.

## Unreleased

**Bunna Bank (beta)**
- cheki checks Bunna Bank receipts. Paste the receipt link (`online.bunnabanksc.com/receipt/#/{token}`) or scan the QR on the receipt (`online.bunnabanksc.com/#/receipt-v2/{token}`): cheki sends the token to the JSON service behind Bunna's own receipt page and shows the amount, date, payer, receiver (account numbers masked by Bunna) and Bunna's transaction reference. Beta: one real receipt confirmed so far.
- The token is opaque base64 and case-sensitive. Only its URL encoding is normalised (`%2B`, a `+` that became a space, base64url, missing padding), so a link, the QR and a pasted token share one cache entry. A typed transaction number (`BB…`) is rejected before any request: Bunna does not look receipts up by it.
- Bunna answers `{"status":"FAILURE","message":"Something went wrong!"}` for an unknown token, a cut-off link and its own errors alike, so cheki reports that as not confirmed (422 with `checkedUrl`, Bunna's receipt page), never as fake. The daily health check probes an all-zero token and expects that envelope.
- SWIFT code BUNAETAA was already on the bank page (from Bunna's correspondent-banking page). Copy, llms.txt, README, the formats guide and SDK descriptions now count 11 live banks, 9 checked directly. No SDK code change: `verify` takes the link as `reference`.

**Security updates**
- Next.js and eslint-config-next 16.4.1 (GHSA-673q-mjm6-r5xr, CVE-2026-96889 / GHSA-2464-fhr4-w9xw, GHSA-p3m5-59mp-jv5r), sharp resolves 0.35.5 or later, undici resolves 7.30.1 or later (GHSA-qrxm-fqhp-jwvm). Dev only: vitest 4.1.12 with vite 8.1.6 or later. Python SDK: requires `certifi>=2026.10.19` (GHSA-6q48-6c7w-9gw2).

**References typed in lowercase**
- A reference typed in lowercase now works. For the banks whose receipts print references in capitals (CBE FT references, BOA, Telebirr, M-Pesa, Dashen, CBE Birr), cheki trims it, drops spaces and dashes typed inside when that gives the bank's format, and uppercases it: `det0sample` is checked as `DET0SAMPLE`. One shared rule (`src/lib/reference-case.ts`) is used by `POST /api/verify` (so the batch route, the CLI and every SDK get it), `GET /api/receipt`, the cache key and the form.
- Left exactly as given: CBE Receipt IDs (`fHCx…`, `v2-…`), Awash and eBirr/Siinqee share tokens, ZamZam ids (spaces between digits are dropped) and the Telebirr receipt QR payload, whose CRC covers its raw characters. A reference read out of a receipt link or QR is uppercased but never compacted.
- The form shows the reference in capitals when you leave the field or check it. If the bank still has no such receipt, or rejects the reference, and what was typed had lowercase letters, spaces or dashes or not the bank's usual shape, the card adds: "References are usually capital letters and digits (like FT25…). Scan the receipt's QR code or paste its link, or copy the reference exactly as printed."
- SDKs: `getReceiptUrl` / `get_receipt_url` / `GetReceiptURL` send a lowercase or spaced CBE FT reference, Dashen FT Ref or ZamZam id in the bank's form (shared `receiptUrlCases` fixture). Python's deprecated direct mode applies the same rule as the server.

**Guide: the Telebirr receipt QR code**
- New guide at /guides/telebirr-receipt-qr-code: how the Payment QR Code on a Telebirr receipt was decoded (base64, an EMVCo-style TLV over hex characters, a byte TLV holding the transaction number, a case-sensitive CRC-16/CCITT-FALSE), a Python decoder, and why a valid QR is not proof of payment. Synthetic examples only. It follows the link-out copy: cheki.et opens Telebirr's official ethiotelecom receipt page (QR first, link second, typed number as the fallback), and the amount, receiver name and date are checked there.
- Linked from the Telebirr bank page's QR section, the CBE, BOA and receipt-formats guides, the /guides index (For developers) and llms.txt.

**Search fixes from the October Search Console review**
- A path with a capital letter (`/Guides`, which Google had indexed as a 404) now answers one 301 to its lowercase form, query kept (`src/proxy.ts`). API, assets and files are untouched.
- eBirr page: a USSD code section per partner (Nib *617#/*635#, COOPay-Ebirr *841#, Kaafi and Wegagen *602#) and FAQs for the dial code and receipt.ebirr.com. "ebirr code" was the page's top query with no clicks.
- CBE page: an FAQ confirming mbreciept.cbe.com.et (spelled "reciept") is CBE's own receipt address.
- Fraud guide: section 6 is now "Fake Telebirr receipts and SMS spoofing" and covers edited screenshots as well as fake SMS, so the page answers "fake telebirr receipt" again. It says to scan the receipt QR first (link second, typed number as the fallback); cheki opens the official ethiotelecom receipt page, where the amount, receiver name and date are checked.
- README: the heading names the product ("Ethiopian bank receipt verifier") and the banks it checks (8 directly, Telebirr and M-Pesa through their official receipt pages), which become the GitHub page's heading and description text.

**Homepage on phones**
- The endpoint list no longer cuts receipt URLs off: on a phone each URL has its own line under the bank name and badge, and wraps at its slashes and dots. Rows keep a wider right margin so a browser's floating page button doesn't sit on the text. Desktop is unchanged.
- "Let your agent integrate it" now sits where it does on desktop: right after the checker, before the endpoint list, instead of after the FAQ at the very bottom.
- The "Official page" badge on the Telebirr and M-Pesa tiles drops below the name on narrow tiles instead of cutting the name to "T…".

**Telebirr and M-Pesa are link-out until a local relay exists**
- Telebirr and M-Pesa block cloud servers, so cheki.et cannot check them: `POST /api/verify` answers 502 with `fallbackUrl`, the official receipt page. The site now says so instead of counting them as checked live. Copy reads "8 banks and wallets checked directly, plus Telebirr and M-Pesa through their official receipt pages" on the homepage, `/banks`, the Telebirr and M-Pesa pages, `/compare`, `/about`, the guides, the FAQ and its structured data, the meta and web manifest descriptions, the Open Graph cards, `llms.txt`, the README and the SDK READMEs. Direct checks return once a local relay is live.
- The verify card for these banks is titled "Not checked: {bank} blocks cheki's server", stays neutral (never green), keeps "Open the official receipt" as its one primary action, and adds one line: check the amount, the receiver's name and the date before releasing goods. The browser-first panel says the same.
- The Telebirr and M-Pesa Open Graph cards no longer show a "Verified with" result.
- The 502 error text no longer reads "Open the receipt directly: Try the new receipt format: <link>"; it ends "Open the receipt directly: <link>". The response shape and `/api/banks` (both stay `status: "live"`; a self-hosted server on an Ethiopian network checks them) are unchanged.

**Re-check links for shared results**
- A verdict now has a "Copy re-check link" button, and Share and Copy result include the link. Opening it fills the form and asks the bank again in the recipient's browser, so the person receiving it gets the bank's answer, not the sender's.
- The link carries only what was entered (receipt link or reference, bank, and the account digits or phone the bank needs) and nothing about the result. It sits in the URL fragment, so it never reaches the server, logs or analytics, and search engines don't index it. Nothing is stored.

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
