/**
 * BOA QR payloads (review C2, frontend F1). The AES key is public, so a QR
 * proves nothing. It is decoded only to look the receipt up at BOA.
 */
import { createCipheriv, pbkdf2Sync } from "node:crypto";
import { describe, it, expect, afterEach, vi } from "vitest";
import { Verifier } from "@/lib";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function mintQr(csv: string): string {
  const key = pbkdf2Sync("ELqVy2g4pGWLUIKSa+1ijwpPy6eDxBFBLBPrJ24v/IA=", "salt", 10000, 32, "sha1");
  const c = createCipheriv("aes-256-cbc", key, Buffer.from("1234567890123456"));
  return Buffer.concat([c.update(csv), c.final()]).toString("base64");
}

// From the PoC: anyone with the repo can mint this.
const FORGED = mintQr("1000000012345,ATTACKER,999999.00,FT26999FORGED,2026-10-11,1000099999999,VICTIM SHOP");
// Real anonymised payload from tests/parsers/boa.test.ts
const GENUINE =
  "3cHRaxVjn/pySpNXEHQE61JOQ2poZRMwnDHwMiX7YO9UVtJZT/ndmwHEzWkJoloEf4dIQIzJf5zmvbBo5qHTdm/23nc6NRzTSfxEjIHa7Ju4Ti+xydrVn8qF+9/OPAF5LIfMEvxFqZ6wlKMvSN/jrQ==";

const bankBody = (ref: string, amount: string) =>
  JSON.stringify({
    body: [{
      "Source Account Name": "HABIB DAOUD OMAR",
      "Source Account": "2****3957",
      "Receiver's Name": "ABADIR MESGID",
      "Receiver's Account": "1****42674",
      "Transferred Amount": amount,
      "Transaction Date": "16/06/2026 20:29:42",
      "Transaction Reference": ref,
    }],
  });

describe("BOA QR", () => {
  const v = new Verifier();

  it("a forged QR is never verified when BOA has no such receipt", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ body: [{ "Payer's Name": "Invalid reference number" }] }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", qrData: FORGED });
    expect(r.ok && r.value.verified).toBeFalsy();
    expect(r.ok).toBe(false);
    // It asked BOA with the QR's reference and the receiver suffix.
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26999FORGED99999"
    );
  });

  it("when BOA is unreachable the QR is shown as decodedOnly, verified false", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("ETIMEDOUT"); }));
    const r = await v.verify({ bank: "boa", qrData: FORGED });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.verified).toBe(false);
      expect(r.value.decodedOnly).toBe(true);
      expect(r.value.sourceUrl).toBe("qr://boa");
    }
  });

  it("a genuine QR verifies with the bank's own record", async () => {
    const fetchMock = vi.fn(async () => new Response(bankBody("FT26167ZVPCJ", "30,124.20 ETB"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", qrData: GENUINE });
    expect(r.ok && r.value.verified).toBe(true);
    if (r.ok) {
      expect(r.value.amount).toBe(30124.2);
      expect(r.value.sourceUrl).toMatch(/^https:\/\/cs\.bankofabyssinia\.com\//);
      expect(r.value.decodedOnly).toBeUndefined();
    }
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toBe(
      "https://cs.bankofabyssinia.com/api/onlineSlip/getDetails/?id=FT26167ZVPCJ42674"
    );
  });

  it("a QR whose amount differs from the bank's record fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(bankBody("FT26167ZVPCJ", "124.20 ETB"), { status: 200 })));
    const r = await v.verify({ bank: "boa", qrData: GENUINE });
    expect(r.ok).toBe(false);
  });

  it("a QR with an invalid receiving account fails without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const qr = mintQr("1000000012345,PAYER,500.00,FT26999ABCDE,2026-10-11,ACCT-XYZ,SHOP");
    const r = await v.verify({ bank: "boa", qrData: qr });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("EXTRACTION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a QR with an invalid reference fails without calling fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const qr = mintQr("1000000012345,PAYER,500.00,../../admin,2026-10-11,1000005842674,SHOP");
    const r = await v.verify({ bank: "boa", qrData: qr });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.kind).toBe("EXTRACTION_ERROR");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("a QR with a masked receiving account is never verified or decodedOnly, even if BOA is down", async () => {
    const fetchMock = vi.fn(async () => { throw new Error("ETIMEDOUT"); });
    vi.stubGlobal("fetch", fetchMock);
    for (const masked of ["1****42674", "1000****2674", "*****", ""]) {
      const qr = mintQr(`1000000012345,PAYER,500.00,FT26999ABCDE,2026-10-11,${masked},SHOP`);
      const r = await v.verify({ bank: "boa", qrData: qr });
      expect(r.ok).toBe(false);
      expect(r.ok && r.value.verified).toBeFalsy();
      expect(r.ok && r.value.decodedOnly).toBeFalsy();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("decodedOnly is only reached after a real BOA request was attempted", async () => {
    const fetchMock = vi.fn(async () => new Response("bad gateway", { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    const r = await v.verify({ bank: "boa", qrData: GENUINE });
    expect(fetchMock).toHaveBeenCalled();
    expect(r.ok && r.value.decodedOnly).toBe(true);
    expect(r.ok && r.value.verified).toBe(false);
  });

  it("a malformed QR is an error", async () => {
    const r = await v.verify({ bank: "boa", qrData: "not-valid-base64!!!" });
    expect(r.ok).toBe(false);
  });
});
