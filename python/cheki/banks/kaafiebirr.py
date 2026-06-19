from cheki.banks.base import BankVerifier
from cheki.errors import UnsupportedBankError
from cheki.result import VerificationResult


class KaafiEbirrbankVerifier(BankVerifier):
    """Kaafi Ebirr receipt verifier.

    Kaafi Ebirr is supported by verify.et but the public receipt endpoint is
    not yet known. The domain kaafibank.et hosts a default Plesk page, not
    the wallet service.
    """

    BANK_CODE = "kaafiebirr"
    BANK_NAME = "Kaafi Ebirr"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        raise UnsupportedBankError(
            "Kaafi Ebirr public receipt endpoint is not yet reverse-engineered. "
            "Contributions welcome."
        )
