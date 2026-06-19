"""Free, open-source Ethiopian bank/wallet receipt verification.

cheki offers two complementary verification modes:

1. **API client** — :class:`ChekiClient` wraps the hosted cheki REST API
   (https://cheki-pi.vercel.app). This is the simplest path and matches
   the other cheki SDKs.

2. **Direct verification** — :func:`verify` fetches bank endpoints
   directly from your machine (advanced; subject to geo-blocking).

Both are importable from the top-level package::

    from ethio_receipt_verify import ChekiClient, verify, supported_banks
"""

from ethio_receipt_verify.result import VerificationResult, VerificationStatus
from ethio_receipt_verify.registry import verify, supported_banks
from ethio_receipt_verify.client import ChekiClient, DEFAULT_BASE_URL
from ethio_receipt_verify.client_types import (
    ChekiClientError,
    ChekiAPIError,
    ChekiNetworkError,
    ChekiTimeoutError,
    ClientVerifyResult,
    ClientBatchResult,
    ClientBankInfo,
    ClientHealthCheck,
    ClientHealthStatus,
)

__version__ = "0.1.0"

__all__ = [
    # Direct verification (advanced)
    "VerificationResult",
    "VerificationStatus",
    "verify",
    "supported_banks",
    # API client
    "ChekiClient",
    "DEFAULT_BASE_URL",
    "ChekiClientError",
    "ChekiAPIError",
    "ChekiNetworkError",
    "ChekiTimeoutError",
    "ClientVerifyResult",
    "ClientBatchResult",
    "ClientBankInfo",
    "ClientHealthCheck",
    "ClientHealthStatus",
]
