import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus


class TelebirrVerifier(BankVerifier):
    """Telebirr receipt verifier.

    Ethio Telecom serves a public HTML receipt at:
        https://transactioninfo.ethiotelecom.et/receipt/<TRANSACTION_NUMBER>
    """

    BANK_CODE = "telebirr"
    BANK_NAME = "Telebirr"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        url = f"https://transactioninfo.ethiotelecom.et/receipt/{reference}"
        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(f"Telebirr receipt endpoint unreachable: {exc}") from exc

        if resp.status_code != 200:
            raise UpstreamError(
                f"Telebirr returned status {resp.status_code}."
            )

        if "This request is not correct" in resp.text or "telebirr receipt" not in resp.text.lower():
            raise ReceiptNotFoundError(
                "Telebirr did not return a valid receipt page. Reference may be invalid."
            )

        parsed = self._parse_html(resp.text)
        parsed["source_url"] = url
        parsed["reference"] = reference
        parsed["bank"] = self.BANK_CODE
        return VerificationResult(
            status=VerificationStatus.VERIFIED,
            exists=True,
            **parsed,
        )

    def _parse_html(self, html: str) -> dict:
        data: dict = {"raw": {"html": html[:2000]}}
        soup = BeautifulSoup(html, "html.parser")
        text = soup.get_text("\n", strip=True)
        data["raw"]["text"] = text

        lines = [line.strip() for line in text.splitlines() if line.strip()]

        def next_value_after(label_english: str, label_amharic: str | None = None) -> str | None:
            for i, line in enumerate(lines):
                if label_english in line or (label_amharic and label_amharic in line):
                    if i + 1 < len(lines):
                        return lines[i + 1]
            return None

        data["sender_name"] = next_value_after("Payer Name", "የከፋይ ስም")
        data["sender_account"] = next_value_after("Payer telebirr no", "የከፋይ ቴሌብር ቁ")
        data["receiver_name"] = next_value_after("Credited Party name", "የገንዘብ ተቀባይ ስም")
        data["receiver_account"] = next_value_after("Credited party account no", "የገንዘብ ተቀባይ ቴሌብር ቁ")
        data["currency"] = "ETB"

        # The real receipt stacks labels then values. Scan whole text for the
        # amount (line containing "Birr") and the date pattern.
        for line in lines:
            if data.get("amount") is None:
                match = re.search(r"([0-9,]+\.?\d*)\s*(Birr|ETB)", line, re.IGNORECASE)
                if match:
                    try:
                        data["amount"] = float(match.group(1).replace(",", ""))
                    except ValueError:
                        pass
            if data.get("transaction_date") is None:
                for fmt in ("%d-%m-%Y %H:%M:%S", "%d/%m/%Y %H:%M:%S"):
                    try:
                        data["transaction_date"] = datetime.strptime(line, fmt)
                        break
                    except ValueError:
                        continue

        return data
