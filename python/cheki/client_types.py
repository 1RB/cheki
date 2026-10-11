"""Typed response models and errors for the cheki REST API client.

These dataclasses mirror the JSON payloads returned by the cheki API
(https://cheki.et). Every model exposes a ``from_dict``
classmethod that maps the API's ``camelCase`` keys to Pythonic
``snake_case`` attributes, and a ``to_dict`` method for the inverse
transform.

The parsers are deliberately tolerant: unknown keys are ignored and
missing keys fall back to ``None``/sensible defaults so the client keeps
working as the API evolves.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict
from typing import Any, Mapping, Sequence


# ─── Errors ──────────────────────────────────────────────────────────


class ChekiClientError(Exception):
    """Base class for all cheki API client errors."""


class ChekiAPIError(ChekiClientError):
    """Raised when the cheki API returns a non-2xx HTTP status.

    Attributes:
        message: Human-readable description of the failure.
        status_code: The HTTP status code returned by the server.
        body: The raw response body (string), when available.
    """

    def __init__(self, message: str, status_code: int = 0, body: str = "") -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.body = body

    def __str__(self) -> str:
        if self.status_code:
            return f"[{self.status_code}] {self.message}"
        return self.message


class ChekiRateLimitError(ChekiAPIError):
    """HTTP 429. ``retry_after`` is the server's Retry-After in seconds, if sent."""

    def __init__(self, message: str, status_code: int = 429, body: str = "", retry_after: float | None = None) -> None:
        super().__init__(message, status_code=status_code, body=body)
        self.retry_after = retry_after


class ChekiPayloadTooLargeError(ChekiAPIError):
    """HTTP 413: the request body is over the route's cap (verify 16 KB, batch 64 KB)."""


class ChekiNetworkError(ChekiClientError):
    """Raised when a network-level failure prevents reaching the API."""


class ChekiTimeoutError(ChekiNetworkError):
    """Raised when an API request times out."""


# ─── Helpers ─────────────────────────────────────────────────────────


_CAMEL_RE = re.compile(r"(?<!^)(?=[A-Z])")


def _to_snake_case(name: str) -> str:
    """Convert a ``camelCase`` / ``PascalCase`` string to ``snake_case``."""
    return _CAMEL_RE.sub("_", name).lower()


def _coerce_float(value: Any) -> float | None:
    """Best-effort coercion of an API value to ``float``.

    Tolerates comma-formatted numeric strings (e.g. ``"1,234.50"``)
    that some bank endpoints return.
    """
    if value is None or value == "":
        return None
    if isinstance(value, str):
        value = value.replace(",", "").strip()
        if not value:
            return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _coerce_int(value: Any) -> int | None:
    """Best-effort coercion of an API value to ``int``."""
    if value is None or value == "":
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_bool(value: Any) -> bool | None:
    """Best-effort coercion of an API value to ``bool``."""
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {"true", "1", "yes"}
    return bool(value)


# ─── Verify result ───────────────────────────────────────────────────


