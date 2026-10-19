import { describe, it, expect } from "vitest";
import { detectInput, extraFieldProblem, browserReceiptUrl, betaInfo, liveBanks } from "@/lib/verify/detect";

const BOA_QR = Buffer.alloc(96, 7).toString("base64");

describe("detectInput", () => {
  it("empty input detects nothing", () => {
    const d = detectInput("   ");
    expect(d.kind).toBe("empty");
    expect(d.bank).toBeUndefined();
    expect(d.browserFirst).toBe(false);
  });

  it("a current CBE link is CBE, current format, no extra field", () => {
    const d = detectInput("https://mbreciept.cbe.com.et/fHCxExampleRcpt01");
    expect(d.kind).toBe("url");
    expect(d.bank?.code).toBe("cbe");
    expect(d.olderFormat).toBe(false);
    expect(d.needsAccount).toBe(false);
  });

  it("a legacy CBE FT reference opens the account field", () => {
    const d = detectInput("FT26SAMPLE01");
    expect(d.kind).toBe("reference");
    expect(d.bank?.code).toBe("cbe");
    expect(d.olderFormat).toBe(true);
    expect(d.needsAccount).toBe(true);
    expect(d.accountDigits).toBe(8);
  });

  it("a legacy CBE link carries its account, so no extra field", () => {
    const d = detectInput("https://apps.cbe.com.et:100/?id=FT26SAMPLE0100006171");
    expect(d.bank?.code).toBe("cbe");
    expect(d.needsAccount).toBe(false);
  });

  it("a BOA QR payload is BOA", () => {
    const d = detectInput(BOA_QR);
    expect(d.kind).toBe("boaQr");
    expect(d.bank?.code).toBe("boa");
    expect(d.needsAccount).toBe(false);
  });

  it("Telebirr and M-Pesa are browser-first", () => {
    const tb = detectInput("DET0SAMPLE");
    expect(tb.bank?.code).toBe("telebirr");
    expect(tb.browserFirst).toBe(true);
    expect(browserReceiptUrl(tb)).toBe("https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE");
    const mp = detectInput("SE12345678", { overrideBank: "mpesa" });
    expect(mp.bank?.code).toBe("mpesa");
    expect(mp.overridden).toBe(true);
    expect(mp.browserFirst).toBe(true);
    expect(browserReceiptUrl(mp)).toMatch(/^https:\/\/m-pesabusiness\.safaricom\.et\//);
  });

  it("an ambiguous reference lists every candidate", () => {
    const d = detectInput("SE12345678");
    expect(d.candidates.map((b) => b.code)).toEqual(expect.arrayContaining(["boa", "mpesa"]));
  });

  it("the bank override wins over detection for a reference, never for a link", () => {
    expect(detectInput("FT26SAMPLE01", { overrideBank: "dashen" }).bank?.code).toBe("dashen");
    expect(detectInput("https://mbreciept.cbe.com.et/abcdefghijk", { overrideBank: "dashen" }).bank?.code).toBe("cbe");
  });

  it("a lookalike host is an unknown link", () => {
    expect(detectInput("https://transactioninfo.ethiotelecom.et.evil.example/receipt/X").kind).toBe("unknownUrl");
  });

  it("the locked bank is used for a bare reference", () => {
    expect(detectInput("AB12345678", { lockedBank: "boa" }).bank?.code).toBe("boa");
  });

  it("extraFieldProblem asks for what the format needs", () => {
    const d = detectInput("FT26SAMPLE01");
    expect(extraFieldProblem(d, "123")).toBe("account");
    expect(extraFieldProblem(d, "00006171")).toBeNull();
  });

  it("only live banks are detected", () => {
    expect(liveBanks.every((b) => b.status === "live")).toBe(true);
  });
});

describe("beta flag (read defensively)", () => {
  it("is false for a bank without it", () => {
    expect(betaInfo(liveBanks.find((b) => b.code === "cbe")).beta).toBe(false);
    expect(betaInfo(undefined).beta).toBe(false);
  });

  it("is read from the Bank object when present (PR #34 adds it)", () => {
    const cbe = liveBanks.find((b) => b.code === "cbe")!;
    const flagged = { ...cbe, beta: true, betaNote: "Beta: provisional." };
    expect(betaInfo(flagged)).toEqual({ beta: true, note: "Beta: provisional." });
  });
});
