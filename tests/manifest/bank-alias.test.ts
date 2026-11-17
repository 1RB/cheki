/**
 * One alias map (src/lib/bank-ids.ts): `cbe-new` is CBE's current-format
 * parser with a manifest entry of its own, but never a bank of its own.
 * Five call sites used to re-inline `x === "cbe-new" ? "cbe" : x` (detect,
 * verdict, OCR, the batch panel, the verify panel) and reference-case kept a
 * sixth copy as its private ruleKey; every copy could be forgotten when a
 * seventh consumer appeared. The same map's keys are the parser-only filter
 * in banks.ts and bank-counts.ts, so an alias is declared once and read
 * everywhere: bank lookups, provider counts, rule keys.
 *
 * Parser ids are deliberately NOT canonicalised: `getParser("cbe-new")` and
 * a format's `parser: "cbe-new"` field resolve the CBENewParser by its own
 * id (src/lib/parsers/cbe.ts keeps those comparisons).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { canonicalBankCode, PARSER_ONLY_IDS } from "@/lib/bank-ids";
import { banks, getBank } from "@/lib/banks";
import { TOTAL_BANK_COUNT } from "@/lib/bank-counts";
import { getAllBanks } from "@/lib/manifest/loader";
import { detectInput } from "@/lib/verify/detect";
import { findBank } from "@/lib/verify/verdict";
import { canonicalReference, isCaseInsensitiveBank } from "@/lib/reference-case";

describe("the bank alias map", () => {
  it("declares exactly one alias and canonicalises ids through it", () => {
    expect([...PARSER_ONLY_IDS]).toEqual(["cbe-new"]);
    expect(canonicalBankCode("cbe-new")).toBe("cbe");
    expect(canonicalBankCode("CBE-NEW ")).toBe("cbe");
    // Unknown ids pass through, trimmed and lowercased, never aliased.
    expect(canonicalBankCode("telebirr")).toBe("telebirr");
    expect(canonicalBankCode(" CBE ")).toBe("cbe");
    expect(canonicalBankCode(undefined)).toBe("");
    expect(canonicalBankCode(null)).toBe("");
  });

  it("keeps the alias out of bank pages and provider counts", () => {
    expect(banks.some((b) => b.code === "cbe-new")).toBe(false);
    expect(getBank("cbe-new")).toBeUndefined();
    expect(TOTAL_BANK_COUNT).toBe(getAllBanks().filter((b) => !PARSER_ONLY_IDS.has(b.id)).length);
  });

  it("answers for the alias wherever a bank id is looked up", () => {
    expect(findBank("cbe-new")?.code).toBe("cbe");
    expect(findBank("CBE-NEW")?.code).toBe("cbe");
    // reference-case keys its case rules on the manifest bank id, so the
    // alias gets CBE's rules too.
    expect(isCaseInsensitiveBank("cbe-new")).toBe(true);
    expect(canonicalReference("cbe-new", "ft26 sample01")).toBe(canonicalReference("cbe", "ft26 sample01"));
    // The UI's override names the alias; the check still goes to CBE.
    expect(detectInput("RCPT1SAMPLE0001", { overrideBank: "cbe-new" }).bank?.code).toBe("cbe");
  });

  it("is the only place in source that compares an id against the alias", () => {
    const root = resolve(__dirname, "../../src");
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (/\.[cm]?[jt]sx?$/.test(entry.name) && /(?<!\.parser) === "cbe-new"/.test(readFileSync(path, "utf8"))) {
          offenders.push(path.slice(root.length + 1));
        }
      }
    };
    walk(root);
    expect(offenders).toEqual([]);
  });
});
