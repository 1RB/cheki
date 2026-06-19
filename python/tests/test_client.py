"""Tests for the cheki REST API client (ChekiClient)."""

from __future__ import annotations

import responses

from ethio_receipt_verify import (
    ChekiAPIError,
    ChekiClient,
    ChekiClientError,
    ChekiNetworkError,
    ClientBankInfo,
    ClientBatchResult,
    ClientHealthStatus,
    ClientVerifyResult,
)
from ethio_receipt_verify.client import DEFAULT_BASE_URL

API = DEFAULT_BASE_URL


# ─── verify ──────────────────────────────────────────────────────────


@responses.activate
def test_verify_success_cbe():
    """A successful verify response is parsed into a ClientVerifyResult."""
    responses.add(
        responses.POST,
        f"{API}/api/verify",
        json={
            "success": True,
            "verified": True,
            "bank": "Commercial Bank of Ethiopia",
            "bankCode": "cbe",
            "reference": "FT26140P01YB",
            "sourceUrl": "https://apps.cbe.com.et:100/?id=FT26140P01YB0536171",
            "senderName": "Mr Payer",
            "senderAccount": "1****1234",
            "receiverName": "Ms Receiver",
            "receiverAccount": "1****5678",
            "amount": 20000.0,
            "currency": "ETB",
            "date": "2026-05-20",
            "durationMs": 1200,
        },
        status=200,
    )

    with ChekiClient() as cheki:
        result = cheki.verify("cbe", "FT26140P01YB", account_number="1000560536171")

    assert isinstance(result, ClientVerifyResult)
    assert result.success is True
    assert result.is_verified is True
    assert result.bank_code == "cbe"
    assert result.bank == "Commercial Bank of Ethiopia"
    assert result.amount == 20000.0
    assert result.currency == "ETB"
    assert result.sender_name == "Mr Payer"
    assert result.receiver_account == "1****5678"
    assert result.duration_ms == 1200


@responses.activate
def test_verify_telebirr_wallet_fields():
    """Wallet-specific camelCase fields are mapped to snake_case attrs."""
    responses.add(
        responses.POST,
        f"{API}/api/verify",
        json={
            "success": True,
            "verified": True,
            "bank": "Telebirr",
            "bankCode": "telebirr",
            "reference": "DET8FJGUJ4",
            "sourceUrl": "https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4",
            "senderName": "samuel bayisa urge",
            "invoiceNumber": "INV123",
            "transactionStatus": "completed",
            "settledAmount": 90.0,
            "stampDuty": 1.0,
            "serviceFee": 2.0,
            "serviceFeeVat": 0.3,
            "totalPaid": 93.3,
            "amountInWords": "Ninety Birr",
            "paymentMode": "mobile",
            "paymentChannel": "telebirr",
        },
        status=200,
    )

    with ChekiClient() as cheki:
        result = cheki.verify("telebirr", "DET8FJGUJ4")

    assert result.is_verified is True
    assert result.invoice_number == "INV123"
    assert result.transaction_status == "completed"
    assert result.settled_amount == 90.0
    assert result.service_fee_vat == 0.3
    assert result.total_paid == 93.3
    assert result.amount_in_words == "Ninety Birr"
    assert result.payment_channel == "telebirr"


@responses.activate
def test_verify_failure_not_an_exception():
    """A 'not found' receipt returns success=False, not an exception."""
    responses.add(
        responses.POST,
        f"{API}/api/verify",
        json={"success": False, "error": "Receipt not found or invalid."},
        status=400,
    )
    with ChekiClient() as cheki:
        result = cheki.verify("cbe", "FAKE12345", account_number="1000000000000")

    assert result.success is False
    assert result.is_verified is False
    assert result.error == "Receipt not found or invalid."


@responses.activate
def test_verify_geo_blocked_returns_fallback_url():
    """Geo-blocked banks surface a fallbackUrl in the result."""
    responses.add(
        responses.POST,
        f"{API}/api/verify",
        json={
            "success": False,
            "error": "Telebirr endpoint is geo-blocked.",
            "fallbackUrl": "https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4",
        },
        status=502,
    )
    with ChekiClient(max_retries=0) as cheki:
        result = cheki.verify("telebirr", "DET8FJGUJ4")

    assert result.success is False
    assert result.fallback_url == (
        "https://transactioninfo.ethiotelecom.et/receipt/DET8FJGUJ4"
    )


@responses.activate
def test_verify_sends_correct_payload():
    """Optional fields are only sent when provided."""
    captured = {}

    def callback(request):
        captured["body"] = request.body
        return (200, {}, '{"success": true, "verified": true}')

    responses.add_callback(
        responses.POST, f"{API}/api/verify", callback=callback,
        content_type="application/json",
    )

    with ChekiClient() as cheki:
        cheki.verify("cbe", "FT123", account_number="1000", qr_data="QRDATA")

    import json as _json
    body = _json.loads(captured["body"])
    assert body["bank"] == "cbe"
    assert body["reference"] == "FT123"
    assert body["accountNumber"] == "1000"
    assert body["qrData"] == "QRDATA"
    assert "phoneNumber" not in body


