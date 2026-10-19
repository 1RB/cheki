"""CBE Birr receipt verifier (direct mode).

Public endpoint::

    https://cbepay1.cbe.com.et/aureceipt?TID=<RECEIPT NUMBER>&PH=<PAYER PHONE>

Verified 2026-10-16 against two real receipts: a matching receipt number and
payer phone return HTTP 200 ``application/pdf`` (one page). Its rows are
``Label value`` (Debit Account ``<payer phone> - <NAME>``, Credit Account,
Receiver Name, Order ID, Transaction Status, then the receipt row
``<receipt number> <yyyy-mm-dd HH:MM> <amount>``, Paid amount, Service Charge,
VAT, Total Paid Amount, Total Amount in word, Payment Reason, Payment Channel).
A pair that does not match returns HTTP 200 with an empty "Auto Receipt"
page, which is never verified: it may be a typo in the phone.

The PDF prints phone numbers in full; they are masked here (09****1234)
before anything is returned. This is a port of ``src/lib/parsers/cbebirr.ts``;
keep the two in step.
"""

from __future__ import annotations

import re
from datetime import datetime
from io import BytesIO
from urllib.parse import quote

import pdfplumber
import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus

_TID_RE = re.compile(r"^[A-Za-z0-9]{10,11}$")

# Same limits as the server: the body is read under safe-fetch's 5 MB PDF cap.
MAX_PDF_BYTES = 5 * 1024 * 1024
_MAX_PAGES = 4
_MAX_TEXT_CHARS = 50_000
_MAX_LINE_CHARS = 300

_LABELS = [
    "Debit Account",
    "Credit Account",
    "Receiver Name",
    "Order ID",
    "Transaction Status",
    "Reference",
    "Receipt Number",
    "Transaction Date",
    "Paid amount",
    "Service charge",
    "VAT",
    "Total Paid Amount",
    "Total Amount in word",
    "Payment Reason",
    "Payment Channel",
]
_LABELS_BY_LENGTH = sorted((label.lower() for label in _LABELS), key=len, reverse=True)
_MONEY_LABELS = {"paid amount", "service charge", "vat", "total paid amount"}
_ID_LABELS = {"order id", "receipt number"}
_WRAPPING_LABELS = {"debit account", "credit account", "receiver name"}
_MONEY_VALUE_RE = re.compile(r"^(?:ETB\s?)?\d[\d,]{0,20}(?:\.\d{1,2})?(?:\s?(?:ETB|Birr))?$", re.I)
_ROW_RE = re.compile(
    r"(?:^|[^A-Za-z0-9])([A-Z0-9]{10,12})[ \t]{0,4}(\d{4}-\d{2}-\d{2}[ \t]{1,4}\d{2}:\d{2}(?::\d{2})?)"
    r"[ \t]{0,4}(\d[\d,]{0,20}(?:\.\d{1,2})?)",
    re.M,
)
_PARTY_RE = re.compile(r"^\s*(\+?[\d*Xx]{6,20})\s*-\s*(.*)$")


def normalize_phone(phone: str) -> str:
    """Return the payer's wallet number as 251XXXXXXXXX, the form CBE Birr's
    own receipt links use. Accepts +251, 251, 09/07 and bare 9-digit forms."""
    digits = re.sub(r"[\s()+-]", "", phone)
    local = None
    if digits.isdigit():
        if len(digits) == 12 and digits.startswith("251"):
            local = digits[3:]
        elif len(digits) == 10 and digits.startswith("0"):
            local = digits[1:]
        elif len(digits) == 9:
            local = digits
    if not local or not re.fullmatch(r"[79]\d{8}", local):
        raise ValueError(
            "Enter the payer's CBE Birr phone number, e.g. 09XXXXXXXX or 2519XXXXXXXX."
        )
    return f"251{local}"


