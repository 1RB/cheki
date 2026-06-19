import { describe, it, expect } from "vitest";
import { EBirrParser } from "../../src/lib/parsers/ebirr";

describe("EBirrParser", () => {
  const parser = new EBirrParser();

  describe("buildUrl", () => {
    it("builds URL from tenant/token format", () => {
      expect(parser.buildUrl("nib/abc123")).toBe("https://receipt.ebirr.com/nib/abc123");
    });

    it("builds URL from full URL input", () => {
      expect(parser.buildUrl("https://receipt.ebirr.com/wegagen/xyz789")).toBe(
        "https://receipt.ebirr.com/wegagen/xyz789"
      );
    });

    it("handles whitespace in input", () => {
      expect(parser.buildUrl("  nib/abc123  ")).toBe("https://receipt.ebirr.com/nib/abc123");
    });

    it("handles kaafimf tenant", () => {
      expect(parser.buildUrl("kaafimf/test123")).toBe("https://receipt.ebirr.com/kaafimf/test123");
    });
  });

  describe("parse", () => {
    it("returns not verified for Not Found Page", () => {
      const notFoundHtml =
        '<!DOCTYPE html><html><head></head><body><h1 style="font-size: 42px; color: red;">Not Found Page</h1></body></html>';
      const result = parser.parse(notFoundHtml, "text/html");
      expect(result.verified).toBe(false);
    });

    it("parses a valid receipt with table-based layout", () => {
      const receiptHtml = `
        <html><body>
          <table>
            <tr><td>Sender Name</td><td>JOHN DOE</td></tr>
            <tr><td>Receiver Name</td><td>JANE SMITH</td></tr>
            <tr><td>Amount</td><td>500 ETB</td></tr>
            <tr><td>Date</td><td>2026-06-19</td></tr>
            <tr><td>Reference</td><td>TXN123456</td></tr>
            <tr><td>Status</td><td>Completed</td></tr>
          </table>
        </body></html>
      `;
      const result = parser.parse(receiptHtml, "text/html");
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("JOHN DOE");
      expect(result.receiverName).toBe("JANE SMITH");
      expect(result.amount).toBe(500);
      expect(result.currency).toBe("ETB");
      expect(result.date).toBe("2026-06-19");
      expect(result.reference).toBe("TXN123456");
      expect(result.transactionStatus).toBe("Completed");
    });

    it("parses receipt with colon-separated fields", () => {
      const receiptHtml = `
        <html><body>
          <div>Sender: ALICE</div>
          <div>Receiver: BOB</div>
          <div>Amount: 1,200 ETB</div>
        </body></html>
      `;
      const result = parser.parse(receiptHtml, "text/html");
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("ALICE");
      expect(result.receiverName).toBe("BOB");
      expect(result.amount).toBe(1200);
    });

    it("handles empty HTML", () => {
      const result = parser.parse("<html></html>", "text/html");
      expect(result.verified).toBe(false);
    });

    it("handles malformed HTML gracefully", () => {
      const result = parser.parse("<<<>broken", "text/html");
      expect(result.verified).toBe(false);
    });
  });

  describe("parser metadata", () => {
    it("has correct bank ID", () => {
      expect(parser.bankId).toBe("ebirr");
    });

    it("has correct bank name", () => {
      expect(parser.bankName).toBe("eBirr");
    });

    it("does not require account", () => {
      expect(parser.requiresAccount).toBe(false);
    });

    it("returns HTML response type", () => {
      expect(parser.responseType).toBe("html");
    });
  });
});
