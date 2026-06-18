/**
 * Tests for Telebirr and M-Pesa parsers.
 */
import { describe, it, expect } from "vitest";
import { TelebirrParser } from "@/lib/parsers/telebirr";
import { MpesaParser } from "@/lib/parsers/mpesa";

describe("TelebirrParser", () => {
  const parser = new TelebirrParser();

  it("builds correct URL", () => {
    expect(parser.buildUrl("CHQ0FJ403O")).toBe(
      "https://transactioninfo.ethiotelecom.et/receipt/CHQ0FJ403O"
    );
  });

  it("is geo-blocked", () => {
    expect(parser.geoBlocked).toBe(true);
  });

  it("parses valid telebirr HTML", () => {
    const html = `
      <html><body>
        <div>telebirr receipt</div>
        <div>Payer Name</div><div>Abebe Bekele</div>
        <div>Payer telebirr no</div><div>0912345678</div>
        <div>Credited Party name</div><div>Sara Tadesse</div>
        <div>Credited party account no</div><div>0987654321</div>
        <div>500.00 Birr</div>
        <div>15-06-2026 14:30:00</div>
      </body></html>
    `;
    const result = parser.parse(html, "text/html");
    expect(result.verified).toBe(true);
    expect(result.senderName).toBe("Abebe Bekele");
    expect(result.receiverName).toBe("Sara Tadesse");
    expect(result.amount).toBe(500);
    expect(result.currency).toBe("ETB");
  });

  it("returns verified=false for invalid receipt", () => {
    const html = "<html><body>This request is not correct</body></html>";
    const result = parser.parse(html, "text/html");
    expect(result.verified).toBe(false);
  });

  it("returns verified=false for non-telebirr HTML", () => {
    const html = "<html><body>Some other content</body></html>";
    const result = parser.parse(html, "text/html");
    expect(result.verified).toBe(false);
  });
});

describe("MpesaParser", () => {
  const parser = new MpesaParser();

  it("builds correct URL", () => {
    expect(parser.buildUrl("ABC123")).toBe(
      "https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=ABC123"
    );
  });

  it("is geo-blocked", () => {
    expect(parser.geoBlocked).toBe(true);
  });

  it("parses valid M-Pesa JSON", () => {
    const json = JSON.stringify({
      senderName: "John Doe",
      receiverName: "Jane Smith",
      amount: "1000",
      currency: "ETB",
      transactionId: "ABC123",
      transactionDate: "2026-06-15",
    });
    const result = parser.parse(json, "application/json");
    expect(result.verified).toBe(true);
    expect(result.senderName).toBe("John Doe");
    expect(result.receiverName).toBe("Jane Smith");
    expect(result.amount).toBe(1000);
  });

  it("returns verified=false for error response", () => {
    const json = JSON.stringify({
      responseCode: "1",
      responseDescription: "Transaction not found",
    });
    const result = parser.parse(json, "application/json");
    expect(result.verified).toBe(false);
  });

  it("returns verified=false for invalid JSON", () => {
    const result = parser.parse("not json", "application/json");
    expect(result.verified).toBe(false);
  });
});
