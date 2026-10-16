/**
 * presentVerdict: every state of the verdict card. Green only for a
 * bank-confirmed result; a decoded-only QR carries no amount or names; the
 * "couldn't check" states are neutral and never a judgement on the receipt.
 */
import { describe, it, expect } from "vitest";
import { presentVerdict, publicJson, cleanError, type FraudCheck } from "@/lib/verify/verdict";
import { resultText } from "@/lib/verify/summary";
import type { VerifyResult } from "@/lib/banks";

const at = new Date(2026, 9, 11, 14, 32);
const verified: VerifyResult = {
  success: true, verified: true, bank: "Commercial Bank of Ethiopia", bankCode: "cbe",
  reference: "FT26140P01YB", amount: 12500, currency: "ETB",
  senderName: "Abebe Kebede", receiverName: "Selam Electronics PLC", receiverAccount: "1000****6171",
  date: "2026-10-11T14:32:00+03:00", sourceUrl: "https://mbreciept.cbe.com.et/abc",
};

describe("green: verified only", () => {
  it("a bank-confirmed result is green with the spec copy", () => {
    const v = presentVerdict(verified, { checkedAt: at });
    expect(v.tone).toBe("green");
    expect(v.kind).toBe("verified");
    expect(v.title).toBe("Verified with CBE");
    expect(v.subtitle).toBe("Confirmed with CBE's own receipt record at 14:32");
    expect(v.amount).toEqual({ value: 12500, currency: "ETB" });
    expect(v.from?.name).toBe("Abebe Kebede");
    expect(v.to?.name).toBe("Selam Electronics PLC");
    expect(v.reference).toBe("FT26140P01YB");
    expect(v.bank?.code).toBe("cbe");
    expect(v.sourceUrl).toBe("https://mbreciept.cbe.com.et/abc");
  });

  it.each([
    ["success without verified", { success: true }],
    ["verified: false", { success: true, verified: false }],
    ["stringly true", { success: true, verified: "true" as unknown as boolean }],
    ["failed request claiming verified", { success: false, verified: true, httpStatus: 502 }],
    ["decoded-only claiming verified", { success: true, verified: true, decodedOnly: true }],
    ["parsed claiming verified", { success: true, verified: true, parsed: true }],
  ])("%s is never green", (_name, r) => {
    expect(presentVerdict(r as VerifyResult).tone).not.toBe("green");
  });

  it("a non-https source is not linked", () => {
    expect(presentVerdict({ ...verified, sourceUrl: "qr://boa" }).sourceUrl).toBeUndefined();
    expect(presentVerdict({ ...verified, sourceUrl: "javascript:alert(1)" }).sourceUrl).toBeUndefined();
  });

  it("a failed status on a 'verified' result is red, not green", () => {
    const v = presentVerdict({ ...verified, transactionStatus: "Failed" });
    expect(v.tone).toBe("red");
    expect(v.kind).toBe("notCompleted");
    expect(v.title).toBe("Payment not completed");
    expect(v.showDetails).toBe(false);
  });
});

describe("fraud checks", () => {
  const warn: FraudCheck = { id: "seen-before", label: "Checked before on this device", state: "warn" };
  const mismatch: FraudCheck = { id: "amount", label: "Amount does not match", state: "mismatch", detail: "Expected 10,000 ETB." };

  it("a warn check keeps the card green and is listed", () => {
    const v = presentVerdict(verified, { checks: [warn], checkedAt: at });
    expect(v.tone).toBe("green");
    expect(v.checks).toEqual([warn]);
  });

  it("any mismatch turns a verified card red", () => {
    const v = presentVerdict(verified, { checks: [warn, mismatch] });
    expect(v.tone).toBe("red");
    expect(v.kind).toBe("mismatch");
    expect(v.subtitle).toBe("Expected 10,000 ETB.");
    expect(v.guideHref).toBe("/guides/payment-fraud-ethiopia");
  });

  it("a mismatch on an amber result is red too", () => {
    expect(presentVerdict({ success: true, parsed: true }, { checks: [mismatch] }).tone).toBe("red");
    expect(presentVerdict({ success: true, decodedOnly: true }, { checks: [mismatch] }).tone).toBe("red");
  });
});

