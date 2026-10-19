"""M-Pesa Ethiopia (Safaricom) receipt verifier.

``GET https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=<TRANSACTION_ID>``
answers with a JSON envelope that carries the receipt as a base64-encoded PDF::

    {"responseCode": "0", "responseDescription": "...", "base64Data": "JVBERi0..."}

A non-"0" ``responseCode`` (or no ``base64Data``) means there is no receipt.
The endpoint is geo-blocked outside Ethiopia, so cheki has not observed it
itself: the envelope and the PDF labels below are inferred from other
open-source verifiers (Vixen878/verifier-api, nahom-d54/tx-verify,
nahom-d54/veri-py, kira-coding/kira-verify-opensource) and another verifier's
``mpesa-pdf`` source tag. This is a port of ``src/lib/parsers/mpesa.ts``; keep
the two in step. The old flat-JSON reader was removed: no source shows the
endpoint ever answering with flat fields.
"""

from __future__ import annotations

import base64
import binascii
import json
import re
from datetime import datetime
from io import BytesIO

import pdfplumber
import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus

# Same limits as the server: the decoded PDF stays under safe-fetch's 5 MB PDF cap.
MAX_PDF_BYTES = 5 * 1024 * 1024
MAX_BASE64_CHARS = -(-MAX_PDF_BYTES // 3) * 4
MAX_ENVELOPE_BYTES = MAX_BASE64_CHARS + 64 * 1024
_MAX_TEXT_CHARS = 50_000
_MAX_PAGES = 4
_MAX_LINE_CHARS = 2_000
_MAX_VALUE_CHARS = 200
_MAX_LABEL_HITS = 500

_HEADERS = {
    "Accept": "application/json, text/plain, */*",
    "Referer": "https://m-pesabusiness.safaricom.et/",
}

# English labels on the receipt (see FIELD_LABELS in src/lib/parsers/mpesa.ts
# for where each comes from). "TRANSACTION STATUS" is read defensively only.
_FIELD_LABELS: tuple[tuple[str, str], ...] = (
    ("PAYER NAME", "payer_name"),
    ("SENDER NAME", "payer_name"),
    ("BUYER NAME", "payer_name"),
    ("PAYER PHONE NUMBER", "payer_account"),
    ("SENDER NUMBER", "payer_account"),
    ("BUYER PHONE NUMBER", "payer_account"),
    ("RECEIVER NAME", "receiver_name"),
    ("RECEIVER BUSINESS NAME", "receiver_business_name"),
    ("RECEIVER NUMBER", "receiver_account"),
    ("RECEIVER ACCOUNT NUMBER", "receiver_account"),
    ("RECEIVER BUSINESS NUMBER", "receiver_account"),
    ("TRANSACTION ID", "transaction_id"),
    ("SERVICE FEE", "service_fee"),
    ("+ 15% VAT", "vat"),
    ("DISCOUNT", "discount"),
    ("TOTAL", "total"),
    ("TOTAL AMOUNT IN WORDS", "amount_in_words"),
    ("PAYMENT METHOD", "payment_method"),
    ("TRANSACTION TYPE", "transaction_type"),
    ("PAYMENT CHANNEL", "payment_channel"),
    ("PAYMENT REASON", "reason"),
    ("TRANSACTION STATUS", "status"),
    ("SETTLED AMOUNT", "receipt_header"),
    ("RECEIPT NO", "stop"),
    ("PAYMENT DATE", "stop"),
    ("BANK NAME", "stop"),
    ("PACKAGE DETAILS", "stop"),
    ("VALIDITY PERIOD", "stop"),
    ("TRANSACTION INFORMATION", "stop"),
    ("TRANSACTION DETAIL", "stop"),
    ("SCAN TO VERIFY", "stop"),
    ("THANK YOU", "stop"),
)
_LABELS_BY_LENGTH = sorted(_FIELD_LABELS, key=lambda lf: -len(lf[0]))

_ETHIOPIC = re.compile("[\u1200-\u139f\u2d80-\u2ddf\uab00-\uab2f]+")
_WS = re.compile(r"\s+")
_DATE_TIME = re.compile(r"(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}(?::\d{2})?)")
_ID = re.compile(r"[A-Z0-9]{6,20}")
_MONEY = re.compile(r"\d[\d,]{0,30}(?:\.\d{1,2})?")
_ACCOUNT = re.compile(r"\+?[0-9*][0-9* ]{2,24}")
_BASE64 = re.compile(r"[A-Za-z0-9+/]+={0,2}")
_SEPARATORS = " /:|-\t"
_BLANK = {"", "-", "- - -", "---", "null", "n/a"}


def _word_char(c: str) -> bool:
    return c.isascii() and c.isalnum()


def _blank(value: str | None) -> bool:
    return value is None or value.strip().lower() in _BLANK


def _split_at_labels(line: str) -> list[tuple[str, str]]:
    upper = line.upper()
    hits: list[tuple[int, int, str]] = []
    for label, field in _LABELS_BY_LENGTH:
        start = 0
        while len(hits) < _MAX_LABEL_HITS:
            at = upper.find(label, start)
            if at == -1:
                break
            end = at + len(label)
            start = at + 1
            if at > 0 and _word_char(upper[at - 1]) and _word_char(label[0]):
                continue
            if end < len(upper) and _word_char(upper[end]):
                continue
            hits.append((at, end, field))
    hits.sort(key=lambda h: (h[0], -h[1]))
    chosen: list[tuple[int, int, str]] = []
    last_end = -1
    for h in hits:
        if h[0] < last_end:
            continue
        chosen.append(h)
        last_end = h[1]
    out = []
    for i, (_, end, field) in enumerate(chosen):
        nxt = chosen[i + 1][0] if i + 1 < len(chosen) else len(line)
        out.append((field, line[end:nxt].strip(_SEPARATORS)[:_MAX_VALUE_CHARS]))
    return out


def _money(value: str | None) -> float | None:
    if value is None or _blank(value):
        return None
    m = _MONEY.search(value[:200])
    return float(m.group(0).replace(",", "")) if m else None


def _name(value: str | None) -> str | None:
    if value is None or _blank(value):
        return None
    digit = next((i for i, c in enumerate(value) if c.isdigit()), -1)
    head = value if digit == -1 else value[:digit]
    name = re.sub(r" {2,}", " ", re.sub(r"[^A-Za-z .'-]", " ", head)).strip(_SEPARATORS)
    return name[:100] if any(c.isalpha() for c in name) else None


def _account(value: str | None) -> str | None:
    if value is None or _blank(value):
        return None
    m = _ACCOUNT.match(value[:40])
    return m.group(0).replace(" ", "") if m else None


def _identifier(value: str | None) -> str | None:
    if value is None or _blank(value):
        return None
    token = value.strip().split(" ")[0].upper()
    return token if _ID.fullmatch(token) else None


def _text(value: str | None, limit: int = 120) -> str | None:
    return None if value is None or _blank(value) else value.strip()[:limit]


def _receipt_row(row: str) -> dict:
    s = row[:200]
    m = _DATE_TIME.search(s)
    if not m:
        return {}
    before = s[: m.start()].replace(" ", "").upper()
    return {
        "receipt_no": before if _ID.fullmatch(before) else None,
        "date": f"{m.group(1)} {m.group(2)}",
        "settled": _money(s[m.end() :]),
    }


def decode_envelope(body: bytes | str) -> bytes:
    """Validate the getReceipt envelope and return the decoded PDF bytes.

    Raises ReceiptNotFoundError for a non-"0" responseCode and UpstreamError
    for anything that is not a well-formed envelope with a PDF under 5 MB.
    """
    if len(body) > MAX_ENVELOPE_BYTES:
        raise UpstreamError("M-Pesa returned a receipt larger than cheki accepts.")
    try:
        payload = json.loads(body)
    except ValueError as exc:
        raise UpstreamError("M-Pesa returned non-JSON response.") from exc
    if not isinstance(payload, dict):
        raise UpstreamError("M-Pesa returned an unexpected response.")
    if str(payload.get("responseCode", "")) != "0":
        description = payload.get("responseDescription")
        detail = f" ({description[:120]})" if isinstance(description, str) and description.strip() else ""
        raise ReceiptNotFoundError(f"M-Pesa did not return a receipt for this transaction number{detail}.")
    data = payload.get("base64Data")
    if not isinstance(data, str) or not data:
        raise UpstreamError("M-Pesa returned no receipt PDF.")
    b64 = data.replace("\r", "").replace("\n", "")
    if len(b64) > MAX_BASE64_CHARS:
        raise UpstreamError("M-Pesa returned a receipt larger than cheki accepts.")
    if len(b64) % 4 or not _BASE64.fullmatch(b64):
        raise UpstreamError("M-Pesa returned a malformed receipt PDF.")
    try:
        pdf = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise UpstreamError("M-Pesa returned a malformed receipt PDF.") from exc
    if len(pdf) > MAX_PDF_BYTES:
        raise UpstreamError("M-Pesa returned a receipt larger than cheki accepts.")
    if not pdf.startswith(b"%PDF-"):
        raise UpstreamError("M-Pesa returned something that is not a PDF.")
    return pdf


def parse_lines(lines: list[str]) -> dict:
    """Map receipt text lines to fields (port of MpesaParser.parseLines)."""
    clean: list[str] = []
    chars = 0
    for raw in lines:
        if chars > _MAX_TEXT_CHARS:
            break
        line = _WS.sub(" ", _ETHIOPIC.sub(" ", str(raw)[:_MAX_LINE_CHARS])).strip()
        if line:
            chars += len(line)
            clean.append(line)

    values: dict[str, str] = {}
    header: dict = {}
    for i, line in enumerate(clean):
        for field, value in _split_at_labels(line):
            if field == "stop":
                continue
            if field == "receipt_header":
                if not header.get("date"):
                    header = _receipt_row(value or (clean[i + 1] if i + 1 < len(clean) else ""))
                continue
            if field not in values and not _blank(value):
                values[field] = value

    total = _money(values.get("total"))
    settled = header.get("settled")
    amount = settled if settled else total
    date = header.get("date")
    if not date:
        m = _DATE_TIME.search(" ".join(clean)[:_MAX_TEXT_CHARS])
        date = f"{m.group(1)} {m.group(2)}" if m else None
    return {
        "reference": _identifier(values.get("transaction_id")) or header.get("receipt_no"),
        "receipt_no": header.get("receipt_no"),
        "amount": amount,
        "settled_amount": settled,
        "total": total,
        "service_fee": _money(values.get("service_fee")),
        "vat": _money(values.get("vat")),
        "sender_name": _name(values.get("payer_name")),
        "sender_account": _account(values.get("payer_account")),
        "receiver_name": _name(values.get("receiver_name")) or _name(values.get("receiver_business_name")),
        "receiver_account": _account(values.get("receiver_account")),
        "date": date,
        "transaction_type": _text(values.get("transaction_type"), 60),
        "payment_method": _text(values.get("payment_method"), 60),
        "payment_channel": _text(values.get("payment_channel"), 60),
        "reason": _text(values.get("reason")),
        "transaction_status": _text(values.get("status"), 40),
    }


def pdf_lines(pdf: bytes) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(BytesIO(pdf)) as doc:
        for page in doc.pages[:_MAX_PAGES]:
            lines.extend((page.extract_text() or "").split("\n"))
            if sum(len(x) for x in lines) > _MAX_TEXT_CHARS:
                break
    return lines


class MPesaVerifier(BankVerifier):
    """M-Pesa Ethiopia receipt verifier (JSON envelope with a base64 PDF)."""

    BANK_CODE = "mpesa"
    BANK_NAME = "M-Pesa Ethiopia"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        url = "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt"
        source_url = f"{url}?trxNo={reference}"
        try:
            resp = self._get(url, params={"trxNo": reference}, headers=_HEADERS, stream=True)
        except requests.RequestException as exc:
            raise UpstreamError(f"M-Pesa receipt endpoint unreachable: {exc}") from exc
        if resp.status_code != 200:
            raise UpstreamError(f"M-Pesa returned status {resp.status_code}.")

        body = bytearray()
        for chunk in resp.iter_content(64 * 1024):
            body.extend(chunk)
            if len(body) > MAX_ENVELOPE_BYTES:
                resp.close()
                raise UpstreamError("M-Pesa returned a receipt larger than cheki accepts.")

        pdf = decode_envelope(bytes(body))
        fields = parse_lines(pdf_lines(pdf))
        verified = bool(
            fields["reference"]
            and fields["amount"]
            and (
                fields["sender_name"]
                or fields["receiver_name"]
                or fields["sender_account"]
                or fields["receiver_account"]
            )
        )
        if not verified:
            raise ReceiptNotFoundError("Could not read the M-Pesa receipt PDF.")

        date = None
        if fields["date"]:
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"):
                try:
                    date = datetime.strptime(fields["date"], fmt)
                    break
                except ValueError:
                    pass

        return VerificationResult(
            bank=self.BANK_CODE,
            reference=reference,
            status=VerificationStatus.VERIFIED,
            exists=True,
            amount=fields["amount"],
            currency="ETB",
            sender_name=fields["sender_name"],
            sender_account=fields["sender_account"],
            receiver_name=fields["receiver_name"],
            receiver_account=fields["receiver_account"],
            transaction_date=date,
            source_url=source_url,
            raw={
                "fields": fields,
                "bank_reference": fields["reference"],
                "transaction_status": fields["transaction_status"],
            },
        )
