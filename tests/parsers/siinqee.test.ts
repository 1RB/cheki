/**
 * Siinqee Bank: receipts.siinqeebank.com:871/generate/{reference}.
 *
 * Synthetic fixtures only (tests/fixtures/siinqee/receipts.ts). Covers the
 * text parser (HTML table, divs with label and value in one node, PDF text),
 * the reference rules (case-sensitive, never uppercased), what is never
 * returned (the customer block), the verifier path (one request, no retry,
 * 422 + checkedUrl when not confirmed, the legacy eBirr route) and the host
 * allowlist.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { Verifier } from "@/lib";
import { getParser } from "@/lib/parsers/registry";
import "@/lib/parsers";
import {
  SiinqeeParser,
  parseSiinqeeText,
  siinqeeHtmlToText,
  siinqeeFields,
  maskSiinqeeAccount,
  checkSiinqeeReference,
  boundedDescription,
} from "@/lib/parsers/siinqee";
import { detectBankFromUrl } from "@/lib/adapters/url-detector";
import { isAllowedUrl } from "@/lib/security/hosts";
import { verificationGate } from "@/lib/core/gate";
import { canonicalReference } from "@/lib/reference-case";
import { selectFormat } from "@/lib/manifest/formats";
import { getBank } from "@/lib/manifest/loader";
import { parseReceiptText } from "@/lib/ocr-parser";
import { presentVerdict } from "@/lib/verify/verdict";
import { SIINQEE_NOT_CONFIRMED } from "@/lib/core/verifier";
import {
  SYNTH_SIINQEE_REF,
  SYNTH_SIINQEE_IPS_REF,
  SYNTH_SIINQEE_LINK,
  SYNTH_CUSTOMER,
  siinqeeP2pHtml,
  siinqeeIpsHtml,
  siinqeePdfText,
  siinqeeOtherRefHtml,
  siinqeeNoSuccessHtml,
  SIINQEE_ERROR_HTML,
} from "../fixtures/siinqee/receipts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const textOf = (html: string) => siinqeeHtmlToText(html);
const leak = (v: unknown) => {
  const s = JSON.stringify(v);
  return [SYNTH_CUSTOMER.phone, SYNTH_CUSTOMER.tin, SYNTH_CUSTOMER.branch, "ADDIS ABABA", "info@example.test"].filter((x) => s.includes(x));
};

describe("Siinqee receipt text", () => {
  it("reads a transfer laid out as an HTML table", () => {
    const { parsed, miss } = parseSiinqeeText(textOf(siinqeeP2pHtml()), SYNTH_SIINQEE_REF);
    expect(miss).toBeUndefined();
    expect(parsed).toMatchObject({
      verified: true,
      reference: SYNTH_SIINQEE_REF,
      amount: 1500,
      currency: "ETB",
      date: "2026-10-22",
      senderName: SYNTH_CUSTOMER.name,
      senderAccount: "100*******001",
      receiverName: "TEST RECEIVER PLC",
      receiverAccount: "100*******002",
      transactionType: "ACCOUNT TO ACCOUNT TRANSFER",
      totalPaid: 1500,
    });
    // "-" is a missing value, not a zero fee.
    expect(parsed.serviceFee).toBeUndefined();
    expect(parsed.serviceFeeVat).toBeUndefined();
    expect(verificationGate(parsed, { bankId: "siinqee", requestedReference: SYNTH_SIINQEE_REF }).ok).toBe(true);
  });

  it("reads an incoming instant payment laid out as divs, label and value in one node", () => {
    const { parsed } = parseSiinqeeText(textOf(siinqeeIpsHtml()), SYNTH_SIINQEE_IPS_REF);
    expect(parsed).toMatchObject({
      verified: true,
      reference: SYNTH_SIINQEE_IPS_REF,
      amount: 2250.5,
      senderName: "Incoming from Other Bank",
      senderAccount: "100***011",
      receiverName: "TEST RECEIVER PLC",
      transactionType: "INCOMING INSTANT PAYMENT SYSTEM",
      date: "2026-10-22",
    });
  });

  it("reads PDF text: labels run into values, a fee filled in, an unmasked account remasked", () => {
    const { parsed } = parseSiinqeeText(siinqeePdfText(), SYNTH_SIINQEE_REF);
    expect(parsed).toMatchObject({
      verified: true,
      amount: 1500,
      serviceFee: 5,
      serviceFeeVat: 0.75,
      totalPaid: 1505.75,
      receiverName: "TEST RECEIVER PLC",
      senderAccount: "1********0001",
    });
  });

  it("never returns or keeps the customer block (phone, TIN, branch, region) or the bank's address block", () => {
    for (const [text, ref] of [
      [textOf(siinqeeP2pHtml()), SYNTH_SIINQEE_REF],
      [textOf(siinqeeIpsHtml()), SYNTH_SIINQEE_IPS_REF],
      [siinqeePdfText(), SYNTH_SIINQEE_REF],
    ] as const) {
      const { parsed } = parseSiinqeeText(text, ref);
      expect(leak(parsed), ref).toEqual([]);
      const raw = JSON.parse(parsed.raw!);
      const allowed = new Set(["reference", "date", "currency", "description", "amount", "fee", "vat", "total"]);
      for (const k of Object.keys(raw)) expect(allowed.has(k), k).toBe(true);
      expect(JSON.stringify(raw)).not.toMatch(/TEST|\*/);
    }
  });

  it("a different reference on the page is not confirmed, and the match is case-sensitive", () => {
    expect(parseSiinqeeText(textOf(siinqeeOtherRefHtml()), SYNTH_SIINQEE_REF)).toEqual({ parsed: { verified: false }, miss: "reference" });
    expect(parseSiinqeeText(textOf(siinqeeP2pHtml()), SYNTH_SIINQEE_REF.toUpperCase()).miss).toBe("reference");
  });

  it("no success line, an error page or an empty body is not confirmed", () => {
    expect(parseSiinqeeText(textOf(siinqeeNoSuccessHtml()), SYNTH_SIINQEE_REF).miss).toBe("no-success");
    expect(parseSiinqeeText(textOf(SIINQEE_ERROR_HTML), SYNTH_SIINQEE_REF).parsed.verified).toBe(false);
    expect(parseSiinqeeText("", SYNTH_SIINQEE_REF).parsed.verified).toBe(false);
    const noAmount = siinqeeP2pHtml().replace(/1,500\.00 ETB/g, "-");
    expect(parseSiinqeeText(textOf(noAmount), SYNTH_SIINQEE_REF).miss).toBe("amount");
  });

  it("takes each label's value up to the next known label, longest label first", () => {
    const f = siinqeeFields("Transferred Amount 10.00 ETB Total Amount 12.00 ETB Amount in Words Ten Birr");
    expect(f["Transferred Amount"]).toBe("10.00 ETB");
    expect(f["Total Amount"]).toBe("12.00 ETB");
    expect(f["Amount"]).toBeUndefined();
    expect(f["Amount in Words"]).toBe("Ten Birr");
  });

  it("keeps Siinqee's own account mask and remasks anything else", () => {
    expect(maskSiinqeeAccount("100*******001")).toBe("100*******001");
    expect(maskSiinqeeAccount("100***011")).toBe("100***011");
    expect(maskSiinqeeAccount("1000000000001")).toBe("1********0001");
    expect(maskSiinqeeAccount("10000*****00001")).toBe("1**********0001");
    expect(maskSiinqeeAccount("-")).toBeUndefined();
    expect(maskSiinqeeAccount("null")).toBeUndefined();
  });

  it("parse() without a requested reference never treats pasted content as the bank's answer for another reference", () => {
    const p = new SiinqeeParser();
    expect(p.parse(siinqeeP2pHtml(), "text/html").verified).toBe(true);
    expect(p.parse(Buffer.from("%PDF-1.7 ..."), "application/pdf").verified).toBe(false);
  });
});

