import re
from datetime import datetime
from io import BytesIO
from typing import Any

import pdfplumber
import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus

# Same shapes as the manifest's CBE formats (src/lib/manifest/banks.json), current first.
_FT_REFERENCE = re.compile(r"FT[A-Za-z0-9]{8,12}", re.IGNORECASE)
_RECEIPT_ID = re.compile(r"(?:v\d{1,2}-)?[A-Za-z0-9]{10,64}")

# The CBE web app's headers; the JSON API answers 400 "Missing Headers" without them.
_RECEIPT_ID_HEADERS = {
    "X-App-ID": "d1292e42-7400-49de-a2d3-9731caa4c819",
    "X-App-Version": "0a01980b-9859-1369-8198-59f403820000",
    "Origin": "https://mbreciept.cbe.com.et",
    "Referer": "https://mbreciept.cbe.com.et/",
    "Accept": "application/json",
}


def _text(value: object) -> str | None:
    if isinstance(value, str):
        return value.strip() or None
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return str(value)
    return None


def _money(value: object) -> float | None:
    raw = _text(value)
    if raw is None:
        return None
    try:
        return float(raw.replace(",", ""))
    except ValueError:
        return None


class CBEVerifier(BankVerifier):
    """Commercial Bank of Ethiopia receipt verifier.

    Current format: the Receipt ID from a ``mbreciept.cbe.com.et/<Receipt ID>``
    link or QR code, read through CBE's JSON API (no account number needed)::

        https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/<RECEIPT_ID>

    Older receipts (legacy): FT reference plus the last 8 digits of the
    receiving account, a PDF that is often unreachable::

        https://apps.cbe.com.et:100/?id=<FT_REFERENCE><LAST_8_DIGITS_OF_RECEIVER_ACCOUNT>
    """

    BANK_CODE = "cbe"
    BANK_NAME = "Commercial Bank of Ethiopia"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        if _FT_REFERENCE.fullmatch(reference):
            return self._verify_ft_pdf(reference, **kwargs)
        if _RECEIPT_ID.fullmatch(reference):
            return self._verify_receipt_id(reference)
        raise ValueError(
            "Use the Receipt ID from the CBE receipt link (mbreciept.cbe.com.et/<Receipt ID>), "
            "or for an older receipt the FT reference with account_number."
        )

    def _verify_receipt_id(self, receipt_id: str) -> VerificationResult:
        url = f"https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{receipt_id}"
        try:
            resp = self._get(url, headers=_RECEIPT_ID_HEADERS)
        except requests.RequestException as exc:
            raise UpstreamError(f"CBE receipt service unreachable: {exc}") from exc
        if resp.status_code == 404:
            raise ReceiptNotFoundError("CBE did not find a receipt for this Receipt ID.")
        if resp.status_code != 200:
            # An unknown or malformed Receipt ID answers 500 "Invalid or tampered legacy token".
            raise ReceiptNotFoundError(f"CBE did not return a receipt (status {resp.status_code}). Check the receipt link.")
        try:
            data: Any = resp.json()
        except ValueError as exc:
            raise ReceiptNotFoundError("CBE did not return a receipt.") from exc
        if not isinstance(data, dict) or not _text(data.get("id")):
            raise ReceiptNotFoundError("CBE did not return a receipt.")

        dates = data.get("dateTimes")
        transaction_date = None
        if isinstance(dates, list) and dates and isinstance(dates[0], str):
            try:
                transaction_date = datetime.fromisoformat(dates[0])
            except ValueError:
                transaction_date = None
        amount = _money(data.get("amountCredited"))
        if amount is None:
            amount = _money(data.get("amountDebited"))
        return VerificationResult(
            bank=self.BANK_CODE,
            reference=receipt_id,
            status=VerificationStatus.VERIFIED,
            exists=True,
            amount=amount,
            currency=_text(data.get("creditCurrency")) or "ETB",
            sender_name=_text(data.get("debitAccountHolder")),
            sender_account=_text(data.get("debitAccountNo")),
            receiver_name=_text(data.get("creditAccountHolder")),
            receiver_account=_text(data.get("creditAccountNo")),
            transaction_date=transaction_date,
            source_url=f"https://mbreciept.cbe.com.et/{receipt_id}",
            # The Receipt ID is an opaque share token; the receipt carries the FT id instead.
            raw={"response": data, "gate_id": "cbe-new", "bank_reference": _text(data.get("id"))},
        )

    def _verify_ft_pdf(self, reference: str, **kwargs: object) -> VerificationResult:
        account_number = str(kwargs.get("account_number", "") or "").replace(" ", "")
        if not account_number or len(account_number) < 8:
            raise ValueError(
                "This is an older CBE FT reference: pass the receiving account_number (at least the last 8 digits), "
                "or use the Receipt ID from the CBE receipt link instead."
            )
        suffix = account_number[-8:]
        verification_id = f"{reference}{suffix}"
        url = f"https://apps.cbe.com.et:100/?id={verification_id}"

        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(
                f"CBE's older receipt service (FT reference + account) is unreachable: {exc}. "
                "Ask for the receipt link or Receipt ID from the CBE app."
            ) from exc

        if resp.status_code != 200 or not resp.content.startswith(b"%PDF"):
            raise ReceiptNotFoundError(
                f"CBE did not return a PDF (status {resp.status_code}). "
                "Reference may be invalid or account suffix incorrect."
            )

        text = self._extract_pdf_text(resp.content)
        if not text or "Commercial Bank of Ethiopia" not in text:
            raise ReceiptNotFoundError("CBE PDF did not contain a valid receipt.")

        parsed = self._parse_receipt(text)
        parsed["source_url"] = url
        parsed["reference"] = reference
        parsed["bank"] = self.BANK_CODE
        return VerificationResult(
            status=VerificationStatus.VERIFIED,
            exists=True,
            **parsed,
        )

    def _extract_pdf_text(self, content: bytes) -> str:
        with pdfplumber.open(BytesIO(content)) as pdf:
            return "\n".join(page.extract_text() or "" for page in pdf.pages)

    def _parse_receipt(self, text: str) -> dict:
        data: dict = {}
        data["raw"] = {"pdf_text": text}

        lines = [line.strip() for line in text.splitlines() if line.strip()]

        for line in lines:
            ref_match = re.search(r"(?:Reference|Receipt|Invoice)\b.*?\b(FT[A-Z0-9]{8,12})\b", line, re.IGNORECASE)
            if ref_match and "bank_reference" not in data["raw"]:
                data["raw"]["bank_reference"] = ref_match.group(1)
            if line.startswith("Payer"):
                data["sender_name"] = line.replace("Payer", "").strip()
            elif line.startswith("Receiver"):
                data["receiver_name"] = line.replace("Receiver", "").strip()
            elif line.startswith("Account"):
                accounts = data.get("accounts", [])
                match = re.search(r"Account\s+([0-9*]+)", line)
                if match:
                    accounts.append(match.group(1))
                    data["accounts"] = accounts
            elif "Transferred Amount" in line:
                match = re.search(r"Transferred Amount\s+([0-9,]+\.\d{2})\s*ETB", line)
                if match:
                    data["amount"] = float(match.group(1).replace(",", ""))
                    data["currency"] = "ETB"
            elif "Payment Date & Time" in line:
                match = re.search(
                    r"Payment Date & Time\s+(\d{1,2}/\d{1,2}/\d{4}),\s+(\d{1,2}:\d{2}:\d{2})\s*(AM|PM)?",
                    line,
                )
                if match:
                    date_str = f"{match.group(1)} {match.group(2)}"
                    if match.group(3):
                        date_str += f" {match.group(3)}"
                    fmt = "%m/%d/%Y %I:%M:%S %p" if match.group(3) else "%m/%d/%Y %H:%M:%S"
                    try:
                        data["transaction_date"] = datetime.strptime(date_str, fmt)
                    except ValueError:
                        pass

        if data.get("accounts"):
            data["sender_account"] = data["accounts"][0]
            if len(data["accounts"]) >= 2:
                data["receiver_account"] = data["accounts"][1]
            data.pop("accounts", None)

        return data
