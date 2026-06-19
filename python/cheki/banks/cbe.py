import re
from datetime import datetime
from io import BytesIO

import pdfplumber
import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus


class CBEVerifier(BankVerifier):
    """Commercial Bank of Ethiopia receipt verifier.

    CBE serves an official PDF receipt at:
        https://apps.cbe.com.et:100/?id=<REFERENCE><LAST_8_DIGITS_OF_RECEIVER_ACCOUNT>
    """

    BANK_CODE = "cbe"
    BANK_NAME = "Commercial Bank of Ethiopia"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        account_number = str(kwargs.get("account_number", "")).replace(" ", "")
        if not account_number or len(account_number) < 8:
            raise ValueError("CBE verification requires the full receiving account_number (at least 8 digits).")
        suffix = account_number[-8:]
        verification_id = f"{reference}{suffix}"
        url = f"https://apps.cbe.com.et:100/?id={verification_id}"

        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(f"CBE receipt endpoint unreachable: {exc}") from exc

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
