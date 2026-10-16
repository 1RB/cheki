"""cheki REST API client.

This module provides :class:`ChekiClient`, a thin, typed wrapper around
the cheki receipt-verification REST API at
https://cheki.et.

The cheki Python SDK offers two complementary ways to verify Ethiopian
bank/wallet receipts:

1. **API client (recommended).** :class:`ChekiClient` calls the hosted
   cheki server, which handles geo-blocking, QR decryption, PDF parsing,
   and bank-endpoint rotation for you. This is the simplest path and
   matches the behaviour of the TypeScript, Go, PHP and Dart SDKs.

2. **Direct verification (deprecated).** The :func:`cheki.verify`
   function fetches bank endpoints *directly* from your machine. It does
   not have the server's verification gate, host allowlist and parser
   fixes, emits a :class:`DeprecationWarning`, and will be removed in the
   next major version. Self-host the cheki server (Docker) instead if you
   cannot use the hosted API.

``result.is_verified`` is the ONLY success signal: a decoded-only BOA QR
result has ``success=True`` but ``verified=False``.

Retries and timeouts: each attempt waits up to 65 s (the server may take up
to 60 s). The client retries at most once, and only where that is safe (the
same rule in every cheki SDK):

* ``GET`` (banks, health): network errors and 5xx.
* ``POST /api/verify``: network errors, and 429/503 with a Retry-After of at
  most 60 s. Never a 500/502/504: the server already ran the check (and hit
  the bank), and a geo-blocked bank answers 502 every time.
* ``POST /api/verify/batch``: only 429/503 with a short Retry-After. A 504
  means the batch ran out of time; replaying it would hit every bank again
  and charge every receipt against the rate limit. Send long lists in chunks
  of at most :data:`RECOMMENDED_BATCH_CHUNK`.
* Never: timeouts, other 4xx, or an answer with ``retryable: false`` or a
  ``fallbackUrl``.

Example::

    from cheki import ChekiClient

    cheki = ChekiClient()                       # uses the public instance
    result = cheki.verify("cbe", "https://mbreciept.cbe.com.et/fHCxExampleRcpt01")
    # Older CBE receipt with only an FT reference (legacy):
    # cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")
    if result.is_verified:
        print(result.sender_name, result.amount, result.currency)
"""

from __future__ import annotations

import logging
import random
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any, Mapping, Sequence
from urllib.parse import urlencode

import requests

from cheki.client_types import (
    ChekiAPIError,
    ChekiNetworkError,
    ChekiPayloadTooLargeError,
    ChekiRateLimitError,
    ChekiTimeoutError,
    ClientBankInfo,
    ClientBatchResult,
    ClientHealthStatus,
    ClientVerifyResult,
)

__all__ = [
    "ChekiClient",
    "DEFAULT_BASE_URL",
    "MAX_BATCH_SIZE",
    "RECOMMENDED_BATCH_CHUNK",
    "MAX_RETRIES",
    "DEFAULT_TIMEOUT",
]

logger = logging.getLogger("cheki.client")

#: Default cheki API endpoint.
DEFAULT_BASE_URL = "https://cheki.et"

from cheki._version import __version__ as _VERSION

#: Per-attempt timeout in seconds (the server may take up to 60 s).
DEFAULT_TIMEOUT = 65.0

#: Most retries on top of the first attempt.
MAX_RETRIES = 1

#: Most receipts per batch request.
MAX_BATCH_SIZE = 20

#: Recommended chunk size for long lists: a batch is never retried, so smaller
#: chunks lose less work to a 504, and 15 leaves room in the per-IP verify
#: budget (30 per minute) for single checks.
RECOMMENDED_BATCH_CHUNK = 15

_BATCH_PATH = "/api/verify/batch"

#: A Retry-After longer than this (seconds) is not waited out.
_MAX_RETRY_AFTER = 60.0

#: Base delay (seconds) before a retry when the server sends no Retry-After.
_RETRY_BASE_DELAY = 1.0

#: Banks ``/api/receipt`` serves -> account digits their legacy format needs
#: (0 = none). For CBE only an older FT reference needs the account; the
#: current format, a Receipt ID from a mbreciept.cbe.com.et link, needs none.
RECEIPT_DOWNLOAD_BANKS: dict[str, int] = {"cbe": 8, "zemen": 0, "dashen": 0, "zamzam": 0}

#: Stricter reference rules the server applies per bank: a ZamZam receipt id
#: is digits only.
_RECEIPT_REFERENCE_RULES: dict[str, tuple[re.Pattern[str], str]] = {
    "zamzam": (
        re.compile(r"[0-9]+"),
        "A ZamZam receipt id is digits only (the number at the end of the receipt link).",
    ),
}

