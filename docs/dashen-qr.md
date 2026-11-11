# Dashen Super App receipt QR (`superappreceipt_…`)

The Dashen Bank Super App receipt page shows a **QR code**. cheki reads the
FT Ref out of it and then handles that reference exactly as if it had been
typed. Decoder: [`src/lib/qr/dashen.ts`](../src/lib/qr/dashen.ts).

**The QR is not proof of payment.** It carries the FT Ref and nothing else
cheki uses: no amount, no names, no date. Anyone who has an FT Ref can make a
valid QR for it. A result is only ever verified when Dashen's own receipt page
confirms it and the post-parse gate passes, the same as for a typed reference.

## Format

Worked out from three real receipts (2026-11). The real payload is not
committed — a real token resolves to a real person's receipt — and every
example and fixture below uses the fake FT Ref `B22WDTI00SAMPLE1`.

```
QR text (81 characters):
  superappreceipt_e49f6442b9980cc18cdd826f93975c72.0123456789abcdef0123456789abcdef

  └── literal ───┘ └──────── payload (32 hex) ────────┘ └── trailing (32 hex) ──┘
```

| Part | Length | Meaning |
|------|--------|---------|
| `superappreceipt_` | 16 chars | Literal type prefix. Unambiguous, so it is matched before every other QR branch. |
| `e49f6442b9980cc18cdd826f93975c72` | 32 hex | The FT Ref, XOR-obfuscated (below). |
| `.` | 1 char | Separator at exactly position 32 of the body. |
| `0123456789abcdef0123456789abcdef` | 32 hex | Opaque. Meaning unknown; cheki checks only that it is 32 hex characters. |

The body after the prefix is always exactly `32 hex + "." + 32 hex` = 65
characters, so the real payload is always 81 characters.

### The payload is the FT Ref XOR a fixed key

The payload holds the 16-byte FT Ref, each byte XOR the same 16-byte key:

```
payload[i] = ref[i] XOR key[i]
```

```
key = a6 ad 56 15 fd cc 45 f1 bc 8e c3 22 c3 db 19 43
```

Worked example, for the fake FT Ref `B22WDTI00SAMPLE1`:

```
'B' = 0100 0010          0x42
key = 1010 0110          0xA6
      ─────────          ────
      1110 0100  = 0xE4  ← first byte of the payload
```

across all 16 bytes that gives `e49f6442b9980cc18cdd826f93975c72`.

The key is **not published by Dashen**; it was derived from known
reference/token pairs and it ships in the app's client bundle, so this is
obfuscation and not encryption: one known pair reveals it, which is exactly how
it was derived. It only stops the reference being read by eye.

**The key must not be rotated.** Every QR already printed carries it, so a new
key would break all of them. The decoder also validates the decoded value
against `^[A-Za-z0-9]{16}$`, so a wrong or rotated key is caught as
`badReference` rather than producing a garbage lookup.

### The trailing 32 hex is not a UUID

It looks like one (32 hex, the shape a UUID would have), but it is not a
UUIDv4. Of three observed payloads only one had a version nibble of `4`, and
**none** carried the RFC 4122 variant bits (`8`, `9`, `a`, `b` in position 16):

| Nibble observed across 3 real payloads | Count |
|---|---|
| version nibble is `4` | 1 of 3 |
| variant nibble is in `89ab` | 0 of 3 |

The payloads themselves are not committed: a real token resolves to a real
person's receipt.

cheki therefore checks only that it is **32 hex characters** and reads nothing
else from it: no version, no variant, no timestamp, no meaning.

### Why the decode has to happen first

The endpoint refuses the raw token. Measured against
`receipts.dashenbanksc.com`:

| Input put in the path | Answer |
|------------------------|--------|
| the raw token (`superappreceipt_…`) | **HTTP 401** `Use the Right Authentication` |
| a real decoded FT Ref | **HTTP 200** receipt page |
| an unknown FT Ref | **HTTP 400** `{"message":"Transaction not found"}` |

(No real reference is reproduced here: the endpoint answers without
authentication, so a reference is enough to pull the receipt.)

A 401 is not in Dashen's `notFoundStatuses` (`[400, 404]`), so sending the raw
token would be mapped to a retryable `ENDPOINT_ERROR` — a client-side input
problem reported to the user as a server outage. That is why the decoder runs
**before** the reference is ever put in a URL, and why the raw token is never
sent anywhere.

## Rules the decoder follows

- Input: any string. Whitespace anywhere is removed before parsing.
- Size caps before any work: 1,024 characters of raw input, 256 after
  whitespace is stripped (the real payload is 81).
- Rejects without throwing: non-string input, empty input, anything without the
  `superappreceipt_` prefix, a body that is not exactly 65 characters, a `.`
  that is not at position 32, non-hex in either half, and a decoded value that
  is not exactly 16 letters and digits (`^[A-Za-z0-9]{16}$`).
- The decoded reference is upper-cased, matching `CASE_RULES.dashen` in
  [`src/lib/reference-case.ts`](../src/lib/reference-case.ts).
- Only anchored single character-class regexes: nothing can backtrack.

## Where it is used

- **Checker** (`VerifyPanel`): a QR from an uploaded or pasted screenshot, the
  camera, or pasted QR text is swapped for the FT Ref and Dashen is chosen, so
  the normal Dashen flow runs. On another bank's page the QR is reported as a
  Dashen receipt, never sent to that bank.
- **Detection** (`detectInput`): kind `dashenQr`, checked after the Telebirr QR
  test and before the BOA QR test. `value` is the decoded FT Ref, so the field,
  the history entry and the share link all use the reference and never the
  token.
- **API**: `POST /api/verify` accepts it in `qrData` with bank `dashen` (or no
  bank). The verifier decodes the FT Ref and resolves it like a typed one. With
  another bank named it answers 400 without fetching. The response never
  contains `superappreceipt_`.
- **Server OCR** (`parseQrReference`): an image whose QR decodes to this shape
  returns `{ bank: "dashen", reference }` at `confidence: "high"`, so the OCR
  route skips OCR for it entirely.
- **Manifest**: format `dashen-receipt-qr` (input-only, `via:
  dashen-receipts-html`, no parser, no endpoint, never fetched). `GET /api/banks`
  lists it with `inputs: ["qr"]`, and `endpointHistory` records when it was
  added.

### Precedence

The prefix is matched in this order inside the QR branch:

1. **Telebirr** — base64 + CRC-16. A Dashen payload contains `_` and `.`, which
   are not in its accepted shape, and its CRC cannot match.
2. **Dashen** — the literal `superappreceipt_`.
3. **BOA** — base64 ciphertext, requires `^[A-Za-z0-9+/]+={0,2}$`, so `_` and
   `.` reject a Dashen payload before any decode.
4. **URL** — needs `:`, `//` or `\`; a Dashen payload has none.

A Dashen payload also cannot be mistaken for a CBE reference: CBE matches
`\bFT[A-Z0-9]{10}\b` and `T` is not a hex character, so the payload can never
contain it.

## Trust model

`receipts.dashenbanksc.com/receipt/{ref}` answers without authentication:
anyone holding an FT Ref can pull the full receipt — names, masked account
numbers, amount, narrative. cheki states that it reads publicly accessible
receipt endpoints, so this is not a new exposure. But it means a green
"verified" is a statement of **authenticity** (Dashen's own record says this),
not **confidentiality**. Treat the QR and the FT Ref as sensitive: whoever has
one has the receipt.
