import { NextRequest, NextResponse } from "next/server";
import { Verifier, errorToHttpStatus, errorToMessage } from "@/lib";
import { getCached, setCached, verificationCacheKey } from "@/lib/receipt-cache";
import { limiters, rateLimited } from "@/lib/rate-limit";
import { readJsonCapped, bodyErrorResponse } from "@/lib/http/read-body";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const regions = ["fra1"];
// The verifier runs at most 5 receipts at a time (BATCH_CONCURRENCY), each
// with at most 2 bank attempts, so 20 receipts fit well inside this.
export const maxDuration = 60;

const verifier = new Verifier();
const MAX_BATCH_SIZE = 20;
const MAX_BODY_BYTES = 64 * 1024;

type ReceiptInput = {
  bank: string;
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  qrData?: string;
};

export async function POST(request: NextRequest) {
  const limited = rateLimited(limiters.batch, request.headers);
  if (limited) return limited;

  try {
    let body: { receipts?: unknown };
    try {
      body = await readJsonCapped<{ receipts?: unknown }>(request, MAX_BODY_BYTES);
    } catch (e) {
      const be = bodyErrorResponse(e);
      if (be) return NextResponse.json({ success: false, error: be.error }, { status: be.status });
      throw e;
    }
    const receipts = body && typeof body === "object" ? body.receipts : undefined;
    if (!Array.isArray(receipts) || receipts.length === 0) {
      return NextResponse.json(
        { success: false, error: "receipts array is required." },
        { status: 400 }
      );
    }
    if (receipts.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_BATCH_SIZE} receipts per batch.` },
        { status: 400 }
      );
    }

    // Every receipt in the batch counts against the same per-IP budget as
    // single verifications, so batching is not a way around the limit.
    const itemLimited = rateLimited(limiters.verify, request.headers, receipts.length);
    if (itemLimited) return itemLimited;

    const str = (v: unknown) => (typeof v === "string" ? v : undefined);
    const inputs: ReceiptInput[] = receipts.map((raw: unknown) => {
      const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
      return {
        bank: str(r.bank) ?? "",
        reference: str(r.reference),
        accountNumber: str(r.accountNumber),
        phoneNumber: str(r.phoneNumber),
        qrData: str(r.qrData),
      };
    });

    // End-of-day reconciliation re-sends the same receipts, so serve the ones
    // we already fetched from the bank and only hit the endpoint for misses.
    const keys = inputs.map((r) => verificationCacheKey(r));
    const hits = keys.map((k) => getCached(k));
    const missIndices: number[] = [];
    hits.forEach((h, i) => {
      if (!h) missIndices.push(i);
    });

    const fresh =
      missIndices.length > 0
        ? await verifier.verifyBatch(missIndices.map((i) => inputs[i]))
        : [];

    let freshCursor = 0;
    type BatchItem = { [key: string]: unknown; success?: boolean };
    const results: BatchItem[] = inputs.map((_, i) => {
      const hit = hits[i];
      if (hit) {
        return { ...hit, cached: true, durationMs: undefined };
      }
      const r = fresh[freshCursor++];
      if (!r) {
        return { success: false, error: "No result.", status: 500 };
      }
      if (!r.ok) {
        return {
          success: false,
          error: errorToMessage(r.error),
          status: errorToHttpStatus(r.error),
        };
      }
      const payload = { success: true, ...r.value };
      if (r.value.verified) setCached(keys[i], payload);
      return { ...payload, cached: false };
    });

    // The SDKs read `verified` and `failed` counts. Only verified:true counts
    // as verified; a decoded-only BOA QR or an error counts as failed.
    const verifiedCount = results.filter((r) => r.verified === true).length;
    return NextResponse.json({
      success: true,
      results,
      cached: results.filter((r) => r.cached === true).length,
      total: results.length,
      verified: verifiedCount,
      failed: results.length - verifiedCount,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