#: An older CBE FT reference (legacy format, needs the account).
_LEGACY_CBE_REFERENCE = re.compile(r"FT[A-Za-z0-9]{8,12}", re.IGNORECASE)

_SAFE_REFERENCE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}")


class ChekiClient:
    """Typed client for the cheki receipt-verification REST API.

    Args:
        base_url: Root URL of the cheki API. Defaults to the public
            instance at :data:`DEFAULT_BASE_URL`.
        api_key: Optional bearer token sent as ``Authorization``. The
            public cheki API does not require a key, but self-hosted or
            rate-limited deployments may use one.
        timeout: Per-attempt timeout in seconds (default 65).
        max_retries: Retries where a retry is safe (see the module docs).
            Clamped to 0..1 (default 1), so there are at most 2 attempts.
        session: Optional pre-configured :class:`requests.Session` to
            reuse connections. One is created if omitted. The client never
            changes a session you pass: the ``User-Agent`` and
            ``Authorization`` headers go on each request, so the API key is
            never sent to other hosts the session talks to. :meth:`close`
            only closes a session the client created.
        user_agent: Value for the ``User-Agent`` header.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str | None = None,
        timeout: float = DEFAULT_TIMEOUT,
        max_retries: int = MAX_RETRIES,
        session: requests.Session | None = None,
        user_agent: str | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max(0, min(MAX_RETRIES, int(max_retries)))
        self._owns_session = session is None
        self.session = session if session is not None else requests.Session()

        # Per-request headers: a caller's session is never mutated, so the
        # key cannot leak to other hosts it is used for.
        self._headers: dict[str, str] = {
            "Accept": "application/json",
            "User-Agent": user_agent or f"cheki-python-sdk/{_VERSION}",
        }
        if api_key:
            self._headers["Authorization"] = f"Bearer {api_key}"

    # ─── Public API ──────────────────────────────────────────────────

    def verify(
        self,
        bank: str,
        reference: str,
        account_number: str | None = None,
        phone_number: str | None = None,
        qr_data: str | None = None,
    ) -> ClientVerifyResult:
        """Verify a single receipt.

        Args:
            bank: Bank/wallet code, e.g. ``"cbe"``, ``"telebirr"``.
            reference: Transaction reference number (or receipt URL).
            account_number: Account number, for banks that need it. boa:
                the last 5 digits of the account on the receipt (a full BOA
                slip link can carry them). Older cbe FT receipts: the
                receiving account.
            phone_number: Payer phone number. Required for cbebirr.
            qr_data: Raw QR payload: a boa inter-bank receipt QR, or the
                Payment QR Code on a telebirr receipt (the server reads the
                transaction number and checks it like a typed one). A QR
                alone never verifies.

        Returns:
            A :class:`ClientVerifyResult`. ``result.is_verified`` is the
            only success signal. On failure ``result.error`` and
            ``result.http_status`` are set (``result.is_rate_limited`` /
            ``result.retry_after`` for 429).
        """
        payload: dict[str, Any] = {"bank": bank}
        if reference:
            payload["reference"] = reference
        if account_number:
            payload["accountNumber"] = account_number
        if phone_number:
            payload["phoneNumber"] = phone_number
        if qr_data:
            payload["qrData"] = qr_data

        # The verify endpoints encode semantic failures (not found,
        # geo-blocked, unsupported bank) as non-2xx HTTP statuses that
        # still carry a JSON body with {success: false, error, ...}.
        # We parse those into a ClientVerifyResult instead of raising, so
        # callers can inspect result.error / result.fallback_url.
        data, status, retry_after = self._request("POST", "/api/verify", json=payload, raise_on_error=False)
        return ClientVerifyResult.from_dict(data, http_status=status, retry_after=retry_after)

    def verify_batch(
        self,
        receipts: Sequence[Mapping[str, Any]],
    ) -> ClientBatchResult:
        """Verify up to 20 receipts in a single request.

        Each item also counts against the per-IP verify limit (30/min). The
        batch is never replayed on a 5xx or network error (only on 429/503
        with a short Retry-After); split long lists into chunks of at most
        :data:`RECOMMENDED_BATCH_CHUNK`.

        Args:
            receipts: Receipt dicts, each with ``bank`` plus ``reference``
                and/or ``qrData``, and optional ``accountNumber`` /
                ``phoneNumber`` (snake_case keys are accepted too).

        Raises:
            ValueError: For an empty batch, more than 20 receipts, or an
                item without ``bank`` (no request is made).

        Returns:
            A :class:`ClientBatchResult` with per-receipt ``results`` in
            input order and computed ``total`` / ``verified`` / ``failed``
            counts.
        """
        if not receipts:
            raise ValueError("verify_batch requires at least one receipt.")
        if len(receipts) > MAX_BATCH_SIZE:
            raise ValueError(
                f"verify_batch accepts at most {MAX_BATCH_SIZE} receipts (got {len(receipts)}). "
                f"Split the list into chunks of {MAX_BATCH_SIZE}."
            )

        # Normalise optional fields so empty/None values are not sent.
        cleaned: list[dict[str, Any]] = []
        for position, receipt in enumerate(receipts):
            bank = receipt.get("bank") if isinstance(receipt, Mapping) else None
            if not isinstance(bank, str) or not bank.strip():
                raise ValueError(f"verify_batch: receipt {position} has no 'bank'.")
            item: dict[str, Any] = {"bank": bank}
            for src, dst in (
                ("reference", "reference"),
                ("accountNumber", "accountNumber"),
                ("account_number", "accountNumber"),
                ("phoneNumber", "phoneNumber"),
                ("phone_number", "phoneNumber"),
                ("qrData", "qrData"),
                ("qr_data", "qrData"),
            ):
                value = receipt.get(src)
                if value:
                    item[dst] = value
            cleaned.append(item)

        data, status, retry_after = self._request(
            "POST", _BATCH_PATH,
            json={"receipts": cleaned}, raise_on_error=False,
        )
        return ClientBatchResult.from_dict(data, http_status=status, retry_after=retry_after)

    def get_banks(self) -> list[ClientBankInfo]:
        """List the banks/wallets supported by the cheki service."""
        data, _, _ = self._request("GET", "/api/banks")
        banks_raw = data.get("banks")
        if not isinstance(banks_raw, Sequence):
            return []
        return [
            ClientBankInfo.from_dict(b)
            for b in banks_raw
            if isinstance(b, Mapping)
        ]

    def get_health(self) -> ClientHealthStatus:
        """Per-bank reachability (cached up to 5 minutes server-side)."""
        data, _, _ = self._request("GET", "/api/health")
        return ClientHealthStatus.from_dict(data)

    def get_receipt_url(
        self,
        bank: str,
        reference: str,
        account_number: str | None = None,
    ) -> str:
        """URL of ``GET /api/receipt``, which opens the bank's own copy of a receipt.

        Supported: CBE, Dashen, Zemen and ZamZam. Lead with the current
        format: a CBE Receipt ID (from the mbreciept.cbe.com.et link), a Dashen
        FT Ref or a ZamZam receipt id (digits only), which the server answers with a redirect
        to the bank's own receipt page. An older CBE FT reference (legacy) also needs the receiving
        account (at least its last 8 digits) and comes back as the bank's
        PDF. No request is made.

        Raises:
            ValueError: For an unsupported bank, a bad reference, or a legacy
                CBE FT reference without the account.
        """
        bank_id = bank.strip().lower()
        if bank_id not in RECEIPT_DOWNLOAD_BANKS:
            raise ValueError("Receipt download is only supported for: cbe, zemen, dashen, zamzam.")
        ref = reference.strip()
        if not _SAFE_REFERENCE.fullmatch(ref) or ".." in ref:
            raise ValueError("reference must be 1-64 letters, digits, dots, dashes or underscores.")
        rule = _RECEIPT_REFERENCE_RULES.get(bank_id)
        if rule is not None and not rule[0].fullmatch(ref):
            raise ValueError(rule[1])
        params: dict[str, str] = {"bank": bank_id, "reference": ref}
        digits = RECEIPT_DOWNLOAD_BANKS[bank_id]
        if digits and (bank_id != "cbe" or _LEGACY_CBE_REFERENCE.fullmatch(ref)):
            account = re.sub(r"[\s-]", "", account_number or "")
            if not re.fullmatch(r"[0-9]+", account) or len(account) < digits:
                raise ValueError(
                    f"An older {bank_id} FT reference needs the receiving account number "
                    f"(at least the last {digits} digits). A Receipt ID from the receipt link needs none."
                )
            params["account"] = account
        return f"{self.base_url}/api/receipt?{urlencode(params)}"

    # Convenience: use the client as a context manager. ───────────────

    def close(self) -> None:
        """Close the HTTP session if the client created it (a session you passed in stays open)."""
        if self._owns_session:
            self.session.close()

    def __enter__(self) -> "ChekiClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    # ─── Internal HTTP layer ─────────────────────────────────────────

    def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict[str, Any] | None = None,
        raise_on_error: bool = True,
    ) -> tuple[dict[str, Any], int, float | None]:
        """Perform an HTTP request with at most one retry, only where safe.

        See the module docs and :meth:`_should_retry`. Timeouts are never
        retried; a network error is retried except for the batch endpoint.

        Returns:
            ``(decoded_json, http_status, retry_after_seconds)``.

        Raises:
            ChekiTimeoutError: If the attempt times out (not retried).
            ChekiNetworkError: If a network error occurs on every attempt.
            ChekiRateLimitError / ChekiPayloadTooLargeError / ChekiAPIError:
                For an error status when ``raise_on_error`` (or a non-JSON
                error body).
        """
        url = f"{self.base_url}{path}"
        attempt = 0
        while True:
            can_retry = attempt < self.max_retries
            attempt += 1
            try:
                response = self.session.request(method, url, json=json, headers=self._headers, timeout=self.timeout)
            except requests.Timeout as exc:
                # The server may still be working on it (and talking to the bank).
                raise ChekiTimeoutError(f"Request to {url} timed out after {self.timeout}s.") from exc
            except requests.RequestException as exc:
                logger.debug("cheki: network error (attempt %d): %s", attempt, exc)
                # A batch may have reached the server before the connection
                # broke; replaying it would run (and charge) every receipt again.
                if can_retry and path != _BATCH_PATH:
                    self._sleep(None)
                    continue
                raise ChekiNetworkError(f"Network error calling {url}: {exc}") from exc

            status = response.status_code
            retry_after = self._retry_after(response)
            if can_retry and self._should_retry(method, status, retry_after, response):
                logger.debug("cheki: retrying after status %d (Retry-After=%s)", status, retry_after)
                self._sleep(retry_after)
                continue

            data = self._handle_response(response, raise_on_error=raise_on_error, retry_after=retry_after)
            return data, status, retry_after

    def _handle_response(
        self,
        response: requests.Response,
        *,
        raise_on_error: bool = True,
        retry_after: float | None = None,
    ) -> dict[str, Any]:
        """Decode a response body, optionally raising on error status.

        A non-JSON body on an error status always raises. A JSON error body
        raises only when ``raise_on_error`` is ``True``; otherwise it is
        returned so callers can build a typed result.
        """
        text = response.text or ""
        status = response.status_code
        try:
            payload = response.json()
        except ValueError as exc:
            if status >= 400:
                raise self._error(status, text.strip() or f"cheki API returned status {status}", text, retry_after) from exc
            raise ChekiAPIError(f"cheki API returned a non-JSON body (HTTP {status}).", status_code=status, body=text) from exc

        if status >= 400 and raise_on_error:
            raise self._error(status, self._extract_error_message(payload, text), text, retry_after)
        if not isinstance(payload, dict):
            return {"data": payload}
        return payload

    @staticmethod
    def _error(status: int, message: str, body: str, retry_after: float | None) -> ChekiAPIError:
        if status == 429:
            return ChekiRateLimitError(message, status_code=status, body=body, retry_after=retry_after)
        if status == 413:
            return ChekiPayloadTooLargeError(message, status_code=status, body=body)
        return ChekiAPIError(message, status_code=status, body=body)

    @staticmethod
    def _should_retry(method: str, status: int, retry_after: float | None, response: requests.Response) -> bool:
        """The shared retry rule (``retryCases`` in sdks/fixtures/api-contract.json).

        Never when the body says ``retryable: false`` or has a ``fallbackUrl``
        (a geo-blocked bank answers the same way every time). 429 and 503 only
        with a Retry-After of at most 60 s. Any other 5xx only for GET.
        """
        if status != 429 and status < 500:
            return False
        try:
            body = response.json()
        except ValueError:
            body = None
        if isinstance(body, Mapping) and (body.get("retryable") is False or isinstance(body.get("fallbackUrl"), str)):
            return False
        if status in (429, 503):
            return retry_after is not None and retry_after <= _MAX_RETRY_AFTER
        if status >= 500 and method == "GET":
            return retry_after is None or retry_after <= _MAX_RETRY_AFTER
        return False

    @staticmethod
    def _extract_error_message(payload: Any, text: str) -> str:
        """Pull a human-readable message out of an error response body."""
        if isinstance(payload, Mapping) and payload.get("error"):
            return str(payload["error"])
        return text.strip() or "cheki API error"

    @staticmethod
    def _retry_after(response: requests.Response) -> float | None:
        """Parse a ``Retry-After`` header (seconds or HTTP-date) into seconds."""
        value = (response.headers.get("Retry-After") or "").strip()
        if not value:
            return None
        if value.isdigit():
            return float(value)
        try:
            when = parsedate_to_datetime(value)
        except (TypeError, ValueError):
            return None
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
        return max(0.0, (when - datetime.now(timezone.utc)).total_seconds())

    @staticmethod
    def _sleep(retry_after: float | None) -> None:
        """Wait before the retry: Retry-After when sent, otherwise 1-2 s."""
        if retry_after is not None:
            time.sleep(retry_after)
            return
        time.sleep(_RETRY_BASE_DELAY + random.uniform(0, _RETRY_BASE_DELAY))
