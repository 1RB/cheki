/**
 * The batch route trusts verifyBatch to fill one row per input. When that
 * invariant breaks the answer must be a real 500, not HTTP 200 carrying a
 * fabricated per-receipt "No result." failure: the SDKs count rows, so a
 * fake row would be reported as a receipt that failed verification, which
 * is a different fact from "the batch did not run".
 *
 * The Verifier is mocked here on purpose: only its contract with the route
 * (one Result per request, or a bug) is under test.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as batchPOST } from "@/app/api/verify/batch/route";

const state = vi.hoisted(() => ({
  /** What verifyBatch answers: undefined means "return one ok row per request". */
  batchResults: undefined as unknown[] | undefined,
}));

vi.mock("@/lib", () => ({
  Verifier: class {
    async verifyBatch(requests: unknown[]): Promise<unknown[]> {
      if (state.batchResults) return state.batchResults;
      return requests.map(() => ({ ok: true, value: { verified: true, bank: "telebirr", reference: "CHQ0SAMPLE" } }));
    }
  },
  errorToHttpStatus: () => 500,
  errorPayload: () => ({ success: false, error: "payload" }),
}));

let ipCounter = 0;
async function postBatch(body: unknown): Promise<Response> {
  ipCounter++;
  return batchPOST(
    new NextRequest("https://cheki.et/api/verify/batch", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `10.77.${ipCounter}.1` },
      body: JSON.stringify(body),
    })
  );
}

afterEach(() => {
  state.batchResults = undefined;
});

describe("/api/verify/batch invariant", () => {
  it("answers 200 with one row per input when verifyBatch holds up its side", async () => {
    const r = await postBatch({ receipts: [{ bank: "telebirr", reference: "CHQ0SAMPLE1" }] });
    expect(r.status).toBe(200);
    const body = await r.json();
    expect(body.success).toBe(true);
    expect(body.total).toBe(1);
    expect(body.results).toHaveLength(1);
  });

  it("turns a missing row into a real 500, not a fake per-receipt failure", async () => {
    state.batchResults = [];
    const r = await postBatch({ receipts: [{ bank: "telebirr", reference: "CHQ0SAMPLE2" }] });
    expect(r.status).toBe(500);
    const body = await r.json();
    expect(body).toEqual({ success: false, error: "Internal server error." });
    expect(body.error).not.toBe("No result.");
  });
});
