"""Direct verification (deprecated).

:func:`verify` fetches bank endpoints from your own machine. These Python
parsers have drifted from the server's TypeScript parsers and lack the
server's hardening (the shared verification gate, the host allowlist, the
ReDoS fixes, the eBirr/Siinqee and new Dashen support). Use
:class:`cheki.ChekiClient` instead, or self-host the cheki server.

Until it is removed, :func:`verify`:

* emits a :class:`DeprecationWarning`;
* rejects references that are not plain receipt numbers (no ``/ ? # & %``,
  ``..`` or whitespace), so nothing can be smuggled into a bank URL;
* runs a fail-closed port of the server's verification gate: a result is
  only ``VERIFIED`` with a positive amount, a returned reference that matches
  the requested one (except opaque share tokens), at least one party, and no
  failure/pending transaction status. Anything else becomes ``FAILED``.
"""

from __future__ import annotations

import math
import re
import warnings
from typing import Any

from cheki.result import VerificationResult, VerificationStatus

_DIRECT_EXTRA_MISSING = (
    "Direct verification needs extra dependencies (beautifulsoup4, pdfplumber) that the API client "
    "does not: pip install 'cheki[direct]'. Prefer cheki.ChekiClient, which needs neither."
)


class DirectModeUnavailableError(ImportError):
    """Raised by the deprecated direct mode when ``cheki[direct]`` is not installed."""


def _verifiers() -> dict[str, Any]:
    """The direct verifiers, imported on first use so ``import cheki`` needs only requests."""
    try:
        from cheki.banks import VERIFIERS
    except ImportError as exc:  # beautifulsoup4 / pdfplumber missing
        raise DirectModeUnavailableError(_DIRECT_EXTRA_MISSING) from exc
    return VERIFIERS

_SAFE_REFERENCE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}")

# Same list as src/lib/core/status.ts (FAILURE_RE).
_FAILURE_STATUS = re.compile(
    r"\b(fail(?:ed|ure|s)?|unsuccessful|revers(?:ed|al|e)|pending|cancel(?:l)?ed|cancel(?:l)?ation|declined"
    r"|rejected|expired|refunded|error|timed?\s?out|in\s+progress|processing|on\s+hold|initiated|incomplete"
    r"|not\s+(?:completed|successful|paid)|voided?|charge\s?backs?|disputed?|suspended|rolled\s?back|returned"
    r"|bounced)\b",
    re.IGNORECASE,
)

# Same set as src/lib/core/gate.ts (REFERENCE_IS_OPAQUE_TOKEN): lookup keys that are
# share tokens, so the receipt's own reference never equals the requested one.
# "cbe-new" is CBE's current format (the Receipt ID); the receipt carries the FT id.
# "zamzam" is looked up by its numeric receipt id; the record carries ZamZam's own
# transaction reference (no direct verifier here: use ChekiClient for ZamZam).
_REFERENCE_IS_OPAQUE_TOKEN = frozenset({"awash", "ebirr", "siinqee", "cbe-new", "zamzam"})

_DEPRECATION = (
    "cheki.verify() (direct verification) is deprecated and will be removed in the next major "
    "version. Its parsers lack the server's verification gate and hardening. Use "
    "cheki.ChekiClient().verify(...) instead, or self-host the cheki server."
)


def supported_banks() -> dict[str, str]:
    """Banks the deprecated direct verifiers know (not the hosted API's list).

    Raises:
        DirectModeUnavailableError: When ``cheki[direct]`` is not installed.
    """
    return {code: cls.BANK_NAME for code, cls in _verifiers().items()}


def _status_text(result: VerificationResult) -> str | None:
    raw: dict[str, Any] = result.raw if isinstance(result.raw, dict) else {}
    for key in ("transaction_status", "transactionStatus", "status"):
        value = raw.get(key)
        if isinstance(value, str) and value.strip():
            return value
    return None


def _normalize_reference(ref: object) -> str:
    return re.sub(r"\s+", "", ref).upper() if isinstance(ref, str) else ""


def gate(result: VerificationResult, requested_reference: str | None = None) -> VerificationResult:
    """Fail-closed port of the server's verification gate (src/lib/core/gate.ts).

    A ``VERIFIED`` result is downgraded to ``FAILED`` unless it has a finite
    amount greater than zero, a returned reference (``raw["bank_reference"]``,
    when the bank gives one) equal to ``requested_reference``, at least one
    party, and no failure status. The reference check is keyed like the
    server's: by ``raw["gate_id"]`` (the format's parser, e.g. ``cbe-new``)
    or else the bank, and skipped for opaque share tokens.
    """
    if result.status is not VerificationStatus.VERIFIED:
        return result
    reason: str | None = None
    raw: dict[str, Any] = result.raw if isinstance(result.raw, dict) else {}
    gate_id = str(raw.get("gate_id") or result.bank or "").lower()
    returned = _normalize_reference(raw.get("bank_reference"))
    requested = _normalize_reference(requested_reference)
    amount = result.amount
    if not isinstance(amount, (int, float)) or not math.isfinite(amount) or amount <= 0:
        reason = "The bank's response has no valid amount, so it cannot be confirmed as a receipt."
    elif gate_id not in _REFERENCE_IS_OPAQUE_TOKEN and returned and requested and returned != requested:
        reason = "The bank returned a receipt with a different reference than the one you entered."
    elif not any(
        isinstance(v, str) and v.strip()
        for v in (result.sender_name, result.receiver_name, result.sender_account, result.receiver_account)
    ):
        reason = "The bank's response is missing the payer and receiver, so it cannot be confirmed as a receipt."
    else:
        status = _status_text(result)
        if status and _FAILURE_STATUS.search(status[:80]):
            reason = f'The bank lists this transaction as "{status[:40]}". It is not a completed payment.'
    if reason is None:
        return result
    result.status = VerificationStatus.FAILED
    result.exists = False
    result.message = reason
    return result


def verify(bank: str, reference: str, **kwargs: object) -> VerificationResult:
    """Verify a receipt directly against the bank (deprecated).

    Args:
        bank: Bank/wallet code, e.g. "cbe", "telebirr", "boa", "mpesa".
        reference: Transaction reference number. For CBE, the Receipt ID from
            the receipt link (mbreciept.cbe.com.et/<Receipt ID>); an older FT
            reference also needs account_number.
        **kwargs: Bank-specific extras:
            - cbe (older FT reference only): account_number (receiving account)
            - boa: account_number (the account on the receipt, last 5 digits)
            - cbebirr: phone_number (payer phone)

    Raises:
        ValueError: For an unknown bank or a reference that is not a plain
            receipt number.
        DirectModeUnavailableError: When ``cheki[direct]`` is not installed
            (``pip install 'cheki[direct]'``).
    """
    warnings.warn(_DEPRECATION, DeprecationWarning, stacklevel=2)
    verifiers = _verifiers()
    bank = bank.lower().strip()
    if bank not in verifiers:
        raise ValueError(f"Unsupported bank '{bank}'. Supported: {', '.join(verifiers)}")
    ref = (reference or "").strip()
    if not _SAFE_REFERENCE.fullmatch(ref) or ".." in ref:
        raise ValueError(
            "A reference can only contain letters, digits, dots, dashes and underscores "
            "(no /, ?, #, &, %, '..' or spaces), up to 64 characters."
        )
    verifier = verifiers[bank]()
    return gate(verifier.verify(ref, **kwargs), requested_reference=ref)
