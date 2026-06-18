# cheki

Free, open-source Ethiopian receipt verification. No signup. No API key. No scam.

**Live:** [cheki-pi.vercel.app](https://cheki-pi.vercel.app)
**API docs:** [cheki-pi.vercel.app/docs](https://cheki-pi.vercel.app/docs)

## Why this exists

check.et and verify.et charge money to access public bank receipt URLs. The banks publish these receipts on public endpoints. Anyone with a transaction reference can access them. These services are reselling free data.

cheki does the same thing for $0.

## Features

### web app
- receipt verification form with bank selector
- result display with all parsed fields + source URL
- "the scam" callout section exposing check.et and verify.et
- live status indicators per bank

### rest api
- `POST /api/verify` - verify a single receipt
- `POST /api/verify/batch` - verify up to 50 receipts in parallel
- `GET /api/banks` - list all supported banks with metadata
- `GET /api/health` - health check with per-bank latency
- `GET /api/receipt` - download original receipt PDF from the bank

### typescript sdk
```typescript
import { Cheki } from "cheki";
const cheki = new Cheki();
const result = await cheki.verify("cbe", "FT26140P01YB", { accountNumber: "1000560536171" });
```

### python library
```bash
pip install git+https://github.com/1RB/cheki.git#subdirectory=python
```
```python
from ethio_receipt_verify import verify
result = verify("cbe", "FT26140P01YB", account_number="1000560536171")
```

### self-hosting
```bash
docker-compose up -d
```

## supported banks

| bank | status | notes |
|------|--------|-------|
| Commercial Bank of Ethiopia | live | PDF parsing, full field extraction |
| Bank of Abyssinia | live | direct JSON API (no Selenium needed) |
| Telebirr | geo-blocked | endpoint blocks non-Ethiopian IPs |
| M-Pesa Ethiopia | geo-blocked | endpoint blocks non-Ethiopian IPs |
| Zemen Bank | coming soon | URL known, PDF parsing |
| Dashen Bank | coming soon | URL known, endpoint unreliable |
| Awash Bank | coming soon | URL pattern uncertain |
| CBE Birr | coming soon | server currently times out |

## comparison

| feature | cheki | check.et | verify.et | ethiobank-receipts |
|---------|-------|----------|-----------|-------------------|
| price | free | paid | paid | free |
| web UI | yes | yes | yes | no |
| rest api | yes | yes | yes | no |
| batch verify | yes | no | no | no |
| health check | yes | no | no | no |
| typescript sdk | yes | no | no | no |
| python lib | yes | no | no | yes |
| docker | yes | no | no | no |
| self-host | yes | no | no | no |
| BOA without Selenium | yes | n/a | n/a | no (requires Chrome) |
| M-Pesa support | yes | no | yes | no |
| CBE Birr support | partial | yes | yes | no |
| receipt PDF download | yes | no | no | no |
| open source | yes | no | no | yes |

## tech stack

- Next.js 16 with Turbopack
- TypeScript
- Tailwind CSS
- Server-side API routes (Node.js runtime)
- pdf-parse for PDF text extraction
- cheerio for HTML parsing

## project structure

```
cheki/
  src/
    app/           # Next.js app router (pages + API routes)
    lib/           # shared types and constants
    sdk/           # TypeScript SDK
  python/          # Python library (ethio-receipt-verify)
    ethio_receipt_verify/
    tests/
  Dockerfile
  docker-compose.yml
```

## license

MIT
