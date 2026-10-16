/**
 * Tests for URL detector - all known bank URL formats.
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
    expect(isUrl("FT26SAMPLE01")).toBe(false);
  });

  it("rejects empty strings", () => {
    expect(isUrl("")).toBe(false);
  });
});

describe("detectBankFromUrl", () => {
  it("detects CBE share links as CBE (current Receipt ID format)", () => {
    // The bank is "cbe"; the verifier picks the Receipt ID format from the token's shape.
    const result = detectBankFromUrl("https://mbreciept.cbe.com.et/fHCxExample");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("cbe");
    expect(result!.reference).toBe("fHCxExample");
    expect(result!.accountNumber).toBeUndefined();
    expect(detectBankFromUrl("https://mbreciept.cbe.com.et/v2-hfHCxExample0001")).toEqual({ bank: "cbe", reference: "v2-hfHCxExample0001" });
  });

  it("reads a dashed mbreciept link as the legacy FT reference + 8-digit account", () => {
    expect(detectBankFromUrl("https://mbreciept.cbe.com.et/ft26sample01-00006171")).toEqual({
      bank: "cbe",
      reference: "FT26SAMPLE01",
      accountNumber: "00006171",
    });
  });

  it("does not treat a look-alike CBE host as CBE", () => {
    expect(detectBankFromUrl("https://mbreciept.cbe.com.et.evil.example/fHCxExample")?.bank).not.toBe("cbe");
  });

  it("detects CBE legacy URLs with account suffix", () => {
    const result = detectBankFromUrl("https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("cbe");
    expect(result!.reference).toBe("FT26SAMPLE01");
    expect(result!.accountNumber).toBe("00006171");
  });

  it("detects Telebirr receipt URLs", () => {
    const result = detectBankFromUrl("https://transactioninfo.ethiotelecom.et/receipt/CHQ0SAMPLE");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("telebirr");
    expect(result!.reference).toBe("CHQ0SAMPLE");
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

  it("detects Dashen receipt URLs on receipts.dashenbanksc.com", () => {
    const result = detectBankFromUrl("https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("dashen");
    expect(result!.reference).toBe("B22WDTI00SAMPLE1");
  });

  it("detects Dashen legacy receipt URLs", () => {
    const result = detectBankFromUrl("https://receipt.dashensuperapp.com/receipt/ABC123");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("dashen");
    expect(result!.reference).toBe("ABC123");
  });

  it("detects Dashen PDF receipt URLs", () => {
    const result = detectBankFromUrl("https://api.dashensuperapp.com/receipts/Within-Dashen-Transfer-B22WDTI000000001.pdf");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("dashen");
    expect(result!.reference).toBe("B22WDTI000000001");
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

  it("detects CBE Birr receipt URLs and lifts the payer phone", () => {
    const result = detectBankFromUrl("https://cbepay1.cbe.com.et/aureceipt?TID=DHG00LX0AAA&PH=251911223344");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("cbebirr");
    expect(result!.reference).toBe("DHG00LX0AAA");
    expect(result!.phoneNumber).toBe("251911223344");
  });

  it("leaves phoneNumber unset when the CBE Birr URL has no PH", () => {
    const result = detectBankFromUrl("https://cbepay1.cbe.com.et/aureceipt?TID=DHG00LX0AAA");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("cbebirr");
    expect(result!.phoneNumber).toBeUndefined();
  });

  it("names the issuing bank from an eBirr white-label tenant", () => {
    const result = detectBankFromUrl("https://receipt.ebirr.com/siinqee/SQ12345678");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("siinqee");
    // tenant/token is kept so the parser can rebuild the URL on the fixed host
    expect(result!.reference).toBe("siinqee/SQ12345678");
  });

  it("maps a named eBirr tenant to its own bank", () => {
    const result = detectBankFromUrl("https://receipt.ebirr.com/nib/abc123def");
    expect(result).not.toBeNull();
    expect(result!.bank).toBe("nib");
    expect(result!.reference).toBe("nib/abc123def");
  });

  it("rejects an eBirr tenant cheki does not know (tenant allowlist)", () => {
    // It used to fall back to bank "ebirr" with the tenant dropped, which
    // could never verify. Unknown issuers are now rejected outright.
    expect(detectBankFromUrl("https://receipt.ebirr.com/somewhere/abc123def")).toBeNull();
    expect(detectBankFromUrl("https://receipt.ebirr.com/constructor/abc123def")).toBeNull();
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
