import { describe, expect, it } from "vitest";
import { buildShareLink, parseShareHash } from "@/lib/verify/share-link";

describe("re-check share links", () => {
  it("round-trips a reference with its bank and account digits", () => {
    const link = buildShareLink({ input: "FT00000SAMPLE", bank: "boa", extra: "12345" });
    expect(link).toBe("https://cheki.et/#r=FT00000SAMPLE&b=boa&x=12345");
    expect(parseShareHash(new URL(link).hash)).toEqual({ input: "FT00000SAMPLE", bank: "boa", extra: "12345" });
  });

  it("carries a full receipt link safely", () => {
    const receipt = "https://mbreciept.cbe.com.et/SAMPLE0000000001";
    const link = buildShareLink({ input: receipt });
    expect(parseShareHash(new URL(link).hash)).toEqual({ input: receipt });
  });

  it("keeps everything in the fragment, never the path or query", () => {
    const u = new URL(buildShareLink({ input: "DET0SAMPLE", bank: "telebirr" }, "https://cheki.et/"));
    expect(u.pathname).toBe("/");
    expect(u.search).toBe("");
  });

  it("drops a bank that is not live and rejects malformed fragments", () => {
    expect(buildShareLink({ input: "X1", bank: "nope" })).toBe("https://cheki.et/#r=X1");
    expect(parseShareHash("")).toBeNull();
    expect(parseShareHash("#faq")).toBeNull();
    expect(parseShareHash("#r=")).toBeNull();
    expect(parseShareHash("#r=FT1&b=nope")).toBeNull();
    expect(parseShareHash("#r=FT1&x=<script>")).toBeNull();
    expect(parseShareHash(`#r=${"A".repeat(2000)}`)).toBeNull();
  });
});