# ─── batch ───────────────────────────────────────────────────────────


@responses.activate
def test_verify_batch_success():
    """Batch results are returned in order with computed summary counts."""
    responses.add(
        responses.POST,
        f"{API}/api/verify/batch",
        json={
            "success": True,
            "results": [
                {
                    "success": True,
                    "verified": True,
                    "bank": "Commercial Bank of Ethiopia",
                    "bankCode": "cbe",
                    "reference": "FT1",
                    "amount": 100.0,
                    "currency": "ETB",
                },
                {
                    "success": False,
                    "error": "Receipt not found.",
                    "status": 400,
                },
            ],
        },
        status=200,
    )

    with ChekiClient() as cheki:
        batch = cheki.verify_batch([
            {"bank": "cbe", "reference": "FT1", "accountNumber": "1000"},
            {"bank": "telebirr", "reference": "FAKE"},
        ])

    assert isinstance(batch, ClientBatchResult)
    assert batch.success is True
    assert batch.total == 2
    assert batch.verified == 1
    assert batch.failed == 1
    assert len(batch.results) == 2
    assert batch.results[0].is_verified is True
    assert batch.results[0].amount == 100.0
    assert batch.results[1].is_verified is False
    assert batch.results[1].error == "Receipt not found."


def test_verify_batch_validation():
    """Empty or oversized batches are rejected before any network call."""
    with ChekiClient() as cheki:
        try:
            cheki.verify_batch([])
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError for empty batch")

        try:
            cheki.verify_batch([{"bank": "cbe", "reference": "x"}] * 51)
        except ValueError:
            pass
        else:
            raise AssertionError("expected ValueError for >50 receipts")


# ─── banks ───────────────────────────────────────────────────────────


@responses.activate
def test_get_banks():
    """GET /api/banks uses `id` as the bank code and returns a list."""
    responses.add(
        responses.GET,
        f"{API}/api/banks",
        json={
            "banks": [
                {
                    "id": "cbe",
                    "name": "Commercial Bank of Ethiopia",
                    "swift": "CBETETAA",
                    "type": "bank",
                    "status": "live",
                    "requiresAccount": True,
                    "accountDigits": 8,
                    "requiresPhone": False,
                    "endpoint": "apps.cbe.com.et:100",
                    "color": "#1a5c3e",
                    "initials": "CBE",
                },
                {
                    "id": "telebirr",
                    "name": "Telebirr",
                    "type": "mobile",
                    "status": "live",
                    "requiresAccount": False,
                    "requiresPhone": False,
                    "endpoint": "transactioninfo.ethiotelecom.et",
                    "color": "#e8a000",
                    "initials": "TB",
                },
            ]
        },
        status=200,
    )

    with ChekiClient() as cheki:
        banks = cheki.get_banks()

    assert len(banks) == 2
    assert all(isinstance(b, ClientBankInfo) for b in banks)
    cbe = banks[0]
    assert cbe.code == "cbe"          # mapped from `id`
    assert cbe.name == "Commercial Bank of Ethiopia"
    assert cbe.requires_account is True
    assert cbe.account_digits == 8
    assert cbe.is_live is True
    assert cbe.to_dict()["code"] == "cbe"


@responses.activate
def test_get_banks_empty():
    responses.add(responses.GET, f"{API}/api/banks", json={"banks": []}, status=200)
    with ChekiClient() as cheki:
        assert cheki.get_banks() == []


# ─── health ──────────────────────────────────────────────────────────


@responses.activate
def test_get_health():
    """Health maps the per-bank `banks` array into `checks`."""
    responses.add(
        responses.GET,
        f"{API}/api/health",
        json={
            "status": "ok",
            "banks": [
                {"id": "cbe", "name": "CBE", "status": "reachable", "latencyMs": 42},
                {"id": "telebirr", "name": "Telebirr", "status": "geo-blocked", "latencyMs": 5000},
            ],
        },
        status=200,
    )

    with ChekiClient() as cheki:
        health = cheki.get_health()

    assert isinstance(health, ClientHealthStatus)
    assert health.status == "ok"
    assert health.is_ok is True
    assert len(health.checks) == 2
    assert health.checks[0].name == "CBE"
    assert health.checks[0].status == "reachable"
    assert health.checks[0].latency_ms == 42
    assert health.checks[1].latency_ms == 5000


# ─── get_receipt_url ────────────────────────────────────────────────


