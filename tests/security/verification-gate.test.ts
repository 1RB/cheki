/**
 * The shared post-parse verification gate (review H1/M4/M5, frontend F2) and
 * the parser fixes that feed it. Ported from poc.mts / misc.mts.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { Verifier } from "@/lib";
import { verificationGate } from "@/lib/core/gate";
import { classifyStatus } from "@/lib/core/status";
import { parseMoney } from "@/lib/core/money";
import { MpesaParser } from "@/lib/parsers/mpesa";
import { CBEParser, CBENewParser } from "@/lib/parsers/cbe";
import { TelebirrParser } from "@/lib/parsers/telebirr";
import { EBirrParser } from "@/lib/parsers/ebirr";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const good = {
  verified: true,
  senderName: "Abebe",
  receiverName: "Shop",
  amount: 500,
  reference: "FT26167ABCDE",
  transactionStatus: "Completed",
};

describe("verificationGate", () => {
  it("passes a complete receipt", () => {
    expect(verificationGate(good, { bankId: "boa", requestedReference: "ft26167abcde " })).toEqual({ ok: true });
  });

  it("requires a finite amount above zero", () => {
    for (const amount of [undefined, 0, -1, NaN, Infinity]) {
      const r = verificationGate({ ...good, amount }, { bankId: "boa", requestedReference: "FT26167ABCDE" });
      expect(r.ok, String(amount)).toBe(false);
    }
  });

  it("requires the returned reference to match the requested one", () => {
    const r = verificationGate({ ...good, reference: "FT26999OTHER" }, { bankId: "boa", requestedReference: "FT26167ABCDE" });
    expect(r).toMatchObject({ ok: false, reason: "reference" });
  });

  it("skips the reference match for banks whose link is an opaque token", () => {
    const r = verificationGate({ ...good, reference: "123456789" }, { bankId: "awash", requestedReference: "2KDL95Z0NR-4U61O6" });
    expect(r.ok).toBe(true);
  });

  it("requires at least one party", () => {
    const r = verificationGate({ ...good, senderName: undefined, receiverName: "  " }, { bankId: "boa", requestedReference: "FT26167ABCDE" });
    expect(r).toMatchObject({ ok: false, reason: "party" });
  });

  it("rejects known failure and non-final statuses", () => {
    for (const s of ["Failed", "FAILED", "Reversed", "Pending", "Cancelled", "Canceled", "Declined", "Expired", "Not completed"]) {
      const r = verificationGate({ ...good, transactionStatus: s }, { bankId: "boa", requestedReference: "FT26167ABCDE" });
      expect(r, s).toMatchObject({ ok: false, reason: "status" });
    }
  });

  it("fails closed when the parser did not accept the response", () => {
    expect(verificationGate({ ...good, verified: false }, { bankId: "boa" }).ok).toBe(false);
  });
});

describe("classifyStatus", () => {
  it("classifies statuses", () => {
    expect(classifyStatus("Completed")).toBe("success");
    expect(classifyStatus("Success")).toBe("success");
    expect(classifyStatus("Failed")).toBe("failure");
    expect(classifyStatus("transaction pending")).toBe("failure");
    expect(classifyStatus(undefined)).toBe("unknown");
    expect(classifyStatus("ተጠናቋል")).toBe("unknown");
  });
});

describe("parser fixes", () => {
  it("M-Pesa: {} and a 403 body are not verified", () => {
    const m = new MpesaParser();
    expect(m.parse("{}", "").verified).toBe(false);
    expect(m.parse('{"message":"Forbidden","status":403}', "").verified).toBe(false);
    expect(m.parse('{"responseCode":"1","transactionId":"AB123456","amount":"10"}', "").verified).toBe(false);
  });

  it("M-Pesa: a junk amount is undefined, never NaN", () => {
    const r = new MpesaParser().parse('{"amount":"KES abc","transactionId":"AB123456","senderName":"A"}', "");
    expect(r.amount).toBeUndefined();
    expect(r.verified).toBe(false);
  });

  it("M-Pesa: a complete body still verifies", () => {
    const r = new MpesaParser().parse(
      '{"responseCode":"0","transactionId":"AB123456","amount":"1,250.00","senderName":"A","receiverName":"B"}',
      ""
    );
    expect(r.verified).toBe(true);
    expect(r.amount).toBe(1250);
  });

  it('CBE-new: "1,250.00" parses as 1250, not 1', () => {
    const r = new CBENewParser().parse('{"id":"X1","amountCredited":"1,250.00","creditAccountHolder":"B"}', "");
    expect(r.amount).toBe(1250);
  });

  it("CBE-new: an id alone is not verified", () => {
    expect(new CBENewParser().parse('{"id":"X1"}', "").verified).toBe(false);
  });

  it("CBE PDF: bank name alone is not verified", () => {
    expect(CBEParser.parsePdfText("Commercial Bank of Ethiopia\nsome error page").verified).toBe(false);
  });

  it("parseMoney takes the first amount only", () => {
    expect(parseMoney("ETB 1,200.00 + 2.50 fee")).toBe(1200);
    expect(parseMoney("1,250.00")).toBe(1250);
    expect(parseMoney("abc")).toBeUndefined();
    expect(parseMoney(42)).toBe(42);
    expect(parseMoney(NaN)).toBeUndefined();
  });

  it("Telebirr: a Failed transaction does not pass the gate", () => {
    const tb = `<html><title>telebirr receipt</title><table><tr><td>Payer Name</td><td>A</td></tr><tr><td>transaction status</td><td>Failed</td></tr><tr><td>Invoice No.</td><td>DET1234567</td></tr><tr><td>Settled Amount</td><td>500.00 Birr</td></tr></table></html>`;
    const p = new TelebirrParser().parse(tb, "text/html");
    expect(p.transactionStatus).toBe("Failed");
    expect(verificationGate(p, { bankId: "telebirr", requestedReference: "DET1234567" })).toMatchObject({ ok: false, reason: "status" });
  });
});

describe("Verifier applies the gate to every bank", () => {
  const v = new Verifier();
  const html = (status: string, ref = "TXN123456") =>
    `<table><tr><td>Sender Name</td><td>JOHN</td></tr><tr><td>Receiver Name</td><td>JANE</td></tr>
     <tr><td>Amount</td><td>500 ETB</td></tr><tr><td>Date</td><td>2026-06-19</td></tr>
     <tr><td>Reference</td><td>${ref}</td></tr><tr><td>Status</td><td>${status}</td></tr></table>`;

  it("eBirr: a Failed transaction is an error, not verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html("Failed"), { status: 200 })));
    const r = await v.verify({ bank: "ebirr", reference: "nib/abcd1234" });
    expect(r.ok).toBe(false);
    if (!r.ok && "message" in r.error) expect(r.error.message).toMatch(/Failed/);
  });

  it("eBirr: a completed receipt verifies and raw bank HTML is not returned", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(html("Completed"), { status: 200 })));
    const r = await v.verify({ bank: "", reference: "https://receipt.ebirr.com/siinqee/abcd1234" });
    expect(r.ok && r.value.verified).toBe(true);
    if (r.ok) {
      expect(r.value.amount).toBe(500);
      expect("raw" in r.value).toBe(false);
      expect(r.value.sourceUrl).toBe("https://receipt.ebirr.com/siinqee/abcd1234");
    }
  });

  it("BOA: a different reference from the bank is rejected", async () => {
    const body = JSON.stringify({
      body: [{
        "Source Account Name": "A", "Receiver's Name": "B", "Transferred Amount": "5,000.00 ETB",
        "Transaction Reference": "FT26999OTHER",
      }],
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(body, { status: 200 })));
    const r = await v.verify({ bank: "boa", reference: "FT26167ABCDE", accountNumber: "1000054321" });
    expect(r.ok).toBe(false);
  });

  it("eBirr parser alone: one field is not a receipt", () => {
    expect(new EBirrParser().parse("<p>To: support desk</p>", "text/html").verified).toBe(false);
  });
});
