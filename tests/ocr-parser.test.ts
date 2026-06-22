import { describe, it, expect } from "vitest";
import { parseReceiptText, detectBankFromText, ambiguousReferenceCandidates } from "@/lib/ocr-parser";

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

  it("detects Awash Bank from the logo text and numeric transaction ID", () => {
    const text = "AwashBank\nTransaction Successful\nTransaction ID 260328171079006\nAmount 1000 ETB";
    const result = parseReceiptText(text);
    expect(result).not.toBeNull();
    expect(result!.reference).toBe("260328171079006");
    expect(result!.bank).toBe("awash");
    expect(result!.message).toContain("share link or QR code");
  });

  it("extracts an Awash share URL from receipt text when present", () => {
    const text = "Awash Bank\nTransaction ID 260328171079006\nhttps://awashpay.awashbank.com:8225/-2KDL95Z0NR-4U61O6\nAmount 1000 ETB";
    const result = parseReceiptText(text);
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("awash");
    expect(result!.reference).toBe("2KDL95Z0NR-4U61O6");
    expect(result!.shareUrl).toBe("https://awashpay.awashbank.com:8225/-2KDL95Z0NR-4U61O6");
    expect(result!.confidence).toBe("high");
  });

  it("does not mistake a person's name for a BOA reference", () => {
    const text = "Beneficiary name SELEHADIN AMIR ABDULWEHAB\nTransaction ID 260328171079006";
    const result = parseReceiptText(text);
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("awash");
  });

  it("detects bank from Amharic/English text clues", () => {
    expect(detectBankFromText("Commercial Bank of Ethiopia receipt")).toBe("cbe");
    expect(detectBankFromText("Awash Bank transaction")).toBe("awash");
    expect(detectBankFromText("Telebirr payment")).toBe("telebirr");
  });

  it("generates 0/O candidates for ambiguous references", () => {
    const candidates = ambiguousReferenceCandidates("FT26170NPPON");
    expect(candidates).toContain("FT26170NPPON");
    expect(candidates).toContain("FT26170NPP0N");
  });
});
