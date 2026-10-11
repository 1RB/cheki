import base64
import json
from datetime import datetime
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

import pytest
import responses

from cheki import supported_banks, verify
from cheki.banks.cbe import CBEVerifier
from cheki.banks.mpesa import MAX_BASE64_CHARS, decode_envelope, parse_lines
from cheki.errors import ReceiptNotFoundError, UpstreamError

# Direct verification is deprecated; these tests cover it until it is removed.
pytestmark = pytest.mark.filterwarnings("ignore::DeprecationWarning")

SAMPLE_CBE_PDF_TEXT = """
Commercial Bank of Ethiopia
VAT Receipt No: FT12345P01YB
Payer Mr Fake Sender Person
Account 1****1234
Receiver FAKE RECEIVER NAME
Account 1****5678
Payment Date & Time 5/20/2026, 7:29:00 PM
Transferred Amount 20,000.00 ETB
"""


def _make_fake_pdf_bytes(text: str) -> bytes:
    """Return a minimal PDF document whose text can be read by pdfplumber."""
    from reportlab.pdfgen import canvas

    buf = BytesIO()
    c = canvas.Canvas(buf)
    y = 720
    for line in text.splitlines():
        c.drawString(72, y, line)
        y -= 14
    c.save()
    return buf.getvalue()


@responses.activate
def test_cbe_verify_success():
    account = "1000000006171"
    reference = "FT12345P01YB"
    url = f"https://apps.cbe.com.et:100/?id={reference}00006171"

    pdf_bytes = _make_fake_pdf_bytes(SAMPLE_CBE_PDF_TEXT)
    responses.add(
        responses.GET, url, body=pdf_bytes, status=200, content_type="application/pdf"
    )

    result = verify("cbe", reference, account_number=account)
    assert result.status.value == "verified"
    assert result.exists is True
    assert result.amount == 20000.0
    assert result.sender_name == "Mr Fake Sender Person"
    assert result.receiver_name == "FAKE RECEIVER NAME"
    assert result.sender_account == "1****1234"
    assert result.receiver_account == "1****5678"
    assert result.transaction_date == datetime(2026, 5, 20, 19, 29, 0)


@responses.activate
def test_cbe_verify_not_pdf():
    reference = "FT0000000000"
    account = "1000000000000"
    suffix = account[-8:]
    url = f"https://apps.cbe.com.et:100/?id={reference}{suffix}"
    responses.add(
        responses.GET,
        url,
        body="not a pdf",
        status=200,
    )
    with patch.object(CBEVerifier, "_extract_pdf_text", return_value=""):
        try:
            verify("cbe", reference, account_number=account)
        except ReceiptNotFoundError:
            pass


@responses.activate
def test_telebirr_verify_success():
    html = """
    <html>
    <body>
    <div>telebirr receipt</div>
    <div>የከፋይ ስም/Payer Name</div>
    <div>samuel bayisa urge</div>
    <div>የገንዘብ ተቀባይ ስም/Credited Party name</div>
    <div>Yabsera Tibebu Chefek</div>
    <div>የከፋይ ቴሌብር ቁ./Payer telebirr no.</div>
    <div>2519****6584</div>
    <div>የገንዘብ ተቀባይ ቴሌብር ቁ./Credited party account no</div>
    <div>2519****6680</div>
    <div>የተከፈለው መጠን/Settled Amount</div>
    <div>90 Birr</div>
    <div>የክፍያ ቀን/Payment date</div>
    <div>29-05-2026 09:04:16</div>
    </body>
    </html>
    """
    responses.add(
        responses.GET,
        "https://transactioninfo.ethiotelecom.et/receipt/DET12345",
        body=html,
        status=200,
        content_type="text/html",
    )
    result = verify("telebirr", "DET12345")
    assert result.status.value == "verified"
    assert result.amount == 90.0
    assert result.sender_name == "samuel bayisa urge"
    assert result.receiver_name == "Yabsera Tibebu Chefek"
    assert result.transaction_date == datetime(2026, 5, 29, 9, 4, 16)


@responses.activate
def test_telebirr_verify_not_found():
    responses.add(
        responses.GET,
        "https://transactioninfo.ethiotelecom.et/receipt/FAKE123",
        body="This request is not correct",
        status=200,
        content_type="text/html",
    )
    try:
        verify("telebirr", "FAKE123")
    except ReceiptNotFoundError:
        pass


@responses.activate
def test_boa_verify_success():
    account = "100000006171"
    reference = "AB123456789"
    trx_id = f"{reference}{account[-5:]}"
    url = f"https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={trx_id}"
    payload = {
        "header": {"status": "success"},
        "body": [
            {
                "Source Account Name": "Mr Payer",
                "Source Account": "1****1234",
                "Receiver's Name": "Ms Receiver",
                "Receiver's Account": "1****5678",
                "Transferred Amount": "5,000.00",
                "Transaction Date": "20-May-2026",
                "currency": "ETB",
            }
        ],
    }
    responses.add(responses.GET, url, json=payload, status=200)
    result = verify("boa", reference, account_number=account)
    assert result.status.value == "verified"
    assert result.amount == 5000.0
    assert result.sender_name == "Mr Payer"
    assert result.receiver_name == "Ms Receiver"


