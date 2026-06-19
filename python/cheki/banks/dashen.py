import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus


class DashenVerifier(BankVerifier):
    """Dashen Bank receipt verifier.

    Known public endpoint:
        https://receipt.dashensuperapp.com/receipt/<REFERENCE>
    Currently often returns {"message":"please try again later"}.
    """

    BANK_CODE = "dashen"
    BANK_NAME = "Dashen Bank"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        url = f"https://receipt.dashensuperapp.com/receipt/{reference}"
        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(f"Dashen receipt endpoint unreachable: {exc}") from exc

        if resp.status_code == 404:
            raise ReceiptNotFoundError("Dashen did not find a receipt for this reference.")
        if resp.status_code >= 500 or "please try again later" in resp.text:
            raise UpstreamError(
                "Dashen receipt endpoint is currently unavailable. Geo-blocking suspected."
            )
        if resp.status_code != 200:
            raise UpstreamError(f"Dashen returned status {resp.status_code}.")

        return VerificationResult(
            bank=self.BANK_CODE,
            reference=reference,
            status=VerificationStatus.VERIFIED,
            exists=True,
            source_url=url,
            raw={"response": resp.text[:2000]},
            message="Dashen receipt fetched. Detailed parsing is not yet implemented.",
        )
