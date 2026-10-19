/**
 * Tests for CBE PDF text parser and CBE new API JSON parser.
 */
import { describe, it, expect } from "vitest";
import { CBEParser, CBENewParser } from "@/lib/parsers/cbe";

describe("CBEParser", () => {
  const parser = new CBEParser();

  describe("buildUrl", () => {
    it("builds URL with FT ref and account suffix", () => {
      const url = parser.buildUrl("FT26SAMPLE01", "1000000006171");
      expect(url).toBe("https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171");
    });

    it("uses last 8 digits of account", () => {
      const url = parser.buildUrl("FT26SAMPLE01", "1000000006171");
      expect(url).toContain("00006171");
    });
  });

  describe("parsePdfText", () => {
    it("parses a valid CBE receipt text", () => {
      const sampleText = `Commercial Bank of Ethiopia
Payment / Transaction Information
Payer Mr Abebe Kebede Tesfaye
Account 1****1685
Receiver TIGIST ALEMU BEKELE
Account 1****6171
Transferred Amount 20,000.00 ETB
Payment Date & Time 5/20/2026, 7:29:00 PM
Reference No. (VAT Invoice No) FT26SAMPLE01
MEKANISA MICHAEL BRANC
Payment / Transaction Information
Reason / Type of service screen done via Mobile`;

      const result = CBEParser.parsePdfText(sampleText);
      expect(result.verified).toBe(true);
      expect(result.senderName).toContain("Abebe");
      expect(result.receiverName).toContain("TIGIST");
      expect(result.senderAccount).toBe("1****1685");
      expect(result.receiverAccount).toBe("1****6171");
      expect(result.amount).toBe(20000);
      expect(result.currency).toBe("ETB");
      expect(result.date).toContain("5/20/2026");
      expect(result.reference).toBe("FT26SAMPLE01");
    });

    it("returns verified=false for empty text", () => {
      const result = CBEParser.parsePdfText("");
      expect(result.verified).toBe(false);
    });

    it("returns verified=false for non-CBE text", () => {
      const result = CBEParser.parsePdfText("Some other bank receipt");
      expect(result.verified).toBe(false);
    });

    it("extracts what it can but does not verify a PDF with missing fields", () => {
      // This used to assert verified=true: the bank name plus one line was
      // enough. An error page on the CBE host would pass the same way.
      const minimal = `Commercial Bank of Ethiopia
PayerJohn Doe`;
      const result = CBEParser.parsePdfText(minimal);
      expect(result.verified).toBe(false);
      expect(result.senderName).toBe("John Doe");
      expect(result.amount).toBeUndefined();
      expect(result.date).toBeUndefined();
    });

    it("does not verify on the bank name alone", () => {
      const result = CBEParser.parsePdfText("Commercial Bank of Ethiopia\nsome error page");
      expect(result.verified).toBe(false);
    });
  });
});

describe("CBENewParser", () => {
  const parser = new CBENewParser();

  it("builds API URL with receipt ID", () => {
    const url = parser.buildUrl("fHCxExample");
    expect(url).toBe("https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/fHCxExample");
  });

  it("parses CBE new API JSON response", () => {
    const json = JSON.stringify({
      id: "fHCxExample",
      debitAccountHolder: "Mr Abebe Kebede Tesfaye",
      creditAccountHolder: "TIGIST ALEMU BEKELE",
      debitAccountNo: "1****1685",
      creditAccountNo: "1****6171",
      amountCredited: "20000.00",
      creditCurrency: "ETB",
      dateTimes: ["2026-05-20T19:29:00"],
      paymentDetails: ["screen done via Mobile"],
    });

    const result = parser.parse(json, "application/json");
    expect(result.verified).toBe(true);
    expect(result.senderName).toBe("Mr Abebe Kebede Tesfaye");
    expect(result.receiverName).toBe("TIGIST ALEMU BEKELE");
    expect(result.amount).toBe(20000);
    expect(result.currency).toBe("ETB");
    expect(result.reference).toBe("fHCxExample");
  });

  it("returns verified=false for invalid JSON", () => {
    const result = parser.parse("not json", "application/json");
    expect(result.verified).toBe(false);
  });

  it("returns verified=false for missing id", () => {
    const result = parser.parse(JSON.stringify({ foo: "bar" }), "application/json");
    expect(result.verified).toBe(false);
  });
});