describe("Siinqee references", () => {
  it("accepts the 16-character shape, case kept, and rejects anything else", () => {
    expect(checkSiinqeeReference(` ${SYNTH_SIINQEE_REF} `)).toEqual({ ok: true, value: SYNTH_SIINQEE_REF });
    expect(checkSiinqeeReference(SYNTH_SIINQEE_IPS_REF).ok).toBe(true);
    for (const bad of ["12b004k262950007", "12B004k26295000", "12B004k2629500071", "12B004-262950007", "12B004k26295000x", "../x", "SQ12345678"]) {
      expect(checkSiinqeeReference(bad).ok, bad).toBe(false);
    }
  });

  it("reference-case leaves Siinqee untouched, typed or from a link", () => {
    expect(canonicalReference("siinqee", SYNTH_SIINQEE_REF)).toBe(SYNTH_SIINQEE_REF);
    expect(canonicalReference("siinqee", SYNTH_SIINQEE_REF, { compact: false })).toBe(SYNTH_SIINQEE_REF);
    expect(getParser("siinqee")!.normalizeReference(SYNTH_SIINQEE_REF)).toEqual({ ok: true, value: SYNTH_SIINQEE_REF });
  });

  it("builds the URL on the fixed host and port only", () => {
    expect(getParser("siinqee")!.buildUrl(SYNTH_SIINQEE_REF)).toBe(SYNTH_SIINQEE_LINK);
    expect(() => getParser("siinqee")!.buildUrl("https://evil.example/generate/x")).toThrow();
    expect(isAllowedUrl(SYNTH_SIINQEE_LINK)).toBe(true);
    expect(isAllowedUrl(`https://receipts.siinqeebank.com/generate/${SYNTH_SIINQEE_REF}`)).toBe(false);
    expect(isAllowedUrl(`https://receipts.siinqeebank.com:8443/generate/${SYNTH_SIINQEE_REF}`)).toBe(false);
    expect(isAllowedUrl(`http://receipts.siinqeebank.com:871/generate/${SYNTH_SIINQEE_REF}`)).toBe(false);
  });

  it("a typed reference picks the current format; a receipt.ebirr.com/siinqee token the legacy one", () => {
    const bank = getBank("siinqee");
    const cur = selectFormat(bank, { reference: SYNTH_SIINQEE_REF });
    expect(cur.ok && cur.format?.id).toBe("siinqee-bank-receipt");
    const legacy = selectFormat(bank, { reference: "siinqee/AbCdEf123456" });
    expect(legacy.ok && legacy.format?.id).toBe("siinqee-ebirr");
  });
});

