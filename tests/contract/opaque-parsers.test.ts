/**
 * Where "the reference this bank is looked up by is not the reference printed
 * on the receipt" lives: on the parser (the only place that knows how its own
 * bank is looked up), passed into the gate as a flag, with the list of which
 * parsers set it shared with the Python SDK through
 * sdks/fixtures/api-contract.json (gate.opaqueLookupParsers).
 *
 * Three copies of that list, one comparison each, plus the same treatment for
 * geoBlocked: declared once in the manifest, read by BaseParser, never
 * re-declared by a parser.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import "@/lib/parsers";
import { getParser, getRegisteredBankIds } from "@/lib/parsers/registry";
import { getAllBanks } from "@/lib/manifest/loader";
import { verificationGate } from "@/lib/core/gate";
import { CBEParser, CBENewParser } from "@/lib/parsers/cbe";
import { TelebirrParser } from "@/lib/parsers/telebirr";
import { MpesaParser } from "@/lib/parsers/mpesa";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

const contract = JSON.parse(read("sdks/fixtures/api-contract.json")) as {
  gate: { opaqueLookupParsers: string[] };
};

const parsers = () => getRegisteredBankIds().map((id) => getParser(id)!);

describe("gate.opaqueLookupParsers", () => {
  it("is exactly the parsers that carry referenceIsOpaqueToken", () => {
    const flagged = parsers()
      .filter((p) => p.referenceIsOpaqueToken)
      .map((p) => p.bankId)
      .sort();
    expect(flagged).toEqual([...contract.gate.opaqueLookupParsers].sort());
  });

  it("names a registered parser for every entry", () => {
    for (const id of contract.gate.opaqueLookupParsers) {
      expect(getParser(id), id).toBeDefined();
    }
  });

  it("the gate takes the flag, never a bank id of its own", () => {
    const src = read("src/lib/core/gate.ts");
    expect(src).toContain("referenceIsOpaqueToken");
    expect(src).not.toMatch(/bankId/);
    expect(src).not.toMatch(/new Set\(/);
    // The verifier reads the flag off the parser it already looked up.
    const verifier = read("src/lib/core/verifier.ts");
    expect(verifier).toContain("referenceIsOpaqueToken: parser.referenceIsOpaqueToken");
  });

  it("the flag is what makes the gate skip the reference match", () => {
    const receipt = {
      verified: true,
      amount: 100,
      senderName: "Payer",
      receiverName: "Receiver",
      reference: "PRINTED123",
    };
    for (const id of contract.gate.opaqueLookupParsers) {
      const parser = getParser(id)!;
      expect(
        verificationGate(receipt, { referenceIsOpaqueToken: parser.referenceIsOpaqueToken, requestedReference: "SHARETOKEN" }),
        id
      ).toEqual({ ok: true });
      // Without the flag the same receipt is rejected: the exemption can only
      // come from the parser saying so.
      expect(verificationGate(receipt, { requestedReference: "SHARETOKEN" }), id).toMatchObject({
        ok: false,
        reason: "reference",
      });
    }
  });
});

describe("geoBlocked is declared in the manifest and read by the parser", () => {
  it("the manifest declares exactly Telebirr and M-Pesa", () => {
    const declared = getAllBanks()
      .filter((b) => b.geoBlocked === true)
      .map((b) => b.id)
      .sort();
    expect(declared).toEqual(["mpesa", "telebirr"]);
  });

  it("the two banks that answer only in Ethiopia report it, the others do not", () => {
    expect(new TelebirrParser().geoBlocked).toBe(true);
    expect(new MpesaParser().geoBlocked).toBe(true);
    expect(new CBEParser().geoBlocked).toBe(false);
    expect(new CBENewParser().geoBlocked).toBe(false);
  });

  it("no parser declares a second copy of it", () => {
    expect(read("src/lib/parsers/base.ts")).toContain("getBank(this.bankId)?.geoBlocked === true");
    // Any `geoBlocked = ...` in a parser is a second declaration; the only
    // one allowed is base.ts's `=== true` comparison with the manifest.
    const dir = join(__dirname, "..", "..", "src", "lib", "parsers");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      if (file === "base.ts") continue;
      expect(read(`src/lib/parsers/${file}`), file).not.toMatch(/geoBlocked\s*=(?!=)/);
    }
  });
});
