/**
 * CBE Birr parser tests. All receipt data here is synthetic: invented names,
 * numbers and references laid out like the real PDF (confirmed against two
 * real receipts on 2026-10-16) and HTML receipts. No real receipt is stored.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CBEBirrParser, CBEBIRR_LABELS, maskCbeBirrNumber, normalizeCbeBirrPhone, rowsFromItems } from "@/lib/parsers/cbebirr";
import { verificationGate } from "@/lib/core/gate";
import { parseTimestamp } from "@/lib/time/relative";
import { buildSyntheticCbeBirrPdf, SYNTHETIC_CBEBIRR, SYNTHETIC_CBEBIRR_TO_BANK } from "../fixtures/cbebirr/synthetic-receipt";

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

describe("CBE Birr real PDF layout (synthetic fixture)", () => {
  const read = async (pdf: Buffer) => CBEBirrParser.parseText(await CBEBirrParser.extractPdfText(pdf));

  it("the committed PDF is the builder's output and says it is synthetic", () => {
    const committed = readFileSync(join(__dirname, "../fixtures/cbebirr/synthetic-receipt.pdf"));
    expect(committed.equals(buildSyntheticCbeBirrPdf())).toBe(true);
    expect(committed.toString("latin1")).toContain("SYNTHETIC TEST FIXTURE - NOT A REAL CBE BIRR RECEIPT");
  });

  it("reads every field of a wallet-to-wallet receipt", async () => {
    const r = await read(readFileSync(join(__dirname, "../fixtures/cbebirr/synthetic-receipt.pdf")));
    expect(r).toEqual({
      verified: true,
      senderName: "ABEBE KEBEDE",
      senderAccount: "09****4321",
      receiverName: "TIGIST ALEMU",
      receiverAccount: "09****6171",
      amount: 1250.5,
      currency: "ETB",
      date: "2026-10-01 09:15",
      reference: "DTS41AB2C90",
      orderId: "DTS41AB2C90",
      transactionStatus: "Completed",
      serviceFee: 0,
      serviceFeeVat: 0,
      totalPaid: 1250.5,
      reason: "Send Money",
      paymentChannel: "API",
      amountInWords: "One Thousand Two Hundred Fifty ETB and Fifty Cents",
    });
    expect(verificationGate(r, { bankId: "cbebirr", requestedReference: "DTS41AB2C90" })).toEqual({ ok: true });
  });

  it("reads a wallet-to-bank receipt: the receiver is the Receiver Name row, not the bank on the credit row", async () => {
    const r = await read(buildSyntheticCbeBirrPdf(SYNTHETIC_CBEBIRR_TO_BANK));
    expect(r.verified).toBe(true);
    expect(r.receiverName).toBe("Ms Tigist Alemu");
    expect(r.receiverAccount).toBe("1000****6171");
    expect(r.orderId).toBe("FT26SAMPLE01");
    expect(r.reference).toBe("DTS41AB2C90");
    expect(r.reason).toBe("TransferfromMMToBank by Customer to Org");
    expect(r.paymentChannel).toBe("API");
  });

  it("never returns a phone number in full", async () => {
    const r = await read(buildSyntheticCbeBirrPdf());
    const json = JSON.stringify(r);
    expect(json).not.toContain(SYNTHETIC_CBEBIRR.payerPhone);
    expect(json).not.toContain("0922006171");
    expect(json).not.toMatch(/\b0[79]\d{8}\b/);
  });

  it("joins a name that wraps onto a second row", async () => {
    const r = await read(
      buildSyntheticCbeBirrPdf({
        payerName: "ABEBE KEBEDE",
        credit: ["0922006171 - TIGIST ALEMU", "GEBREMEDHIN"],
        receiver: ["0922006171 - TIGIST ALEMU", "GEBREMEDHIN"],
      }),
    );
    expect(r.receiverName).toBe("TIGIST ALEMU GEBREMEDHIN");
    expect(r.receiverAccount).toBe("09****6171");
  });

  it("keeps the money values with their labels although the PDF draws them apart", async () => {
    const r = await read(buildSyntheticCbeBirrPdf({ amount: "2000.00", serviceCharge: "4.00", vat: "0.60", total: "2004.60" }));
    expect(r.amount).toBe(2000);
    expect(r.serviceFee).toBe(4);
    expect(r.serviceFeeVat).toBe(0.6);
    expect(r.totalPaid).toBe(2004.6);
  });

  it("does not take the VAT registration number for the VAT amount", () => {
    const r = CBEBirrParser.parseText(
      "VAT Registration No:000000\nVAT Invoice No:\nDebit Account 0911004321 - ABEBE KEBEDE\nDTS41AB2C90 2026-10-01 09:15 10.00\nPaid amount 10.00\nVAT 0.00",
    );
    expect(r.serviceFeeVat).toBe(0);
  });

  it("does not take the table header for the receipt number", () => {
    const r = CBEBirrParser.parseText("Receipt Number Transaction Date Amount\nDTS41AB2C90 2026-10-01 09:15 10.00\nDebit Account 0911004321 - ABEBE KEBEDE");
    expect(r.reference).toBe("DTS41AB2C90");
  });

  it("reads the payer's note row without taking it for the receipt number", async () => {
    const r = await read(buildSyntheticCbeBirrPdf({ note: "Invoice 42" }));
    expect(r.reference).toBe("DTS41AB2C90");
  });

  it("the date has no offset and is read on the Addis Ababa clock", async () => {
    const r = await read(buildSyntheticCbeBirrPdf());
    expect(parseTimestamp(r.date)?.date.getTime()).toBe(Date.UTC(2026, 9, 1, 6, 15));
  });

  it("the gate rejects a receipt whose number is not the one requested, or that did not complete", async () => {
    const r = await read(buildSyntheticCbeBirrPdf());
    expect(verificationGate(r, { bankId: "cbebirr", requestedReference: "DTS41AB2C91" }).ok).toBe(false);
    const failed = await read(buildSyntheticCbeBirrPdf({ status: "Failed" }));
    expect(verificationGate(failed, { bankId: "cbebirr", requestedReference: "DTS41AB2C90" }).ok).toBe(false);
  });

  it("still reads the core fields from flowed text (content-stream order, no rows)", async () => {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buildSyntheticCbeBirrPdf()));
    const { text } = await extractText(pdf, { mergePages: true });
    const r = CBEBirrParser.parseText(text);
    expect(r.verified).toBe(true);
    expect(r.reference).toBe("DTS41AB2C90");
    expect(r.amount).toBe(1250.5);
    expect(r.senderName).toBe("ABEBE KEBEDE");
    expect(r.senderAccount).toBe("09****4321");
    expect(r.receiverName).toBe("TIGIST ALEMU");
  });

  it("returns no text for bytes that are not a PDF", async () => {
    expect(await CBEBirrParser.extractPdfText(Buffer.from("not a pdf"))).toBe("");
  });

  it("groups positioned text into rows, left to right, with spaces at gaps", () => {
    expect(
      rowsFromItems([
        { str: "50.00", x: 500, y: 271, w: 20 },
        { str: "Paid", x: 406, y: 271, w: 20 },
        { str: "amount", x: 429, y: 271, w: 30 },
        { str: "Disaster Response", x: 406, y: 242, w: 70 },
        { str: "0.00", x: 500, y: 240, w: 15 },
      ]),
    ).toBe("Paid amount 50.00\nDisaster Response 0.00");
  });

  it("masks phone numbers and long accounts, and keeps what the bank already masked", () => {
    expect(maskCbeBirrNumber("0911004321")).toBe("09****4321");
    expect(maskCbeBirrNumber("0711004321")).toBe("07****4321");
    expect(maskCbeBirrNumber("251911004321")).toBe("2519****4321");
    expect(maskCbeBirrNumber("1000000006171")).toBe("1********6171");
    expect(maskCbeBirrNumber("1000****6171")).toBe("1000****6171");
    expect(maskCbeBirrNumber("2519XXXX4321")).toBe("2519XXXX4321");
    expect(maskCbeBirrNumber(undefined)).toBeUndefined();
  });
});
