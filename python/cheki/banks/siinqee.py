from cheki.banks.base import BankVerifier
from cheki.errors import UnsupportedBankError
from cheki.result import VerificationResult, VerificationStatus


class SiinqeeVerifier(BankVerifier):
    """Siinqee Bank receipt verifier.

    Siinqee does not provide a public receipt verification URL.
    check.et falls back to the Zemen share endpoint or image verification.
    """

    BANK_CODE = "siinqee"
    BANK_NAME = "Siinqee Bank"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        raise UnsupportedBankError(
            "Siinqee Bank does not provide a public receipt verification URL. "
            "Use image verification or a different service."
        )
