import { NextRequest, NextResponse } from "next/server";
import { Verifier, errorToHttpStatus, errorToMessage } from "@/lib";
import { getCached, setCached, verificationCacheKey } from "@/lib/receipt-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const regions = ["fra1"];
export const maxDuration = 60; // CBE legacy PDF endpoint can take 10-30s

const verifier = new Verifier();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // A receipt is immutable, so a repeat check never needs the bank again.
    const key = verificationCacheKey(body);
    const cached = getCached(key);
    if (cached) {
      return NextResponse.json(
        // Drop durationMs: it describes a fetch that did not happen.
        { ...cached, cached: true, durationMs: undefined },
        { headers: { "x-cheki-cache": "hit" } }
      );
    }

    const result = await verifier.verify({
      bank: body.bank,
      reference: body.reference,
      accountNumber: body.accountNumber,
      phoneNumber: body.phoneNumber,
      qrData: body.qrData,
    });

    if (!result.ok) {
      const status = errorToHttpStatus(result.error);
      const message = errorToMessage(result.error);
      const response: Record<string, unknown> = {
        success: false,
        error: message,
      };
      // Include fallback URL for geo-blocked banks
      if (result.error.kind === "ENDPOINT_ERROR" && "fallbackUrl" in result.error) {
        response.fallbackUrl = (result.error as { fallbackUrl?: string }).fallbackUrl;
      }
      // Failures are never cached — a timeout or geo-block must retry live.
      return NextResponse.json(response, { status });
    }

    const payload = { success: true, ...result.value };
    if (result.value.verified) setCached(key, payload);

    return NextResponse.json({ ...payload, cached: false }, {
      headers: { "x-cheki-cache": "miss" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Internal server error." },
      { status: 500 }
    );
  }
}
