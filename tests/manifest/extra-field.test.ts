/**
 * The verify UI collects at most ONE extra field: VerifyPanel's body
 * ternary (src/components/verify/VerifyPanel.tsx) sends phoneNumber or
 * accountNumber, never both, while the API itself accepts either or both.
 * That split is only safe while nothing can ask for both, so this pins the
 * invariant the flag derivation leans on.
 *
 * detect.ts (src/lib/verify/detect.ts, the needsAccount/needsPhone lines)
 * derives both flags from ONE source: the matched format's inputs when a
 * format matched, the bank's own flags otherwise, never a mix. The
 * verifier (src/lib/core/verifier.ts) derives them the same way and ORs
 * the parser's requiresPhone into its no-format branch. So each source
 * pair being exclusive proves every detection and every verification asks
 * for at most one extra field.
 */
import { describe, expect, it } from "vitest";
import { getAllBanks } from "@/lib/manifest/loader";
import { formatNeeds } from "@/lib/manifest/formats";
import { getParser } from "@/lib/parsers/index";

describe("a receipt asks for at most one extra field", () => {
  it("in every format's inputs (the branch where a format matched)", () => {
    for (const bank of getAllBanks()) {
      for (const format of bank.formats ?? []) {
        const both = formatNeeds(format, "account") && formatNeeds(format, "phone");
        expect(both, `${bank.id}/${format.id}`).toBe(false);
      }
    }
  });

  it("in the bank flags (the branch where no format matched)", () => {
    for (const bank of getAllBanks()) {
      const both = Boolean(bank.requiresAccount) && Boolean(bank.requiresPhone);
      expect(both, bank.id).toBe(false);
    }
  });

  it("between the bank flags and the parser's requiresPhone (the verifier's no-format branch)", () => {
    for (const bank of getAllBanks()) {
      // Mirrors verifier.ts: getParser((format?.parser ?? manifestEntry.id)),
      // with no format in this branch. A bank whose parser is missing never
      // reaches the flag checks (BANK_NOT_SUPPORTED comes first).
      const parser = getParser(bank.id.toLowerCase());
      if (!parser) continue;
      const both = Boolean(bank.requiresAccount) && (Boolean(bank.requiresPhone) || parser.requiresPhone);
      expect(both, bank.id).toBe(false);
    }
  });
});
