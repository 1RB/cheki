/**
 * parseResponse (src/lib/core/verifier.ts) decides how each parser's response
 * body is read: a PDF table (cbe, dashen, zemen) plus a named branch per
 * parser needing byte- or wording-level handling before parser.parse() runs.
 * Everything else takes the generic path (parser.parse plus the generic
 * "not found" error). Which parsers get which was implicit in the chain, so:
 *
 *  - the named ids are read from verifier.ts's own source, so the test can
 *    never drift from the chain it is checking;
 *  - every registered parser must be classified (named below or in the
 *    chain), so registering a parser fails here until someone states how its
 *    response is read;
 *  - a name for a parser that no longer registers fails too (stale branch).
 *
 * The branches are id-keyed with their own returns, so their order carries no
 * meaning: this pins membership, not precedence.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import "@/lib/parsers";
import { getRegisteredBankIds } from "@/lib/parsers/registry";

const SOURCE = readFileSync(resolve(__dirname, "../../src/lib/core/verifier.ts"), "utf8");

/** The parser ids the chain names, read from its source (see file header). */
function namedIds(): Set<string> {
  const start = SOURCE.indexOf("private async parseResponse");
  const end = SOURCE.indexOf("private async verifyBoaQr");
  expect(start, "parseResponse marker missing from verifier.ts").toBeGreaterThan(0);
  expect(end, "verifyBoaQr marker missing from verifier.ts").toBeGreaterThan(start);
  const region = SOURCE.slice(start, end);
  const named = new Set<string>();
  for (const m of region.matchAll(/if \(id === "([a-z0-9-]+)"\)/g)) named.add(m[1]);
  // pdfParsers table entries: `cbe: { extract: ...`.
  for (const m of region.matchAll(/([a-z][a-z0-9-]*): \{ extract: /g)) named.add(m[1]);
  expect(named.size, "no dispatch names found: the source markers or patterns changed").toBeGreaterThan(0);
  return named;
}

/** Parsers whose response parser.parse() reads as-is (plain HTML or JSON). */
const GENERIC = ["awash", "cbe-new", "ebirr", "siinqee-ebirr", "telebirr"];

describe("parseResponse dispatch", () => {
  it("classifies every registered parser: named in the chain or listed as generic", () => {
    const named = namedIds();
    for (const id of getRegisteredBankIds()) {
      expect(
        named.has(id) || GENERIC.includes(id),
        `parser "${id}": add its branch in parseResponse, or list it as generic in this test`
      ).toBe(true);
    }
  });

  it("keeps no name or generic entry for a parser that is gone, and never both", () => {
    const named = namedIds();
    const registered = getRegisteredBankIds();
    for (const id of named) expect(registered, `stale branch for "${id}"`).toContain(id);
    for (const id of GENERIC) {
      expect(registered, `stale generic entry "${id}"`).toContain(id);
      expect(named.has(id), `${id} is generic and named`).toBe(false);
    }
    // The classification is complete and disjoint: every registered parser is
    // covered exactly once (10 named + 5 generic = 15 today).
    const covered = [...registered].filter((id) => named.has(id) || GENERIC.includes(id));
    expect(new Set(covered).size).toBe(registered.length);
  });
});