describe("Siinqee links", () => {
  it("detects receipts.siinqeebank.com(:871)/generate/{ref}, keeping the case", () => {
    expect(detectBankFromUrl(SYNTH_SIINQEE_LINK)).toEqual({ bank: "siinqee", reference: SYNTH_SIINQEE_REF });
    expect(detectBankFromUrl(`https://receipts.siinqeebank.com/generate/${SYNTH_SIINQEE_REF}`)).toEqual({ bank: "siinqee", reference: SYNTH_SIINQEE_REF });
    expect(detectBankFromUrl(`${SYNTH_SIINQEE_LINK}.`)).toEqual({ bank: "siinqee", reference: SYNTH_SIINQEE_REF });
    expect(detectBankFromUrl(`${SYNTH_SIINQEE_LINK}?x=1#y`)?.reference).toBe(SYNTH_SIINQEE_REF);
  });

  it("rejects other ports, paths and look-alike hosts", () => {
    expect(detectBankFromUrl(`https://receipts.siinqeebank.com:8080/generate/${SYNTH_SIINQEE_REF}`)).toBeNull();
    expect(detectBankFromUrl(`https://receipts.siinqeebank.com:871/other/${SYNTH_SIINQEE_REF}`)).toBeNull();
    expect(detectBankFromUrl(`https://receipts.siinqeebank.com:871/generate/${SYNTH_SIINQEE_REF}/x`)).toBeNull();
    expect(detectBankFromUrl(`https://receipts.siinqeebank.com.evil.example:871/generate/${SYNTH_SIINQEE_REF}`)).toBeNull();
    expect(detectBankFromUrl(`https://evil.example/receipts.siinqeebank.com:871/generate/${SYNTH_SIINQEE_REF}`)).toBeNull();
  });

  it("OCR reads the SMS reference with its case kept", () => {
    const r = parseReceiptText(`Siinqee Bank\nDear Customer, ETB 1,500.00 has been debited. Ref: ${SYNTH_SIINQEE_REF} Balance ETB 10.00`);
    expect(r).toMatchObject({ bank: "siinqee", reference: SYNTH_SIINQEE_REF });
    // A 16-digit number is not taken for a Siinqee reference.
    expect(parseReceiptText("Siinqee Bank account 1000000000000001")?.reference).not.toBe("1000000000000001");
  });

  it("OCR keeps Siinqee (and the reference's case) when the receipt also names CBE", () => {
    const text = `Siinqee Bank S.C\nCustomer Receipt\nTransaction is successful!\nReceiver Bank: Commercial Bank of Ethiopia (CBE)\nReference No ${SYNTH_SIINQEE_IPS_REF.replace("IIPS", "iiPS")}\nAmount 1,500.00`;
    expect(parseReceiptText(text)).toMatchObject({ bank: "siinqee", reference: SYNTH_SIINQEE_IPS_REF.replace("IIPS", "iiPS") });
    // A CBE receipt with no Siinqee-shaped reference stays CBE.
    expect(parseReceiptText("Commercial Bank of Ethiopia\nTransferred to Siinqee Bank\nReference No FT26304ABCDE")?.bank).toBe("cbe");
  });
});

