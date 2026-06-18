"""Free, open-source Ethiopian bank/wallet receipt verification.

Reverse-engineered public receipt endpoints. No API keys, no paywalls.
"""

from ethio_receipt_verify.result import VerificationResult, VerificationStatus
from ethio_receipt_verify.registry import verify, supported_banks

__version__ = "0.1.0"
__all__ = ["VerificationResult", "VerificationStatus", "verify", "supported_banks"]
