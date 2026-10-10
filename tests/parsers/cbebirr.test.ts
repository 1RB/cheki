/**
 * CBE Birr parser tests. All receipt text here is synthetic: invented names,
 * numbers and references laid out like the real PDF and HTML receipts.
 */
import { describe, it, expect } from "vitest";
import { CBEBirrParser, CBEBIRR_LABELS } from "@/lib/parsers/cbebirr";

// Layout as pdf-parse extracts it from a real receipt (per Vixen878/verifier-api):
// account block label-then-value, the receipt row run together, financial
// values before their labels, payment labels before their values.
const SYNTHETIC_PDF_TEXT = `Commercial Bank of Ethiopia
CBE Birr Receipt
Customer Information
Region: Addis Ababa
Sub city:
ABEBE TEST KEBEDE
Wereda/kebele:
01
Debit Account
2519XXXX1234
Credit Account
1000XXXXX5678
Receiver Name
TEST MERCHANT PLC
Order ID
ORD0000001
Transaction Status
Completed
Reference
TESTREF0001
Transaction Details
Receipt Number Transaction Date Amount
CHK00000012026-10-01 14:051500.00
1500.00
5.00
0.75
1505.75
Paid amount
Service charge
VAT
Total Paid Amount
Amount in words
Payment Reason
Payment Channel
One Thousand Five Hundred Birr
Rent October
USSD`;

const SYNTHETIC_HTML = `<!DOCTYPE html><html><head><title>Auto Receipt</title></head><body>
<table>
<tr><td>Debit Account</td><td>2519XXXX4321</td></tr>
<tr><td>Credit Account</td><td>1000XXXXX8765</td></tr>
<tr><td>Receiver Name</td><td>SAMPLE SHOP</td></tr>
<tr><td>Order ID</td><td>ORD0000002</td></tr>
<tr><td>Transaction Status</td><td>Completed</td></tr>
<tr><td>Reference</td><td>TESTREF0002</td></tr>
<tr><td>Receipt Number</td><td>CHK0000002</td></tr>
<tr><td>Transaction Date</td><td>2026-10-02 09:30</td></tr>
<tr><td>Paid amount</td><td>2,000.00 ETB</td></tr>
<tr><td>Service charge</td><td>4.00</td></tr>
<tr><td>VAT</td><td>0.60</td></tr>
<tr><td>Total Paid Amount</td><td>2,004.60</td></tr>
<tr><td>Payment Reason</td><td>Invoice 12</td></tr>
<tr><td>Payment Channel</td><td>App</td></tr>
</table></body></html>`;

const TELERIK_SHELL = `<!DOCTYPE html><html><head><title>
	Auto Receipt
</title><link href="/WebResource.axd?d=abc" type="text/css" rel="stylesheet" class="Telerik_stylesheet" /></head>
<body><form id="form1"><script>var x = { ReportViewerID: "ReportViewer1" };</script>
<div id="ReportViewer1"></div>${" ".repeat(600)}</form></body></html>`;

describe("CBEBirrParser", () => {
  const parser = new CBEBirrParser();

  it("builds the aureceipt URL with TID and PH", () => {
    expect(parser.buildUrl("CHK0000001", undefined, "251900000000")).toBe(
      "https://cbepay1.cbe.com.et/aureceipt?TID=CHK0000001&PH=251900000000",
    );
  });

  it("reads the body as bytes so a PDF survives the fetch", () => {
    expect(parser.binaryResponse).toBe(true);
    expect(parser.requiresPhone).toBe(true);
  });

  it("parses the PDF text layout using the real receipt labels", () => {
    const r = CBEBirrParser.parseText(SYNTHETIC_PDF_TEXT);
    expect(r.verified).toBe(true);
    expect(r.senderName).toBe("ABEBE TEST KEBEDE");
    expect(r.senderAccount).toBe("2519XXXX1234");
    expect(r.receiverAccount).toBe("1000XXXXX5678");
    expect(r.receiverName).toBe("TEST MERCHANT PLC");
    expect(r.orderId).toBe("ORD0000001");
    expect(r.transactionStatus).toBe("Completed");
    expect(r.reference).toBe("CHK0000001");
    expect(r.date).toBe("2026-10-01 14:05");
    expect(r.amount).toBe(1500);
    expect(r.serviceFee).toBe(5);
    expect(r.serviceFeeVat).toBe(0.75);
    expect(r.totalPaid).toBe(1505.75);
    expect(r.amountInWords).toBe("One Thousand Five Hundred Birr");
    expect(r.reason).toBe("Rent October");
    expect(r.paymentChannel).toBe("USSD");
    expect(r.currency).toBe("ETB");
  });

  it("parses an HTML receipt with label and value cells", () => {
    const r = parser.parse(SYNTHETIC_HTML, "text/html");
    expect(r.verified).toBe(true);
    expect(r.senderAccount).toBe("2519XXXX4321");
    expect(r.receiverName).toBe("SAMPLE SHOP");
    expect(r.reference).toBe("CHK0000002");
    expect(r.date).toBe("2026-10-02 09:30");
    expect(r.amount).toBe(2000);
    expect(r.totalPaid).toBe(2004.6);
    expect(r.reason).toBe("Invoice 12");
    expect(r.paymentChannel).toBe("App");
  });

  it("treats the empty Telerik ReportViewer shell as not found", () => {
    expect(CBEBirrParser.isEmptyShell(TELERIK_SHELL)).toBe(true);
    expect(parser.parse(TELERIK_SHELL, "text/html").verified).toBe(false);
    expect(CBEBirrParser.isEmptyShell(SYNTHETIC_HTML)).toBe(false);
  });

  it("leaves PDF bytes to the verifier's async text extraction", () => {
    expect(parser.parse(Buffer.from("%PDF-1.4 fake"), "application/pdf").verified).toBe(false);
  });

  it("does not verify text that has labels but no amount", () => {
    const r = CBEBirrParser.parseText("Receiver Name\nSOMEONE\nOrder ID\nORD1\nReference\nX\nTransaction Details");
    expect(r.verified).toBe(false);
  });

  it("knows every label the real receipts use", () => {
    for (const l of ["Debit Account", "Credit Account", "Receiver Name", "Order ID", "Transaction Status", "Reference", "Receipt Number", "Paid amount", "Service charge", "VAT", "Total Paid Amount", "Payment Reason", "Payment Channel"]) {
      expect(CBEBIRR_LABELS).toContain(l);
    }
  });
});
