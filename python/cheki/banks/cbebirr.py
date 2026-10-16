import re
from urllib.parse import quote

import requests

from cheki.banks.base import BankVerifier
from cheki.errors import ReceiptNotFoundError, UpstreamError
from cheki.result import VerificationResult, VerificationStatus

_TID_RE = re.compile(r"^[A-Za-z0-9]{8,16}$")


def normalize_phone(phone: str) -> str:
    """Return the payer's wallet number as 251XXXXXXXXX, the form CBE Birr's
    own receipt links use. Accepts +251, 251, 09/07 and bare 9-digit forms."""
    digits = re.sub(r"[\s()+-]", "", phone)
    local = None
    if digits.isdigit():
        if len(digits) == 12 and digits.startswith("251"):
            local = digits[3:]
        elif len(digits) == 10 and digits.startswith("0"):
            local = digits[1:]
        elif len(digits) == 9:
            local = digits
    if not local or not re.fullmatch(r"[79]\d{8}", local):
        raise ValueError(
            "Enter the payer's CBE Birr phone number, e.g. 09XXXXXXXX or 2519XXXXXXXX."
        )
    return f"251{local}"


class CBEBirrVerifier(BankVerifier):
    """CBE Birr receipt verifier (direct mode).

    Public endpoint:
        https://cbepay1.cbe.com.et/aureceipt?TID=<RECEIPT NUMBER>&PH=<PAYER PHONE>

    Direct mode does not parse CBE Birr receipts, so it never reports a
    receipt as verified. An unknown TID/PH returns HTTP 200 with an empty
    "Auto Receipt" page, and from outside Ethiopia a real receipt has come back
    the same way, so a 200 alone proves nothing. Use ChekiClient for a parsed
    result.
    """

    BANK_CODE = "cbebirr"
    BANK_NAME = "CBE Birr"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        reference = str(reference).strip()
        if not _TID_RE.match(reference):
            raise ValueError("A CBE Birr receipt number is 10 or 11 letters and digits.")
        raw_phone = str(kwargs.get("phone_number", "")).strip()
        if not raw_phone:
            raise ValueError("CBE Birr verification requires the payer phone_number.")
        phone = normalize_phone(raw_phone)
        url = (
            "https://cbepay1.cbe.com.et/aureceipt"
            f"?TID={quote(reference, safe='')}&PH={quote(phone, safe='')}"
        )
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

        is_pdf = resp.content[:5].startswith(b"%PDF")
        return VerificationResult(
            bank=self.BANK_CODE,
            reference=reference,
            status=VerificationStatus.UNAVAILABLE,
            exists=False,
            source_url=url,
            raw={"content_type": resp.headers.get("Content-Type", ""), "is_pdf": is_pdf},
            message=(
                "CBE Birr returned a receipt PDF, but direct mode does not parse it. "
                "Use ChekiClient or open the receipt link."
                if is_pdf
                else "CBE Birr sent an empty receipt page, so this could not be confirmed "
                "either way. Open the receipt link from an Ethiopian network."
            ),
        )
