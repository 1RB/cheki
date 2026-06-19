"""cheki REST API client.

This module provides :class:`ChekiClient`, a thin, typed wrapper around
the cheki receipt-verification REST API at
https://cheki-pi.vercel.app.

The cheki Python SDK offers two complementary ways to verify Ethiopian
bank/wallet receipts:

1. **API client (recommended).** :class:`ChekiClient` calls the hosted
   cheki server, which handles geo-blocking, QR decryption, PDF parsing,
   and bank-endpoint rotation for you. This is the simplest path and
   matches the behaviour of the TypeScript, Go, PHP and Dart SDKs.

2. **Direct verification (advanced).** The :func:`cheki.verify`
   function fetches bank endpoints *directly* from your machine. This
   avoids the hosted API but requires network access to each bank and
   will fail for geo-blocked banks (e.g. telebirr, M-Pesa) outside
   Ethiopia.

Example::

    from cheki import ChekiClient

    cheki = ChekiClient()                       # uses the public instance
    result = cheki.verify("cbe", "FT26140P01YB",
                          account_number="1000560536171")
    if result.is_verified:
        print(result.sender_name, result.amount, result.currency)
"""

from __future__ import annotations

import logging
import random
import time
from typing import Any, Mapping, Sequence
from urllib.parse import urlencode

import requests

from cheki.client_types import (
    ChekiAPIError,
    ChekiNetworkError,
    ChekiTimeoutError,
    ClientBankInfo,
    ClientBatchResult,
    ClientHealthStatus,
    ClientVerifyResult,
)

__all__ = ["ChekiClient", "DEFAULT_BASE_URL"]

logger = logging.getLogger("cheki.client")

#: Default cheki API endpoint.
DEFAULT_BASE_URL = "https://cheki-pi.vercel.app"

#: HTTP statuses that trigger an automatic retry.
_RETRYABLE_STATUS = {408, 429, 500, 502, 503, 504}

#: Default per-request timeout in seconds.
_DEFAULT_TIMEOUT = 30

#: Default number of retries on top of the initial request.
_DEFAULT_MAX_RETRIES = 3

#: Base delay (seconds) for exponential backoff.
_DEFAULT_BACKOFF_BASE = 0.5

#: Maximum backoff cap (seconds) between retries.
_DEFAULT_BACKOFF_MAX = 20.0


