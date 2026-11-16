/**
 * eBirr transactioninfo.ebirr.com links (seen on a KAAFI receipt).
 *
 * The host is not in public DNS, so cheki's server can never check one. The
 * link is recognised, rebuilt on the fixed host from the validated tenant and
 * digits, and handed back as fallbackUrl with a "not checked" answer. Nothing
 * is fetched. Synthetic receipt numbers only.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { Verifier } from "@/lib";
import { detectBankFromUrl } from "@/lib/adapters/url-detector";
import { isAllowedUrl } from "@/lib/security/hosts";
import { presentVerdict } from "@/lib/verify/verdict";
import { detectInput } from "@/lib/verify/detect";
import { getBank } from "@/lib/manifest/loader";
import { formatsOf, isSupportedFormat } from "@/lib/manifest/formats";
import { POST as verifyPOST } from "@/app/api/verify/route";
import "@/lib/parsers";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const LINK = "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/800000000001";

describe("transactioninfo.ebirr.com detection", () => {
  it("recognises a KAAFI link as eBirr, with the link rebuilt on the fixed host", () => {
    expect(detectBankFromUrl(LINK)).toEqual({ bank: "ebirr", reference: "kaafimf-Ebirr/800000000001", localOnlyUrl: LINK });
    // Case and a trailing slash or query in the pasted link do not survive into the rebuilt one.
    expect(detectBankFromUrl("http://TransactionInfo.ebirr.com/KAAFIMF-ebirr/Receipt/800000000001/?x=<script>")?.localOnlyUrl).toBe(LINK);
  });

  it("maps the known eBirr tenants, Siinqee to itself and Coopbank to eBirr", () => {
    expect(detectBankFromUrl("https://transactioninfo.ebirr.com/nib-Ebirr/receipt/800000000002")?.bank).toBe("ebirr");
    expect(detectBankFromUrl("https://transactioninfo.ebirr.com/coop-Ebirr/receipt/800000000003")?.bank).toBe("ebirr");
    expect(detectBankFromUrl("https://transactioninfo.ebirr.com/siinqee-Ebirr/receipt/800000000004")).toMatchObject({
      bank: "siinqee",
      localOnlyUrl: "https://transactioninfo.ebirr.com/siinqee-Ebirr/receipt/800000000004",
    });
  });

  it("rejects unknown tenants, other paths, non-digit ids, ports and look-alike hosts", () => {
    for (const bad of [
      "https://transactioninfo.ebirr.com/evil-Ebirr/receipt/800000000001",
      "https://transactioninfo.ebirr.com/kaafimf/receipt/800000000001",
      "https://transactioninfo.ebirr.com/kaafimf-Ebirr/other/800000000001",
      "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/80000000000x",
      "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/12345",
      "https://transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/800000000001/extra",
      "https://transactioninfo.ebirr.com:8443/kaafimf-Ebirr/receipt/800000000001",
      "https://transactioninfo.ebirr.com.evil.example/kaafimf-Ebirr/receipt/800000000001",
      "https://user:pw@transactioninfo.ebirr.com/kaafimf-Ebirr/receipt/800000000001",
    ]) {
      expect(detectBankFromUrl(bad), bad).toBeNull();
    }
  });

  it("is never on the fetch allowlist", () => {
    expect(isAllowedUrl(LINK)).toBe(false);
  });

  it("is an eBirr format with no parser, observed, never fetched", () => {
    const f = formatsOf(getBank("ebirr")).find((x) => x.id === "ebirr-transactioninfo-link");
    expect(f).toBeDefined();
    expect(f!.confidence).toBe("observed");
    expect(isSupportedFormat(f!)).toBe(false);
    expect(f!.linkHosts).toEqual(["transactioninfo.ebirr.com"]);
  });

  it("the checker treats it as an eBirr link", () => {
    const d = detectInput(LINK);
    expect(d.kind).toBe("url");
    expect(d.bank?.code).toBe("ebirr");
  });
});

describe("transactioninfo.ebirr.com through the verifier and API", () => {
  it("answers ENDPOINT_ERROR with the rebuilt link and makes no request", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const v = new Verifier();
    for (const input of [{ bank: "", reference: LINK }, { bank: "nib", reference: LINK }, { bank: "", qrData: LINK }]) {
      const r = await v.verify(input);
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.kind).toBe("ENDPOINT_ERROR");
        expect(r.error.kind === "ENDPOINT_ERROR" && r.error.fallbackUrl).toBe(LINK);
        expect(r.error.kind === "ENDPOINT_ERROR" && r.error.message).toMatch(/only opens on Ethiopian networks/);
      }
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST /api/verify: 502 with fallbackUrl, not cached", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const req = () =>
      new NextRequest("https://cheki.et/api/verify", {
        method: "POST",
        body: JSON.stringify({ bank: "", reference: LINK }),
        headers: { "content-type": "application/json", "x-forwarded-for": "10.77.0.1" },
      });
    for (let i = 0; i < 2; i++) {
      const res = await verifyPOST(req());
      expect(res.status).toBe(502);
      const body = await res.json();
      expect(body).toMatchObject({ success: false, fallbackUrl: LINK });
      expect(body.cached).toBeUndefined();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("the verdict says the link only opens in Ethiopia and offers it, neutral", () => {
    const v = presentVerdict({ success: false, httpStatus: 502, bankCode: "ebirr", fallbackUrl: LINK, error: "x" });
    expect(v.kind).toBe("geoBlocked");
    expect(v.tone).toBe("neutral");
    expect(v.fallbackUrl).toBe(LINK);
    expect(v.title).toMatch(/only opens in Ethiopia/);
    expect(v.subtitle).not.toMatch(/blocks/);
    expect(v.nextStep).toMatch(/amount, the receiver's name and the date/);
    // Telebirr's link-out keeps its own wording.
    const tb = presentVerdict({ success: false, httpStatus: 502, bankCode: "telebirr", fallbackUrl: "https://transactioninfo.ethiotelecom.et/receipt/DET0SAMPLE" });
    expect(tb.title).toMatch(/blocks cheki's server/);
  });
});