describe("Siinqee through the verifier", () => {
  const v = new Verifier();
  let n = 0;
  /** A unique synthetic reference per test so the receipt cache never answers. */
  const ref = () => `12B004k2629${String(++n).padStart(5, "0")}`;

  const serve = (body: string | Uint8Array, status = 200, type = "text/html; charset=utf-8") => {
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (u: string | URL | Request) => {
        calls.push(String(u instanceof Request ? u.url : u));
        return new Response(body as BodyInit, { status, headers: { "content-type": type } });
      })
    );
    return calls;
  };

  it("verifies a receipt link: one request to the rebuilt URL, sourceUrl is Siinqee's page", async () => {
    const r1 = ref();
    const calls = serve(siinqeeP2pHtml(r1));
    const res = await v.verify({ bank: "", reference: `https://receipts.siinqeebank.com:871/generate/${r1}` });
    expect(res.ok && res.value.verified).toBe(true);
    if (res.ok) {
      expect(res.value).toMatchObject({ bankCode: "siinqee", reference: r1, amount: 1500, sourceUrl: `https://receipts.siinqeebank.com:871/generate/${r1}` });
      expect("raw" in res.value).toBe(false);
      expect(leak(res.value)).toEqual([]);
    }
    expect(calls).toEqual([`https://receipts.siinqeebank.com:871/generate/${r1}`]);
  });

  it("verifies a typed reference with bank siinqee, case kept", async () => {
    const r1 = ref();
    const calls = serve(siinqeeIpsHtml(r1));
    const res = await v.verify({ bank: "siinqee", reference: r1 });
    expect(res.ok && res.value.verified).toBe(true);
    expect(calls[0]).toContain(`/generate/${r1}`);
  });

  it("not confirmed is a 422 with the receipt page as checkedUrl, never a request retried", async () => {
    for (const body of [siinqeeNoSuccessHtml(), SIINQEE_ERROR_HTML, ""]) {
      const r1 = ref();
      const calls = serve(body);
      const res = await v.verify({ bank: "siinqee", reference: r1 });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.kind).toBe("EXTRACTION_ERROR");
        expect(res.error.kind === "EXTRACTION_ERROR" && res.error.checkedUrl).toBe(`https://receipts.siinqeebank.com:871/generate/${r1}`);
        expect(res.error.kind === "EXTRACTION_ERROR" && res.error.message).toMatch(/cannot be confirmed as a receipt/);
        expect(res.error.kind === "EXTRACTION_ERROR" && res.error.message).not.toMatch(/fake/i);
      }
      expect(calls).toHaveLength(1);
    }
  });

  it("another reference on the page is a reference mismatch", async () => {
    const calls = serve(siinqeeOtherRefHtml());
    const res = await v.verify({ bank: "siinqee", reference: ref() });
    expect(!res.ok && res.error.kind === "EXTRACTION_ERROR" && res.error.message).toMatch(/different reference/);
    expect(calls).toHaveLength(1);
  });

  it("a 5xx or a network error is not retried (about five views per receipt)", async () => {
    const calls = serve("oops", 503);
    const res = await v.verify({ bank: "siinqee", reference: ref() });
    expect(!res.ok && res.error.kind).toBe("ENDPOINT_ERROR");
    expect(calls).toHaveLength(1);

    const failing = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", failing);
    const res2 = await v.verify({ bank: "siinqee", reference: ref() });
    expect(res2.ok).toBe(false);
    expect(failing).toHaveBeenCalledTimes(1);
  });

  it("a 404 is not confirmed (the unknown-reference answer is unobserved), not retried", async () => {
    const calls = serve("Not Found", 404, "text/plain");
    const res = await v.verify({ bank: "siinqee", reference: ref() });
    expect(!res.ok && res.error.kind).toBe("EXTRACTION_ERROR");
    expect(!res.ok && res.error.kind === "EXTRACTION_ERROR" && res.error.message).toMatch(/cannot be confirmed as a receipt/);
    expect(calls).toHaveLength(1);
  });

  it("rejects a malformed typed reference without a request", async () => {
    const calls = serve(siinqeeP2pHtml());
    const res = await v.verify({ bank: "siinqee", reference: "SQ12345678" });
    expect(!res.ok && res.error.kind).toBe("REF_ERROR");
    expect(calls).toHaveLength(0);
  });

  it("keeps the legacy eBirr route working", async () => {
    const calls = serve("<table><tr><td>Sender</td><td>TEST PAYER</td></tr><tr><td>Amount</td><td>500.00</td></tr><tr><td>Reference</td><td>EB0001</td></tr></table>");
    const res = await v.verify({ bank: "", reference: "https://receipt.ebirr.com/siinqee/AbCd1234Legacy" });
    expect(res.ok && res.value.verified).toBe(true);
    expect(calls).toEqual(["https://receipt.ebirr.com/siinqee/AbCd1234Legacy"]);
  });
});

