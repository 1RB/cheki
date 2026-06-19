/**
 * Tests for manifest loader.
 */
import { describe, it, expect } from "vitest";
import { getBank, getAllBanks, getLiveBanks, suggestBank } from "@/lib/manifest/loader";

describe("manifest loader", () => {
  it("loads all 10 banks", () => {
    expect(getAllBanks().length).toBe(10);
  });

  it("returns live banks only", () => {
    const live = getLiveBanks();
    expect(live.every((b) => b.status === "live")).toBe(true);
    expect(live.length).toBe(9);
  });

  it("finds bank by id (case insensitive)", () => {
    const cbe = getBank("CBE");
    expect(cbe).toBeDefined();
    expect(cbe!.name).toBe("Commercial Bank of Ethiopia");
  });

  it("finds bank by lowercase id", () => {
    const telebirr = getBank("telebirr");
    expect(telebirr).toBeDefined();
    expect(telebirr!.type).toBe("wallet");
  });

  it("returns undefined for unknown bank", () => {
    expect(getBank("unicorn")).toBeUndefined();
  });

  it("suggests bank for close match", () => {
    const suggestion = suggestBank("cbe");
    expect(suggestion).toBe("cbe");
  });

  it("suggests bank for partial match", () => {
    const suggestion = suggestBank("tele");
    expect(suggestion).toBe("telebirr");
  });

  it("suggests bank for typo", () => {
    const suggestion = suggestBank("tebirr");
    expect(suggestion).toBe("telebirr");
  });

  it("suggests bank for SWIFT code", () => {
    const suggestion = suggestBank("CBETETAA");
    expect(suggestion).toBe("cbe");
  });

  it("returns undefined for very different input", () => {
    const suggestion = suggestBank("zzzzzzzzz");
    expect(suggestion).toBeUndefined();
  });

  it("all banks have required fields", () => {
    for (const bank of getAllBanks()) {
      expect(bank.id).toBeTruthy();
      expect(bank.name).toBeTruthy();
      expect(bank.parser).toBeTruthy();
      expect(bank.endpoint).toBeTruthy();
      expect(bank.color).toBeTruthy();
      expect(bank.initials).toBeTruthy();
      expect(bank.responseType).toMatch(/^(pdf|html|json)$/);
      expect(bank.type).toMatch(/^(bank|wallet)$/);
      expect(bank.status).toMatch(/^(live|in-development)$/);
    }
  });
});
