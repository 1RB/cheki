# cheki

Free, open-source Ethiopian receipt verification. No signup. No API key. No scam.

Live at **[cheki-pi.vercel.app](https://cheki-pi.vercel.app)**

## What this is

A Next.js web app that lets anyone verify Ethiopian bank and mobile wallet receipts for free. It hits the same public receipt endpoints that check.et and verify.et use, but charges nothing.

## Why

check.et and verify.et charge money to access public bank receipt URLs. The banks publish these receipts on public endpoints. Anyone with a transaction reference can access them. These services are reselling free data.

cheki does the same thing for $0.

## Supported banks

| Bank | Status | Notes |
|------|--------|-------|
| Commercial Bank of Ethiopia | live | PDF parsing, full field extraction |
| Bank of Abyssinia | live | JSON API, full field extraction |
| Telebirr | geo-blocked | Endpoint blocks non-Ethiopian IPs |
| M-Pesa Ethiopia | geo-blocked | Endpoint blocks non-Ethiopian IPs |
| Zemen Bank | coming soon | URL known, parsing in progress |
| Dashen Bank | coming soon | URL known, endpoint often down |
| Awash Bank | coming soon | URL pattern uncertain |
| CBE Birr | coming soon | Server currently times out |

## Tech stack

- Next.js 16 with Turbopack
- TypeScript
- Tailwind CSS
- Server-side API routes (Node.js runtime)
- pdf-parse for PDF text extraction
- cheerio for HTML parsing

## Python library

The verification logic is also available as a Python package:
[ethio-receipt-verify](https://github.com/1RB/ethio-receipt-verify)

## License

MIT
