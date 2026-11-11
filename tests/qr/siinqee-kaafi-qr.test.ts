/**
 * A receipt QR that carries the receipt link (Siinqee's receipts.siinqeebank.com
 * link, an eBirr transactioninfo link) must behave exactly like the pasted link:
 * in detection (the scanner hands the decoded text to detectInput) and in the
 * API's qrData path. Synthetic references only (tests/fixtures/siinqee).
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { detectInput } from "@/lib/verify/detect";
import { POST as verifyPOST } from "@/app/api/verify/route";
import { SYNTH_SIINQEE_LINK, SYNTH_SIINQEE_REF, siinqeeP2pHtml } from "../fixtures/siinqee/receipts";
import "@/lib/parsers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const KAAFI = "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/800000000001";
let ip = 0;
const req = (body: unknown) =>
  new NextRequest("https://cheki.et/api/verify", {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": `10.77.${Math.floor(++ip / 250)}.${ip % 250}` },
    body: JSON.stringify(body),
  });

describe("scanned receipt QR carrying the link", () => {
  it("Siinqee: the QR text is the link, detected as Siinqee with its case kept", () => {
    const d = detectInput(SYNTH_SIINQEE_LINK);
    expect(d.kind).toBe("url");
    expect(d.bank?.code).toBe("siinqee");
    expect(d.urlReference).toBe(SYNTH_SIINQEE_REF);
    expect(d.needsAccount || d.needsPhone).toBe(false);
  });

  it("Siinqee: qrData with the link is fetched once on the fixed host and verified", async () => {
    const fetchMock = vi.fn(async () => new Response(siinqeeP2pHtml(), { status: 200, headers: { "content-type": "text/html" } }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await verifyPOST(req({ qrData: SYNTH_SIINQEE_LINK }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.bank).toBe("Siinqee Bank");
    expect(body.verified).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(SYNTH_SIINQEE_LINK);
  });

  it("Kaafi: a QR with the transactioninfo link is recognised and handed back, never fetched", async () => {
    expect(detectInput(KAAFI).bank?.code).toBe("ebirr");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await verifyPOST(req({ qrData: KAAFI }));
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.fallbackUrl).toBe(KAAFI);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