@responses.activate
def test_boa_verify_not_found():
    account = "10000000000"
    reference = "FAKE123"
    trx_id = f"{reference}{account[-5:]}"
    url = f"https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id={trx_id}"
    responses.add(
        responses.GET,
        url,
        json={"body": [{"Payer's Name": "Invalid reference number"}]},
        status=200,
    )
    try:
        verify("boa", reference, account_number=account)
    except ReceiptNotFoundError:
        pass


# SYNTHETIC M-Pesa receipt (not a real one), built by tests/fixtures/mpesa/synthetic-receipt.ts.
# The envelope shape and PDF labels are inferred from other verifiers; see cheki/banks/mpesa.py.
MPESA_PDF = (Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "mpesa" / "synthetic-receipt.pdf").read_bytes()
MPESA_URL = "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt"


def _mpesa_envelope(pdf: bytes = MPESA_PDF, **overrides: object) -> dict:
    body: dict = {"responseCode": "0", "responseDescription": "Success", "base64Data": base64.b64encode(pdf).decode()}
    body.update(overrides)
    return body


@responses.activate
def test_mpesa_verify_success():
    responses.add(responses.GET, MPESA_URL, json=_mpesa_envelope(), status=200)
    result = verify("mpesa", "UCK0SYNTH1")
    assert result.status.value == "verified"
    assert result.amount == 1500.0
    assert result.sender_name == "SYNTHETIC TEST PAYER"
    assert result.receiver_account == "251700000002"
    assert result.transaction_date == datetime(2026, 9, 14, 10, 21, 33)
    sent = responses.calls[0].request
    assert "trxNo=UCK0SYNTH1" in sent.url
    assert sent.headers["Referer"] == "https://m-pesabusiness.safaricom.et/"


@responses.activate
def test_mpesa_mismatched_reference_fails_the_gate():
    responses.add(responses.GET, MPESA_URL, json=_mpesa_envelope(), status=200)
    result = verify("mpesa", "UCK0OTHER9")
    assert result.status.value == "failed"
    assert "different reference" in (result.message or "")


@responses.activate
def test_mpesa_verify_not_found():
    responses.add(
        responses.GET,
        MPESA_URL,
        json={"responseCode": "1", "responseDescription": "Transaction not found"},
        status=200,
    )
    with pytest.raises(ReceiptNotFoundError):
        verify("mpesa", "FAKE123")


@responses.activate
def test_mpesa_flat_json_is_not_a_receipt():
    """The old flat-JSON shape was never observed anywhere; it must not verify."""
    responses.add(
        responses.GET,
        MPESA_URL,
        json={"responseCode": "0", "senderName": "Alice", "receiverName": "Bob", "amount": 150},
        status=200,
    )
    with pytest.raises(UpstreamError):
        verify("mpesa", "MP12345")


@pytest.mark.parametrize(
    "envelope",
    [
        {"responseCode": "0", "base64Data": "not base64!!"},
        {"responseCode": "0", "base64Data": "QUJD"},  # valid base64, not a PDF
        {"responseCode": "0", "base64Data": "A" * (MAX_BASE64_CHARS + 4)},
    ],
)
def test_mpesa_rejects_bad_envelopes(envelope):
    with pytest.raises(UpstreamError):
        decode_envelope(json.dumps(envelope))


def test_mpesa_parse_lines_handles_amharic_and_older_labels():
    fields = parse_lines([
        "የክፍያ መረጃ / RECEIPT NO PAYMENT DATE SETTLED AMOUNT",
        "UCK0SYNTH1 2026-09-14 10:21:33 250.00",
        "የከፋይ ስም / PAYER NAME SYNTHETIC PAYER",
        "PAYER PHONE NUMBER 251700000003",
        "TRANSACTION ID UCK0SYNTH1",
        "TOTAL 250.00 Birr",
    ])
    assert fields["sender_name"] == "SYNTHETIC PAYER"
    assert fields["sender_account"] == "251700000003"
    assert fields["amount"] == 250.0


def test_mpesa_parse_lines_is_linear_on_hostile_text():
    import time

    start = time.monotonic()
    for hostile in ("TOTAL " * 16_667, "1" * 100_000, "PAYER NAME " + "A " * 50_000, " " * 99_999 + "x"):
        parse_lines([hostile])
    assert time.monotonic() - start < 2


@responses.activate
def test_cbe_receipt_id_is_the_current_format():
    """A Receipt ID goes to the JSON API (no account); the receipt's FT id is not compared to it."""
    token = "fHCxyV4mg5pRIwEkJO"
    responses.add(
        responses.GET,
        f"https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{token}",
        json={
            "id": "FT26140P01YB",
            "debitAccountHolder": "Test Payer",
            "creditAccountHolder": "Test Receiver",
            "debitAccountNo": "1****1685",
            "creditAccountNo": "1****6171",
            "amountCredited": "20,000.00",
            "creditCurrency": "ETB",
            "dateTimes": ["2026-05-20T19:29:00"],
        },
        status=200,
    )
    result = verify("cbe", token)
    assert result.status.value == "verified"
    assert result.amount == 20000.0
    assert result.receiver_name == "Test Receiver"
    assert result.transaction_date == datetime(2026, 5, 20, 19, 29, 0)
    assert result.source_url == f"https://mbreciept.cbe.com.et/{token}"
    sent = responses.calls[0].request.headers
    assert sent["X-App-ID"] and sent["X-App-Version"]