@dataclass
class ClientVerifyResult:
    """Result of a single receipt verification against the cheki API.

    Mirrors the JSON returned by ``POST /api/verify`` (and each batch item).
    On failure ``success`` is ``False`` and ``error`` describes the problem;
    ``http_status`` / ``retry_after`` say why (e.g. 429 with Retry-After).

    ``is_verified`` is the ONLY success signal. ``success`` only means the
    request was processed: a BOA QR code that could not be confirmed with
    the bank comes back with ``success=True, verified=False,
    decoded_only=True``.
    """

    success: bool = False
    verified: bool = False
    #: BOA QR only: decrypted but not confirmed with the bank. Never proof of payment.
    decoded_only: bool = False
    #: ``/api/parse`` only: parsed from caller-supplied text, never checked with the bank.
    parsed: bool = False
    source: str | None = None
    label: str | None = None
    #: True when the server answered from its receipt cache.
    cached: bool = False
    bank: str | None = None
    bank_code: str | None = None
    reference: str | None = None
    source_url: str | None = None
    sender_name: str | None = None
    sender_account: str | None = None
    receiver_name: str | None = None
    receiver_account: str | None = None
    amount: float | None = None
    currency: str | None = None
    date: str | None = None
    branch: str | None = None
    reason: str | None = None
    transaction_type: str | None = None
    duration_ms: int | None = None
    # Telebirr / wallet-specific fields
    invoice_number: str | None = None
    transaction_status: str | None = None
    settled_amount: float | None = None
    stamp_duty: float | None = None
    discount_amount: float | None = None
    service_fee: float | None = None
    service_fee_vat: float | None = None
    total_paid: float | None = None
    amount_in_words: str | None = None
    payment_mode: str | None = None
    payment_channel: str | None = None
    bank_account_number: str | None = None
    bank_account_name: str | None = None
    # Error reporting
    error: str | None = None
    fallback_url: str | None = None
    #: HTTP status of the response. Failed batch items carry the status a
    #: single verify would have returned (the API's ``status`` field).
    http_status: int | None = None
    #: Seconds from the Retry-After header on a 429, when sent.
    retry_after: float | None = None
    # Batch bookkeeping (index within a batch response)
    index: int | None = None
    # The raw, unparsed payload for advanced consumers.
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def is_verified(self) -> bool:
        """``True`` only when the bank confirmed the receipt.

        ``success``, ``decoded_only`` and ``parsed`` are not proof of payment.
        """
        return self.success is True and self.verified is True

    @property
    def is_rate_limited(self) -> bool:
        """HTTP 429: wait ``retry_after`` seconds (when set) before retrying."""
        return self.http_status == 429

    @property
    def is_payload_too_large(self) -> bool:
        """HTTP 413: the request body is over the route's cap."""
        return self.http_status == 413

    @classmethod
    def from_dict(
        cls,
        data: Mapping[str, Any],
        http_status: int | None = None,
        retry_after: float | None = None,
    ) -> "ClientVerifyResult":
        """Build a :class:`ClientVerifyResult` from a decoded JSON object."""
        known: dict[str, Any] = {"http_status": http_status, "retry_after": retry_after}
        for key, value in data.items():
            if key == "status":
                # Batch items report the per-item HTTP status as ``status``.
                known["http_status"] = _coerce_int(value)
                continue
            attr = _to_snake_case(key)
            if attr in {"raw", "http_status", "retry_after", "index"} or attr not in cls.__dataclass_fields__:
                continue
            # Numeric / boolean coercion for known numeric fields.
            if attr in {
                "amount", "settled_amount", "stamp_duty", "discount_amount",
                "service_fee", "service_fee_vat", "total_paid",
            }:
                value = _coerce_float(value)
            elif attr == "duration_ms":
                value = _coerce_int(value)
            elif attr in {"success", "verified", "decoded_only", "parsed", "cached"}:
                value = value is True
            known[attr] = value
        known["raw"] = dict(data)
        return cls(**known)

    def to_dict(self) -> dict[str, Any]:
        """Serialize this result back to a JSON-compatible dict."""
        return asdict(self)


# ─── Batch result ────────────────────────────────────────────────────


