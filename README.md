# cheki

**Free, open-source Ethiopian bank receipt verification. No signup. No API key. No scam.**

cheki verifies Ethiopian bank and mobile money receipts by fetching public bank endpoints. The data is free. The code is MIT licensed. No one should charge you for accessing public bank data.

## Why?

check.et charges 499 ETB/month. verify.et charges $20-40/month. Both verify receipts by hitting the same public bank URLs cheki uses for free. cheki exposes this and provides the same service for free, forever.

## Supported banks

| Bank | Code | Status | Requires account | Geo-blocked |
|------|------|--------|-----------------|-------------|
| Commercial Bank of Ethiopia | `cbe` | Live | Yes (last 8 digits) | No |
| Telebirr (Ethio Telecom) | `telebirr` | Live | No | Yes (Ethiopia only) |
| Bank of Abyssinia | `boa` | Live | Yes (last 5 digits) | No |
| M-Pesa Ethiopia | `mpesa` | Live | No | Yes (Ethiopia only) |
| Dashen Bank | `dashen` | In development | No | No |
| Awash Bank | `awash` | In development | No | No |
| Zemen Bank | `zemen` | In development | No | No |
| CBE Birr | `cbebirr` | In development | Phone required | No |
| Siinqee Bank | `siinqee` | In development | No | No |

## Quick start

### Web UI

Visit https://cheki.app — no signup required.

### API

```bash
curl -X POST https://cheki.app/api/verify \
  -H "Content-Type: application/json" \
  -d '{"bank":"cbe","reference":"FT26140P01YB","accountNumber":"1000560536171"}'
```

### Python

```bash
pip install git+https://github.com/1RB/cheki.git#subdirectory=python
```

```python
from ethio_receipt_verify import verify
result = verify("cbe", "FT26140P01YB", account="1000560536171")
```

### Self-hosting

```bash
git clone https://github.com/1RB/cheki.git
cd cheki
docker-compose up -d
```

Self-hosting on an Ethiopian IP bypasses Telebirr/M-Pesa geo-blocks.

## Features

- **Web UI** — receipt aesthetic, auto-detect bank from reference format
- **REST API** — free, no API key, no rate limit
- **Batch verification** — up to 50 receipts at once
- **TypeScript SDK** — included in monorepo
- **Python library** — install from monorepo
- **Docker** — self-hosting with docker-compose
- **SEO** — bank-specific pages, guides, sitemap, structured data
- **AI-friendly** — llms.txt, allows all AI crawlers in robots.txt

## How it works

Each Ethiopian bank publishes transaction receipts at public URLs:

1. **CBE**: `https://apps.cbe.com.et:100/?id={FT_REFERENCE}{LAST_8_DIGITS}` → PDF
2. **Telebirr**: `https://transactioninfo.ethiotelecom.et/receipt/{REFERENCE}` → HTML
3. **BOA**: `https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={REFERENCE}{LAST_5_DIGITS}` → JSON
4. **M-Pesa**: `https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={REFERENCE}` → JSON

cheki fetches these URLs, parses the response, and returns structured JSON.

## Project structure

```
src/
  app/
    page.tsx              # Homepage with verify widget
    banks/
      page.tsx            # Bank listing
      [code]/page.tsx     # Individual bank pages (SSG)
    guides/
      page.tsx            # Guide listing
      [slug]/page.tsx     # Individual guide pages (SSG)
    developers/page.tsx   # Developer/API page
    compare/page.tsx      # Comparison with check.et/verify.et
    docs/page.tsx         # API documentation
    api/
      verify/route.ts     # POST /api/verify
      verify/batch/route.ts # POST /api/verify/batch
      banks/route.ts      # GET /api/banks
      health/route.ts     # GET /api/health
      receipt/route.ts    # GET /api/receipt
    sitemap.ts            # Dynamic sitemap
    robots.ts             # robots.txt (allows AI crawlers)
  lib/
    banks.ts              # Bank data and detection
    guides.ts             # Guide articles data
  components/
    Chrome.tsx            # Nav and Footer
python/                   # Python library
Dockerfile
docker-compose.yml
public/llms.txt           # LLM-friendly content summary
```

## Contributing

1. Fork the repo
2. Create a branch: `git checkout -b feature/bank-name`
3. Add the bank parser in `src/app/api/verify/route.ts`
4. Add bank data in `src/lib/banks.ts`
5. Test with a real receipt reference
6. Submit a PR

## License

MIT

## Disclaimer

cheki is not affiliated with any Ethiopian bank or wallet. It uses publicly accessible receipt endpoints. All data comes from official bank systems.
