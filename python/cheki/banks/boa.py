import re
from datetime import datetime

import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus


class BOAVerifier(BankVerifier):
    """Bank of Abyssinia receipt verifier.

    BOA serves a SPA receipt page, but the data comes from a public T24 API:
        https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=<trx_id>
    where trx_id is the transaction reference concatenated with the last 5
    digits of the receiver account.
    """

    BANK_CODE = "boa"
    BANK_NAME = "Bank of Abyssinia"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        account_number = str(kwargs.get("account_number", "")).replace(" ", "")
        if not account_number or len(account_number) < 5:
            raise ValueError(
                "BOA verification requires the full receiving account_number (at least 5 digits)."
            )
        suffix = account_number[-5:]
        trx_id = f"{reference}{suffix}"
        url = f"https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={trx_id}"

        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(f"BOA receipt endpoint unreachable: {exc}") from exc

        if resp.status_code != 200:
            raise UpstreamError(f"BOA returned status {resp.status_code}.")

        try:
            payload = resp.json()
        except ValueError as exc:
            raise UpstreamError("BOA returned non-JSON response.") from exc

        body = payload.get("body", [])
        if not body or body[0].get("Payer's Name") == "Invalid reference number":
            raise ReceiptNotFoundError(
                "BOA did not find a transaction for this reference and account suffix."
            )

        row = body[0]
        parsed = self._parse_row(row)
        parsed["source_url"] = url
        parsed["reference"] = reference
        parsed["bank"] = self.BANK_CODE
        parsed["raw"] = payload
        return VerificationResult(
            status=VerificationStatus.VERIFIED,
            exists=True,
            **parsed,
        )

    def _parse_row(self, row: dict) -> dict:
        data: dict = {}

        data["sender_name"] = row.get("Source Account Name")
        data["sender_account"] = row.get("Source Account")
        data["receiver_name"] = row.get("Receiver's Name")
        data["receiver_account"] = row.get("Receiver's Account")
        data["currency"] = row.get("currency", "ETB")

        amount_raw = row.get("Transferred Amount", "")
        if amount_raw:
            try:
                data["amount"] = float(re.sub(r"[^0-9.]", "", str(amount_raw)))
            except ValueError:
                pass

        date_raw = row.get("Transaction Date", "")
        if date_raw:
            for fmt in ("%d-%b-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y %H:%M:%S"):
                try:
                    data["transaction_date"] = datetime.strptime(date_raw, fmt)
                    break
                except ValueError:
                    continue

        return data
