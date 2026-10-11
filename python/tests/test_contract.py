"""Python SDK against the shared contract fixtures (sdks/fixtures/api-contract.json).

tests/contract/sdk-fixtures.test.ts checks the same fixtures against the real
route handlers, so a model that decodes them here matches the live API.
"""

from __future__ import annotations

import json
import warnings
from pathlib import Path

import pytest
import requests
import responses

from cheki import (
    ChekiAPIError,
    ChekiClient,
    ChekiNetworkError,
    ChekiPayloadTooLargeError,
    ChekiRateLimitError,
    ChekiTimeoutError,
    ClientVerifyResult,
    MAX_BATCH_SIZE,
    VerificationResult,
    VerificationStatus,
)
from cheki import client as client_module
from cheki.registry import gate, verify

CONTRACT = json.loads((Path(__file__).resolve().parents[2] / "sdks" / "fixtures" / "api-contract.json").read_text())
API = "https://api.test"


def fx(name: str) -> dict:
    return CONTRACT["cases"][name]


def add(name: str, *, extra_headers: dict | None = None, method: str | None = None, path: str | None = None) -> None:
    c = fx(name)
    headers = {k.lower(): v for k, v in {**c["headers"], **(extra_headers or {})}.items()}
    headers.update({k.lower(): v for k, v in (extra_headers or {}).items()})
    responses.add(
        getattr(responses, method or c["method"]),
        f"{API}{path or c['path']}",
        json=c["body"],
        status=c["status"],
        headers=headers,
    )


@pytest.fixture(autouse=True)
def no_sleep(monkeypatch):
    monkeypatch.setattr(client_module.time, "sleep", lambda _s: None)


def client(**kw) -> ChekiClient:
    return ChekiClient(base_url=API, **kw)


def test_defaults_match_contract():
    limits = CONTRACT["limits"]
    assert client_module.DEFAULT_TIMEOUT == limits["sdkTimeoutSeconds"]
    assert client_module.DEFAULT_TIMEOUT > limits["serverMaxDurationSeconds"]
    assert MAX_BATCH_SIZE == limits["batchMaxReceipts"]
    assert client(max_retries=5).max_retries == 1
    assert client(max_retries=-1).max_retries == 0


@responses.activate
def test_verified():
    add("verify_verified")
    r = client().verify("cbe", "FT26140P01YB", account_number="1000560536171")
    assert r.is_verified and r.amount == 1250.5 and r.cached is False and r.http_status == 200


@responses.activate
def test_decoded_only_is_not_verified_and_qr_only_sends_no_reference():
    add("verify_decoded_only")
    r = client().verify("boa", "", qr_data="qr")
    assert r.success is True and r.decoded_only is True and r.is_verified is False
    assert json.loads(responses.calls[0].request.body) == {"bank": "boa", "qrData": "qr"}


def test_parsed_is_never_verified():
    r = ClientVerifyResult.from_dict(fx("parse_client_supplied")["body"])
    assert r.parsed is True and r.source == "client-supplied" and r.is_verified is False


@responses.activate
def test_batch():
    add("batch_mixed")
    b = client().verify_batch([
        {"bank": "cbe", "reference": "A1", "accountNumber": "1000560536171"},
        {"bank": "boa", "qr_data": "q"},
        {"bank": "telebirr", "reference": "B2"},
    ])
    assert (b.total, b.verified, b.failed, b.cached) == (3, 1, 2, 0)
    assert [r.index for r in b.results] == [0, 1, 2]
    assert b.results[1].decoded_only is True
    assert b.results[2].success is False and b.results[2].http_status == 422
    sent = json.loads(responses.calls[0].request.body)["receipts"]
    assert sent[1] == {"bank": "boa", "qrData": "q"}


def test_batch_over_20_rejected_without_request():
    with pytest.raises(ValueError, match="20"):
        client().verify_batch([{"bank": "telebirr", "reference": f"R{i}"} for i in range(21)])


@responses.activate
def test_banks():
    add("banks")
    banks = client().get_banks()
    assert banks[0].id == "cbe" and banks[0].code == "cbe" and banks[0].requires_phone is False
    assert banks[1].type == "mobile" and banks[2].requires_phone is True
    assert banks[3].is_live is False


