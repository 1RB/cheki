# Telebirr receipt QR ("Payment QR Code")

The in-app Telebirr receipt shows a **Payment QR Code**. cheki reads the
transaction number out of it and then checks that number with Telebirr exactly
as if it had been typed. Decoder: [`src/lib/qr/telebirr.ts`](../src/lib/qr/telebirr.ts).

**The QR is not proof of payment.** It holds the transaction number and
nothing else cheki uses: no amount, no names. Anyone who knows a transaction
number can make a valid QR for it. A result is only ever verified when
Telebirr's own receipt page confirms it and the post-parse gate passes, the
same as for a typed reference.

## Format

Worked out from one real receipt (2026-10-10). The real payload is not
committed; every example and fixture below uses the fake transaction number
`ABC1D2E3F4`.

```
QR text (base64):
  ODAxODAwMDIwNjAxMDI5MTAyMDEzMTgxMjQwMDBBNDE0MjQzMzE0NDMyNDUzMzQ2MzQ2MzA0RTk2OQ==

base64-decoded, an ASCII hex string (58 characters):
  80180002060102910201318124000A414243314432453346346304E969
```

The hex string is a TLV list **over the hex characters**, EMVCo style:
two characters of tag, then two **decimal** digits giving the value length in
characters.

| Tag | Length | Value | Meaning |
|-----|--------|-------|---------|
| `80` | `18` | `000206010291020131` | Unknown. 9 bytes that parse cleanly under neither the EMVCo rule nor a byte TLV. cheki ignores it. |
| `81` | `24` | `000A41424331443245334634` | Hex bytes holding a byte-level TLV (1-byte tag, 1-byte length in bytes): tag `00`, length `0x0A`, value `ABC1D2E3F4` in ASCII = **the transaction number**. |
| `63` | `04` | `E969` | CRC (below). |

Interpretations tried and rejected:

- **BER-TLV over the bytes** (`80 18 ...`): tag `80` would claim 0x18 = 24
  bytes, but the next tags do not line up and 3 bytes are left over.
- **Lengths as hex**: `80 18` would be 24 characters and cut into tag `81`.
- **Lengths in bytes at the top level**: `63 04` would be 4 bytes, but only 2
  follow.

Only "decimal length in characters" consumes the string exactly at the top
level; inside `81` the length is a byte count (`0A` is not decimal).

### CRC

`63 04 XXXX` is a **CRC-16/CCITT-FALSE** (poly `0x1021`, init `0xFFFF`, no
reflection, no final XOR), the EMVCo QR checksum, computed over every
character before the CRC value, `6304` included.

It is computed over the characters **as emitted, so it is case-sensitive**.
The real receipt mixes cases: lengths and CRC in upper case, the
transaction-number bytes in lower case, e.g. for the fake number `XKJ0L9N8M7`:
`...8124000A584b4a304c394e384d376304D22B`. The CRC matched the
real payload only over the original-case string; upper-casing it first gives a
different value. Over the decoded bytes, or without `6304`, nothing matched
either (CRC-16 variants tried: CCITT-FALSE, XMODEM, KERMIT, X-25, MCRF4XX,
ARC, MODBUS).

Because it validated on the real receipt, cheki **enforces** the CRC: a QR
whose CRC does not match is rejected ("type the transaction number instead").
Hex is otherwise parsed case-insensitively.

## Rules the decoder follows

- Input: any string. Whitespace anywhere is removed; URL-safe base64 (`-`,
  `_`) and missing `=` padding are accepted. A string that is already the hex
  form is accepted too.
- Size caps before any work: 1,024 characters of QR text, 512 hex characters,
  16 TLV entries.
- Rejects without throwing: non-base64, decoded text that is not hex, odd-length
  hex, a length running past the end, leftover characters, a missing or
  misplaced `63` CRC, a CRC mismatch, no `81` or more than one, no tag `00`
  inside it, a transaction number that is not exactly 10 uppercase letters and
  digits (`^[A-Z0-9]{10}$`).
- Only anchored single character-class regexes: nothing can backtrack.

## Where it is used

- **Checker** (`VerifyPanel`): a QR from an uploaded or pasted screenshot,
  the camera, or pasted QR text is swapped for the transaction number and
  Telebirr is chosen, so the normal Telebirr flow runs: the browser-first
  "Open the Telebirr receipt" panel (Telebirr only answers Ethiopian networks),
  the paste and bookmarklet fallback, and the server check on request. On
  another bank's page the QR is reported as a Telebirr receipt, never sent to
  that bank.
- **Detection** (`detectInput`): kind `telebirrQr`, checked before the BOA QR
  test (a Telebirr payload can be a multiple of 16 bytes; the CRC-checked
  structure can never match BOA ciphertext). `value` is the transaction number.
- **API**: `POST /api/verify` and `/api/verify/batch` accept it in `qrData`
  with bank `telebirr` (or no bank). The verifier reads the number and resolves
  it as a Telebirr reference. With another bank named it answers 400.
- **Manifest**: format `telebirr-receipt-qr` (input-only, `via:
  telebirr-receipt-html`, no parser, never fetched). `GET /api/banks` lists
  it with `inputs: ["qr"]`.

Recent checks store only the transaction number, never the QR text.