def test_get_receipt_url():
    cheki = ChekiClient()
    url = cheki.get_receipt_url("cbe", "FT123", account_number="1000")
    assert url == f"{API}/api/receipt?bank=cbe&reference=FT123&account=1000"
    url2 = cheki.get_receipt_url("telebirr", "DET8FJGUJ4")
    assert url2 == f"{API}/api/receipt?bank=telebirr&reference=DET8FJGUJ4"


# ─── error handling ─────────────────────────────────────────────────


@responses.activate
def test_api_error_raised_on_500_after_retries():
    """A persistent 500 raises ChekiAPIError after exhausting retries."""
    responses.add(responses.POST, f"{API}/api/verify", json={"error": "boom"}, status=500)
    with ChekiClient(max_retries=0) as cheki:
        try:
            cheki.verify("cbe", "FT1")
        except ChekiAPIError as exc:
            assert exc.status_code == 500
        else:
            raise AssertionError("expected ChekiAPIError")


@responses.activate
def test_api_error_message_from_body():
    """ChekiAPIError surfaces the API's own error message."""
    responses.add(
        responses.POST, f"{API}/api/verify",
        json={"success": False, "error": "Unsupported bank: foo."},
        status=404,
    )
    with ChekiClient(max_retries=0) as cheki:
        try:
            cheki.verify("foo", "FT1")
        except ChekiAPIError as exc:
            assert exc.status_code == 404
            assert "Unsupported bank" in str(exc)
        else:
            raise AssertionError("expected ChekiAPIError")


@responses.activate
def test_network_error_raised():
    """A connection error raises ChekiNetworkError."""
    from requests.exceptions import ConnectionError as ReqConnError

    responses.add(
        responses.POST, f"{API}/api/verify", body=ReqConnError("DNS failed"),
    )
    with ChekiClient(max_retries=0) as cheki:
        try:
            cheki.verify("cbe", "FT1")
        except ChekiNetworkError:
            pass
        else:
            raise AssertionError("expected ChekiNetworkError")


@responses.activate
def test_timeout_error_is_network_subclass():
    """A timeout raises ChekiTimeoutError, which is a ChekiNetworkError."""
    from requests.exceptions import ConnectTimeout as ReqTimeout

    responses.add(
        responses.POST, f"{API}/api/verify", body=ReqTimeout("timed out"),
    )
    with ChekiClient(max_retries=0, timeout=1) as cheki:
        try:
            cheki.verify("cbe", "FT1")
        except ChekiNetworkError as exc:
            assert isinstance(exc, ChekiClientError)
        else:
            raise AssertionError("expected a network error")


# ─── retry behaviour ────────────────────────────────────────────────


@responses.activate
def test_retry_on_429_then_success():
    """A 429 is retried and the eventual 200 is returned."""
    responses.add(responses.POST, f"{API}/api/verify", json={"error": "rate"}, status=429)
    responses.add(
        responses.POST, f"{API}/api/verify",
        json={"success": True, "verified": True, "bank": "CBE", "reference": "FT1"},
        status=200,
    )
    with ChekiClient(max_retries=2) as cheki:
        result = cheki.verify("cbe", "FT1")
    assert result.is_verified is True
    assert len(responses.calls) == 2  # initial 429 + retry 200


@responses.activate
def test_retry_respects_retry_after():
    """A Retry-After header is honored (no assertion on sleep duration)."""
    responses.add(
        responses.POST, f"{API}/api/verify",
        json={"error": "rate"}, status=429,
        headers={"Retry-After": "0"},
    )
    responses.add(
        responses.POST, f"{API}/api/verify",
        json={"success": True, "verified": True}, status=200,
    )
    with ChekiClient(max_retries=1) as cheki:
        result = cheki.verify("cbe", "FT1")
    assert result.is_verified is True


# ─── from_dict robustness ──────────────────────────────────────────


def test_verify_result_from_dict_ignores_unknown_keys():
    result = ClientVerifyResult.from_dict({
        "success": True,
        "verified": True,
        "bank": "CBE",
        "totallyUnknownField": "ignored",
        "amount": "1,234.50",  # string amount coerced to float
    })
    assert result.success is True
    assert result.amount == 1234.5
    assert result.raw["totallyUnknownField"] == "ignored"


def test_batch_result_derives_counts():
    batch = ClientBatchResult.from_dict({
        "success": True,
        "results": [
            {"success": True, "verified": True},
            {"success": True, "verified": False},
            {"success": False, "error": "x"},
        ],
    })
    assert batch.total == 3
    assert batch.verified == 1
    assert batch.failed == 2


def test_health_tolerates_optional_fields():
    health = ClientHealthStatus.from_dict({
        "success": True,
        "status": "ok",
        "version": "1.2.3",
        "timestamp": "2026-01-01T00:00:00Z",
        "checks": [{"name": "db", "status": "ok", "latencyMs": 5}],
    })
    assert health.version == "1.2.3"
    assert health.timestamp == "2026-01-01T00:00:00Z"
    assert health.checks[0].name == "db"
