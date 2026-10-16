# Mobile polish: before / after

Captured from local `next start` builds of `main` (1138606, "before") and `ui/mobile-polish` ("after"), same session, Playwright Chromium with touch emulation, DPR 2, `--font-render-hinting=none`, viewport shots resized to 1000px tall. `/api/verify` is mocked with a verified CBE receipt.

| Shot | What to look at |
| --- | --- |
| `*-360-home.png` | Before: the receipt field and Check receipt run ~26px past the card. After: inside the card; bank picker face stays 13px. |
| `*-390-status.png`, `*-390-endpoints.png` | Unchanged layouts; `/endpoints#telebirr` lands below the sticky nav. |
| `*-390-dark-menu.png` | Full-screen menu (now pads for the home indicator). |
| `*-390-footer.png` | Before: 21px links in one column. After: 44px rows in two columns. |
| `*-390-dark-developers.png` | Before: POST badge white on near-white (1.19:1). After: readable. |

The home-verified and bank-cbe-code shots were removed on 2026-10-16: they showed a real CBE Receipt ID and FT reference in the mocked response.
