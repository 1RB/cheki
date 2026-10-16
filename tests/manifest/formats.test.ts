/**
 * Receipt formats: current first, legacy still working, deprecated never fetched.
 *
 * Covers the format data in banks.json and every consumer that reads it:
 * format selection (by input shape, no extra bank request), the verification
 * gate (CBE's Receipt ID is an opaque token), the host allowlist derived from
 * the formats, the legacy CBE PDF path, and GET /api/receipt.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { getAllBanks, getBank } from "@/lib/manifest/loader";
import { formatNeeds, formatsOf, primaryFormat, selectFormat, supportedFormats, templateHost } from "@/lib/manifest/formats";
import { verificationGate } from "@/lib/core/gate";
import { allowedHosts, isAllowedUrl } from "@/lib/security/hosts";
import { CBEParser } from "@/lib/parsers/cbe";
import { GET as receiptGET } from "@/app/api/receipt/route";
import "@/lib/parsers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

let n = 0;
/** Unique per test so the verifier's receipt cache never answers for the bank. */
const uniq = (prefix: string) => `${prefix}${String(Date.now()).slice(-6)}${String(++n).padStart(4, "0")}`;
const freshIp = () => ({ "x-forwarded-for": `10.31.${Math.floor(n / 250)}.${n++ % 250}` });

const RANK = { current: 0, legacy: 1, deprecated: 2 } as const;

describe("format data in banks.json", () => {
  it("orders every bank's formats current, then legacy, then deprecated", () => {
    for (const bank of getAllBanks()) {
      const ranks = formatsOf(bank).map((f) => RANK[f.status]);
      expect(ranks, bank.id).toEqual([...ranks].sort((a, b) => a - b));
    }
  });

  it("records evidence and confidence on every format, and dates on every history entry", () => {
    for (const bank of getAllBanks()) {
      for (const f of formatsOf(bank)) {
        expect(["verified", "inferred"], `${bank.id}/${f.id}`).toContain(f.confidence);
        expect(f.evidence.length, `${bank.id}/${f.id}`).toBeGreaterThan(10);
        if (f.replacedBy) expect(formatsOf(bank).some((g) => g.id === f.replacedBy), `${bank.id}/${f.id}`).toBe(true);
      }
      for (const h of bank.endpointHistory ?? []) {
        expect(h.date, bank.id).toMatch(/^\d{4}-\d{2}(-\d{2})?$/);
        expect(formatsOf(bank).some((f) => f.id === h.formatId), `${bank.id} history ${h.formatId}`).toBe(true);
      }
    }
  });

  it("never marks a format verified when its evidence comes only from links.et", () => {
    for (const bank of getAllBanks()) {
      for (const f of formatsOf(bank)) {
        if (/links\.et/.test(f.evidence) && !/cheki/.test(f.evidence)) expect(f.confidence, `${bank.id}/${f.id}`).toBe("inferred");
      }
    }
    for (const id of ["siinqee", "mpesa"]) {
      for (const f of formatsOf(getBank(id))) expect(f.confidence, `${id}/${f.id}`).toBe("inferred");
    }
  });

  it("CBE Birr is verified with dated evidence from real receipts, and labelled beta", () => {
    const bank = getBank("cbebirr");
    expect(bank?.status).toBe("live");
    expect(bank?.beta).toBe(true);
    const [f] = formatsOf(bank);
    expect(f.confidence).toBe("verified");
    expect(f.evidence).toMatch(/^Verified 2026-10-16 against 2 real receipts/);
    expect(bank?.endpointHistory?.at(-1)?.date).toBe("2026-10-16");
  });
});

