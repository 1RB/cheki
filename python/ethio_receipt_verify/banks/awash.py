import requests

from ethio_receipt_verify.banks.base import BankVerifier
from ethio_receipt_verify.errors import ReceiptNotFoundError, UpstreamError
from ethio_receipt_verify.result import VerificationResult, VerificationStatus


class AwashVerifier(BankVerifier):
    """Awash Bank receipt verifier.

    Known public endpoint (from check.et):
        https://awashpay.awashbank.com:8225/-<REFERENCE>
    Port 8225 currently returns 403; port 443 returns a generic landing page.
    The exact working URL format is still unknown.
    """

    BANK_CODE = "awash"
    BANK_NAME = "Awash Bank"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        urls = [
            f"https://awashpay.awashbank.com:8225/-{reference}",
            f"https://awashpay.awashbank.com/{reference}",
            f"https://awashpay.awashbank.com/receipt/{reference}",
        ]
        last_exc: Exception | None = None
        for url in urls:
            try:
                resp = self._get(url, verify=False)
            except requests.RequestException as exc:
                last_exc = exc
                continue
            if resp.status_code == 200 and "Invalid receipt id" not in resp.text and "Servicecops" not in resp.text:
                return VerificationResult(
                    bank=self.BANK_CODE,
                    reference=reference,
                    status=VerificationStatus.VERIFIED,
                    exists=True,
                    source_url=url,
                    raw={"response": resp.text[:2000]},
                    message="Awash receipt fetched. Detailed parsing is not yet implemented.",
                )
            if resp.status_code == 404 or "Invalid receipt id" in resp.text:
                raise ReceiptNotFoundError("Awash did not find a receipt for this reference.")

        raise UpstreamError(
            f"Awash receipt endpoint could not be reached. Last error: {last_exc}"
        )
