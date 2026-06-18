/**
 * Tests for parser registry.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { getRegisteredBankIds, isBankSupported, getParser } from "@/lib/parsers/index";

describe("parser registry", () => {
  it("has registered all live bank parsers", () => {
    const ids = getRegisteredBankIds();
    expect(ids).toContain("cbe");
    expect(ids).toContain("cbe-new");
    expect(ids).toContain("telebirr");
    expect(ids).toContain("boa");
    expect(ids).toContain("mpesa");
  });

  it("isBankSupported returns true for registered banks", () => {
    expect(isBankSupported("cbe")).toBe(true);
    expect(isBankSupported("telebirr")).toBe(true);
    expect(isBankSupported("boa")).toBe(true);
    expect(isBankSupported("mpesa")).toBe(true);
  });

  it("isBankSupported returns false for unregistered banks", () => {
    expect(isBankSupported("unicorn")).toBe(false);
  });

  it("getParser returns parser with correct properties", () => {
    const cbe = getParser("cbe");
    expect(cbe).toBeDefined();
    expect(cbe!.bankId).toBe("cbe");
    expect(cbe!.bankName).toBe("Commercial Bank of Ethiopia");
    expect(cbe!.responseType).toBe("pdf");
    expect(cbe!.requiresAccount).toBe(true);
  });

  it("getParser returns undefined for unknown bank", () => {
    expect(getParser("unicorn")).toBeUndefined();
  });
});