def mask_number(value: str | None) -> str | None:
    """Mask a phone or account number printed in full on the receipt.

    Mobile numbers keep their 09/07 (or 2519/2517) prefix and last 4
    (0911223344 -> 09****3344); other long numbers keep their first digit
    and last 4. Values the bank already masked pass through.
    """
    if not value:
        return None
    s = re.sub(r"\s+", "", value)
    if not s:
        return None
    if "*" in s or not re.fullmatch(r"\+?\d+", s):
        return s
    d = s.lstrip("+")
    if re.fullmatch(r"0[79]\d{8}", d):
        return f"{d[:2]}****{d[-4:]}"
    if re.fullmatch(r"251[79]\d{8}", d):
        return f"{d[:4]}****{d[-4:]}"
    if len(d) <= 5:
        return "*" * len(d)
    return f"{d[0]}{'*' * (len(d) - 5)}{d[-4:]}"


def _clean(value: str | None) -> str | None:
    if not value:
        return None
    out = re.sub(r"\s+", " ", value.strip(" \t\r\n:")).strip()
    return out or None


def _money(value: str | None) -> float | None:
    if not value:
        return None
    m = re.search(r"\d[\d,]{0,30}(?:\.\d{1,2})?", value[:200])
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def _split_party(value: str | None) -> tuple[str | None, str | None]:
    """'0911223344 - NAME' or '1000****1234 - CBE' -> (number, name)."""
    if not value:
        return None, None
    m = _PARTY_RE.match(value)
    if m:
        return m.group(1), _clean(m.group(2))
    if re.fullmatch(r"[\s\d*+Xx]+", value):
        return _clean(value), None
    return None, _clean(value)


def _fields(lines: list[str]) -> dict[str, str]:
    fields: dict[str, str] = {}
    for i, raw in enumerate(lines):
        if len(raw) > _MAX_LINE_CHARS:
            continue
        line = raw.strip()
        lower = line.lower()
        key = next(
            (
                label
                for label in _LABELS_BY_LENGTH
                if lower.startswith(label) and line[len(label) : len(label) + 1] in (" ", "\t", ":")
            ),
            None,
        )
        if not key:
            continue
        value = _clean(line[len(key) :])
        if not value or key in fields:
            continue
        if key in _MONEY_LABELS and not _MONEY_VALUE_RE.match(value):
            continue
        if key in _ID_LABELS and not re.fullmatch(r"[A-Za-z0-9]{4,32}", value):
            continue
        if key in _WRAPPING_LABELS and i + 1 < len(lines):
            nxt = lines[i + 1].strip()
            if (
                nxt
                and len(nxt) <= 80
                and re.fullmatch(r"[A-Z][A-Z .'-]*", nxt)
                and not any(nxt.lower().startswith(label) for label in _LABELS_BY_LENGTH)
            ):
                value = f"{value} {nxt}"
        fields[key] = value
    return fields


def parse_lines(lines: list[str]) -> dict:
    """Read a CBE Birr receipt from its PDF rows. Phone numbers come back masked."""
    text = "\n".join(lines)[:_MAX_TEXT_CHARS]
    f = _fields(text.split("\n"))
    debit_number, debit_name = _split_party(f.get("debit account"))
    credit_number, credit_name = _split_party(f.get("credit account"))
    _, receiver_name = _split_party(f.get("receiver name"))
    wallet_credit = bool(credit_number and re.match(r"^(?:0|\+?251)[79]", credit_number))
    customer = None
    m = re.search(r"Customer Name:[ \t]*([A-Z][A-Za-z .'-]*)$", text, re.M)
    if m and re.search(r"[A-Z]{2}", m.group(1)):
        customer = _clean(m.group(1))
    row = _ROW_RE.search(text)
    words = f.get("total amount in word")
    return {
        "reference": f.get("receipt number") or (row.group(1) if row else None),
        "date": f.get("transaction date") or (row.group(2) if row else None),
        "amount": _money(f.get("paid amount")) or (_money(row.group(3)) if row else None) or _money(f.get("total paid amount")),
        "service_fee": _money(f.get("service charge")),
        "vat": _money(f.get("vat")),
        "total_paid": _money(f.get("total paid amount")),
        "sender_name": debit_name or customer,
        "sender_account": mask_number(debit_number),
        "receiver_name": receiver_name or (credit_name if wallet_credit else None),
        "receiver_account": mask_number(credit_number),
        "order_id": f.get("order id"),
        "transaction_status": f.get("transaction status"),
        "amount_in_words": _clean(re.sub(r"\s*\.$", "", words)) if words else None,
        "reason": f.get("payment reason"),
        "payment_channel": f.get("payment channel"),
    }