describe("current format selected first", () => {
  it("leads with a current format for every bank that has a supported current one", () => {
    for (const bank of getAllBanks()) {
      const usable = supportedFormats(bank);
      if (usable.some((f) => f.status === "current")) expect(primaryFormat(bank)?.status, bank.id).toBe("current");
    }
  });

  it("picks the current format first for each bank with more than one format", () => {
    const multi = getAllBanks().filter((b) => formatsOf(b).length > 1);
    expect(multi.map((b) => b.id)).toEqual(expect.arrayContaining(["cbe", "dashen"]));
    for (const bank of multi) {
      const primary = primaryFormat(bank);
      if (!primary) continue;
      const example = primary.inputs.find((i) => i.example)?.example;
      if (!example) continue;
      // The example is a link for CBE; the reference is its last path segment.
      const ref = /^https:\/\//.test(example) ? new URL(example).pathname.split("/").filter(Boolean).pop()! : example;
      // CBE Birr's receipt link needs the payer phone as well.
      const sel = selectFormat(bank, { reference: ref, ...(formatNeeds(primary, "phone") ? { phoneNumber: "0911004321" } : {}) });
      expect(sel.ok, bank.id).toBe(true);
      if (sel.ok) expect(sel.format?.id, bank.id).toBe(primary.id);
    }
  });

  it("CBE: a Receipt ID is the current format, FT + account the legacy one, FT alone asks for the account", () => {
    const cbe = getBank("cbe");
    expect(primaryFormat(cbe)?.id).toBe("cbe-receipt-id");
    for (const token of ["fHCxyV4mg5pRIwEkJO", "v2-hfHCxExample0001"]) {
      const sel = selectFormat(cbe, { reference: token });
      expect(sel.ok && sel.format?.id, token).toBe("cbe-receipt-id");
    }
    const legacy = selectFormat(cbe, { reference: "FT26140P01YB", accountNumber: "1000560536171" });
    expect(legacy.ok && legacy.format?.id).toBe("cbe-ft-pdf");
    expect(legacy.ok && legacy.format?.status).toBe("legacy");
    const missing = selectFormat(cbe, { reference: "FT26140P01YB" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.field).toBe("accountNumber");
      expect(missing.message).toMatch(/Receipt ID/);
    }
  });

  it("Dashen: the deprecated Super App format is never selected", () => {
    const dashen = getBank("dashen");
    expect(primaryFormat(dashen)?.id).toBe("dashen-receipts-html");
    expect(supportedFormats(dashen).some((f) => f.status === "deprecated")).toBe(false);
    const sel = selectFormat(dashen, { reference: "B22WDTI2619100WH" });
    expect(sel.ok && sel.format?.id).toBe("dashen-receipts-html");
  });
});

describe("gate: CBE Receipt ID is an opaque token", () => {
  const receipt = {
    verified: true,
    amount: 20000,
    senderName: "Test Payer",
    receiverName: "Test Receiver",
  };

  it("passes a cbe-new receipt whose returned reference is the FT id, not the Receipt ID", () => {
    expect(verificationGate({ ...receipt, reference: "FT26140P01YB" }, { bankId: "cbe-new", requestedReference: "fHCxyV4mg5pRIwEkJO" })).toEqual({ ok: true });
  });

  it("still fails a mismatched reference for a non-opaque bank (legacy CBE FT, Dashen)", () => {
    expect(verificationGate({ ...receipt, reference: "FT00000XXXXX" }, { bankId: "cbe", requestedReference: "FT26140P01YB" })).toMatchObject({ ok: false, reason: "reference" });
    expect(verificationGate({ ...receipt, reference: "B22WDTI0000000XX" }, { bankId: "dashen", requestedReference: "B22WDTI2619100WH" })).toMatchObject({ ok: false, reason: "reference" });
  });

  it("the opaque-token exemption does not relax the other checks for cbe-new", () => {
    expect(verificationGate({ ...receipt, amount: 0, reference: "FT26140P01YB" }, { bankId: "cbe-new", requestedReference: "tok123456789" })).toMatchObject({ ok: false, reason: "amount" });
    expect(verificationGate({ verified: true, amount: 5, reference: "FT26140P01YB" }, { bankId: "cbe-new", requestedReference: "tok123456789" })).toMatchObject({ ok: false, reason: "party" });
  });

  it("end to end: bank=cbe with a Receipt ID verifies when CBE returns the FT id", async () => {
    const token = uniq("fHCxGate");
    const fetchMock = vi.fn<(url: string | URL) => Promise<Response>>(async () =>
      new Response(
        JSON.stringify({
          id: "FT26140P01YB",
          debitAccountHolder: "Test Payer",
          creditAccountHolder: "Test Receiver",
          debitAccountNo: "1****1685",
          creditAccountNo: "1****6171",
          amountCredited: "20000.00",
          creditCurrency: "ETB",
          dateTimes: ["2026-05-20T19:29:00"],
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "cbe", reference: token });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).host).toBe("mb.cbe.com.et");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.verified).toBe(true);
      expect(r.value.amount).toBe(20000);
    }
  });
});

