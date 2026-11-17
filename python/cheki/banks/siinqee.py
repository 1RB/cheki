from cheki.banks.base import BankVerifier
from cheki.errors import UnsupportedBankError
from cheki.result import VerificationResult


class SiinqeeVerifier(BankVerifier):
    """Siinqee Bank receipt verifier (not available in direct mode).

    Siinqee receipts are read by the cheki server from
    receipts.siinqeebank.com:871/generate/{reference} (beta). The deprecated
    direct mode has no parser for them: use ``cheki.ChekiClient`` instead.
    """

    BANK_CODE = "siinqee"
    BANK_NAME = "Siinqee Bank"

    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        raise UnsupportedBankError(
            "Siinqee Bank is not supported by the deprecated direct mode. "
            "Use cheki.ChekiClient().verify('siinqee', reference) instead."
        )
