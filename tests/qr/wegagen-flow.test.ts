/**
 * A Wegagen receipt QR only supplies the share id inside its prose. Everywhere
 * it enters (detection, verifier, API) it must behave exactly like the pasted
 * share link, the names and accounts in the same text must never be used, and
 * the QR alone must never produce a verified result. Payloads are synthetic
 * (tests/fixtures/wegagen/records.ts).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { detectInput } from "@/lib/verify/detect";
import { WEGAGEN_SHARE_URL, WEGAGEN_NOT_FOUND } from "@/lib/parsers/wegagen";
import { parseWegagenQr, isWegagenQrPayload, WEGAGEN_QR_MAX_INPUT } from "@/lib/qr/wegagen";
import { getBank } from "@/lib/manifest/loader";
import { inputOnlyFormats, isInputOnlyFormat, primaryFormat, selectFormat, supportedFormats } from "@/lib/manifest/formats";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { SYNTH_WEGAGEN_ID, SYNTH_WEGAGEN_LINK, SYNTH_WEGAGEN_QR, synthId, synthRef, wegagenRecord } from "../fixtures/wegagen/records";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const API = `https://transinfo.wegagenbanksc.com.et:8011/sms_wega/txn/`;

const json = (body: unknown) => new Response(typeof body === "string" ? body : JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

let ip = 0;
const req = (url: string, body: unknown) =>
  new NextRequest(`https://cheki.et${url}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.63.${Math.floor(++ip / 250)}.${ip % 250}` },
    body: JSON.stringify(body),
  });

/** Every URL that was fetched, as strings. */
const fetched = (fetchMock: { mock: { calls: unknown[][] } }) => fetchMock.mock.calls.map((c) => String(c[0]));

describe("parseWegagenQr", () => {
  it("reads exactly one share id out of the prose", () => {
    expect(parseWegagenQr(SYNTH_WEGAGEN_QR)).toEqual({ ok: true, shareId: SYNTH_WEGAGEN_ID });
    expect(isWegagenQrPayload(SYNTH_WEGAGEN_QR)).toBe(true);
    // Whitespace and a greeting around it change nothing.
    expect(parseWegagenQr(`  \n${SYNTH_WEGAGEN_QR}\n `).ok).toBe(true);
  });

  it("uppercases the id: only capitals answer with the full record", () => {
    expect(parseWegagenQr(SYNTH_WEGAGEN_QR.toLowerCase())).toEqual({ ok: true, shareId: SYNTH_WEGAGEN_ID });
  });

  it("accepts the link on any port, with or without one", () => {
    for (const link of [`${WEGAGEN_SHARE_URL}${SYNTH_WEGAGEN_ID}`, `https://transinfo.wegagenbanksc.com.et:8183/?id=${SYNTH_WEGAGEN_ID}`]) {
      expect(parseWegagenQr(`Click here: ${link} - Wegagen Bank.`), link).toEqual({ ok: true, shareId: SYNTH_WEGAGEN_ID });
    }
  });

  it("rejects anything that is not one well-formed share link", () => {
    for (const bad of ["", "   ", "no link here", `https://transinfo.wegagenbanksc.com.et:8183/?id=`, `?id=${SYNTH_WEGAGEN_ID}`]) {
      expect(parseWegagenQr(bad).ok, JSON.stringify(bad)).toBe(false);
    }
    // Wrong host, wrong id length, wrong charset.
    expect(parseWegagenQr(`https://evil.example/?id=${SYNTH_WEGAGEN_ID}`).ok).toBe(false);
    expect(parseWegagenQr(`https://transinfo.wegagenbanksc.com.et.evil/?id=${SYNTH_WEGAGEN_ID}`).ok).toBe(false);
    expect(parseWegagenQr(`${WEGAGEN_SHARE_URL}${SYNTH_WEGAGEN_ID.slice(0, 23)}`).ok).toBe(false);
    expect(parseWegagenQr(`${WEGAGEN_SHARE_URL}${SYNTH_WEGAGEN_ID}1`).ok).toBe(false);
    expect(parseWegagenQr(`${WEGAGEN_SHARE_URL}000SAMP26000000000000__/`).ok).toBe(false);
  });

  it("never throws on non-text input, and caps the size before any regex", () => {
    for (const bad of [null, undefined, 42, {}, Buffer.alloc(8)]) {
      expect(parseWegagenQr(bad), String(bad)).toEqual({ ok: false, reason: "notText" });
    }
    expect(parseWegagenQr(`x${"a".repeat(WEGAGEN_QR_MAX_INPUT)}`)).toEqual({ ok: false, reason: "tooLong" });
    expect(parseWegagenQr(`x${"a".repeat(WEGAGEN_QR_MAX_INPUT * 4 + 1)}`)).toEqual({ ok: false, reason: "tooLong" });
    // The real QR text is about 400 characters: far below the cap.
    expect(SYNTH_WEGAGEN_QR.length).toBeLessThan(WEGAGEN_QR_MAX_INPUT);
  });
});

