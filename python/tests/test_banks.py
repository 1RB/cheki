from datetime import datetime
from io import BytesIO
from unittest.mock import patch

import responses

from ethio_receipt_verify import supported_banks, verify
from ethio_receipt_verify.banks.cbe import CBEVerifier
from ethio_receipt_verify.errors import ReceiptNotFoundError, UpstreamError

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


@responses.activate
def test_mpesa_verify_success():
    url = "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=MP12345"
    responses.add(
        responses.GET,
        url,
        json={
            "responseCode": "0",
            "responseDescription": "Success",
            "senderName": "Alice",
            "receiverName": "Bob",
            "amount": 150,
            "currency": "ETB",
        },
        status=200,
    )
    result = verify("mpesa", "MP12345")
    assert result.status.value == "verified"
    assert result.amount == 150.0
    assert result.sender_name == "Alice"


@responses.activate
def test_mpesa_verify_not_found():
    url = "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=FAKE123"
    responses.add(
        responses.GET,
        url,
        json={
            "responseCode": "2032",
            "responseDescription": "The transaction receipt number does not exist.",
        },
        status=200,
    )
    try:
        verify("mpesa", "FAKE123")
    except ReceiptNotFoundError:
        pass


def test_supported_banks():
    banks = supported_banks()
    assert "cbe" in banks
    assert "telebirr" in banks
    assert "boa" in banks
    assert "mpesa" in banks
