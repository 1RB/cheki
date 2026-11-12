/**
 * Wegagen Bank: share links, the 24-character share id, Wegagen's own account
 * masking, the JSON record (Addis time, the prefix-checked opaque token), and
 * the verify / health paths around them. All data is synthetic
 * (tests/fixtures/wegagen/records.ts).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { detectBankFromUrl } from "@/lib/adapters/url-detector";
import { WegagenParser, checkWegagenId, maskAccount, WEGAGEN_NOT_FOUND } from "@/lib/parsers/wegagen";
import { getParser } from "@/lib/parsers/registry";
import { Verifier } from "@/lib";
import { isAllowedUrl } from "@/lib/security/hosts";
import { verificationGate } from "@/lib/core/gate";
import { buildProbeTargets, evaluate, matchExpectation } from "@/lib/health";
import { detectInput } from "@/lib/verify/detect";
import { getBank } from "@/lib/manifest/loader";
import { primaryFormat, selectFormat, supportedFormats } from "@/lib/manifest/formats";
import { POST as verifyPOST } from "@/app/api/verify/route";
import "@/lib/parsers";
import {
  SYNTH_WEGAGEN_BODY,
  SYNTH_WEGAGEN_ID,
  SYNTH_WEGAGEN_ID_2,
  SYNTH_WEGAGEN_LINK,
  SYNTH_WEGAGEN_NOT_FOUND,
  SYNTH_WEGAGEN_OTHER_ID,
  SYNTH_WEGAGEN_RECEIVER_ACCOUNT,
  SYNTH_WEGAGEN_RECEIVER_MASKED,
  SYNTH_WEGAGEN_REF,
  SYNTH_WEGAGEN_SENDER_ACCOUNT,
  SYNTH_WEGAGEN_SENDER_MASKED,
  synthId,
  synthRef,
  wegagenRecord,
} from "../fixtures/wegagen/records";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const API = `https://transinfo.wegagenbanksc.com.et:8011/sms_wega/txn/`;

let ipCounter = 0;
function freshIp(): Record<string, string> {
  ipCounter++;
  return { "x-forwarded-for": `10.62.${Math.floor(ipCounter / 250)}.${ipCounter % 250}` };
}

/** fetch stub answering every request with `body`, recording URL + headers. */
function stubFetch(body: string, status = 200, contentType = "application/json") {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url: String(url), headers: { ...(init?.headers as Record<string, string>) } });
      return new Response(body, { status, headers: { "content-type": contentType } });
    })
  );
  return calls;
}

describe("detectBankFromUrl: Wegagen share links", () => {
  it("reads the 24-character share id and only it", () => {
    expect(detectBankFromUrl(SYNTH_WEGAGEN_LINK)).toEqual({ bank: "wegagen", reference: SYNTH_WEGAGEN_ID });
    // The QR prose's link and a pasted link with extra query params still count.
    expect(detectBankFromUrl(`${SYNTH_WEGAGEN_LINK}&lang=en`)).toEqual({ bank: "wegagen", reference: SYNTH_WEGAGEN_ID });
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et:8183/?id=${SYNTH_WEGAGEN_ID}#top`)).toEqual({
      bank: "wegagen",
      reference: SYNTH_WEGAGEN_ID,
    });
  });

  it("uppercases a lower-case id: only capitals answer with the full record", () => {
    const lower = SYNTH_WEGAGEN_ID.toLowerCase();
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et:8183/?id=${lower}`)).toEqual({
      bank: "wegagen",
      reference: SYNTH_WEGAGEN_ID,
    });
  });

  it("accepts the share page on any port, and on a link with no port", () => {
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et/?id=${SYNTH_WEGAGEN_ID}`)?.bank).toBe("wegagen");
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et:8443/?id=${SYNTH_WEGAGEN_ID}`)?.bank).toBe("wegagen");
  });

  it("only recognises exactly transinfo.wegagenbanksc.com.et with a well-formed id", () => {
    const id = SYNTH_WEGAGEN_ID;
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et.evil.example/?id=${id}`)).toBeNull();
    expect(detectBankFromUrl(`https://x.transinfo.wegagenbanksc.com.et/?id=${id}`)).toBeNull();
    expect(detectBankFromUrl(`https://transinfo-wegagenbanksc.com.et/?id=${id}`)).toBeNull();
    expect(detectBankFromUrl(`https://wegagenbanksc.com.et/?id=${id}`)).toBeNull();
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et/?ref=${id}`)).toBeNull();
    // The printed 16-character Reference No, and anything else that is not a share id.
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et:8183/?id=${SYNTH_WEGAGEN_REF}`)).toBeNull();
    expect(detectBankFromUrl(`https://transinfo.wegagenbanksc.com.et:8183/?id=abc`)).toBeNull();
    expect(detectBankFromUrl("https://transinfo.wegagenbanksc.com.et:8183/")).toBeNull();
    // A bare reference is not a link at all: it goes to reference detection.
    expect(detectBankFromUrl(SYNTH_WEGAGEN_REF)).toBeNull();
    expect(detectBankFromUrl(SYNTH_WEGAGEN_ID)).toBeNull();
  });
});

