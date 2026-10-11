/**
 * ReDoS regression (review H2). The old Telebirr amount regex
 * /([0-9,]+\.?\d*)\s*(Birr|ETB)/i took ~80 s on 4,000 digits. Every parser
 * must handle 100k-character pathological input in under 200 ms.
 */
import { describe, it, expect } from "vitest";
import "@/lib/parsers";
import { getParser, getRegisteredBankIds } from "@/lib/parsers/registry";
import { BIRR_AMOUNT_RE, parseMoney } from "@/lib/core/money";
import { CBEParser } from "@/lib/parsers/cbe";
import { DashenParser } from "@/lib/parsers/dashen";
import { ZemenParser } from "@/lib/parsers/zemen";

const N = 100_000;
const digits = "1".repeat(N);
const am = "\u1200";

const payloads: Record<string, string> = {
  digits: "telebirr receipt\n" + digits,
  digitsAfterLabel: "telebirr receipt\nSettled Amount " + digits + "x",
  digitsCommas: "telebirr receipt\nTotal Paid Amount " + "1,".repeat(N / 2),
  digitsDot: "telebirr receipt\nSettled Amount " + digits + "." + digits,
  invoiceBlob: "telebirr receipt\nInvoice No.\nSettled AmountAB123456" + "01-01-2026 10:10:10" + digits + "x\nStamp Duty",
  invoiceColumns: "telebirr receipt\nInvoice No.\nPayment date\nSettled Amount\nX\n01-01-2026 10:10:10\n" + digits + "x\nStamp Duty",
  amharicAfterLabel: "telebirr receipt\nPayer Name " + am.repeat(N),
  bankAccount: "telebirr receipt\nBank account number " + digits + " x",
  spaces: "<html>" + " ".repeat(N) + "x",
  colonSpaces: "a:" + " ".repeat(N) + "\t",
  lessThan: "<td>" + "<".repeat(N),
  lessThanMarked: "telebirr receipt\n" + "<".repeat(N),
  unclosedScripts: "telebirr receipt " + "<script".repeat(N / 7),
  unclosedStyles: "<style x".repeat(N / 8),
  unclosedTd: "</td><td ".repeat(N / 9),
  colons: ":".repeat(N),
  tabs: "a" + "\t".repeat(N) + "b",
  labelSpaces: "Amount" + " ".repeat(N) + ":",
  json: '{"amount":"' + digits + '","transactionId":"' + digits + '"}',
};

function time(fn: () => unknown): number {
  const t = performance.now();
  try {
    fn();
  } catch {
    // parse errors are fine; only time matters
  }
  return performance.now() - t;
}

describe("ReDoS", () => {
  it("the bounded amount regex handles 100k digits in under 200 ms", () => {
    expect(time(() => digits.match(BIRR_AMOUNT_RE))).toBeLessThan(200);
    expect(time(() => parseMoney(digits))).toBeLessThan(200);
    // and still matches real amounts
    expect("1,234.50 Birr".match(BIRR_AMOUNT_RE)?.[1]).toBe("1,234.50");
    expect("500ETB".match(BIRR_AMOUNT_RE)?.[1]).toBe("500");
  });

  for (const id of getRegisteredBankIds()) {
    it(`${id}: every pathological 100k payload parses in under 200 ms`, () => {
      const p = getParser(id)!;
      for (const [name, payload] of Object.entries(payloads)) {
        for (const ct of ["text/html", "application/json"]) {
          const ms = time(() => p.parse(payload, ct));
          expect(ms, `${id} ${name} ${ct}: ${ms.toFixed(0)} ms`).toBeLessThan(200);
        }
      }
    });
  }

  it("PDF text parsers handle 100k pathological text in under 200 ms", () => {
    for (const [name, payload] of Object.entries(payloads)) {
      for (const [label, fn] of [
        ["cbe", () => CBEParser.parsePdfText("Commercial Bank of Ethiopia " + payload)],
        ["dashen", () => DashenParser.parsePdfText("Dashen Bank " + payload)],
        ["zemen", () => ZemenParser.parsePdfText("Zemen " + payload)],
      ] as const) {
        const ms = time(fn);
        expect(ms, `${label} ${name}: ${ms.toFixed(0)} ms`).toBeLessThan(200);
      }
    }
  });
});