@responses.activate
def test_cbe_receipt_id_unknown_token_is_not_found():
    token = "chekiprobe000"
    responses.add(
        responses.GET,
        f"https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/{token}",
        json={"detail": "Security Alert: Invalid or tampered legacy token!"},
        status=500,
    )
    with pytest.raises(ReceiptNotFoundError):
        verify("cbe", token)


def test_cbe_ft_reference_without_account_points_at_the_receipt_id():
    with pytest.raises(ValueError, match="Receipt ID"):
        verify("cbe", "FT26140P01YB")


@responses.activate
def test_cbe_legacy_pdf_for_another_reference_fails_the_gate():
    reference = "FT99999P01YB"
    responses.add(
        responses.GET,
        f"https://apps.cbe.com.et:100/?id={reference}00006171",
        body=_make_fake_pdf_bytes(SAMPLE_CBE_PDF_TEXT),  # prints FT12345P01YB
        status=200,
        content_type="application/pdf",
    )
    result = verify("cbe", reference, account_number="1000000006171")
    assert result.status.value == "failed"
    assert "different reference" in (result.message or "")


DASHEN_HTML = """<!DOCTYPE html><html><head><script>var x = "<div>";</script></head><body>
<h1>Dashen Bank Super App Electronic Receipt</h1>
<div><span>Sender Name:</span><span>Test Sender</span></div>
<div><span>Sender Account Number:</span><span>2912******911</span></div>
<div><span>Receiver Name:</span><span>Test Receiver</span></div>
<div><span>Receiver Account Number:</span><span>7938******911</span></div>
<div><span>Transaction Reference:</span><span>{ref}</span></div>
<div><span>Transaction Date:</span><span>Jul 9, 2026, 10:25:33 pm</span></div>
<table><tr><td>Transaction Amount</td><td>ETB 12,600.00</td></tr></table></body></html>"""


@responses.activate
def test_dashen_current_host_html():
    ref = "B22WDTI2619100WH"
    responses.add(
        responses.GET,
        f"https://receipts.dashenbanksc.com/receipt/{ref}",
        body=DASHEN_HTML.format(ref=ref),
        status=200,
        content_type="text/html",
    )
    result = verify("dashen", ref)
    assert result.status.value == "verified"
    assert result.amount == 12600.0
    assert result.sender_name == "Test Sender"
    assert result.receiver_account == "7938******911"
    assert result.transaction_date == datetime(2026, 7, 9, 22, 25, 33)
    assert len(responses.calls) == 1


@responses.activate
def test_dashen_400_is_not_found_and_mismatch_fails():
    responses.add(
        responses.GET,
        "https://receipts.dashenbanksc.com/receipt/WDTI5186142501962",
        json={"statusCode": 400, "message": "Transaction not found"},
        status=400,
    )
    with pytest.raises(ReceiptNotFoundError):
        verify("dashen", "WDTI5186142501962")
    responses.add(
        responses.GET,
        "https://receipts.dashenbanksc.com/receipt/B22WDTI2619100WH",
        body=DASHEN_HTML.format(ref="B22WDTI0000000XX"),
        status=200,
        content_type="text/html",
    )
    assert verify("dashen", "B22WDTI2619100WH").status.value == "failed"


def test_gate_reference_parity_with_the_server():
    from cheki.registry import gate
    from cheki.result import VerificationResult, VerificationStatus

    def make(bank: str, returned: str, gate_id: str | None = None) -> VerificationResult:
        raw: dict[str, object] = {"bank_reference": returned}
        if gate_id:
            raw["gate_id"] = gate_id
        return VerificationResult(
            bank=bank, reference="x", status=VerificationStatus.VERIFIED, exists=True,
            amount=10.0, sender_name="A", raw=raw,
        )

    # Opaque share tokens (server: REFERENCE_IS_OPAQUE_TOKEN) are exempt...
    assert gate(make("cbe", "FT26140P01YB", "cbe-new"), "fHCxyV4mg5pRIwEkJO").status.value == "verified"
    assert gate(make("awash", "123456"), "tok").status.value == "verified"
    # ...every other bank must return the reference that was asked for.
    assert gate(make("cbe", "FT00000XXXXX"), "FT26140P01YB").status.value == "failed"
    assert gate(make("cbe", " ft26140p01yb "), "FT26140P01YB").status.value == "verified"


def test_supported_banks():
    banks = supported_banks()
    assert "cbe" in banks
    assert "telebirr" in banks
    assert "boa" in banks
    assert "mpesa" in banks
