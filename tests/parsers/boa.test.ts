/**
 * Tests for BOA JSON parser.
 */
import { describe, it, expect } from "vitest";
import { BOAParser } from "@/lib/parsers/boa";

describe("BOAParser", () => {
  const parser = new BOAParser();

  describe("buildUrl", () => {
    it("builds URL with reference and last 5 digits of account", () => {
      const url = parser.buildUrl("AB12345", "1234567890");
      expect(url).toBe("https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=AB1234567890");
    });
  });

  describe("parse", () => {
    it("parses a valid BOA receipt JSON", () => {
      const json = JSON.stringify({
        body: [{
          "Source Account Name": "John Doe",
          "Source Account": "1234567890",
          "Receiver's Name": "Jane Smith",
          "Receiver's Account": "0987654321",
          "Transferred Amount": "5,000.00 ETB",
          currency: "ETB",
          "Transaction Date": "2026-06-15",
          "Transaction Reference": "AB12345",
        }],
      });

      const result = parser.parse(json, "application/json");
      expect(result.verified).toBe(true);
      expect(result.senderName).toBe("John Doe");
      expect(result.receiverName).toBe("Jane Smith");
      expect(result.amount).toBe(5000);
      expect(result.currency).toBe("ETB");
      expect(result.reference).toBe("AB12345");
    });

    it("returns verified=false for invalid reference", () => {
      const json = JSON.stringify({
        body: [{ "Payer's Name": "Invalid reference number" }],
      });
      const result = parser.parse(json, "application/json");
      expect(result.verified).toBe(false);
    });

    it("returns verified=false for empty body", () => {
      const json = JSON.stringify({ body: [] });
      const result = parser.parse(json, "application/json");
      expect(result.verified).toBe(false);
    });

    it("returns verified=false for invalid JSON", () => {
      const result = parser.parse("not json", "application/json");
      expect(result.verified).toBe(false);
    });
  });
});
