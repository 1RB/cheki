/**
 * The verify UI collects at most ONE extra field: VerifyPanel's body
 * ternary (src/components/verify/VerifyPanel.tsx) sends phoneNumber or
 * accountNumber, never both, while the API itself accepts either or both.
 * That split is only safe while nothing can ask for both, so this pins the
 * invariant the shared derivation leans on.
 *
 * detect.ts (the UI), the verifier and bank-page-content all get
 * needsAccount/needsPhone from the one extraFieldNeeds helper
 * (src/lib/manifest/formats.ts): the matched format's inputs when a format
 * matched, the bank's own flags otherwise, never a mix. So each source
 * pair being exclusive proves every detection, verification and page asks
 * for at most one extra field. The account side's digit count comes from
 * the same place (accountDigitsFor), so this also pins that anything which
 * asks for an account says how many digits it means: that keeps
 * DEFAULT_ACCOUNT_DIGITS unreachable instead of quietly deciding a bank's
 * rule, its minimum check and its label.
 */
import { describe, expect, it } from "vitest";
import { getAllBanks } from "@/lib/manifest/loader";
import { formatNeeds } from "@/lib/manifest/formats";

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

  it("declares the account's digit count wherever it asks for an account", () => {
    for (const bank of getAllBanks()) {
      if (bank.requiresAccount) expect(bank.accountDigits, `${bank.id} (bank flags)`).toBeGreaterThan(0);
      for (const format of bank.formats ?? []) {
        const input = format.inputs.find((i) => i.name === "account");
        if (input) expect(input.digits, `${bank.id}/${format.id}`).toBeGreaterThan(0);
      }
    }
  });
});
