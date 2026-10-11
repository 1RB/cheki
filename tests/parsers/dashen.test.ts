/**
 * Tests for Dashen Bank PDF parser.
 */
import { describe, it, expect } from "vitest";
import { DashenParser } from "@/lib/parsers/dashen";

describe("DashenParser", () => {
  const parser = new DashenParser();

  describe("buildUrl", () => {
    it("builds URL with FT/B22 reference", () => {
      const url = parser.buildUrl("B22WDTI261620001");
      expect(url).toBe(
        "https://receipts.dashenbanksc.com/receipt/B22WDTI261620001",
      );
    });
  });

  describe("parsePdfText", () => {
    it("parses a valid Dashen receipt text", () => {
      const sampleText =
        "Dashen Bank Super App Electronic Value Added Tax Receipt " +
        "Sender Name: Akrem Yusuf Ali " +
        "Sender Account Number: 2912******911 " +
        "Transaction Channel: Dashen Bank Super App " +
        "Service Type:Within Dashen Transfer " +
        "Narrative: transfer to dashen " +
        "Receiver Name: Arkan Intrernational Plc (hilcoe) " +
        "Receiver Account Number: 7938725387911 " +
        "Instituton Name: Dashen Bank Sc " +
        "Transaction Reference: B22WDTI261620001 " +
        "Transfer Reference: WDTI5921680061225851717 " +
        "Transaction Date: Jun 11, 2026, 08:45:50 am " +
        "Transaction Details Transaction Amount ETB 20,475.00 " +
        "Service Charge ETB 0.00 Total ETB 20,475.00";

      const result = DashenParser.parsePdfText(sampleText);
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("Akrem Yusuf Ali");
      expect(result.senderAccount).toBe("2912******911");
      expect(result.receiverName).toBe("Arkan Intrernational Plc (hilcoe)");
      expect(result.receiverAccount).toBe("7938725387911");
      expect(result.amount).toBe(20475);
      expect(result.currency).toBe("ETB");
      expect(result.date).toBe("Jun 11, 2026, 08:45:50 am");
      expect(result.reference).toBe("B22WDTI261620001");
      expect(result.reason).toBe("transfer to dashen");
    });

    it("returns verified=false for empty text", () => {
      const result = DashenParser.parsePdfText("");
      expect(result.verified).toBe(false);
    });

    it("returns verified=false for non-Dashen text", () => {
      const result = DashenParser.parsePdfText("Some other bank receipt");
      expect(result.verified).toBe(false);
    });

    it("handles missing required fields gracefully", () => {
      const minimal = "Dashen Bank Sender Name: John Doe";
      const result = DashenParser.parsePdfText(minimal);
      expect(result.verified).toBe(false);
      expect(result.senderName).toBe("John Doe");
      expect(result.amount).toBeUndefined();
    });
  });

  describe("HTML receipt (receipts.dashenbanksc.com)", () => {
    // Trimmed from the live page structure on 2026-10-10. Note the label order
    // differs from the PDF: Beneficiary Bank / Institution sit between
    // Receiver Name and Receiver Account Number.
    const html = `<!DOCTYPE html><html><head><title>Receipt</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
      <style>.x{color:red}</style></head><body>
      <h1>Dashen Bank Super App Electronic Receipt</h1><p>Dashen Bank S.C.</p>
      <div><span>Sender Name:</span><span>Test Sender</span></div>
      <div><span>Sender Account Number:</span><span>2912******911</span></div>
      <div><span>Service Type:</span><span>Transfer to Dashen Bank</span></div>
      <div><span>Transaction Channel:</span><span>Dashen Bank Super App</span></div>
      <div><span>Narrative:</span><span>Course fee</span></div>
      <div><span>Receiver Name:</span><span>Arkan Intrernational Plc (hilcoe) &amp; Co</span></div>
      <div><span>Beneficiary Bank Name:</span><span>Dashen Bank Sc</span></div>
      <div><span>Institution Name:</span><span>Dashen Bank sc</span></div>
      <div><span>Receiver Account Number:</span><span>7938******911</span></div>
      <div><span>Transaction Reference:</span><span>B22WDTI2619100WH</span></div>
      <div><span>Transfer Reference:</span><span>WDTI5186142501962751085</span></div>
      <div><span>Transaction Date:</span><span>Jul 9, 2026, 10:25:33 pm</span></div>
      <table><tr><td>Transaction Amount</td><td>ETB 12600.00</td></tr>
      <tr><td>Service Charge</td><td>ETB 0.00</td></tr>
      <tr><td>Total</td><td>ETB 12,600.00</td></tr></table>
      <button>Download Receipt</button></body></html>`;

    it("parses the HTML receipt", () => {
      const result = parser.parse(html, "text/html");
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("Test Sender");
      expect(result.receiverName).toBe("Arkan Intrernational Plc (hilcoe) & Co");
      expect(result.receiverAccount).toBe("7938******911");
      expect(result.amount).toBe(12600);
      expect(result.reference).toBe("B22WDTI2619100WH");
      expect(result.date).toBe("Jul 9, 2026, 10:25:33 pm");
      expect(result.reason).toBe("Course fee");
    });

    it("rejects the not-found JSON body", () => {
      const body = '{"statusCode":400,"message":"Transaction not found","internalCode":"CLNT_TXNALLT_4003"}';
      expect(parser.parse(body, "application/json").verified).toBe(false);
    });
  });
});
