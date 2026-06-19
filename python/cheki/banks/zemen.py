from io import BytesIO

import pdfplumber
import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus


class ZemenVerifier(BankVerifier):
    """Zemen Bank receipt verifier.

    Zemen serves a public PDF receipt at:
        https://share.zemenbank.com/rt/<REFERENCE>/pdf
    """

    BANK_CODE = "zemen"
    BANK_NAME = "Zemen Bank"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        url = f"https://share.zemenbank.com/rt/{reference}/pdf"
        try:
            resp = self._get(url)
        except requests.RequestException as exc:
            raise UpstreamError(f"Zemen receipt endpoint unreachable: {exc}") from exc

        if resp.status_code == 404:
            raise ReceiptNotFoundError("Zemen did not find a receipt for this reference.")
        if resp.status_code != 200 or not resp.content.startswith(b"%PDF"):
            raise UpstreamError(f"Zemen returned status {resp.status_code} and no PDF.")

        text = ""
        with pdfplumber.open(BytesIO(resp.content)) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)

        if not text or "Zemen" not in text:
            raise ReceiptNotFoundError("Zemen PDF did not contain a valid receipt.")

        return VerificationResult(
            bank=self.BANK_CODE,
            reference=reference,
            status=VerificationStatus.VERIFIED,
            exists=True,
            source_url=url,
            raw={"pdf_text": text},
            message="Zemen receipt downloaded. Detailed parsing is not yet implemented.",
        )
