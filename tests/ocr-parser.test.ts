import { describe, it, expect } from "vitest";
import { parseReceiptText } from "@/lib/ocr-parser";

describe("ocr parser", () => {
  it("extracts a CBE FT reference from receipt text", () => {
    const text = "Commercial Bank of Ethiopia\nTransaction Reference: FT26140P01YB\nAmount: 20,000 ETB\nDate: 20-May-2026";
    const result = parseReceiptText(text);
    expect(result).not.toBeNull();
    expect(result!.reference).toBe("FT26140P01YB");
    expect(result!.bank).toBe("cbe");
    expect(result!.confidence).toBe("high");
  });

  it("extracts a Telebirr reference from receipt text", () => {
    const text = "Ethio Telecom Telebirr\nTransaction ID: CHQ0FJ403O\nStatus: Success\nAmount: 500 ETB";
    const result = parseReceiptText(text);
    expect(result).not.toBeNull();
    expect(result!.reference).toBe("CHQ0FJ403O");
    expect(result!.bank).toBe("telebirr");
  });

  it("extracts a Dashen reference from receipt text", () => {
    const text = "Dashen Bank\nReference: B12ABCD123456789\nAmount: 1,000 ETB";
    const result = parseReceiptText(text);
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("dashen");
  });

  it("returns null when no reference is found", () => {
    const text = "Thank you for your payment. No transaction number here.";
    const result = parseReceiptText(text);
    expect(result).toBeNull();
  });

  it("handles uppercase and noisy text", () => {
    const text = "CBE RECEIPT\nREF: ft26140p01yb\nACCOUNT: 1000560536171";
    const result = parseReceiptText(text);
    expect(result).not.toBeNull();
    expect(result!.reference).toBe("FT26140P01YB");
  });
});
