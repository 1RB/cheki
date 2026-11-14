/**
 * resolveInput: the verifier's input classification, as a table. Every row
 * is one request shape and the one thing the verifier should do with it.
 * Pure: nothing here reaches a bank.
 */
import { describe, expect, it } from "vitest";
import { MAX_QR_LENGTH, resolveInput, resolveReference, type ResolvedInput } from "@/lib/core/resolve-input";
import type { VerifyRequest } from "@/lib/core/types";
import { SYNTHETIC_QR as TELEBIRR_QR, SYNTHETIC_REF as TELEBIRR_REF } from "../fixtures/telebirr-qr";
import { SYNTHETIC_QR as DASHEN_QR, SYNTHETIC_REF as DASHEN_REF } from "../fixtures/dashen-qr";

const CBEBIRR_LINK = "https://cbepay1.cbe.com.et/aureceipt?TID=DHG00LX0AAA&PH=251911223344";

type Row = [name: string, request: Partial<VerifyRequest> & Record<string, unknown>, expected: ResolvedInput | { kind: "invalid"; message: RegExp }];

const ROWS: Row[] = [
  ["typed reference", { bank: "cbe", reference: " FT26SAMPLE01 ", accountNumber: " 12345678 " },
    { kind: "reference", target: { bank: "cbe", reference: "FT26SAMPLE01", accountNumber: "12345678", phoneNumber: undefined, fromLink: false } }],
  ["blank account and phone are absent, not empty", { bank: "boa", reference: "FT1", accountNumber: "  ", phoneNumber: "" },
    { kind: "reference", target: { bank: "boa", reference: "FT1", accountNumber: undefined, phoneNumber: undefined, fromLink: false } }],
  ["nothing to check", { bank: "cbe" }, { kind: "invalid", message: /Reference number, receipt URL, or QR data is required/ }],
  ["whitespace reference and qrData", { bank: "cbe", reference: "  ", qrData: "  " }, { kind: "invalid", message: /is required/ }],
  ["non-string fields are ignored", { bank: "cbe", reference: 42 as unknown as string }, { kind: "invalid", message: /is required/ }],
  ["receipt link names its bank and wins over the one given", { bank: "boa", reference: "https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1" },
    { kind: "reference", target: { bank: "dashen", reference: "B22WDTI00SAMPLE1", accountNumber: undefined, phoneNumber: undefined, fromLink: true } }],
  ["a typed phone wins over the link's", { bank: "cbebirr", reference: CBEBIRR_LINK, phoneNumber: "0911000000" },
    { kind: "reference", target: { bank: "cbebirr", reference: "DHG00LX0AAA", accountNumber: undefined, phoneNumber: "0911000000", fromLink: true } }],
  ["unknown link", { bank: "cbe", reference: "https://example.com/r/1" }, { kind: "invalid", message: /Could not detect bank from URL/ }],
  ["URL-ish but not http(s)", { bank: "cbe", reference: "http:evil.com" }, { kind: "invalid", message: /Could not detect bank from URL/ }],
  ["qrData too long", { bank: "boa", qrData: "A".repeat(MAX_QR_LENGTH + 1) }, { kind: "invalid", message: /QR data is too long/ }],
  ["Telebirr QR", { qrData: TELEBIRR_QR },
    { kind: "reference", target: { bank: "telebirr", reference: TELEBIRR_REF, accountNumber: undefined, phoneNumber: undefined, fromLink: true } }],
  ["Telebirr QR wins over a typed reference", { bank: "telebirr", reference: "OTHER", qrData: TELEBIRR_QR },
    { kind: "reference", target: { bank: "telebirr", reference: TELEBIRR_REF, accountNumber: undefined, phoneNumber: undefined, fromLink: true } }],
  ["Telebirr QR for another bank", { bank: " BOA ", qrData: TELEBIRR_QR }, { kind: "invalid", message: /from a Telebirr receipt. Check it with bank "telebirr"/ }],
  ["Dashen QR", { bank: "dashen", qrData: DASHEN_QR },
    { kind: "reference", target: { bank: "dashen", reference: DASHEN_REF, accountNumber: undefined, phoneNumber: undefined, fromLink: true } }],
  ["Dashen QR for another bank", { bank: "cbe", qrData: DASHEN_QR }, { kind: "invalid", message: /from a Dashen receipt/ }],
  ["BOA QR is handed to the BOA flow", { bank: "BOA", qrData: " ciphertext " }, { kind: "boaQr", qrData: "ciphertext" }],
  ["CBE Birr QR (its receipt link), the pair in it wins", { qrData: CBEBIRR_LINK, phoneNumber: "0911000000", accountNumber: "1" },
    { kind: "reference", target: { bank: "cbebirr", reference: "DHG00LX0AAA", accountNumber: undefined, phoneNumber: "251911223344", fromLink: true } }],
  ["CBE Birr QR for another bank", { bank: "cbe", qrData: CBEBIRR_LINK }, { kind: "invalid", message: /from a CBE Birr receipt/ }],
  ["receipt link in a QR", { bank: "", qrData: "https://receipts.dashenbanksc.com/receipt/B22WDTI00SAMPLE1" },
    { kind: "reference", target: { bank: "dashen", reference: "B22WDTI00SAMPLE1", accountNumber: undefined, phoneNumber: undefined, fromLink: true } }],
  ["unknown link in a QR", { bank: "cbe", qrData: "https://example.com/x" }, { kind: "invalid", message: /not a receipt link cheki recognises/ }],
  ["plain reference in a QR, for the bank named", { bank: "cbe", qrData: "FT26SAMPLE01", accountNumber: "12345678" },
    { kind: "reference", target: { bank: "cbe", reference: "FT26SAMPLE01", accountNumber: "12345678", phoneNumber: undefined, fromLink: true } }],
  ["plain reference in a QR, no bank named", { qrData: "FT26SAMPLE01" },
    { kind: "reference", target: { bank: "", reference: "FT26SAMPLE01", accountNumber: undefined, phoneNumber: undefined, fromLink: true } }],
];

describe("resolveInput: classification table", () => {
  for (const [name, request, expected] of ROWS) {
    it(name, () => {
      const got = resolveInput(request as VerifyRequest);
      if (expected.kind === "invalid" && "message" in expected && expected.message instanceof RegExp) {
        expect(got.kind).toBe("invalid");
        if (got.kind === "invalid") {
          expect(got.error.kind).toBe("MISSING_INPUT");
          expect("message" in got.error ? got.error.message : "").toMatch(expected.message);
        }
      } else {
        expect(got).toEqual(expected);
      }
    });
  }
});

describe("resolveReference", () => {
  it("keeps fromLink for a reference read out of a QR", () => {
    expect(resolveReference({ bank: "boa", reference: "FT26SAMPLE01", accountNumber: "12345" }, true)).toEqual({
      kind: "reference",
      target: { bank: "boa", reference: "FT26SAMPLE01", accountNumber: "12345", phoneNumber: undefined, fromLink: true },
    });
  });

  it("never recurses: a QR always resolves in one step to a target, a BOA QR or an error", () => {
    // A QR whose content is itself a link resolves to that link's target,
    // not to another QR round (the old resolver counted depth for this).
    const got = resolveInput({ bank: "", qrData: CBEBIRR_LINK });
    expect(got.kind).toBe("reference");
  });
});
