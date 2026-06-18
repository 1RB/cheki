/**
 * Tests for CBE PDF text parser and CBE new API JSON parser.
 */
import { describe, it, expect } from "vitest";
import { CBEParser, CBENewParser } from "@/lib/parsers/cbe";

describe("CBEParser", () => {
  const parser = new CBEParser();

  describe("buildUrl", () => {
    it("builds URL with FT ref and account suffix", () => {
      const url = parser.buildUrl("FT26140P01YB", "1000560536171");
      expect(url).toBe("https://apps.cbe.com.et:100/?id=FT26140P01YB60536171");
    });

    it("uses last 8 digits of account", () => {
      const url = parser.buildUrl("FT26140P01YB", "1000560536171");
      expect(url).toContain("60536171");
    });
  });

  describe("parsePdfText", () => {
    it("parses a valid CBE receipt text", () => {
      const sampleText = `Commercial Bank of Ethiopia
Payment / Transaction Information
PayerMr Mohammed Abdulwasi Reshid
Account1****1685
ReceiverSAMI ADIL ZEKARIA
Account1****6171
Transferred Amount20,000.00 ETB
Payment Date & Time5/20/2026, 7:29:00 PM
Reference No. (VAT Invoice No)FT26140P01YB
MEKANISA MICHAEL BRANC
Payment / Transaction Information
Reason / Type of servicescreen done via Mobile`;

      const result = CBEParser.parsePdfText(sampleText);
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("Mr Mohammed Abdulwasi Reshid");
      expect(result.receiverName).toBe("SAMI ADIL ZEKARIA");
      expect(result.senderAccount).toBe("1****1685");
      expect(result.receiverAccount).toBe("1****6171");
      expect(result.amount).toBe(20000);
      expect(result.currency).toBe("ETB");
      expect(result.date).toBe("5/20/2026 7:29:00 PM");
      expect(result.reference).toBe("FT26140P01YB");
      expect(result.branch).toBe("MEKANISA MICHAEL BRANC");
    });

    it("returns verified=false for empty text", () => {
      const result = CBEParser.parsePdfText("");
      expect(result.verified).toBe(false);
    });

    it("returns verified=false for non-CBE text", () => {
      const result = CBEParser.parsePdfText("Some other bank receipt");
      expect(result.verified).toBe(false);
    });

    it("handles missing fields gracefully", () => {
      const minimal = `Commercial Bank of Ethiopia
PayerJohn Doe`;
      const result = CBEParser.parsePdfText(minimal);
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("John Doe");
      expect(result.amount).toBeUndefined();
      expect(result.date).toBeUndefined();
    });
  });
});

describe("CBENewParser", () => {
  const parser = new CBENewParser();

  it("builds API URL with receipt ID", () => {
    const url = parser.buildUrl("fHCxyV4mg5p");
    expect(url).toBe("https://Mb.cbe.com.et/api/v1/transactions/public/transaction-detail/fHCxyV4mg5p");
  });

  it("parses CBE new API JSON response", () => {
    const json = JSON.stringify({
      id: "fHCxyV4mg5p",
      debitAccountHolder: "Mr Mohammed Abdulwasi Reshid",
      creditAccountHolder: "SAMI ADIL ZEKARIA",
      debitAccountNo: "1****1685",
      creditAccountNo: "1****6171",
      amountCredited: "20000.00",
      creditCurrency: "ETB",
      dateTimes: ["2026-05-20T19:29:00"],
      paymentDetails: ["screen done via Mobile"],
    });

    const result = parser.parse(json, "application/json");
    expect(result.verified).toBe(true);
    expect(result.senderName).toBe("Mr Mohammed Abdulwasi Reshid");
    expect(result.receiverName).toBe("SAMI ADIL ZEKARIA");
    expect(result.amount).toBe(20000);
    expect(result.currency).toBe("ETB");
    expect(result.reference).toBe("fHCxyV4mg5p");
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
