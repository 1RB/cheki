/**
 * Tests for Awash Bank HTML parser.
 */
import { describe, it, expect } from "vitest";
import { AwashParser } from "@/lib/parsers/awash";

describe("AwashParser", () => {
  const parser = new AwashParser();

  describe("buildUrl", () => {
    it("builds URL with the dash-prefixed share token", () => {
      const url = parser.buildUrl("2KDL95Z0NR-4U61O6");
      expect(url).toBe("https://awashpay.awashbank.com:8225/-2KDL95Z0NR-4U61O6");
    });
  });

  describe("parse", () => {
    const sampleHtml = `<!doctype html>
<html><head><title>Transfer successful</title></head>
<body>
<div>Transfer successful</div>
<table>
  <tr><td>Company Name</td><td>:</td><td>Awash Bank Share company</td></tr>
  <tr><td>Customer Name</td><td>:</td><td>MEDINA KASSAHUN MOHAMMED</td></tr>
  <tr><td>Account No</td><td>:</td><td>01425******7400/BANK</td></tr>
  <tr><td>Branch</td><td>:</td><td>IFB-KHIDMA BRANCH</td></tr>
</table>
<table>
  <tr><td>Transaction Date</td><td>:</td><td>2026-06-07 11:22:03</td></tr>
  <tr><td>Transaction Type</td><td>:</td><td>Send To Bank</td></tr>
  <tr><td>Amount</td><td>:</td><td>3,000 ETB</td></tr>
  <tr><td>Sender Account</td><td>:</td><td>01425******7400/BANK</td></tr>
  <tr><td>Sender Name</td><td>:</td><td>MEDINA KASSAHUN MOHAMMED</td></tr>
  <tr><td>Receiver Account</td><td>:</td><td>01425******9901</td></tr>
  <tr><td>Receiver Name</td><td>:</td><td>HLIMET DEMSE KEBEDE</td></tr>
  <tr><td>Reason</td><td>:</td><td>Salary</td></tr>
  <tr><td>Transaction ID</td><td>:</td><td>260607112275735</td></tr>
</table>
</body></html>`;

    it("parses a valid Awash receipt HTML", () => {
      const result = parser.parse(sampleHtml, "text/html");
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("MEDINA KASSAHUN MOHAMMED");
      expect(result.senderAccount).toBe("01425******7400/BANK");
      expect(result.receiverName).toBe("HLIMET DEMSE KEBEDE");
      expect(result.receiverAccount).toBe("01425******9901");
      expect(result.amount).toBe(3000);
      expect(result.currency).toBe("ETB");
      expect(result.date).toBe("2026-06-07 11:22:03");
      expect(result.reference).toBe("260607112275735");
      expect(result.reason).toBe("Salary");
      expect(result.branch).toBe("IFB-KHIDMA BRANCH");
      expect(result.transactionType).toBe("Send To Bank");
    });

    it("returns verified=false for invalid receipt id", () => {
      const result = parser.parse("<html><body>Invalid receipt id</body></html>", "text/html");
      expect(result.verified).toBe(false);
    });

    it("returns verified=false for missing required fields", () => {
      const result = parser.parse(
        "<html><body>Transfer successful</body></html>",
        "text/html"
      );
      expect(result.verified).toBe(false);
    });

    it("strips embedded CSS from the raw text", () => {
      const htmlWithCss = `<style>/* CSS */ body { font-family: Arial; }</style>${sampleHtml}`;
      const result = parser.parse(htmlWithCss, "text/html");
      expect(result.raw).not.toContain("font-family");
      expect(result.raw).not.toContain("/* CSS */");
      expect(result.verified).toBe(true);
    });
  });
});
