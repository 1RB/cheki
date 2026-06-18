import requests

from ethio_receipt_verify.banks.base import BankVerifier
from ethio_receipt_verify.errors import ReceiptNotFoundError, UpstreamError
from ethio_receipt_verify.result import VerificationResult, VerificationStatus


class CBEBirrVerifier(BankVerifier):
    """CBE Birr receipt verifier.

    Known public endpoint (from check.et):
        https://cbepay1.cbe.com.et/aureceipt?TID=<REFERENCE>&PH=<PHONE>
    Currently times out; server appears down or geo-blocked.
    """

    BANK_CODE = "cbebirr"
    BANK_NAME = "CBE Birr"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        phone = str(kwargs.get("phone_number", "")).replace(" ", "")
        if not phone:
            raise ValueError("CBE Birr verification requires the payer phone_number.")
        url = f"https://cbepay1.cbe.com.et/aureceipt?TID={reference}&PH={phone}"
        try:
            resp = self._get(url, timeout=20)
        except requests.Timeout as exc:
            raise UpstreamError(
                "CBE Birr receipt endpoint timed out. It may be down or geo-blocked."
            ) from exc
        except requests.RequestException as exc:
            raise UpstreamError(f"CBE Birr receipt endpoint unreachable: {exc}") from exc

        if resp.status_code != 200:
            raise ReceiptNotFoundError(
                f"CBE Birr did not return a receipt (status {resp.status_code})."
            )

        return VerificationResult(
            bank=self.BANK_CODE,
            reference=reference,
            status=VerificationStatus.VERIFIED,
            exists=True,
            source_url=url,
            raw={"response": resp.text[:2000]},
            message="CBE Birr receipt fetched. Detailed parsing is not yet implemented.",
        )
