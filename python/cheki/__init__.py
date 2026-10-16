"""Free, open-source Ethiopian bank/wallet receipt verification.

Use :class:`ChekiClient`, which wraps the hosted cheki REST API
(https://cheki.et) and matches the other cheki SDKs::

    from cheki import ChekiClient

    with ChekiClient() as cheki:
        result = cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01")
        if result.is_verified:   # the ONLY success signal
            print(result.amount, result.sender_name)

:func:`verify` (direct verification from your own machine) is deprecated:
its parsers lack the server's verification gate, host allowlist and parser
fixes. It now emits a :class:`DeprecationWarning`, runs a fail-closed
verification gate, and will be removed in the next major version. Since
1.5.0 it needs ``pip install 'cheki[direct]'`` (beautifulsoup4, pdfplumber);
the API client needs only ``requests``.
"""

from cheki._version import __version__
from cheki.result import VerificationResult, VerificationStatus
from cheki.registry import verify, supported_banks, DirectModeUnavailableError
from cheki.client import ChekiClient, DEFAULT_BASE_URL, MAX_BATCH_SIZE, RECOMMENDED_BATCH_CHUNK
from cheki.client_types import (
    ChekiClientError,
    ChekiAPIError,
    ChekiRateLimitError,
    ChekiPayloadTooLargeError,
    ChekiNetworkError,
    ChekiTimeoutError,
    ClientVerifyResult,
    ClientBatchResult,
    ClientBankInfo,
    ClientReceiptFormat,
    ClientHealthCheck,
    ClientHealthStatus,
)

__all__ = [
    "__version__",
    # API client
    "ChekiClient",
    "DEFAULT_BASE_URL",
    "MAX_BATCH_SIZE",
    "RECOMMENDED_BATCH_CHUNK",
    "ChekiClientError",
    "ChekiAPIError",
    "ChekiRateLimitError",
    "ChekiPayloadTooLargeError",
    "ChekiNetworkError",
    "ChekiTimeoutError",
    "ClientVerifyResult",
    "ClientBatchResult",
    "ClientBankInfo",
    "ClientReceiptFormat",
    "ClientHealthCheck",
    "ClientHealthStatus",
    # Direct verification (deprecated)
    "VerificationResult",
    "VerificationStatus",
    "verify",
    "supported_banks",
    "DirectModeUnavailableError",
]
