/**
 * One list of eBirr tenants: EBIRR_TENANTS in
 * src/lib/security/reference.ts, the set parseEbirrReference validates
 * against. Four other places need tenant knowledge (bank routing for a
 * pasted link, the display name on a parsed receipt, Siinqee's
 * sub-allowlist, the OCR tenant-prefix fallback) and each used to keep its
 * own copy that could drift: url-detector once knew a "kaafi" tenant no
 * validator accepted, so a pasted link could detect a bank and then fail
 * reference validation, a loop with no way out.
 *
 * This pins every copy to the canonical set, and pins the disagreement
 * that started it: kaafi is a bank id; the tenant KAAFI issues receipts
 * under is kaafimf.
 */
import { describe, expect, it } from "vitest";
import { detectBankFromUrl } from "@/lib/adapters/url-detector";
import { detectBank, EBIRR_TENANT_PREFIXES } from "@/lib/banks";
import { TENANT_MAP } from "@/lib/parsers/ebirr";
import { SIINQEE_TENANTS } from "@/lib/parsers/siinqee";
import { EBIRR_TENANTS, parseEbirrReference } from "@/lib/security/reference";

/** Where url-detector routes each canonical tenant (tenant -> bank id). */
const ROUTING: Record<string, string> = {
  siinqee: "siinqee",
  nib: "nib",
  wegagen: "ebirr",
  ahadu: "ahadu",
  kaafimf: "kaafi",
  coop: "siinqee",
};

describe("eBirr tenants", () => {
  it("routes every canonical tenant, and its routing knows no one else", () => {
    expect(Object.keys(ROUTING).sort()).toEqual([...EBIRR_TENANTS].sort());
    for (const [tenant, bank] of Object.entries(ROUTING)) {
      expect(detectBankFromUrl(`https://receipt.ebirr.com/${tenant}/TOK12345`), tenant).toEqual({
        bank,
        reference: `${tenant}/TOK12345`,
      });
    }
  });

  it("refuses the KAAFI bank id used as a tenant, the way validation does", () => {
    // Before url-detector shared the canonical set, it accepted "kaafi"
    // while parseEbirrReference rejected it: detection succeeded, then
    // verification could never work. Both must now refuse it.
    expect(detectBankFromUrl("https://receipt.ebirr.com/kaafi/abc123def")).toBeNull();
    expect(parseEbirrReference("kaafi/abc123def").ok).toBe(false);
    // The real tenant still works end to end.
    expect(detectBankFromUrl("https://receipt.ebirr.com/kaafimf/abc123def")).toEqual({
      bank: "kaafi",
      reference: "kaafimf/abc123def",
    });
    // And an unknown tenant is still not guessed at.
    expect(detectBankFromUrl("https://receipt.ebirr.com/notatenant/abc123def")).toBeNull();
  });

  it("names every canonical tenant on the parsed receipt, and no one else", () => {
    expect(Object.keys(TENANT_MAP).sort()).toEqual([...EBIRR_TENANTS].sort());
  });

  it("keeps Siinqee's sub-allowlist inside the canonical set", () => {
    expect(SIINQEE_TENANTS.size).toBeGreaterThan(0);
    for (const tenant of SIINQEE_TENANTS) expect(EBIRR_TENANTS.has(tenant), tenant).toBe(true);
  });

  it("keeps the OCR tenant-prefix fallback inside the canonical set", () => {
    // The list is deliberate (only the tenants OCR'd eBirr references carry);
    // a change to it is a decision, not an accident.
    expect(EBIRR_TENANT_PREFIXES).toEqual(["nib", "wegagen", "ahadu", "kaafimf"]);
    for (const tenant of EBIRR_TENANT_PREFIXES) expect(EBIRR_TENANTS.has(tenant), tenant).toBe(true);
    expect(detectBank("nib/abc123def")).toBe("ebirr");
    expect(detectBank("kaafimf/abc123def")).toBe("ebirr");
  });
});