describe("Wegagen share id", () => {
  it("accepts exactly 24 letters and digits, in capitals", () => {
    expect(checkWegagenId(` ${SYNTH_WEGAGEN_ID} `)).toEqual({ ok: true, value: SYNTH_WEGAGEN_ID });
    expect(checkWegagenId(SYNTH_WEGAGEN_ID.toLowerCase())).toEqual({ ok: true, value: SYNTH_WEGAGEN_ID });
    for (const bad of [
      "",
      SYNTH_WEGAGEN_REF, // the printed 16-character Reference No
      SYNTH_WEGAGEN_ID.slice(0, 23),
      `${SYNTH_WEGAGEN_ID}1`,
      `${SYNTH_WEGAGEN_ID.slice(0, 20)}____`,
      "000SAMP2600000000000000/../../x",
      "000SAMP2600000000000000 id",
      null,
      42,
    ]) {
      expect(checkWegagenId(bad as unknown), String(bad)).toMatchObject({ ok: false });
    }
  });

  it("points the user at the share link when only the printed reference is given", () => {
    const bad = checkWegagenId(SYNTH_WEGAGEN_REF);
    expect(bad.ok).toBe(false);
    if (bad.ok) return;
    expect(bad.message).toContain("?id=");
    expect(bad.message).toContain("not the 16-character Reference No");
  });

  it("builds the transaction URL on the fixed host, uppercase, never the share page", () => {
    const p = getParser("wegagen")!;
    expect(p.buildUrl(SYNTH_WEGAGEN_ID.toLowerCase())).toBe(`${API}${SYNTH_WEGAGEN_ID}`);
    expect(() => p.buildUrl(SYNTH_WEGAGEN_REF)).toThrow(/\?id=/);
    expect(() => p.buildUrl("../x")).toThrow();
    // The API host is allowlisted for fetching; the share page is only linked.
    expect(isAllowedUrl(`${API}${SYNTH_WEGAGEN_ID}`)).toBe(true);
    expect(isAllowedUrl(SYNTH_WEGAGEN_LINK)).toBe(false);
    expect(isAllowedUrl(`${API}${SYNTH_WEGAGEN_ID}`.replace("https://", "http://"))).toBe(false);
  });
});

describe("maskAccount: Wegagen's own rule", () => {
  it("keeps the first digit and last 7 of a 13-digit account", () => {
    expect(maskAccount(SYNTH_WEGAGEN_SENDER_ACCOUNT)).toBe(SYNTH_WEGAGEN_SENDER_MASKED);
  });

  it("keeps the first 4 and last 2 of a 12-character account", () => {
    expect(maskAccount(SYNTH_WEGAGEN_RECEIVER_ACCOUNT)).toBe(SYNTH_WEGAGEN_RECEIVER_MASKED);
  });

  it("keeps the first 2 and last 2 of a 10-character account", () => {
    expect(maskAccount("1234567890")).toBe("12*****90");
  });

  it("leaves other lengths as they came: that is the bank's rule, not a choice", () => {
    expect(maskAccount("1234567")).toBe("1234567");
    expect(maskAccount("12345678901234")).toBe("12345678901234");
    expect(maskAccount("")).toBe("");
    expect(maskAccount(null)).toBe("");
  });
});

