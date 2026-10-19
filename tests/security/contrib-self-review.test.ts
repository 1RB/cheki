/**
 * Self-review of #27 on top of #3 + #28:
 *   - submitted values lose C1 controls and invisible bidi/zero-width
 *     characters, so a forwarded link or credit can't read differently from
 *     what it is
 *   - the reference error says what the check actually accepts
 *   - internal links added by #27 use next/link
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { formatTelegramMessage, tidy, validateContribution } from "@/lib/contribute";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");
const base = { bank: "zemen", consent: true };

describe("tidy", () => {
  it("removes bidi overrides, isolates, zero-width characters, BOM and C1 controls", () => {
    expect(tidy("evil\u202Egpj.exe")).toBe("evil gpj.exe");
    expect(tidy("a\u2066b\u2069c")).toBe("a b c");
    expect(tidy("x\u200By\u200Dz\uFEFF")).toBe("x y z");
    expect(tidy("p\u0085q\u009Br")).toBe("p q r");
    expect(tidy("  plain  text ")).toBe("plain text");
  });

  it("keeps Amharic and other visible text", () => {
    expect(tidy("ሰላም cheki")).toBe("ሰላም cheki");
  });
});

describe("validateContribution", () => {
  it("strips invisible characters from the credit and link before they reach Telegram", () => {
    const r = validateContribution({
      ...base,
      link: "https://share.zemenbank.com/rt/ABCDEFGH1234567890123456/pdf\u202E",
      credit: "Abebe\u202Eevil\u200B",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const text = formatTelegramMessage(r.value, "2026-10-11T00:00:00Z");
    expect(text).not.toMatch(/[\u200b-\u200f\u202a-\u202e\u2060-\u2069\ufeff]/);
    expect(r.value.credit).toBe("Abebe evil");
  });

  it("explains which characters a reference may use", () => {
    const r = validateContribution({ bank: "zemen", consent: true, reference: "AB 12?x" });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("letters and digits");
    expect(r.error).toContain("64");
    const okRef = validateContribution({ bank: "zemen", consent: true, reference: "AB-12_x.y/z" });
    expect(okRef.ok).toBe(true);
  });
});

describe("internal links added by #27", () => {
  const files = ["src/app/status/page.tsx", "src/app/endpoints/page.tsx", "src/app/banks/[code]/page.tsx"];
  it.each(files)("%s uses next/link for site pages", (f) => {
    const src = read(f);
    expect(src).toContain('import Link from "next/link"');
    // Same-page anchors (#id) and static files (/status.json) may stay <a>.
    const internal = [...src.matchAll(/<a href=\{?[`"](\/[^`"]*)[`"]/g)].map((m) => m[1]);
    expect(internal.filter((h) => !h.endsWith(".json"))).toEqual([]);
  });

  it("docs links to /endpoints and /status use next/link", () => {
    const src = read("src/app/docs/page.tsx");
    expect(src).toContain('<Link href="/endpoints"');
    expect(src).toContain('<Link href="/status"');
  });
});
