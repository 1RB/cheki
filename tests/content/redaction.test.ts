/**
 * Examples and fixtures carry no real receipt data.
 *
 * Earlier versions of the docs, guides, README, SDK READMEs and test fixtures
 * quoted real receipts: payer and payee names, account and phone numbers, and
 * references, Receipt IDs and share tokens that still open the real receipt at
 * the bank. They were replaced with synthetic values (src/lib/sample-receipt.ts
 * for public examples). This suite keeps them out:
 *
 *   - the public sample matches the SDK contract fixture, so every example
 *     tells the same synthetic story
 *   - no tracked text file contains a removed token. The tokens are stored
 *     only as truncated SHA-256 hashes, so this file does not republish them.
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { SAMPLE, SAMPLE_VERIFY_RESPONSE } from "@/lib/sample-receipt";
import { getArticle } from "@/lib/guides";
import { DEFAULT_TTL_MS } from "@/lib/receipt-cache";

const ROOT = join(__dirname, "..", "..");

/** sha256(token).slice(0, 16) of every removed name, number and reference (lowercase). */
const REMOVED = new Set([
  "f6f14eef263b5e35", "0706ce4e05b06b58", "fa11411df0d41a91", "6413e980efe87b87",
  "728b216c0243c177", "7c87891cb7e96ad4", "0da6238de4c10f85", "6de1a8b311391bd1",
  "7e2e312f9fe30072", "09c1dfdd8594c18d", "87c93114935709d0", "7b8762f090eb7c10",
  "da1f6560871dd356", "9754bb2389aefb67", "ce33336688a6552a", "f4ab68d8111e8f41",
  "63985363dd54da2b", "e99948e882ae5ac6", "728f2d14b8e380c5", "d5548580714ad7d9",
  "328207d987009fd9", "64abc7b364ab2bf9", "9a8ab61e49be0855", "13965dab43a20e1e",
  "8351ae320f64af69", "f353fed544e274cd", "8d9217e0d15c5f91", "b798992877297910",
  "d36e51f72d47da9a", "6b32f209a0ead36e", "451bdc7e71e83e0f", "0dcfc3ac412995df",
  "bfa8036aca27ac91", "75142f57363f99c6", "2983389e53260581", "8bbb7b657491ce68",
  "f1aefed1feaffe52", "00054d2d225e94fa", "5789edb39001cc68", "bc90927cc05fc6ea",
  "d548c95c563a5c65", "6e08d5f2dd1b8ecc", "9ca9531f882e98a3", "2a7579171c308cde",
  "ab9452e2dfdf69a6", "1ab2e2d47576381a", "d495f990889d57c4", "ecd95a448c08fb17",
  "8e56fef22facfad4", "199cdc0b19750920", "0d72cf03c2898fca", "b38e671792b045b9",
  "4eca2411f5c73a12", "44f14f8f19ac7820", "0290443767852267", "3e6f6266310d1aa3",
  "c951b7911e29686b", "99f06d44783cc041", "9ae19d5bfd1281fb", "401b0ccaecf79cda",
  "08841df14f3499a5", "250e00e43b17f328", "e973b88d001dc958", "02681f5724c58c0e",
  "f328ebf0adfdf818", "3c379065194bb4f0",
  // Telebirr transaction numbers and a Dashen FT Ref / Transfer Reference
  // that were examples since v0.3 (one was noted as a tested real receipt).
  "273a5a17fe85e249", "a2bdebdd9cef38e0", "935c4fdfa8d08d3b", "df34b5b0dfb39ce6",
  "a0eae1dbd6284cf3",
]);

const SKIP_DIRS = new Set(["node_modules", ".next", ".git", "vendor", "build", "dist", ".dart_tool", "__pycache__", ".venv"]);
const TEXT = /\.(tsx?|jsx?|mjs|cjs|json|md|txt|html|ya?ml|py|go|php|dart|toml|sh|css)$/;

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (SKIP_DIRS.has(name)) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return TEXT.test(name) && name !== "package-lock.json" && name !== "CHANGELOG.md" ? [p] : [];
  });
}

/** Words, plus the parts of camelCase or run-together words ("PayerNameAbebe"). */
function tokens(text: string): Set<string> {
  const out = new Set<string>();
  for (const raw of text.match(/[A-Za-z0-9]+/g) ?? []) {
    out.add(raw.toLowerCase());
    for (const part of raw.split(/(?<=[a-z])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/)) out.add(part.toLowerCase());
  }
  return out;
}

const hash = (t: string) => createHash("sha256").update(t).digest("hex").slice(0, 16);

describe("public examples use the synthetic sample receipt", () => {
  const contract = JSON.parse(readFileSync(join(ROOT, "sdks/fixtures/api-contract.json"), "utf8"));
  const fixture = contract.cases.verify_verified.body;

  it("matches the contract fixture's verified CBE receipt", () => {
    for (const k of ["senderName", "senderAccount", "receiverName", "receiverAccount", "amount", "currency", "date", "reference", "reason"] as const) {
      expect(SAMPLE_VERIFY_RESPONSE[k], k).toBe(fixture[k]);
    }
    expect(fixture.sourceUrl).toBe(`https://apps.cbe.com.et:100/?id=${SAMPLE.reference}${SAMPLE.accountNumber.slice(-8)}`);
  });

  it("masks accounts the way cheki returns them", () => {
    expect(SAMPLE.senderAccount).toMatch(/^\d\*{4}\d{4}$/);
    expect(SAMPLE.receiverAccount.slice(-4)).toBe(SAMPLE.accountNumber.slice(-4));
  });

  it("the docs and developers pages read their responses from it", () => {
    for (const p of ["src/app/docs/page.tsx", "src/app/developers/page.tsx"]) {
      expect(readFileSync(join(ROOT, p), "utf8"), p).toMatch(/from "@\/lib\/sample-receipt"/);
    }
  });
});

describe("the redaction how-to", () => {
  for (const slug of ["payment-fraud-ethiopia", "contribute-new-bank"]) {
    it(`is in the ${slug} guide`, () => {
      const blocks = getArticle(slug)!.content;
      expect(blocks.some((b) => b.type === "heading" && b.id === "redact-before-sharing")).toBe(true);
    });
  }

  it("says what cheki keeps the way the cache and the privacy page do", () => {
    const text = JSON.stringify(getArticle("payment-fraud-ethiopia")!.content);
    expect(text).toContain(`up to ${Math.round(DEFAULT_TTL_MS / 3_600_000)} hours`);
    expect(text).toContain("no database");
    expect(text).toMatch(/Account numbers.*Phone numbers.*Full names.*The reference, Receipt ID/);
  });
});

describe("no real receipt data in the repo", () => {
  it("no tracked text file contains a removed name, number or reference", () => {
    const hits: string[] = [];
    for (const file of walk(ROOT)) {
      for (const t of tokens(readFileSync(file, "utf8"))) {
        if (REMOVED.has(hash(t))) hits.push(`${relative(ROOT, file)} (token hash ${hash(t)})`);
      }
    }
    expect(hits).toEqual([]);
  });
});
