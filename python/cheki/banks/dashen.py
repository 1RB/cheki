import re
from datetime import datetime

import requests
from bs4 import BeautifulSoup

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus

_LABELS = (
    "Sender Name:",
    "Sender Account Number:",
    "Receiver Name:",
    "Receiver Account Number:",
    "Transaction Reference:",
    "Transaction Date:",
    "Transaction Status:",
    "Transaction Amount",
)


class DashenVerifier(BankVerifier):
    """Dashen Bank receipt verifier.

    Current format: the 16-character FT Ref (e.g. ``B22WDTI00SAMPLE1``) on
    Dashen's public HTML receipt page::

        https://receipts.dashenbanksc.com/receipt/<FT_REF>

    An unknown FT Ref answers HTTP 400 ``{"message":"Transaction not found"}``.
    The old receipt.dashensuperapp.com PDF host is deprecated (502 since
    2026-10-10) and is not contacted.
    """

    BANK_CODE = "dashen"
    BANK_NAME = "Dashen Bank"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        url = f"https://receipts.dashenbanksc.com/receipt/{reference}"
        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(f"Dashen receipt endpoint unreachable: {exc}") from exc

        if resp.status_code in (400, 404):
            raise ReceiptNotFoundError(
                "Dashen did not find a receipt for this reference. Use the 16-character FT Ref "
                "(e.g. B22WDTI00SAMPLE1), not the longer Transaction Ref."
            )
        if resp.status_code != 200:
            raise UpstreamError(f"Dashen returned status {resp.status_code}.")

        values = self._parse_html(resp.text)
        if not values.get("Transaction Reference:"):
            raise ReceiptNotFoundError("Dashen did not return a receipt page for this reference.")

        amount = None
        match = re.search(r"([0-9][0-9,]*(?:\.\d+)?)", values.get("Transaction Amount", ""))
        if match:
            amount = float(match.group(1).replace(",", ""))
        transaction_date = None
        raw_date = values.get("Transaction Date:")
        if raw_date:
            for fmt in ("%b %d, %Y, %I:%M:%S %p", "%B %d, %Y, %I:%M:%S %p"):
                try:
                    transaction_date = datetime.strptime(raw_date.replace("am", "AM").replace("pm", "PM"), fmt)
                    break
                except ValueError:
                    continue

        raw: dict[str, object] = {"fields": values, "bank_reference": values.get("Transaction Reference:")}
        if values.get("Transaction Status:"):
            raw["transaction_status"] = values["Transaction Status:"]
        return VerificationResult(
            bank=self.BANK_CODE,
            reference=reference,
            status=VerificationStatus.VERIFIED,
            exists=True,
            amount=amount,
            sender_name=values.get("Sender Name:"),
            sender_account=values.get("Sender Account Number:"),
            receiver_name=values.get("Receiver Name:"),
            receiver_account=values.get("Receiver Account Number:"),
            transaction_date=transaction_date,
            source_url=url,
            raw=raw,
        )

    @staticmethod
    def _parse_html(html: str) -> dict[str, str]:
        """Label -> value from Dashen's receipt page (the value is the next text after each label)."""
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        lines = [t.strip() for t in soup.get_text("\n").splitlines() if t.strip()]
        values: dict[str, str] = {}
        for i, line in enumerate(lines[:-1]):
            if line in _LABELS and line not in values:
                nxt = lines[i + 1]
                if nxt not in _LABELS:
                    values[line] = nxt
        return values
