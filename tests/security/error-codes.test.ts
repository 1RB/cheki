/**
 * A 422 must say *what it means* as data (ChekiErrorCode), because the
 * verdict card classifies on it. Before this contract, the card recovered
 * "failed / pending / mismatch / not found" by regexing the English message,
 * so rewording a gate or parser copy silently changed what a receipt was
 * judged to be. These tests pin both halves: every producer sets a code, and
 * no verdict branch pattern-matches prose.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "../..");

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...tsFiles(p));
    else if (p.endsWith(".ts") && !p.endsWith(".d.ts")) out.push(p);
  }
  return out;
}

/** Every object literal passed to `err({ ... })`, with its span, brace-matched. */
function errObjects(source: string): { start: number; end: number; text: string }[] {
  const blocks: { start: number; end: number; text: string }[] = [];
  let from = 0;
  for (;;) {
    const at = source.indexOf("err({", from);
    if (at < 0) break;
    let depth = 0;
    let i = at + 3;
    for (; i < source.length; i++) {
      if (source[i] === "{") depth++;
      else if (source[i] === "}") {
        depth--;
        if (depth === 0) break;
      }
    }
    blocks.push({ start: at, end: i + 1, text: source.slice(at, i + 1) });
    from = i + 1;
  }
  return blocks;
}

describe("every 422 producer sets a code", () => {
  const files = tsFiles(join(root, "src"));

  it("finds the producers at all (the scan is not silently empty)", () => {
    const total = files.reduce(
      (n, f) => n + (readFileSync(f, "utf8").match(/kind: "EXTRACTION_ERROR"/g)?.length ?? 0),
      0
    );
    expect(total).toBeGreaterThan(15);
  });

  it("an EXTRACTION_ERROR built with err({ ... }) always carries code:", () => {
    const missing: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const rel = file.slice(root.length + 1);
      for (const block of errObjects(src)) {
        if (block.text.includes('kind: "EXTRACTION_ERROR"') && !/\bcode:/.test(block.text)) {
          missing.push(`${rel}: ${block.text.slice(0, 120).replace(/\s+/g, " ")}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it("no EXTRACTION_ERROR is built outside err({ ... }) where the scan could miss it", () => {
    const strays: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const rel = file.slice(root.length + 1);
      const blocks = errObjects(src);
      let from = 0;
      for (;;) {
        const at = src.indexOf('kind: "EXTRACTION_ERROR"', from);
        if (at < 0) break;
        from = at + 1;
        // `kind: "EXTRACTION_ERROR";` with a semicolon is the union member in
        // core/types.ts, not a producer.
        if (src.slice(at + 24).trimStart().startsWith(";")) continue;
        if (!blocks.some((b) => b.start < at && at < b.end)) strays.push(`${rel}:${src.slice(0, at).split("\n").length}`);
      }
    }
    expect(strays).toEqual([]);
  });
});

describe("the verdict never pattern-matches prose", () => {
  const verdict = readFileSync(join(root, "src/lib/verify/verdict.ts"), "utf8");

  it("the failure branch has no regex over the error message", () => {
    const start = verdict.indexOf("if (result.success !== true)");
    const end = verdict.indexOf("── A handled request");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const failureBranch = verdict.slice(start, end);
    // cleanError() and the https check are formatting, not classification.
    expect(failureBranch).not.toMatch(/\.(?:test|exec)\((?:message|result\.error|result\?\.error)\)/);
  });

  it("the 422 branch switches on the code", () => {
    const start = verdict.indexOf("if (status === 422)");
    const end = verdict.indexOf("if (status === 400 || status === 404)");
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    const branch = verdict.slice(start, end);
    expect(branch).toContain("switch (result.code)");
    for (const code of ["gate:status", "gate:reference", "gate:amount", "gate:party", "notFound:otherAccount"]) {
      expect(branch).toContain(`"${code}"`);
    }
  });
});
