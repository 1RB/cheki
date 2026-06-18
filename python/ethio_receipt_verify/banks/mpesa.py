import requests

from ethio_receipt_verify.banks.base import BankVerifier
from ethio_receipt_verify.errors import ReceiptNotFoundError, UpstreamError
from ethio_receipt_verify.result import VerificationResult, VerificationStatus


class MPesaVerifier(BankVerifier):
    """M-Pesa Ethiopia receipt verifier.

    Safaricom Ethiopia serves a public JSON endpoint at:
        https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=<TRANSACTION_NUMBER>
    """

    BANK_CODE = "mpesa"
    BANK_NAME = "M-Pesa Ethiopia"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        url = f"https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo={reference}"
        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(f"M-Pesa receipt endpoint unreachable: {exc}") from exc

        if resp.status_code != 200:
            raise UpstreamError(f"M-Pesa returned status {resp.status_code}.")

        try:
            payload = resp.json()
        except ValueError as exc:
            raise UpstreamError("M-Pesa returned non-JSON response.") from exc

        response_code = payload.get("responseCode")
        if response_code and str(response_code) != "0":
            raise ReceiptNotFoundError(
                payload.get("responseDescription", "M-Pesa receipt not found.")
            )

        parsed = self._parse_payload(payload)
        parsed["source_url"] = url
        parsed["reference"] = reference
        parsed["bank"] = self.BANK_CODE
        parsed["raw"] = payload
        return VerificationResult(
            status=VerificationStatus.VERIFIED,
            exists=True,
            **parsed,
        )

    def _parse_payload(self, payload: dict) -> dict:
        data: dict = {}
        # Field names are guessed from common M-Pesa receipt layouts.
        # Update these once a real receipt is observed.
        data["sender_name"] = payload.get("senderName") or payload.get("payerName")
        data["receiver_name"] = payload.get("receiverName") or payload.get("creditPartyName")
        data["sender_account"] = payload.get("senderAccount") or payload.get("payerPhone")
        data["receiver_account"] = payload.get("receiverAccount") or payload.get("creditPartyPhone")
        data["currency"] = payload.get("currency", "ETB")
        amount = payload.get("amount") or payload.get("transactionAmount")
        if amount is not None:
            try:
                data["amount"] = float(amount)
            except (ValueError, TypeError):
                pass
        return data
