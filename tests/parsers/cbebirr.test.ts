/**
 * CBE Birr parser tests. All receipt text here is synthetic: invented names,
 * numbers and references laid out like the real PDF and HTML receipts.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CBEBirrParser, CBEBIRR_LABELS, normalizeCbeBirrPhone } from "@/lib/parsers/cbebirr";

// Synthetic copy of the empty "Auto Receipt" page cbepay1 returns (2026-10-16):
// the real page's structure with every identifier and token invented.
const EMPTY_SHELL = readFileSync(join(__dirname, "../fixtures/cbebirr/empty-shell.html"), "utf8");

// Same PDF layout with an 11-character receipt number (the length seen in real
// receipt links) and the shared sample receipt's invented values.
const SYNTHETIC_PDF_TEXT_11 = `Commercial Bank of Ethiopia
CBE Birr Receipt
Customer Information
Region: Addis Ababa
Sub city:
ABEBE KEBEDE
Wereda/kebele:
01
Debit Account
2519XXXX4321
Credit Account
2519XXXX6171
Receiver Name
TIGIST ALEMU
Order ID
ORD0000042
Transaction Status
Completed
Reference
DTS41AB2C90
Transaction Details
Receipt Number Transaction Date Amount
DTS41AB2C902026-10-01 09:151250.50
1250.50
0.00
0.00
1250.50
Paid amount
Service charge
VAT
Total Paid Amount
Amount in words
Payment Reason
Payment Channel
One Thousand Two Hundred Fifty Birr and Fifty Cents
Invoice 42
App`;

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

  it("reads an 11-character receipt number whole, not its last 10 characters", () => {
    const r = CBEBirrParser.parseText(SYNTHETIC_PDF_TEXT_11);
    expect(r.verified).toBe(true);
    expect(r.reference).toBe("DTS41AB2C90");
    expect(r.date).toBe("2026-10-01 09:15");
    expect(r.senderName).toBe("ABEBE KEBEDE");
    expect(r.receiverName).toBe("TIGIST ALEMU");
    expect(r.amount).toBe(1250.5);
    expect(r.reason).toBe("Invoice 42");
    expect(r.paymentChannel).toBe("App");
  });

  it("still splits a 10-character receipt number that ends in digits from the date", () => {
    expect(CBEBirrParser.parseText(SYNTHETIC_PDF_TEXT).reference).toBe("CHK0000001");
  });

  it("treats the page cbepay1 actually returns for an empty result as an empty shell", () => {
    expect(CBEBirrParser.isEmptyShell(EMPTY_SHELL)).toBe(true);
    expect(parser.parse(EMPTY_SHELL, "text/html").verified).toBe(false);
    expect(parser.parse(Buffer.from(EMPTY_SHELL), "text/html").verified).toBe(false);
  });

  it("normalises the payer phone to the 251XXXXXXXXX form CBE Birr's links use", () => {
    for (const [input, want] of [
      ["251911223344", "251911223344"],
      ["+251 911 223 344", "251911223344"],
      ["0911223344", "251911223344"],
      ["911223344", "251911223344"],
      ["0711223344", "251711223344"],
      ["251711223344", "251711223344"],
    ] as const) {
      const r = normalizeCbeBirrPhone(input);
      expect(r, input).toEqual({ ok: true, value: want });
    }
    for (const bad of ["", "12345", "0811223344", "2518112233445", "251911-22x344", "1911223344"]) {
      expect(normalizeCbeBirrPhone(bad).ok, bad).toBe(false);
    }
  });

  it("builds the URL with the normalised phone", () => {
    expect(parser.buildUrl("DTS41AB2C90", undefined, "0911223344")).toBe(
      "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251911223344",
    );
  });

  it("accepts 10 and 11 character receipt numbers and rejects other shapes", () => {
    expect(parser.normalizeReference("DTS41AB2C90")).toEqual({ ok: true, value: "DTS41AB2C90" });
    expect(parser.normalizeReference("CHK0000001")).toEqual({ ok: true, value: "CHK0000001" });
    for (const bad of ["SHORT", "DTS41-AB2C90", "DTS41AB2C90.pdf", "A".repeat(40), "DTS41AB2C90&PH=1"]) {
      expect(parser.normalizeReference(bad).ok, bad).toBe(false);
    }
  });
});