@responses.activate
def test_health():
    add("health")
    h = client().get_health()
    assert h.is_ok and h.checked_at and h.cached is False
    assert h.banks[1].id == "telebirr" and h.banks[1].status == "geo-blocked"


@pytest.mark.parametrize("name", ["error_400_missing_input", "error_404_unsupported_bank", "error_422_not_found", "error_413_body_too_large"])
@responses.activate
def test_client_errors_returned_not_retried(name):
    add(name)
    r = client().verify("cbe", "X1")
    assert r.is_verified is False
    assert r.http_status == fx(name)["status"]
    assert r.error == fx(name)["body"]["error"]
    assert len(responses.calls) == 1


@responses.activate
def test_payload_too_large_flag():
    add("error_413_body_too_large")
    assert client().verify("cbe", "X1").is_payload_too_large


@responses.activate
def test_429_retried_once_then_reported():
    add("error_429_rate_limited", extra_headers={"Retry-After": "0"})
    r = client().verify("cbe", "X1")
    assert r.is_rate_limited and r.retry_after == 0
    assert len(responses.calls) == 2


@responses.activate
def test_429_then_success():
    add("error_429_rate_limited", extra_headers={"Retry-After": "0"})
    add("verify_verified")
    assert client().verify("cbe", "X1").is_verified
    assert len(responses.calls) == 2


@responses.activate
def test_long_retry_after_not_waited():
    add("error_429_rate_limited", extra_headers={"Retry-After": "120"})
    r = client().verify("cbe", "X1")
    assert r.is_rate_limited and r.retry_after == 120
    assert len(responses.calls) == 1


@responses.activate
def test_get_banks_raises_typed_rate_limit():
    add("error_429_rate_limited", method="GET", path="/api/banks", extra_headers={"Retry-After": "120"})
    with pytest.raises(ChekiRateLimitError) as exc:
        client().get_banks()
    assert exc.value.retry_after == 120


@responses.activate
def test_get_banks_raises_payload_too_large():
    add("error_413_body_too_large", method="GET", path="/api/banks")
    with pytest.raises(ChekiPayloadTooLargeError):
        client().get_banks()


@responses.activate
def test_502_retried_once_with_fallback():
    add("error_502_geo_blocked")
    r = client().verify("telebirr", "CHQ0FJ403O")
    assert r.fallback_url.startswith("https://transactioninfo")
    assert len(responses.calls) == 2


@responses.activate
def test_500_on_get_raises_after_one_retry():
    add("error_500_internal", method="GET", path="/api/health")
    with pytest.raises(ChekiAPIError):
        client().get_health()
    assert len(responses.calls) == 2


@responses.activate
def test_network_error_retried_once():
    responses.add(responses.GET, f"{API}/api/banks", body=requests.ConnectionError("refused"))
    with pytest.raises(ChekiNetworkError):
        client().get_banks()
    assert len(responses.calls) == 2


@responses.activate
def test_timeout_not_retried():
    responses.add(responses.GET, f"{API}/api/banks", body=requests.Timeout("slow"))
    with pytest.raises(ChekiTimeoutError):
        client().get_banks()
    assert len(responses.calls) == 1


# ─── Deprecated direct mode ─────────────────────────────────────────


def test_direct_verify_warns_and_rejects_unsafe_references():
    with pytest.warns(DeprecationWarning):
        with pytest.raises(ValueError):
            verify("telebirr", "../../admin")
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        for bad in ["A/B", "A?x=1", "A#", "A B", "", "x" * 65]:
            with pytest.raises(ValueError):
                verify("telebirr", bad)


def _verified(**kw) -> VerificationResult:
    base = dict(bank="mpesa", reference="R1", status=VerificationStatus.VERIFIED, exists=True,
                amount=100.0, sender_name="A")
    base.update(kw)
    return VerificationResult(**base)


@pytest.mark.parametrize("kw", [
    {"amount": None}, {"amount": 0}, {"amount": float("nan")},
    {"sender_name": None},
    {"raw": {"transaction_status": "Pending"}}, {"raw": {"status": "Reversed"}},
])
def test_gate_fails_closed(kw):
    r = gate(_verified(**kw))
    assert r.status is VerificationStatus.FAILED and r.exists is False and r.message


def test_gate_keeps_a_complete_receipt():
    r = gate(_verified(raw={"transaction_status": "Completed"}))
    assert r.status is VerificationStatus.VERIFIED