describe("amber", () => {
  const decoded: VerifyResult = {
    success: true, verified: false, decodedOnly: true, bank: "Bank of Abyssinia", bankCode: "boa",
    reference: "FT252003JZPP", amount: 50000, senderName: "Forged Name", receiverName: "Merchant", sourceUrl: "qr://boa",
  };

  it("a decoded-only BOA QR shows only the notice and the reference", () => {
    const v = presentVerdict(decoded);
    expect(v.tone).toBe("amber");
    expect(v.title).toBe("Decoded from QR, not confirmed with the bank");
    expect(v.reference).toBe("FT252003JZPP");
    expect(v.showDetails).toBe(false);
    expect(v.amount).toBeUndefined();
    expect(v.from).toBeUndefined();
    expect(v.to).toBeUndefined();
    expect(v.sourceUrl).toBeUndefined();
  });

  it("decoded-only values never reach the copied text or the JSON", () => {
    const v = presentVerdict(decoded);
    const text = resultText(v, { checkedAt: at });
    const json = JSON.stringify(publicJson(decoded, v));
    for (const out of [text, json]) {
      expect(out).not.toMatch(/50,?000/);
      expect(out).not.toMatch(/Forged Name|Merchant/);
      expect(out).toMatch(/FT252003JZPP/);
    }
    expect(text).toMatch(/^NOT VERIFIED: Decoded from QR, not confirmed with the bank/);
    expect(JSON.parse(json)).toEqual({ success: true, verified: false, decodedOnly: true, bank: "Bank of Abyssinia", reference: "FT252003JZPP" });
  });

  it("pasted page text is amber and keeps its details", () => {
    const v = presentVerdict({ success: true, verified: false, parsed: true, bankCode: "telebirr", amount: 300, senderName: "A" });
    expect(v.tone).toBe("amber");
    expect(v.kind).toBe("parsed");
    expect(v.showDetails).toBe(true);
    expect(v.amount?.value).toBe(300);
  });

  it("a bank answer that did not confirm is amber, without details", () => {
    const v = presentVerdict({ success: true, verified: false, bankCode: "dashen", amount: 10, senderName: "X" });
    expect(v.tone).toBe("amber");
    expect(v.kind).toBe("unconfirmed");
    expect(v.showDetails).toBe(false);
  });

  it("a 422 for a response with no amount or parties is amber, not 'no receipt'", () => {
    const v = presentVerdict({ success: false, httpStatus: 422, error: "[CBE] The bank's response has no valid amount, so it cannot be confirmed as a receipt." });
    expect(v.tone).toBe("amber");
    expect(v.kind).toBe("unconfirmed");
  });
});

describe("red", () => {
  it("no matching receipt: one next step and the fraud guide", () => {
    const v = presentVerdict({ success: false, httpStatus: 422, error: "[Commercial Bank of Ethiopia] Receipt not found or invalid." }, { bankCode: "cbe", reference: "FT123" });
    expect(v.tone).toBe("red");
    expect(v.kind).toBe("notFound");
    expect(v.title).toBe("No matching receipt");
    expect(v.nextStep).toBeTruthy();
    expect(v.guideHref).toBe("/guides/payment-fraud-ethiopia");
    expect(v.reference).toBe("FT123");
    expect(v.detail).toBe("Receipt not found or invalid.");
  });

  it("a Failed or Pending bank status reads 'Payment not completed'", () => {
    for (const status of ["Failed", "Pending"]) {
      const v = presentVerdict({ success: false, httpStatus: 422, error: `[Telebirr] The bank lists this transaction as "${status}". It is not a completed payment.` }, { bankCode: "telebirr" });
      expect(v.tone).toBe("red");
      expect(v.title).toBe("Payment not completed");
      expect(v.subtitle).toContain(status);
    }
  });

  it("a different reference from the bank is red", () => {
    const v = presentVerdict({ success: false, httpStatus: 422, error: "[CBE] The bank returned a receipt with a different reference than the one you entered." });
    expect(v.tone).toBe("red");
    expect(v.kind).toBe("mismatch");
  });
});

