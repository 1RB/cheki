/**
 * Regression tests for the self-review pass on PR #28.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as batchPOST } from "@/app/api/verify/batch/route";
import { Verifier } from "@/lib";
import { classifyStatus } from "@/lib/core/status";
import { verificationGate } from "@/lib/core/gate";
import { clearCache } from "@/lib/receipt-cache";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  clearCache();
});

let ip = 0;
const freshIp = () => ({ "x-real-ip": `10.88.${Math.floor(++ip / 250)}.${ip % 250}` });

const boaBody = (ref: string) =>
  JSON.stringify({
    body: [{
      "Source Account Name": "PAYER",
      "Source Account": "2****3957",
      "Receiver's Name": "SHOP",
      "Receiver's Account": "1****42674",
      "Transferred Amount": "500.00",
      "Transaction Date": "16/06/2026 20:29:42",
      "Transaction Reference": ref,
    }],
  });

describe("batch response counts", () => {
  it("reports verified and failed counts that only count verified:true", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (String(url).includes("FT26167GOOD1")) return new Response(boaBody("FT26167GOOD1"), { status: 200 });
        return new Response(JSON.stringify({ body: [{ "Payer's Name": "Invalid reference number" }] }), { status: 200 });
      })
    );
    const receipts = [
      { bank: "boa", reference: "FT26167GOOD1", accountNumber: "1000005842674" },
      { bank: "boa", reference: "FT26167BAD22", accountNumber: "1000005842674" },
      { bank: "nope", reference: "X1" },
    ];
    const res = await batchPOST(
      new NextRequest("https://cheki.et/api/verify/batch", {
        method: "POST",
        headers: { "content-type": "application/json", ...freshIp() },
        body: JSON.stringify({ receipts }),
      })
    );
    const json = await res.json();
    expect(json.total).toBe(3);
    expect(json.verified).toBe(1);
    expect(json.failed).toBe(2);
    expect(json.results[0].verified).toBe(true);
    expect(json.results[1].success).toBe(false);
  });
});

describe("bank code length", () => {
  it("a huge bank value is rejected without fuzzy matching and is not echoed in full", async () => {
    const v = new Verifier();
    const huge = "z".repeat(15_000);
    const t0 = Date.now();
    const r = await v.verify({ bank: huge, reference: "FT123" });
    expect(Date.now() - t0).toBeLessThan(200);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.kind).toBe("BANK_NOT_SUPPORTED");
      expect(JSON.stringify(r.error).length).toBeLessThan(200);
    }
  });
});

describe("status classification", () => {
  it.each(["Chargeback", "Charge back", "Disputed", "Suspended", "Rolled back", "Returned", "Bounced"])(
    "%s is a failure and fails the gate",
    (status) => {
      expect(classifyStatus(status)).toBe("failure");
      const gate = verificationGate(
        { verified: true, amount: 100, senderName: "A", reference: "R1", transactionStatus: status },
        { bankId: "telebirr", requestedReference: "R1" }
      );
      expect(gate.ok).toBe(false);
    }
  );

  it("genuine completed statuses still pass", () => {
    for (const s of ["Completed", "Success", "Successful", "Paid", "Transaction Successful"]) {
      expect(classifyStatus(s)).toBe("success");
    }
  });
});
