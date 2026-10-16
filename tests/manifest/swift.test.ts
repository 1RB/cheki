import { describe, it, expect } from "vitest";
import manifest from "@/lib/manifest/banks.json";
import type { BankManifestEntry } from "@/lib/core/types";
import { getBank } from "@/lib/banks";
import { bankPageContent } from "@/lib/bank-page-content";
import { ETHIOPIAN_BIC, formatCheckedAt, swiftRegistryNote, swiftSourceLabel } from "@/lib/swift";
import { GET } from "@/app/api/banks/route";

const entries = manifest as unknown as BankManifestEntry[];
const withSwift = entries.filter((b) => b.swift !== undefined);
/** Directory sites that may back a code only as the second, independent source. */
const CROSS_CHECK_ONLY = new Set(["wise.com"]);

describe("SWIFT/BIC reference data", () => {
  it("covers the banks whose codes two sources agree on", () => {
    expect(withSwift.length).toBeGreaterThanOrEqual(20);
  });

  it.each(withSwift.map((b) => [b.id, b.swift!] as const))("%s: BIC is a head-office Ethiopian BIC", (_id, swift) => {
    expect(typeof swift).toBe("object");
    expect(swift.bic).toMatch(/^[A-Z]{4}ET[A-Z0-9]{2}([A-Z0-9]{3})?$/);
    expect(swift.bic).toMatch(ETHIOPIAN_BIC);
  });

  it.each(withSwift.map((b) => [b.id, b.swift!] as const))("%s: has sources, at least two from different sites", (_id, swift) => {
    expect(swift.sources.length).toBeGreaterThanOrEqual(2);
    expect(new Set(swift.sources).size).toBe(swift.sources.length);
    const hosts = new Set(swift.sources.map((u) => new URL(u).hostname.replace(/^www\./, "")));
    expect(hosts.size).toBeGreaterThanOrEqual(2);
    for (const u of swift.sources) expect(u).toMatch(/^https:\/\//);
    expect(swift.checkedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it.each(withSwift.map((b) => [b.id, b.swift!] as const))("%s: claims a SWIFT registry match only when it cites SWIFT's search", (_id, swift) => {
    const hosts = swift.sources.map((u) => new URL(u).hostname.replace(/^www\./, ""));
    const citesSwift = hosts.some((h) => h === "swiftref.com" || h === "swift.com" || h.endsWith(".swift.com"));
    expect(swift.registry).toBe(citesSwift ? "confirmed" : "not-checked");
    // Not checked against SWIFT: the bank's own site or the regulator must be one of the two.
    if (!citesSwift) {
      expect(hosts.filter((h) => !CROSS_CHECK_ONLY.has(h)).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("only the codes SWIFT's search actually returned are marked confirmed", () => {
    const confirmed = withSwift.filter((b) => b.swift!.registry === "confirmed").map((b) => b.id).sort();
    expect(confirmed).toEqual(["awash", "boa", "cbe", "cbe-new", "dashen", "nib", "siinqee", "zemen"]);
  });

  it("wallets carry no BIC of their own", () => {
    for (const b of entries.filter((e) => e.type !== "bank")) expect(b.swift).toBeUndefined();
  });

  it("the parser-only CBE alias matches CBE", () => {
    expect(entries.find((b) => b.id === "cbe-new")?.swift).toEqual(entries.find((b) => b.id === "cbe")?.swift);
  });
});

describe("SWIFT/BIC on pages and in the API", () => {
  it("adds a neutral FAQ to live and in-development bank pages", () => {
    for (const code of ["boa", "wegagen"]) {
      const bank = getBank(code)!;
      const faq = bankPageContent(bank).faq.find((f) => f.q === `What is the SWIFT code for ${bank.name}?`);
      expect(faq?.a).toContain(bank.swift!.bic);
      expect(faq?.a).toContain("reference only");
      expect(faq?.a).toContain(bank.swift!.registry === "confirmed" ? "matching SWIFT's BIC search" : "SWIFT registry itself was not checked");
    }
    expect(bankPageContent(getBank("telebirr")!).faq.some((f) => /SWIFT code/.test(f.q))).toBe(false);
  });

  it("keeps the public /api/banks swift field a plain BIC string", async () => {
    const res = await GET();
    const { banks } = (await res.json()) as { banks: { id: string; swift?: unknown }[] };
    expect(banks.find((b) => b.id === "cbe")?.swift).toBe("CBETETAA");
    for (const b of banks) if (b.swift !== undefined) expect(typeof b.swift).toBe("string");
    expect(banks.find((b) => b.id === "telebirr")?.swift).toBeUndefined();
  });

  it("formats the check date and names each source", () => {
    expect(formatCheckedAt("2026-10-16")).toBe("16 October 2026");
    expect(swiftSourceLabel("https://www.swiftref.com/en/bicsearch", "BOA")).toBe("SWIFT BIC search");
    expect(swiftSourceLabel("https://nbe.gov.et/financial-institutions/banks/2/", "Ahadu")).toBe("National Bank of Ethiopia");
    expect(swiftSourceLabel("https://www.bankofabyssinia.com/money-transfer/", "BOA")).toBe("BOA website");
    expect(swiftSourceLabel("https://wise.com/us/swift-codes/HIJRETAAXXX", "Hijra")).toBe("Wise SWIFT directory");
    expect(swiftRegistryNote(getBank("cbe")!.swift!)).toBe("Matches SWIFT's BIC search");
    expect(swiftRegistryNote(getBank("hibret")!.swift!)).toBe("SWIFT registry not checked");
  });
});