def pdf_lines(pdf: bytes) -> list[str]:
    lines: list[str] = []
    with pdfplumber.open(BytesIO(pdf)) as doc:
        for page in doc.pages[:_MAX_PAGES]:
            lines.extend((page.extract_text() or "").split("\n"))
            if sum(len(x) for x in lines) > _MAX_TEXT_CHARS:
                break
    return lines


class CBEBirrVerifier(BankVerifier):
    """CBE Birr receipt verifier (direct mode).

    A receipt PDF is parsed (phones masked) and goes through the shared gate
    in ``cheki.registry``. An empty "Auto Receipt" page is never verified: it
    usually means the receipt number and payer phone don't match.
    """

    BANK_CODE = "cbebirr"
    BANK_NAME = "CBE Birr"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        reference = str(reference).strip()
        if not _TID_RE.match(reference):
            raise ValueError("A CBE Birr receipt number is 10 or 11 letters and digits.")
        raw_phone = str(kwargs.get("phone_number", "")).strip()
        if not raw_phone:
            raise ValueError("CBE Birr verification requires the payer phone_number.")
        phone = normalize_phone(raw_phone)
        url = (
            "https://cbepay1.cbe.com.et/aureceipt"
            f"?TID={quote(reference, safe='')}&PH={quote(phone, safe='')}"
        )
        try:
            resp = self._get(url, timeout=20, stream=True)
        except requests.Timeout as exc:
            raise UpstreamError("CBE Birr receipt endpoint timed out.") from exc
        except requests.RequestException as exc:
            raise UpstreamError(f"CBE Birr receipt endpoint unreachable: {exc}") from exc

        if resp.status_code != 200:
            raise ReceiptNotFoundError(
                f"CBE Birr did not return a receipt (status {resp.status_code})."
            )

        body = bytearray()
        try:
            for chunk in resp.iter_content(64 * 1024):
                body.extend(chunk)
                if len(body) > MAX_PDF_BYTES:
                    raise UpstreamError("CBE Birr returned a receipt larger than cheki accepts.")
        except requests.RequestException as exc:
            raise UpstreamError(f"CBE Birr receipt download failed: {exc}") from exc
        finally:
            resp.close()

        if not bytes(body[:5]).startswith(b"%PDF"):
            return VerificationResult(
                bank=self.BANK_CODE,
                reference=reference,
                status=VerificationStatus.UNAVAILABLE,
                exists=False,
                source_url=url,
                raw={"content_type": resp.headers.get("Content-Type", ""), "is_pdf": False},
                message=(
                    "CBE Birr sent back an empty receipt page, so this could not be confirmed. "
                    "The receipt number and payer phone number may not match: check both, "
                    "or open the receipt link."
                ),
            )

        try:
            lines = pdf_lines(bytes(body))
        except Exception as exc:  # a truncated or malformed PDF behind a %PDF header
            raise UpstreamError("CBE Birr returned a receipt PDF cheki could not read.") from exc
        fields = parse_lines(lines)
        if not (
            fields["reference"]
            and fields["amount"]
            and (fields["sender_name"] or fields["receiver_name"] or fields["sender_account"] or fields["receiver_account"])
        ):
            raise ReceiptNotFoundError("Could not read the CBE Birr receipt PDF.")

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
            source_url=url,
            raw={
                "fields": fields,
                "bank_reference": fields["reference"],
                "transaction_status": fields["transaction_status"],
            },
        )
