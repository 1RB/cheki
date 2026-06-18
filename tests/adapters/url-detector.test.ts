/**
 * Tests for URL detector — all known bank URL formats.
 */
import { describe, it, expect } from "vitest";
import { detectBankFromUrl, isUrl } from "@/lib/adapters/url-detector";

describe("isUrl", () => {
  it("detects http URLs", () => {
    expect(isUrl("http://example.com")).toBe(true);
  });

  it("detects https URLs", () => {
    expect(isUrl("https://example.com")).toBe(true);
  });

  it("rejects plain references", () => {
    expect(isUrl("FT26140P01YB")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isUrl("")).toBe(false);
  });
});

describe("detectBankFromUrl", () => {
  it("detects CBE new API URLs", () => {
    const result = detectBankFromUrl("https://mbreciept.cbe.com.et/fHCxyV4mg5p");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("cbe-new");
    expect(result!.reference).toBe("fHCxyV4mg5p");
  });

  it("detects CBE legacy URLs with account suffix", () => {
    const result = detectBankFromUrl("https://apps.cbe.com.et:100/?id=FT26140P01YB60536171");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("cbe");
    expect(result!.reference).toBe("FT26140P01YB");
    expect(result!.accountNumber).toBe("60536171");
  });

  it("detects Telebirr receipt URLs", () => {
    const result = detectBankFromUrl("https://transactioninfo.ethiotelecom.et/receipt/CHQ0FJ403O");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("telebirr");
    expect(result!.reference).toBe("CHQ0FJ403O");
  });

  it("detects BOA URLs with trx param", () => {
    const result = detectBankFromUrl("https://cs.bankofabyssinia.com/slip/?trx=AB12345");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("boa");
    expect(result!.reference).toBe("AB12345");
  });

  it("detects BOA URLs with id param", () => {
    const result = detectBankFromUrl("https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=AB1234567890");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("boa");
    expect(result!.reference).toBe("AB12345");
    expect(result!.accountNumber).toBe("67890");
  });

  it("detects Dashen receipt URLs", () => {
    const result = detectBankFromUrl("https://receipt.dashensuperapp.com/receipt/ABC123");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("dashen");
    expect(result!.reference).toBe("ABC123");
  });

  it("detects Awash receipt URLs", () => {
    const result = detectBankFromUrl("https://awashpay.awashbank.com:8225/-REF123");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("awash");
    expect(result!.reference).toBe("REF123");
  });

  it("detects Zemen receipt URLs", () => {
    const result = detectBankFromUrl("https://share.zemenbank.com/rt/REF123/pdf");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("zemen");
    expect(result!.reference).toBe("REF123");
  });

  it("detects M-Pesa receipt URLs", () => {
    const result = detectBankFromUrl("https://m-pesabusiness.safaricom.et/api/receipt/getReceipt?trxNo=ABC123");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("mpesa");
    expect(result!.reference).toBe("ABC123");
  });

  it("returns null for unknown URLs", () => {
    const result = detectBankFromUrl("https://example.com/something");
    expect(result).toBeNull();
  });

  it("returns null for invalid URLs", () => {
    const result = detectBankFromUrl("not a url");
    expect(result).toBeNull();
  });
});