describe("detectInput: the Wegagen receipt QR", () => {
  it("becomes the share id, Wegagen, ready to check", () => {
    const d = detectInput(SYNTH_WEGAGEN_QR);
    expect(d.kind).toBe("wegagenQr");
    expect(d.value).toBe(SYNTH_WEGAGEN_ID);
    expect(d.bank?.code).toBe("wegagen");
    expect(d.candidates.map((b) => b.code)).toEqual(["wegagen"]);
    expect(d.format?.id).toBe("wegagen-share-link");
    expect(d.needsAccount).toBe(false);
    expect(d.needsPhone).toBe(false);
    expect(d.browserFirst).toBe(false);
    expect(d.beta).toBe(true);
    expect(d.overridden).toBe(false);
  });

  it("is the same check as pasting the share link", () => {
    const fromQr = detectInput(SYNTH_WEGAGEN_QR, { lockedBank: "wegagen" });
    const typed = detectInput(SYNTH_WEGAGEN_LINK, { lockedBank: "wegagen" });
    expect(fromQr.bank?.code).toBe(typed.bank?.code);
    expect(fromQr.value).toBe(typed.urlReference);
    expect(fromQr.format?.id).toBe(typed.format?.id);
    expect(fromQr.needsAccount).toBe(typed.needsAccount);
    expect(fromQr.browserFirst).toBe(typed.browserFirst);
  });

  it("names its own bank: on another bank's page it is reported, not re-routed", () => {
    expect(detectInput(SYNTH_WEGAGEN_QR, { lockedBank: "telebirr" }).bank?.code).toBe("wegagen");
    expect(detectInput(SYNTH_WEGAGEN_QR, { overrideBank: "cbe" }).bank?.code).toBe("wegagen");
  });

  it("precedence: the prose before BOA QR and links; plain input unchanged", () => {
    expect(detectInput(Buffer.alloc(96, 7).toString("base64")).kind).toBe("boaQr");
    expect(detectInput(SYNTH_WEGAGEN_QR).kind).toBe("wegagenQr");
    expect(detectInput(SYNTH_WEGAGEN_LINK).kind).toBe("url");
    expect(detectInput(SYNTH_WEGAGEN_ID).kind).toBe("reference");
    expect(detectInput("").kind).toBe("empty");
  });

  it("never hands the prose on: only the share id becomes the value", () => {
    const d = detectInput(SYNTH_WEGAGEN_QR);
    expect(d.value).toBe(SYNTH_WEGAGEN_ID);
    expect(d.value).not.toContain("TEST PAYER");
    expect(d.value).not.toContain("1,250.00");
    // The names and the amount are what the QR happens to carry, not inputs.
    expect(SYNTH_WEGAGEN_QR).toContain("TEST PAYER");
    expect(SYNTH_WEGAGEN_QR).toContain("1,250.00");
  });

  it("text without a share link is not a Wegagen QR", () => {
    const broken = SYNTH_WEGAGEN_QR.replace(SYNTH_WEGAGEN_ID, SYNTH_WEGAGEN_ID.slice(0, 23));
    const d = detectInput(broken);
    expect(d.kind).not.toBe("wegagenQr");
    expect(d.bank?.code).not.toBe("wegagen");
  });
});

