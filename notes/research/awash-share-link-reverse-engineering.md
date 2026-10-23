# Awash receipt share-link: reverse-engineering notes (research only)

Status: RESEARCH / NOT PUBLISHED. Ray (2026-10-23) decided this does not belong on
the public /banks/awash page or the live guide (PR #68 removes it there) because it
(a) claims a capability production doesn't have — cheki does not brute-force — and
(b) reads as an enumeration recipe against Awash's live server. Kept here as the
record of the finding. Do not paste counter rates, scan speeds, WAF/backend product
names, or the brute-force how-to into any public page or article.

## Share-link structure
URL: `https://awashpay.awashbank.com:8225/-{TX_ID_BASE36}-{COUNTER_BASE36}`
- Part 1: numeric Transaction ID, base-36, case-insensitive.
- Part 2: server-side counter, 6 base-36 chars, strictly validated.
- Input needed: full share link (SMS/app). No account number. Not geo-blocked.

## Transaction ID structure (since 2026)
`YYMMDDHHMM` + 5-digit per-minute sequence. Example 260607112200001 =
YY26 MM06 DD07 HH11 MI22 SEQ00001. The SEQ resets each minute, not globally
monotonic. Verified against all 13 new-format samples. Pre-2026 IDs use a
hex-like format (e.g. E3BF28E4B8C1) that does not follow this.

## URL breakdown (synthetic)
`https://awashpay.awashbank.com:8225/-2KDL95XE81-4U0000`
- Part 1 2KDL95XE81 = 260607112200001 (TX ID)
- Part 2 4U0000 = 292253184 (server counter)
Verified with 18 real receipts (Apr 2025–Jun 2026) across Send To Bank, IPS,
Send to Wallet, Telebirr Transfer, Merchant Payment, Other Bank Transfer.
base-36(part1) → exact Transaction ID every time.

## Counter (part 2)
Not a hash of the TX ID. Ruled out CRC32, Adler32, MD5/SHA1/SHA256 truncation,
Java hashCode, DJB2, FNV-1a, HMAC, affine, modulo, bit manipulation. It is a
monotonically increasing server counter whose rate rises with time.

Samples (decimal counter, rate since previous, source):
2025-04-10 78,960,518 — GitHub
2025-07-26 120,823,236 4.4/sec SMS
2025-08-04 124,196,936 5.4/sec GitHub
2025-11-04 167,318,568 5.4/sec SMS
2026-01-28 214,318,325 6.4/sec GitHub SMS
2026-02-11 222,463,161 6.7/sec SMS
2026-03-08 236,606,890 6.6/sec SMS
2026-03-14 240,498,506 7.5/sec SMS
2026-04-01 251,165,242 ~7.1/sec (interpolated) Brute-forced
2026-04-02 251,958,281 ~7.2/sec SMS
2026-04-17 261,177,944 7.1/sec SMS
2026-05-14 277,774,515 7.2/sec Original samples
2026-06-07 292,535,286 7.2/sec Original samples
2026-06-22 302,458,159 7.5/sec Community

Rate accelerating (4.4/sec mid-2025 → 7.5/sec Jun 2026). Quadratic model fits
R²=0.9999, max residual ±1M. Local linear interpolation between near samples
within ±100K.

Validation: replacing part 2 with a nearby value → "Mistmatch / invalid receipt
id"; omitting → "Invalid receipt id"; must be exactly 6 base-36 chars; extra
dashes/special chars rejected by the WAF.

## Server architecture (observed)
MoonlightMBanking (Java, Jetty/Tomcat, JSESSIONID path), nginx, F5 BIG-IP ASM
WAF blocking all non-receipt paths; F5 BIG-IP LB (TS01121d40 cookie). Merchant
API /awashbirrpro/merchant-api/DebitRequest/ (WAF-blocked). Dev API
/awashpaytest/Rest/. Client JS only renders a QR of the pre-baked share URL; no
token-generation logic client-side.

## Brute-force PoC (do NOT publish)
Constructed a valid share URL from a TX ID alone by predicting + brute-forcing
the counter, twice:
- 2026-05-14 pred P2 277,659,280 actual 277,776,101 (+116,821) 116,820 URLs 18.3 min
- 2026-04-01 pred P2 251,236,520 actual 251,165,242 (-71,278) 65,243 URLs 16.5 min
Scans ran 66–106 req/sec, zero WAF blocks, <0.01% error; server did not rate-limit.

## Open questions
1. Is the counter global, or per branch/sender/channel?
2. Why did one TX ID (Mar 28) resist brute-force across 8M+ URLs?
3. Relationship between pre-2026 hex IDs and the YYMMDDHHMM format?
4. Can prediction improve with more samples from thin periods?

## Why this is sensitive
A token opens the full receipt (names, amounts). The brute-force result shows an
authenticated-feeling link can be reconstructed from a TX ID without the app/SMS
— i.e. Awash's receipts are enumerable. That is exactly the "cheki enables a DDoS
/ scraping attack on a bank" story a critic can tell, so it stays out of public
copy. If ever disclosed, it should go to Awash privately, not onto the site.
