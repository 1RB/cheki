/**
 * public/llms.txt follows the llmstxt.org format and agrees with the code:
 *
 *   - an H1 name, a > summary, detail text with no headings, then H2 sections
 *     that hold only `- [Title](url): description` lists, with ## Optional last
 *   - every live bank id is listed, in-development banks are marked so
 *   - the error codes, rate limits and SDK versions match their sources
 *   - examples use the synthetic sample receipt, and no full account number
 *
 * It is served as a static file from public/, so there is nothing to build.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { liveProviders, LIVE_BANK_COUNT, IN_DEVELOPMENT_BANK_COUNT } from "@/lib/bank-counts";
import { getAllBanks } from "@/lib/manifest/loader";
import { RATE_LIMITS } from "@/lib/rate-limit-config";
import { SAMPLE, SAMPLE_VERIFY_RESPONSE } from "@/lib/sample-receipt";

const ROOT = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const txt = read("public/llms.txt");
const lines = txt.split("\n");

/** Lines outside fenced code blocks. */
const prose = (() => {
  let fenced = false;
  return lines.filter((l) => {
    if (l.startsWith("```")) {
      fenced = !fenced;
      return false;
    }
    return !fenced;
  });
})();

describe("llms.txt structure (llmstxt.org)", () => {
  it("opens with an H1 and a blockquote summary", () => {
    expect(lines[0]).toBe("# cheki");
    expect(lines[1]).toBe("");
    expect(lines[2]).toMatch(/^> \S/);
  });

  it("has one H1 and no H3 or deeper headings", () => {
    expect(prose.filter((l) => /^# /.test(l))).toHaveLength(1);
    expect(prose.filter((l) => /^#{3,} /.test(l))).toEqual([]);
  });

  it("H2 sections hold only link lists, and Optional comes last", () => {
    const first = lines.findIndex((l) => l.startsWith("## "));
    expect(first).toBeGreaterThan(3);
    const sections = lines.slice(first).filter((l) => l.startsWith("## ")).map((l) => l.slice(3));
    expect(sections.at(-1)).toBe("Optional");
    expect(new Set(sections).size).toBe(sections.length);
    for (const l of lines.slice(first)) {
      if (l === "" || l.startsWith("## ")) continue;
      expect(l).toMatch(/^- \[[^\]]+\]\(https:\/\/[^)\s]+\)(: \S.*)?$/);
    }
  });

  it("links point at cheki pages that exist", () => {
    const urls = [...txt.matchAll(/\]\((https:\/\/cheki\.et\/[^)#]*)/g)].map((m) => m[1]);
    for (const u of urls) {
      const path = u.replace("https://cheki.et/", "");
      if (path.startsWith("api/")) continue;
      const guide = path.match(/^guides\/(.+)$/);
      if (guide) expect(read("src/lib/guides.ts"), u).toContain(`slug: "${guide[1]}"`);
      else expect(() => read(`src/app/${path}/page.tsx`), u).not.toThrow();
    }
  });
});

describe("llms.txt facts", () => {
  it("lists every live bank id and its counts", () => {
    for (const b of liveProviders) expect(txt, b.id).toMatch(new RegExp("^- `" + b.id + "` ", "m"));
    expect(txt).toContain(`${LIVE_BANK_COUNT} live banks`);
    expect(txt).toContain(`${IN_DEVELOPMENT_BANK_COUNT} in research`);
    for (const b of getAllBanks().filter((x) => x.beta)) {
      expect(lines.find((l) => l.startsWith("- `" + b.id + "` ")), b.id).toContain("(beta)");
    }
  });

  it("describes M-Pesa as a JSON envelope holding a base64 PDF", () => {
    const mpesa = getAllBanks().find((b) => b.id === "mpesa")!;
    expect(mpesa.formats?.[0].responseType).toBe("pdf-in-json");
    expect(txt).toMatch(/M-Pesa: [^\n]*JSON envelope[^\n]*base64Data[^\n]*PDF/);
    expect(txt).not.toMatch(/M-Pesa[^\n]*returns JSON\s*$/m);
  });

  it("quotes the error codes the routes return", () => {
    for (const code of ["400", "404", "413", "422", "429", "502"]) expect(txt).toMatch(new RegExp(`\\b${code}\\b`));
    expect(txt).toMatch(/502[^.]*fallbackUrl/);
    expect(txt).toContain("Retry-After");
  });

  it("quotes the rate limits from rate-limit-config", () => {
    expect(txt).toContain(`verify ${RATE_LIMITS.verify.limit} per minute`);
    expect(txt).toContain(`batch ${RATE_LIMITS.batch.limit} per minute`);
    expect(txt).toContain(`parse and ocr ${RATE_LIMITS.parse.limit} per minute`);
    expect(RATE_LIMITS.ocr.limit).toBe(RATE_LIMITS.parse.limit);
  });

  it("names the SDK packages at their current version", () => {
    const version = JSON.parse(read("sdks/typescript/package.json")).version as string;
    expect(read("python/pyproject.toml")).toContain(`version = "${version}"`);
    expect(read("sdks/dart/pubspec.yaml")).toContain(`version: ${version}`);
    expect(read("sdks/go/cheki.go")).toContain(`const Version = "${version}"`);
    expect(txt).toContain(`all at version ${version}`);
    for (const s of ["npm install cheki-verify", "pip install cheki", "composer require cheki/cheki", "go get github.com/1RB/cheki/sdks/go", "dart pub add cheki", "cheki-verify cbe"]) {
      expect(txt).toContain(s);
    }
  });
});

describe("llms.txt examples are synthetic", () => {
  it("uses the sample receipt", () => {
    expect(txt).toContain(SAMPLE.receiptUrl);
    expect(txt).toContain(SAMPLE.reference);
    for (const k of ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount"] as const) {
      expect(txt, k).toContain(JSON.stringify(SAMPLE_VERIFY_RESPONSE[k]));
    }
  });

  it("shows no unmasked account number", () => {
    expect(txt).not.toMatch(/\b\d{10,}\b/);
    expect(txt).not.toContain(SAMPLE.accountNumber);
  });
});