describe("WegagenParser.parseRecord", () => {
  it("maps payer, receiver, amount, date, type and reference", () => {
    const { parsed, notFound } = WegagenParser.parseRecord(SYNTH_WEGAGEN_BODY, SYNTH_WEGAGEN_ID);
    expect(notFound).toBe(false);
    expect(parsed).toMatchObject({
      verified: true,
      senderName: "TEST PAYER",
      senderAccount: SYNTH_WEGAGEN_SENDER_MASKED,
      receiverName: "TEST RECEIVER",
      receiverAccount: SYNTH_WEGAGEN_RECEIVER_MASKED,
      amount: 1250,
      currency: "ETB",
      // trnDt is 21:00 UTC on the 6th: 00:00 on the 7th in Addis (UTC+3).
      date: "2026-07-07",
      reference: SYNTH_WEGAGEN_REF,
      transactionType: "Account To Account Transfer",
    });
    // messageStatus is the SMS state, never the transaction's.
    expect("transactionStatus" in parsed).toBe(false);
    expect(verificationGate(parsed, { bankId: "wegagen", requestedReference: SYNTH_WEGAGEN_ID })).toEqual({ ok: true });
  });

  it("keeps every account masked, raw included, and no name or phone in raw", () => {
    const { parsed } = WegagenParser.parseRecord(SYNTH_WEGAGEN_BODY, SYNTH_WEGAGEN_ID);
    const raw = parsed.raw as string;
    expect(raw).not.toContain(SYNTH_WEGAGEN_SENDER_ACCOUNT);
    expect(raw).not.toContain("TEST PAYER");
    expect(raw).not.toContain("TEST RECEIVER");
    expect(raw).not.toContain("0911000000");
    // charge and vat have no ParsedReceipt field that means "only a fee", so they stay in raw.
    expect(raw).toContain('"charge":"15.00"');
    expect(raw).toContain('"vat":"0.75"');
  });

  it("accepts the share id in any case: the prefix check ignores case", () => {
    const { parsed } = WegagenParser.parseRecord(SYNTH_WEGAGEN_BODY, SYNTH_WEGAGEN_ID.toLowerCase());
    expect(parsed.verified).toBe(true);
  });

  it("refuses a record whose reference is not a prefix of the requested share id", () => {
    const { parsed, notFound } = WegagenParser.parseRecord(SYNTH_WEGAGEN_BODY, SYNTH_WEGAGEN_OTHER_ID);
    expect(notFound).toBe(false);
    expect(parsed.verified).toBe(false);
    // The gate cannot catch this (the two never compare equal), which is why
    // the share id is an opaque token there and the prefix is checked here.
    expect(
      verificationGate({ ...parsed, verified: true, amount: 1250, senderName: "X", receiverName: "Y" }, { bankId: "wegagen", requestedReference: SYNTH_WEGAGEN_OTHER_ID })
    ).toEqual({ ok: true });
  });

  it("reads the not-found body, plain and quoted", () => {
    for (const body of [SYNTH_WEGAGEN_NOT_FOUND, `"${SYNTH_WEGAGEN_NOT_FOUND}"`, `${SYNTH_WEGAGEN_NOT_FOUND}\n`]) {
      expect(WegagenParser.parseRecord(body, SYNTH_WEGAGEN_ID)).toEqual({ parsed: { verified: false }, notFound: true });
    }
  });

  it("any other unreadable body is unconfirmed, never a receipt and never fake", () => {
    for (const body of ["<html>502</html>", "null", "[]", JSON.stringify({ message: "busy" }), JSON.stringify([wegagenRecord("SAMPLE1")])]) {
      const { parsed, notFound } = WegagenParser.parseRecord(body, SYNTH_WEGAGEN_ID);
      expect(parsed.verified, body).toBe(false);
      expect(notFound, body).toBe(false);
    }
  });

  it("an account the record says is not required is left out, not masked", () => {
    const { parsed } = WegagenParser.parseRecord(
      JSON.stringify(wegagenRecord("SAMPLE1", { receiver_account: "Not_required", receiver_name: "---" })),
      SYNTH_WEGAGEN_ID
    );
    expect(parsed.verified).toBe(true);
    expect("receiverAccount" in parsed).toBe(false);
    expect("receiverName" in parsed).toBe(false);
  });

  it("a zero amount parses but fails the gate", () => {
    const { parsed } = WegagenParser.parseRecord(JSON.stringify(wegagenRecord("SAMPLE1", { txnAmount: 0 })), SYNTH_WEGAGEN_ID);
    expect(parsed.verified).toBe(true);
    expect(verificationGate(parsed, { bankId: "wegagen", requestedReference: SYNTH_WEGAGEN_ID })).toMatchObject({ ok: false, reason: "amount" });
  });
});