describe("neutral: couldn't check", () => {
  it("429 carries the retry countdown", () => {
    const v = presentVerdict({ success: false, httpStatus: 429, retryAfter: 17, error: "Too many checks from your network. Wait 17 seconds and try again." });
    expect(v.tone).toBe("neutral");
    expect(v.kind).toBe("rateLimited");
    expect(v.retryAfter).toBe(17);
    expect(v.subtitle).toMatch(/says nothing about the receipt/);
  });

  it("413, 5xx and offline are neutral", () => {
    expect(presentVerdict({ success: false, httpStatus: 413 }).kind).toBe("tooLarge");
    expect(presentVerdict({ success: false, httpStatus: 500 }).kind).toBe("unavailable");
    expect(presentVerdict({ success: false, httpStatus: 503 }).tone).toBe("neutral");
    expect(presentVerdict({ success: false, httpStatus: 0 }).kind).toBe("offline");
    expect(presentVerdict(null, { offline: true }).kind).toBe("offline");
  });

  it("a geo-blocked bank is neutral and links the bank's own receipt page", () => {
    const v = presentVerdict({ success: false, httpStatus: 502, error: "[Telebirr] Our server can't reach this bank.", fallbackUrl: "https://transactioninfo.ethiotelecom.et/receipt/X" }, { bankCode: "telebirr" });
    expect(v.tone).toBe("neutral");
    expect(v.kind).toBe("geoBlocked");
    expect(v.fallbackUrl).toBe("https://transactioninfo.ethiotelecom.et/receipt/X");
    expect(presentVerdict({ success: false, httpStatus: 502 }, { bankCode: "mpesa" }).kind).toBe("geoBlocked");
  });

  it("a bank that sent an empty page (CBE Birr) links its receipt without claiming a geo-block", () => {
    const v = presentVerdict(
      { success: false, httpStatus: 502, error: "[CBE Birr] CBE Birr sent back an empty receipt page, so this could not be confirmed.", fallbackUrl: "https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251900000000" },
      { bankCode: "cbebirr" },
    );
    expect(v.tone).toBe("neutral");
    expect(v.kind).toBe("geoBlocked");
    expect(v.fallbackUrl).toBe("https://cbepay1.cbe.com.et/aureceipt?TID=DTS41AB2C90&PH=251900000000");
    expect(v.title).toBe("CBE Birr didn't show cheki the receipt");
    expect(v.subtitle).not.toMatch(/Ethiopian networks/);
    expect(v.subtitle).toMatch(/receipt number and payer phone don't match/);
    // A geo-blocked bank keeps its own copy.
    expect(presentVerdict({ success: false, httpStatus: 502, fallbackUrl: "https://transactioninfo.ethiotelecom.et/receipt/X" }, { bankCode: "telebirr" }).subtitle).toMatch(/Ethiopian networks/);
  });

  it("an http: fallback link is dropped", () => {
    expect(presentVerdict({ success: false, httpStatus: 502, fallbackUrl: "http://evil.example" }, { bankCode: "cbe" }).fallbackUrl).toBeUndefined();
  });

  it("no neutral state carries a guide link or details", () => {
    for (const r of [{ httpStatus: 429 }, { httpStatus: 413 }, { httpStatus: 502 }, { httpStatus: 0 }]) {
      const v = presentVerdict({ success: false, ...r });
      expect(v.guideHref).toBeUndefined();
      expect(v.showDetails).toBe(false);
    }
  });
});

describe("copy text", () => {
  it("never says 'verified by cheki'", () => {
    const text = resultText(presentVerdict(verified, { checkedAt: at }), { checkedAt: at });
    expect(text).not.toMatch(/verified by cheki/i);
    expect(text).toMatch(/^Confirmed with CBE's own receipt record at 14:32/);
    expect(text).toMatch(/Amount: 12,500 ETB/);
  });

  it("cleanError strips the internal [Bank] prefix and the duplicate link", () => {
    expect(cleanError("[Telebirr] Our server can't reach this bank. Try the new receipt format: https://x.et/r")).toBe("Our server can't reach this bank.");
    expect(cleanError(undefined)).toBeUndefined();
  });
});

describe("presentVerdict: cached answers", () => {
  it("a cached confirmation is still green but does not claim it was confirmed just now", () => {
    const v = presentVerdict({ success: true, verified: true, bankCode: "cbe", amount: 1, cached: true }, { checkedAt: new Date(2026, 9, 11, 14, 5) });
    expect(v.tone).toBe("green");
    expect(v.subtitle).not.toMatch(/14:05/);
    expect(v.subtitle).toMatch(/saved copy/);
  });
});
