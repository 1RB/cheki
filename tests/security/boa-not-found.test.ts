/**
 * When BOA answers but has no receipt: the typed-input hint (try the source
 * account) and the bank page cheki checked (checkedUrl), through the API,
 * the batch route and the verdict card.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { BOA_NOT_FOUND, BOA_UNREADABLE } from "@/lib/core/verifier";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { POST as batchPOST } from "@/app/api/verify/batch/route";
import { presentVerdict } from "@/lib/verify/verdict";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const invalid = () =>
  vi.fn(async () => new Response(JSON.stringify({ body: [{ "Payer's Name": "Invalid reference number" }] }), { status: 200 }));
const CHECKED = "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26SAMPLE0706171";

let ip = 0;
const freshIp = () => `10.77.${Math.floor(++ip / 250)}.${ip % 250}`;
const post = (url: string, body: unknown) =>
  new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": freshIp() },
    body: JSON.stringify(body),
  });

describe("BOA not found", () => {
  it("a typed lookup says to try the source account and carries the page it checked", async () => {
    vi.stubGlobal("fetch", invalid());
    const r = await new Verifier().verify({ bank: "boa", reference: "FT26SAMPLE07", accountNumber: "06171" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("EXTRACTION_ERROR");
      if (r.error.kind === "EXTRACTION_ERROR") {
        expect(r.error.message).toBe(BOA_NOT_FOUND);
        expect(r.error.checkedUrl).toBe(CHECKED);
      }
    }
  });

  it("an unreadable BOA answer is unconfirmed, not a no-record", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{not json", { status: 200 })));
    const r = await new Verifier().verify({ bank: "boa", reference: "FT26SAMPLE07", accountNumber: "06171" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("ENDPOINT_ERROR");
      expect("message" in r.error && r.error.message).toBe(BOA_UNREADABLE);
    }
  });

  it("POST /api/verify returns 422 with checkedUrl", async () => {
    vi.stubGlobal("fetch", invalid());
    const res = await verifyPOST(post("https://cheki.et/api/verify", { bank: "boa", reference: "FT26SAMPLE07", accountNumber: "06171" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ success: false, checkedUrl: CHECKED });
    expect(body.verified).toBeFalsy();
  });

  it("the batch route carries checkedUrl on the failed receipt", async () => {
    vi.stubGlobal("fetch", invalid());
    const res = await batchPOST(post("https://cheki.et/api/verify/batch", { receipts: [{ bank: "boa", reference: "FT26SAMPLE07", accountNumber: "06171" }] }));
    const body = await res.json();
    expect(body.results[0]).toMatchObject({ success: false, status: 422, checkedUrl: CHECKED });
  });
});

describe("verdict card", () => {
  it("a BOA miss gets the source-account next step and the bank's answer link", () => {
    const v = presentVerdict(
      { success: false, httpStatus: 422, error: `[Bank of Abyssinia] ${BOA_NOT_FOUND}`, checkedUrl: CHECKED },
      { bankCode: "boa", reference: "FT26SAMPLE07" },
    );
    expect(v.kind).toBe("notFound");
    expect(v.nextStep).toMatch(/source account/);
    expect(v.checkedUrl).toBe(CHECKED);
  });

  it("other misses keep the usual next step, and a non-https checkedUrl is dropped", () => {
    const v = presentVerdict(
      { success: false, httpStatus: 422, error: "[Commercial Bank of Ethiopia] Receipt not found or invalid.", checkedUrl: "http://example.com/x" },
      { bankCode: "cbe" },
    );
    expect(v.kind).toBe("notFound");
    expect(v.nextStep).not.toMatch(/source account/);
    expect(v.checkedUrl).toBeUndefined();
  });
});