describe("manifest: Wegagen formats", () => {
  const wegagen = getBank("wegagen")!;

  it("is live and in beta, with the share link as its current format", () => {
    expect(wegagen.status).toBe("live");
    expect(wegagen.beta).toBe(true);
    expect(supportedFormats(wegagen).map((f) => f.id)).toEqual(["wegagen-share-link"]);
    expect(primaryFormat(wegagen)?.id).toBe("wegagen-share-link");
    // No account and no phone: the share id alone is the lookup key.
    expect(primaryFormat(wegagen)?.inputs.map((i) => i.name)).toEqual(["reference"]);
    expect(wegagen.requiresAccount).toBe(false);
    expect(wegagen.requiresPhone).toBe(false);
  });

  it("picks the share-link format from the shape of a bare share id", () => {
    expect(selectFormat(wegagen, { reference: SYNTH_WEGAGEN_ID })).toMatchObject({ ok: true, format: { id: "wegagen-share-link" } });
    // Format choice never blocks an input: with one fetchable format anything
    // else falls back to it, and the id itself is checked before any request.
    expect(selectFormat(wegagen, { reference: SYNTH_WEGAGEN_REF })).toMatchObject({ ok: true, format: { id: "wegagen-share-link" } });
  });
});

describe("Verifier: Wegagen", () => {
  const v = new Verifier();

  it("a share link verifies; sourceUrl and checkedUrl are the public share page", async () => {
    const calls = stubFetch(SYNTH_WEGAGEN_BODY);
    const r = await v.verify({ bank: "", reference: SYNTH_WEGAGEN_LINK });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(calls.map((c) => c.url)).toEqual([`${API}${SYNTH_WEGAGEN_ID}`]);
    // cheki asks for JSON, and sends no cookie or credential.
    expect(calls[0].headers["Accept"]).toBe("application/json");
    expect(r.value).toMatchObject({
      verified: true,
      bankCode: "wegagen",
      reference: SYNTH_WEGAGEN_REF,
      sourceUrl: SYNTH_WEGAGEN_LINK,
      amount: 1250,
      date: "2026-07-07",
      senderAccount: SYNTH_WEGAGEN_SENDER_MASKED,
    });
    // The opaque share id is never echoed as the receipt's reference.
    expect(r.value.reference).not.toBe(SYNTH_WEGAGEN_ID);
    expect("raw" in r.value).toBe(false);
  });

  it("a bare share id verifies exactly like the link", async () => {
    const calls = stubFetch(JSON.stringify(wegagenRecord("SAMPLE2")));
    const r = await v.verify({ bank: "wegagen", reference: SYNTH_WEGAGEN_ID_2 });
    expect(calls.map((c) => c.url)).toEqual([`${API}${SYNTH_WEGAGEN_ID_2}`]);
    expect(r.ok && r.value.verified).toBe(true);
    if (r.ok) expect(r.value.reference).toBe(synthRef("SAMPLE2"));
  });

  it("an unknown share id is HTTP 200 with the not-found body, and says so", async () => {
    const missing = synthId("MISSING1");
    // cheki sends Accept: application/json, so the body arrives with a JSON
    // content type and is still not JSON.
    stubFetch(SYNTH_WEGAGEN_NOT_FOUND, 200, "application/json");
    const r = await v.verify({ bank: "wegagen", reference: missing });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe("EXTRACTION_ERROR");
    if (r.error.kind === "EXTRACTION_ERROR") {
      expect(r.error.message).toMatch(/no transaction with this share id/);
      expect(r.error.message).toMatch(/\?id=/);
    }
    if ("checkedUrl" in r.error) expect(r.error.checkedUrl).toBe(`https://transinfo.wegagenbanksc.com.et:8183/?id=${missing}`);
  });

  it("an unreadable answer is could not read, never the bank saying no", async () => {
    stubFetch("<html>gateway</html>", 200, "text/html");
    const r = await v.verify({ bank: "wegagen", reference: synthId("UNREAD1") });
    expect(r.ok).toBe(false);
    if (!r.ok && r.error.kind === "EXTRACTION_ERROR") {
      expect(r.error.message).toMatch(/Could not read the Wegagen Bank receipt/);
      expect(r.error.message).not.toMatch(/no transaction/);
    }
  });

  it("the printed 16-character Reference No is refused before any request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const r = await v.verify({ bank: "wegagen", reference: SYNTH_WEGAGEN_REF });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("REF_ERROR");
      if (r.error.kind === "REF_ERROR") expect(r.error.message).toContain("24 letters and digits after ?id=");
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retries once when the service fails: it answers intermittently", async () => {
    const calls: string[] = [];
    let first = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(String(url));
        if (first) {
          first = false;
          return new Response("upstream timeout", { status: 500, headers: { "content-type": "text/plain" } });
        }
        return new Response(SYNTH_WEGAGEN_BODY, { status: 200, headers: { "content-type": "application/json" } });
      })
    );
    const r = await v.verify({ bank: "wegagen", reference: SYNTH_WEGAGEN_ID });
    expect(calls).toHaveLength(2);
    expect(r.ok && r.value.verified).toBe(true);
  });
});

