"""Typed response models and errors for the cheki REST API client.

These dataclasses mirror the JSON payloads returned by the cheki API
(https://cheki-pi.vercel.app). Every model exposes a ``from_dict``
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
        return float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None


def _coerce_int(value: Any) -> int | None:
    """Best-effort coercion of an API value to ``int``."""
    if value is None or value == "":
        return None
    try:
        return int(value)  # type: ignore[arg-type]
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

    Mirrors the JSON returned by ``POST /api/verify``. On success the
    receipt fields are populated; on failure ``success`` is ``False`` and
    ``error`` describes the problem.
    """

    success: bool = False
    verified: bool | None = None
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
    # Batch bookkeeping (index within a batch response)
    index: int | None = None
    # The raw, unparsed payload for advanced consumers.
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def is_verified(self) -> bool:
        """``True`` when the receipt was confirmed as legitimate."""
        return bool(self.success and self.verified)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientVerifyResult":
        """Build a :class:`ClientVerifyResult` from a decoded JSON object."""
        known: dict[str, Any] = {}
        for key, value in data.items():
            attr = _to_snake_case(key)
            if not hasattr(cls, attr):
                continue
            # Numeric / boolean coercion for known numeric fields.
            if attr in {
                "amount", "settled_amount", "stamp_duty", "discount_amount",
                "service_fee", "service_fee_vat", "total_paid",
            }:
                value = _coerce_float(value)
            elif attr == "duration_ms":
                value = _coerce_int(value)
            elif attr in {"success", "verified"}:
                value = _coerce_bool(value)
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

    The cheki API returns ``{ success, results: [...] }``. When
    ``total`` / ``verified`` / ``failed`` are not provided by the server
    they are derived from ``results`` so callers always get useful
    summaries.
    """

    success: bool = False
    total: int = 0
    verified: int = 0
    failed: int = 0
    results: list[ClientVerifyResult] = field(default_factory=list)
    error: str | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientBatchResult":
        """Build a :class:`ClientBatchResult` from a decoded JSON object."""
        raw_results = data.get("results") or data.get("receipts") or []
        results: list[ClientVerifyResult] = []
        if isinstance(raw_results, Sequence):
            for entry in raw_results:
                if isinstance(entry, Mapping):
                    results.append(ClientVerifyResult.from_dict(entry))

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
            success=bool(_coerce_bool(data.get("success")) or False),
            total=total,
            verified=verified or 0,
            failed=failed or 0,
            results=results,
            error=data.get("error"),
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize this batch result back to a JSON-compatible dict."""
        return {
            "success": self.success,
            "total": self.total,
            "verified": self.verified,
            "failed": self.failed,
            "results": [r.to_dict() for r in self.results],
            "error": self.error,
        }


# ─── Bank info ───────────────────────────────────────────────────────


@dataclass
class ClientBankInfo:
    """Metadata for a single bank/wallet supported by cheki.

    Mirrors an element of the ``banks`` array returned by
    ``GET /api/banks``. The API uses ``id`` as the bank identifier; this
    client normalises it to :attr:`code` for consistency with the other
    SDKs and with the ``bank`` parameter used in verify calls.
    """

    code: str = ""
    name: str = ""
    swift: str | None = None
    type: str | None = None
    status: str | None = None
    requires_account: bool = False
    account_digits: int | None = None
    requires_phone: bool = False
    endpoint: str | None = None
    color: str | None = None
    initials: str | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def is_live(self) -> bool:
        """``True`` when the bank integration is operational."""
        return (self.status or "").lower() in {"live", "active", "ok"}

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientBankInfo":
        """Build a :class:`ClientBankInfo` from a decoded JSON object."""
        # The API exposes the identifier as ``id``; fall back to ``code``.
        code = data.get("id") or data.get("code") or ""
        return cls(
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
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        """Serialize this bank info back to a JSON-compatible dict."""
        return {
            "code": self.code,
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
        }


# ─── Health ──────────────────────────────────────────────────────────


@dataclass
class ClientHealthCheck:
    """A single per-bank health check entry.

    The cheki health endpoint reports reachability per bank. Each entry
    exposes the bank ``name``/``id``, a ``status`` string, and an
    optional ``latency_ms``.
    """

    name: str = ""
    status: str = ""
    latency_ms: int | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientHealthCheck":
        name = data.get("name") or data.get("id") or ""
        return cls(
            name=str(name),
            status=str(data.get("status") or ""),
            latency_ms=_coerce_int(data.get("latencyMs")),
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "status": self.status, "latencyMs": self.latency_ms}


@dataclass
class ClientHealthStatus:
    """Health status of the cheki service (``GET /api/health``).

    The API returns ``{ status, banks: [...] }`` where ``banks`` is the
    list of per-bank reachability checks. This client normalises that
    array into :attr:`checks` and tolerates the optional ``success``,
    ``version`` and ``timestamp`` fields exposed by some deployments.
    """

    success: bool | None = None
    status: str = "unknown"
    version: str | None = None
    timestamp: str | None = None
    checks: list[ClientHealthCheck] = field(default_factory=list)
    raw: dict[str, Any] = field(default_factory=dict, repr=False)

    @property
    def is_ok(self) -> bool:
        """``True`` when the overall service status is healthy."""
        return (self.status or "").lower() in {"ok", "healthy", "up"}

    @classmethod
    def from_dict(cls, data: Mapping[str, Any]) -> "ClientHealthStatus":
        # The API nests per-bank results under ``banks``; some deployments
        # use ``checks``. Accept either.
        checks_raw = data.get("checks") or data.get("banks") or []
        checks: list[ClientHealthCheck] = []
        if isinstance(checks_raw, Sequence):
            for entry in checks_raw:
                if isinstance(entry, Mapping):
                    checks.append(ClientHealthCheck.from_dict(entry))

        return cls(
            success=_coerce_bool(data.get("success")),
            status=str(data.get("status") or "unknown"),
            version=data.get("version"),
            timestamp=data.get("timestamp"),
            checks=checks,
            raw=dict(data),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "success": self.success,
            "status": self.status,
            "version": self.version,
            "timestamp": self.timestamp,
            "checks": [c.to_dict() for c in self.checks],
        }


__all__ = [
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