class ChekiClient:
    """Typed client for the cheki receipt-verification REST API.

    Args:
        base_url: Root URL of the cheki API. Defaults to the public
            instance at :data:`DEFAULT_BASE_URL`.
        api_key: Optional bearer token sent as ``Authorization``. The
            public cheki API does not require a key, but self-hosted or
            rate-limited deployments may use one.
        timeout: Per-request timeout in seconds.
        max_retries: Maximum number of retries on retryable failures
            (HTTP 408/429/5xx). The initial attempt is not counted as a
            retry, so ``max_retries=3`` yields up to 4 total attempts.
        session: Optional pre-configured :class:`requests.Session` to
            reuse connections. One is created if omitted.
        user_agent: Value for the ``User-Agent`` header.
    """

    def __init__(
        self,
        base_url: str = DEFAULT_BASE_URL,
        api_key: str | None = None,
        timeout: float = _DEFAULT_TIMEOUT,
        max_retries: int = _DEFAULT_MAX_RETRIES,
        session: requests.Session | None = None,
        user_agent: str | None = None,
    ) -> None:
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.timeout = timeout
        self.max_retries = max(0, int(max_retries))
        self.session = session or requests.Session()

        ua = user_agent or "ethio-receipt-verify/0.1.0 (cheki-python-client)"
        self.session.headers.update({
            "Accept": "application/json",
            "User-Agent": ua,
        })
        if api_key:
            self.session.headers["Authorization"] = f"Bearer {api_key}"

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
            account_number: Receiving account number. Required for banks
                that need it (e.g. cbe, boa).
            phone_number: Payer phone number. Required for cbebirr.
            qr_data: Raw QR payload. Currently supported for boa
                inter-bank transfers.

        Returns:
            A :class:`ClientVerifyResult`. Check ``result.is_verified``
            to determine success; on failure ``result.error`` is set.
        """
        payload: dict[str, Any] = {"bank": bank, "reference": reference}
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
        data = self._request("POST", "/api/verify", json=payload, raise_on_error=False)
        return ClientVerifyResult.from_dict(data)

    def verify_batch(
        self,
        receipts: Sequence[Mapping[str, Any]],
    ) -> ClientBatchResult:
        """Verify up to 50 receipts in a single request.

        Args:
            receipts: Iterable of receipt dicts, each with ``bank`` and
                ``reference`` plus optional ``accountNumber`` /
                ``phoneNumber`` / ``qrData``.

        Returns:
            A :class:`ClientBatchResult` with per-receipt ``results`` in
            input order and computed ``total`` / ``verified`` / ``failed``
            counts.
        """
        if not receipts:
            raise ValueError("verify_batch requires at least one receipt.")
        if len(receipts) > 50:
            raise ValueError("verify_batch accepts a maximum of 50 receipts.")

        # Normalise optional fields so empty/None values are not sent.
        cleaned: list[dict[str, Any]] = []
        for receipt in receipts:
            item: dict[str, Any] = {
                "bank": receipt["bank"],
                "reference": receipt["reference"],
            }
            for src, dst in (
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

        data = self._request(
            "POST", "/api/verify/batch",
            json={"receipts": cleaned}, raise_on_error=False,
        )
        return ClientBatchResult.from_dict(data)

    def get_banks(self) -> list[ClientBankInfo]:
        """List the banks/wallets supported by the cheki service."""
        data = self._request("GET", "/api/banks")
        banks_raw = data.get("banks")
        if not isinstance(banks_raw, Sequence):
            return []
        return [
            ClientBankInfo.from_dict(b)
            for b in banks_raw
            if isinstance(b, Mapping)
        ]

    def get_health(self) -> ClientHealthStatus:
        """Check the health of the cheki service."""
        data = self._request("GET", "/api/health")
        return ClientHealthStatus.from_dict(data)

    def get_receipt_url(
        self,
        bank: str,
        reference: str,
        account_number: str | None = None,
    ) -> str:
        """Build a direct receipt URL for the cheki web app.

        This does not make a network request. The returned URL points at
        the cheki receipt viewer, which renders the bank receipt in a
        browser.
        """
        params: dict[str, str] = {"bank": bank, "reference": reference}
        if account_number:
            params["account"] = account_number
        return f"{self.base_url}/api/receipt?{urlencode(params)}"

    # Convenience: use the client as a context manager. ───────────────

    def close(self) -> None:
        """Close the underlying HTTP session."""
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
    ) -> dict[str, Any]:
        """Perform an HTTP request with retries and return decoded JSON.

        Args:
            method: HTTP method (``"GET"`` / ``"POST"``).
            path: API path beginning with ``/``.
            json: Optional JSON body for POST requests.
            raise_on_error: When ``True`` (default), non-2xx responses
                raise :class:`ChekiAPIError`. When ``False``, a JSON error
                body is returned to the caller (used by the verify
                endpoints, which encode semantic failures in the body).

        Raises:
            ChekiTimeoutError: If every attempt times out.
            ChekiNetworkError: If a network error occurs on every attempt.
            ChekiAPIError: If the API returns a non-retryable error status
                (when ``raise_on_error``) or an unparseable body.
        """
        url = f"{self.base_url}{path}"
        last_exception: Exception | None = None

        for attempt in range(self.max_retries + 1):
            try:
                response = self.session.request(
                    method,
                    url,
                    json=json,
                    timeout=self.timeout,
                )
            except requests.Timeout as exc:
                last_exception = ChekiTimeoutError(
                    f"Request to {url} timed out after {self.timeout}s."
                )
                logger.debug("cheki: timeout (attempt %d/%d): %s",
                             attempt + 1, self.max_retries + 1, exc)
                if attempt < self.max_retries:
                    self._sleep_backoff(attempt)
                    continue
                raise last_exception from exc
            except requests.ConnectionError as exc:
                last_exception = ChekiNetworkError(
                    f"Network error connecting to {url}: {exc}"
                )
                logger.debug("cheki: connection error (attempt %d/%d): %s",
                             attempt + 1, self.max_retries + 1, exc)
                if attempt < self.max_retries:
                    self._sleep_backoff(attempt)
                    continue
                raise last_exception from exc
            except requests.RequestException as exc:
                last_exception = ChekiNetworkError(
                    f"Request to {url} failed: {exc}"
                )
                if attempt < self.max_retries:
                    self._sleep_backoff(attempt)
                    continue
                raise last_exception from exc

            # Retryable status: back off and try again.
            if response.status_code in _RETRYABLE_STATUS and attempt < self.max_retries:
                retry_after = self._retry_after(response)
                logger.debug(
                    "cheki: retryable status %d (attempt %d/%d)%s",
                    response.status_code, attempt + 1, self.max_retries + 1,
                    f"; honoring Retry-After={retry_after}s" if retry_after else "",
                )
                self._sleep_backoff(attempt, override=retry_after)
                continue

            # Non-retryable status or final attempt: decode and return/raise.
            return self._handle_response(
                response, url, raise_on_error=raise_on_error
            )

        # Exhausted retries on a retryable status without a successful decode.
        if last_exception is not None:
            raise last_exception
        raise ChekiAPIError("cheki: request failed after exhausting retries.")

    def _handle_response(
        self,
        response: requests.Response,
        url: str,
        *,
        raise_on_error: bool = True,
    ) -> dict[str, Any]:
        """Decode a response body, optionally raising on error status.

        A non-JSON body on an error status always raises
        :class:`ChekiAPIError` (there is nothing to parse). A JSON error
        body raises only when ``raise_on_error`` is ``True``; otherwise it
        is returned so callers can build a typed result.
        """
        text = response.text or ""

        try:
            payload = response.json()
        except ValueError as exc:
            if response.status_code >= 400:
                message = (
                    text.strip()
                    or f"cheki API returned status {response.status_code}"
                )
                raise ChekiAPIError(
                    message, status_code=response.status_code, body=text
                ) from exc
            # 2xx with non-JSON body: wrap the raw text for callers.
            return {"data": text}

        if response.status_code >= 400:
            if raise_on_error:
                message = self._extract_error_message(payload, text)
                raise ChekiAPIError(
                    message, status_code=response.status_code, body=text
                )
            # Caller wants the body even on error (verify endpoints).
            if not isinstance(payload, dict):
                return {"data": payload}
            return payload

        if not isinstance(payload, dict):
            return {"data": payload}
        return payload

    @staticmethod
    def _extract_error_message(payload: Any, text: str) -> str:
        """Pull a human-readable message out of an error response body."""
        if isinstance(payload, Mapping) and payload.get("error"):
            return str(payload["error"])
        return text.strip() or "cheki API error"

    @staticmethod
    def _retry_after(response: requests.Response) -> float | None:
        """Parse a ``Retry-After`` header into seconds, if present."""
        value = response.headers.get("Retry-After")
        if not value:
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def _sleep_backoff(self, attempt: int, override: float | None = None) -> None:
        """Sleep for an exponentially increasing delay before the next retry.

        Uses full jitter: a random fraction of the exponentially growing
        cap, bounded by :data:`_DEFAULT_BACKOFF_MAX`. When ``override`` is
        provided (e.g. from a ``Retry-After`` header) it is used directly.
        """
        if override is not None:
            time.sleep(min(override, _DEFAULT_BACKOFF_MAX))
            return
        cap = min(
            _DEFAULT_BACKOFF_BASE * (2 ** attempt),
            _DEFAULT_BACKOFF_MAX,
        )
        delay = random.uniform(0, cap)
        time.sleep(delay)
