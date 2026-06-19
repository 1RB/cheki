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
        "https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-B22WDTI261620001.pdf",
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
});
