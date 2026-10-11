/**
 * Public API docs must match what the routes enforce (CodeRabbit on PR #28):
 * the batch cap is 20, the routes are rate limited per IP, and the CBE Birr
 * field is phoneNumber.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", p), "utf8");

describe("API docs claims", () => {
  const docs = read("src/app/docs/page.tsx");
  const developers = read("src/app/developers/page.tsx");
  const readme = read("README.md");

  it("no page claims there is no rate limit", () => {
    for (const src of [docs, developers, readme]) {
      expect(src).not.toMatch(/no rate limit/i);
    }
  });

  it("documents the per-IP limits and the 429 response", () => {
    expect(docs).toMatch(/code: "429"/);
    expect(docs).toMatch(/Retry-After/);
    for (const src of [docs, developers]) {
      expect(src).toMatch(/verify 30 per minute/);
      expect(src).toMatch(/batch\s+5 per minute/);
      expect(src).toMatch(/parse and ocr 20 per minute each/);
    }
  });

  it("states the batch cap the route enforces", async () => {
    expect(docs).toMatch(/Max 20\./);
    expect(docs).not.toMatch(/Max 50/);
    expect(readme).not.toMatch(/up to 50 receipts/);
  });

  it("names the CBE Birr phone field the API reads", () => {
    expect(docs).toMatch(/name: "phoneNumber"/);
    expect(docs).not.toMatch(/name: "phone",/);
  });
});