@dataclass
class ClientBatchResult:
    """Result of a batch verification request (``POST /api/verify/batch``).

    The API returns ``{success, results, total, verified, failed, cached}``.
    ``verified`` counts only ``verified: true`` items; ``failed`` is
    everything else (errors and decoded-only QR results). Counts are
    derived from ``results`` if a server omits them.
    """

    success: bool = False
    total: int = 0
    verified: int = 0
    failed: int = 0
    cached: int = 0
    results: list[ClientVerifyResult] = field(default_factory=list)
    error: str | None = None
    #: HTTP status of the batch request itself.
    http_status: int | None = None
    #: Seconds from the Retry-After header on a 429, when sent.
    retry_after: float | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def is_rate_limited(self) -> bool:
        """HTTP 429 for the whole batch."""
        return self.http_status == 429

    @classmethod
    def from_dict(
        cls,
        data: Mapping[str, Any],
        http_status: int | None = None,
        retry_after: float | None = None,
    ) -> "ClientBatchResult":
        """Build a :class:`ClientBatchResult` from a decoded JSON object."""
        raw_results = data.get("results") or []
        results: list[ClientVerifyResult] = []
        if isinstance(raw_results, Sequence):
            for entry in raw_results:
                if isinstance(entry, Mapping):
                    item = ClientVerifyResult.from_dict(entry)
                    item.index = len(results)
                    results.append(item)

        total = _coerce_int(data.get("total"))
        verified = _coerce_int(data.get("verified"))
        failed = _coerce_int(data.get("failed"))

        # Derive summary counts from results when the API omits them.
        if total is None:
            total = len(results)
        if verified is None:
            verified = sum(1 for r in results if r.is_verified)
        if failed is None:
            failed = sum(1 for r in results if not r.is_verified)

        return cls(
            success=data.get("success") is True,
            total=total,
            verified=verified or 0,
            failed=failed or 0,
            cached=_coerce_int(data.get("cached")) or 0,
            results=results,
            error=data.get("error"),
            http_status=http_status,
            retry_after=retry_after,
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize this batch result back to a JSON-compatible dict."""
        return {
            "success": self.success,
            "total": self.total,
            "verified": self.verified,
            "failed": self.failed,
            "cached": self.cached,
            "results": [r.to_dict() for r in self.results],
            "error": self.error,
        }


# ─── Bank info ───────────────────────────────────────────────────────


@dataclass
class ClientReceiptFormat:
    """One receipt format of a bank, from ``GET /api/banks``.

    A bank's formats come current first: lead with the first ``supported``
    one and offer the rest as older receipts. ``status`` is ``"current"``, ``"legacy"``
    (still works) or ``"deprecated"`` (links are only read for their
    reference).
    """

    id: str = ""
    status: str = ""
    label: str = ""
    #: What the format needs: "reference", "receiptId", "link", "account", "phone".
    inputs: list[str] = field(default_factory=list)
    account_digits: int | None = None
    response_type: str = ""
    #: False when cheki documents the format but can't check it yet.
    supported: bool = False
    #: "verified" (observed by cheki) or "inferred".
    confidence: str = ""

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientReceiptFormat":
        """Build a :class:`ClientReceiptFormat` from a decoded JSON object."""
        inputs = data.get("inputs")
        return cls(
            id=str(data.get("id") or ""),
            status=str(data.get("status") or ""),
            label=str(data.get("label") or ""),
            inputs=[str(i) for i in inputs] if isinstance(inputs, list) else [],
            account_digits=_coerce_int(data.get("accountDigits")),
            response_type=str(data.get("responseType") or ""),
            supported=data.get("supported") is True,
            confidence=str(data.get("confidence") or ""),
        )


@dataclass
class ClientBankInfo:
    """Metadata for a single bank/wallet supported by cheki.

    Mirrors an element of the ``banks`` array returned by
    ``GET /api/banks``. :attr:`id` is the value to pass as ``bank``;
    :attr:`code` is kept as an alias with the same value.
    """

    id: str = ""
    code: str = ""
    name: str = ""
    swift: str | None = None
    type: str | None = None
    status: str | None = None
    requires_account: bool = False
    account_digits: int | None = None
    requires_phone: bool = False
    #: URL template of the bank's current format (informational).
    endpoint: str | None = None
    color: str | None = None
    initials: str | None = None
    #: Receipt formats, current first (empty when the server is older than this SDK).
    formats: list[ClientReceiptFormat] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def is_live(self) -> bool:
        """``True`` when the bank integration is operational."""
        return self.status == "live"

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientBankInfo":
        """Build a :class:`ClientBankInfo` from a decoded JSON object."""
        # The API exposes the identifier as ``id``; fall back to ``code``.
        code = data.get("id") or data.get("code") or ""
        raw_formats = data.get("formats")
        formats_list: list[Any] = raw_formats if isinstance(raw_formats, list) else []
        return cls(
            id=str(code),
            code=str(code),
            name=str(data.get("name") or ""),
            swift=data.get("swift"),
            type=data.get("type"),
            status=data.get("status"),
            requires_account=bool(_coerce_bool(data.get("requiresAccount")) or False),
            account_digits=_coerce_int(data.get("accountDigits")),
            requires_phone=bool(_coerce_bool(data.get("requiresPhone")) or False),
            endpoint=data.get("endpoint"),
            color=data.get("color"),
            initials=data.get("initials"),
            formats=[
                ClientReceiptFormat.from_dict(f)
                for f in formats_list
                if isinstance(f, Mapping)
            ],
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize this bank info back to a JSON-compatible dict."""
        return {
            "id": self.id,
            "code": self.code,  # deprecated alias of id
            "name": self.name,
            "swift": self.swift,
            "type": self.type,
            "status": self.status,
            "requiresAccount": self.requires_account,
            "accountDigits": self.account_digits,
            "requiresPhone": self.requires_phone,
            "endpoint": self.endpoint,
            "color": self.color,
            "initials": self.initials,
            "formats": [
                {
                    "id": f.id,
                    "status": f.status,
                    "label": f.label,
                    "inputs": list(f.inputs),
                    "accountDigits": f.account_digits,
                    "responseType": f.response_type,
                    "supported": f.supported,
                    "confidence": f.confidence,
                }
                for f in self.formats
            ],
        }


# ─── Health ──────────────────────────────────────────────────────────


@dataclass
class ClientHealthCheck:
    """A single per-bank health check entry.

    The cheki health endpoint reports reachability per bank: ``id``,
    ``name``, ``status`` (reachable, unreachable, geo-blocked, no-parser,
    in-development) and ``latency_ms``.
    """

    id: str = ""
    name: str = ""
    status: str = ""
    latency_ms: int | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientHealthCheck":
        return cls(
            id=str(data.get("id") or ""),
            name=str(data.get("name") or data.get("id") or ""),
            status=str(data.get("status") or ""),
            latency_ms=_coerce_int(data.get("latencyMs")),
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        return {"id": self.id, "name": self.name, "status": self.status, "latencyMs": self.latency_ms}


@dataclass
class ClientHealthStatus:
    """Health of the cheki service (``GET /api/health``).

    The API returns ``{status, checkedAt, banks: [...], cached}`` and caches
    the probe for up to 5 minutes. :attr:`checks` is a deprecated alias of
    :attr:`banks`.
    """

    status: str = "unknown"
    checked_at: str | None = None
    cached: bool = False
    banks: list[ClientHealthCheck] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def checks(self) -> list[ClientHealthCheck]:
        """Deprecated alias of :attr:`banks`."""
        return self.banks

    @property
    def is_ok(self) -> bool:
        """``True`` when the service answered ``status: "ok"``."""
        return self.status == "ok"

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientHealthStatus":
        banks_raw = data.get("banks") or []
        banks: list[ClientHealthCheck] = []
        if isinstance(banks_raw, Sequence):
            for entry in banks_raw:
                if isinstance(entry, Mapping):
                    banks.append(ClientHealthCheck.from_dict(entry))
        return cls(
            status=str(data.get("status") or "unknown"),
            checked_at=data.get("checkedAt"),
            cached=data.get("cached") is True,
            banks=banks,
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status,
            "checkedAt": self.checked_at,
            "cached": self.cached,
            "banks": [c.to_dict() for c in self.banks],
        }


__all__ = [
    "ChekiClientError",
    "ChekiAPIError",
    "ChekiRateLimitError",
    "ChekiPayloadTooLargeError",
    "ChekiNetworkError",
    "ChekiTimeoutError",
    "ClientVerifyResult",
    "ClientBatchResult",
    "ClientBankInfo",
    "ClientHealthCheck",
    "ClientHealthStatus",
]