describe("Siinqee verdicts", () => {
  it("not confirmed is amber, never 'no matching receipt' or fake", () => {
    const v = presentVerdict({ success: false, httpStatus: 422, bankCode: "siinqee", error: `[Siinqee Bank] ${SIINQEE_NOT_CONFIRMED}`, checkedUrl: SYNTH_SIINQEE_LINK });
    expect(v.kind).toBe("unconfirmed");
    expect(v.tone).toBe("amber");
  });
});

describe("Siinqee description stays inside the transaction block", () => {
  it("cuts at the customer block in any casing, and drops what it can't bound", () => {
    expect(boundedDescription("ACCOUNT TO ACCOUNT TRANSFER")).toBe("ACCOUNT TO ACCOUNT TRANSFER");
    expect(boundedDescription(`ACCOUNT TO ACCOUNT TRANSFER CUSTOMER INFORMATION customer name: ${SYNTH_CUSTOMER.name} customer phone: ${SYNTH_CUSTOMER.phone}`)).toBe("ACCOUNT TO ACCOUNT TRANSFER");
    expect(boundedDescription(`school fee tin: ${SYNTH_CUSTOMER.tin}`)).toBe("school fee");
    expect(boundedDescription(`Phone: ${SYNTH_CUSTOMER.phone}`)).toBeUndefined();
    expect(boundedDescription("X".repeat(200))).toBeUndefined();
  });

  it("a receipt with the customer block after the description, labels in other casing, leaks nothing", () => {
    const text = [
      "Siinqee Bank S.C Customer Receipt Transaction is successful!",
      `Reference No ${SYNTH_SIINQEE_REF} Transaction Date 22/10/2026 Currency ETB`,
      "Transferred Amount 1,500.00 Total Amount 1,500.00",
      `Transaction Description ACCOUNT TO ACCOUNT TRANSFER CUSTOMER INFORMATION CUSTOMER NAME: ${SYNTH_CUSTOMER.name} CUSTOMER PHONE: ${SYNTH_CUSTOMER.phone} tin: ${SYNTH_CUSTOMER.tin} branch: ${SYNTH_CUSTOMER.branch}`,
    ].join(" ");
    const { parsed } = parseSiinqeeText(text, SYNTH_SIINQEE_REF);
    expect(parsed.verified).toBe(true);
    expect(parsed.transactionType).toBe("ACCOUNT TO ACCOUNT TRANSFER");
    const out = JSON.stringify(parsed);
    for (const secret of Object.values(SYNTH_CUSTOMER)) expect(out).not.toContain(secret);
  });
});