describe("legacy CBE (FT + 8-digit account) still verifies", () => {
  const PDF_TEXT = `Commercial Bank of Ethiopia
Payment / Transaction Information
Payer Mr Test Payer
Account 1****1685
Receiver TEST RECEIVER
Account 1****6171
Transferred Amount 20,000.00 ETB
Payment Date & Time 5/20/2026, 7:29:00 PM
Reference No. (VAT Invoice No) FT26140P01YB
Reason / Type of service screen done via Mobile`;

  it("fetches the legacy PDF host once and verifies the stubbed PDF fixture", async () => {
    const fetchMock = vi.fn<(url: string | URL) => Promise<Response>>(async () =>
      new Response("%PDF-1.4 cbe legacy fixture", { status: 200, headers: { "content-type": "application/pdf" } })
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(CBEParser, "extractPdfText").mockResolvedValue(PDF_TEXT);
    const r = await new Verifier().verify({ bank: "cbe", reference: "FT26140P01YB", accountNumber: "1000560536171" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://apps.cbe.com.et:100/?id=FT26140P01YB60536171");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.verified).toBe(true);
      expect(r.value.amount).toBe(20000);
      expect(r.value.reference).toBe("FT26140P01YB");
    }
  });

  it("the legacy path still runs the gate: a PDF for another FT reference is rejected", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF-1.4 x", { status: 200 })));
    vi.spyOn(CBEParser, "extractPdfText").mockResolvedValue(PDF_TEXT.replace("FT26140P01YB", "FT26999ZZZZZ"));
    const r = await new Verifier().verify({ bank: "cbe", reference: "FT26140P01YC", accountNumber: "1000560536171" });
    expect(r.ok && r.value.verified).toBeFalsy();
  });

  it("asks for the account (no bank request) when an FT reference comes alone", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await new Verifier().verify({ bank: "cbe", reference: "FT26140P01YD" });
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("allowlist derived from the formats", () => {
  it("covers every current and legacy (not deprecated) format host", () => {
    const hosts = allowedHosts();
    for (const bank of getAllBanks()) {
      for (const f of supportedFormats(bank)) {
        const h = templateHost(f.endpoint);
        if (h) expect(hosts.has(h), `${bank.id}/${f.id} ${h}`).toBe(true);
      }
    }
    expect(hosts.has("mb.cbe.com.et")).toBe(true); // CBE current
    expect(hosts.has("apps.cbe.com.et:100")).toBe(true); // CBE legacy, still tried
    expect(hosts.has("receipt.ebirr.com")).toBe(true); // eBirr tenants
    expect(isAllowedUrl("https://mb.cbe.com.et/api/v1/transactions/public/transaction-detail/x")).toBe(true);
    expect(isAllowedUrl("https://apps.cbe.com.et:100/?id=FT26140P01YB60536171")).toBe(true);
  });

  it("excludes deprecated and parser-less format hosts, and look-alikes", () => {
    const hosts = allowedHosts();
    const supported = new Set(getAllBanks().flatMap((b) => [templateHost(b.endpoint), ...supportedFormats(b).map((f) => templateHost(f.endpoint))]));
    for (const bank of getAllBanks()) {
      for (const f of formatsOf(bank)) {
        if (f.parser && f.status !== "deprecated") continue;
        const h = templateHost(f.endpoint);
        if (h && !supported.has(h)) expect(hosts.has(h), `${bank.id}/${f.id} ${h}`).toBe(false);
      }
    }
    expect(isAllowedUrl("https://receipt.dashensuperapp.com/receipt/x")).toBe(false);
    expect(isAllowedUrl("https://api.dashensuperapp.com/receipts/x.pdf")).toBe(false);
    expect(isAllowedUrl("https://receipts.siinqeebank.com:871/x")).toBe(false); // inferred, unsupported
    expect(isAllowedUrl("https://mb.cbe.com.et.evil.example/x")).toBe(false);
    expect(isAllowedUrl("https://apps.cbe.com.et/?id=x")).toBe(false); // wrong port
    expect(isAllowedUrl("http://mb.cbe.com.et/x")).toBe(false);
  });
});

describe("GET /api/receipt", () => {
  it("302s only to the manifest host, filled with the validated reference", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    for (const [bank, ref, host] of [
      ["cbe", "fHCxyV4mg5pRIwEkJO", "mbreciept.cbe.com.et"],
      ["dashen", "B22WDTI2619100WH", "receipts.dashenbanksc.com"],
    ] as const) {
      const r = await receiptGET(new NextRequest(`https://cheki.et/api/receipt?bank=${bank}&reference=${ref}`, { headers: freshIp() }));
      expect(r.status, bank).toBe(302);
      const loc = new URL(r.headers.get("location")!);
      expect(loc.protocol).toBe("https:");
      expect(loc.host, bank).toBe(host);
      expect(loc.pathname.endsWith("/" + ref), bank).toBe(true);
      expect(r.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is not an open redirect: crafted references never move the Location off the manifest host", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const evil = [
      "https://evil.example/x",
      "//evil.example/x",
      "@evil.example",
      "..%2F..%2Fevil",
      "fHCx/../../evil.example",
      "fHCx%0d%0aLocation:%20https://evil.example",
      "\\\\evil.example\\x",
    ];
    for (const bank of ["cbe", "dashen"]) {
      for (const ref of evil) {
        const r = await receiptGET(new NextRequest(`https://cheki.et/api/receipt?bank=${bank}&reference=${encodeURIComponent(ref)}`, { headers: freshIp() }));
        if (r.status === 302) {
          expect(new URL(r.headers.get("location")!).host, `${bank} ${ref}`).toBe(bank === "cbe" ? "mbreciept.cbe.com.et" : "receipts.dashenbanksc.com");
        } else {
          expect(r.status, `${bank} ${ref}`).toBe(400);
          expect(r.headers.get("location")).toBeNull();
        }
      }
    }
  });

  it("answers 502 (never the body) when a PDF format returns something that is not a PDF", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><script>alert(1)</script></html>", { status: 200, headers: { "content-type": "application/pdf" } })));
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=cbe&reference=FT26140P01YB&account=1000560536171", { headers: freshIp() }));
    expect(r.status).toBe(502);
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    expect(await r.text()).not.toContain("<script>");
  });

  it("serves a real PDF as an inert attachment", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("%PDF-1.4 legacy", { status: 200, headers: { "content-type": "text/html" } })));
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=cbe&reference=FT26140P01YB&account=1000560536171", { headers: freshIp() }));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/pdf");
    expect(r.headers.get("content-disposition")).toBe('attachment; filename="cbe-receipt.pdf"');
    expect(r.headers.get("content-security-policy")).toBe("sandbox; default-src 'none'");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(r.headers.get("cache-control")).toBe("private, no-store");
  });

  it("refuses an FT reference without the account (400, no bank request)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await receiptGET(new NextRequest("https://cheki.et/api/receipt?bank=cbe&reference=FT26140P01YB", { headers: freshIp() }));
    expect(r.status).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