describe("Verifier: qrData", () => {
  const v = new Verifier();

  it("looks the decoded share id up at Wegagen's own endpoint", async () => {
    const fetchMock = vi.fn(async () => json(wegagenRecord("SAMPLE1")));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "wegagen", qrData: SYNTH_WEGAGEN_QR });
    expect(fetched(fetchMock)).toEqual([`${API}${SYNTH_WEGAGEN_ID}`]);
    expect(r.ok && r.value.verified).toBe(true);
    if (!r.ok) return;
    expect(r.value.reference).toBe(synthRef("SAMPLE1"));
    expect(r.value.sourceUrl).toBe(SYNTH_WEGAGEN_LINK);
    expect(r.value.bankCode).toBe("wegagen");
    expect(r.value.senderAccount).toBe("1*****0000001");
  });

  it("no bank named: the QR still goes to Wegagen, and nowhere else", async () => {
    const fetchMock = vi.fn(async () => json(wegagenRecord("SAMPLE1")));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "", qrData: SYNTH_WEGAGEN_QR });
    expect(fetched(fetchMock)).toEqual([`${API}${SYNTH_WEGAGEN_ID}`]);
    expect(r.ok && r.value.verified).toBe(true);
  });

  it("the QR alone never verifies: Wegagen has no such transaction", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(WEGAGEN_NOT_FOUND)));
    const r = await v.verify({ bank: "", qrData: SYNTH_WEGAGEN_QR });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("EXTRACTION_ERROR");
      if (r.error.kind === "EXTRACTION_ERROR") expect(r.error.message).toMatch(/no transaction with this share id/);
    }
  });

  it("with another bank named it is rejected before any fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const bank of ["boa", "cbe", "telebirr", "zamzam"]) {
      const r = await v.verify({ bank, qrData: SYNTH_WEGAGEN_QR });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe("MISSING_INPUT");
        if (r.error.kind === "MISSING_INPUT") expect(r.error.message).toMatch(/Wegagen receipt/);
      }
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("text that is not a Wegagen QR is never resolved to a Wegagen share id", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "wegagen", qrData: "Amount ETB-1,250.00 transferred, no link" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("REF_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("API: qrData", () => {
  it("POST /api/verify: a Wegagen QR with no bank verifies through the share id", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(wegagenRecord("SAMPLE1"))));
    const res = await verifyPOST(req("/api/verify", { qrData: SYNTH_WEGAGEN_QR }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ success: true, verified: true, bankCode: "wegagen", reference: synthRef("SAMPLE1") });
    expect(body.sourceUrl).toBe(SYNTH_WEGAGEN_LINK);
    // The prose is never echoed as a reference.
    expect(body.reference).not.toContain("Transferred");
  });

  it("POST /api/verify: a Wegagen QR for the wrong bank is a 400", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await verifyPOST(req("/api/verify", { bank: "cbe", qrData: SYNTH_WEGAGEN_QR }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /api/verify: no such transaction is 422, never verified", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json(WEGAGEN_NOT_FOUND)));
    const res = await verifyPOST(req("/api/verify", { qrData: SYNTH_WEGAGEN_QR.replace(SYNTH_WEGAGEN_ID, synthId("MISSQR01")) }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.verified).toBeUndefined();
  });
});

describe("manifest: input-only formats", () => {
  const wegagen = getBank("wegagen")!;

  it("the receipt QR is input-only, via the share link, never fetched", () => {
    const qr = wegagen.formats!.find((f) => f.id === "wegagen-receipt-qr")!;
    expect(isInputOnlyFormat(qr)).toBe(true);
    expect(qr.via).toBe("wegagen-share-link");
    expect(qr.parser).toBeUndefined();
    expect(qr.endpoint).toBeUndefined();
    expect(qr.linkHosts).toBeUndefined();
    expect(qr.inputs.map((i) => i.name)).toEqual(["qr"]);
    expect(supportedFormats(wegagen).map((f) => f.id)).toEqual(["wegagen-share-link"]);
    expect(primaryFormat(wegagen)?.id).toBe("wegagen-share-link");
    expect(inputOnlyFormats(wegagen).map((f) => f.id)).toEqual(["wegagen-receipt-qr"]);
    expect(selectFormat(wegagen, { reference: SYNTH_WEGAGEN_ID })).toMatchObject({ ok: true, format: { id: "wegagen-share-link" } });
  });

  it("the endpoint change that brought the share link in is dated", () => {
    expect(wegagen.endpointHistory?.some((e) => e.formatId === "wegagen-share-link")).toBe(true);
  });
});
