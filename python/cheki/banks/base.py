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
        return self.session.get(url, timeout=30, **kwargs)

    def _post(self, url: str, **kwargs) -> requests.Response:
        return self.session.post(url, timeout=30, **kwargs)
