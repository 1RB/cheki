import { NextRequest, NextResponse } from "next/server";
import { Verifier, errorToHttpStatus, errorToMessage } from "@/lib";
import { getCached, setCached, verificationCacheKey } from "@/lib/receipt-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const verifier = new Verifier();

type ReceiptInput = {
  bank: string;
  reference?: string;
  accountNumber?: string;
  phoneNumber?: string;
  qrData?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const receipts = body.receipts;
    if (!Array.isArray(receipts) || receipts.length === 0) {
      return NextResponse.json(
        { success: false, error: "receipts array is required." },
        { status: 400 }
      );
    }
    if (receipts.length > 50) {
      return NextResponse.json(
        { success: false, error: "Maximum 50 receipts per batch." },
        { status: 400 }
      );
    }

    const inputs: ReceiptInput[] = receipts.map(
      (r: { bank: string; reference?: string; accountNumber?: string; phoneNumber?: string; qrData?: string }) => ({
        bank: r.bank,
        reference: r.reference,
        accountNumber: r.accountNumber,
        phoneNumber: r.phoneNumber,
        qrData: r.qrData,
      })
    );

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

    return NextResponse.json({
      success: true,
      results,
      cached: results.filter((r) => r.cached === true).length,
      total: results.length,
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
