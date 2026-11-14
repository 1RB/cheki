/**
 * Frontend labelling (CodeRabbit on PR #28): only `verified: true` may drive
 * green, "Verified" or a success toast. `success` only means the request was
 * handled; decodedOnly and parsed results are amber and never saved as checked.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { verificationState } from "@/lib/banks";
import { cliVerdict } from "@/cli/verdict";
import { isVerified } from "../../sdks/typescript/src/index";

describe("verificationState", () => {
  it("is verified only for success + verified:true", () => {
    expect(verificationState({ success: true, verified: true })).toBe("verified");
  });

  it("success without verified is never verified", () => {
    expect(verificationState({ success: true })).toBe("none");
    expect(verificationState({ success: true, verified: false })).toBe("none");
  });

  it("a decoded-only BOA QR is decodedOnly, even if verified is wrongly set", () => {
    expect(verificationState({ success: true, verified: false, decodedOnly: true })).toBe("decodedOnly");
    expect(verificationState({ success: true, verified: true, decodedOnly: true })).toBe("decodedOnly");
  });

  it("pasted content is parsed, even if verified is wrongly set", () => {
    expect(verificationState({ success: true, verified: false, parsed: true })).toBe("parsed");
    expect(verificationState({ success: true, verified: true, parsed: true })).toBe("parsed");
  });

  it("failed requests and missing results are none", () => {
    expect(verificationState({ success: false, verified: true })).toBe("none");
    expect(verificationState(null)).toBe("none");
    expect(verificationState(undefined)).toBe("none");
  });

  it("truthy non-boolean values do not count", () => {
    const loose = { success: true, verified: "true" } as unknown as Parameters<typeof verificationState>[0];
    expect(verificationState(loose)).toBe("none");
  });
});

// The homepage checker is now split into src/components/verify/* and
// src/lib/verify/*. Same invariants, retargeted to the new files.
describe("verify panel labels", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");
  const panel = read("src/components/verify/VerifyPanel.tsx");
  const card = read("src/components/verify/VerdictCard.tsx");
  const batch = read("src/components/verify/BatchPanel.tsx");
  const verdict = read("src/lib/verify/verdict.ts");
  const history = read("src/lib/verify/history.ts");
  const i18n = read("src/lib/i18n/translations.ts");

  it("no label or colour is keyed on `success` alone", () => {
    for (const src of [panel, card, batch, verdict]) {
      expect(src).not.toMatch(/result\?\.success\s*\?/);
      expect(src).not.toMatch(/r\.data\?\.success/);
      expect(src).not.toMatch(/result && result\.success &&/);
    }
  });

  it("the green verdict and the history save sit behind verificationState", () => {
    // Green is produced in exactly one place, inside the verified branch.
    const greens = [...verdict.matchAll(/tone: "green"/g)];
    expect(greens).toHaveLength(1);
    const before = verdict.slice(0, greens[0].index);
    expect(before.slice(before.lastIndexOf('if (state === "'))).toMatch(/^if \(state === "verified"\)/);
    expect(verdict).toMatch(/const state = verificationState\(result\)/);
    expect(i18n).toMatch(/Decoded from QR, not confirmed with the bank/);
    // History: the only writer refuses anything but a verified result.
    const addIdx = history.indexOf("export function addVerified");
    expect(history.slice(addIdx, addIdx + 500)).toMatch(/if \(verificationState\(result\) !== "verified"\) return list;/);
    expect(panel).toMatch(/addVerified\(/);
    expect(panel).not.toMatch(/localStorage\.setItem/);
    // The card never picks a colour itself.
    expect(card).not.toMatch(/var\(--green/);
  });

  it("the batch takes its colours from rowTone, which never makes green itself", () => {
    const batchLib = read("src/lib/verify/batch.ts");
    expect(batch).toMatch(/data-tone=\{rowTone\(r\)\}/);
    expect(batch).not.toMatch(/"green"|"red"|"amber"/);
    const fn = batchLib.slice(batchLib.indexOf("export function rowTone"), batchLib.indexOf("export function rowTone") + 400);
    expect(fn).not.toMatch(/return "green"/);
  });

  it("an image scan that throws still settles and frees its object URL", () => {
    const qr = read("src/lib/qr/decode.ts");
    const img = read("src/lib/image/prepare.ts");
    expect(qr).toMatch(/catch \{\s*return null;\s*\}/);
    expect(img).toMatch(/finally \{\s*URL\.revokeObjectURL\(url\);\s*\}/);
    expect(batch).toMatch(/decodeQrFromImage\(files\[i\]\)/);
  });

  it("the inline bookmarklet escapes the API error before innerHTML", () => {
    const src = read("src/components/verify/GeoFallback.tsx");
    expect(src).toMatch(/esc\(d\.error\|\|/);
    expect(src).not.toMatch(/'\+\(d\.error\|\|/);
  });
});


describe("CLI verdict", () => {
  it("only a verified receipt prints 'Receipt verified' and exits 0", () => {
    expect(cliVerdict({ verified: true })).toEqual({ headline: "Receipt verified", exitCode: 0 });
  });

  it("a decoded-only BOA QR is not verified and exits non-zero", () => {
    const v = cliVerdict({ verified: false, decodedOnly: true });
    expect(v.exitCode).not.toBe(0);
    expect(v.headline).toMatch(/NOT VERIFIED/);
    expect(cliVerdict({ verified: true, decodedOnly: true }).exitCode).not.toBe(0);
  });

  it("an unverified result exits non-zero", () => {
    expect(cliVerdict({ verified: false }).exitCode).not.toBe(0);
  });
});

// "Is this verified?" is decided in several places: the API's
// verificationState, the CLI, the batch count, the bookmarklet, and every SDK
// (which is a separate package and cannot import the API's copy). They must be
// one rule, so both TypeScript implementations are run against each other and
// against the rule as the docs state it, over every combination of the four
// flags. Each SDK's own suite runs the same matrix over its copy.
describe("one rule for verified, wherever it is decided", () => {
  type Flags = { success: boolean; verified: boolean; decodedOnly: boolean; parsed: boolean };
  const matrix: Flags[] = [];
  for (const success of [true, false]) {
    for (const verified of [true, false]) {
      for (const decodedOnly of [true, false]) {
        for (const parsed of [true, false]) matrix.push({ success, verified, decodedOnly, parsed });
      }
    }
  }
  /** The rule as the docs state it: a handled request that the bank confirmed. */
  const confirmed = (f: Flags) => f.success && f.verified && !f.decodedOnly && !f.parsed;

  it("covers all 16 combinations, exactly one of them verified", () => {
    expect(matrix).toHaveLength(16);
    expect(matrix.filter(confirmed)).toHaveLength(1);
  });

  it("verificationState, the SDK's isVerified and the CLI agree with it", () => {
    const bad: string[] = [];
    for (const f of matrix) {
      const want = confirmed(f);
      if ((verificationState(f) === "verified") !== want) bad.push(`verificationState ${JSON.stringify(f)}`);
      if (isVerified(f) !== want) bad.push(`isVerified ${JSON.stringify(f)}`);
      // The CLI is only ever handed a Receipt, which exists because the
      // request was handled: its half of the matrix is success: true.
      if (f.success && (cliVerdict(f).exitCode === 0) !== want) bad.push(`cliVerdict ${JSON.stringify(f)}`);
    }
    expect(bad).toEqual([]);
  });

  it("the batch count, the cache and the bookmarklet read the same state", () => {
    const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");
    const batchRoute = read("src/app/api/verify/batch/route.ts");
    expect(batchRoute).toMatch(/verificationState\(stateOf\(row\)\) === "verified"/);
    expect(batchRoute).not.toMatch(/verified === true\)\.length/);
    // The cache holds only what the rule calls verified, in both routes.
    for (const route of ["src/app/api/verify/route.ts", "src/app/api/verify/batch/route.ts"]) {
      const src = read(route);
      expect(src).toMatch(/if \(verificationState\(payload\) === "verified"\) setCached/);
      expect(src).not.toMatch(/value\.verified\) setCached/);
    }
    const geo = read("src/components/verify/GeoFallback.tsx");
    // The bookmarklet shows what it read only when the parse endpoint says
    // parsed, which is the state the verdict card shows amber.
    expect(geo).toMatch(/if\(d\.parsed===true\)\{/);
    expect(geo).not.toMatch(/d\.verified\|\|d\.parsed/);
  });
});
