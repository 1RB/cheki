from abc import ABC, abstractmethod

import requests

from cheki.result import VerificationResult


class BankVerifier(ABC):
    """Base class for bank/wallet receipt verifiers."""

    BANK_CODE: str
    BANK_NAME: str

    def __init__(self, session: requests.Session | None = None):
        self.session = session or requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (compatible; ethio-receipt-verify/0.1.0)"
        })

    @abstractmethod
    def verify(self, reference: str, **kwargs: object) -> VerificationResult:
        """Verify a receipt by its reference number."""
        ...

    def _get(self, url: str, **kwargs) -> requests.Response:
        # A caller may pass its own timeout; a fixed timeout=30 plus theirs
        # raised "multiple values for keyword argument 'timeout'".
        kwargs.setdefault("timeout", 30)
        return self.session.get(url, **kwargs)

    def _post(self, url: str, **kwargs) -> requests.Response:
        kwargs.setdefault("timeout", 30)
        return self.session.post(url, **kwargs)
