class VerificationError(Exception):
    """Base error for verification failures."""


class ReceiptNotFoundError(VerificationError):
    """The bank/wallet returned a "not found" response."""


class UpstreamError(VerificationError):
    """The bank/wallet endpoint is unavailable or returned an unexpected error."""


class UnsupportedBankError(VerificationError):
    """The bank is not supported yet."""
