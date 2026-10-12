/**
 * Open Graph cards (src/lib/og, src/app/**\/opengraph-image.tsx):
 *   - the receipt on a card is synthetic: a DEMO reference, never receipt data
 *   - no hardcoded counts, no "OSS" pill, no "Free. Forever." line
 *   - the fonts the cards load exist (a missing file would fall back to tofu)
 *   - copy helpers: "a"/"an", and M-Pesa never breaks at its hyphen
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { demoReference, nobreak, withArticle } from "@/lib/og/card";
import { BANK_LOGOS, bankLogoSpec } from "@/lib/bank-logos";
import { banks } from "@/lib/banks";

const root = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const OG_FILES = [
  "src/lib/og/card.tsx",
  "src/app/opengraph-image.tsx",
  "src/app/twitter-image.tsx",
  "src/app/banks/[code]/opengraph-image.tsx",
  "src/app/verify/[slug]/opengraph-image.tsx",
];

describe("OG cards", () => {
  it("every bank's card reference is an obvious DEMO value", () => {
    for (const b of banks) expect(demoReference(b.code), b.code).toMatch(/DEMO/);
  });

  it("carry no counts, pills or stale slogans", () => {
    for (const f of OG_FILES) {
      const src = read(f);
      expect(src, f).not.toMatch(/BANK_COUNT|liveProviders\.length/);
      expect(src, f).not.toMatch(/>\s*OSS\s*</);
      expect(src, f).not.toMatch(/Free\. Forever/);
      expect(src, f).not.toMatch(/linear-gradient|radial-gradient/);
      expect(src, f).not.toMatch(/textTransform:\s*"uppercase"/);
    }
  });

  it("load fonts that exist", () => {
    const src = read("src/lib/og/card.tsx");
    const files = [...src.matchAll(/file: "([^"]+\.ttf)"/g)].map((m) => m[1]);
    expect(files.length).toBeGreaterThanOrEqual(5);
    for (const f of files) expect(existsSync(join(root, "src/lib/og/fonts", f)), f).toBe(true);
  });

  it("pick a/an and keep hyphenated names whole", () => {
    expect(withArticle("CBE")).toBe("a CBE");
    expect(withArticle("Awash")).toBe("an Awash");
    expect(withArticle("eBirr")).toBe("an eBirr");
    expect(withArticle("M-Pesa")).toBe("an M-Pesa");
    expect(nobreak("M-Pesa")).toBe("M\u2011Pesa");
  });

  it("bank marks match the checker's logos", () => {
    expect(bankLogoSpec("cbe")).toEqual(BANK_LOGOS.cbe);
    expect(bankLogoSpec("zamzam").label).toBe("ZZB");
    expect(bankLogoSpec("hijra")).toMatchObject({ label: "HIJ", color: "#666" });
  });
});