describe("UI detection: Wegagen", () => {
  it("a share link is detected as Wegagen, beta, with no extra fields", () => {
    const d = detectInput(SYNTH_WEGAGEN_LINK);
    expect(d).toMatchObject({ kind: "url", value: SYNTH_WEGAGEN_LINK, urlReference: SYNTH_WEGAGEN_ID, needsAccount: false, needsPhone: false, beta: true });
    expect(d.bank?.code).toBe("wegagen");
    expect(d.format?.id).toBe("wegagen-share-link");
    expect(d.browserFirst).toBe(false);
  });

  it("a bare share id resolves to Wegagen and its share-link format", () => {
    const d = detectInput(SYNTH_WEGAGEN_ID);
    expect(d.kind).toBe("reference");
    expect(d.bank?.code).toBe("wegagen");
    expect(d.value).toBe(SYNTH_WEGAGEN_ID);
    expect(d.format?.id).toBe("wegagen-share-link");
    expect(d.needsAccount).toBe(false);
    expect(d.needsPhone).toBe(false);
  });

  it("the printed reference does not claim the bank: it is not a lookup key", () => {
    const d = detectInput(SYNTH_WEGAGEN_REF);
    expect(d.kind).toBe("reference");
    expect(d.bank?.code).not.toBe("wegagen");
  });
});

describe("routes: Wegagen", () => {
  it("POST /api/verify: a share link verifies against Wegagen's record", async () => {
    stubFetch(SYNTH_WEGAGEN_BODY);
    const res = await verifyPOST(
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ reference: SYNTH_WEGAGEN_LINK }),
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ success: true, verified: true, bankCode: "wegagen", reference: SYNTH_WEGAGEN_REF, sourceUrl: SYNTH_WEGAGEN_LINK });
    // The receipt's own reference is what comes back, never the opaque share id.
    expect(body.reference).not.toBe(SYNTH_WEGAGEN_ID);
  });

  it("POST /api/verify: an unknown share id is 422, not 400 and never verified", async () => {
    stubFetch(SYNTH_WEGAGEN_NOT_FOUND, 200, "application/json");
    const res = await verifyPOST(
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ bank: "wegagen", reference: synthId("NOPE0001") }),
      })
    );
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.verified).toBeUndefined();
  });
});

describe("health probe: Wegagen", () => {
  it("probes a 24-character id with the parser's headers and the not-found body", () => {
    expect(SYNTH_WEGAGEN_NOT_FOUND).toBe(WEGAGEN_NOT_FOUND);
    const t = buildProbeTargets({ checkGeoRestricted: false }).find((x) => x.id === "wegagen")!;
    expect(t.skip).toBeUndefined();
    expect(t.url).toBe(`${API}CHEKIPROBE00000000000000`);
    expect(t.url!.split("/").at(-1)).toHaveLength(24);
    expect(t.headers?.["Accept"]).toBe("application/json");
    const good = { status: 200, contentType: "application/json", body: SYNTH_WEGAGEN_NOT_FOUND };
    expect(matchExpectation(good, t.probe!.expect)).toEqual([]);
    expect(evaluate(t, { response: good }, "x").status).toBe("live");
    // A receipt body where the not-found sentence should be: the shape changed.
    expect(matchExpectation({ ...good, body: SYNTH_WEGAGEN_BODY }, t.probe!.expect)).not.toEqual([]);
    expect(evaluate(t, { response: { ...good, body: SYNTH_WEGAGEN_BODY } }, "x").status).toBe("degraded");
    expect(evaluate(t, { error: "timeout" }, "x").status).toBe("degraded");
  });
});
